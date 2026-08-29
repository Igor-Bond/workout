/**
 * Помощник для проверки полноты перевода (§53).
 *
 * Мера простая и грубая: если экран нарисован на втором языке, кириллицы в
 * нём остаться не должно. Грубость тут достоинство — судить о полноте по
 * списку ключей нельзя, потому что забытая строка в ключи и не попадает.
 *
 * Данные пользователя из-под проверки выведены не хитростью, а условиями:
 * проверочная база засеивается латиницей, и всё, что осталось кириллицей, —
 * это интерфейс.
 */

import { i18n } from '../../js/core/i18n.js';
import { text } from './dom.js';

const CYRILLIC = /[А-Яа-яЁё]/;

/** Языки, на которые приложение переводится. Русский — источник, не перевод. */
export const TARGETS = ['en', 'de'];

/**
 * Нарисовать экран на заданном языке.
 *
 * Язык возвращается на место в любом случае: проверка, оставившая
 * приложение на чужом языке, ломает все следующие за ней.
 */
export async function inLang(lang, body) {
    const было = i18n.setting;

    try {
        i18n.set(lang);
        return await body();
    } finally {
        i18n.set(было);
    }
}

/**
 * Что осталось непереведённым: куски текста с кириллицей.
 *
 * Возвращает отдельные слова и фразы, а не весь текст экрана: по списку
 * сразу видно, что именно искать в исходнике.
 */
export function leftovers(node) {
    const out = [];

    const walk = (el) => {
        for (const child of el.childNodes) {
            if (child.nodeType === 3) {
                const value = child.textContent.replace(/\s+/g, ' ').trim();
                if (value && CYRILLIC.test(value)) out.push(value);
                continue;
            }

            if (child.nodeType !== 1) continue;

            // Подписи полей и подсказки не видны в тексте узла, но видны
            // человеку — забыть их легче всего
            for (const attr of ['placeholder', 'title', 'aria-label', 'value']) {
                const value = child.getAttribute?.(attr);
                if (value && CYRILLIC.test(value)) out.push(`[${attr}] ${value}`);
            }

            walk(child);
        }
    };

    walk(node);
    return [...new Set(out)];
}

/** Весь текст экрана — для сообщений об ошибке. */
export const screenText = text;
