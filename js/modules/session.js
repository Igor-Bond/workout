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
import { config } from '../config.js';
import { format } from '../core/format.js';
import { app } from '../app.js';

/** Выбранное упражнение и режим переживают перерисовку экрана. */
let currentId = null;
let mode = null;
let ticker = 0;

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

    return { workout, sets, exercises, rows };
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

    const log = own.map((s) => ui.html`
        <tr>
            <td>${String(s.setNumber)}</td>
            <td>${s.reps ?? (s.duration ? format.seconds(s.duration) : '—')}</td>
            <td>${s.weight ? format.weight(s.weight) : (s.distance ? format.distance(s.distance) : '—')}</td>
        </tr>
    `);

    return ui.html`
        <div class="card session-card">
            <div class="sess-name">${exercise.name || 'Упражнение'}</div>
            <div class="sess-set">
                ${row.planned > 0
                    ? `Подход ${row.done + 1} из ${row.planned}`
                    : `Подход ${row.done + 1}`}
            </div>

            ${fields(exercise.kind || 'weight', prefill)}

            <button class="btn btn-done btn-lg" data-action="sess-done">Выполнено</button>

            <div class="sess-tools">
                <button class="btn btn-ghost btn-sm" data-action="sess-skip">Пропустить упражнение</button>
                ${own.length ? ui.html`
                    <button class="btn btn-ghost btn-sm" data-action="sess-undo">Отменить последний подход</button>
                ` : ''}
            </div>

            ${own.length ? ui.html`
                <table class="log">
                    <thead><tr><th>Подход</th><th>Повторы</th><th>Вес</th></tr></thead>
                    <tbody>${log}</tbody>
                </table>
            ` : ''}
        </div>
    `;
}

function exerciseList({ exercises, rows }) {
    const items = rows.map((row) => ui.html`
        <button class="prog-row ${row.exerciseId === currentId ? 'is-current' : ''} is-${row.state}"
                data-action="sess-select" data-id="${row.exerciseId}">
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

        const el = document.getElementById('sess-elapsed');
        if (!el || !view) return;

        ticker = setInterval(() => {
            const live = document.getElementById('sess-elapsed');
            if (!live) return clearInterval(ticker);

            live.textContent = format.duration(Date.now() - view.workout.startedAt);
        }, 1000);
    },

    unmount() {
        clearInterval(ticker);
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

    await dbService.addSet({
        workoutId: workout.id,
        exerciseId: currentId,
        order: engine.nextOrder(sets),
        setNumber: engine.nextSetNumber(sets, currentId),
        ...values
    });

    // В режиме «по плану» приложение само переводит к следующему шагу,
    // в свободном — остаётся там, где стоял пользователь (§11)
    if (mode === 'plan') {
        const next = engine.nextStep(workout.plan, [...sets, { exerciseId: currentId, order: 0 }]);
        if (next) currentId = next.exerciseId;
    }

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

    currentId = null;
    mode = null;

    app.go('summary', workout.id);
});
