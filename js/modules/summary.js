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

/** Как называются правимые величины подхода — для вопроса об остальных. */
const FIELD_LABEL = {
    reps: 'повторения',
    weight: 'вес',
    duration: 'длительность',
    distance: 'дистанция'
};

/** Подписи полей в окне правки и порядок, в котором они идут. */
const FIELD_INPUT = {
    reps:     'Повторения',
    weight:   'Вес, кг',
    duration: 'Длительность, секунд',
    distance: 'Дистанция, м'
};

const FIELD_ORDER = ['reps', 'weight', 'distance', 'duration'];

/**
 * Какие величины у вида упражнения основные.
 *
 * У собственного веса вес тоже есть — это довес: пояс на подтягиваниях,
 * блин на брусьях. Нагрузка от него и считается: повторения × (вес тела +
 * довес), см. stats.load. Без колонки его негде ни увидеть, ни исправить —
 * при том, что ввести его на экране выполнения приложение позволяет.
 */
const FIELDS_BY_KIND = {
    weight:   ['reps', 'weight'],
    reps:     ['reps', 'weight'],
    time:     ['duration'],
    distance: ['distance', 'duration']
};

/**
 * Какие поля показывать при правке подхода (§21.1).
 *
 * Поля вида упражнения плюс всё, что в подходе уже записано.
 *
 * Только по записанному нельзя: подход силового упражнения, у которого вес
 * забыли указать, состоял бы из одних повторений — и добавить вес было бы
 * нечем. Ровно на это и жаловались.
 *
 * Только по виду тоже нельзя: вид можно поменять в справочнике, а записанное
 * от этого не меняется. Тогда в подходе оказывается величина, которой по
 * нынешнему виду быть не должно, и спрятать её значит лишить возможности её
 * исправить.
 */
function editableFields(set, kind) {
    const wanted = new Set(FIELDS_BY_KIND[kind] || FIELDS_BY_KIND.weight);

    for (const field of FIELD_ORDER) {
        if (set[field] !== undefined) wanted.add(field);
    }

    return FIELD_ORDER.filter((field) => wanted.has(field));
}

/**
 * Заголовки колонок журнала.
 *
 * Единица стоит в заголовке там, где она постоянна: килограммы у веса,
 * повторения у повторений. У дистанции она меняется — 800 м и 1,2 км, —
 * поэтому там единица идёт в самой клетке, а заголовок её не называет.
 */
const COLUMN_HEAD = {
    reps:     'Повторения',
    weight:   'Вес, кг',
    distance: 'Дистанция',
    duration: 'Время'
};

/** Значение величины в клетке — без повторения единицы в каждой строке. */
const CELL = {
    reps:     (s) => String(s.reps),
    weight:   (s) => format.weight(s.weight),
    distance: (s) => format.distance(s.distance),
    duration: (s) => format.seconds(s.duration)
};

/**
 * Какие колонки нужны упражнению (§6).
 *
 * Раньше колонок было две на все виды сразу — «значение» и «вес /
 * дистанция», — и под одним заголовком оказывались килограммы, метры и
 * секунды. Размерность нагрузки у каждого вида своя, и называть её общим
 * словом значит не называть вовсе.
 *
 * Состав — как при правке подхода: величины вида упражнения плюс всё, что
 * в подходах записано. Вид меняют в справочнике, записанное от этого не
 * меняется, и спрятать несоответствующую величину значило бы её потерять.
 */
function columnsOf(block) {
    const wanted = new Set(FIELDS_BY_KIND[block.kind] || FIELDS_BY_KIND.weight);

    for (const set of block.sets) {
        for (const field of FIELD_ORDER) {
            if (set[field] !== undefined) wanted.add(field);
        }
    }

    return FIELD_ORDER.filter((field) => wanted.has(field));
}

function setRow(set, recordId, kind, columns) {
    return ui.html`
        <tr class="${set.id === recordId ? 'is-record' : ''}">
            <td>${String(set.setNumber)}${set.id === recordId ? ui.raw(' <span class="record-mark" title="Новый рекорд">★</span>') : ''}</td>

            ${columns.map((field) => ui.html`
                <td>${set[field] === undefined ? '—' : CELL[field](set)}</td>
            `)}

            <td class="cell-tools">
                <button class="icon-btn" data-action="summary-edit-set" data-id="${set.id}"
                        data-kind="${kind || 'weight'}" title="Изменить подход">✎</button>
                <button class="icon-btn is-danger" data-action="summary-drop-set" data-id="${set.id}"
                        title="Удалить подход">×</button>
            </td>
        </tr>
        ${set.note ? ui.html`
            <tr class="log-note"><td colspan="${String(columns.length + 2)}">${set.note}</td></tr>
        ` : ''}
    `;
}

function block(b, note) {
    const columns = columnsOf(b);

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
                    <thead>
                        <tr>
                            <th>Подход</th>
                            ${columns.map((field) => ui.html`<th>${COLUMN_HEAD[field]}</th>`)}
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>${b.sets.map((s) => setRow(s, b.record?.id, b.kind, columns))}</tbody>
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

    const fields = editableFields(set, el.dataset.kind).map((name) => ({
        name,
        label: FIELD_INPUT[name],
        type: 'number',
        value: set[name] ?? ''
    }));

    const values = await dialog.form({
        title: `Подход ${set.setNumber}`,
        text: 'Итоги, рекорды и статистика пересчитаются.',
        fields: [...fields, { name: 'note', label: 'Заметка к подходу', value: set.note || '' }],
        confirmText: 'Сохранить'
    });

    if (!values) return;

    await dbService.updateSet(set.id, values);

    /*
     * Ошибаются обычно во всём упражнении сразу, а не в одном подходе: вес
     * был 62,5, а записан 60 — и так все три раза. Поэтому после правки
     * спрашиваем, применить ли её к остальным, и перечисляем, что именно
     * изменилось: соглашаться вслепую пользователю не с чем.
     */
    const changed = {};

    for (const [field, label] of Object.entries(FIELD_LABEL)) {
        if (!(field in values)) continue;

        const before = set[field];
        const after = values[field] === '' || values[field] === null ? undefined : Number(values[field]);

        if (before === after) continue;
        changed[field] = { label, before, after };
    }

    const keys = Object.keys(changed);

    if (keys.length) {
        const rest = (await dbService.listSets(set.workoutId))
            .filter((s) => s.exerciseId === set.exerciseId && s.id !== set.id);

        if (rest.length) {
            const exercise = await dbService.getExercise(set.exerciseId);

            // Числа через format.weight: в русском тексте разделитель —
            // запятая, и «62.5» рядом с «62,5 кг» на экране читается как
            // другая величина
            const было = (v) => (v === undefined ? '—' : format.weight(v));

            const lines = keys.map((field, i) => {
                const { label, before, after } = changed[field];
                const name = i === 0 ? label[0].toUpperCase() + label.slice(1) : label;

                return `${name}: ${было(before)} → ${было(after)}`;
            });

            const ok = await dialog.confirm({
                title: 'Применить к остальным подходам?',
                text: `${exercise?.name || 'Упражнение'}, ещё ${format.count(rest.length, format.WORDS.set)}. ${lines.join(', ')}. Заметка останется только у этого подхода.`,
                confirmText: 'Применить ко всем'
            });

            if (ok) {
                await dbService.applySetToRest(set.id, Object.fromEntries(
                    keys.map((field) => [field, values[field]])
                ));
            }
        }
    }

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
