/**
 * Форматирование величин для показа.
 *
 * Вес всегда в килограммах, дистанция — в метрах, длительность — в
 * миллисекундах. Единицы не настраиваются (§28).
 *
 * От языка зависит здесь больше, чем кажется со стороны (§53): разделитель
 * дробной части, сокращения единиц и, главное, склонение. Русскому нужны три
 * формы слова, английскому две, и общего правила у них нет.
 */

import { i18n } from './i18n.js';

const pad = (n) => String(n).padStart(2, '0');

/**
 * Слова, которые приложение ставит после числа.
 *
 * Русские формы — [1, 2, 5]: подход, подхода, подходов. Английские — [1, 2]:
 * set, sets. Хранятся вместе, потому что это одно и то же слово, а не два
 * разных: разъехавшись по словарям, они разъедутся и по смыслу.
 */
const WORDS = {
    set:      { ru: ['подход', 'подхода', 'подходов'],          en: ['set', 'sets'],           de: ['Satz', 'Sätze'] },
    rep:      { ru: ['повторение', 'повторения', 'повторений'], en: ['rep', 'reps'],           de: ['Wiederholung', 'Wiederholungen'] },
    exercise: { ru: ['упражнение', 'упражнения', 'упражнений'], en: ['exercise', 'exercises'], de: ['Übung', 'Übungen'] },
    workout:  { ru: ['тренировка', 'тренировки', 'тренировок'], en: ['workout', 'workouts'],   de: ['Training', 'Trainings'] },
    template: { ru: ['шаблон', 'шаблона', 'шаблонов'],          en: ['template', 'templates'], de: ['Vorlage', 'Vorlagen'] },
    weighIn:  { ru: ['взвешивание', 'взвешивания', 'взвешиваний'], en: ['weigh-in', 'weigh-ins'], de: ['Wiegung', 'Wiegungen'] },
    day:      { ru: ['день', 'дня', 'дней'],                    en: ['day', 'days'],           de: ['Tag', 'Tage'] },
    minute:   { ru: ['минута', 'минуты', 'минут'],              en: ['minute', 'minutes'],     de: ['Minute', 'Minuten'] }
};

export const format = {

    WORDS,

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
     * Разделитель дробной части.
     *
     * Точка только по-английски: «62,5» англоязычный читает как список из
     * двух чисел. По-русски и по-немецки — запятая; немецкий здесь совпадает
     * с русским, и это тот редкий случай, когда переводить нечего.
     */
    point() {
        return i18n.lang === 'en' ? '.' : ',';
    },

    /** Вес: 60, 62,5 — или 62.5 по-английски. */
    weight(kg) {
        if (kg === null || kg === undefined || kg === '') return '—';
        const rounded = Math.round(kg * 100) / 100;
        return String(rounded).replace('.', format.point());
    },

    /**
     * Посчитанная нагрузка — целые килограммы (Р-56).
     *
     * Дробь у неё не измерена, а получена умножением: доля собственного веса
     * на вес тела на число повторений. «5891,35 кг» обещает точность до
     * десятков граммов там, где сама доля — усреднение по популяции.
     *
     * Записанный вес так не округляется: 62,5 кг на штанге — факт, и
     * половина блина в нём настоящая. Отсюда и две разные функции.
     */
    load(kg) {
        if (!Number.isFinite(kg)) return '—';
        return format.decimal(kg, 0);
    },

    /** Дробное число: 13,3 или 13.3. */
    decimal(value, digits = 1) {
        if (!Number.isFinite(value)) return '—';
        return value.toFixed(digits).replace('.', format.point());
    },

    /** Дистанция: 800 м, 1,2 км. */
    distance(m) {
        if (!m) return '—';
        return m >= 1000
            ? `${format.weight(m / 1000)} ${i18n.t('км')}`
            : `${Math.round(m)} ${i18n.t('м')}`;
    },

    /**
     * Склонение после числа.
     *
     * forms — либо запись из WORDS с формами обоих языков, либо готовый
     * список форм: старые вызовы с массивом должны продолжать работать.
     */
    plural(n, forms) {
        const list = Array.isArray(forms) ? forms : (forms[i18n.lang] || forms.ru);

        // Английский: одна форма для единицы, вторая для всего остального,
        // включая ноль
        if (list.length === 2) return Math.abs(n) === 1 ? list[0] : list[1];

        const abs = Math.abs(n) % 100;
        const last = abs % 10;
        if (abs > 10 && abs < 20) return list[2];
        if (last > 1 && last < 5) return list[1];
        if (last === 1) return list[0];
        return list[2];
    },

    /** Число вместе со склонённым словом: «3 подхода», «3 sets». */
    count(n, forms) {
        return `${n} ${format.plural(n, forms)}`;
    }
};
