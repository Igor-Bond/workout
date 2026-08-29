/**
 * Работа с датами.
 *
 * Всё время в приложении — миллисекунды (Date.now()). Строки ISO не
 * используются: по числу считается разница, оно же индексируется в базе.
 *
 * Названия месяцев и дней недели зависят от языка (§53). Сама дата — нет:
 * порядок «день, месяц, год» одинаков и там и там, а вот «08.27.2026» из
 * американской записи прочиталось бы как двадцать седьмой месяц.
 */

import { i18n } from './i18n.js';

const MONTHS = {
    ru: {
        gen: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
              'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
        nom: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
              'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
    },
    en: {
        gen: ['January', 'February', 'March', 'April', 'May', 'June',
              'July', 'August', 'September', 'October', 'November', 'December'],
        nom: ['January', 'February', 'March', 'April', 'May', 'June',
              'July', 'August', 'September', 'October', 'November', 'December']
    },
    de: {
        gen: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
              'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
        nom: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
              'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
    }
};

/**
 * Календарь начинается с понедельника — и в русском, и в английском виде.
 *
 * Длина сокращения у языков разная: русскому и немецкому хватает двух букв,
 * английскому нужно три. Кто рисует эти подписи, обязан оставить место под
 * три — обрезка по двум превращала «Mon» в «M…».
 */
const WEEKDAYS = {
    ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
    en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    de: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
};

const pad = (n) => String(n).padStart(2, '0');
const pick = (table) => table[i18n.lang] || table.ru;

export const dates = {

    /** Месяцы в родительном падеже: «27 августа». По-английски падежей нет. */
    get MONTHS_GEN() {
        return pick(MONTHS).gen;
    },

    /** Месяцы в именительном: заголовок календаря. */
    get MONTHS_NOM() {
        return pick(MONTHS).nom;
    },

    get WEEKDAYS_SHORT() {
        return pick(WEEKDAYS);
    },

    /** Полночь того дня, которому принадлежит момент. */
    startOfDay(ts) {
        const d = new Date(ts);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    },

    isSameDay(a, b) {
        return dates.startOfDay(a) === dates.startOfDay(b);
    },

    /** Целых дней между днями, которым принадлежат моменты. */
    daysBetween(a, b) {
        return Math.round((dates.startOfDay(b) - dates.startOfDay(a)) / 86400000);
    },

    /**
     * 27.08.2026, по-английски — August 27, 2026.
     *
     * Цифрами день и месяц по-английски неразличимы: «01.09.2025» читается
     * и как первое сентября, и как девятое января, а половина
     * англоязычного мира пишет месяц первым. Порядок из русского там не
     * подсказка, а ловушка, и в подписи дня приложение давно называет месяц
     * словом — здесь то же самое.
     *
     * Русскому и немецкому цифры оставлены: в обоих языках день идёт первым
     * и читается однозначно.
     */
    formatDate(ts) {
        const d = new Date(ts);

        if (i18n.lang === 'en') {
            return `${pick(MONTHS).nom[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
        }

        return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
    },

    /**
     * Подпись под столбцом графика: 27.08.
     *
     * Здесь цифры остаются у всех языков. Место под подписью — четверть
     * сантиметра, название месяца туда не входит даже сокращённым, а
     * соседние столбцы говорят, что это за числа: одни и те же две цифры
     * растут слева направо.
     */
    formatShort(ts) {
        const d = new Date(ts);
        return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
    },

    /** 19:40 */
    formatTime(ts) {
        const d = new Date(ts);
        return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    },

    /** 27.08.2026 19:40 */
    formatDateTime(ts) {
        return `${dates.formatDate(ts)} ${dates.formatTime(ts)}`;
    },

    /**
     * Сегодня / Вчера / 27 августа / 27 августа 2025.
     *
     * lower — для середины фразы: «начата сегодня в 21:40». Опускать регистр
     * у готовой подписи нельзя: в немецком месяц — существительное и пишется
     * с большой буквы, и «26. august» там читается как опечатка. Поэтому
     * строчными становятся только «сегодня» и «вчера», у которых для этого
     * есть свои ключи в словаре.
     */
    formatDayLabel(ts, now = Date.now(), { lower = false } = {}) {
        const diff = dates.daysBetween(ts, now);
        if (diff === 0) return i18n.t(lower ? 'сегодня' : 'Сегодня');
        if (diff === 1) return i18n.t(lower ? 'вчера' : 'Вчера');

        const d = new Date(ts);
        const month = dates.MONTHS_GEN[d.getMonth()];

        /*
         * Порядок дня и месяца у каждого языка свой.
         *
         * По-английски «27 August» читается как ошибка, «August 27» — как
         * дата. По-немецки наоборот, и день пишется с точкой: «27. August»
         * это «двадцать седьмое», а «27 August» — оборванная фраза.
         */
        const label = i18n.lang === 'en' ? `${month} ${d.getDate()}`
            : i18n.lang === 'de' ? `${d.getDate()}. ${month}`
            : `${d.getDate()} ${month}`;

        return d.getFullYear() === new Date(now).getFullYear()
            ? label
            : `${label} ${d.getFullYear()}`;
    },

    /** Номер дня недели, где понедельник — 0. */
    weekdayIndex(ts) {
        return (new Date(ts).getDay() + 6) % 7;
    }
};
