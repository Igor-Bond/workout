/**
 * Подтверждения и выбор.
 *
 * Встроенные confirm() и alert() браузера блокируют поток, выглядят чужеродно
 * и на телефоне в установленном приложении показывают имя домена. Здесь свои,
 * с обещанием вместо возвращаемого значения.
 */

import { ui } from './ui.js';
import { t } from './i18n.js';

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

        /*
         * Куда вернуть фокус, когда окно закроется (Р-113).
         *
         * Раньше разметка просто стиралась, фокус падал на тело документа — и
         * дальше работало правило Р-78: страница не прокручивается сама,
         * прокручивается содержимое каркаса, а «пока фокус на теле документа,
         * Page Down и стрелки не делают ничего». Нажал «Отмена» в любом окне —
         * и клавиши молча перестали работать до первого касания мышью.
         */
        const откуда = document.activeElement;
        const каркас = document.querySelector('.shell');

        host.innerHTML = `<div class="dialog-backdrop">${innerHtml}</div>`;
        const backdrop = host.firstElementChild;

        /*
         * Страница под затемнением выключается на время жизни окна.
         *
         * Иначе Tab из окна уходит вглубь страницы, Enter заново нажимает ту
         * же кнопку под затемнением, и окно мигает, закрываясь и открываясь.
         */
        if (каркас) каркас.inert = true;

        const finish = (value) => {
            document.removeEventListener('keydown', onKey);
            if (каркас) каркас.inert = false;
            host.innerHTML = '';
            closeCurrent = null;

            const живой = откуда && откуда.isConnected && откуда !== document.body;
            (живой ? откуда : document.querySelector('.content'))?.focus?.({ preventScroll: true });

            resolve(value);
        };

        /** Всё, на что можно встать клавишей, внутри самого окна. */
        const доступные = () => [...backdrop.querySelectorAll(
            'button, [href], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])'
        )].filter((el) => !el.disabled && el.offsetParent !== null);

        const onKey = (e) => {
            if (e.key === 'Escape') return finish(defaultValue);
            if (e.key !== 'Tab') return;

            /*
             * Tab ходит по кругу внутри окна (Р-113): у `choose` и `pick` нет
             * главной кнопки, фокус оставался снаружи, и варианты с клавиатуры
             * были недостижимы вовсе — работал только отказ по Esc.
             */
            const список = доступные();
            if (!список.length) return;

            const первый = список[0];
            const последний = список[список.length - 1];

            if (!e.shiftKey && document.activeElement === последний) {
                e.preventDefault();
                первый.focus();
            } else if (e.shiftKey && document.activeElement === первый) {
                e.preventDefault();
                последний.focus();
            }
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

            /*
             * Другая дорога к тем же полям уносит с собой уже набранное.
             *
             * Кнопка «другой способ» закрывала окно, ничего из него не
             * забрав: человек описывал съеденное словами, жал «прикинуть» — и
             * описание пропадало, а окно открывалось заново пустым. Набирать
             * его второй раз на телефоне — плата не по адресу.
             *
             * Обязательные поля тут не проверяются: человек как раз и уходит
             * заполнять то, чего ещё нет.
             */
            if (collect && btn.hasAttribute('data-collect')) {
                return finish({ ...(collect(backdrop, { soft: true }) || {}), extra: raw });
            }

            finish(raw === 'true' ? true : raw === 'false' ? false : raw);
        });

        document.addEventListener('keydown', onKey);
        closeCurrent = finish;

        /*
         * Фокус на главной кнопке: с клавиатуры диалог закрывается пробелом.
         *
         * Главной кнопки нет у окон выбора — там нечего предлагать по
         * умолчанию, — и фокус оставался на кнопке, открывшей окно, за
         * затемнением. Тогда берём первое доступное внутри окна (Р-113).
         */
        (backdrop.querySelector('[data-primary]') || доступные()[0])?.focus();

        // Диалогам с живым поведением — поиском, проверкой на лету — нужен
        // доступ к своим узлам и возможность закрыться самим
        setup?.(backdrop, finish);
    });
}

