/**
 * Экран выполнения (§12 ТЗ).
 *
 * Каждый подход пишется в базу сразу, поэтому отдельного сохранения нет, а
 * незавершённая тренировка переживает закрытие вкладки (§18).
 *
 * Режим влияет только на то, куда приложение переводит взгляд после подхода:
 * данные пишутся одинаково, и в любой момент можно уйти на другое упражнение
 * (§11, §14).
 */

import { ui } from '../core/ui.js';
import { actions } from '../core/actions.js';
import { dialog } from '../core/dialog.js';
import { dbService } from '../services/db.js';
import { engine, STATE } from '../core/engine.js';
import { records } from '../core/records.js';
import { restTimer } from '../core/timer.js';
import { wakeLock } from '../core/wakelock.js';
import { fullscreen } from '../core/fullscreen.js';
import { config } from '../config.js';
import { format } from '../core/format.js';
import { dates } from '../core/dates.js';
import { app } from '../app.js';

/** Выбранное упражнение и режим переживают перерисовку экрана. */
let currentId = null;
let mode = null;
let ticker = 0;
let unsubscribe = [];

/** Данные последней отрисовки — чтобы обработчики не ходили в базу заново. */
let view = null;

const STATE_LABEL = {
    [STATE.PENDING]: 'не начато',
    [STATE.ACTIVE]:  'в работе',
    [STATE.DONE]:    'выполнено',
    [STATE.SKIPPED]: 'пропущено',
    [STATE.EXTRA]:   'вне плана'
};

async function load() {
    const workout = await dbService.getActiveWorkout();
    if (!workout) return null;

    const [sets, list] = await Promise.all([
        dbService.listSets(workout.id),
        dbService.listExercises({ includeArchived: true })
    ]);

    const exercises = Object.fromEntries(list.map((e) => [e.id, e]));
    const rows = engine.progress(workout.plan, sets);

    // Выбранное упражнение могло закончиться или быть пропущенным — тогда
    // возвращаемся к подсказке движка
    const valid = rows.some((r) => r.exerciseId === currentId && r.state !== STATE.SKIPPED);
    if (!valid) currentId = engine.nextStep(workout.plan, sets)?.exerciseId || rows[0]?.exerciseId || null;

    // История нужна только по текущему упражнению: тянуть её по всем сразу
    // означало бы читать половину базы ради двух строк на экране
    const kind = exercises[currentId]?.kind || 'weight';
    const history = currentId ? await dbService.listSetsByExercise(currentId) : [];

    return {
        workout, sets, exercises, rows, kind,
        last: records.lastSession(history, workout.id),
        best: records.best(history, kind, workout.id)
    };
}

/**
 * Ориентиры перед подходом (§15).
 *
 * Текущая тренировка в рекорд не входит, пока не завершена: иначе «лучший
 * результат» обновлялся бы прямо во время выполнения и сравнивать было бы
 * не с чем.
 */
function recordsBlock({ last, best, kind }) {
    if (!last && !best) {
        return ui.html`<div class="rec-line rec-empty">Первый раз — ориентиров пока нет</div>`;
    }

    return ui.html`
        ${last ? ui.html`
            <div class="rec-line">
                <span class="rec-label">Последний раз</span>
                <span class="rec-value">${records.describeSession(last.sets, kind)}</span>
                <span class="rec-when">${dates.formatDayLabel(last.performedAt)}</span>
            </div>
        ` : ''}

        ${best ? ui.html`
            <div class="rec-line">
                <span class="rec-label">Лучший результат</span>
                <span class="rec-value">${records.describe(best, kind)}</span>
            </div>
        ` : ''}
    `;
}

/*
 * Разовый максимум с этого экрана убран намеренно.
 *
 * Он оценочный, считается по формуле и выше десяти повторений заметно
 * врёт, а место занимал в самом тесном месте приложения. Между подходами
 * важно, что было в прошлый раз и каков рекорд, — прикидка не нужна.
 * На карточке упражнения, где место есть, он остался.
 */

