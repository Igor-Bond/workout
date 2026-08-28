/**
 * Стартовый экран (§29 ТЗ).
 *
 * Порядок блоков — по частоте нажатия, а не по важности темы. Сначала судьба
 * незавершённой тренировки (§18), потом способы начать новую — от самого
 * частого к самому редкому: повтор прошлой (§9), шаблоны (§8), тренировка
 * с нуля. Ярким выделен только последний пункт этой лестницы: он завершает
 * её и потому стоит внизу, где палец и так оказывается.
 *
 * Ритм (§26.2) — справка, а не действие. Он стоит строкой под заголовком:
 * карточкой он раздвигал кнопку продолжения и быстрый старт, то есть
 * отодвигал частое ради редкого.
 *
 * При незавершённой тренировке способы начать новую не показываются вовсе:
 * одновременно идёт только одна (§18), и вторая всё равно упёрлась бы в
 * вопрос о судьбе первой — а он уже задан здесь же, выше.
 */

import { ui } from '../core/ui.js';
import { actions } from '../core/actions.js';
import { dialog } from '../core/dialog.js';
import { dbService } from '../services/db.js';
import { engine } from '../core/engine.js';
import { rhythm } from '../core/rhythm.js';
import { stats } from '../core/stats.js';
import { format } from '../core/format.js';
import { dates } from '../core/dates.js';
import { app } from '../app.js';

const DAY = 86400000;

/**
 * Порог, после которого тренировку считаем забытой.
 *
 * Продолжать её нельзя: длительность считается от старта, и забытая с вечера
 * тренировка добавила бы к статистике десяток часов (§18).
 */
const STALE_MS = 12 * 60 * 60 * 1000;

/** Сколько упражнений перечислять, прежде чем свернуть остаток в «и ещё N». */
const NAMES_SHOWN = 3;

async function activeBlock() {
    const workout = await dbService.getActiveWorkout();
    if (!workout) return null;

    const sets = await dbService.listSets(workout.id);
    const totals = engine.totals(workout.plan, sets);
    const stale = Date.now() - workout.startedAt > STALE_MS;

    // Завершение и удаление — ссылками, а не кнопками: они нужны в одном
    // случае из десяти, а кнопкой выглядели наравне с продолжением
    const drop = ui.html`
        <button class="link-btn is-danger" data-action="home-drop" data-id="${workout.id}">Удалить</button>
    `;

    return ui.html`
        <div class="section">
            <div class="section-title">Незавершённая тренировка</div>

            <div class="card">
                <div class="active-type">${workout.type}</div>
                <div class="active-meta">
                    начата ${dates.formatDayLabel(workout.startedAt)} в ${dates.formatTime(workout.startedAt)}
                    · ${String(totals.done)} из ${String(totals.planned)} подходов
                </div>

                ${stale ? ui.html`
                    <p class="hint">Прошло больше 12 часов. Продолжать её не стоит — время тренировки считается от старта.</p>
                    <button class="btn btn-accent" data-action="home-finish-stale" data-id="${workout.id}">
                        Завершить прошедшей датой
                    </button>
                    <div class="row-links">${drop}</div>
                ` : ui.html`
                    <button class="btn btn-accent btn-lg" data-action="nav" data-screen="session">Продолжить</button>
                    <div class="row-links">
                        <button class="link-btn" data-action="home-finish" data-id="${workout.id}">Завершить как есть</button>
                        ${drop}
                    </div>
                `}
            </div>
        </div>
    `;
}

/**
 * Ритм и прогноз следующей тренировки (§26.2), двумя строками.
 *
 * Прогноз показывается только когда данных достаточно. При рваном ритме
 * рядом стоит оговорка: обещать день с уверенностью, которой нет, хуже,
 * чем не обещать вовсе.
 */
function rhythmStrip(workouts) {
    const r = rhythm.analyze(workouts);

    if (r.count === 0) return null;

    if (!r.enough) {
        return ui.html`
            <div class="rhythm-strip">
                <span class="rhythm-state">Проведено ${format.count(r.count, format.WORDS.workout)}</span>
                <span class="rhythm-detail">
                    Ещё ${format.count(r.need, format.WORDS.workout)} — и появится прогноз ритма
                </span>
            </div>
        `;
    }

    const headline = r.state === 'overdue'
        ? `${format.count(r.daysSince, format.WORDS.day)} без тренировки`
        : r.state === 'due'
            ? 'Пора тренироваться'
            : `Следующая — ${dates.formatDayLabel(r.nextAt).toLowerCase()}`;

    return ui.html`
        <div class="rhythm-strip is-${r.state}">
            <span class="rhythm-state">${headline}</span>
            <span class="rhythm-detail">
                Обычно раз в ${format.count(r.medianInterval, format.WORDS.day)}${r.confidence === 'low' ? ', ритм рваный — день примерный' : ''}
            </span>
        </div>
    `;
}

