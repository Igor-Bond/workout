/**
 * Статистика (§23–§27 ТЗ).
 *
 * Правило раздела: у каждого числа должен быть либо масштаб, либо
 * сравнение. Поэтому показатели идут с изменением к предыдущему периоду, а
 * распределения — графиками, а не списками цифр.
 */

import { ui } from '../core/ui.js';
import { actions } from '../core/actions.js';
import { dialog } from '../core/dialog.js';
import { dbService } from '../services/db.js';
import { stats as calc, NO_GROUP } from '../core/stats.js';
import { rhythm } from '../core/rhythm.js';
import { chart } from '../core/chart.js';
import { format } from '../core/format.js';
import { dates } from '../core/dates.js';
import { t, i18n } from '../core/i18n.js';
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

/**
 * «июнь 2026» — для лучшего месяца (§23.1).
 *
 * Строчная буква только по-русски: месяц там имя нарицательное и посреди
 * фразы пишется малой. В английском и немецком это имя собственное, и
 * «juni 2026» читается как опечатка.
 */
function monthName(at) {
    const d = new Date(at);
    const month = dates.MONTHS_NOM[d.getMonth()];

    return `${i18n.lang === 'ru' ? month.toLowerCase() : month} ${d.getFullYear()}`;
}

/**
 * Карта открывается на сегодняшнем дне, а не на начале истории.
 *
 * Свежие недели справа — как на любом графике времени, — и без этого
 * человек каждый раз видел бы позапрошлый год и сам домотывал до «сейчас».
 */
