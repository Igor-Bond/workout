/**
 * Прошлый и лучший результат (§15 ТЗ).
 *
 * Это то, что превращает журнал в инструмент контроля прогресса: перед
 * подходом видно, с чем сравнивать. Расчёты чистые — подходы приносят
 * снаружи, в базу модуль не ходит.
 *
 * Правило «лучшего» зависит от вида упражнения: у силового это вес, у планки
 * время, у бега дистанция. Единой формулы нет, поэтому на каждый вид свой
 * порядок сравнения.
 */

import { format } from './format.js';

/** Значение поля с заменой отсутствующего на «хуже некуда». */
const num = (value, fallback = 0) => (Number.isFinite(value) ? value : fallback);

/**
 * Сравнение двух подходов: больше нуля — первый лучше.
 * Второй критерий вступает в дело только при равенстве первого.
 */
const COMPARE = {
    weight: (a, b) => num(a.weight) - num(b.weight) || num(a.reps) - num(b.reps),
    reps:   (a, b) => num(a.reps) - num(b.reps) || num(a.weight) - num(b.weight),
    time:   (a, b) => num(a.duration) - num(b.duration),

    // При равной дистанции лучше та, что пройдена быстрее. Подход без
    // отметки времени считается худшим из двух: сравнивать его не с чем.
    distance: (a, b) => {
        const byDistance = num(a.distance) - num(b.distance);
        if (byDistance !== 0) return byDistance;

        const ta = num(a.duration, Infinity);
        const tb = num(b.duration, Infinity);
        if (ta === tb) return 0;

        return tb - ta;
    }
};

/** Какое поле подхода отвечает за каждый вид упражнения. */
const FIELD = { weight: 'reps', reps: 'reps', time: 'duration', distance: 'distance' };

export const records = {

    COMPARE,

    /**
     * Есть ли в подходах то, что предполагает заявленный вид упражнения.
     *
     * Вид у упражнения можно поменять в справочнике, а записанные подходы
     * от этого не меняются. Отжимания, ставшие «упражнением на время», в
     * своих подходах по-прежнему хранят повторения.
     */
    supports(sets = [], kind) {
        const field = FIELD[kind];
        return !!field && sets.some((s) => s && s[field] !== undefined);
    },

    /**
     * По какой величине сравнивать и что показывать.
     *
     * Заявленный вид уважается, пока данные его подтверждают. Если нет —
     * величина выводится из самих подходов: они и есть правда, а вид — лишь
     * подсказка, какие поля показывать при вводе.
     *
     * Без этого смена вида в справочнике превращала всю историю упражнения
     * в «00:00», а его рекорд — в ноль.
     */
    measure(sets = [], kind = null) {
        // Противоречить виду нечему: подходов ещё нет, и заявленный вид —
        // единственное, что известно. Это обычное состояние упражнения,
        // которое делают в первый раз.
        if (sets.length === 0) return kind || 'reps';

        if (kind && records.supports(sets, kind)) return kind;

        if (sets.some((s) => s?.distance !== undefined)) return 'distance';
        if (sets.some((s) => s?.duration !== undefined)) return 'time';
        if (sets.some((s) => s?.weight !== undefined)) return 'weight';

        return 'reps';
    },

    /**
     * Лучший подход за всю историю.
     *
     * Подходы текущей тренировки сюда попадать не должны, пока она не
     * завершена (§15) — отсюда exceptWorkoutId.
     */
    best(sets = [], kind = 'weight', exceptWorkoutId = null) {
        const compare = COMPARE[records.measure(sets, kind)] || COMPARE.weight;

        return sets.reduce((champion, set) => {
            if (exceptWorkoutId && set.workoutId === exceptWorkoutId) return champion;
            if (!champion) return set;

            return compare(set, champion) > 0 ? set : champion;
        }, null);
    },

    /**
     * Подходы упражнения из ближайшей предыдущей тренировки.
     *
     * Не «последние три подхода», а именно все подходы того раза: сравнивать
     * осмысленно с целым упражнением, а не с обрывком.
     *
     * Ожидает подходы, отсортированные от свежих к старым — так их отдаёт
     * dbService.listSetsByExercise.
     */
    lastSession(setsNewestFirst = [], exceptWorkoutId = null) {
        const previous = setsNewestFirst.find((s) => s.workoutId !== exceptWorkoutId);
        if (!previous) return null;

        const own = setsNewestFirst
            .filter((s) => s.workoutId === previous.workoutId)
            .sort((a, b) => a.order - b.order);

        return {
            workoutId: previous.workoutId,
            performedAt: previous.performedAt,
            sets: own
        };
    },

    /**
     * Ориентировочный разовый максимум по формуле Эпли.
     *
     * Величина справочная: выше десяти повторений формула заметно завышает,
     * поэтому она показывается отдельно и фактический рекорд не заменяет.
     */
    epley(weight, reps) {
        if (!weight || !reps) return 0;
        return weight * (1 + reps / 30);
    },

    /**
     * Лучший подход тренировки, если он побил прежний рекорд.
     *
     * Отмечается ровно один подход, а не все подряд: три подхода с новым
     * весом — это одно достижение, а не три.
     */
    recordSet(workoutSets = [], previousBest = null, kind = 'weight') {
        const champion = records.best(workoutSets, kind);
        if (!champion) return null;

        const compare = COMPARE[kind] || COMPARE.weight;

        if (previousBest && compare(champion, previousBest) <= 0) return null;
        return champion;
    },

    /** Короткая запись подхода: «60 кг × 9», «20 повт.», «01:00». */
    describe(set, kind = 'weight') {
        if (!set) return '—';

        // Показываем то, что записано в подходе: вид упражнения мог
        // измениться уже после того, как подход был выполнен
        const measure = records.measure([set], kind);

        if (measure === 'time') return format.seconds(set.duration || 0);

        if (measure === 'distance') {
            const parts = [];
            if (set.distance) parts.push(format.distance(set.distance));
            if (set.duration) parts.push(format.seconds(set.duration));
            return parts.join(' за ') || '—';
        }

        const reps = set.reps ?? 0;
        return set.weight ? `${format.weight(set.weight)} кг × ${reps}` : `${reps} повт.`;
    },

    /** Строка вида «60 кг × 10, 60 × 9, 55 × 8» для подходов одного раза. */
    describeSession(sets = [], kind = 'weight') {
        if (sets.length === 0) return '—';

        const measure = records.measure(sets, kind);

        if (measure !== 'weight') {
            return sets.map((s) => records.describe(s, measure)).join(', ');
        }

        // Вес повторяется у большинства подходов — во втором и далее его
        // единица измерения только мешает читать
        return sets
            .map((s, i) => {
                const reps = s.reps ?? 0;
                if (!s.weight) return `${reps}`;
                return i === 0
                    ? `${format.weight(s.weight)} кг × ${reps}`
                    : `${format.weight(s.weight)} × ${reps}`;
            })
            .join(', ');
    }
};
