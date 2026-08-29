/**
 * Составление плана (§10 ТЗ) — и он же редактор шаблона (§8).
 *
 * Экран один на два случая: и там и там это список упражнений с количеством
 * подходов, целевыми повторениями и весом. Разница только в том, что
 * получается на выходе — начатая тренировка или сохранённый шаблон.
 *
 * Маршруты:
 *   #/plan                     новая тренировка с нуля
 *   #/plan/from/<id>           новая тренировка по шаблону
 *   #/plan/repeat              повтор прошлой тренировки (§9)
 *   #/plan/due                 из того, чему пора по периодичности (§26.2.3)
 *   #/plan/template/<id>       правка шаблона
 */

import { ui } from '../core/ui.js';
import { actions } from '../core/actions.js';
import { dialog } from '../core/dialog.js';
import { dbService } from '../services/db.js';
import { records } from '../core/records.js';
import { rhythm } from '../core/rhythm.js';
import { estimate } from '../core/estimate.js';
import { interval } from '../core/interval.js';
import { format } from '../core/format.js';
import { t } from '../core/i18n.js';
import { app } from '../app.js';

const TYPES = ['Силовая', 'Зарядка', 'Табата', 'Кардио', 'Растяжка', 'Дома без инвентаря'];

/**
 * Тип, у которого не подходы, а отрезки времени (§50).
 *
 * Проверяется по типу, а не по отдельному признаку: тип пользователь и так
 * выбирает первым делом, и заводить рядом с ним второй переключатель «а это
 * интервальная?» значило бы спрашивать одно и то же дважды.
 */
const isInterval = (type) => type === 'Табата';

/**
 * Ключ типа по сохранённой подписи (§53).
 *
 * В плане тип живёт ключом — русским словом из TYPES, — а в записанную
 * тренировку уходит подписью на языке того, кто её проводил. Открывая свой
 * же шаблон, англичанин видит в нём «Strength», и без обратного поиска
 * приложение сочло бы это чужим типом и предложило бы «Своё».
 */
const typeKey = (stored) => TYPES.find((key) => key === stored || t(key) === stored) || null;

/**
 * Группы упражнений для отбора в окне выбора.
 *
 * Берутся из самих упражнений, а не из списка в коде: пользователь заводит
 * свои группы, и захардкоженный перечень их не показал бы.
 */
const groupsOf = (list) => [...new Set(list.map((e) => e.group).filter(Boolean))].sort();

/** Подписи видов упражнений. Переводятся при показе, а не здесь: список
 *  собирается один раз при загрузке модуля, а язык меняется на ходу. */
const KIND_HINT = {
    weight: 'повторения и вес',
    reps: 'повторения',
    time: 'длительность',
    distance: 'время и дистанция'
};

/**
 * Черновик живёт в модуле, а не в разметке: экран перерисовывается после
 * каждого действия, и значения из полей иначе терялись бы.
 */
let draft = null;

/** Для какого маршрута собран черновик — чтобы не пересобирать его при каждой отрисовке. */
let loadedFor = null;

/**
 * Прикидка стартового веса для упражнения без истории (§10.1).
 *
 * Только при нулевой истории: там, где есть факт, догадка не нужна. И
 * только когда вес тела отмечен — иначе прикидывать не от чего.
 */
async function guessWeight(exercise, last) {
    if (!exercise || last) return null;

    const body = await dbService.lastBodyWeight();

    return estimate.startWeight({
        nameKey: exercise.nameKey,
        group: exercise.group,
        kind: exercise.kind,
        bodyWeight: body?.weight
    });
}

/**
 * Дополнение упражнения тем, что лежит в базе: название, вид и прошлый
 * результат. В шаблоне хранится только идентификатор — остальное могло
 * измениться с прошлого раза.
 */
async function decorate(items) {
    return Promise.all(items.map(async (item) => {
        const exercise = await dbService.getExercise(item.exerciseId);
        const history = await dbService.listSetsByExercise(item.exerciseId);
        const last = records.lastSession(history);

        const guess = item.weight ? null : await guessWeight(exercise, last);

        return {
            ...item,
            name: exercise?.name || t('Упражнение'),
            kind: exercise?.kind || 'weight',
            weight: item.weight || guess || 0,
            estimated: !!guess,
            lastLine: last ? records.describeSession(last.sets, exercise?.kind) : null
        };
    }));
}

