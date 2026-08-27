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
import { wakeLock } from './core/wakelock.js';
import { ui } from './core/ui.js';
import { dialog } from './core/dialog.js';
import { dbService } from './services/db.js';
import { migrations } from './services/migrations.js';
import { sync } from './services/sync.js';
import { format } from './core/format.js';

// ================== ОБЩИЕ ДЕЙСТВИЯ ==================

actions.on('nav', (el) => app.go(el.dataset.screen));

actions.on('install', async () => {
    await install.prompt();
    app.renderInstallBanner();
});

actions.on('reload', () => location.reload());

actions.on('dismiss-banner', (el) => app.hideBanner(el.dataset.banner));

/**
 * Упавшее действие обязано быть видно.
 *
 * Молча потерянный подход — худшее, что может сделать журнал тренировок:
 * пользователь решит, что промахнулся по кнопке, и запишет его ещё раз или
 * не запишет вовсе.
 */
actions.onError((error) => {
    dialog.alert({
        title: 'Не удалось выполнить действие',
        text: `${error?.message || error}\n\nЕсли это повторяется — проверьте, есть ли место на устройстве и не открыто ли приложение в другой вкладке.`
    });
});

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

    /*
     * Просьба проверить запас для офлайна.
     *
     * Кэш собирается при установке воркера, а установка запускается только
     * при изменении его файла. Содержимое же браузер может вытеснить когда
     * угодно — при нехватке места или чистке данных сайта. После этого
     * офлайн молча отказывает и сам не чинится: файл воркера прежний,
     * устанавливать нечего.
     */
    navigator.serviceWorker.ready.then((reg) => {
        reg.active?.postMessage({ type: 'verify-precache' });
    });

    navigator.serviceWorker.addEventListener('message', (e) => {
        if (e.data?.type === 'precache-restored') {
            console.log(`[PWA] Запас для офлайна восстановлен: было ${e.data.have}, стало ${e.data.restored}`);
        }
    });
}

// ================== СТАРТ ==================

/**
 * База открывается до первой отрисовки: экраны читают её прямо в render(),
 * и рисовать их раньше означало бы показать пустоту, а через миг заменить
 * её данными.
 *
 * Приватный режим и запрет на хранилище — не выдуманный случай: там
 * IndexedDB просто нет. Приложение в этом случае обязано открыться и
 * объяснить, что происходит, а не остаться на надписи «Загрузка».
 */
async function boot() {
    install.init();

    // До первой отрисовки: иначе меню встанет по неверной высоте экрана
    viewport.init();

    // Система снимает удержание экрана при сворачивании — подписка
    // возвращает его, когда вкладку показывают снова
    wakeLock.init();

    actions.init();

    try {
        await dbService.open();

        const imported = await migrations.runV1Import(dbService);

        if (imported) {
            app.showBanner('import', ui.html`
                <span>Перенесено из прошлой версии:
                    ${format.count(imported.workouts, format.WORDS.workout)},
                    ${format.count(imported.sets, format.WORDS.set)}</span>
                <button class="banner-btn" data-action="dismiss-banner" data-banner="import">Понятно</button>
            `);
        }
    } catch (e) {
        console.error('[База] Не удалось открыть хранилище:', e);

        app.showBanner('db-error', ui.html`
            <span>Нет доступа к хранилищу браузера. Записи не сохранятся — проверьте, не открыто ли приватное окно.</span>
        `);
    }

    app.init();

    // Обмен с облаком — после первой отрисовки и молча: он не должен
    // задерживать запуск, а без входа его вообще не будет (§39)
    sync.run({ silent: true }).catch(() => {});

    purgeOldTombstones().catch((e) => console.warn('[База] Очистка не удалась:', e));
}

/**
 * Уборка надгробий от давно удалённых записей (§36).
 *
 * Мягкое удаление оставляет запись с отметкой deletedAt, чтобы стирание
 * доехало до других устройств. Через 90 дней надгробие уже никому не нужно.
 *
 * Но убрать его можно только после того, как удаление уехало в облако:
 * иначе на втором устройстве запись жива, и при следующем обмене она
 * вернётся — то есть удаление отменится само. Поэтому при включённой
 * синхронизации граница не может быть новее последнего успешного обмена,
 * а до первого обмена уборка не делается вовсе.
 */
async function purgeOldTombstones() {
    const DAY = 86400000;

    // Раз в сутки: перебирать таблицы при каждом запуске незачем
    const lastRun = Number(await dbService.getSetting('lastPurgeAt', 0));
    if (Date.now() - lastRun < DAY) return;

    const ninetyDays = Date.now() - 90 * DAY;
    const before = sync.available ? Math.min(ninetyDays, sync.getLastSync()) : ninetyDays;

    const removed = await dbService.purgeDeleted({ before });
    await dbService.setSetting('lastPurgeAt', Date.now());

    const total = Object.values(removed).reduce((sum, n) => sum + n, 0);
    if (total > 0) console.log('[База] Убрано давно удалённых записей:', removed);
}

boot();

/**
 * Синхронизация при уходе со страницы (§39).
 *
 * Переключение приложения на телефоне — самый частый момент «ухода», его и
 * ловим: без этого записанное за тренировку доехало бы до второго устройства
 * только при следующем запуске.
 */
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') return;
    if (!sync.available || sync.inProgress) return;

    sync.run({ silent: true }).catch(() => {});
});

window.addEventListener('load', registerServiceWorker);
