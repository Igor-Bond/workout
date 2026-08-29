/**
 * Второй язык (§53 ТЗ).
 *
 * Ключом словаря служит сам русский текст, а не выдуманное имя вроде
 * `home.newWorkout`. Причин две.
 *
 * Первая: в коде остаётся видно, что написано на экране. Имена ключей
 * приходится держать в голове или ходить за ними в словарь, и разметка,
 * набранная ими, читается как шифр.
 *
 * Вторая: русскому языку словарь не нужен вовсе — ключ и есть перевод.
 * Значит, ничего не может «потеряться при переводе на русский», а
 * недостающий английский перевод превращается в русскую строку на экране, а
 * не в пустоту или в имя ключа.
 *
 * Обратная сторона: правка русского текста молча рвёт связь с английским.
 * Поэтому есть проверка, которая рисует каждый экран по-английски и требует,
 * чтобы кириллицы в нём не осталось, — она и находит разошедшееся.
 */

import { config } from '../config.js';
import { EN } from '../i18n/en.js';

const DICTS = { en: EN };

/**
 * Языки, которые считаем русскоязычными.
 *
 * По умолчанию язык берётся у телефона, и правило выбрано так, чтобы
 * приложение, отданное за пределы русскоязычных стран, само оказывалось
 * английским: там русский точно не нужен, а английский — хоть какой-то
 * общий.
 */
const RU_LOCALES = ['ru', 'uk', 'be', 'kk', 'ky'];

export const LANGS = [
    { value: 'auto', label: 'Как в телефоне' },
    { value: 'ru',   label: 'Русский' },
    { value: 'en',   label: 'English' }
];

/** Текущий язык: 'ru' или 'en'. Хранится отдельно от настройки «авто». */
let current = 'ru';

function detect() {
    const raw = (typeof navigator !== 'undefined' && navigator.language) || 'ru';
    const short = String(raw).toLowerCase().split('-')[0];

    return RU_LOCALES.includes(short) ? 'ru' : 'en';
}

export const i18n = {

    LANGS,

    get lang() {
        return current;
    },

    /** Настройка как она есть: 'auto' | 'ru' | 'en'. */
    get setting() {
        return config.get('lang') || 'auto';
    },

    /** Определить язык по настройке. Вызывается при запуске и при смене. */
    apply() {
        const chosen = i18n.setting;
        current = chosen === 'auto' ? detect() : chosen;

        if (typeof document !== 'undefined') {
            document.documentElement.lang = current;
        }

        return current;
    },

    set(value) {
        config.set('lang', value);
        return i18n.apply();
    },

    /**
     * Перевод. Подстановки — {имя}: t('Ещё {n} тренировки', { n: 3 }).
     *
     * Отсутствующий перевод возвращает сам ключ, то есть русский текст.
     * Показать человеку чужой язык хуже, чем ничего не показать, но
     * показать имя ключа — хуже всего.
     */
    t(text, params = null) {
        const dict = DICTS[current];
        let out = (dict && dict[text]) || text;

        if (params) {
            for (const key of Object.keys(params)) {
                out = out.split(`{${key}}`).join(String(params[key]));
            }
        }

        return out;
    }
};

/** Короткое имя для разметки: экраны набраны им плотно. */
export const t = (text, params) => i18n.t(text, params);
