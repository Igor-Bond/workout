/**
 * Расчёты статистики (§23–§26.1 ТЗ).
 *
 * Ни базы, ни разметки: на вход приходят готовые тренировки и подходы, на
 * выходе — числа. Такой модуль можно гонять тестами, а его ошибки иначе
 * замечаются последними: неверная цифра выглядит ровно так же убедительно,
 * как верная.
 *
 * Главное правило раздела (§27): у каждого числа должен быть либо масштаб,
 * либо сравнение. Поэтому здесь считается не только «сколько», но и
 * «насколько больше, чем в прошлый раз».
 */

import { dates } from './dates.js';
import { records } from './records.js';

const DAY = 86400000;

export const PERIODS = [
    { key: 'month',   label: 'Месяц',     days: 30 },
    { key: 'quarter', label: '3 месяца',  days: 90 },
    { key: 'year',    label: 'Год',       days: 365 },
    { key: 'all',     label: 'Всё время', days: null }
];

const EMPTY = {
    workouts: 0, sets: 0, reps: 0, volume: 0, durationMs: 0,
    avgSets: 0, avgReps: 0, avgVolume: 0, avgDuration: 0
};

/**
 * Куда попадают упражнения без указанной группы.
 *
 * Слово, а не пустая строка: оно попадает на график наравне с настоящими
 * группами, и подпись у столбца должна быть. Отсюда же и то, что оно здесь
 * одно на всех: экран статистики по нему узнаёт, показывать ли приписку
 * «у части упражнений группа не указана», и разойдись они — приписка
 * пропала бы или висела бы всегда.
 */
export const NO_GROUP = 'Без группы';

