/**
 * Карточка упражнения (§24, §25 ТЗ).
 *
 * Всё, что известно про одно упражнение: рекорды, суммы, динамика и полная
 * история подходов. Открывается по #/exercise/<id>.
 */

import { t } from '../core/i18n.js';
import { ui } from '../core/ui.js';
import { dbService } from '../services/db.js';
import { records } from '../core/records.js';
import { estimate } from '../core/estimate.js';
import { stats as calc } from '../core/stats.js';
import { chart } from '../core/chart.js';
import { format } from '../core/format.js';
import { dates } from '../core/dates.js';
import { kindLabel } from '../core/kinds.js';
import { isBackground } from '../core/rhythm.js';

const tile = (label, value) => ui.html`<div class="tile"><strong>${value}</strong><span>${label}</span></div>`;

/**
 * График динамики (§25): рабочий результат и объём — двумя полями.
 *
 * Раньше обе линии стояли в одном поле, каждая в своём невидимом масштабе по
 * вертикали. Масштабы разные по необходимости — результат и объём отличаются
 * на порядок, — но линии от этого пересекались, и глаз сравнивал то, что
 * сравнивать нельзя: ни оси, ни чисел рядом нет (Р-64).
 *
 * Поэтому поля два. В каждом одна величина, подписанная своими единицами, и
 * вертикаль внутри поля значит ровно одно.
 *
 * Сглаженная линия показывает тренд, точки — фактические тренировки.
 */
function точка(p, y) {
    return { x: p.at, y, key: p.workoutId, label: dates.formatShort(p.at) };
}

function resultChart(series, recordWorkoutId) {
    const smoothed = calc.movingAverage(series.map((p) => p.top));

    return chart.line([
        {
            color: 'var(--accent)',
            segments: calc.segments(series).map((seg) => seg.map((p) => точка(p, p.top)))
        },
        {
            color: 'var(--text-dim)',
            width: 1,
            dashed: true,
            dots: false,
            segments: [series.map((p, i) => точка(p, smoothed[i]))]
        }
    ], { marks: recordWorkoutId ? [recordWorkoutId] : [], height: 130 });
}

/**
 * Единица рабочего результата — по тому, что в подходах записано.
 *
 * Не по виду упражнения: вид можно поменять в справочнике, а записанные
 * подходы от этого не меняются, и подпись обязана называть то, что на
 * графике, а не то, чем упражнение считается сегодня.
 */
function единица(series, kind) {
    const слова = { reps: 'повторений', weight: 'кг', time: 'секунд', distance: 'метров' };
    return t(слова[kind] || 'повторений');
}

function volumeChart(series) {
    return chart.line([
        {
            color: 'var(--blue)',
            width: 1.5,
            segments: calc.segments(series).map((seg) => seg.map((p) => точка(p, p.volume)))
        }
    ], { height: 100 });
}

