/**
 * Справочник упражнений (§5 ТЗ).
 *
 * Упражнение — сущность с постоянным идентификатором, а не строка внутри
 * записи истории. От этого зависят рекорды, статистика по упражнению и
 * целостность плана, который ссылается на упражнение по идентификатору.
 *
 * Поэтому удаление здесь почти всегда недоступно: упражнение, встречавшееся
 * в тренировках, отправляется в архив.
 */

import { ui } from '../core/ui.js';
import { actions } from '../core/actions.js';
import { dialog } from '../core/dialog.js';
import { dbService } from '../services/db.js';
import { app } from '../app.js';
import { format } from '../core/format.js';

const KINDS = [
    { value: 'weight',   label: 'Силовое с весом',  hint: 'повторения и вес' },
    { value: 'reps',     label: 'Собственный вес',  hint: 'повторения' },
    { value: 'time',     label: 'На время',         hint: 'длительность' },
    { value: 'distance', label: 'Кардио',           hint: 'время и дистанция' }
];

const kindLabel = (kind) => KINDS.find((k) => k.value === kind)?.label || kind;

/** Строка списка. Счётчик подходов объясняет, почему нельзя удалить. */
function row(exercise, usage) {
    const used = usage.get(exercise.id) || 0;

    return ui.html`
        <div class="ex-row" data-id="${exercise.id}">
            <div class="ex-main">
                <div class="ex-name">${exercise.name}</div>
                <div class="ex-meta">
                    ${kindLabel(exercise.kind)}
                    ${exercise.group ? ui.raw(` · ${ui.esc(exercise.group)}`) : ''}
                    ${used > 0 ? ui.raw(` · ${ui.esc(format.count(used, format.WORDS.set))}`) : ''}
                </div>
            </div>
            <div class="ex-actions">
                <button class="icon-btn" data-action="ex-edit" data-id="${exercise.id}" title="Изменить">✎</button>
                ${exercise.archived
                    ? ui.raw(`<button class="icon-btn" data-action="ex-restore" data-id="${ui.esc(exercise.id)}" title="Вернуть из архива">↩</button>`)
                    : ui.raw(`<button class="icon-btn" data-action="ex-archive" data-id="${ui.esc(exercise.id)}" title="В архив">⌫</button>`)}
                ${used === 0
                    ? ui.raw(`<button class="icon-btn is-danger" data-action="ex-delete" data-id="${ui.esc(exercise.id)}" title="Удалить">×</button>`)
                    : ''}
            </div>
        </div>
    `;
}

export const exercises = {

    title: 'Справочник',
    nav: 'profile',

    async render() {
        const all = await dbService.listExercises({ includeArchived: true });

        // Сколько раз упражнение встречается в истории — считаем один раз
        // на весь список, а не в каждой строке отдельно
        const usage = new Map();
        await Promise.all(all.map(async (e) => {
            usage.set(e.id, await dbService.countSetsOfExercise(e.id));
        }));

        const active = all.filter((e) => !e.archived);
        const archived = all.filter((e) => e.archived);

        return ui.html`
            ${ui.raw(ui.title('Справочник упражнений',
                'История упражнения держится на его записи здесь, поэтому используемое упражнение можно только архивировать'))}

            <button class="btn btn-accent" data-action="ex-add">Добавить упражнение</button>

            <div class="card">
                <div class="card-title">В работе — ${ui.esc(String(active.length))}</div>
                ${active.length
                    ? active.map((e) => row(e, usage))
                    : ui.raw(ui.empty('Все упражнения в архиве.'))}
            </div>

            ${archived.length ? ui.html`
                <div class="card">
                    <div class="card-title">Архив — ${ui.esc(String(archived.length))}</div>
                    ${archived.map((e) => row(e, usage))}
                </div>
            ` : ''}

            <button class="btn btn-ghost" data-action="nav" data-screen="profile">← В профиль</button>
        `;
    }
};

// ================== ДЕЙСТВИЯ ==================

const kindOptions = KINDS.map((k) => ({ value: k.value, label: `${k.label} — ${k.hint}` }));

actions.on('ex-add', async () => {
    const values = await dialog.form({
        title: 'Новое упражнение',
        fields: [
            { name: 'name', label: 'Название', required: true, placeholder: 'Жим лёжа' },
            { name: 'kind', label: 'Вид', type: 'select', value: 'weight', options: kindOptions },
            { name: 'group', label: 'Группа мышц (необязательно)', placeholder: 'Грудь' }
        ],
        confirmText: 'Добавить'
    });

    if (!values) return;

    const existing = await dbService.findExerciseByName(values.name);
    if (existing) {
        await dialog.alert({
            title: 'Такое упражнение уже есть',
            text: `«${existing.name}» уже в справочнике${existing.archived ? ', сейчас в архиве' : ''}.`
        });
        return;
    }

    await dbService.createExercise(values);
    app.render();
});

actions.on('ex-edit', async (el) => {
    const exercise = await dbService.getExercise(el.dataset.id);
    if (!exercise) return;

    const values = await dialog.form({
        title: 'Изменить упражнение',
        text: 'Переименование не разрывает историю: она привязана к записи, а не к названию.',
        fields: [
            { name: 'name', label: 'Название', value: exercise.name, required: true },
            { name: 'kind', label: 'Вид', type: 'select', value: exercise.kind, options: kindOptions },
            { name: 'group', label: 'Группа мышц', value: exercise.group || '' }
        ]
    });

    if (!values) return;

    // Чужое имя занимать нельзя: две записи с одним ключом снова расщепят
    // историю, ради чего справочник и заводился
    const clash = await dbService.findExerciseByName(values.name);
    if (clash && clash.id !== exercise.id) {
        await dialog.alert({ title: 'Название занято', text: `«${clash.name}» уже есть в справочнике.` });
        return;
    }

    await dbService.updateExercise(exercise.id, values);
    app.render();
});

actions.on('ex-archive', async (el) => {
    await dbService.setExerciseArchived(el.dataset.id, true);
    app.render();
});

actions.on('ex-restore', async (el) => {
    await dbService.setExerciseArchived(el.dataset.id, false);
    app.render();
});

actions.on('ex-delete', async (el) => {
    const exercise = await dbService.getExercise(el.dataset.id);
    if (!exercise) return;

    const ok = await dialog.confirm({
        title: `Удалить «${exercise.name}»?`,
        text: 'Упражнение ни разу не выполнялось, поэтому удаление ничего не разорвёт.',
        confirmText: 'Удалить',
        danger: true
    });

    if (!ok) return;

    try {
        await dbService.deleteExercise(exercise.id);
    } catch (e) {
        await dialog.alert({ title: 'Не удалось удалить', text: e.message });
    }

    app.render();
});
