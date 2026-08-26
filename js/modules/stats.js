/**
 * Статистика (§23–§27 ТЗ).
 *
 * Правило раздела: у каждого числа должен быть либо масштаб, либо
 * сравнение. Поэтому показатели идут с изменением к предыдущему периоду, а
 * распределения — графиками, а не списками цифр.
 */

import { ui } from '../core/ui.js';
import { actions } from '../core/actions.js';
import { dbService } from '../services/db.js';
import { stats as calc } from '../core/stats.js';
import { chart } from '../core/chart.js';
import { format } from '../core/format.js';
import { dates } from '../core/dates.js';
import { app } from '../app.js';

/** Выбранный период переживает уход на карточку упражнения и возврат. */
let period = 'month';

/**
 * Плитка с показателем и изменением к предыдущему периоду (§23.1).
 *
 * Для длительности и тоннажа рост — это хорошо, для всех показателей здесь
 * тоже, поэтому отдельного «плохого роста» не бывает и цвет один на всех.
 */
function tile(label, value, change) {
    const delta = change?.delta;

    const sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
    const direction = delta > 0 ? 'is-up' : delta < 0 ? 'is-down' : '';

    return ui.html`
        <div class="tile">
            <strong>${value}</strong>
            <span>${label}</span>
            ${delta !== null && delta !== undefined && delta !== 0 ? ui.html`
                <span class="tile-delta ${direction}">
                    ${sign}${format.decimal(Math.abs(change.percent), 0)} %
                </span>
            ` : ''}
        </div>
    `;
}

/** Подписи месяцев над тепловой картой: столбец — неделя. */
function monthLabels(days) {
    const labels = [];
    let lastMonth = -1;

    days.forEach((d, i) => {
        if (i % 7 !== 0) return;

        const month = new Date(d.day).getMonth();
        if (month === lastMonth) return;

        lastMonth = month;
        labels.push({ week: i / 7, label: dates.MONTHS_NOM[month].slice(0, 3) });
    });

    // Первая подпись часто налезает на край — она и так очевидна по второй
    return labels.slice(1);
}

export const stats = {

    title: 'Статистика',
    nav: 'stats',

    async render() {
        const [entries, sets, exerciseList] = await Promise.all([
            dbService.listWorkoutSummaries(),
            dbService.allSets(),
            dbService.listExercises({ includeArchived: true })
        ]);

        if (entries.length === 0) {
            return ui.html`
                ${ui.title('Статистика')}
                ${ui.empty('Нет данных — сначала проведи тренировку.')}
            `;
        }

        const exercises = Object.fromEntries(exerciseList.map((e) => [e.id, e]));
        const { current, previous } = calc.ranges(period);

        const now = calc.aggregate(entries, current);
        const was = previous ? calc.aggregate(entries, previous) : null;
        const change = calc.compare(now, was);

        const days = calc.days(entries, current);
        const streaks = calc.streaks(calc.days(entries, null));
        const weekdays = calc.weekdays(entries, current);
        const muscles = calc.muscleVolume(sets, exercises, current);
        const heat = calc.heatmap(entries);

        const periodChips = calc.PERIODS.map((p) => ui.html`
            <button class="chip ${period === p.key ? 'is-active' : ''}"
                    data-action="stats-period" data-period="${p.key}">${p.label}</button>
        `);

        // Объём последних тренировок: свежие справа, как на любом графике времени
        const recent = entries
            .filter((e) => calc.inRange(e.workout.startedAt, current))
            .slice(0, 12)
            .reverse()
            .map((e) => ({
                label: dates.formatDate(e.workout.startedAt).slice(0, 5),
                value: e.sets
            }));

        return ui.html`
            ${ui.title('Статистика')}

            <div class="chips">${periodChips}</div>

            <div class="card">
                <div class="tiles">
                    ${tile('Тренировок', String(now.workouts), change.workouts)}
                    ${tile('Подходов', String(now.sets), change.sets)}
                    ${tile('Повторений', String(now.reps), change.reps)}
                    ${tile('Тоннаж, кг', format.decimal(now.volume, 0), change.volume)}
                    ${tile('Общее время', format.duration(now.durationMs), change.durationMs)}
                    ${tile('Подх. / трен.', format.decimal(now.avgSets), change.avgSets)}
                    ${tile('Повт. / подх.', format.decimal(now.avgReps), change.avgReps)}
                    ${tile('Средняя длит.', format.duration(now.avgDuration), change.avgDuration)}
                </div>

                ${was ? ui.html`
                    <p class="hint">Изменение — к предыдущему такому же периоду.</p>
                ` : ui.html`
                    <p class="hint">Сравнивать не с чем: за всё время предыдущего периода нет.</p>
                `}
            </div>

            <div class="card">
                <div class="card-title">Подходы по тренировкам</div>
                ${chart.bars(recent, { maxLabel: 5 })}
            </div>

            <div class="card">
                <div class="card-title">Постоянство</div>

                <div class="tiles">
                    ${tile('Недель подряд', String(streaks.weeks))}
                    ${tile('Рекорд недель', String(streaks.longestWeeks))}
                    ${tile('Дней подряд', String(streaks.days))}
                    ${tile('Дней с тренировкой', String(days.length))}
                </div>

                <div class="chart-title">По дням недели</div>
                ${chart.bars(
                    dates.WEEKDAYS_SHORT.map((label, i) => ({ label, value: weekdays[i] })),
                    { height: 120, maxLabel: 2 }
                )}
            </div>

            <div class="card">
                <div class="card-title">Год по дням</div>
                ${chart.heatmap(
                    heat.map((d) => ({
                        ...d,
                        title: `${dates.formatDate(d.day)} — ${d.sets ? format.count(d.sets, format.WORDS.set) : 'без тренировки'}`
                    })),
                    { months: monthLabels(heat) }
                )}
                <p class="hint">Насыщенность — по количеству подходов за день.</p>
            </div>

            <div class="card">
                <div class="card-title">Объём по группам мышц</div>
                ${chart.hbars(
                    muscles.map((m) => ({ label: m.group, value: m.sets })),
                    { format: (v) => `${v}` }
                )}
                ${muscles.some((m) => m.group === 'Без группы') ? ui.html`
                    <p class="hint">
                        У части упражнений группа не указана.
                        <button class="link-btn" data-action="nav" data-screen="exercises">Проставить в справочнике</button>
                    </p>
                ` : ''}
            </div>

            <button class="btn btn-ghost" data-action="nav" data-screen="records">Личные рекорды</button>
        `;
    }
};

actions.on('stats-period', (el) => {
    period = el.dataset.period;
    app.render();
});