async function build(params) {
    const [what, id] = params;

    if (what === 'template' || what === 'from') {
        const template = await dbService.getTemplate(id);

        if (template) {
            return {
                mode: what === 'template' ? 'template' : 'workout',
                templateId: template.id,
                name: template.name,
                type: typeKey(template.type) || 'Своё',
                customType: typeKey(template.type) ? '' : template.type,
                interval: template.interval || undefined,
                items: await decorate(template.items)
            };
        }
    }

    // Повтор прошлой тренировки (§9): за основу берётся фактически
    // выполненное, а не то, что планировалось
    if (what === 'repeat') {
        const [last] = await dbService.listWorkouts({ limit: 1 });

        if (last) {
            const sets = await dbService.listSets(last.id);
            const byExercise = new Map();

            for (const set of sets) {
                const own = byExercise.get(set.exerciseId) || [];
                own.push(set);
                byExercise.set(set.exerciseId, own);
            }

            const items = [...byExercise.entries()].map(([exerciseId, own]) => ({
                exerciseId,
                plannedSets: own.length,
                targetReps: own[0].reps ?? null,
                weight: own[0].weight || 0
            }));

            return {
                mode: 'workout',
                templateId: null,
                name: '',
                type: typeKey(last.type) || 'Своё',
                customType: typeKey(last.type) ? '' : last.type,
                items: await decorate(items)
            };
        }
    }

    /*
     * Тренировка из того, чему пора (§26.2.3).
     *
     * Состав берётся по периодичности каждого упражнения, а веса и
     * повторения — из последнего раза, как при повторе: предлагать
     * упражнение без ориентира значит заставлять вспоминать его самому.
     */
    if (what === 'due') {
        const entries = await dbService.listWorkoutSummaries();
        const due = rhythm.dueExercises(entries);

        const items = [];

        for (const { exerciseId } of due) {
            const own = await dbService.listSetsByExercise(exerciseId, { limit: 20 });
            const last = records.lastSession(own);

            if (!last) continue;

            items.push({
                exerciseId,
                plannedSets: last.sets.length,
                targetReps: last.sets[0].reps ?? null,
                weight: last.sets[0].weight || 0
            });
        }

        if (items.length) {
            return {
                mode: 'workout',
                templateId: null,
                name: '',
                type: TYPES[0],
                customType: '',
                items: await decorate(items)
            };
        }
    }

    return { mode: 'workout', templateId: null, name: '', type: TYPES[0], customType: '', items: [] };
}

const typeLabel = () => (draft.type === 'Своё' ? draft.customType.trim() || t('Тренировка') : t(draft.type));

/**
 * Настройки интервальной программы (§50).
 *
 * Отдельной карточкой над упражнениями, а не полем у каждого: отрезки в
 * табате общие для всей программы, и повторять их в каждой строке значило бы
 * предлагать разное там, где разного не бывает.
 */
function intervalCard() {
    const c = draft.interval;
    const phases = interval.build(c, toItems());

    const поле = (key, label, hint) => ui.html`
        <div class="field">
            <label for="iv-${key}">${label}</label>
            <input id="iv-${key}" type="number" inputmode="numeric"
                   min="${String(interval.LIMITS[key].min)}" max="${String(interval.LIMITS[key].max)}"
                   value="${String(c[key])}" data-change="plan-interval" data-key="${key}">
            ${hint ? ui.html`<div class="hint">${hint}</div>` : ''}
        </div>
    `;

    const presets = interval.PRESETS.map((p) => ui.html`
        <button class="chip ${c.work === p.work && c.rest === p.rest ? 'is-active' : ''}"
                data-action="plan-preset" data-preset="${p.key}">${p.label}</button>
    `);

    return ui.html`
        <div class="card">
            <div class="card-title">${t('Отрезки')}</div>

            <div class="chips">${presets}</div>

            <div class="plan-row-fields">
                ${поле('work', t('Работа, с'))}
                ${поле('rest', t('Отдых, с'))}
                ${поле('rounds', t('Кругов'))}
                ${поле('roundRest', t('Между кругами, с'))}
            </div>

            ${phases.length ? ui.html`
                <p class="hint">
                    ${format.count(interval.workCount(phases), format.WORDS.set)}
                    · ${t('всего {время}', { время: format.seconds(interval.total(phases)) })}
                </p>
            ` : ui.html`<p class="hint">${t('Добавь упражнения — и здесь появится длительность программы.')}</p>`}
        </div>
    `;
}