/**
 * Изменение последнего подхода к прошлому разу (§15.1).
 *
 * Без него человек сравнивает числа в уме: «в прошлый раз во втором
 * подходе было 60 на 9, сейчас 62,5 на 8 — это лучше или хуже?». Приложение
 * знает оба числа и должно отвечать само.
 *
 * Сравнивается подход с тем же номером: второй со вторым. К концу
 * упражнения сил меньше, и сравнение третьего подхода с первым всегда
 * показывало бы спад.
 */
function deltaLine({ last, kind }, own) {
    if (!last) return '';

    const current = own[own.length - 1];
    const previous = last.sets.find((s) => s.setNumber === current.setNumber);

    const delta = records.delta(current, previous, kind);
    if (!delta) return '';

    if (delta.parts.length === 0) {
        return ui.html`<div class="sess-delta is-same">как в прошлый раз</div>`;
    }

    return ui.html`
        <div class="sess-delta ${delta.better === true ? 'is-up' : delta.better === false ? 'is-down' : ''}">
            ${delta.parts.join(', ')} к прошлому разу
        </div>
    `;
}

/** Полоса отдыха. Ввод следующего подхода она не перекрывает (§16). */
function restBar() {
    if (!restTimer.running) return '';

    return ui.html`
        <div class="rest-bar">
            <span class="rest-label">Отдых</span>
            <strong id="rest-remaining">${format.seconds(restTimer.remaining)}</strong>
            <button class="chip" data-action="rest-shorten">−30 с</button>
            <button class="chip" data-action="rest-extend">+30 с</button>
            <button class="chip" data-action="rest-skip">Пропустить</button>
        </div>
    `;
}

/** Поля ввода зависят от вида упражнения (§6). */
function fields(kind, prefill) {
    const value = (v) => (v === null || v === undefined ? '' : v);

    if (kind === 'time') {
        return ui.html`
            <input type="number" class="big-input" id="f-duration" min="0" inputmode="numeric"
                   placeholder="0" value="${value(prefill.duration)}" data-enter="sess-done">
            <div class="big-label">секунд</div>
        `;
    }

    if (kind === 'distance') {
        return ui.html`
            <input type="number" class="big-input" id="f-distance" min="0" inputmode="numeric"
                   placeholder="0" value="${value(prefill.distance)}" data-enter="sess-done">
            <div class="big-label">метров</div>
            <div class="inline-field">
                <span>время:</span>
                <input type="number" id="f-duration" min="0" inputmode="numeric"
                       placeholder="—" value="${value(prefill.duration)}">
                <span>сек</span>
            </div>
        `;
    }

    return ui.html`
        <input type="number" class="big-input" id="f-reps" min="0" inputmode="numeric"
               placeholder="0" value="${value(prefill.reps)}" data-enter="sess-done">
        <div class="big-label">повторений</div>
        <div class="inline-field">
            <span>вес:</span>
            <input type="number" id="f-weight" min="0" step="0.5" inputmode="decimal"
                   placeholder="—" value="${value(prefill.weight)}">
            <span>кг</span>
        </div>
    `;
}

