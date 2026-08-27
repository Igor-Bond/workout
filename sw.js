/**
 * Трекер тренировок — сервис-воркер (§42 ТЗ).
 *
 * Стратегии:
 *   - переходы по страницам (HTML) → сначала сеть, при неудаче кэш index.html
 *   - код приложения (js, css)     → сначала сеть, чтобы правки доезжали сразу
 *   - иконки и vendor              → сначала кэш, меняются вместе с версией
 *   - запросы к серверам Firebase  → не перехватываются вообще
 *
 * Firebase SDK лежит в vendor и кэшируется при первом обращении, но в
 * предварительный кэш не входит: почти мегабайт, нужный только тем, кто
 * вошёл в учётную запись. Кто работает локально, его не скачивает вовсе.
 *
 * У «сначала сеть» есть таймаут: без него запуск на плохой мобильной связи
 * ждал бы ответа до срабатывания таймаута самого браузера, хотя рабочая копия
 * лежит в кэше. Через NETWORK_TIMEOUT берём кэш и не заставляем ждать.
 *
 * ВАЖНО: при изменении состава файлов или стратегий поднимать APP_VERSION,
 * иначе у пользователей останется старый кэш.
 */

const APP_VERSION = 'v12';
const CACHE_NAME = `workout-${APP_VERSION}`;

const NETWORK_TIMEOUT = 3000;

const PRECACHE_URLS = [
    './',
    'index.html',
    'manifest.json',
    'css/style.css',

    'assets/icon-192.png',
    'assets/icon-512.png',
    'assets/icon-maskable-192.png',
    'assets/icon-maskable-512.png',

    'js/main.js',
    'js/app.js',
    'js/config.js',
    'js/version.js',

    'js/core/actions.js',
    'js/core/dates.js',
    'js/core/dialog.js',
    'js/core/format.js',
    'js/core/merge.js',
    'js/core/engine.js',
    'js/core/install.js',
    'js/core/chart.js',
    'js/core/records.js',
    'js/core/rhythm.js',
    'js/core/stats.js',
    'js/core/timer.js',
    'js/core/ui.js',
    'js/core/viewport.js',
    'js/core/wakelock.js',

    'js/services/db.js',
    'js/services/migrations.js',
    'js/services/auth.js',
    'js/services/sync.js',
    'js/services/backup.js',
    'js/firebase.config.js',

    'vendor/dexie.min.js',

    'js/modules/calendar.js',
    'js/modules/exercise.js',
    'js/modules/exercises.js',
    'js/modules/history.js',
    'js/modules/home.js',
    'js/modules/plan.js',
    'js/modules/profile.js',
    'js/modules/records.js',
    'js/modules/session.js',
    'js/modules/stats.js',
    'js/modules/summary.js',
    'js/modules/templates.js'
];

// ================== УСТАНОВКА ==================

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            // Поштучно, а не addAll: тот падает целиком из-за одного файла,
            // и тогда офлайн не работает вообще ничего
            .then((cache) => Promise.all(
                PRECACHE_URLS.map((url) => cache.add(url).catch((e) => {
                    console.warn('[SW] Не удалось закэшировать', url, e);
                }))
            ))
            .then(() => self.skipWaiting())
    );
});

// ================== АКТИВАЦИЯ ==================

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

// ================== СТРАТЕГИИ ==================

async function networkFirst(request, fallbackUrl) {
    const cache = await caches.open(CACHE_NAME);

    try {
        const response = await Promise.race([
            fetch(request),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT))
        ]);

        if (response && response.ok) cache.put(request, response.clone());
        return response;
    } catch {
        const cached = await cache.match(request)
            || (fallbackUrl ? await cache.match(fallbackUrl) : null);

        if (cached) return cached;

        return new Response('Нет соединения и нет сохранённой копии', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    }
}

async function cacheFirst(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
}

// ================== ПЕРЕХВАТ ==================

self.addEventListener('fetch', (event) => {
    const { request } = event;

    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Чужие домены не наше дело: Firebase, шрифты и всё остальное
    if (url.origin !== self.location.origin) return;

    if (request.mode === 'navigate') {
        event.respondWith(networkFirst(request, 'index.html'));
        return;
    }

    if (url.pathname.includes('/js/') || url.pathname.endsWith('.css')) {
        event.respondWith(networkFirst(request));
        return;
    }

    if (url.pathname.includes('/assets/') || url.pathname.includes('/vendor/')) {
        event.respondWith(cacheFirst(request));
        return;
    }

    event.respondWith(networkFirst(request));
});