function scrollHeatToToday() {
    const box = document.querySelector('.heatmap-scroll');
    if (box) box.scrollLeft = box.scrollWidth;
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

/**
 * Вес тела (§26.3).
 *
 * Отдельная карточка, а не строка в общих показателях: это не результат
 * тренировок, а условие, в котором они проходят.
 */
function bodyBlock(weights, range) {
    const series = calc.bodySeries(weights, range);
    const change = calc.bodyChange(series);
    const last = weights[weights.length - 1];

    return ui.html`
        <div class="card">
            <div class="card-title">${t('Вес тела')}</div>

            ${last ? ui.html`
                <div class="tiles">
                    ${tile(t('Сейчас, кг'), format.weight(last.weight))}
                    ${change ? tile(
                        t('За период, кг'),
                        `${change.delta > 0 ? '+' : change.delta < 0 ? '−' : ''}${format.weight(Math.abs(change.delta))}`
                    ) : ''}
                    ${tile(t('Взвешиваний'), String(series.length))}
                </div>

                ${series.length >= 2 ? chart.line([{
                    color: 'var(--purple)',
                    segments: [series.map((p) => ({
                        x: p.at, y: p.weight, key: String(p.at),
                        label: dates.formatShort(p.at)
                    }))]
                }], { height: 130 }) : ''}

                <p class="hint">${t('Последнее взвешивание — {день}.', { день: dates.formatDayLabel(last.at, Date.now(), { lower: true }) })}</p>
            ` : ui.empty(t('Вес тела не отмечался. Он нужен, чтобы подтягивания и отжимания перестали считаться нулевой нагрузкой.'))}

            <button class="btn btn-ghost btn-sm" data-action="body-add">
                ${last ? t('Отметить вес') : t('Отметить вес сегодня')}
            </button>
        </div>
    `;
}

export const stats = {

    title: 'Статистика',
    nav: 'stats',

    mount() {
        scrollHeatToToday();
    },

    async render() {
        const [entries, sets, exerciseList, weights] = await Promise.all([
            dbService.listWorkoutSummaries(),
            dbService.allSets(),
            dbService.listExercises({ includeArchived: true }),
            dbService.listBodyWeight()
        ]);

        if (entries.length === 0) {
            return ui.html`
                ${ui.title(t('Статистика'))}
                ${ui.empty(t('Нет данных — сначала проведи тренировку.'))}
                ${bodyBlock(weights, null)}
            `;
        }

        const exercises = Object.fromEntries(exerciseList.map((e) => [e.id, e]));
        const { current, previous } = calc.ranges(period);

        const now = calc.aggregate(entries, current);
        const was = previous ? calc.aggregate(entries, previous) : null;
        const change = calc.compare(now, was);

        // Лучший месяц считается по всей истории, а не по выбранному
        // периоду: «лучший за месяц» — бессмыслица (§23.1)
        const best = calc.bestMonth(entries);

        const days = calc.days(entries, current);
        const streaks = calc.streaks(calc.days(entries, null));
        const weekdays = calc.weekdays(entries, current);
        const muscles = calc.muscleVolume(sets, exercises, current);
        const heat = calc.heatmap(entries);

        // Прогноз ритма (§26.2): справка к «Постоянству», а не действие
        const ритм = rhythm.analyze(entries.map((e) => e.workout));

        const periodChips = calc.PERIODS.map((p) => ui.html`
            <button class="chip ${period === p.key ? 'is-active' : ''}"
                    data-action="stats-period" data-period="${p.key}">${t(p.label)}</button>
        `);

        // Объём последних тренировок: свежие справа, как на любом графике времени
        const recent = entries
            .filter((e) => calc.inRange(e.workout.startedAt, current))
            .slice(0, 12)
            .reverse()
            .map((e) => ({
                label: dates.formatShort(e.workout.startedAt),
                value: e.sets
            }));

        return ui.html`
            ${ui.title(t('Статистика'))}

            <div class="chips">${periodChips}</div>

            <div class="card">
                <div class="tiles">
                    ${tile(t('Тренировок'), String(now.workouts), change.workouts)}
                    ${tile(t('Подходов'), String(now.sets), change.sets)}
                    ${tile(t('Повторений'), String(now.reps), change.reps)}
                    ${tile(t('Тоннаж, кг'), format.decimal(now.volume, 0), change.volume)}
                    ${tile(t('Общее время'), format.duration(now.durationMs), change.durationMs)}
                    ${tile(t('Подх. / трен.'), format.decimal(now.avgSets), change.avgSets)}
                    ${tile(t('Повт. / подх.'), format.decimal(now.avgReps), change.avgReps)}
                    ${tile(t('Средняя длит.'), format.duration(now.avgDuration), change.avgDuration)}
                </div>

                ${was ? ui.html`
                    <p class="hint">${t('Изменение — к предыдущему такому же периоду.')}</p>
                ` : ui.html`
                    <p class="hint">${t('Сравнивать не с чем: за всё время предыдущего периода нет.')}</p>
                `}

                ${best ? ui.html`
                    <div class="best-month">
                        <span class="best-label">${t('Лучший месяц за всё время')}</span>
                        <span>
                            ${monthName(best.byWorkouts.at)} —
                            ${format.count(best.byWorkouts.workouts, format.WORDS.workout)}
                        </span>
                        ${best.byVolume && best.byVolume.key !== best.byWorkouts.key ? ui.html`
                            <span>
                                ${t('по тоннажу {месяц} — {кг} кг', {
                                    месяц: monthName(best.byVolume.at),
                                    кг: format.decimal(best.byVolume.volume, 0)
                                })}
                            </span>
                        ` : best.byVolume ? ui.html`
                            <span>${t('он же лучший по тоннажу: {кг} кг', {
                                кг: format.decimal(best.byVolume.volume, 0)
                            })}</span>
                        ` : ''}
                    </div>
                ` : ''}
            </div>

            <div class="card">
                <div class="card-title">${t('Подходы по тренировкам')}</div>
                ${chart.bars(recent, { maxLabel: 5 })}
            </div>

            ${bodyBlock(weights, current)}

            <div class="card">
                <div class="card-title">${t('Постоянство')}</div>

                <div class="tiles">
                    ${tile(t('Недель подряд'), String(streaks.weeks))}
                    ${tile(t('Рекорд недель'), String(streaks.longestWeeks))}
                    ${tile(t('Дней подряд'), String(streaks.days))}
                    ${tile(t('Дней с тренировкой'), String(days.length))}
                </div>

                <div class="chart-title">${t('По дням недели')}</div>
                ${chart.bars(
                    dates.WEEKDAYS_SHORT.map((label, i) => ({ label, value: weekdays[i] })),
                    { height: 120, maxLabel: 3 }
                )}

                <!--
                    Прогноз ритма стоит здесь, а не на главном (§26.2).

                    Это справка, а не действие: нажать на неё нельзя, и на
                    экране, с которого начинают тренировку, она занимала
                    место, ничего не предлагая. Здесь она среди своих —
                    рядом с сериями и днями недели, за которыми сюда и
                    приходят.
                -->
                ${ритм.enough ? ui.html`
                    <p class="hint">
                        ${ритм.state === 'overdue'
                            ? t('{n} без тренировки.', { n: format.count(ритм.daysSince, format.WORDS.day) })
                            : ритм.state === 'due'
                                ? t('Привычный промежуток вышел.')
                                : t('Следующая ожидается {день}.', { день: dates.formatDayLabel(ритм.nextAt, Date.now(), { lower: true }) })}
                        ${t('Обычно раз в {n}', { n: format.count(ритм.medianInterval, format.WORDS.day) })}${ритм.confidence === 'low' ? t(', ритм рваный — день примерный') : ''}
                    </p>
                ` : ''}
            </div>

            <div class="card">
                <div class="card-title">${t('По дням')}</div>

                ${chart.heatmap(
                    heat.map((d) => ({
                        ...d,
                        title: `${dates.formatDate(d.day)} — ${d.sets ? format.count(d.sets, format.WORDS.set) : t('без тренировки')}`
                    })),
                    { months: monthLabels(heat) }
                )}
                <p class="hint">${t('Насыщенность — по количеству подходов за день. Карта листается вбок.')}</p>
            </div>

            <div class="card">
                <div class="card-title">${t('Объём по группам мышц')}</div>
                ${chart.hbars(
                    muscles.map((m) => ({ label: t(m.group), value: m.sets })),
                    { format: (v) => `${v}` }
                )}
                ${muscles.some((m) => m.group === NO_GROUP) ? ui.html`
                    <p class="hint">
                        ${t('У части упражнений группа не указана.')}
                        <button class="link-btn" data-action="nav" data-screen="exercises">${t('Проставить в справочнике')}</button>
                    </p>
                ` : ''}
            </div>

            <button class="btn btn-ghost" data-action="nav" data-screen="records">${t('Личные рекорды')}</button>
        `;
    }
};

actions.on('stats-period', (el) => {
    period = el.dataset.period;
    app.render();
});

actions.on('body-add', async () => {
    const today = await dbService.getBodyWeightOn(Date.now());
    const last = today || await dbService.lastBodyWeight();

    const values = await dialog.form({
        title: t('Вес тела'),
        text: today
            ? t('Сегодня вес уже отмечен — новое значение заменит прежнее.')
            : t('Одна запись на день: утреннее и вечернее взвешивание в графике превратились бы в шум.'),
        fields: [
            { name: 'weight', label: t('Вес, кг'), type: 'number', required: true, value: last?.weight ?? '' },
            { name: 'note', label: t('Заметка (необязательно)'), value: today?.note || '' }
        ],
        confirmText: t('Сохранить')
    });

    if (!values || !values.weight) return;

    await dbService.setBodyWeight({ weight: values.weight, note: values.note });
    app.render();
});