function currentCard({ workout, sets, exercises, rows }) {
    const row = rows.find((r) => r.exerciseId === currentId);
    if (!row) return ui.empty('Добавь упражнение, чтобы начать.');

    const exercise = exercises[currentId] || {};
    const prefill = engine.prefill(workout.plan, sets, currentId);
    const own = engine.setsOf(sets, currentId);

    const planItem = workout.plan.find((p) => p.exerciseId === currentId);

    return ui.html`
        <div class="card session-card">
            <div class="sess-name">${exercise.name || 'Упражнение'}</div>
            <div class="sess-set">
                ${row.planned > 0
                    ? `Подход ${row.done + 1} из ${row.planned}`
                    : `Подход ${row.done + 1}`}
            </div>

            <div class="rec-block">${recordsBlock(view)}</div>

            ${fields(exercise.kind || 'weight', prefill)}

            <div class="note-row">
                <button class="link-btn" data-action="sess-note-toggle">＋ заметка к подходу</button>
                <input type="text" id="f-note" class="note-input" hidden
                       placeholder="техника, самочувствие, особенности" autocomplete="off">
            </div>

            <button class="btn btn-done btn-lg" data-action="sess-done">Выполнено</button>

            ${restBar()}

            ${own.length ? ui.html`
                <div class="sess-done">
                    <span class="sess-done-label">Сделано</span>
                    <span class="num">${records.describeSession(own, exercise.kind)}</span>
                </div>
                ${deltaLine(view, own)}
            ` : ''}

            <!--
                Редкие действия убраны под «Ещё»: пропуск, отмена и заметка
                нужны в одном подходе из двадцати, а место на главном экране
                занимали постоянно. Список сворачивается обратно после каждой
                записи — так и задумано.
            -->
            <div class="note-row">
                <button class="link-btn" data-action="sess-more">Ещё…</button>
            </div>

            <div class="sess-tools" hidden>
                <button class="btn btn-ghost btn-sm" data-action="sess-skip">Пропустить упражнение</button>
                ${own.length ? ui.html`
                    <button class="btn btn-ghost btn-sm" data-action="sess-undo">Отменить последний подход</button>
                ` : ''}
                <button class="btn btn-ghost btn-sm" data-action="sess-note-exercise">
                    ${planItem?.note ? 'Заметка к упражнению ✎' : 'Заметка к упражнению'}
                </button>
                <button class="btn btn-ghost btn-sm" data-action="sess-rest">
                    Отдых: ${format.seconds(exercise.restSeconds || config.get('restSeconds'))}
                    ${exercise.restSeconds ? '' : ' (общий)'}
                </button>
            </div>

            ${planItem?.note ? ui.html`<p class="note-shown">${planItem.note}</p>` : ''}
        </div>
    `;
}

function exerciseList({ exercises, rows }) {
    const items = rows.map((row, i) => ui.html`
        <button class="prog-row ${row.exerciseId === currentId ? 'is-current' : ''} is-${row.state}"
                data-action="sess-select" data-id="${row.exerciseId}">
            ${i < 9 ? ui.html`<span class="prog-key">${String(i + 1)}</span>` : ''}
            <span class="prog-name">${exercises[row.exerciseId]?.name || 'Упражнение'}</span>
            <span class="prog-count">${row.planned > 0 ? `${row.done}/${row.planned}` : String(row.done)}</span>
            <span class="prog-state">${STATE_LABEL[row.state]}</span>
        </button>
    `);

    return ui.html`
        <div class="card">
            <div class="card-title">Упражнения</div>
            <div class="prog-list">${items}</div>
            <button class="btn btn-ghost btn-sm" data-action="sess-add">+ Добавить упражнение</button>
            <p class="hint keys-hint">Цифра — выбрать упражнение, Enter — записать подход, пробел — пропустить отдых.</p>
        </div>
    `;
}

