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
import { records } from '../core/records.js';
import { format } from '../core/format.js';
import { dates } from '../core/dates.js';
import { app } from '../app.js';

/** Строка подхода: показываем только те величины, которые есть. */
function setRow(set, recordId, kind) {
    const value = set.reps !== undefined ? String(set.reps)
        : set.duration !== undefined ? format.seconds(set.duration)
        : '—';

    const extra = set.weight !== undefined ? `${format.weight(set.weight)} кг`
        : set.distance !== undefined ? format.distance(set.distance)
        : '—';

    return ui.html`
        <tr class="${set.id === recordId ? 'is-record' : ''}">
            <td>${String(set.setNumber)}${set.id === recordId ? ui.raw(' <span class="record-mark" title="Новый рекорд">★</span>') : ''}</td>
            <td>${value}</td>
            <td>${extra}</td>
            <td class="cell-tools">
                <button class="icon-btn" data-action="summary-edit-set" data-id="${set.id}"
                        data-kind="${kind || 'weight'}" title="Изменить подход">✎</button>
                <button class="icon-btn is-danger" data-action="summary-drop-set" data-id="${set.id}"
                        title="Удалить подход">×</button>
            </td>
        </tr>
        ${set.note ? ui.html`<tr class="log-note"><td colspan="4">${set.note}</td></tr>` : ''}
    `;
}

function block(b, note) {
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

            ${b.record ? ui.html`
                <div class="record-line">★ Новый рекорд: ${records.describe(b.record, b.kind)}</div>
            ` : ''}

            <div class="table-scroll">
                <table class="log">
                    <thead><tr><th>Подход</th><th>Значение</th><th>Вес / дистанция</th><th></th></tr></thead>
                    <tbody>${b.sets.map((s) => setRow(s, b.record?.id, b.kind))}</tbody>
                </table>
            </div>

            ${note ? ui.html`<p class="note-shown">${note}</p>` : ''}

            <button class="link-btn" data-action="summary-note-exercise" data-exercise="${b.exerciseId}">
                ${note ? 'изменить заметку' : '＋ заметка к упражнению'}
            </button>
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

        // Рекорд ищется в подходах, сделанных до этой тренировки: сравнивать
        // её саму с собой бессмысленно (§15)
        await Promise.all(blocks.map(async (b) => {
            const history = await dbService.listSetsByExercise(b.exerciseId);
            const before = history.filter((s) => s.workoutId !== workout.id);

            b.record = records.recordSet(b.sets, records.best(before, b.kind), b.kind);
        }));

        const notes = Object.fromEntries(
            (workout.plan || []).map((p) => [p.exerciseId, p.note])
        );

        return ui.html`
            ${ui.title('Итоги тренировки',
                `${workout.type} · ${dates.formatDateTime(workout.startedAt)}`)}

            ${blocks.length
                ? blocks.map((b) => block(b, notes[b.exerciseId]))
                : ui.empty('Ни одного подхода не записано.')}

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

            <div class="card">
                <div class="card-title">Заметка к тренировке</div>
                ${workout.note ? ui.html`<p>${workout.note}</p>` : ui.empty('Не заполнена.')}
                <button class="btn btn-ghost btn-sm" data-action="summary-note" data-id="${workout.id}">
                    ${workout.note ? 'Изменить' : 'Добавить заметку'}
                </button>
            </div>

            <button class="btn btn-accent" data-action="nav" data-screen="plan">Новая тренировка</button>
            <button class="btn btn-ghost" data-action="summary-as-template" data-id="${workout.id}">Сохранить как шаблон</button>
            <button class="btn btn-ghost" data-action="nav" data-screen="history">В историю</button>
            <button class="btn btn-danger" data-action="summary-delete" data-id="${workout.id}">Удалить тренировку</button>
        `;
    }
};

/**
 * Правка проведённой тренировки ограничена удалением подхода и заметками
 * (§21.1): всё остальное задевает рекорды, статистику и обмен с облаком, и
 * это отдельная работа.
 */
