/**
 * Расчёты статистики (§23–§26.1 ТЗ).
 *
 * Неверная цифра выглядит ровно так же убедительно, как верная, поэтому
 * проверяется каждая.
 */

import { describe, it, equal, assert } from '../runner.js';
import { stats } from '../../js/core/stats.js';

const DAY = 86400000;
const NOW = new Date(2026, 7, 27, 12, 0, 0).getTime();   // четверг

/** Свод одной тренировки в том виде, в каком его отдаёт база. */
const entry = (daysAgo, over = {}) => {
    const startedAt = NOW - daysAgo * DAY;

    return {
        workout: { id: `w${daysAgo}`, startedAt, finishedAt: startedAt + 3600000, type: 'Силовая' },
        sets: 10, reps: 100, volume: 5000,
        exerciseIds: ['a'],
        ...over
    };
};

describe('Границы периодов', () => {

    it('месяц сравнивается с предыдущим месяцем', () => {
        const { current, previous } = stats.ranges('month', NOW);

        equal(Math.round((current.to - current.from) / DAY), 30);
        equal(previous.to, current.from, 'предыдущий период примыкает к текущему');
    });

    it('всё время сравнивать не с чем', () => {
        equal(stats.ranges('all', NOW), { current: null, previous: null });
    });
});

describe('Свод за период', () => {

    const entries = [entry(1), entry(10), entry(40), entry(100)];

    it('в месяц попадают только тренировки месяца', () => {
        const { current } = stats.ranges('month', NOW);

        equal(stats.aggregate(entries, current).workouts, 2);
    });

    it('без периода считается вся история', () => {
        equal(stats.aggregate(entries, null).workouts, 4);
    });

    it('складывает подходы, повторения и тоннаж', () => {
        const result = stats.aggregate([entry(1), entry(2)], null);

        equal(result.sets, 20);
        equal(result.reps, 200);
        equal(result.volume, 10000);
    });

    it('считает средние на тренировку и на подход', () => {
        const result = stats.aggregate([
            entry(1, { sets: 10, reps: 100 }),
            entry(2, { sets: 20, reps: 100 })
        ], null);

        equal(result.avgSets, 15);
        equal(result.avgReps, 200 / 30);
    });

    it('пустой период не делит на ноль', () => {
        const result = stats.aggregate([], null);

        equal(result.workouts, 0);
        equal(result.avgReps, 0);
        equal(result.avgDuration, 0);
    });
});

describe('Сравнение с предыдущим периодом', () => {

    it('считает и разницу, и проценты', () => {
        const result = stats.compare({ workouts: 12 }, { workouts: 9 });

        equal(result.workouts.delta, 3);
        equal(Math.round(result.workouts.percent), 33);
    });

    it('падение показывается отрицательным', () => {
        const result = stats.compare({ sets: 80 }, { sets: 100 });

        equal(result.sets.delta, -20);
        equal(result.sets.percent, -20);
    });

    it('без предыдущего периода сравнения нет', () => {
        const result = stats.compare({ workouts: 5 }, { workouts: 0 });

        equal(result.workouts.value, 5);
        equal(result.workouts.delta, null, 'проценты относительно пустоты вводят в заблуждение');
    });

    it('отсутствующий предыдущий период не роняет расчёт', () => {
        equal(stats.compare({ workouts: 5 }, null).workouts.delta, null);
    });
});