/** Названия упражнений тренировки: три и «ещё N», чтобы строка не разъезжалась. */
function exerciseLine(entry, names) {
    const list = (entry.exerciseIds || []).map((id) => names.get(id)).filter(Boolean);

    if (list.length === 0) return entry.workout.type;

    const shown = list.slice(0, NAMES_SHOWN).join(' · ');
    return list.length > NAMES_SHOWN ? `${shown} и ещё ${list.length - NAMES_SHOWN}` : shown;
}

/**
 * Способы начать: повтор прошлой, шаблоны, тренировка с нуля.
 *
 * Лестница от частого к редкому. Повтор стоит первым, но оформлен спокойно:
 * ярких пятен на экране должно быть одно, и оно отдано кнопке внизу, которая
 * завершает перебор. На самом повторе крупно — упражнения: по ним узнают
 * тренировку, а тип и дата это лишь уточняют.
 */
function startBlock(last, templates, suggestion, names, due) {

    // Подсказка чередования полезна, только если предлагает не то же самое,
    // что кнопка повтора: иначе она повторяет её же словами
    const differs = suggestion && (!last || suggestion.type !== last.workout.type);

    // Подсказка называет тип тренировки, а у шаблона тип может быть общим
    // («Силовая») при говорящем названии («Ноги») — поэтому сверяем и с ним
    const suggests = (t) => differs && (t.type === suggestion.type || t.name === suggestion.type);

    const chips = templates.slice(0, 4).map((t) => ui.html`
        <button class="chip ${suggests(t) ? 'is-active' : ''}"
                data-action="home-template" data-id="${t.id}">${t.name}</button>
    `);

    /*
     * Чему пора по периодичности каждого упражнения (§26.2.3).
     *
     * Точнее подсказки по типу тренировки: тип у всех может быть один —
     * «Силовая», — и цикла в одинаковых значениях нет. Упражнения же
     * различаются всегда, и у каждого свой промежуток.
     */
    const dueNames = due.map((d) => names.get(d.exerciseId)).filter(Boolean);

    return ui.html`
        <div class="section">
            <div class="section-title">Начать</div>

            ${last ? ui.html`
                <button class="repeat-card" data-action="nav-plan-repeat">
                    <span class="rep-label">Повторить прошлую</span>
                    <span class="rep-names">${exerciseLine(last, names)}</span>
                    <span class="rep-meta">
                        ${last.workout.type}
                        · ${dates.formatDayLabel(last.workout.startedAt).toLowerCase()}
                        · ${format.count(last.sets, format.WORDS.set)}
                    </span>
                </button>
            ` : ''}

            ${dueNames.length ? ui.html`
                <button class="due-card" data-action="nav-plan-due">
                    <span class="rep-label">Пора по периодичности</span>
                    <span class="rep-names">${dueNames.join(' · ')}</span>
                    <span class="rep-meta">собрать тренировку из них</span>
                </button>
            ` : differs ? ui.html`
                <p class="hint">
                    ${suggestion.reason === 'cycle'
                        ? `По чередованию дальше — «${suggestion.type}»`
                        : `Дольше всего не было «${suggestion.type}»`}
                </p>
            ` : ''}

            ${templates.length ? ui.html`<div class="chips">${chips}</div>` : ''}

            <button class="btn btn-ghost" data-action="nav" data-screen="templates">
                ${templates.length ? 'Все шаблоны' : 'Создать шаблон'}
            </button>

            <button class="btn btn-accent btn-lg" data-action="nav" data-screen="plan">
                Начать тренировку
            </button>
        </div>
    `;
}

/**
 * Последние семь дней (§26).
 *
 * Скользящее окно, а не календарная неделя: в понедельник утром календарная
 * неделя пуста, и экран врал бы про спад, которого нет. Сегодня — всегда
 * крайняя правая клетка.
 */
