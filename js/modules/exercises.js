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
import { t } from '../core/i18n.js';
import { app } from '../app.js';
import { format } from '../core/format.js';
import { restTimer } from '../core/timer.js';

const KINDS = [
    { value: 'weight',   label: 'Силовое с весом',  hint: 'повторения и вес' },
    { value: 'reps',     label: 'Собственный вес',  hint: 'повторения' },
    { value: 'time',     label: 'На время',         hint: 'длительность' },
    { value: 'distance', label: 'Кардио',           hint: 'время и дистанция' }
];

const kindLabel = (kind) => t(KINDS.find((k) => k.value === kind)?.label || kind);

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
                    ${exercise.restSeconds ? ui.raw(` · ${ui.esc(t('отдых {время}', { время: format.seconds(exercise.restSeconds) }))}`) : ''}
                    ${used > 0 ? ui.raw(` · ${ui.esc(format.count(used, format.WORDS.set))}`) : ''}
                </div>
            </div>
            <div class="ex-actions">
                <button class="icon-btn" data-action="ex-edit" data-id="${exercise.id}" title="${t('Изменить')}">✎</button>
                <button class="icon-btn" data-action="ex-merge" data-id="${exercise.id}"
                        title="${t('Объединить с другим')}">⇥</button>
                ${exercise.archived
                    ? ui.raw(`<button class="icon-btn" data-action="ex-restore" data-id="${ui.esc(exercise.id)}" title="${ui.esc(t('Вернуть из архива'))}">↩</button>`)
                    : ui.raw(`<button class="icon-btn" data-action="ex-archive" data-id="${ui.esc(exercise.id)}" title="${ui.esc(t('В архив'))}">⌫</button>`)}
                ${used === 0
                    ? ui.raw(`<button class="icon-btn is-danger" data-action="ex-delete" data-id="${ui.esc(exercise.id)}" title="${ui.esc(t('Удалить'))}">×</button>`)
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
        const foreign = await dbService.countForeignBaseExercises();

        return ui.html`
            ${ui.raw(ui.title(t('Справочник упражнений'),
                t('История упражнения держится на его записи здесь, поэтому используемое упражнение можно только архивировать')))}

            <button class="btn btn-accent" data-action="ex-add">${t('Добавить упражнение')}</button>

            <!--
                Предложение перевести справочник появляется, только когда
                есть что переводить (§53).

                Само приложение названия не переименовывает: они записаны
                человеком, а переименовывать записанное оно не вправе. Но у
                того, кто сменил язык на давно заведённой базе, остаётся
                чужой список посреди своего экрана — и это тоже неправильно.
                Разрешает спор он сам, одним нажатием.
            -->
            ${foreign > 0 ? ui.html`
                <div class="card">
                    <p class="hint" style="margin:0 0 10px">
                        ${t('{n} из базового списка стоят на другом языке. Свои названия и те, что ты правил, останутся как есть.',
                            { n: format.count(foreign, format.WORDS.exercise) })}
                    </p>
                    <button class="btn btn-ghost" data-action="ex-relocalize">
                        ${t('Перевести базовые упражнения')}
                    </button>
                </div>
            ` : ''}

            <div class="card">
                <div class="card-title">${t('В работе — {n}', { n: active.length })}</div>
                ${active.length
                    ? active.map((e) => row(e, usage))
                    : ui.raw(ui.empty(t('Все упражнения в архиве.')))}
            </div>

            ${archived.length ? ui.html`
                <div class="card">
                    <div class="card-title">${t('Архив — {n}', { n: archived.length })}</div>
                    ${archived.map((e) => row(e, usage))}
                </div>
            ` : ''}

            <button class="btn btn-ghost" data-action="nav" data-screen="profile">${t('← В профиль')}</button>
        `;
    }
};

// ================== ДЕЙСТВИЯ ==================

const kindOptions = () => KINDS.map((k) => ({ value: k.value, label: `${t(k.label)} — ${t(k.hint)}` }));

