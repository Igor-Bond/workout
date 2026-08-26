/**
 * Подтверждения и выбор.
 *
 * Встроенные confirm() и alert() браузера блокируют поток, выглядят чужеродно
 * и на телефоне в установленном приложении показывают имя домена. Здесь свои,
 * с обещанием вместо возвращаемого значения.
 */

import { ui } from './ui.js';

let root = null;
let closeCurrent = null;

function ensureRoot() {
    if (!root) root = document.getElementById('dialog-root');
    return root;
}

/**
 * Общий каркас. onResolve вызывается со значением, выбранным пользователем;
 * закрытие по фону, крестику или Esc даёт значение по умолчанию.
 */
function open(innerHtml, defaultValue) {
    return new Promise((resolve) => {
        const host = ensureRoot();

        // Второй диалог поверх первого — почти всегда ошибка в коде.
        // Закрываем предыдущий, чтобы не остаться с двумя затемнениями.
        if (closeCurrent) closeCurrent(defaultValue);

        host.innerHTML = `<div class="dialog-backdrop">${innerHtml}</div>`;
        const backdrop = host.firstElementChild;

        const finish = (value) => {
            document.removeEventListener('keydown', onKey);
            host.innerHTML = '';
            closeCurrent = null;
            resolve(value);
        };

        const onKey = (e) => {
            if (e.key === 'Escape') finish(defaultValue);
        };

        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) return finish(defaultValue);

            const btn = e.target.closest('[data-value]');
            if (!btn) return;

            const raw = btn.getAttribute('data-value');
            if (raw === '') return finish(defaultValue);   // кнопка отмены
            finish(raw === 'true' ? true : raw === 'false' ? false : raw);
        });

        document.addEventListener('keydown', onKey);
        closeCurrent = finish;

        // Фокус на главной кнопке: с клавиатуры диалог закрывается пробелом
        backdrop.querySelector('[data-primary]')?.focus();
    });
}

export const dialog = {

    /** Сообщение с единственной кнопкой. */
    alert({ title, text, okText = 'Понятно' }) {
        return open(ui.html`
            <div class="dialog" role="alertdialog" aria-modal="true">
                <div class="dialog-title">${title}</div>
                ${text ? ui.raw(`<div class="dialog-text">${ui.esc(text)}</div>`) : ''}
                <div class="dialog-actions">
                    <button class="btn btn-accent" data-value="true" data-primary>${okText}</button>
                </div>
            </div>
        `, true);
    },

    /** Да или нет. danger красит подтверждение в цвет удаления. */
    confirm({ title, text, confirmText = 'Да', cancelText = 'Отмена', danger = false }) {
        return open(ui.html`
            <div class="dialog" role="alertdialog" aria-modal="true">
                <div class="dialog-title">${title}</div>
                ${text ? ui.raw(`<div class="dialog-text">${ui.esc(text)}</div>`) : ''}
                <div class="dialog-actions">
                    <button class="btn btn-ghost" data-value="false">${cancelText}</button>
                    <button class="btn ${danger ? 'btn-danger-solid' : 'btn-accent'}"
                            data-value="true" data-primary>${confirmText}</button>
                </div>
            </div>
        `, false);
    },

    /**
     * Выбор из нескольких вариантов.
     * options — [{ value, label, hint, danger }]. Отмена даёт null.
     */
    choose({ title, text, options, cancelText = 'Отмена' }) {
        const list = options.map((o) => ui.html`
            <button class="dialog-option ${o.danger ? 'is-danger' : ''}" data-value="${o.value}">
                <span class="dialog-option-label">${o.label}</span>
                ${o.hint ? ui.raw(`<span class="dialog-option-hint">${ui.esc(o.hint)}</span>`) : ''}
            </button>
        `);

        return open(ui.html`
            <div class="dialog" role="dialog" aria-modal="true">
                <div class="dialog-title">${title}</div>
                ${text ? ui.raw(`<div class="dialog-text">${ui.esc(text)}</div>`) : ''}
                <div class="dialog-options">${list}</div>
                <div class="dialog-actions">
                    <button class="btn btn-ghost" data-value="">${cancelText}</button>
                </div>
            </div>
        `, null);
    }
};