describe('Лучший месяц за всё время', () => {

    /** Тренировка в конкретном месяце. */
    const inMonth = (month, day, volume = 0) => ({
        workout: { id: `${month}-${day}`, startedAt: new Date(2026, month, day, 12).getTime(),
            finishedAt: new Date(2026, month, day, 13).getTime(), type: 'Силовая' },
        sets: 10, reps: 100, volume, exerciseIds: ['a']
    });

    it('находит месяц с наибольшим числом тренировок', () => {
        const best = stats.bestMonth([
            inMonth(5, 1), inMonth(5, 3), inMonth(5, 5),
            inMonth(6, 1)
        ]);

        equal(new Date(best.byWorkouts.at).getMonth(), 5);
        equal(best.byWorkouts.workouts, 3);
    });

    it('лучший по тоннажу считается отдельно', () => {
        const best = stats.bestMonth([
            inMonth(5, 1, 100), inMonth(5, 3, 100), inMonth(5, 5, 100),
            inMonth(6, 1, 5000)
        ]);

        equal(new Date(best.byWorkouts.at).getMonth(), 5, 'частый месяц');
        equal(new Date(best.byVolume.at).getMonth(), 6, 'тяжёлый месяц');
    });

    it('без тоннажа лучшего по нему не бывает', () => {
        const best = stats.bestMonth([inMonth(5, 1), inMonth(6, 1)]);

        equal(best.byVolume, null, 'у упражнений с собственным весом тоннаж нулевой');
    });

    it('одного месяца для сравнения мало', () => {
        equal(stats.bestMonth([inMonth(5, 1), inMonth(5, 2)]), null,
            'лучший среди одного — не лучший');
    });

    it('пустая история лучшего месяца не даёт', () => {
        equal(stats.bestMonth([]), null);
    });

    it('месяцы разных лет не сливаются', () => {
        const прошлыйГод = {
            workout: { id: 'old', startedAt: new Date(2025, 5, 1, 12).getTime(),
                finishedAt: new Date(2025, 5, 1, 13).getTime(), type: 'Силовая' },
            sets: 10, reps: 100, volume: 9999, exerciseIds: ['a']
        };

        const best = stats.bestMonth([прошлыйГод, inMonth(5, 1, 1), inMonth(5, 2, 1)]);

        equal(new Date(best.byVolume.at).getFullYear(), 2025);
        equal(best.byWorkouts.workouts, 2, 'июнь 2026 — две тренировки, июнь 2025 — одна');
    });
});

describe('Дни недели', () => {

    it('понедельник идёт первым', () => {
        // NOW — четверг, это индекс 3
        const counts = stats.weekdays([entry(0)], null);

        equal(counts[3], 1);
        equal(counts.reduce((a, b) => a + b, 0), 1);
    });
});

describe('Серии', () => {

    const days = (list) => list.map((d) => new Date(2026, 7, d).getTime());

    it('дни подряд считаются подряд', () => {
        const result = stats.streaks(days([10, 11, 12, 20]), new Date(2026, 7, 20, 12).getTime());

        equal(result.longestDays, 3);
    });

    it('вчерашняя серия не обнуляется в полночь', () => {
        const result = stats.streaks(days([25, 26]), new Date(2026, 7, 27, 12).getTime());

        equal(result.days, 2, 'пропущен всего один день — серия жива');
    });

    it('после двух пропущенных дней серия обнулена', () => {
        const result = stats.streaks(days([20, 21]), new Date(2026, 7, 27, 12).getTime());

        equal(result.days, 0);
    });

    it('недели подряд — то, что имеет смысл при трёх тренировках в неделю', () => {
        // 3, 5, 7 августа — одна неделя; 10, 12 — следующая; 17 — третья
        const result = stats.streaks(days([3, 5, 7, 10, 12, 17]), new Date(2026, 7, 20, 12).getTime());

        equal(result.longestWeeks, 3);
        assert(result.longestDays < 3, 'дневная серия здесь ничего не сказала бы');
    });

    it('пустая история серий не даёт', () => {
        equal(stats.streaks([], NOW), { days: 0, longestDays: 0, weeks: 0, longestWeeks: 0 });
    });
});

