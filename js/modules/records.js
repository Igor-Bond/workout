/**
 * Личные рекорды (§24.1 ТЗ).
 *
 * Все рекорды одним списком. Смысл экрана — увидеть застой: упражнение, где
 * рекорд не двигался полгода, здесь заметно сразу, а в отдельных карточках —
 * нет. Поэтому по умолчанию список отсортирован по дате рекорда, и самые
 * давние видно первыми.
 */

import { ui } from '../core/ui.js';
import { actions } from '../core/actions.js';
import { dbService } from '../services/db.js';
import { records as rec } from '../core/records.js';
import { format } from '../core/format.js';
import { dates } from '../core/dates.js';
import { app } from '../app.js';

const DAY = 86400000;
const MONTH = 30 * DAY;

const SORTS = [
    { key: 'stale', label: 'Давние сверху' },
    { key: 'fresh', label: 'Свежие сверху' },
    { key: 'name',  label: 'По названию' },
    { key: 'group', label: 'По группе' }
];

let sort = 'stale';

export const recordsScreen = {

    title: 'Рекорды',
    nav: 'stats',

    async render() {
        const [exercises, sets] = await Promise.all([
            dbService.listExercises({ includeArchived: true }),
            dbService.allSets()
        ]);

        const byExercise = new Map();
        for (const set of sets) {
            byExercise.set(set.exerciseId, [...(byExercise.get(set.exerciseId) || []), set]);
        }

        const rows = exercises
            .map((exercise) => {
                const own = byExercise.get(exercise.id);
                if (!own || own.length === 0) return null;

                const best = rec.best(own, exercise.kind);

                return {
                    exercise,
                    best,
                    at: best.performedAt,
                    heldDays: Math.round((dates.startOfDay(Date.now()) - dates.startOfDay(best.performedAt)) / DAY)
                };
            })
            .filter(Boolean);

        if (rows.length === 0) {
            return ui.html`
                ${ui.title('Личные рекорды')}
                ${ui.empty('Рекорды появятся после первой тренировки.')}
                <button class="btn btn-ghost" data-action="nav" data-screen="stats">← К статистике</button>
            `;
        }

        const sorted = [...rows].sort((a, b) => {
            if (sort === 'fresh') return b.at - a.at;
            if (sort === 'name') return a.exercise.name.localeCompare(b.exercise.name, 'ru');
            if (sort === 'group') {
                return (a.exercise.group || 'я').localeCompare(b.exercise.group || 'я', 'ru')
                    || a.exercise.name.localeCompare(b.exercise.name, 'ru');
            }
            return a.at - b.at;
        });

        const fresh = rows.filter((r) => Date.now() - r.at <= MONTH).length;

        const chips = SORTS.map((s) => ui.html`
            <button class="chip ${sort === s.key ? 'is-active' : ''}"
                    data-action="prs-sort" data-sort="${s.key}">${s.label}</button>
        `);

        const list = sorted.map((row) => ui.html`
            <button class="pr-row ${Date.now() - row.at <= MONTH ? 'is-fresh' : ''}"
                    data-action="prs-open" data-id="${row.exercise.id}">
                <span class="pr-main">
                    <span class="pr-name">${row.exercise.name}</span>
                    <span class="pr-meta">
                        ${dates.formatDayLabel(row.at)}
                        ${row.heldDays > 0 ? ui.raw(` · держится ${ui.esc(format.count(row.heldDays, format.WORDS.day))}`) : ''}
                        ${row.exercise.group ? ui.raw(` · ${ui.esc(row.exercise.group)}`) : ''}
                    </span>
                </span>
                <span class="pr-value">${rec.describe(row.best, row.exercise.kind)}</span>
            </button>
        `);

        return ui.html`
            ${ui.title('Личные рекорды',
                'Упражнение, где рекорд давно не двигался, видно сразу — с этого и начинается список')}

            <div class="chips">${chips}</div>

            <div class="card">
                <div class="tiles">
                    ${ui.raw(`<div class="tile"><strong>${rows.length}</strong><span>Упражнений</span></div>`)}
                    ${ui.raw(`<div class="tile"><strong>${fresh}</strong><span>Обновлено за месяц</span></div>`)}
                </div>
            </div>

            <div class="card">${list}</div>

            <button class="btn btn-ghost" data-action="nav" data-screen="stats">← К статистике</button>
        `;
    }
};

actions.on('prs-sort', (el) => {
    sort = el.dataset.sort;
    app.render();
});

actions.on('prs-open', (el) => app.go('exercise', el.dataset.id));