function itemRow(item, index, total, timed = false) {
    return ui.html`
        <div class="plan-row">
            <div class="plan-row-head">
                <div class="plan-row-title">
                    <div class="plan-row-name">${item.name}</div>
                    ${item.lastLine
                        ? ui.html`<div class="plan-row-last">${t('Последний раз: {что}', { что: item.lastLine })}</div>`
                        : item.estimated
                            ? ui.html`<div class="plan-row-last is-guess">${t('Вес прикинут от веса тела — поправь под себя')}</div>`
                            : ''}
                </div>
                <div class="plan-row-tools">
                    <button class="icon-btn" data-action="plan-up" data-index="${index}"
                            ${ui.raw(index === 0 ? 'disabled' : '')} title="${t('Выше')}">↑</button>
                    <button class="icon-btn" data-action="plan-down" data-index="${index}"
                            ${ui.raw(index === total - 1 ? 'disabled' : '')} title="${t('Ниже')}">↓</button>
                    <button class="icon-btn is-danger" data-action="plan-remove" data-index="${index}" title="${t('Убрать')}">×</button>
                </div>
            </div>

            <!--
                В интервальной программе полей у строки нет вовсе: подходы,
                повторения и вес там задаёт не упражнение, а отрезки времени,
                общие для всей программы (§50). Строка остаётся списком
                порядка — и только им.
            -->
            ${timed ? '' : ui.html`
            <div class="plan-row-fields">
                <div class="field">
                    <label for="p-sets-${index}">${t('Подходы')}</label>
                    <input id="p-sets-${index}" type="number" min="1" inputmode="numeric"
                           value="${item.plannedSets}"
                           data-change="plan-field" data-index="${index}" data-key="plannedSets">
                </div>

                ${item.kind === 'time' || item.kind === 'distance' ? '' : ui.html`
                    <div class="field">
                        <label for="p-reps-${index}">${t('Повторения')}</label>
                        <input id="p-reps-${index}" type="number" min="0" inputmode="numeric"
                               placeholder="—" value="${item.targetReps ?? ''}"
                               data-change="plan-field" data-index="${index}" data-key="targetReps">
                    </div>
                `}

                ${item.kind === 'weight' || item.kind === 'reps' ? ui.html`
                    <div class="field">
                        <label for="p-weight-${index}">${t('Вес, кг')}</label>
                        <input id="p-weight-${index}" type="number" min="0" step="0.5" inputmode="decimal"
                               placeholder="—" value="${item.weight || ''}"
                               data-change="plan-field" data-index="${index}" data-key="weight">
                    </div>
                ` : ''}
            </div>
            `}
        </div>
    `;
}

