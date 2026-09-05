/**
 * Экраны, маршрутизация и полосы уведомлений.
 *
 * Маршрут живёт в адресной строке после решётки: #/history/abc. Так работает
 * кнопка «назад» браузера, так переживает перезагрузку открытая карточка, и
 * так приложение остаётся набором статических файлов — без серверных правил
 * переписывания путей, которых на GitHub Pages нет.
 */

import { ui } from './core/ui.js';
import { install } from './core/install.js';
import { i18n, t } from './core/i18n.js';

import { home } from './modules/home.js';
import { templates } from './modules/templates.js';
import { plan } from './modules/plan.js';
import { session } from './modules/session.js';
import { intervalScreen } from './modules/interval.js';
import { summary } from './modules/summary.js';
import { history } from './modules/history.js';
import { calendar } from './modules/calendar.js';
import { stats } from './modules/stats.js';
import { exercise } from './modules/exercise.js';
import { exercises } from './modules/exercises.js';
import { shares } from './modules/shares.js';
import { planner } from './modules/planner.js';
import { report } from './modules/report.js';
import { recordsScreen } from './modules/records.js';
import { profile } from './modules/profile.js';
import { guide } from './modules/guide.js';
import { surveyScreen } from './modules/survey.js';

/**
 * Список экранов собирается при первом обращении, а не при загрузке модуля.
 *
 * Здесь круговая зависимость: app.js импортирует экраны, а каждый экран
 * импортирует app.js ради перехода и перерисовки. Модули ES такое допускают,
 * но пока модуль не доисполнен, его переменные недоступны.
 *
 * Пока приложение запускается через main.js, первым исполняется app.js, и
 * порядок сходится. Стоит же импортировать любой экран первым — как это
 * делают проверки, — и сборка списка прямо в теле модуля падает с
 * «Cannot access 'home' before initialization», причём падает весь запуск.
 *
 * Отложенная сборка снимает зависимость от порядка: к первому render() все
 * модули уже исполнены.
 */
let SCREENS = null;

function screens() {
    if (!SCREENS) {
        SCREENS = {
            home, templates, plan, session, summary,
            interval: intervalScreen,
            history, calendar, stats, exercise, exercises, shares, report,
            planner,
            records: recordsScreen,
            profile, guide,
            survey: surveyScreen
        };
    }

    return SCREENS;
}

const DEFAULT_SCREEN = 'home';

/**
 * Через сколько показывать «Загрузка…» при переходе (Р-59).
 *
 * Двести миллисекунд — граница, за которой ожидание перестаёт читаться как
 * мгновенное. Всё, что быстрее, заглушка только портит: она успевает
 * мелькнуть и исчезнуть, и переход выглядит вспышкой, а не переходом.
 */
const PLACEHOLDER_DELAY = 200;

let current = null;