export const session = {

    title: 'Выполнение',
    nav: 'workout',

    async render() {
        if (mode === null) mode = config.get('mode');

        view = await load();

        if (!view) {
            return ui.html`
                ${ui.title('Выполнение')}
                ${ui.empty('Активной тренировки нет.')}
                <button class="btn btn-accent" data-action="nav" data-screen="plan">Составить тренировку</button>
                <button class="btn btn-ghost" data-action="nav" data-screen="home">← На главную</button>
            `;
        }

        const { workout, sets } = view;
        const totals = engine.totals(workout.plan, sets);
        const complete = engine.isComplete(workout.plan, sets);

        return ui.html`
            <div class="sess-head">
                <div>
                    <div class="sess-type">${workout.type}</div>
                    <div class="sess-meta">
                        <strong id="sess-elapsed">${format.duration(Date.now() - workout.startedAt)}</strong>
                        · ${String(totals.done)} из ${String(totals.planned)} подходов
                    </div>
                </div>
                <div class="chips">
                    <button class="chip ${mode === 'plan' ? 'is-active' : ''}" data-action="sess-mode" data-mode="plan">По плану</button>
                    <button class="chip ${mode === 'free' ? 'is-active' : ''}" data-action="sess-mode" data-mode="free">Свободный</button>
                </div>
            </div>

            ${complete ? ui.html`
                <div class="banner"><span>План выполнен — можно завершать</span></div>
            ` : ''}

            <div class="sess-layout">
                <div class="sess-main">${currentCard(view)}</div>
                <div class="sess-side">${exerciseList(view)}</div>
            </div>

            ${workout.note ? ui.html`
                <div class="card"><div class="card-title">Заметка к тренировке</div><p>${workout.note}</p></div>
            ` : ''}

            <button class="btn btn-ghost" data-action="sess-note-workout">
                ${workout.note ? 'Изменить заметку к тренировке' : 'Заметка к тренировке'}
            </button>

            <button class="btn ${complete ? 'btn-accent' : 'btn-ghost'}" data-action="sess-finish">
                Завершить тренировку
            </button>
        `;
    },

    /**
     * Время идёт от сохранённого момента старта, а не от счётчика тиков
     * (§17): вкладку сворачивают, таймеры засыпают, и досчитывать надо от
     * часов, а не от того, сколько раз успел сработать интервал.
     */
    mount() {
        clearInterval(ticker);
        unsubscribe.forEach((off) => off());
        unsubscribe = [];

        if (!view) return;

        ticker = setInterval(() => {
            const live = document.getElementById('sess-elapsed');
            if (!live) return clearInterval(ticker);

            live.textContent = format.duration(Date.now() - view.workout.startedAt);
        }, 1000);

        // Полоса отдыха обновляется на месте: перерисовывать экран раз в
        // секунду означало бы вырывать фокус из поля ввода
        unsubscribe.push(restTimer.on('tick', () => {
            const el = document.getElementById('rest-remaining');
            if (el) el.textContent = format.seconds(restTimer.remaining);
        }));

        // А вот исчезновение полосы — уже смена состава экрана
        unsubscribe.push(restTimer.on('finish', () => app.render()));

        keyboard.attach();

        // Между подходами проходит минута-полторы, и экран успевает
        // погаснуть ровно к моменту записи результата (§28)
        wakeLock.enable();

        // Полный экран включается на первом касании после запуска (§31), но
        // из него можно выйти жестом. Начало тренировки — надёжное действие
        // пользователя и хороший повод вернуться туда, где панели мешают
        // больше всего
        fullscreen.enterIfWanted();
    },

    unmount() {
        clearInterval(ticker);
        unsubscribe.forEach((off) => off());
        unsubscribe = [];

        keyboard.detach();
        wakeLock.disable();
    }
};

/**
 * Клавиатура на экране выполнения (§32).
 *
 * За компьютером руки уже на клавиатуре, и тянуться мышью к списку
 * упражнений после каждого подхода — лишнее движение. Цифра выбирает
 * упражнение по его номеру в списке, Enter записывает подход (это делает
 * data-enter на поле), пробел пропускает отдых.
 *
 * Обработчик снимается при уходе с экрана: иначе цифры продолжали бы
 * что-то выбирать в истории и статистике.
 */
const keyboard = {

    handler: null,

    attach() {
        keyboard.detach();

        keyboard.handler = (e) => {
            // В поле ввода цифры — это цифры, а не команды.
            // Цель события не всегда элемент, поэтому проверка через ?.
            if (e.target?.matches?.('input, textarea, select')) return;
            if (e.ctrlKey || e.altKey || e.metaKey) return;

            if (e.code === 'Space' && restTimer.running) {
                e.preventDefault();
                restTimer.stop();
                return app.render();
            }

            const digit = Number(e.key);
            if (!Number.isInteger(digit) || digit < 1 || digit > 9) return;

            const row = view?.rows[digit - 1];
            if (!row) return;

            e.preventDefault();
            currentId = row.exerciseId;
            mode = 'free';
            app.render();
        };

        document.addEventListener('keydown', keyboard.handler);
    },

    detach() {
        if (!keyboard.handler) return;

        document.removeEventListener('keydown', keyboard.handler);
        keyboard.handler = null;
    }
};

// ================== ЗАПИСЬ ПОДХОДА ==================

function invalid(id) {
    const el = document.getElementById(id);
    if (!el) return;

    el.focus();
    el.classList.add('is-invalid');
    setTimeout(() => el.classList.remove('is-invalid'), 800);
}

