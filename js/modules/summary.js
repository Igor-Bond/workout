/**
 * Итоги тренировки (§19 ТЗ).
 *
 * Этим же экраном открывается карточка тренировки из истории: данные те же,
 * различается только набор действий внизу.
 */

import { ui } from '../core/ui.js';
import { actions } from '../core/actions.js';
import { dialog } from '../core/dialog.js';
import { dbService } from '../services/db.js';
import { engine } from '../core/engine.js';
import { format } from '../core/format.js';
import { dates } from '../core/dates.js';
import { app } from '../app.js';

/** Строка подхода: показываем только те величины, которые есть. */
function setRow(set) {
    const value = set.reps !== undefined ? String(set.reps)
        : set.duration !== undefined ? format.seconds(set.duration)
        : '—';

    const extra = set.weight !== undefined ? `${format.weight(set.weight)} кг`
        : set.distance !== undefined ? format.distance(set.distance)
        : '—';

    return ui.html`<tr><td>${String(set.setNumber)}</td><td>${value}</td><td>${extra}</td></tr>`;
}

function block(b) {
    const line = [
        format.count(b.sets.length, format.WORDS.set),
        b.reps ? format.count(b.reps, format.WORDS.rep) : null,
        b.volume ? `${format.weight(b.volume)} кг` : null,
        !b.reps && b.duration ? format.seconds(b.duration) : null,
        b.distance ? format.distance(b.distance) : null
    ].filter(Boolean).join(' · ');

    return ui.html`
        <div class="ex-block">
            <div class="ex-block-title">
                <span>${b.name}</span>
                <span class="sub">${line}</span>
            </div>
            <div class="table-scroll">
                <table class="log">
                    <thead><tr><th>Подход</th><th>Значение</th><th>Вес / дистанция</th></tr></thead>
                    <tbody>${b.sets.map(setRow)}</tbody>
                </table>
            </div>
        </div>
    `;
}

function tile(label, value) {
    return ui.html`<div class="tile"><strong>${value}</strong><span>${label}</span></div>`;
}

export const summary = {

    title: 'Итоги',
    nav: 'workout',

    async render(params) {
        const id = params[0];
        const workout = id ? await dbService.getWorkout(id) : null;

        if (!workout) {
            return ui.html`
                ${ui.title('Итоги тренировки')}
                ${ui.empty('Тренировка не найдена — возможно, она была удалена.')}
                <button class="btn btn-ghost" data-action="nav" data-screen="history">← В историю</button>
            `;
        }

        const [sets, list] = await Promise.all([
            dbService.listSets(workout.id),
            dbService.listExercises({ includeArchived: true })
        ]);

        const exercises = Object.fromEntries(list.map((e) => [e.id, e]));

        const durationMs = workout.finishedAt
            ? workout.finishedAt - workout.startedAt
            : 0;

        const { blocks, totals } = engine.summarize({
            plan: workout.plan, sets, exercises, durationMs
        });

        return ui.html`
            ${ui.title('Итоги тренировки',
                `${workout.type} · ${dates.formatDateTime(workout.startedAt)}`)}

            ${blocks.length ? blocks.map(block) : ui.empty('Ни одного подхода не записано.')}

            <div class="card">
                <div class="tiles">
                    ${tile('Упражнений', String(totals.exercises))}
                    ${tile('Подходов', String(totals.sets))}
                    ${tile('Повторений', String(totals.reps))}
                    ${tile('Время', format.duration(totals.durationMs))}
                    ${totals.hasWeight ? tile('Тоннаж, кг', format.weight(totals.volume)) : ''}
                    ${tile('Повт. на подход', totals.avgReps ? format.decimal(totals.avgReps) : '—')}
                </div>
            </div>

            ${workout.note ? ui.html`
                <div class="card"><div class="card-title">Заметка</div><p>${workout.note}</p></div>
            ` : ''}

            <button class="btn btn-accent" data-action="nav" data-screen="plan">Новая тренировка</button>
            <button class="btn btn-ghost" data-action="nav" data-screen="history">В историю</button>
            <button class="btn btn-danger" data-action="summary-delete" data-id="${workout.id}">Удалить тренировку</button>
        `;
    }
};

actions.on('summary-delete', async (el) => {
    const ok = await dialog.confirm({
        title: 'Удалить тренировку?',
        text: 'Она исчезнет из истории и статистики.',
        confirmText: 'Удалить',
        danger: true
    });

    if (!ok) return;

    await dbService.deleteWorkout(el.dataset.id);
    app.go('history');
});
