/**
 * Стартовый экран (§29 ТЗ).
 *
 * Порядок блоков — по частоте использования: сначала судьба незавершённой
 * тренировки (§18), потом ритм и подсказка следующей (§26.2), потом быстрый
 * старт — повтор прошлой и шаблоны.
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
                ` : ui.html`
                    <button class="btn btn-accent" data-action="nav" data-screen="session">Продолжить</button>
                    <button class="btn btn-ghost" data-action="home-finish" data-id="${workout.id}">Завершить как есть</button>
                `}

                <button class="btn btn-danger" data-action="home-drop" data-id="${workout.id}">Удалить</button>
            </div>
        </div>
    `;
}

/**
 * Ритм и прогноз следующей тренировки (§26.2).
 *
 * Прогноз показывается только когда данных достаточно. При рваном ритме
 * рядом стоит оговорка: обещать день с уверенностью, которой нет, хуже,
 * чем не обещать вовсе.
 */
function rhythmBlock(workouts) {
    const r = rhythm.analyze(workouts);

    if (!r.enough) {
        if (r.count === 0) return null;

        return ui.html`
            <div class="section">
                <div class="section-title">Ритм</div>
                <div class="card">
                    <div class="rhythm-line">Проведено ${format.count(r.count, format.WORDS.workout)}</div>
                    <p class="hint">
                        Ещё ${format.count(r.need, format.WORDS.workout)} — и приложение сможет
                        посчитать привычный промежуток и подсказать день следующей.
                    </p>
                </div>
            </div>
        `;
    }

    const suggestion = rhythm.suggestType(workouts);

    const headline = r.state === 'overdue'
        ? `${format.count(r.daysSince, format.WORDS.day)} без тренировки`
        : r.state === 'due'
            ? 'Пора тренироваться'
            : `Следующая — ${dates.formatDayLabel(r.nextAt).toLowerCase()}`;

    return ui.html`
        <div class="section">
            <div class="section-title">Ритм</div>

            <div class="card rhythm-card is-${r.state}">
                <div class="rhythm-headline">${headline}</div>

                <div class="rhythm-line">
                    Обычно раз в ${format.count(r.medianInterval, format.WORDS.day)}
                    · последняя ${dates.formatDayLabel(r.lastAt).toLowerCase()}
                </div>

                ${r.confidence === 'low' ? ui.html`
                    <p class="hint">Промежутки между тренировками сильно разные, поэтому день — только прикидка.</p>
                ` : ''}

                ${suggestion ? ui.html`
                    <div class="rhythm-line">
                        ${suggestion.reason === 'cycle'
                            ? `По чередованию следующая — «${suggestion.type}»`
                            : `Дольше всего не было тренировки «${suggestion.type}»`}
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

function quickStart(templates, hasHistory) {
    const list = templates.slice(0, 4).map((t) => ui.html`
        <button class="chip" data-action="home-template" data-id="${t.id}">${t.name}</button>
    `);

    return ui.html`
        <div class="section">
            <div class="section-title">Быстрый старт</div>

            ${hasHistory ? ui.html`
                <button class="btn btn-ghost" data-action="nav-plan-repeat">Повторить прошлую тренировку</button>
            ` : ''}

            ${templates.length ? ui.html`
                <div class="chips">${list}</div>
            ` : ''}

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
        const last = entries[0];

        return ui.html`
            ${ui.title('Тренировка')}

            ${active || ''}

            ${active ? '' : ui.html`
                <button class="btn btn-accent btn-lg" data-action="nav" data-screen="plan">
                    Начать тренировку
                </button>
            `}

            ${rhythmBlock(workouts) || ''}

            ${quickStart(templates, entries.length > 0)}

            ${last ? ui.html`
                <div class="section">
                    <div class="section-title">Прошлая тренировка</div>
                    <button class="history-item" data-action="nav-summary" data-id="${last.workout.id}">
                        <span class="h-date">
                            <span>${dates.formatDayLabel(last.workout.startedAt)}</span>
                            <span class="h-badge">${last.workout.type}</span>
                        </span>
                        <span class="h-stats">
                            ${format.count(last.sets, format.WORDS.set)}
                            · ${format.duration((last.workout.finishedAt || last.workout.startedAt) - last.workout.startedAt)}
                        </span>
                    </button>
                </div>
            ` : ''}
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
