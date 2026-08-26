/**
 * Составление плана тренировки (§10 ТЗ).
 *
 * План — это намерение: какие упражнения и сколько подходов. Он копируется
 * внутрь тренировки при старте и дальше не меняется (§4), поэтому здесь
 * важно дать поправить всё до нажатия «Начать».
 */

import { ui } from '../core/ui.js';
import { actions } from '../core/actions.js';
import { dialog } from '../core/dialog.js';
import { dbService } from '../services/db.js';
import { app } from '../app.js';

const TYPES = ['Силовая', 'Кардио', 'Растяжка', 'Дома без инвентаря'];

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

function blank() {
    return { type: TYPES[0], customType: '', items: [] };
}

function ensureDraft() {
    if (!draft) draft = blank();
    return draft;
}

const typeLabel = () => (draft.type === 'Своё' ? draft.customType.trim() || 'Тренировка' : draft.type);

function itemRow(item, index, total) {
    return ui.html`
        <div class="plan-row">
            <div class="plan-row-head">
                <div class="plan-row-name">${item.name}</div>
                <div class="plan-row-tools">
                    <button class="icon-btn" data-action="plan-up" data-index="${index}"
                            ${ui.raw(index === 0 ? 'disabled' : '')} title="Выше">↑</button>
                    <button class="icon-btn" data-action="plan-down" data-index="${index}"
                            ${ui.raw(index === total - 1 ? 'disabled' : '')} title="Ниже">↓</button>
                    <button class="icon-btn is-danger" data-action="plan-remove" data-index="${index}" title="Убрать">×</button>
                </div>
            </div>

            <div class="plan-row-fields">
                <div class="field">
                    <label for="p-sets-${index}">Подходы</label>
                    <input id="p-sets-${index}" type="number" min="1" inputmode="numeric"
                           value="${item.plannedSets}"
                           data-change="plan-field" data-index="${index}" data-key="plannedSets">
                </div>

                ${item.kind === 'time' || item.kind === 'distance' ? '' : ui.html`
                    <div class="field">
                        <label for="p-reps-${index}">Повторения</label>
                        <input id="p-reps-${index}" type="number" min="0" inputmode="numeric"
                               placeholder="—" value="${item.targetReps ?? ''}"
                               data-change="plan-field" data-index="${index}" data-key="targetReps">
                    </div>
                `}

                ${item.kind === 'weight' || item.kind === 'reps' ? ui.html`
                    <div class="field">
                        <label for="p-weight-${index}">Вес, кг</label>
                        <input id="p-weight-${index}" type="number" min="0" step="0.5" inputmode="decimal"
                               placeholder="—" value="${item.weight || ''}"
                               data-change="plan-field" data-index="${index}" data-key="weight">
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

export const plan = {

    title: 'План',
    nav: 'workout',

    async render() {
        ensureDraft();

        const chips = [...TYPES, 'Своё'].map((t) => ui.html`
            <button class="chip ${draft.type === t ? 'is-active' : ''}"
                    data-action="plan-type" data-type="${t}">${t}</button>
        `);

        return ui.html`
            ${ui.title('План тренировки', 'Порядок можно будет нарушить: приложение считает подходы, а не командует')}

            <div class="card">
                <div class="card-title">Тип тренировки</div>
                <div class="chips">${chips}</div>

                ${draft.type === 'Своё' ? ui.html`
                    <div class="field">
                        <label for="p-custom">Название</label>
                        <input id="p-custom" type="text" value="${draft.customType}"
                               placeholder="Например: йога" data-change="plan-custom">
                    </div>
                ` : ''}
            </div>

            <div class="card">
                <div class="card-title">Упражнения — ${String(draft.items.length)}</div>

                ${draft.items.length
                    ? draft.items.map((item, i) => itemRow(item, i, draft.items.length))
                    : ui.empty('Пока пусто. Добавь хотя бы одно упражнение.')}

                <button class="btn btn-ghost" data-action="plan-add">+ Добавить упражнение</button>
            </div>

            <button class="btn btn-accent btn-lg" data-action="plan-start"
                    ${ui.raw(draft.items.length ? '' : 'disabled')}>
                Начать тренировку
            </button>

            <button class="btn btn-ghost" data-action="nav" data-screen="home">← На главную</button>
        `;
    }
};

// ================== ДЕЙСТВИЯ ==================

actions.on('plan-type', (el) => {
    draft.type = el.dataset.type;
    app.render();
});

actions.onChange('plan-custom', (el) => {
    // Без перерисовки: она бы забрала фокус из поля посреди набора
    draft.customType = el.value;
});

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

actions.on('plan-add', async () => {
    const all = await dbService.listExercises();

    const chosen = await dialog.pick({
        title: 'Добавить упражнение',
        items: all.map((e) => ({
            value: e.id,
            label: e.name,
            hint: [KIND_HINT[e.kind], e.group].filter(Boolean).join(' · ')
        })),
        placeholder: 'Название упражнения',
        createLabel: 'Создать'
    });

    if (!chosen) return;

    const exercise = chosen.create
        ? await dbService.ensureExercise({ name: chosen.create })
        : all.find((e) => e.id === chosen);

    if (!exercise) return;

    draft.items.push({
        exerciseId: exercise.id,
        name: exercise.name,
        kind: exercise.kind,
        plannedSets: 3,
        targetReps: null,
        weight: 0
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

actions.on('plan-start', async () => {
    if (draft.items.length === 0) return;

    // Активная тренировка всегда одна (§18): начать вторую поверх первой
    // означало бы потерять уже записанные подходы
    const active = await dbService.getActiveWorkout();

    if (active) {
        const choice = await dialog.choose({
            title: 'Есть незавершённая тренировка',
            text: 'Одновременно может идти только одна.',
            options: [
                { value: 'continue', label: 'Вернуться к ней', hint: 'Новая не начнётся' },
                { value: 'finish', label: 'Завершить её и начать новую', hint: 'Записанные подходы сохранятся' }
            ]
        });

        if (!choice) return;

        if (choice === 'continue') return app.go('session');
        await dbService.finishWorkout(active.id);
    }

    const workout = await dbService.createWorkout({
        type: typeLabel(),
        plan: draft.items.map((item) => ({
            exerciseId: item.exerciseId,
            plannedSets: item.plannedSets,
            targetReps: item.targetReps,
            weight: item.weight || 0,
            skipped: false
        }))
    });

    draft = null;
    app.go('session', workout.id);
});
