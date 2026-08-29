/**
 * Перехват диалогов для проверки перевода (§53).
 *
 * Проверка отрисовкой видит только разметку экрана. Диалог в неё не попадает
 * никогда: он открывается по действию, живёт в своём слое и ждёт ответа
 * человека. Ровно поэтому в нём и оставался русский текст, когда весь экран
 * вокруг был переведён.
 *
 * Здесь диалоги подменяются: вместо того чтобы показаться и ждать, они
 * записывают всё, что собирались показать, и немедленно отвечают отказом.
 * Отказ выбран намеренно — это единственный ответ, после которого ни одно
 * действие ничего не меняет в базе.
 */

import { dialog } from '../../js/core/dialog.js';

const CYRILLIC = /[А-Яа-яЁё]/;

/**
 * Собрать весь текст, который диалог показал бы человеку.
 *
 * Поля собираются вместе с подписями, подсказками и надписями в пустых
 * полях: забыть перевести подпись поля так же легко, как заголовок, а видна
 * она столько же времени.
 */
function textOf(options = {}) {
    const parts = [
        options.title, options.text,
        options.confirmText, options.cancelText, options.okText,
        options.createLabel, options.placeholder
    ];

    for (const field of options.fields || []) {
        parts.push(field.label, field.placeholder);
        for (const opt of field.options || []) parts.push(opt.label);
    }

    for (const item of options.options || []) parts.push(item.label, item.hint);
    for (const item of options.items || []) parts.push(item.label, item.hint);
    for (const group of options.groups || []) parts.push(group);

    return parts.filter((p) => typeof p === 'string' && p.trim());
}

/**
 * Выполнить действия, записав каждый открытый диалог.
 *
 * Возвращает список строк с кириллицей: пусто — значит, все окна, которые
 * успели открыться, переведены целиком.
 */
export async function watchDialogs(body) {
    const было = { alert: dialog.alert, confirm: dialog.confirm, form: dialog.form, pick: dialog.pick, choose: dialog.choose };
    const увидено = [];

    const записать = (kind, ответ) => (options = {}) => {
        for (const line of textOf(options)) {
            if (CYRILLIC.test(line)) увидено.push(`${kind}: ${line}`);
        }

        return Promise.resolve(ответ);
    };

    dialog.alert = записать('alert', true);
    dialog.confirm = записать('confirm', false);
    dialog.form = записать('form', null);
    dialog.pick = записать('pick', null);
    dialog.choose = записать('choose', null);

    try {
        await body();
    } finally {
        Object.assign(dialog, было);
    }

    return [...new Set(увидено)];
}
