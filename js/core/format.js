/**
 * Форматирование величин для показа.
 *
 * Вес всегда в килограммах, дистанция — в метрах, длительность — в
 * миллисекундах. Единицы не настраиваются (§28).
 */

const pad = (n) => String(n).padStart(2, '0');

export const format = {

    /**
     * Длительность из миллисекунд: 12:34, а свыше часа — 1:02:03.
     * Часы не дополняются нулём: «01:02:03» на экране читается хуже.
     */
    duration(ms) {
        const total = Math.max(0, Math.floor(ms / 1000));
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = total % 60;
        return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
    },

    /** То же, но из секунд — для таймера отдыха. */
    seconds(sec) {
        return format.duration(sec * 1000);
    },

    /**
     * Вес: 60, 62,5. Запятая, а не точка — так пишут по-русски,
     * и так же выглядит на клавиатуре телефона.
     */
    weight(kg) {
        if (kg === null || kg === undefined || kg === '') return '—';
        const rounded = Math.round(kg * 100) / 100;
        return String(rounded).replace('.', ',');
    },

    /** Дробное число с запятой: 13,3. Точка в русском тексте выглядит чужой. */
    decimal(value, digits = 1) {
        if (!Number.isFinite(value)) return '—';
        return value.toFixed(digits).replace('.', ',');
    },

    /** Дистанция: 800 м, 1,2 км. */
    distance(m) {
        if (!m) return '—';
        return m >= 1000
            ? `${format.weight(m / 1000)} км`
            : `${Math.round(m)} м`;
    },

    /**
     * Русское склонение после числа.
     * forms — [1, 2, 5]: подход, подхода, подходов.
     */
    plural(n, forms) {
        const abs = Math.abs(n) % 100;
        const last = abs % 10;
        if (abs > 10 && abs < 20) return forms[2];
        if (last > 1 && last < 5) return forms[1];
        if (last === 1) return forms[0];
        return forms[2];
    },

    /** Число вместе со склонённым словом: «3 подхода». */
    count(n, forms) {
        return `${n} ${format.plural(n, forms)}`;
    },

    WORDS: {
        set: ['подход', 'подхода', 'подходов'],
        rep: ['повторение', 'повторения', 'повторений'],
        exercise: ['упражнение', 'упражнения', 'упражнений'],
        workout: ['тренировка', 'тренировки', 'тренировок'],
        day: ['день', 'дня', 'дней'],
        minute: ['минута', 'минуты', 'минут']
    }
};
