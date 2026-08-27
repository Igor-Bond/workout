/**
 * История тренировок (§21 ТЗ).
 *
 * Карточка отдельной тренировки — это экран итогов (#/summary/<id>): данные
 * те же, второй раз их рисовать незачем.
 */

import { ui } from '../core/ui.js';
import { actions } from '../core/actions.js';
import { dialog } from '../core/dialog.js';
import { dbService } from '../services/db.js';
import { format } from '../core/format.js';
import { dates } from '../core/dates.js';
import { app } from '../app.js';

/** Фильтры переживают уход на карточку тренировки и возврат назад. */
let filter = { type: 'all', exerciseId: null, query: '' };

/**
 * Сколько тренировок показано (§21.2).
 *
 * За пять лет занятий история — это восемьсот карточек: почти пять тысяч
 * узлов разметки и страница высотой в восемьдесят метров. Нужную строку в
 * ней всё равно ищут фильтром, а не прокруткой.
 */
const PAGE = 30;
let shown = PAGE;

/** Любая смена отбора начинает показ заново: иначе счётчик врёт. */
function resetPage() {
    shown = PAGE;
}

function item(entry, names) {
    const { workout } = entry;

    const exercises = entry.exerciseIds
        .map((id) => names[id] || 'упражнение')
        .join(', ');

    const duration = workout.finishedAt ? workout.finishedAt - workout.startedAt : 0;

    return ui.html`
        <button class="history-item" data-action="nav-summary" data-id="${workout.id}">
            <span class="h-date">
                <span>${dates.formatDayLabel(workout.startedAt)}, ${dates.formatTime(workout.startedAt)}</span>
                <span class="h-badge">${workout.type}</span>
            </span>
            <span class="h-name">${exercises || 'Без упражнений'}</span>
            <span class="h-stats">
                ${format.count(entry.sets, format.WORDS.set)}
                · ${format.count(entry.reps, format.WORDS.rep)}
                ${entry.volume ? ui.raw(` · ${ui.esc(format.weight(entry.volume))} кг`) : ''}
                · ${format.duration(duration)}
            </span>
            ${workout.note ? ui.html`<span class="h-note">${workout.note}</span>` : ''}
        </button>
    `;
}

/** Отбор в памяти: история личная, тысяч записей в ней не бывает. */
function apply(entries, names) {
    const query = filter.query.trim().toLowerCase();

    return entries.filter((entry) => {
        if (filter.type !== 'all' && entry.workout.type !== filter.type) return false;
        if (filter.exerciseId && !entry.exerciseIds.includes(filter.exerciseId)) return false;

        if (!query) return true;

        const haystack = [
            entry.workout.type,
            entry.workout.note || '',
            ...entry.exerciseIds.map((id) => names[id] || '')
        ].join(' ').toLowerCase();

        return haystack.includes(query);
    });
}

export const history = {

    title: 'История',
    nav: 'history',

    async render() {
        const [entries, exercises] = await Promise.all([
            dbService.listWorkoutSummaries(),
            dbService.listExercises({ includeArchived: true })
        ]);

        const names = Object.fromEntries(exercises.map((e) => [e.id, e.name]));
        const types = [...new Set(entries.map((e) => e.workout.type))];

        const matched = apply(entries, names);
        const page = matched.slice(0, shown);
        const rest = matched.length - page.length;

        const typeChips = ['all', ...types].map((t) => ui.html`
            <button class="chip ${filter.type === t ? 'is-active' : ''}"
                    data-action="hist-type" data-type="${t}">${t === 'all' ? 'Все' : t}</button>
        `);

        return ui.html`
            ${ui.title('История')}

            <div class="chips">
                <button class="chip is-active" data-action="nav" data-screen="history">Список</button>
                <button class="chip" data-action="nav" data-screen="calendar">Календарь</button>
            </div>

            ${entries.length === 0 ? ui.empty('Проведённых тренировок пока нет.') : ui.html`
                <div class="field">
                    <input type="text" id="hist-search" placeholder="Поиск по упражнению, типу или заметке"
                           value="${filter.query}" data-change="hist-search" autocomplete="off">
                </div>

                <div class="chips">${typeChips}</div>

                <div class="chips">
                    <button class="chip ${filter.exerciseId ? 'is-active' : ''}" data-action="hist-exercise">
                        ${filter.exerciseId ? `Упражнение: ${names[filter.exerciseId]}` : 'Фильтр по упражнению'}
                    </button>
                    ${filter.exerciseId || filter.type !== 'all' || filter.query
                        ? ui.html`<button class="chip" data-action="hist-reset">Сбросить</button>`
                        : ''}
                </div>

                <div class="hist-count">
                    ${matched.length === entries.length
                        ? format.count(entries.length, format.WORDS.workout)
                        : `Подходит: ${matched.length} из ${entries.length}`}
                </div>

                ${page.length
                    ? ui.html`<div class="grid-2">${page.map((entry) => item(entry, names))}</div>`
                    : ui.empty('Под фильтры ничего не подходит.')}

                ${rest > 0 ? ui.html`
                    <button class="btn btn-ghost" data-action="hist-more">
                        Показать ещё ${String(Math.min(PAGE, rest))} из ${String(rest)}
                    </button>
                ` : ''}
            `}
        `;
    },

    /** Возврат фокуса и курсора в поле поиска после перерисовки. */
    mount() {
        const field = document.getElementById('hist-search');
        if (!field || !filter.query) return;

        field.focus();
        field.setSelectionRange(field.value.length, field.value.length);
    }
};

// ================== ФИЛЬТРЫ ==================

actions.on("hist-type", (el) => {
    filter.type = el.dataset.type;
    resetPage();
    app.render();
});

let searchDelay = 0;

actions.onChange("hist-search", (el) => {
    filter.query = el.value;
    resetPage();
    app.render();
});

// Событие change приходит только по потере фокуса — для поиска это слишком
// поздно, поэтому список обновляется и по вводу, но не на каждой букве
document.addEventListener('input', (e) => {
    if (e.target.id !== 'hist-search') return;

    filter.query = e.target.value;
    resetPage();
    clearTimeout(searchDelay);
    searchDelay = setTimeout(() => app.render(), 250);
});

actions.on('hist-more', () => {
    shown += PAGE;

    // Перерисовка на месте прокрутку сохраняет, поэтому список
    // достраивается там, где пользователь остановился
    app.render();
});

actions.on('hist-exercise', async () => {
    resetPage();

    if (filter.exerciseId) {
        filter.exerciseId = null;
        return app.render();
    }

    const all = await dbService.listExercises({ includeArchived: true });

    const chosen = await dialog.pick({
        title: 'Фильтр по упражнению',
        items: all.map((e) => ({ value: e.id, label: e.name, hint: e.group })),
        placeholder: 'Название упражнения'
    });

    if (!chosen || chosen.create) return;

    filter.exerciseId = chosen;
    app.render();
});

actions.on("hist-reset", () => {
    filter = { type: "all", exerciseId: null, query: "" };
    resetPage();
    app.render();
});