/** Значения полей по виду упражнения. null означает «не прошло проверку». */
function readFields(kind) {
    const num = (id) => {
        const el = document.getElementById(id);
        if (!el || el.value.trim() === '') return null;
        const value = Number(el.value);
        return Number.isFinite(value) ? value : null;
    };

    if (kind === 'time') {
        const duration = num('f-duration');
        if (!duration || duration <= 0) { invalid('f-duration'); return null; }
        return { duration };
    }

    if (kind === 'distance') {
        const distance = num('f-distance');
        const duration = num('f-duration');
        if (!distance && !duration) { invalid('f-distance'); return null; }
        return { distance: distance || undefined, duration: duration || undefined };
    }

    const reps = num('f-reps');
    if (reps === null || reps < 0) { invalid('f-reps'); return null; }

    return { reps, weight: num('f-weight') || undefined };
}

actions.on('sess-done', async () => {
    if (!view || !currentId) return;

    const { workout, sets, exercises } = view;
    const kind = exercises[currentId]?.kind || 'weight';

    const values = readFields(kind);
    if (!values) return;

    const note = document.getElementById('f-note')?.value.trim();

    await dbService.addSet({
        workoutId: workout.id,
        exerciseId: currentId,
        order: engine.nextOrder(sets),
        setNumber: engine.nextSetNumber(sets, currentId),
        note: note || undefined,
        ...values
    });

    // Отдых запускается от нажатия, а не от отрисовки: пользователь уже
    // взаимодействовал со страницей, и браузер разрешит звук в конце.
    //
    // Длительность — своя у упражнения, если задана: между подходами
    // приседа и планки отдыхают по-разному (§16)
    restTimer.start(exercises[currentId]?.restSeconds || config.get('restSeconds'), currentId);

    // В режиме «по плану» приложение само переводит к следующему шагу,
    // в свободном — остаётся там, где стоял пользователь (§11)
    if (mode === 'plan') {
        const next = engine.nextStep(workout.plan, [...sets, { exerciseId: currentId, order: 0 }]);
        if (next) currentId = next.exerciseId;
    }

    app.render();
});

// ================== ОТДЫХ ==================

actions.on('rest-skip', () => {
    restTimer.stop();
    app.render();
});

actions.on('rest-extend', () => restTimer.extend(30));
actions.on('rest-shorten', () => restTimer.extend(-30));

// ================== ЗАМЕТКИ (§20) ==================

actions.on('sess-more', (el) => {
    const tools = document.querySelector('.sess-tools');
    if (!tools) return;

    // Без перерисовки: она сбросила бы уже введённые в поля значения
    tools.hidden = !tools.hidden;
    el.textContent = tools.hidden ? 'Ещё…' : 'Свернуть';
});

actions.on('sess-note-toggle', (el) => {
    const input = document.getElementById('f-note');
    if (!input) return;

    // Без перерисовки: поле открывается рядом с уже введёнными значениями,
    // и терять их ради показа одной строки незачем
    input.hidden = !input.hidden;
    el.textContent = input.hidden ? '＋ заметка к подходу' : '− заметка к подходу';

    if (!input.hidden) input.focus();
});

/**
 * Своя длительность отдыха для упражнения (§16).
 *
 * Между подходами приседа и планки отдыхают по-разному, и заставлять
 * менять общую настройку туда-сюда посреди тренировки — не дело.
 * Значение хранится у упражнения, а не в тренировке: оно про упражнение и
 * должно сохраняться на следующий раз.
 */
actions.on('sess-rest', async () => {
    if (!view || !currentId) return;

    const exercise = view.exercises[currentId];

    const values = await dialog.form({
        title: `Отдых: ${exercise.name}`,
        text: `Общая настройка — ${format.seconds(config.get('restSeconds'))}. Пустое поле вернёт её.`,
        fields: [{
            name: 'rest',
            label: 'Секунд',
            type: 'number',
            value: exercise.restSeconds ?? '',
            placeholder: String(config.get('restSeconds'))
        }]
    });

    if (!values) return;

    const seconds = Number(values.rest);
    await dbService.updateExercise(currentId, {
        restSeconds: seconds > 0 ? seconds : undefined
    });

    app.render();
});