function weekBlock(entries) {
    const now = Date.now();
    const today = dates.startOfDay(now);
    const from = today - 6 * DAY;

    const own = entries.filter((e) => e.workout.startedAt >= from);
    const trained = new Set(own.map((e) => dates.startOfDay(e.workout.startedAt)));

    const cells = [];
    for (let i = 0; i < 7; i++) {
        const day = from + i * DAY;
        const state = [
            trained.has(day) ? 'is-done' : '',
            day === today ? 'is-today' : ''
        ].filter(Boolean).join(' ');

        cells.push(ui.html`
            <div class="wk-day ${state}">${dates.WEEKDAYS_SHORT[dates.weekdayIndex(day)]}</div>
        `);
    }

    const sets = own.reduce((sum, e) => sum + e.sets, 0);
    const volume = own.reduce((sum, e) => sum + e.volume, 0);

    return ui.html`
        <div class="section">
            <div class="section-title">Последние семь дней</div>

            <div class="card">
                <div class="week-strip">${cells}</div>

                <div class="tiles is-tight">
                    <div class="tile"><strong>${String(own.length)}</strong><span>Тренировок</span></div>
                    <div class="tile"><strong>${String(sets)}</strong><span>Подходов</span></div>
                    <div class="tile"><strong>${format.decimal(volume, 0)}</strong><span>Тоннаж, кг</span></div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Вес тела (§25) — строкой, с переходом к записи в одно нажатие.
 *
 * Показывается только тем, кто уже отмечал вес: навязывать взвешивание тому,
 * кто его не ведёт, — значит занимать место просьбой, а не сведениями.
 * Запись открывает то же окно, что и на статистике: обработчик `body-add`
 * зарегистрирован там и, как и `nav`, доступен всему приложению.
 */
function bodyBlock(records) {
    if (records.length === 0) return null;

    const last = records[records.length - 1];
    const month = stats.bodyChange(records.filter((r) => r.at >= Date.now() - 30 * DAY));

    const sign = (v) => (v > 0 ? '+' : v < 0 ? '−' : '');

    return ui.html`
        <div class="section">
            <div class="section-title">Вес тела</div>

            <button class="weight-row" data-action="body-add">
                <span class="w-value">${format.weight(last.weight)} <small>кг</small></span>
                <span class="w-meta">
                    ${month && month.delta
                        ? `${sign(month.delta)}${format.weight(Math.abs(month.delta))} кг за месяц · `
                        : ''}${dates.formatDayLabel(last.at).toLowerCase()}
                </span>
            </button>
        </div>
    `;
}

export const home = {

    title: 'Тренировка',
    nav: 'workout',

    async render() {
        const [active, entries, templates, exercises, body] = await Promise.all([
            activeBlock(),
            dbService.listWorkoutSummaries(),
            dbService.listTemplates(),
            dbService.listExercises({ includeArchived: true }),
            dbService.listBodyWeight()
        ]);

        const workouts = entries.map((e) => e.workout);
        const names = new Map(exercises.map((e) => [e.id, e.name]));

        return ui.html`
            ${ui.title('Тренировка')}

            ${rhythmStrip(workouts) || ''}

            ${active || startBlock(
                entries[0],
                templates,
                rhythm.suggestType(workouts),
                names,
                rhythm.dueExercises(entries)
            )}

            ${entries.length ? weekBlock(entries) : ''}

            ${bodyBlock(body) || ''}
        `;
    }
};

// ================== ДЕЙСТВИЯ ==================

actions.on('nav-summary', (el) => app.go('summary', el.dataset.id));
actions.on('nav-plan-repeat', () => app.go('plan', 'repeat'));
actions.on('nav-plan-due', () => app.go('plan', 'due'));
actions.on('home-template', (el) => app.go('plan', 'from', el.dataset.id));

actions.on('home-finish', async (el) => {
    const ok = await dialog.confirm({
        title: 'Завершить тренировку?',
        text: 'Записанные подходы сохранятся, остальное останется невыполненным.',
        confirmText: 'Завершить'
    });

    if (!ok) return;

    await dbService.finishWorkout(el.dataset.id);
    app.go('summary', el.dataset.id);
});

actions.on('home-finish-stale', async (el) => {
    const workout = await dbService.getWorkout(el.dataset.id);
    const sets = await dbService.listSets(workout.id);

    // Временем окончания берём последний записанный подход, а не «сейчас»:
    // иначе забытая тренировка получит десяток часов длительности
    const last = sets[sets.length - 1];
    const finishedAt = last?.performedAt || workout.startedAt;

    await dbService.finishWorkout(workout.id, finishedAt);
    app.go('summary', workout.id);
});

actions.on('home-drop', async (el) => {
    const ok = await dialog.confirm({
        title: 'Удалить тренировку?',
        text: 'Всё записанное в ней пропадёт.',
        confirmText: 'Удалить',
        danger: true
    });

    if (!ok) return;

    await dbService.deleteWorkout(el.dataset.id);
    app.render();
});
