/**
 * Работа с датами.
 *
 * Всё время в приложении — миллисекунды (Date.now()). Строки ISO не
 * используются: по числу считается разница, оно же индексируется в базе.
 */

const MONTHS_GEN = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
];

const MONTHS_NOM = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

/** Календарь начинается с понедельника. */
const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const pad = (n) => String(n).padStart(2, '0');

export const dates = {

    MONTHS_GEN,
    MONTHS_NOM,
    WEEKDAYS_SHORT,

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
        if (diff === 0) return 'Сегодня';
        if (diff === 1) return 'Вчера';

        const d = new Date(ts);
        const label = `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
        return d.getFullYear() === new Date(now).getFullYear()
            ? label
            : `${label} ${d.getFullYear()}`;
    },

    /** Номер дня недели, где понедельник — 0. */
    weekdayIndex(ts) {
        return (new Date(ts).getDay() + 6) % 7;
    }
};
