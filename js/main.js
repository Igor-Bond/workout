/**
 * Точка входа приложения.
 *
 * Версия 1 держалась на одном файле и порядке тегов <script>. Здесь
 * зависимости объявлены через import, а браузер сам разбирается с порядком
 * загрузки. Inline-обработчики onclick не используются — вместо них
 * делегирование по data-action, поэтому выкладывать модули в window не нужно.
 */

import { app } from './app.js';
import { actions } from './core/actions.js';
import { viewport } from './core/viewport.js';
import { install } from './core/install.js';

// ================== ОБЩИЕ ДЕЙСТВИЯ ==================

actions.on('nav', (el) => app.go(el.dataset.screen));

actions.on('install', async () => {
    await install.prompt();
    app.renderInstallBanner();
});

actions.on('reload', () => location.reload());

// ================== СЕРВИС-ВОРКЕР ==================

/**
 * Обновление не применяется само: перезагрузка посреди записанного подхода
 * стоит дороже, чем задержка обновления. Пользователь нажимает «Обновить»
 * в полосе уведомления, и только тогда новая версия берёт управление.
 */
function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    // Была ли страница под управлением воркера до этой загрузки. Без этой
    // проверки самая первая установка вызвала бы лишнюю перезагрузку.
    const hadController = !!navigator.serviceWorker.controller;

    navigator.serviceWorker.register('sw.js')
        .then((reg) => {
            reg.addEventListener('updatefound', () => {
                const sw = reg.installing;
                if (!sw) return;

                sw.addEventListener('statechange', () => {
                    if (sw.state === 'installed' && navigator.serviceWorker.controller) {
                        app.showUpdateBanner();
                    }
                });
            });
        })
        .catch((e) => console.error('[PWA] Не удалось зарегистрировать сервис-воркер:', e));

    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController || reloading) return;
        reloading = true;
        location.reload();
    });
}

// ================== СТАРТ ==================

install.init();

// До первой отрисовки: иначе меню встанет по неверной высоте экрана
viewport.init();

actions.init();
app.init();

window.addEventListener('load', registerServiceWorker);