export const exercise = {

    title: 'Упражнение',
    nav: 'stats',

    async render(params) {
        const id = params[0];
        const record = id ? await dbService.getExercise(id) : null;

        if (!record) {
            return ui.html`
                ${ui.title(t('Упражнение'))}
                ${ui.empty(t('Упражнение не найдено.'))}
                <button class="btn btn-ghost" data-action="nav" data-screen="records">${t('← К рекордам')}</button>
            `;
        }

        const [sets, weights, проведённые] = await Promise.all([
            dbService.listSetsByExercise(record.id),
            dbService.listBodyWeight(),
            dbService.listWorkouts()
        ]);

        if (sets.length === 0) {
            return ui.html`
                ${ui.title(record.name, kindLabel(record.kind))}
                ${ui.empty(t('Это упражнение ещё ни разу не выполнялось.'))}
                <button class="btn btn-ghost" data-action="nav" data-screen="records">${t('← К рекордам')}</button>
            `;
        }

        const best = records.best(sets, record.kind);
        const workoutIds = new Set(sets.map((s) => s.workoutId));

        const reps = sets.reduce((sum, s) => sum + (s.reps || 0), 0);
        const volume = sets.reduce((sum, s) => sum + (s.weight ? (s.reps || 0) * s.weight : 0), 0);

        const lastAt = Math.max(...sets.map((s) => s.performedAt));
        const daysAgo = Math.round((dates.startOfDay(Date.now()) - dates.startOfDay(lastAt)) / 86400000);

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
        const bodyShare = estimate.shareOf(record);

        const bodyLoad = record.kind === 'reps'
            ? sets.reduce((sum, s) => sum + calc.load(s, 'reps', bodyAt(s.performedAt), bodyShare), 0)
            : 0;

        const relative = record.kind === 'weight' && best?.weight && currentBody
            ? best.weight / currentBody
            : 0;

        /*
         * Ряд строится по возрастанию времени, база отдаёт свежие первыми.
         *
         * Мера объёма — та же, что в плитке «Тоннаж» (Р-52): вес тела берётся
         * на дату подхода, поэтому линия не переписывается при новом
         * взвешивании — оно действует со своего дня и дальше.
         */
        const мера = record.kind === 'reps'
            ? (set) => calc.load(set, 'reps', bodyAt(set.performedAt), bodyShare) + (set.reps || 0) * (set.weight || 0)
            : null;

        /*
         * Зарядка в динамику не входит (Р-64).
         *
         * Одно и то же упражнение живёт в двух разных занятиях: вечером
         * двенадцать подходов по сорок пять, утром один на шестьдесят восемь.
         * Считая их одним рядом, график говорил неправду в обе стороны сразу:
         * объём обрушивался вдесятеро — не потому, что стали делать меньше, а
         * потому, что в ряд вошла разминка; а «рабочий результат» полз вверх,
         * потому что один длинный подход зарядки больше любого из двенадцати
         * рабочих.
         *
         * То же правило уже действует в очереди (Р-33) — здесь его просто не
         * применили.
         *
         * Если рабочих занятий не набралось на график, показываем зарядку:
         * упражнение, которое делают только в ней, иначе осталось бы вовсе без
         * динамики. Подпись под графиком в обоих случаях говорит, что именно
         * на нём.
         */
        const типы = new Map(проведённые.map((w) => [w.id, w.type]));
        const рабочие = sets.filter((s) => !isBackground({ type: типы.get(s.workoutId) }));

        const полный = calc.exerciseSeries([...sets].reverse(), record.kind, мера);
        const рабочий = calc.exerciseSeries([...рабочие].reverse(), record.kind, мера);

        const series = рабочий.length >= 2 ? рабочий : полный;
        const толькоЗарядка = series !== рабочий;
        const естьФон = sets.length > рабочие.length;

        // Объём показывается, когда его есть чем мерить: у упражнения на
        // время он складывается из нулей, и пустое поле лучше не рисовать
        const естьОбъём = series.some((p) => p.volume > 0);

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
                [kindLabel(record.kind), record.group, record.archived ? t('в архиве') : null]
                    .filter(Boolean).join(' · '))}

            <div class="card">
                <div class="tiles">
                    ${tile(t('Лучший результат'), records.describe(best, record.kind))}
                    ${oneRep ? tile(t('Разово, кг'), format.decimal(oneRep, 0)) : ''}
                    ${tile(t('Тренировок'), String(workoutIds.size))}
                    ${tile(t('Подходов'), String(sets.length))}
                    ${reps ? tile(t('Повторений'), String(reps)) : ''}
                    ${volume + bodyLoad > 0 ? tile(t('Тоннаж, кг'), format.decimal(volume + bodyLoad, 0)) : ''}
                    ${relative ? tile(t('К своему весу'), `×${format.decimal(relative, 2)}`) : ''}
                    ${tile(t('Последний раз'), daysAgo === 0 ? t('сегодня') : format.count(daysAgo, format.WORDS.day))}
                </div>

                ${record.kind === 'reps' && !bodyLoad ? ui.html`
                    <p class="hint">
                        ${t('Объём не считается: не отмечен вес тела.')}
                        <button class="link-btn" data-action="nav" data-screen="stats">${t('Отметить в статистике')}</button>
                    </p>
                ` : ''}

                <!--
                    Доля показывается там же, где посчитанный по ней объём:
                    иначе число «со своим весом» выглядит взятым с потолка, а
                    поправить его негде (§15.2).
                -->
                ${record.kind === 'reps' ? ui.html`
                    <p class="hint">
                        ${t('Доля своего веса — {доля} %.', { доля: Math.round(bodyShare * 100) })}
                        <button class="link-btn" data-action="nav" data-screen="shares">${t('Изменить')}</button>
                    </p>
                ` : ''}
            </div>

            ${series.length >= 2 ? ui.html`
                <div class="card">
                    <div class="card-title">${t('Динамика')}</div>

                    <div class="chart-title">${t('Рабочий результат, {единица}', { единица: единица(series, record.kind) })}</div>
                    ${resultChart(series, best?.workoutId)}
                    <div class="legend">
                        <span class="legend-item"><i class="dot is-accent"></i>${t('лучший подход')}</span>
                        <span class="legend-item"><i class="dot is-dim"></i>${t('тренд')}</span>
                    </div>

                    ${естьОбъём ? ui.html`
                        <div class="chart-title">${t('Объём за тренировку, кг')}</div>
                        ${volumeChart(series)}
                    ` : ''}

                    <!--
                        Подпись говорит, что на графике, а не украшает его.
                        Пока зарядку считали наравне с рабочими занятиями,
                        линии врали в обе стороны сразу (Р-64), и умолчать
                        о том, что она исключена, значит оставить читателя
                        гадать, почему график и плитки не сходятся.
                    -->
                    ${толькоЗарядка ? ui.html`
                        <p class="hint">${t('На графике зарядка: рабочих тренировок с этим упражнением пока меньше двух.')}</p>
                    ` : естьФон ? ui.html`
                        <p class="hint">${t('Зарядка в график не входит — у неё свой объём, и вместе с рабочими занятиями она искажает обе линии.')}</p>
                    ` : ''}
                </div>
            ` : ''}

            <div class="card">
                <div class="card-title">${t('История — {n}', { n: format.count(workoutIds.size, format.WORDS.workout) })}</div>
                ${history}
            </div>

            <!--
                Правка отсюда, а не только из справочника (Р-49). Вид
                упражнения виден именно здесь — по тому, что показано в
                истории и в плитках, — и заметив, что «Отжимания» заведены
                силовыми, человек оказывался в тупике: экран, где ошибка
                видна, поправить её не давал. Действие то же самое, что в
                справочнике, и обработчик у него общий.
            -->
            <button class="btn btn-ghost" data-action="ex-edit" data-id="${record.id}">
                ${t('Изменить упражнение')}
            </button>

            <button class="btn btn-ghost" data-action="nav" data-screen="records">${t('← К рекордам')}</button>
            <button class="btn btn-ghost" data-action="nav" data-screen="stats">${t('К статистике')}</button>
        `;
    }
};
