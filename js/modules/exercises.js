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
                <!--
                    Название нажимается: описание техники нужнее всего в
                    зале, и добираться до него через правку — значит открыть
                    окно, где всё остальное можно случайно испортить.
                -->
                <button class="ex-name" data-action="ex-info" data-id="${exercise.id}">
                    ${exercise.name}
                </button>
                <div class="ex-meta">
                    ${kindLabel(exercise.kind)}
                    ${exercise.group ? ui.raw(` · ${ui.esc(exercise.group)}`) : ''}
                    ${exercise.restSeconds ? ui.raw(` · отдых ${ui.esc(format.seconds(exercise.restSeconds))}`) : ''}
                    ${used > 0 ? ui.raw(` · ${ui.esc(format.count(used, format.WORDS.set))}`) : ''}
                </div>
            </div>
            <div class="ex-actions">
                <button class="icon-btn" data-action="ex-edit" data-id="${exercise.id}" title="Изменить">✎</button>
                <button class="icon-btn" data-action="ex-merge" data-id="${exercise.id}"
                        title="Объединить с другим">⇥</button>
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

/**
 * Как выполнять (§5.2).
 *
 * Текстом, а не ссылкой: приложение работает без сети, а ссылка требует её и
 * живёт ровно до тех пор, пока ролик не удалят. Кнопка поиска рядом — для
 * тех случаев, когда текста мало и связь всё-таки есть; она ведёт в поиск, а
 * не на конкретное видео, потому что конкретное однажды пропадёт.
 */
actions.on('ex-info', async (el) => {
    const exercise = await dbService.getExercise(el.dataset.id);
    if (!exercise) return;

    const где = [kindLabel(exercise.kind), exercise.group].filter(Boolean).join(' · ');

    const choice = await dialog.choose({
        title: exercise.name,
        text: exercise.howTo
            ? `${где}\n\n${exercise.howTo}`
            : `${где}\n\nОписания нет. Его можно вписать своими словами — оно будет видно и во время интервальной программы.`,
        options: [
            { value: 'video', label: 'Найти видео', hint: 'Откроется поиск в новой вкладке' },
            { value: 'edit', label: exercise.howTo ? 'Изменить описание' : 'Добавить описание' }
        ]
    });

    if (choice === 'edit') return editExercise(exercise);

    if (choice === 'video') {
        const query = encodeURIComponent(`${exercise.name} упражнение техника выполнения`);
        window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank', 'noopener');
    }
});

/** Правка упражнения. Вызывается и карандашом, и из окна с описанием. */
async function editExercise(exercise) {

    const values = await dialog.form({
        title: 'Изменить упражнение',
        text: 'Переименование не разрывает историю: она привязана к записи, а не к названию.',
        fields: [
            { name: 'name', label: 'Название', value: exercise.name, required: true },
            { name: 'kind', label: 'Вид', type: 'select', value: exercise.kind, options: kindOptions },
            { name: 'group', label: 'Группа мышц', value: exercise.group || '' },

            /*
             * Как выполнять (§50). Показывается там, где вспоминать некогда:
             * на экране интервальной программы под названием упражнения.
             * Своими словами — чужое описание всё равно пришлось бы
             * переписывать под себя.
             */
            {
                name: 'howTo',
                label: 'Как выполнять (необязательно)',
                type: 'textarea',
                value: exercise.howTo || ''
            },

            {
                name: 'restSeconds',
                label: 'Свой отдых, секунд (пусто — общий)',
                type: 'number',
                value: exercise.restSeconds ?? ''
            }
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

    // Смена вида у упражнения с историей: записанные подходы не меняются, и
    // новые поля им взяться неоткуда. Показывать историю приложение всё
    // равно будет по тому, что в подходах записано, но при вводе следующих
    // подходов появятся другие поля — и в истории окажется вперемешку
    if (values.kind !== exercise.kind) {
        const used = await dbService.countSetsOfExercise(exercise.id);

        if (used > 0) {
            const ok = await dialog.confirm({
                title: 'Изменить вид упражнения?',
                text: `В истории ${format.count(used, format.WORDS.set)}. Они останутся как есть, но следующие подходы будут записываться другими величинами, и в истории окажется два вида сразу.`,
                confirmText: 'Изменить'
            });

            if (!ok) return;
        }
    }

    // Пустое поле означает «как у всех», а не «ноль секунд»
    const rest = Number(values.restSeconds);

    await dbService.updateExercise(exercise.id, {
        ...values,
        restSeconds: rest > 0 ? rest : undefined
    });

    app.render();
}

actions.on('ex-edit', async (el) => {
    const exercise = await dbService.getExercise(el.dataset.id);
    if (exercise) await editExercise(exercise);
});

/**
 * Объединение дублей (§5.1).
 *
 * Опечатка в названии заводит второе упражнение и разрезает историю надвое.
 * Переименовать не выйдет — занять чужое имя нельзя, — поэтому нужно
 * отдельное действие: перенести всё в правильную запись и убрать лишнюю.
 */
actions.on('ex-merge', async (el) => {
    const source = await dbService.getExercise(el.dataset.id);
    if (!source) return;

    const others = (await dbService.listExercises({ includeArchived: true }))
        .filter((e) => e.id !== source.id);

    if (others.length === 0) {
        return dialog.alert({ title: 'Объединять не с чем', text: 'В справочнике только одно упражнение.' });
    }

    const usage = await dbService.countSetsOfExercise(source.id);

    const chosen = await dialog.pick({
        title: `Объединить «${source.name}» с…`,
        text: 'Выбранное упражнение останется, текущее исчезнет вместе со своим названием.',
        items: others.map((e) => ({
            value: e.id,
            label: e.name,
            hint: [kindLabel(e.kind), e.group, e.archived ? 'в архиве' : null].filter(Boolean).join(' · ')
        })),
        placeholder: 'Название упражнения'
    });

    if (!chosen || chosen.create) return;

    const target = others.find((e) => e.id === chosen);
    if (!target) return;

    const ok = await dialog.confirm({
        title: `«${source.name}» → «${target.name}»?`,
        // Числительное ставится после слова, чтобы не согласовывать глагол:
        // «1 подход перейдут» и «5 подходов перейдёт» одинаково неверны
        text: usage > 0
            ? `К «${target.name}» перейдёт подходов: ${usage}. «${source.name}» исчезнет из справочника, и отменить это будет нечем.`
            : `«${source.name}» исчезнет из справочника. Подходов у него нет, так что переносить нечего.`,
        confirmText: 'Объединить'
    });

    if (!ok) return;

    const result = await dbService.mergeExercises(source.id, target.id);

    await dialog.alert({
        title: 'Объединено',
        text: [
            `«${result.from}» → «${result.to}».`,
            result.sets ? `Перенесено подходов: ${result.sets}.` : '',
            result.workouts ? `Затронуто тренировок: ${result.workouts}.` : '',
            result.templates ? `Шаблонов: ${result.templates}.` : ''
        ].filter(Boolean).join(' ')
    });

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
