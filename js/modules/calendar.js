/**
 * Календарь тренировок (§22 ТЗ).
 *
 * Отвечает на вопрос, на который не отвечает список: где были провалы и
 * сколько они длились. Насыщенность клетки — по количеству подходов, чтобы
 * лёгкая тренировка и тяжёлая различались на глаз.
 */

import { ui } from '../core/ui.js';
import { actions } from '../core/actions.js';
import { dbService } from '../services/db.js';
import { format } from '../core/format.js';
import { dates } from '../core/dates.js';
import { app } from '../app.js';

/** Показываемый месяц: смещение от текущего. Ноль — этот месяц. */
let offset = 0;

/** Выбранный день, миллисекунды на полночь, либо null. */
let selected = null;

const startOfDay = (ts) => {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
};

/** Четыре ступени насыщенности: без градиента различить проще. */
function level(sets) {
    if (sets === 0) return 0;
    if (sets <= 6) return 1;
    if (sets <= 12) return 2;
    if (sets <= 20) return 3;
    return 4;
}

function grid(month, byDay) {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

    // Календарь начинается с понедельника: воскресенье в JS — ноль
    const lead = (first.getDay() + 6) % 7;

    const cells = [];

    for (let i = 0; i < lead; i++) {
        cells.push(ui.html`<div class="cal-cell is-empty"></div>`);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const ts = new Date(month.getFullYear(), month.getMonth(), day).getTime();
        const entries = byDay.get(ts) || [];
        const sets = entries.reduce((sum, e) => sum + e.sets, 0);

        const classes = [
            'cal-cell',
            `is-l${level(sets)}`,
            ts === startOfDay(Date.now()) ? 'is-today' : '',
            ts === selected ? 'is-selected' : ''
        ].filter(Boolean).join(' ');

        cells.push(ui.html`
            <button class="${classes}" data-action="cal-day" data-day="${String(ts)}"
                    ${ui.raw(entries.length ? '' : 'disabled')}
                    title="${entries.length ? `${sets} подходов` : 'Без тренировки'}">
                ${String(day)}
            </button>
        `);
    }

    return cells;
}

export const calendar = {

    title: 'Календарь',
    nav: 'history',

    async render() {
        const [entries, exercises] = await Promise.all([
            dbService.listWorkoutSummaries(),
            dbService.listExercises({ includeArchived: true })
        ]);

        const names = Object.fromEntries(exercises.map((e) => [e.id, e.name]));

        const byDay = new Map();
        for (const entry of entries) {
            const day = startOfDay(entry.workout.startedAt);
            byDay.set(day, [...(byDay.get(day) || []), entry]);
        }

        const now = new Date();
        const month = new Date(now.getFullYear(), now.getMonth() + offset, 1);

        const inMonth = entries.filter((e) => {
            const d = new Date(e.workout.startedAt);
            return d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth();
        });

        const monthSets = inMonth.reduce((sum, e) => sum + e.sets, 0);
        const chosen = selected ? (byDay.get(selected) || []) : [];

        return ui.html`
            ${ui.title('Календарь')}

            <div class="chips">
                <button class="chip" data-action="nav" data-screen="history">Список</button>
                <button class="chip is-active" data-action="nav" data-screen="calendar">Календарь</button>
            </div>

            <div class="card">
                <div class="cal-head">
                    <button class="icon-btn" data-action="cal-prev" title="Предыдущий месяц">←</button>
                    <div class="cal-title">
                        ${dates.MONTHS_NOM[month.getMonth()]} ${String(month.getFullYear())}
                    </div>
                    <button class="icon-btn" data-action="cal-next"
                            ${ui.raw(offset >= 0 ? 'disabled' : '')} title="Следующий месяц">→</button>
                </div>

                <div class="cal-weekdays">
                    ${dates.WEEKDAYS_SHORT.map((d) => ui.html`<div>${d}</div>`)}
                </div>

                <div class="cal-grid">${grid(month, byDay)}</div>

                <div class="cal-summary">
                    ${inMonth.length
                        ? `${format.count(inMonth.length, format.WORDS.workout)} · ${format.count(monthSets, format.WORDS.set)}`
                        : 'В этом месяце тренировок не было'}
                </div>
            </div>

            ${selected ? ui.html`
                <div class="card">
                    <div class="card-title">${dates.formatDayLabel(selected)}</div>
                    ${chosen.length
                        ? chosen.map((entry) => ui.html`
                            <button class="history-item" data-action="nav-summary" data-id="${entry.workout.id}">
                                <span class="h-date">
                                    <span>${dates.formatTime(entry.workout.startedAt)}</span>
                                    <span class="h-badge">${entry.workout.type}</span>
                                </span>
                                <span class="h-name">${entry.exerciseIds.map((id) => names[id] || '').filter(Boolean).join(', ')}</span>
                                <span class="h-stats">
                                    ${format.count(entry.sets, format.WORDS.set)} · ${format.count(entry.reps, format.WORDS.rep)}
                                </span>
                            </button>
                        `)
                        : ui.empty('В этот день тренировок не было.')}
                </div>
            ` : ''}
        `;
    }
};

// ================== ДЕЙСТВИЯ ==================

actions.on('cal-prev', () => { offset -= 1; selected = null; app.render(); });

// Вперёд дальше текущего месяца ходить некуда: тренировки на будущее не
// планируются (§48)
actions.on('cal-next', () => { offset = Math.min(0, offset + 1); selected = null; app.render(); });

actions.on('cal-day', (el) => {
    const day = Number(el.dataset.day);
    selected = selected === day ? null : day;
    app.render();
});