actions.on('ex-add', async () => {
    const values = await dialog.form({
        title: t('Новое упражнение'),
        fields: [
            { name: 'name', label: t('Название'), required: true, placeholder: t('Жим лёжа') },
            { name: 'kind', label: t('Вид'), type: 'select', value: 'weight', options: kindOptions() },
            { name: 'group', label: t('Группа мышц (необязательно)'), placeholder: t('Грудь') }
        ],
        confirmText: t('Добавить')
    });

    if (!values) return;

    const existing = await dbService.findExerciseByName(values.name);
    if (existing) {
        await dialog.alert({
            title: t('Такое упражнение уже есть'),
            text: t('«{имя}» уже в справочнике{архив}.', { имя: existing.name, архив: existing.archived ? t(', сейчас в архиве') : '' })
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
            : `${где}\n\n${t('Описания нет. Его можно вписать своими словами — оно будет видно и во время интервальной программы.')}`,
        options: [
            { value: 'video', label: t('Найти видео'), hint: t('Откроется поиск в новой вкладке') },
            { value: 'edit', label: exercise.howTo ? t('Изменить описание') : t('Добавить описание') }
        ]
    });

    if (choice === 'edit') return editExercise(exercise);

    if (choice === 'video') {
        const query = encodeURIComponent(t('{название} упражнение техника выполнения', { название: exercise.name }));
        window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank', 'noopener');
    }
});

/** Правка упражнения. Вызывается и карандашом, и из окна с описанием. */
async function editExercise(exercise) {

    const values = await dialog.form({
        title: t('Изменить упражнение'),
        text: t('Переименование не разрывает историю: она привязана к записи, а не к названию.'),
        fields: [
            { name: 'name', label: t('Название'), value: exercise.name, required: true },
            { name: 'kind', label: t('Вид'), type: 'select', value: exercise.kind, options: kindOptions() },
            { name: 'group', label: t('Группа мышц'), value: exercise.group || '' },

            /*
             * Как выполнять (§50). Показывается там, где вспоминать некогда:
             * на экране интервальной программы под названием упражнения.
             * Своими словами — чужое описание всё равно пришлось бы
             * переписывать под себя.
             */
            {
                name: 'howTo',
                label: t('Как выполнять (необязательно)'),
                type: 'textarea',
                value: exercise.howTo || ''
            },

            {
                name: 'restSeconds',
                label: t('Свой отдых, секунд (пусто — общий)'),
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
        await dialog.alert({ title: t('Название занято'), text: t('«{название}» уже есть в справочнике.', { название: clash.name }) });
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
                title: t('Изменить вид упражнения?'),
                text: t('В истории {подходы}. Они останутся как есть, но следующие подходы будут записываться другими величинами, и в истории окажется два вида сразу.', { подходы: format.count(used, format.WORDS.set) }),
                confirmText: t('Изменить')
            });

            if (!ok) return;
        }
    }

    // Пустое поле означает «как у всех», а не «ноль секунд»; границы общие
    const rest = restTimer.clamp(values.restSeconds);

    await dbService.updateExercise(exercise.id, {
        ...values,
        restSeconds: rest ?? undefined
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
        return dialog.alert({ title: t('Объединять не с чем'), text: t('В справочнике только одно упражнение.') });
    }

    const usage = await dbService.countSetsOfExercise(source.id);

    const chosen = await dialog.pick({
        title: t('Объединить «{название}» с…', { название: source.name }),
        text: t('Выбранное упражнение останется, текущее исчезнет вместе со своим названием.'),
        items: others.map((e) => ({
            value: e.id,
            label: e.name,
            hint: [kindLabel(e.kind), e.group, e.archived ? t('в архиве') : null].filter(Boolean).join(' · ')
        })),
        placeholder: t('Название упражнения')
    });

    if (!chosen || chosen.create) return;

    const target = others.find((e) => e.id === chosen);
    if (!target) return;

    const ok = await dialog.confirm({
        title: `«${source.name}» → «${target.name}»?`,
        // Числительное ставится после слова, чтобы не согласовывать глагол:
        // «1 подход перейдут» и «5 подходов перейдёт» одинаково неверны
        text: usage > 0
            ? t('К «{цель}» перейдёт подходов: {сколько}. «{источник}» исчезнет из справочника, и отменить это будет нечем.', { цель: target.name, сколько: usage, источник: source.name })
            : t('«{название}» исчезнет из справочника. Подходов у него нет, так что переносить нечего.', { название: source.name }),
        confirmText: t('Объединить')
    });

    if (!ok) return;

    const result = await dbService.mergeExercises(source.id, target.id);

    await dialog.alert({
        title: t('Объединено'),
        text: [
            `«${result.from}» → «${result.to}».`,
            result.sets ? t('Перенесено подходов: {сколько}.', { сколько: result.sets }) : '',
            result.workouts ? t('Затронуто тренировок: {сколько}.', { сколько: result.workouts }) : '',
            result.templates ? t('Шаблонов: {сколько}.', { сколько: result.templates }) : ''
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
        title: t('Удалить «{название}»?', { название: exercise.name }),
        text: t('Упражнение ни разу не выполнялось, поэтому удаление ничего не разорвёт.'),
        confirmText: t('Удалить'),
        danger: true
    });

    if (!ok) return;

    try {
        await dbService.deleteExercise(exercise.id);
    } catch (e) {
        await dialog.alert({ title: t('Не удалось удалить'), text: e.message });
    }

    app.render();
});

/**
 * Перевод базовых упражнений на текущий язык (§53).
 *
 * По явной просьбе и с предупреждением: действие меняет названия в
 * справочнике, а через них — то, как выглядит вся история. История при этом
 * цела: упражнение остаётся тем же, у него меняется только имя.
 */
actions.on('ex-relocalize', async () => {
    const ok = await dialog.confirm({
        title: t('Перевести базовые упражнения?'),
        text: t('Названия и группы из базового списка станут на текущем языке. Упражнения, которые ты завёл или переименовал сам, останутся как есть. История не пострадает: меняется имя, а не запись.'),
        confirmText: t('Перевести')
    });

    if (!ok) return;

    const renamed = await dbService.relocalizeBaseExercises();

    await dialog.alert({
        title: t('Готово'),
        text: renamed.length
            ? t('Переведено: {n}.', { n: format.count(renamed.length, format.WORDS.exercise) })
            : t('Переводить оказалось нечего.')
    });

    app.render();
});