actions.on('summary-drop-set', async (el) => {
    const ok = await dialog.confirm({
        title: 'Удалить подход?',
        text: 'Итоги, рекорды и статистика пересчитаются.',
        confirmText: 'Удалить',
        danger: true
    });

    if (!ok) return;

    await dbService.deleteSet(el.dataset.id);
    app.render();
});

/**
 * Правка записанного подхода (§21.1).
 *
 * Поля — по тому, что в подходе записано, а не по нынешнему виду
 * упражнения: вид можно поменять в справочнике, а записанное от этого не
 * меняется, и правка силового подхода полем «длительность» стёрла бы вес.
 */
actions.on('summary-edit-set', async (el) => {
    const set = await dbService.getSet(el.dataset.id);
    if (!set) return;

    const measure = records.measure([set], el.dataset.kind);

    const число = (name, label, value) => ({
        name, label, type: 'number', value: value ?? ''
    });

    const fields = measure === 'time'
        ? [число('duration', 'Длительность, секунд', set.duration)]
        : measure === 'distance'
            ? [число('distance', 'Дистанция, м', set.distance), число('duration', 'Время, секунд', set.duration)]
            : measure === 'reps'
                ? [число('reps', 'Повторения', set.reps)]
                : [число('reps', 'Повторения', set.reps), число('weight', 'Вес, кг', set.weight)];

    const values = await dialog.form({
        title: `Подход ${set.setNumber}`,
        text: 'Итоги, рекорды и статистика пересчитаются.',
        fields: [...fields, { name: 'note', label: 'Заметка к подходу', value: set.note || '' }],
        confirmText: 'Сохранить'
    });

    if (!values) return;

    await dbService.updateSet(set.id, values);
    app.render();
});

actions.on('summary-note-exercise', async (el) => {
    const id = app.route.params[0];
    const workout = await dbService.getWorkout(id);
    if (!workout) return;

    const exerciseId = el.dataset.exercise;
    const item = workout.plan.find((p) => p.exerciseId === exerciseId);

    const values = await dialog.form({
        title: 'Заметка к упражнению',
        fields: [{ name: 'note', label: 'Заметка', type: 'textarea', value: item?.note || '' }]
    });

    if (!values) return;

    // Упражнения могло не быть в плане — его добавили по ходу тренировки
    const plan = item
        ? workout.plan.map((p) => (p.exerciseId === exerciseId ? { ...p, note: values.note || undefined } : p))
        : [...workout.plan, { exerciseId, plannedSets: 0, targetReps: null, weight: 0, note: values.note }];

    await dbService.updateWorkout(workout.id, { plan });
    app.render();
});

actions.on('summary-as-template', async (el) => {
    const workout = await dbService.getWorkout(el.dataset.id);
    const sets = await dbService.listSets(workout.id);

    // В шаблон уходит фактически выполненное, а не задуманное: пропущенное
    // упражнение в шаблоне никому не нужно
    const byExercise = new Map();
    for (const set of sets) {
        byExercise.set(set.exerciseId, [...(byExercise.get(set.exerciseId) || []), set]);
    }

    if (byExercise.size === 0) return;

    const values = await dialog.form({
        title: 'Сохранить как шаблон',
        fields: [{ name: 'name', label: 'Название', required: true, value: workout.type }]
    });

    if (!values) return;

    await dbService.saveTemplate({
        name: values.name,
        type: workout.type,
        items: [...byExercise.entries()].map(([exerciseId, own]) => ({
            exerciseId,
            plannedSets: own.length,
            targetReps: own[0].reps ?? null,
            weight: own[0].weight || 0
        }))
    });

    await dialog.alert({ title: 'Шаблон сохранён', text: `«${values.name}» теперь в списке шаблонов.` });
});

actions.on('summary-note', async (el) => {
    const workout = await dbService.getWorkout(el.dataset.id);
    if (!workout) return;

    const values = await dialog.form({
        title: 'Заметка к тренировке',
        text: 'Самочувствие, общие впечатления, что учесть в следующий раз.',
        fields: [{ name: 'note', label: 'Заметка', type: 'textarea', value: workout.note || '' }]
    });

    if (!values) return;

    await dbService.updateWorkout(workout.id, { note: values.note });
    app.render();
});

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