export const plan = {

    title: 'План',
    nav: 'workout',

    async render(params) {
        const key = params.join('/');

        if (!draft || loadedFor !== key) {
            draft = await build(params);
            draft.interval = interval.normalize(draft.interval);
            loadedFor = key;
        }

        const isTemplate = draft.mode === 'template';
        const timed = isInterval(typeLabel());

        const chips = [...TYPES, 'Своё'].map((key) => ui.html`
            <button class="chip ${draft.type === key ? 'is-active' : ''}"
                    data-action="plan-type" data-type="${key}">${t(key)}</button>
        `);

        return ui.html`
            ${ui.title(
                isTemplate ? t('Шаблон') : t('План тренировки'),
                isTemplate
                    ? t('Изменения не тронут уже проведённые тренировки — их план сохранён внутри них')
                    : t('Порядок можно будет нарушить: приложение считает подходы, а не командует'))}

            <div class="card">
                ${isTemplate ? ui.html`
                    <div class="field">
                        <label for="p-name">${t('Название шаблона')}</label>
                        <input id="p-name" type="text" value="${draft.name}"
                               placeholder="${t('Грудь + трицепс')}" data-change="plan-name">
                    </div>
                ` : ''}

                <div class="card-title">${t('Тип тренировки')}</div>
                <div class="chips">${chips}</div>

                ${draft.type === 'Своё' ? ui.html`
                    <div class="field">
                        <label for="p-custom">${t('Название типа')}</label>
                        <input id="p-custom" type="text" value="${draft.customType}"
                               placeholder="${t('Например: йога')}" data-change="plan-custom">
                    </div>
                ` : ''}
            </div>

            ${timed ? intervalCard() : ''}

            <div class="card">
                <div class="card-title">${t('Упражнения — {n}', { n: draft.items.length })}</div>

                ${draft.items.length
                    ? draft.items.map((item, i) => itemRow(item, i, draft.items.length, timed))
                    : ui.empty(t('Пока пусто. Добавь хотя бы одно упражнение.'))}

                <button class="btn btn-ghost" data-action="plan-add">${t('+ Добавить упражнение')}</button>
            </div>

            ${isTemplate ? ui.html`
                <button class="btn btn-accent btn-lg" data-action="plan-save-template">${t('Сохранить шаблон')}</button>
                <button class="btn btn-ghost" data-action="nav" data-screen="templates">${t('← К шаблонам')}</button>
            ` : ui.html`
                <button class="btn btn-accent btn-lg" data-action="plan-start"
                        ${ui.raw(draft.items.length ? '' : 'disabled')}>
                    ${t('Начать тренировку')}
                </button>
                <button class="btn btn-ghost" data-action="plan-as-template"
                        ${ui.raw(draft.items.length ? '' : 'disabled')}>
                    ${t('Сохранить как шаблон')}
                </button>
                <button class="btn btn-ghost" data-action="nav" data-screen="home">${t('← На главную')}</button>
            `}
        `;
    }
};

/** Черновик сбрасывается после того, как из него что-то получилось. */
function reset() {
    draft = null;
    loadedFor = null;
}

/** Состав шаблона: в нём хранятся только идентификаторы и числа. */
const toItems = () => draft.items.map((item) => ({
    exerciseId: item.exerciseId,
    plannedSets: item.plannedSets,
    targetReps: item.targetReps,
    weight: item.weight || 0
}));

// ================== ПОЛЯ ==================

actions.on('plan-type', (el) => {
    draft.type = el.dataset.type;
    app.render();
});

actions.on('plan-preset', (el) => {
    const preset = interval.PRESETS.find((p) => p.key === el.dataset.preset);
    if (preset) draft.interval = interval.normalize({ ...draft.interval, ...preset });

    app.render();
});

/*
 * Поля отрезков не перерисовывают экран: правка идёт посреди набора, и
 * перерисовка забирала бы фокус на каждой цифре. Границы применяются
 * позже — при построении программы.
 */
actions.onChange('plan-interval', (el) => {
    draft.interval = { ...draft.interval, [el.dataset.key]: el.value };
});

// Без перерисовки: она бы забрала фокус из поля посреди набора
actions.onChange('plan-custom', (el) => { draft.customType = el.value; });
actions.onChange('plan-name', (el) => { draft.name = el.value; });

actions.onChange('plan-field', (el) => {
    const item = draft.items[Number(el.dataset.index)];
    const key = el.dataset.key;
    const value = el.value.trim();

    if (key === 'plannedSets') {
        item.plannedSets = Math.max(1, parseInt(value, 10) || 1);
        el.value = item.plannedSets;
        return;
    }

    // Пустое поле — это «не задано», а не ноль: целевых повторений может
    // не быть, и подставлять вместо них ноль неправильно
    item[key] = value === '' ? null : Number(value);
});

// ================== СОСТАВ ==================

