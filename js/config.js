/**
 * Настройки приложения (§28 ТЗ).
 *
 * Хранятся в localStorage — доступ синхронный, разметка собирается без await.
 *
 * На этапе 2 сюда добавится зеркалирование в базу: настройки должны попадать
 * в резервную копию и подтягиваться на новом устройстве. Пока хранилище одно.
 */

const PREFIX = 'wt_';

/**
 * Значения по умолчанию. Тип значения здесь же задаёт тип при чтении:
 * булево читается как булево, число — как число.
 */
const DEFAULTS = {
    /** Режим выполнения по умолчанию: 'plan' или 'free' (§11). */
    mode: 'plan',

    /** Таймер отдыха (§16). */
    restEnabled: true,
    restSeconds: 90,
    restSound: true,
    restVibration: true,

    /** Не гасить экран во время тренировки. На iOS может не работать. */
    keepAwake: true
};

export const config = {

    DEFAULTS,

    get(key) {
        const raw = localStorage.getItem(PREFIX + key);
        if (raw === null) return DEFAULTS[key];

        try {
            return JSON.parse(raw);
        } catch {
            // Значение записано до появления JSON-формата либо испорчено
            return DEFAULTS[key];
        }
    },

    set(key, value) {
        localStorage.setItem(PREFIX + key, JSON.stringify(value));
    },

    /** Все настройки одним объектом. */
    getAll() {
        const result = {};
        for (const key of Object.keys(DEFAULTS)) result[key] = config.get(key);
        return result;
    },

    /** Сброс к значениям по умолчанию. */
    reset() {
        for (const key of Object.keys(DEFAULTS)) localStorage.removeItem(PREFIX + key);
    }
};
