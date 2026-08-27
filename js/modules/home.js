/**
 * Стартовый экран (§29 ТЗ).
 *
 * Порядок блоков — по частоте нажатия, а не по важности темы. Сначала судьба
 * незавершённой тренировки (§18), потом способы начать новую, и первым среди
 * них — повтор прошлой (§9): с накопленной историей так начинают чаще всего.
 *
 * Ритм (§26.2) — справка, а не действие. Он стоит строкой под заголовком:
 * карточкой он раздвигал кнопку продолжения и быстрый старт, то есть отодвигал
 * частое ради редкого.
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
import { format } from '../core/format.js';
import { dates } from '../core/dates.js';
import { app } from '../app.js';

/**
 * Порог, после которого тренировку считаем забытой.
 *
 * Продолжать её нельзя: длительность считается от старта, и забытая с вечера
 * тренировка добавила бы к статистике десяток часов (§18).
 */
const STALE_MS = 12 * 60 * 60 * 1000;

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

/**
 * Способы начать: повтор прошлой, шаблоны, тренировка с нуля.
 *
 * Порядок — по убыванию частоты. Повтор несёт дату и итоги прошлой
 * тренировки, поэтому отдельный блок «прошлая тренировка» не нужен.
 */
function startBlock(last, templates, suggestion) {

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

    return ui.html`
        <div class="section">
            <div class="section-title">Начать</div>

            ${last ? ui.html`
                <button class="btn-repeat" data-action="nav-plan-repeat">
                    <span class="rep-type">Повторить «${last.workout.type}»</span>
                    <span class="rep-meta">
                        ${dates.formatDayLabel(last.workout.startedAt)}
                        · ${format.count(last.sets, format.WORDS.set)}
                        · ${format.duration((last.workout.finishedAt || last.workout.startedAt) - last.workout.startedAt)}
                    </span>
                </button>
            ` : ''}

            ${differs ? ui.html`
                <p class="hint">
                    ${suggestion.reason === 'cycle'
                        ? `По чередованию дальше — «${suggestion.type}»`
                        : `Дольше всего не было «${suggestion.type}»`}
                </p>
            ` : ''}

            ${templates.length ? ui.html`<div class="chips">${chips}</div>` : ''}

            <button class="btn ${last ? 'btn-ghost' : 'btn-accent btn-lg'}"
                    data-action="nav" data-screen="plan">
                Начать тренировку
            </button>

            <button class="btn btn-ghost" data-action="nav" data-screen="templates">
                ${templates.length ? 'Все шаблоны' : 'Создать шаблон'}
            </button>
        </div>
    `;
}

export const home = {

    title: 'Тренировка',
    nav: 'workout',

    async render() {
        const [active, entries, templates] = await Promise.all([
            activeBlock(),
            dbService.listWorkoutSummaries(),
            dbService.listTemplates()
        ]);

        const workouts = entries.map((e) => e.workout);

        return ui.html`
            ${ui.title('Тренировка')}

            ${rhythmStrip(workouts) || ''}

            ${active || startBlock(entries[0], templates, rhythm.suggestType(workouts))}
        `;
    }
};

// ================== ДЕЙСТВИЯ ==================

actions.on('nav-summary', (el) => app.go('summary', el.dataset.id));
actions.on('nav-plan-repeat', () => app.go('plan', 'repeat'));
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
