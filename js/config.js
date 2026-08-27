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
    keepAwake: true,

    /**
     * Входил ли пользователь в учётную запись хоть раз (§39).
     *
     * По этому признаку приложение решает, поднимать ли SDK Firebase при
     * запуске. Без него было бы плохо в обе стороны: поднимать всегда —
     * значит грузить почти мегабайт тем, кто облаком не пользуется; не
     * поднимать никогда — значит не синхронизировать, пока не откроешь
     * профиль, потому что до подъёма SDK приложение не знает, что вход
     * уже выполнен.
     */
    syncEnabled: false
};

/**
 * Настройки, которые имеет смысл переносить на другое устройство (§41).
 *
 * Всё остальное к устройству и привязано: включено ли здесь облако, когда
 * здесь был последний обмен, переносилась ли здесь версия 1. Перенести их
 * вместе с копией значило бы соврать новому устройству о его собственном
 * состоянии — например, объявить синхронизацию включённой там, где вход не
 * выполнялся.
 */
const PORTABLE = ['mode', 'restEnabled', 'restSeconds', 'restSound', 'restVibration', 'keepAwake'];

export const config = {

    DEFAULTS,
    PORTABLE,

    /** Настройки для резервной копии — только переносимые. */
    getPortable() {
        const result = {};
        for (const key of PORTABLE) result[key] = config.get(key);
        return result;
    },

    /**
     * Применение настроек из копии.
     *
     * Незнакомые ключи и значения не того типа отбрасываются: файл могли
     * сделать другой версией приложения или поправить руками, и принимать
     * из него что попало нельзя.
     */
    setPortable(values = {}) {
        let applied = 0;

        for (const key of PORTABLE) {
            if (!(key in values)) continue;

            const value = values[key];
            if (typeof value !== typeof DEFAULTS[key]) continue;

            config.set(key, value);
            applied += 1;
        }

        return applied;
    },

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
