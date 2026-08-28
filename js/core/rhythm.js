/**
 * Ритм тренировок и прогноз следующей (§26.2 ТЗ).
 *
 * Никакого предсказания в смысле угадывания: считается медианный промежуток
 * между тренировочными днями и, если он устойчив, к последнему дню
 * прибавляется этот промежуток. Медиана, а не среднее, — одна пропущенная
 * неделя сдвинула бы среднее на несколько дней, а медиану не двигает.
 *
 * Модуль обязан честно говорить «данных мало». Прогноз по трём тренировкам —
 * это не прогноз, а совпадение, и подавать его как знание нельзя.
 */

const DAY = 86400000;

/** Минимум тренировок, ниже которого о ритме говорить нечего. */
const MIN_WORKOUTS = 5;

/** Сколько последних тренировок учитывать: ритм полугодовой давности не про сейчас. */
const WINDOW = 20;

const startOfDay = (ts) => {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
};

export const rhythm = {

    MIN_WORKOUTS,
    WINDOW,

    median(values) {
        if (values.length === 0) return 0;

        const sorted = [...values].sort((a, b) => a - b);
        const middle = Math.floor(sorted.length / 2);

        return sorted.length % 2
            ? sorted[middle]
            : (sorted[middle - 1] + sorted[middle]) / 2;
    },

    /**
     * Уникальные тренировочные дни по возрастанию.
     *
     * Две тренировки в один день — это один день ритма, а не промежуток в
     * ноль дней: иначе медиана обнулилась бы и прогноз показывал «сегодня»
     * каждый раз.
     */
    workoutDays(workouts = []) {
        const days = new Set(workouts.map((w) => startOfDay(w.startedAt)));
        return [...days].sort((a, b) => a - b);
    },

    /** Промежутки между соседними тренировочными днями, в днях. */
    intervals(days = []) {
        const result = [];
        for (let i = 1; i < days.length; i++) {
            result.push(Math.round((days[i] - days[i - 1]) / DAY));
        }
        return result;
    },

    /**
     * Насколько промежутки одинаковы: медиана отклонения от медианы,
     * делённая на саму медиану. Ноль — идеальный ритм.
     */
    spread(intervals, medianValue) {
        if (!medianValue || intervals.length === 0) return 1;

        const deviations = intervals.map((v) => Math.abs(v - medianValue));
        return rhythm.median(deviations) / medianValue;
    },

    /** Дни недели, на которые приходится большинство тренировок. Понедельник — 0. */
    typicalWeekdays(days = []) {
        const counts = new Array(7).fill(0);
        for (const day of days) counts[(new Date(day).getDay() + 6) % 7] += 1;

        // Порог в треть: при трёх тренировках в неделю каждый рабочий день
        // набирает около трети, а случайные выходные отсеиваются
        const threshold = days.length / 7 * 2;

        return counts
            .map((count, index) => ({ index, count }))
            .filter((d) => d.count >= Math.max(2, threshold))
            .sort((a, b) => b.count - a.count)
            .map((d) => d.index);
    },

    /**
     * Разбор ритма. workouts — завершённые тренировки, порядок любой.
     *
     * Возвращает { enough, ... }. При enough: false остальные поля тоже
     * заполнены, но показывать их как прогноз нельзя.
     */
    analyze(workouts = [], now = Date.now()) {
        const all = rhythm.workoutDays(workouts);
        const days = all.slice(-WINDOW);

        const lastAt = days[days.length - 1] ?? null;
        const daysSince = lastAt === null ? null : Math.round((startOfDay(now) - lastAt) / DAY);

        if (days.length < MIN_WORKOUTS) {
            return {
                enough: false,
                need: MIN_WORKOUTS - days.length,
                count: days.length,
                lastAt, daysSince,
                medianInterval: null, nextAt: null, state: null, confidence: null,
                weekdays: []
            };
        }

        const gaps = rhythm.intervals(days);
        const medianInterval = Math.max(1, Math.round(rhythm.median(gaps)));
        const spread = rhythm.spread(gaps, medianInterval);

        let nextAt = lastAt + medianInterval * DAY;

        // Если тренировки явно привязаны к дням недели, прогноз подтягивается
        // к ближайшему такому дню: «раз в 2,5 дня» на календаре не бывает
        const weekdays = rhythm.typicalWeekdays(days);
        if (weekdays.length >= 2 && weekdays.length <= 5) {
            nextAt = rhythm.snapToWeekday(nextAt, weekdays);
        }

        return {
            enough: true,
            count: days.length,
            medianInterval,
            spread,
            weekdays,
            lastAt,
            daysSince,
            nextAt,
            state: daysSince >= medianInterval * 2 ? 'overdue'
                : daysSince >= medianInterval ? 'due'
                : 'rest',
            confidence: spread <= 0.25 ? 'high' : spread <= 0.6 ? 'medium' : 'low'
        };
    },

    /** Ближайший день (в пределах ±3 суток), попадающий на привычный день недели. */
    snapToWeekday(ts, weekdays) {
        const target = new Set(weekdays);

        for (let shift = 0; shift <= 3; shift++) {
            for (const direction of shift === 0 ? [0] : [1, -1]) {
                const candidate = ts + direction * shift * DAY;
                if (target.has((new Date(candidate).getDay() + 6) % 7)) return candidate;
            }
        }

        return ts;
    },

    /**
     * Периодичность каждого упражнения (§26.2.3).
     *
     * Подсказка по типу тренировки часто молчит: у всех тренировок тип
     * может быть один — «Силовая», — а различаются они названиями шаблонов.
     * Цикла в одинаковых значениях нет, и предлагать нечего.
     *
     * Упражнения же различаются всегда. У каждого свой промежуток: жим раз
     * в четыре дня, пресс через день. Отсюда и берётся, чему пора.
     *
     * Считается по сводке внутри тренировки (§34.1) — списку упражнений,
     * который лежит в самой записи. Подходы для этого не читаются.
     */
    exerciseRhythm(entries = [], now = Date.now()) {
        const days = new Map();

        for (const entry of entries) {
            const day = startOfDay(entry.workout.startedAt);

            for (const id of entry.exerciseIds || []) {
                if (!days.has(id)) days.set(id, new Set());
                days.get(id).add(day);
            }
        }

        const today = startOfDay(now);

        return [...days.entries()].map(([exerciseId, set]) => {
            const list = [...set].sort((a, b) => a - b).slice(-WINDOW);

            const lastAt = list[list.length - 1];
            const daysSince = Math.round((today - lastAt) / DAY);

            // Один промежуток — это ещё не периодичность, а совпадение
            const gaps = rhythm.intervals(list);
            const enough = gaps.length >= 2;

            const medianInterval = enough
                ? Math.max(1, Math.round(rhythm.median(gaps)))
                : null;

            return {
                exerciseId,
                sessions: list.length,
                lastAt,
                daysSince,
                medianInterval,
                enough,

                // Насколько просрочено: 1 — ровно пора, 2 — вдвое дольше
                // обычного. По этой мере и сравниваются упражнения между
                // собой, иначе редкое всегда проигрывало бы частому
                overdue: enough ? daysSince / medianInterval : 0
            };
        });
    },

    /** Сколько упражнений обычно бывает в тренировке. */
    typicalSize(entries = []) {
        const sizes = entries.slice(0, WINDOW)
            .map((e) => (e.exerciseIds || []).length)
            .filter((n) => n > 0);

        return sizes.length ? Math.max(1, Math.round(rhythm.median(sizes))) : 1;
    },

    /**
     * Каким упражнениям пора — ровно на одну тренировку (§26.2.3).
     *
     * Порог — единица: прошло не меньше обычного промежутка. Предлагать
     * раньше значит звать делать то, что и так в графике.
     *
     * Но просроченного к любому дню накапливается больше, чем делают за
     * раз, и список из всего залежавшегося — это не тренировка, а перечень
     * долгов. Поэтому берётся столько, сколько обычно бывает в тренировке.
     *
     * И не любые: самое просроченное задаёт направление, а добираются к
     * нему те, с которыми оно чаще всего делалось вместе. Иначе в один день
     * попали бы спина, ноги и пресс только потому, что все трое залежались.
     */
    dueExercises(entries = [], now = Date.now(), { limit = null } = {}) {
        const overdue = rhythm.exerciseRhythm(entries, now)
            .filter((e) => e.enough && e.overdue >= 1)
            .sort((a, b) => b.overdue - a.overdue);

        if (overdue.length === 0) return [];

        const cap = limit || rhythm.typicalSize(entries);
        const [anchor, ...rest] = overdue;

        // Сколько раз каждое упражнение встречалось в одной тренировке с
        // самым просроченным
        const together = new Map();

        for (const entry of entries) {
            const ids = entry.exerciseIds || [];
            if (!ids.includes(anchor.exerciseId)) continue;

            for (const id of ids) together.set(id, (together.get(id) || 0) + 1);
        }

        rest.sort((a, b) => {
            const pair = (together.get(b.exerciseId) || 0) - (together.get(a.exerciseId) || 0);
            return pair !== 0 ? pair : b.overdue - a.overdue;
        });

        return [anchor, ...rest].slice(0, cap);
    },

    /**
     * Какой тип тренировки логично провести следующим.
     *
     * Сначала ищется повторяющийся цикл: «грудь — спина — ноги» по кругу.
     * Если цикла нет, предлагается тип, который дольше всех не делали, —
     * это тоже подсказка, просто более слабая.
     */
    suggestType(workouts = []) {
        const sequence = [...workouts]
            .sort((a, b) => b.startedAt - a.startedAt)
            .slice(0, WINDOW)
            .map((w) => w.type);

        if (sequence.length < 3) return null;

        for (let period = 2; period <= 4; period++) {
            if (sequence.length < period * 2) break;

            let matches = true;
            for (let i = 0; i + period < sequence.length && i < period * 2; i++) {
                if (sequence[i] !== sequence[i + period]) { matches = false; break; }
            }

            // Цикл из одинаковых значений циклом не является
            const unique = new Set(sequence.slice(0, period));
            if (matches && unique.size === period) {
                return { type: sequence[period - 1], reason: 'cycle', period };
            }
        }

        const seen = new Map();
        sequence.forEach((type, index) => {
            if (!seen.has(type)) seen.set(type, index);
        });

        if (seen.size < 2) return null;

        const [type] = [...seen.entries()].sort((a, b) => b[1] - a[1])[0];
        return { type, reason: 'stale' };
    }
};