export const dialog = {

    /** Сообщение с единственной кнопкой. */
    alert({ title, text, okText = t('Понятно') }) {
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

    /**
     * Ожидание: окно без кнопок, которое закроется само (§68).
     *
     * Нужно там, где приложение ушло спрашивать наружу. Окно с полями к
     * этому времени закрылось, ответа ещё нет, и человек остаётся перед
     * прежним экраном, не понимая, идёт ли что-нибудь вообще: нажал — и
     * ничего. Полоса сверху это не лечит, её попросту не видно с середины
     * длинного экрана.
     *
     * Кнопок нет намеренно: нажимать нечего, а «Отмена», которая ничего не
     * отменяет, хуже её отсутствия — запрос всё равно уйдёт и ответ всё
     * равно придёт. Закрывается окно само, когда на его место встаёт ответ:
     * следующее открытое окно закрывает предыдущее. Esc и нажатие мимо тоже
     * закрывают — на случай, если ждать раздумали.
     *
     * Точки мигают затем, что неподвижное окно через пять секунд неотличимо
     * от повисшего.
     */
    waiting({ title, text }) {
        return open(ui.html`
            <div class="dialog" role="alertdialog" aria-modal="true" aria-busy="true">
                <div class="dialog-title">${title}</div>
                ${text ? ui.raw(`<div class="dialog-text">${ui.esc(text)}</div>`) : ''}
                <div class="dialog-wait" aria-hidden="true"><span></span><span></span><span></span></div>
            </div>
        `, null);
    },

    /** Да или нет. danger красит подтверждение в цвет удаления. */
    confirm({ title, text, confirmText = t('Да'), cancelText = t('Отмена'), danger = false }) {
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
     *
     * extra — другой способ заполнить те же поля: не «сохранить» и не
     * «отмена». Подписью — одна кнопка, списком `[{ value, label }]` —
     * несколько. Возвращает набранное с отметкой `extra: <value>`: окно
     * закрылось, но человек не отказался — он выбрал другую дорогу к тому же
     * самому, и набранное по пути обязано с ним поехать.
     *
     * Нужно весам (§65): вес можно набрать руками, а можно снять с
     * устройства. И съеденному (§68), где дорог сразу три: число вписывают,
     * прикидывают по описанию из соседнего поля или по снимку — и это
     * равноправные способы одного и того же, а не главный и запасные.
     */
    form({ title, text, fields, confirmText = t('Сохранить'), cancelText = t('Отмена'), extra = null }) {
        const controls = fields.map((f) => {
            const id = `dlg-${f.name}`;

            const control = f.type === 'select'
                ? ui.html`
                    <select id="${id}" name="${f.name}">
                        ${f.options.map((o) => ui.html`
                            <option value="${o.value}" ${ui.raw(o.value === f.value ? 'selected' : '')}>${o.label}</option>
                        `)}
                    </select>`
                : f.type === 'file'
                ? ui.html`
                    <input id="${id}" name="${f.name}" type="file"
                           accept="${f.accept || 'image/*'}">`
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

        const collect = (backdrop, { soft = false } = {}) => {
            const values = {};

            /*
             * Незаполненное называется по имени (Р-115).
             *
             * Красная рамка не говорит, чего не хватает, а когда полей два —
             * приходится угадывать. Дальтонику она не говорит ничего.
             */
            const ругнуться = (el, f) => {
                el.focus();
                el.classList.add('is-invalid');
                el.setAttribute('aria-invalid', 'true');

                const поле = el.closest('.field');
                поле?.querySelector('.field-error')?.remove();

                const строка = document.createElement('div');
                строка.className = 'field-error';
                строка.textContent = t('Без этого не сохранить: {поле}', { поле: f.label });
                поле?.appendChild(строка);

                return null;
            };

            const простить = (el) => {
                el.classList.remove('is-invalid');
                el.removeAttribute('aria-invalid');
                el.closest('.field')?.querySelector('.field-error')?.remove();
            };

            for (const f of fields) {
                const el = backdrop.querySelector(`[name="${f.name}"]`);

                /*
                 * У снимка значения нет вовсе: `el.value` — это выдуманный
                 * путь вида C:\fakepath\..., придуманный браузерами ради
                 * тайны файловой системы. Нужен сам файл (§68).
                 */
                if (f.type === 'file') {
                    const файл = el.files?.[0] || null;

                    if (f.required && !файл && !soft) return ругнуться(el, f);

                    простить(el);
                    values[f.name] = файл;
                    continue;
                }

                const value = el.value.trim();

                if (f.required && !value && !soft) return ругнуться(el, f);

                простить(el);
                values[f.name] = f.type === 'number' ? Number(value) : value;
            }

            return values;
        };

        /*
         * Одна подпись — одна кнопка, список — сколько дали.
         *
         * Старое написание подписью строкой осталось рабочим: у весов дорога
         * вторая и единственная, и заворачивать её в список ради общности
         * значило бы усложнить то место, где сложности нет.
         */
        const дороги = Array.isArray(extra)
            ? extra.filter((д) => д && д.label)
            : extra ? [{ value: 'extra', label: extra }] : [];

        return open(ui.html`
            <div class="dialog" role="dialog" aria-modal="true">
                <div class="dialog-title">${title}</div>
                ${text ? ui.raw(`<div class="dialog-text">${ui.esc(text)}</div>`) : ''}
                ${controls}
                ${дороги.length ? ui.html`
                    <div class="dialog-extra">
                        ${дороги.map((д) => ui.html`
                            <button class="btn btn-ghost btn-sm" data-value="${д.value}" data-collect>${д.label}</button>
                        `)}
                    </div>
                ` : ''}
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
    pick({ title, text, items, groups = [], placeholder = t('Поиск'), createLabel = null, cancelText = t('Отмена') }) {
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
                    : String(ui.empty(t('Ничего не найдено')));

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

            /*
             * Клавиатуру сами не вызываем.
             *
             * На компьютере фокус в поиске — удобство: можно сразу набирать.
             * На телефоне он поднимает экранную клавиатуру, а она занимает
             * половину экрана и закрывает и список, и кнопки — то есть
             * мешает ровно тому, ради чего окно открыли. Кому нужен поиск,
             * тот нажмёт на поле сам.
             */
            if (matchMedia('(pointer: fine)').matches) search.focus();
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
    choose({ title, text, options, cancelText = t('Отмена') }) {
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
