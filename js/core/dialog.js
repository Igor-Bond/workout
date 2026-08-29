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
function open(innerHtml, defaultValue, { collect = null, setup = null } = {}) {
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

            // Диалог с полями: значения собираются перед закрытием, а
            // возврат null означает «не прошло проверку, окно не закрывать»
            if (collect && btn.hasAttribute('data-submit')) {
                const collected = collect(backdrop);
                if (collected === null) return;
                return finish(collected);
            }

            finish(raw === 'true' ? true : raw === 'false' ? false : raw);
        });

        document.addEventListener('keydown', onKey);
        closeCurrent = finish;

        // Фокус на главной кнопке: с клавиатуры диалог закрывается пробелом
        backdrop.querySelector('[data-primary]')?.focus();

        // Диалогам с живым поведением — поиском, проверкой на лету — нужен
        // доступ к своим узлам и возможность закрыться самим
        setup?.(backdrop, finish);
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
     * Диалог с полями ввода.
     *
     * fields — [{ name, label, type: 'text' | 'number' | 'select', value,
     *             options: [{value, label}], required, placeholder }].
     * Возвращает объект со значениями или null, если пользователь отказался.
     * Обязательное пустое поле подсвечивается, и диалог не закрывается.
     */
    form({ title, text, fields, confirmText = 'Сохранить', cancelText = 'Отмена' }) {
        const controls = fields.map((f) => {
            const id = `dlg-${f.name}`;

            const control = f.type === 'select'
                ? ui.html`
                    <select id="${id}" name="${f.name}">
                        ${f.options.map((o) => ui.html`
                            <option value="${o.value}" ${ui.raw(o.value === f.value ? 'selected' : '')}>${o.label}</option>
                        `)}
                    </select>`
                : f.type === 'textarea'
                ? ui.html`
                    <textarea id="${id}" name="${f.name}" rows="${f.rows || 4}"
                              placeholder="${f.placeholder || ''}">${f.value ?? ''}</textarea>`
                : ui.html`
                    <input id="${id}" name="${f.name}" type="${f.type || 'text'}"
                           value="${f.value ?? ''}" placeholder="${f.placeholder || ''}"
                           autocomplete="off">`;

            return ui.html`
                <div class="field">
                    <label for="${id}">${f.label}</label>
                    ${ui.raw(control)}
                </div>
            `;
        });

        const collect = (backdrop) => {
            const values = {};

            for (const f of fields) {
                const el = backdrop.querySelector(`[name="${f.name}"]`);
                const value = el.value.trim();

                if (f.required && !value) {
                    el.focus();
                    el.classList.add('is-invalid');
                    return null;
                }

                el.classList.remove('is-invalid');
                values[f.name] = f.type === 'number' ? Number(value) : value;
            }

            return values;
        };

        return open(ui.html`
            <div class="dialog" role="dialog" aria-modal="true">
                <div class="dialog-title">${title}</div>
                ${text ? ui.raw(`<div class="dialog-text">${ui.esc(text)}</div>`) : ''}
                ${controls}
                <div class="dialog-actions">
                    <button class="btn btn-ghost" data-value="">${cancelText}</button>
                    <button class="btn btn-accent" data-value="ok" data-submit data-primary>${confirmText}</button>
                </div>
            </div>
        `, null, { collect });
    },

    /**
     * Выбор из длинного списка с поиском.
     *
     * Справочник упражнений — три десятка позиций и растёт: без поиска выбор
     * превращается в прокрутку. Возвращает value выбранного, либо
     * { create: 'название' }, если разрешено создание и ничего не подошло.
     */
    /**
     * Выбор из списка с поиском и отбором по группам.
     *
     * groups — значения item.group, которые предлагаются чипами. Список из
     * сорока пяти упражнений искать по одному только названию тяжело:
     * названия надо помнить, а группу — нет, её выбирают взглядом.
     */
    pick({ title, text, items, groups = [], placeholder = 'Поиск', createLabel = null, cancelText = 'Отмена' }) {
        const option = (item) => ui.html`
            <button class="dialog-option" data-value="${item.value}">
                <span class="dialog-option-label">${item.label}</span>
                ${item.hint ? ui.raw(`<span class="dialog-option-hint">${ui.esc(item.hint)}</span>`) : ''}
            </button>
        `;

        const setup = (backdrop, finish) => {
            const search = backdrop.querySelector('.dialog-search');
            const list = backdrop.querySelector('.dialog-options');
            const create = backdrop.querySelector('[data-create]');
            const chips = [...backdrop.querySelectorAll('[data-group]')];

            let group = '';

            const refresh = () => {
                const query = search.value.trim().toLowerCase();

                const matched = items.filter((i) =>
                    (!group || i.group === group)
                    && (!query || i.label.toLowerCase().includes(query)));

                list.innerHTML = matched.length
                    ? String(ui.html`${matched.map(option)}`)
                    : '<div class="empty-note">Ничего не найдено</div>';

                // Создание предлагается только когда введено что-то своё:
                // пустая кнопка «создать» посреди списка сбивает с толку
                if (create) {
                    create.hidden = !query;
                    create.textContent = `${createLabel}: «${search.value.trim()}»`;
                }
            };

            search.addEventListener('input', refresh);
            create?.addEventListener('click', () => finish({ create: search.value.trim() }));

            // Повторное нажатие на выбранную группу снимает отбор: иначе к
            // полному списку не вернуться, не закрыв окно
            for (const chip of chips) {
                chip.addEventListener('click', () => {
                    group = chip.dataset.group === group ? '' : chip.dataset.group;

                    for (const c of chips) c.classList.toggle('is-active', c.dataset.group === group);
                    refresh();
                });
            }

            refresh();
            search.focus();
        };

        return open(ui.html`
            <div class="dialog dialog-tall" role="dialog" aria-modal="true">
                <div class="dialog-title">${title}</div>
                ${text ? ui.raw(`<div class="dialog-text">${ui.esc(text)}</div>`) : ''}

                ${groups.length ? ui.html`
                    <div class="chips dialog-groups">
                        ${groups.map((g) => ui.html`
                            <button class="chip" data-group="${g}">${g}</button>
                        `)}
                    </div>
                ` : ''}

                <input class="dialog-search" type="text" placeholder="${placeholder}" autocomplete="off">
                <div class="dialog-options"></div>
                ${createLabel ? ui.raw('<button class="btn btn-ghost" data-create hidden></button>') : ''}
                <div class="dialog-actions">
                    <button class="btn btn-ghost" data-value="">${cancelText}</button>
                </div>
            </div>
        `, null, { setup });
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
