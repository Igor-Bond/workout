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

import { home } from './modules/home.js';
import { templates } from './modules/templates.js';
import { plan } from './modules/plan.js';
import { session } from './modules/session.js';
import { summary } from './modules/summary.js';
import { history } from './modules/history.js';
import { calendar } from './modules/calendar.js';
import { stats } from './modules/stats.js';
import { exercise } from './modules/exercise.js';
import { exercises } from './modules/exercises.js';
import { recordsScreen } from './modules/records.js';
import { profile } from './modules/profile.js';

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
            history, calendar, stats, exercise, exercises,
            records: recordsScreen,
            profile
        };
    }

    return SCREENS;
}

const DEFAULT_SCREEN = 'home';

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

        host.innerHTML = '<div class="loading">Загрузка…</div>';

        try {
            host.innerHTML = await screen.render(route.params);
        } catch (e) {
            console.error(`[Экран] Ошибка отрисовки «${route.name}»:`, e);
            host.innerHTML = ui.html`
                <div class="card">
                    <div class="empty-note">Не удалось открыть раздел. Подробности в консоли.</div>
                </div>
            `;
        }

        current = { ...route, screen };

        app.syncNav(screen.nav || route.name);
        document.title = screen.title ? `${screen.title} · Трекер` : 'Трекер тренировок';

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
            <span>Доступна новая версия</span>
            <button class="banner-btn" data-action="reload">Обновить</button>
        `);
    },

    /** Предложение установить приложение. Показывается, пока доступно. */
    renderInstallBanner() {
        if (install.available && !install.installed) {
            app.showBanner('install', ui.html`
                <span>Установить приложение на главный экран</span>
                <button class="banner-btn" data-action="install">Установить</button>
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

    init() {
        window.addEventListener('hashchange', () => app.render());
        install.onChange(() => app.renderInstallBanner());

        app.renderInstallBanner();
        app.render();
    }
};