describe('Объём по группам мышц', () => {

    const exercises = {
        bench: { group: 'Грудь' },
        squat: { group: 'Ноги' },
        nogroup: {}
    };

    const sets = [
        { exerciseId: 'bench', performedAt: NOW, reps: 10, weight: 60 },
        { exerciseId: 'bench', performedAt: NOW, reps: 8, weight: 60 },
        { exerciseId: 'squat', performedAt: NOW, reps: 10, weight: 100 },
        { exerciseId: 'nogroup', performedAt: NOW, reps: 20 }
    ];

    it('считает подходы и тоннаж по группам', () => {
        const result = stats.muscleVolume(sets, exercises, null);
        const chest = result.find((g) => g.group === 'Грудь');

        equal(chest.sets, 2);
        equal(chest.volume, 1080);
    });

    it('доли считаются по подходам', () => {
        const result = stats.muscleVolume(sets, exercises, null);

        equal(result.find((g) => g.group === 'Ноги').share, 25);
    });

    it('упражнения без группы собираются отдельно', () => {
        const result = stats.muscleVolume(sets, exercises, null);

        assert(result.some((g) => g.group === 'Без группы'), 'иначе их объём просто исчезнет');
    });

    it('группы идут от большей к меньшей', () => {
        const result = stats.muscleVolume(sets, exercises, null);

        equal(result[0].group, 'Грудь');
    });
});

describe('Динамика упражнения', () => {

    const set = (workoutId, at, reps, weight) => ({ workoutId, performedAt: at, reps, weight });

    const sets = [
        set('w2', NOW - 2 * DAY, 8, 65),
        set('w2', NOW - 2 * DAY, 7, 65),
        set('w1', NOW - 9 * DAY, 10, 60),
        set('w1', NOW - 9 * DAY, 9, 60)
    ];

    it('одна точка — одна тренировка, старые слева', () => {
        const series = stats.exerciseSeries(sets, 'weight');

        equal(series.length, 2);
        equal(series.map((p) => p.top), [60, 65], 'хронологический порядок');
    });

    it('рабочий результат — лучший подход того раза', () => {
        equal(stats.exerciseSeries(sets, 'weight')[1].top, 65);
    });

    it('объём считается отдельно от веса', () => {
        // 8×65 + 7×65 = 975
        equal(stats.exerciseSeries(sets, 'weight')[1].volume, 975);
    });

    it('у упражнения на время берётся длительность', () => {
        const plank = [
            { workoutId: 'p1', performedAt: NOW, duration: 60 },
            { workoutId: 'p1', performedAt: NOW, duration: 75 }
        ];

        equal(stats.exerciseSeries(plank, 'time')[0].top, 75);
    });
});

describe('Скользящее среднее', () => {

    it('сглаживает одиночный провал', () => {
        const smoothed = stats.movingAverage([10, 10, 4, 10], 3);

        assert(smoothed[2] > 4, 'провал не должен утаскивать линию вниз целиком');
        equal(smoothed[2], 8);
    });

    it('первые точки считаются по тому, что есть', () => {
        equal(stats.movingAverage([10, 20], 3), [10, 15]);
    });
});

describe('Разрывы в линии', () => {

    it('пауза дольше трёх недель разрывает линию', () => {
        const points = [
            { at: NOW - 60 * DAY }, { at: NOW - 58 * DAY },
            { at: NOW - 2 * DAY }
        ];

        equal(stats.segments(points).length, 2, 'иначе прямая нарисуется через пропуск');
    });

    it('обычные промежутки линию не рвут', () => {
        const points = [{ at: NOW - 6 * DAY }, { at: NOW - 3 * DAY }, { at: NOW }];

        equal(stats.segments(points).length, 1);
    });

    it('пустой ряд не роняет разбор', () => {
        equal(stats.segments([]), []);
    });
});