/** Разбор адреса: #/exercise/abc → { name: 'exercise', params: ['abc'] } */
function parseRoute() {
    const raw = location.hash.replace(/^#\/?/, '');
    const parts = raw.split('/').filter(Boolean).map(decodeURIComponent);
    const name = parts.shift() || DEFAULT_SCREEN;

    return screens()[name]
        ? { name, params: parts }
        : { name: DEFAULT_SCREEN, params: [] };
}

export const app = {

    /** Текущий экран: { name, params }. */
    get route() {
        return current;
    },

    /** Переход: app.go('exercise', id). */
    go(name, ...params) {
        const path = [name, ...params.map(encodeURIComponent)].join('/');
        const next = `#/${path}`;

        // Повторный переход на тот же адрес события не вызывает —
        // перерисовываем вручную, иначе кнопка «обновить» на экране мертва
        if (location.hash === next) return app.render();
        location.hash = next;
    },

    async render() {
        const route = parseRoute();
        const screen = screens()[route.name];
        const host = document.getElementById('screen');

        /*
         * Переход на другой экран начинается сверху, перерисовка на месте —
         * с того места, где пользователь стоял.
         *
         * Разница существенная: render() вызывается после каждого действия —
         * записи подхода, архивации упражнения, показа следующей страницы
         * истории. Без этой проверки каждое такое действие выбрасывало бы
         * наверх, и до нужной строки приходилось бы доскролливать заново.
         */
        const navigated = !current
            || current.name !== route.name
            || current.params.join('/') !== route.params.join('/');

        const scroll = navigated ? 0 : document.scrollingElement.scrollTop;

        current?.screen?.unmount?.();

        // Уход с экрана — не то же, что перерисовка: unmount вызывается перед
        // каждой, а leave только когда экран правда покидают. Отсчёт подхода
        // (§57) держится на этой разнице
        if (navigated) current?.screen?.leave?.();

        /*
         * «Загрузка…» — только при переходе на другой экран, и не сразу
         * (Р-47, Р-59).
         *
         * Перерисовка того же экрана случается часто и по мелким поводам:
         * записан подход, сменился полноэкранный режим, обновилась полоса.
         * Стирать ради этого содержимое значит мигать — поэтому на месте
         * старая разметка держится до готовности новой.
         *
         * При переходе заглушка честнее: там и правда пока нечего
         * показывать. Но выставленная тотчас, она мелькала на быстрых
         * переходах: итоги тренировки готовятся полсотни миллисекунд, и
         * человек видел не переход, а вспышку между двумя экранами.
         *
         * Отсюда задержка. Успел экран отрисоваться раньше — заглушки не
         * будет вовсе; не успел — она появится и честно скажет, что идёт
         * загрузка. Порог заодно и есть определение «долго».
         */
        let ожидание = 0;

        if (navigated) {
            ожидание = setTimeout(() => {
                host.innerHTML = ui.html`<div class="loading">${i18n.t('Загрузка…')}</div>`;
            }, PLACEHOLDER_DELAY);
        }

        try {
            const разметка = await screen.render(route.params);

            // Гасим заглушку до подстановки, а не после: между двумя
            // соседними строками таймеру не вклиниться
            clearTimeout(ожидание);
            host.innerHTML = разметка;
        } catch (e) {
            clearTimeout(ожидание);
            console.error(`[Экран] Ошибка отрисовки «${route.name}»:`, e);
            host.innerHTML = ui.html`
                <div class="card">
                    <div class="empty-note">${i18n.t('Не удалось открыть раздел. Подробности в консоли.')}</div>
                </div>
            `;
        }

        current = { ...route, screen };

        // Меню живёт вне экрана и само по себе не перерисовывается. Переводить
        // его в одном лишь обработчике смены языка — значит забыть про любой
        // другой способ языку смениться
        app.translateStatic();

        app.syncNav(screen.nav || route.name);
        document.title = screen.title
            ? `${i18n.t(screen.title)} · ${i18n.t('Трекер')}`
            : i18n.t('Трекер тренировок');

        // Возвращать прокрутку надо после вставки разметки: до неё высота
        // страницы ещё прежняя, и браузер обрежет значение по ней
        document.scrollingElement.scrollTop = scroll;

        screen.mount?.(route.params);
    },

    /** Подсветка активного раздела в меню. */
    syncNav(section) {
        document.querySelectorAll('[data-nav]').forEach((btn) => {
            btn.classList.toggle('is-active', btn.dataset.nav === section);
            btn.setAttribute('aria-current', btn.dataset.nav === section ? 'page' : 'false');
        });
    },

    // ================== ПОЛОСЫ УВЕДОМЛЕНИЙ ==================

    /**
     * Новая версия уже скачана и ждёт перезагрузки. Сама не применяется:
     * перезагрузка посреди записанного подхода стоит дороже, чем задержка
     * обновления на несколько минут.
     */
    showUpdateBanner() {
        app.showBanner('update', ui.html`
            <span>${t('Доступна новая версия')}</span>
            <button class="banner-btn" data-action="reload">${t('Обновить')}</button>
        `);
    },

    /** Предложение установить приложение. Показывается, пока доступно. */
    renderInstallBanner() {
        if (install.available && !install.installed) {
            app.showBanner('install', ui.html`
                <span>${t('Установить приложение на главный экран')}</span>
                <button class="banner-btn" data-action="install">${t('Установить')}</button>
            `);
        } else {
            app.hideBanner('install');
        }
    },

    showBanner(id, innerHtml) {
        const host = document.getElementById('banners');
        if (host.querySelector(`[data-banner="${id}"]`)) return;

        const el = document.createElement('div');
        el.className = 'banner';
        el.dataset.banner = id;
        el.innerHTML = innerHtml;
        host.appendChild(el);
    },

    hideBanner(id) {
        document.querySelector(`[data-banner="${id}"]`)?.remove();
    },

    /**
     * Перевод разметки, набранной прямо в index.html (§53).
     *
     * Меню и надпись «Загрузка…» существуют до первой отрисовки — их не
     * через что пропустить. Помеченные `data-t` узлы переводятся на месте:
     * в разметке остаётся русский, а не имя ключа, и без JavaScript экран
     * читается по-русски, а не пустотой.
     */
    translateStatic() {
        document.querySelectorAll('[data-t]').forEach((el) => {
            const source = el.dataset.tSource || el.textContent.trim();

            el.dataset.tSource = source;
            el.textContent = i18n.t(source);
        });
    },

    init() {
        app.translateStatic();

        window.addEventListener('hashchange', () => app.render());
        install.onChange(() => app.renderInstallBanner());

        app.renderInstallBanner();
        app.render();
    }
};