export const stats = {

    PERIODS,

    /**
     * Границы периода и такого же предыдущего — для сравнения (§23.1).
     * Для «всего времени» сравнивать не с чем, предыдущего периода нет.
     */
    ranges(periodKey, now = Date.now()) {
        const period = PERIODS.find((p) => p.key === periodKey) || PERIODS[0];
        if (!period.days) return { current: null, previous: null };

        const to = now;
        const from = to - period.days * DAY;

        return {
            current: { from, to },
            previous: { from: from - period.days * DAY, to: from }
        };
    },

    inRange(ts, range) {
        return !range || (ts >= range.from && ts <= range.to);
    },

    /**
     * Свод по тренировкам за период.
     * entries — из dbService.listWorkoutSummaries().
     */
    aggregate(entries = [], range = null) {
        const inside = entries.filter((e) => stats.inRange(e.workout.startedAt, range));
        if (inside.length === 0) return { ...EMPTY };

        const sum = inside.reduce((acc, e) => {
            acc.sets += e.sets;
            acc.reps += e.reps;
            acc.volume += e.volume;
            acc.durationMs += Math.max(0, (e.workout.finishedAt || e.workout.startedAt) - e.workout.startedAt);
            return acc;
        }, { sets: 0, reps: 0, volume: 0, durationMs: 0 });

        return {
            workouts: inside.length,
            ...sum,
            avgSets: sum.sets / inside.length,
            avgReps: sum.sets > 0 ? sum.reps / sum.sets : 0,
            avgVolume: sum.volume / inside.length,
            avgDuration: sum.durationMs / inside.length
        };
    },

    /**
     * Изменение относительно предыдущего периода.
     *
     * Когда предыдущего периода не было вовсе, изменение не считается:
     * «+100 %» относительно пустоты вводит в заблуждение сильнее, чем
     * отсутствие цифры.
     */
    compare(current, previous) {
        const result = {};

        for (const key of Object.keys(EMPTY)) {
            const now = current[key] || 0;
            const was = previous?.[key] || 0;

            result[key] = was === 0
                ? { value: now, delta: null, percent: null }
                : { value: now, delta: now - was, percent: ((now - was) / was) * 100 };
        }

        return result;
    },

    /**
     * Лучший месяц за всё время (§23.1) — по тренировкам и по тоннажу
     * отдельно: месяц может быть частым и лёгким или редким и тяжёлым.
     *
     * Месяцы календарные, а не скользящие окна: «июнь» человек понимает
     * сразу, а «с 20 мая по 19 июня» требует вчитываться.
     *
     * Пока месяц один, лучшего среди них не бывает — тогда null.
     */
    bestMonth(entries = []) {
        const months = new Map();

        for (const entry of entries) {
            const d = new Date(entry.workout.startedAt);
            const key = `${d.getFullYear()}-${d.getMonth()}`;

            const month = months.get(key) || {
                key,
                at: new Date(d.getFullYear(), d.getMonth(), 1).getTime(),
                workouts: 0,
                volume: 0
            };

            month.workouts += 1;
            month.volume += entry.volume || 0;

            months.set(key, month);
        }

        if (months.size < 2) return null;

        const all = [...months.values()];
        const pick = (field) => all.reduce((best, m) => (m[field] > best[field] ? m : best), all[0]);

        const byVolume = pick('volume');

        return {
            byWorkouts: pick('workouts'),
            byVolume: byVolume.volume > 0 ? byVolume : null
        };
    },

    /** Тренировочные дни за период, по возрастанию. */
    days(entries = [], range = null) {
        const set = new Set(
            entries
                .filter((e) => stats.inRange(e.workout.startedAt, range))
                .map((e) => dates.startOfDay(e.workout.startedAt))
        );

        return [...set].sort((a, b) => a - b);
    },

    /** Распределение по дням недели. Понедельник — 0 (§26). */
    weekdays(entries = [], range = null) {
        const counts = new Array(7).fill(0);

        for (const entry of entries) {
            if (!stats.inRange(entry.workout.startedAt, range)) continue;
            counts[dates.weekdayIndex(entry.workout.startedAt)] += 1;
        }

        return counts;
    },

    /**
     * Серии (§26).
     *
     * Считаются недели, а не дни: для трёх тренировок в неделю серия
     * подряд идущих дней всегда равна единице и ничего не значит. Неделя с
     * хотя бы одной тренировкой — вот единица постоянства.
     *
     * Дневная серия тоже возвращается — она интересна тем, кто занимается
     * каждый день.
     */
    streaks(days = [], now = Date.now()) {
        if (days.length === 0) return { days: 0, longestDays: 0, weeks: 0, longestWeeks: 0 };

        // --- дни подряд
        let longestDays = 1;
        let run = 1;

        for (let i = 1; i < days.length; i++) {
            run = days[i] - days[i - 1] === DAY ? run + 1 : 1;
            longestDays = Math.max(longestDays, run);
        }

        const last = days[days.length - 1];
        const sinceLast = Math.round((dates.startOfDay(now) - last) / DAY);

        // Серия жива, пока пропущено не больше одного дня: иначе вчерашняя
        // серия обнулялась бы ровно в полночь
        const currentDays = sinceLast <= 1 ? run : 0;

        // --- недели подряд
        const weeks = [...new Set(days.map(stats.weekStart))].sort((a, b) => a - b);
        const WEEK = 7 * DAY;

        let longestWeeks = 1;
        let weekRun = 1;

        for (let i = 1; i < weeks.length; i++) {
            weekRun = weeks[i] - weeks[i - 1] === WEEK ? weekRun + 1 : 1;
            longestWeeks = Math.max(longestWeeks, weekRun);
        }

        const thisWeek = stats.weekStart(now);
        const lastWeek = weeks[weeks.length - 1];
        const currentWeeks = (thisWeek - lastWeek) <= WEEK ? weekRun : 0;

        return { days: currentDays, longestDays, weeks: currentWeeks, longestWeeks };
    },

    /** Понедельник недели, которой принадлежит момент. */
    weekStart(ts) {
        return dates.startOfDay(ts) - dates.weekdayIndex(ts) * DAY;
    },

    /**
     * Объём по группам мышц (§26.1).
     *
     * Считается по подходам, а не по тренировкам: одна тренировка задевает
     * несколько групп, и делить её пополам было бы враньём.
     */
    muscleVolume(sets = [], exercises = {}, range = null) {
        const groups = new Map();

        for (const set of sets) {
            if (!stats.inRange(set.performedAt, range)) continue;

            const group = exercises[set.exerciseId]?.group || NO_GROUP;
            const entry = groups.get(group) || { group, sets: 0, volume: 0, reps: 0 };

            entry.sets += 1;
            entry.reps += set.reps || 0;
            if (set.weight) entry.volume += (set.reps || 0) * set.weight;

            groups.set(group, entry);
        }

        const total = [...groups.values()].reduce((sum, g) => sum + g.sets, 0);

        return [...groups.values()]
            .map((g) => ({ ...g, share: total > 0 ? (g.sets / total) * 100 : 0 }))
            .sort((a, b) => b.sets - a.sets);
    },

    /**
     * Точки графика динамики упражнения (§25): одна точка — одна тренировка.
     *
     * top — рабочий результат того раза (лучший подход), volume — объём.
     * Вес может стоять, а объём расти, и это разные новости, поэтому обе
     * величины считаются отдельно.
     */
    exerciseSeries(sets = [], kind = 'weight') {
        const byWorkout = new Map();

        for (const set of sets) {
            const own = byWorkout.get(set.workoutId) || [];
            own.push(set);
            byWorkout.set(set.workoutId, own);
        }

        // Величина выводится из самих подходов, если вид упражнения им не
        // соответствует: иначе смена вида превращала бы график в нули
        const measure = records.measure(sets, kind);

        const value = (s) => (
            measure === 'time' ? (s.duration || 0)
            : measure === 'distance' ? (s.distance || 0)
            : measure === 'reps' ? (s.reps || 0)
            : (s.weight || 0)
        );

        return [...byWorkout.entries()]
            .map(([workoutId, own]) => ({
                workoutId,
                at: Math.min(...own.map((s) => s.performedAt)),
                top: Math.max(...own.map(value)),
                volume: own.reduce((sum, s) => sum + (s.weight ? (s.reps || 0) * s.weight : (s.reps || 0)), 0),
                sets: own.length
            }))
            .sort((a, b) => a.at - b.at);
    },

    /**
     * Скользящее среднее: без него линия прыгает от каждого неудачного дня
     * и тренд не читается (§25).
     */
    movingAverage(values = [], window = 3) {
        return values.map((_, i) => {
            const from = Math.max(0, i - window + 1);
            const slice = values.slice(from, i + 1);
            return slice.reduce((a, b) => a + b, 0) / slice.length;
        });
    },

    /**
     * Разрывы в линии: если упражнение не делали дольше трёх недель, точки
     * не соединяются. Прямая через пропуск выглядит так, будто ничего не
     * происходило (§25).
     */
    GAP_MS: 21 * DAY,

    segments(points = []) {
        const result = [];
        let current = [];

        for (const point of points) {
            const previous = current[current.length - 1];

            if (previous && point.at - previous.at > stats.GAP_MS) {
                result.push(current);
                current = [];
            }

            current.push(point);
        }

        if (current.length) result.push(current);
        return result;
    },

    /**
     * Поиск веса тела на дату (§26.3).
     *
     * Берётся ближайшее взвешивание не позже нужной даты. Если таких нет —
     * самое раннее известное: иначе у всех тренировок до первого взвешивания
     * нагрузка была бы нулевой, и на графике появился бы обрыв в день начала
     * взвешиваний, неотличимый от настоящего скачка нагрузки.
     *
     * Возвращает функцию, а не значение: она вызывается для каждого подхода,
     * и пересобирать список на каждый вызов было бы расточительно.
     */
    bodyWeightLookup(entries = []) {
        const sorted = [...entries].sort((a, b) => a.at - b.at);
        if (sorted.length === 0) return () => null;

        return (ts) => {
            let found = null;

            for (const entry of sorted) {
                if (entry.at > ts) break;
                found = entry;
            }

            return (found || sorted[0]).weight;
        };
    },

    /**
     * Нагрузка подхода с учётом веса тела.
     *
     * Для подтягиваний и отжиманий поднимается собственный вес, и без него
     * такие подходы в объёме считаются нулевыми — то есть как будто их не
     * было. Доп. отягощение прибавляется к весу тела.
     */
    load(set, kind, bodyWeight, share = 1) {
        const reps = set.reps || 0;

        if (kind === 'reps') {
            if (!bodyWeight) return 0;

            // Доля собственного веса, приходящаяся на упражнение: отжимания
            // поднимают не всё тело, а около двух третей. Без неё карточка
            // упражнения показывала бы тоннаж в полтора раза больше того,
            // что говорит экран выполнения о том же самом подходе
            return reps * (share * bodyWeight + (set.weight || 0));
        }

        return set.weight ? reps * set.weight : 0;
    },

    /** Точки графика веса тела: {at, weight}. */
    bodySeries(entries = [], range = null) {
        return entries
            .filter((e) => stats.inRange(e.at, range))
            .sort((a, b) => a.at - b.at)
            .map((e) => ({ at: e.at, weight: e.weight }));
    },

    /**
     * Изменение веса за период: первое и последнее взвешивание.
     * Одно взвешивание изменением не является.
     */
    bodyChange(series = []) {
        if (series.length < 2) return null;

        const first = series[0];
        const last = series[series.length - 1];

        return {
            from: first.weight,
            to: last.weight,
            delta: last.weight - first.weight,
            days: Math.round((last.at - first.at) / DAY)
        };
    },

    /**
     * Тепловая карта: клетка на день (§26).
     *
     * Клетка задана в пикселях и не сжимается под ширину экрана. Раньше год
     * втискивался в карточку целиком, клетка выходила в девять пикселей,
     * оттенки становились неразличимы, и карта читалась как серое пятно.
     *
     * Показывается вся история целиком, а прокручивается вбок: страницы со
     * стрелками требовали попасть в кнопку и запомнить, где ты был, а лента
     * листается пальцем и на телефоне, и колесом на компьютере.
     *
     * Возвращает дни по возрастанию с уровнем насыщенности 0–4.
     */

    /**
     * Меньше года не показываем.
     *
     * Пустые недели до первой тренировки — тоже сведения: по ним видно, с
     * какого месяца всё началось и сколько времени прошло. Год — привычная
     * мера этого «сколько», и обрезать карту по длине истории значит лишать
     * её масштаба.
     */
    HEAT_WEEKS: 52,

    /** Больше трёх лет — тоже: это тысяча клеток, которые никто не разглядывает. */
    HEAT_MAX_WEEKS: 156,

    heatmap(entries = [], now = Date.now(), { weeks = null } = {}) {
        const byDay = new Map();

        for (const entry of entries) {
            const day = dates.startOfDay(entry.workout.startedAt);
            byDay.set(day, (byDay.get(day) || 0) + entry.sets);
        }

        const span = weeks || stats.heatWeeks(entries, now);

        // Начинаем с понедельника, чтобы столбцы карты были целыми неделями
        const last = stats.weekStart(now);
        const start = last - (span - 1) * 7 * DAY;
        const end = last + 6 * DAY;

        const result = [];

        for (let day = start; day <= end; day += DAY) {
            const sets = byDay.get(day) || 0;

            result.push({
                day,
                sets,
                level: sets === 0 ? 0 : sets <= 6 ? 1 : sets <= 12 ? 2 : sets <= 20 ? 3 : 4
            });
        }

        return result;
    },

    /**
     * Сколько недель охватить: год, а при истории длиннее — вся история.
     *
     * Год снизу и три года сверху: короче года карта теряет масштаб, длиннее
     * трёх — превращается в тысячу клеток, которые никто не разглядывает.
     */
    heatWeeks(entries = [], now = Date.now()) {
        if (entries.length === 0) return stats.HEAT_WEEKS;

        const earliest = entries.reduce(
            (min, e) => Math.min(min, e.workout.startedAt), Infinity
        );

        const span = (stats.weekStart(now) - stats.weekStart(earliest)) / (7 * DAY) + 1;

        return Math.min(stats.HEAT_MAX_WEEKS, Math.max(stats.HEAT_WEEKS, Math.round(span)));
    }
};
