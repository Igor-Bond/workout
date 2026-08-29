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
    }
};

/** Календарь начинается с понедельника — и в русском, и в английском виде. */
const WEEKDAYS = {
    ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
    en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
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

    /** 27.08.2026 */
    formatDate(ts) {
        const d = new Date(ts);
        return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
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

    /** Сегодня / Вчера / 27 августа / 27 августа 2025 */
    formatDayLabel(ts, now = Date.now()) {
        const diff = dates.daysBetween(ts, now);
        if (diff === 0) return i18n.t('Сегодня');
        if (diff === 1) return i18n.t('Вчера');

        const d = new Date(ts);
        const month = dates.MONTHS_GEN[d.getMonth()];

        // По-английски день и месяц пишут наоборот: «27 August» читается как
        // ошибка, «August 27» — как дата
        const label = i18n.lang === 'en'
            ? `${month} ${d.getDate()}`
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
