/**
 * Карточка упражнения (§24, §25 ТЗ).
 *
 * Всё, что известно про одно упражнение: рекорды, суммы, динамика и полная
 * история подходов. Открывается по #/exercise/<id>.
 */

import { ui } from '../core/ui.js';
import { dbService } from '../services/db.js';
import { records } from '../core/records.js';
import { estimate } from '../core/estimate.js';
import { stats as calc } from '../core/stats.js';
import { chart } from '../core/chart.js';
import { format } from '../core/format.js';
import { dates } from '../core/dates.js';

const KIND_LABEL = {
    weight: 'Силовое с весом',
    reps: 'Собственный вес',
    time: 'На время',
    distance: 'Кардио'
};

const tile = (label, value) => ui.html`<div class="tile"><strong>${value}</strong><span>${label}</span></div>`;

/**
 * График динамики (§25): рабочий результат и объём.
 *
 * Две линии в одном поле, но каждая в своём масштабе по вертикали — вес и
 * тоннаж отличаются на порядок, и в общем масштабе вес прижался бы к нулю.
 * Сглаженная линия показывает тренд, точки — фактические тренировки.
 */
function dynamics(series, recordWorkoutId) {
    if (series.length < 2) return null;

    const smoothed = calc.movingAverage(series.map((p) => p.top));

    const point = (p, y) => ({
        x: p.at,
        y,
        key: p.workoutId,
        label: dates.formatDate(p.at).slice(0, 5)
    });

    return chart.line([
        {
            color: 'var(--blue)',
            width: 1.5,
            dots: false,
            segments: calc.segments(series).map((seg) =>
                seg.map((p) => point(p, p.volume)))
        },
        {
            color: 'var(--accent)',
            segments: calc.segments(series).map((seg) =>
                seg.map((p) => point(p, p.top)))
        },
        {
            color: 'var(--text-dim)',
            width: 1,
            dashed: true,
            dots: false,
            segments: [series.map((p, i) => point(p, smoothed[i]))]
        }
    ], { marks: recordWorkoutId ? [recordWorkoutId] : [] });
}

export const exercise = {

    title: 'Упражнение',
    nav: 'stats',

    async render(params) {
        const id = params[0];
        const record = id ? await dbService.getExercise(id) : null;

        if (!record) {
            return ui.html`
                ${ui.title('Упражнение')}
                ${ui.empty('Упражнение не найдено.')}
                <button class="btn btn-ghost" data-action="nav" data-screen="records">← К рекордам</button>
            `;
        }

        const [sets, weights] = await Promise.all([
            dbService.listSetsByExercise(record.id),
            dbService.listBodyWeight()
        ]);

        if (sets.length === 0) {
            return ui.html`
                ${ui.title(record.name, KIND_LABEL[record.kind])}
                ${ui.empty('Это упражнение ещё ни разу не выполнялось.')}
                <button class="btn btn-ghost" data-action="nav" data-screen="records">← К рекордам</button>
            `;
        }

        const best = records.best(sets, record.kind);
        const workoutIds = new Set(sets.map((s) => s.workoutId));

        const reps = sets.reduce((sum, s) => sum + (s.reps || 0), 0);
        const volume = sets.reduce((sum, s) => sum + (s.weight ? (s.reps || 0) * s.weight : 0), 0);

        const lastAt = Math.max(...sets.map((s) => s.performedAt));
        const daysAgo = Math.round((dates.startOfDay(Date.now()) - dates.startOfDay(lastAt)) / 86400000);

        // Ряд строится по возрастанию времени, база отдаёт свежие первыми
        const series = calc.exerciseSeries([...sets].reverse(), record.kind);
        const oneRep = record.kind === 'weight' && best?.weight
            ? records.epley(best.weight, best.reps)
            : 0;

        /*
         * Вес тела (§26.3) добавляет две величины, каждую — своему виду
         * упражнения:
         *
         *   собственный вес → нагрузка, которой иначе просто нет: подтягивания
         *     без веса тела считаются нулевым объёмом, то есть как будто их
         *     не делали;
         *   силовое → отношение к своему весу. Жим 80 кг при своих 70 и при
         *     своих 95 — разные достижения, и без этого числа они выглядят
         *     одинаково.
         */
        const bodyAt = calc.bodyWeightLookup(weights);
        const currentBody = weights[weights.length - 1]?.weight || null;

        // Доля своего веса у этого упражнения — та же, что показывает экран
        // выполнения: два экрана об одном подходе обязаны говорить одно
        const bodyShare = estimate.BODY_SHARE[record.nameKey] ?? estimate.SHARE_BY_KIND.reps;

        const bodyLoad = record.kind === 'reps'
            ? sets.reduce((sum, s) => sum + calc.load(s, 'reps', bodyAt(s.performedAt), bodyShare), 0)
            : 0;

        const relative = record.kind === 'weight' && best?.weight && currentBody
            ? best.weight / currentBody
            : 0;

        const byWorkout = new Map();
        for (const set of sets) {
            byWorkout.set(set.workoutId, [...(byWorkout.get(set.workoutId) || []), set]);
        }

        const history = [...byWorkout.entries()].map(([workoutId, own]) => {
            const ordered = [...own].sort((a, b) => a.order - b.order);

            return ui.html`
                <div class="ex-hist-row">
                    <span class="ex-hist-date">${dates.formatDayLabel(ordered[0].performedAt)}</span>
                    <span class="ex-hist-sets">${records.describeSession(ordered, record.kind)}</span>
                </div>
            `;
        });

        return ui.html`
            ${ui.title(record.name,
                [KIND_LABEL[record.kind], record.group, record.archived ? 'в архиве' : null]
                    .filter(Boolean).join(' · '))}

            <div class="card">
                <div class="tiles">
                    ${tile('Лучший результат', records.describe(best, record.kind))}
                    ${oneRep ? tile("Разово, кг", format.decimal(oneRep, 0)) : ""}
                    ${tile('Тренировок', String(workoutIds.size))}
                    ${tile('Подходов', String(sets.length))}
                    ${reps ? tile('Повторений', String(reps)) : ''}
                    ${volume ? tile('Тоннаж, кг', format.decimal(volume, 0)) : ''}
                    ${bodyLoad ? tile('С весом тела, кг', format.decimal(bodyLoad, 0)) : ''}
                    ${relative ? tile('К своему весу', `×${format.decimal(relative, 2)}`) : ''}
                    ${tile('Последний раз', daysAgo === 0 ? 'сегодня' : format.count(daysAgo, format.WORDS.day))}
                </div>

                ${record.kind === 'reps' && !bodyLoad ? ui.html`
                    <p class="hint">
                        Объём не считается: не отмечен вес тела.
                        <button class="link-btn" data-action="nav" data-screen="stats">Отметить в статистике</button>
                    </p>
                ` : ''}
            </div>

            ${series.length >= 2 ? ui.html`
                <div class="card">
                    <div class="card-title">Динамика</div>
                    ${dynamics(series, best?.workoutId)}
                    <div class="legend">
                        <span class="legend-item"><i class="dot is-accent"></i>рабочий результат</span>
                        <span class="legend-item"><i class="dot is-blue"></i>объём</span>
                        <span class="legend-item"><i class="dot is-dim"></i>тренд</span>
                    </div>
                </div>
            ` : ''}

            <div class="card">
                <div class="card-title">История — ${format.count(workoutIds.size, format.WORDS.workout)}</div>
                ${history}
            </div>

            <button class="btn btn-ghost" data-action="nav" data-screen="records">← К рекордам</button>
            <button class="btn btn-ghost" data-action="nav" data-screen="stats">К статистике</button>
        `;
    }
};
