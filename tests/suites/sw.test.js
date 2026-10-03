/**
 * Чужие кэши и воркеры на общем адресе (§42, §45, Р-213, Р-214).
 *
 * У GitHub Pages один источник на все приложения владельца:
 * igor-bond.github.io — это и трекер, и «Ноты», и шахматы, и wortschatz. А
 * хранилище кэшей и список сервис-воркеров браузер ведёт по источнику, не по
 * каталогу. Трекер при каждом обновлении стирал всё, что не его текущая
 * версия, — и соседи без сети переставали открываться. А чужой воркер,
 * который трекер трогать не вправе, может накрыть и его страницы.
 *
 * Проверяется не текст, а поведение: настоящий код исполняется на
 * подделанном хранилище, где рядом с прошлой версией трекера лежат кэши
 * соседей. Поиск по тексту пропустил бы ту же ошибку, записанную иначе.
 */

import { describe, it, equal, assert } from '../runner.js';

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

/**
 * Подделка списка воркеров: регистрации с такими областями, и страницей
 * кто-то из них управляет. Помнит, какие сняли.
 */
function fakeWorkers(scopes) {
    const снятые = [];

    const navigator = {
        serviceWorker: {
            controller: {},
            getRegistrations: async () => scopes.map((scope) => ({
                scope,
                unregister: async () => { снятые.push(scope); return true; }
            }))
        }
    };

    return { navigator, снятые };
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

/**
 * Настоящий скрипт страницы проверок — на подделках.
 *
 * Исполняется как есть, кроме последнего шага: импорт проверок подменён
 * вызовом. Настоящий импорт пустил бы все проверки по второму кругу, а так
 * видно, чем скрипт кончил. Ответ — «перезагрузка» или «запуск».
 *
 * globalThis подменён пустым объектом: скрипт ставит имя базы, и настоящее
 * трогать незачем.
 */
function скриптСтраницы(navigator, caches) {
    const скрипт = [...document.scripts].find((s) => s.textContent.includes('getRegistrations'));
    assert(скрипт, 'на странице не найден скрипт, снимающий воркер');

    const ИМПОРТ = "import('./run.js')";
    assert(скрипт.textContent.split(ИМПОРТ).length === 2, 'в скрипте страницы не найден импорт проверок');

    return new Promise((готово, мимо) => {
        const location = {
            href: 'https://igor-bond.github.io/workout/tests/index.html',
            reload: () => готово('перезагрузка')
        };

        new Function('navigator', 'caches', 'location', 'globalThis', 'запуск',
            скрипт.textContent.replace(ИМПОРТ, 'запуск()'))(
            navigator, caches, location, {}, () => готово('запуск'));

        setTimeout(() => мимо(new Error('скрипт страницы не дошёл до конца')), 2000);
    });
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
     */
    it('страница проверок снимает только воркер и кэши трекера', async () => {
        const { navigator, снятые } = fakeWorkers([
            'https://igor-bond.github.io/workout/',
            'https://igor-bond.github.io/Notes/',
            'https://igor-bond.github.io/ChessAnalyzer/',
            'https://igor-bond.github.io/workout-old/'
        ]);

        const caches = fakeCaches(['workout-v292', ...СОСЕДИ]);

        // Свой воркер управлял загрузкой — значит, она шла мимо репозитория
        equal(await скриптСтраницы(navigator, caches), 'перезагрузка', 'после снятия своего воркера');

        equal(снятые, ['https://igor-bond.github.io/workout/'], 'воркеры соседей не трогаются');
        equal([...caches.живые].sort(), [...СОСЕДИ].sort(), 'кэши соседей не трогаются');
    });

    /*
     * Воркер с областью на весь адрес (igor-bond.github.io/) накрывает и
     * страницу проверок. Он чужой и остаётся на месте, так что после
     * перезагрузки управлял бы страницей снова: перезагружаться из-за него —
     * значит без конца, и проверки не начнутся никогда (Р-214).
     *
     * Сейчас в корне адреса пусто, но сайт там может появиться. Своего
     * воркера в списке нет — так выглядит и вторая загрузка, когда свой снят
     * первой.
     */
    it('не перезагружается без конца под чужим воркером на весь адрес', async () => {
        const { navigator, снятые } = fakeWorkers([
            'https://igor-bond.github.io/',
            'https://igor-bond.github.io/Notes/'
        ]);

        equal(await скриптСтраницы(navigator, fakeCaches(СОСЕДИ)), 'запуск',
            'проверки начались, хоть страницей и управляет чужой воркер');
        equal(снятые, [], 'чужой воркер не снят');
    });
});