actions.on('sess-note-exercise', async () => {
    if (!view || !currentId) return;

    const item = view.workout.plan.find((p) => p.exerciseId === currentId);

    const values = await dialog.form({
        title: `Заметка: ${view.exercises[currentId]?.name || 'упражнение'}`,
        text: 'Относится к этому упражнению в текущей тренировке.',
        fields: [{ name: 'note', label: 'Заметка', type: 'textarea', value: item?.note || '' }]
    });

    if (!values) return;

    const plan = view.workout.plan.map((p) =>
        p.exerciseId === currentId ? { ...p, note: values.note || undefined } : p);

    await dbService.updateWorkout(view.workout.id, { plan });
    app.render();
});

actions.on('sess-note-workout', async () => {
    if (!view) return;

    const values = await dialog.form({
        title: 'Заметка к тренировке',
        text: 'Самочувствие, общие впечатления, что учесть в следующий раз.',
        fields: [{ name: 'note', label: 'Заметка', type: 'textarea', value: view.workout.note || '' }]
    });

    if (!values) return;

    await dbService.updateWorkout(view.workout.id, { note: values.note });
    app.render();
});

actions.on('sess-undo', async () => {
    const own = engine.setsOf(view.sets, currentId);
    const last = own[own.length - 1];
    if (!last) return;

    const ok = await dialog.confirm({
        title: 'Отменить последний подход?',
        text: 'Запись будет удалена из журнала тренировки.',
        confirmText: 'Отменить подход',
        danger: true
    });

    if (!ok) return;

    await dbService.deleteSet(last.id);
    app.render();
});

// ================== НАВИГАЦИЯ ПО УПРАЖНЕНИЯМ ==================

actions.on('sess-select', (el) => {
    currentId = el.dataset.id;

    // Ручной выбор — это и есть свободный режим: иначе следующий же подход
    // отбросил бы пользователя обратно к плану
    mode = 'free';
    app.render();
});

actions.on('sess-mode', (el) => {
    mode = el.dataset.mode;

    if (mode === 'plan' && view) {
        const next = engine.nextStep(view.workout.plan, view.sets);
        if (next) currentId = next.exerciseId;
    }

    app.render();
});

actions.on('sess-skip', async () => {
    if (!view || !currentId) return;

    const plan = view.workout.plan.map((item) =>
        item.exerciseId === currentId ? { ...item, skipped: true } : item);

    await dbService.updateWorkout(view.workout.id, { plan });

    currentId = null;   // load() подберёт следующее по подсказке движка
    app.render();
});

actions.on('sess-add', async () => {
    const all = await dbService.listExercises();
    const inPlan = new Set(view.workout.plan.map((p) => p.exerciseId));

    const chosen = await dialog.pick({
        title: 'Добавить упражнение',
        text: 'Оно встанет в план текущей тренировки.',
        items: all.filter((e) => !inPlan.has(e.id)).map((e) => ({ value: e.id, label: e.name, hint: e.group })),
        createLabel: 'Создать'
    });

    if (!chosen) return;

    const exercise = chosen.create
        ? await dbService.ensureExercise({ name: chosen.create })
        : all.find((e) => e.id === chosen);

    if (!exercise) return;

    const plan = [...view.workout.plan, {
        exerciseId: exercise.id,
        plannedSets: 3,
        targetReps: null,
        weight: 0,
        skipped: false
    }];

    await dbService.updateWorkout(view.workout.id, { plan });

    currentId = exercise.id;
    mode = 'free';
    app.render();
});

// ================== ЗАВЕРШЕНИЕ ==================

actions.on('sess-finish', async () => {
    if (!view) return;

    const { workout, sets } = view;

    if (sets.length === 0) {
        const choice = await dialog.choose({
            title: 'Ни одного подхода не записано',
            text: 'Завершать нечего.',
            options: [
                { value: 'delete', label: 'Удалить тренировку', danger: true },
                { value: 'stay', label: 'Вернуться к тренировке' }
            ]
        });

        if (choice !== 'delete') return;

        await dbService.deleteWorkout(workout.id);
        return app.go('home');
    }

    const ok = await dialog.confirm({
        title: 'Завершить тренировку?',
        text: `Записано ${format.count(sets.length, format.WORDS.set)}.`,
        confirmText: 'Завершить'
    });

    if (!ok) return;

    await dbService.finishWorkout(workout.id);

    restTimer.stop();
    currentId = null;
    mode = null;

    app.go('summary', workout.id);
});
