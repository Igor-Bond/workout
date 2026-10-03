/**
 * Чужие кэши на общем адресе (§42, Р-213).
 *
 * У GitHub Pages один источник на все приложения владельца:
 * igor-bond.github.io — это и трекер, и «Ноты», и шахматы, и wortschatz. А
 * хранилище кэшей и список сервис-воркеров браузер ведёт по источнику, не по
 * каталогу. Трекер при каждом обновлении стирал всё, что не его текущая
 * версия, — и соседи без сети переставали открываться.
 *
 * Проверяется не текст, а поведение: настоящий код исполняется на
 * подделанном хранилище, где рядом с прошлой версией трекера лежат кэши
 * соседей. Поиск по тексту пропустил бы ту же ошибку, записанную иначе.
 */

import { describe, it, equal } from '../runner.js';

/** Подделка CacheStorage: помнит имена и что из них удалили. */
function fakeCaches(names) {
    const живые = new Set(names);

    return {
        живые,
        async keys() { return [...живые]; },
        async delete(name) { return живые.delete(name); },
        async open() { return { keys: async () => [], put: async () => {}, match: async () => undefined }; },
        async match() { return undefined; }
    };
}

const СОСЕДИ = ['notes-v12', 'chess-v40', 'wortschatz-v7'];

/**
 * Настоящий sw.js на подделанном окружении.
 *
 * Воркер — обычный скрипт без импортов, поэтому исполняется как тело
 * функции, где self и caches — параметры. Имя текущего кэша берём у него
 * же: проверка не должна знать номер версии.
 */
async function загрузитьВоркер(caches) {
    const код = await (await fetch('../sw.js', { cache: 'no-store' })).text();
    const обработчики = {};

    const self = {
        addEventListener: (type, fn) => { обработчики[type] = fn; },
        skipWaiting: async () => {},
        clients: { claim: async () => {} },
        location: { origin: 'https://igor-bond.github.io' }
    };

    const CACHE_NAME = new Function('self', 'caches', `${код}\nreturn CACHE_NAME;`)(self, caches);
    return { обработчики, CACHE_NAME };
}

describe('Сервис-воркер и соседи по адресу', () => {

    it('при активации стирает только свои прежние кэши', async () => {
        const caches = fakeCaches([]);
        const { обработчики, CACHE_NAME } = await загрузитьВоркер(caches);

        caches.живые.add(CACHE_NAME);
        caches.живые.add('workout-v1');
        for (const имя of СОСЕДИ) caches.живые.add(имя);

        let ждать;
        обработчики.activate({ waitUntil: (p) => { ждать = p; } });
        await ждать;

        equal([...caches.живые].sort(), [CACHE_NAME, ...СОСЕДИ].sort(),
            'прошлая версия трекера уходит, кэши соседей остаются');
    });

    /*
     * Страница проверок живёт там же, на Pages, и снимала с источника всё:
     * и кэши, и воркеры. Кто открыл проверки на живом адресе, оставлял
     * «Ноты» и шахматы без офлайна — без воркера кэш некому отдать.
     *
     * Её скрипт исполняется здесь же, как есть, на подделках. Управляющий
     * воркер подделан «есть», поэтому скрипт заканчивается перезагрузкой, а
     * не импортом проверок — перезагрузка и служит знаком, что он дошёл до
     * конца.
     */
    it('страница проверок снимает только воркер и кэши трекера', async () => {
        const скрипт = [...document.scripts].find((s) => s.textContent.includes('getRegistrations'));

        const снятые = [];
        const регистрация = (scope) => ({ scope, unregister: async () => { снятые.push(scope); return true; } });

        const navigator = {
            serviceWorker: {
                controller: {},
                getRegistrations: async () => [
                    регистрация('https://igor-bond.github.io/workout/'),
                    регистрация('https://igor-bond.github.io/Notes/'),
                    регистрация('https://igor-bond.github.io/Chess/'),
                    регистрация('https://igor-bond.github.io/workout-old/')
                ]
            }
        };

        const caches = fakeCaches(['workout-v292', ...СОСЕДИ]);

        const готово = new Promise((resolve, reject) => {
            const location = {
                href: 'https://igor-bond.github.io/workout/tests/index.html',
                reload: resolve
            };

            new Function('navigator', 'caches', 'location', 'globalThis', скрипт.textContent)(
                navigator, caches, location, {});

            setTimeout(() => reject(new Error('скрипт не дошёл до перезагрузки')), 2000);
        });

        await готово;

        equal(снятые, ['https://igor-bond.github.io/workout/'], 'воркеры соседей не трогаются');
        equal([...caches.живые].sort(), [...СОСЕДИ].sort(), 'кэши соседей не трогаются');
    });
});