actions.on('plan-add', async () => {
    const all = await dbService.listExercises();

    const chosen = await dialog.pick({
        title: t('Добавить упражнение'),
        items: all.map((e) => ({
            value: e.id,
            label: e.name,
            group: e.group,
            hint: [t(KIND_HINT[e.kind]), e.group].filter(Boolean).join(' · ')
        })),
        groups: groupsOf(all),
        placeholder: t('Название упражнения'),
        createLabel: t('Создать')
    });

    if (!chosen) return;

    const exercise = chosen.create
        ? await dbService.ensureExercise({ name: chosen.create })
        : all.find((e) => e.id === chosen);

    if (!exercise) return;

    // Прошлый результат подставляется в исходный вес, чтобы не начинать
    // каждую тренировку с подбора числа заново (§10).
    //
    // Берётся первый подход прошлого раза, а не последний: последний обычно
    // самый лёгкий — сил к концу упражнения меньше, вес сбрасывают. Подставив
    // его, приложение каждый раз предлагало бы начинать слабее, чем в прошлый.
    const history = await dbService.listSetsByExercise(exercise.id);
    const last = records.lastSession(history);
    const previous = last?.sets[0];

    // У зарядки по смыслу один подход на упражнение — подставлять три и
    // заставлять исправлять каждую строку незачем
    const defaultSets = draft.type === 'Зарядка' ? 1 : 3;

    draft.items.push({
        exerciseId: exercise.id,
        name: exercise.name,
        kind: exercise.kind,
        plannedSets: last?.sets.length || defaultSets,
        targetReps: previous?.reps ?? null,
        weight: previous?.weight || (await guessWeight(exercise, last)) || 0,
        estimated: !last && !!(await guessWeight(exercise, last)),
        lastLine: last ? records.describeSession(last.sets, exercise.kind) : null
    });

    app.render();
});

actions.on('plan-remove', (el) => {
    draft.items.splice(Number(el.dataset.index), 1);
    app.render();
});

actions.on('plan-up', (el) => {
    const i = Number(el.dataset.index);
    [draft.items[i - 1], draft.items[i]] = [draft.items[i], draft.items[i - 1]];
    app.render();
});

actions.on('plan-down', (el) => {
    const i = Number(el.dataset.index);
    [draft.items[i + 1], draft.items[i]] = [draft.items[i], draft.items[i + 1]];
    app.render();
});

// ================== ШАБЛОНЫ ==================

actions.on('plan-save-template', async () => {
    if (!draft.name.trim()) {
        const values = await dialog.form({
            title: t('Название шаблона'),
            fields: [{ name: 'name', label: t('Название'), required: true }]
        });

        if (!values) return;
        draft.name = values.name;
    }

    await dbService.saveTemplate({
        id: draft.templateId,
        name: draft.name,
        type: typeLabel(),
        items: toItems(),

        // Отрезки — часть шаблона наравне с составом: табата без своих
        // двадцати и десяти это уже не та тренировка (§50)
        interval: isInterval(typeLabel()) ? interval.normalize(draft.interval) : undefined
    });

    reset();
    app.go('templates');
});

actions.on('plan-as-template', async () => {
    const values = await dialog.form({
        title: t('Сохранить как шаблон'),
        text: t('Состав и подходы запомнятся, тренировка при этом не начнётся.'),
        fields: [{ name: 'name', label: t('Название'), required: true, value: typeLabel() }]
    });

    if (!values) return;

    await dbService.saveTemplate({
        name: values.name,
        type: typeLabel(),
        items: toItems(),
        interval: isInterval(typeLabel()) ? interval.normalize(draft.interval) : undefined
    });

    await dialog.alert({ title: t('Шаблон сохранён'), text: t('«{имя}» теперь в списке шаблонов.', { имя: values.name }) });
});

// ================== СТАРТ ==================

actions.on('plan-start', async () => {
    if (draft.items.length === 0) return;

    // Активная тренировка всегда одна (§18): начать вторую поверх первой
    // означало бы потерять уже записанные подходы
    const active = await dbService.getActiveWorkout();

    if (active) {
        const choice = await dialog.choose({
            title: t('Есть незавершённая тренировка'),
            text: t('Одновременно может идти только одна.'),
            options: [
                { value: 'continue', label: t('Вернуться к ней'), hint: t('Новая не начнётся') },
                { value: 'finish', label: t('Завершить её и начать новую'), hint: t('Записанные подходы сохранятся') }
            ]
        });

        if (!choice) return;

        if (choice === 'continue') return app.go('session');
        await dbService.finishWorkout(active.id);
    }

    const workout = await dbService.createWorkout({
        type: typeLabel(),
        templateId: draft.templateId,
        plan: toItems().map((item) => ({ ...item, skipped: false }))
    });

    // Интервальная тренировка идёт на своём экране: там нет полей ввода,
    // потому что вводить между отрезками нечего и некогда (§50)
    if (isInterval(typeLabel())) {
        await dbService.updateWorkout(workout.id, {
            interval: interval.normalize(draft.interval),
            run: { state: 'idle', elapsed: 0, startedAt: null }
        });

        reset();
        return app.go('interval');
    }

    reset();
    app.go('session', workout.id);
});