describe('Вес тела', () => {

    const weights = [
        { at: NOW - 30 * DAY, weight: 80 },
        { at: NOW - 10 * DAY, weight: 78 },
        { at: NOW, weight: 77.5 }
    ];

    it('на дату берётся ближайшее взвешивание не позже неё', () => {
        const at = stats.bodyWeightLookup(weights);

        equal(at(NOW - 5 * DAY), 78);
        equal(at(NOW), 77.5);
    });

    it('до первого взвешивания берётся самое раннее известное', () => {
        const at = stats.bodyWeightLookup(weights);

        equal(at(NOW - 100 * DAY), 80, 'иначе на графике появился бы обрыв в день начала взвешиваний');
    });

    it('без взвешиваний веса нет', () => {
        equal(stats.bodyWeightLookup([])(NOW), null);
    });

    it('изменение считается по первому и последнему', () => {
        const change = stats.bodyChange(stats.bodySeries(weights, null));

        equal(change.delta, -2.5);
        equal(change.days, 30);
    });

    it('одно взвешивание изменением не является', () => {
        equal(stats.bodyChange([{ at: NOW, weight: 80 }]), null);
    });
});

describe('Нагрузка с весом тела', () => {

    it('подтягивания без веса тела дают нулевой объём', () => {
        equal(stats.load({ reps: 10 }, 'reps', null), 0, 'считать их нулём — значит считать, что их не было');
    });

    it('с весом тела объём появляется', () => {
        equal(stats.load({ reps: 10 }, 'reps', 78), 780);
    });

    it('дополнительное отягощение прибавляется к весу тела', () => {
        equal(stats.load({ reps: 8, weight: 10 }, 'reps', 78), 704);
    });

    it('силовое упражнение вес тела не учитывает', () => {
        equal(stats.load({ reps: 10, weight: 60 }, 'weight', 78), 600);
    });

    it('упражнение на время объёма не даёт', () => {
        equal(stats.load({ duration: 60 }, 'time', 78), 0);
    });
});

describe('Тепловая карта', () => {

    const DAY = 86400000;
    const давно = (daysAgo) => ({
        workout: { startedAt: NOW - daysAgo * DAY }, sets: 1, volume: 0, exerciseIds: []
    });

    it('строится целыми неделями и кончается текущей', () => {
        const days = stats.heatmap([], NOW);

        equal(days.length % 7, 0, 'столбцы карты — целые недели');
        equal(new Date(days[0].day).getDay(), 1, 'начинается с понедельника');
        equal(new Date(days[days.length - 1].day).getDay(), 0, 'кончается воскресеньем');
    });

    /*
     * Охват — вся история, а не фиксированный год: у того, кто занимается
     * второй месяц, десять пустых месяцев ничего не сообщают, а прокрутку
     * удлиняют вдвое.
     */
    it('охватывает историю от первой тренировки до сегодня', () => {
        equal(stats.heatWeeks([давно(200)], NOW), 30, '200 дней — это тридцать недель');
        equal(stats.heatWeeks([давно(200), давно(3)], NOW), 30, 'считается по самой ранней');
    });

    it('короткая история всё равно показывается кварталом', () => {
        equal(stats.heatWeeks([], NOW), stats.HEAT_WEEKS, 'узкая полоска выглядела бы обрубком');
        equal(stats.heatWeeks([давно(5)], NOW), stats.HEAT_WEEKS);
    });

    it('очень длинная история обрезается', () => {
        equal(stats.heatWeeks([давно(4000)], NOW), stats.HEAT_MAX_WEEKS,
            'тысячу клеток никто не разглядывает');
    });

    it('охват доходит до карты', () => {
        equal(stats.heatmap([давно(200)], NOW).length, 30 * 7);
        equal(stats.heatmap([давно(200)], NOW, { weeks: 4 }).length, 28, 'явный охват сильнее');
    });

    it('насыщенность растёт ступенями', () => {
        const days = stats.heatmap([
            entry(1, { sets: 3 }), entry(2, { sets: 10 }), entry(3, { sets: 25 })
        ], NOW);

        const levels = days.filter((d) => d.sets > 0).map((d) => d.level).sort();

        equal(levels, [1, 2, 4]);
    });

    it('день без тренировки имеет нулевой уровень', () => {
        equal(stats.heatmap([], NOW).every((d) => d.level === 0), true);
    });
});
