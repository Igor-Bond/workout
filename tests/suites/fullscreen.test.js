/**
 * Полноэкранный режим (§31 ТЗ).
 *
 * Настоящий полный экран браузер выдаёт только по действию пользователя, и
 * в проверках его не получить. Проверяется то, что от этого не зависит:
 * режим включается по настройке, а не сам по себе, и молча уживается с
 * браузером, который его не умеет, — на iPhone это обычное дело.
 */

import { describe, it, equal } from '../runner.js';
import { fullscreen } from '../../js/core/fullscreen.js';
import { config } from '../../js/config.js';
import { press } from '../helpers/dom.js';

// Действие «выйти сейчас» живёт в профиле; без импорта его некому
// зарегистрировать, и нажатие ушло бы в пустоту
import '../../js/modules/profile.js';

/** Подменяет то, чем пользуется модуль, и возвращает способ всё вернуть. */
function stub({ supported = true, fails = false } = {}) {
    const root = document.documentElement;

    const realRequest = root.requestFullscreen;
    const realExit = document.exitFullscreen;
    const realElement = Object.getOwnPropertyDescriptor(Document.prototype, 'fullscreenElement');

    let active = null;
    const calls = { enter: 0, exit: 0 };

    if (supported) {
        root.requestFullscreen = async () => {
            calls.enter += 1;
            if (fails) throw new Error('отказано без действия пользователя');
            active = root;
        };
    } else {
        root.requestFullscreen = undefined;
    }

    document.exitFullscreen = async () => { calls.exit += 1; active = null; };
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => active });

    return {
        calls,
        restore() {
            root.requestFullscreen = realRequest;
            document.exitFullscreen = realExit;
            delete document.fullscreenElement;
            if (realElement) Object.defineProperty(Document.prototype, 'fullscreenElement', realElement);
        }
    };
}

describe('Полноэкранный режим', () => {

    it('браузер без поддержки не ломает ничего', async () => {
        const s = stub({ supported: false });

        try {
            equal(fullscreen.supported, false);
            equal(await fullscreen.enter(), false, 'отсутствие поддержки — не ошибка');
            equal(fullscreen.wanted, false, 'просить нечего, даже если настройка включена');
        } finally {
            s.restore();
        }
    });

    it('включается и выключается', async () => {
        const s = stub();

        try {
            equal(await fullscreen.enter(), true);
            equal(fullscreen.active, true);

            await fullscreen.exit();
            equal(fullscreen.active, false);
            equal(s.calls.exit, 1);
        } finally {
            s.restore();
        }
    });

    /*
     * Браузер отказывает, когда вызов не связан с действием пользователя.
     * Это штатный случай, а не поломка: приложение перерисовывается и без
     * нажатий, и падать на каждой перерисовке оно не должно.
     */
    it('отказ браузера не роняет приложение', async () => {
        const s = stub({ fails: true });

        try {
            equal(await fullscreen.enter(), false);
            equal(fullscreen.active, false);
        } finally {
            s.restore();
        }
    });

    it('без настройки не включается сам', async () => {
        const s = stub();
        const было = config.get('fullscreen');

        try {
            config.set('fullscreen', false);
            equal(await fullscreen.enterIfWanted(), false);
            equal(s.calls.enter, 0, 'прятать системные панели без спроса нельзя');

            config.set('fullscreen', true);
            equal(await fullscreen.enterIfWanted(), true);
            equal(s.calls.enter, 1);
        } finally {
            config.set('fullscreen', было);
            s.restore();
        }
    });

    it('повторный вход лишнего запроса не делает', async () => {
        const s = stub();

        try {
            await fullscreen.enter();
            await fullscreen.enter();

            equal(s.calls.enter, 1);
        } finally {
            await fullscreen.exit();
            s.restore();
        }
    });

    it('выход из выключенного режима ничего не трогает', async () => {
        const s = stub();

        try {
            await fullscreen.exit();
            equal(s.calls.exit, 0);
        } finally {
            s.restore();
        }
    });
});

describe('Полный экран при запуске', () => {

    /*
     * Само по себе приложение в полный экран не пустят: браузер требует
     * действия пользователя, а при запуске его ещё не было. Первое касание —
     * самый ранний момент, когда это законно.
     */
    it('включается на первом касании', async () => {
        const s = stub();
        const было = config.get('fullscreen');

        try {
            config.set('fullscreen', true);
            fullscreen.watch();

            document.dispatchEvent(new Event('pointerdown', { bubbles: true }));
            await new Promise((r) => setTimeout(r, 30));

            equal(s.calls.enter, 1);
        } finally {
            config.set('fullscreen', было);
            await fullscreen.exit();
            s.restore();
        }
    });

    /*
     * Режим слетает сам: от переключения на другое приложение, от
     * системного окна, от возврата по кнопке «назад». Поэтому его
     * возвращает любое следующее касание, а не только первое.
     */
    it('слетевший режим возвращается следующим касанием', async () => {
        const s = stub();
        const было = config.get('fullscreen');
        const касание = async () => {
            document.dispatchEvent(new Event('pointerdown', { bubbles: true }));
            await new Promise((r) => setTimeout(r, 20));
        };

        try {
            config.set('fullscreen', true);
            fullscreen.watch();

            await касание();
            equal(s.calls.enter, 1);

            // Пока режим держится, лишних запросов нет
            await касание();
            equal(s.calls.enter, 1, 'повторять уже включённое незачем');

            // Так режим слетает сам: другое приложение, системное окно,
            // кнопка «назад»
            await fullscreen.exit();
            await касание();

            equal(s.calls.enter, 2, 'вернуть его должно первое же касание');
        } finally {
            config.set('fullscreen', было);
            await fullscreen.exit();
            s.restore();
        }
    });

    it('с выключенной настройкой касание ничего не включает', async () => {
        const s = stub();
        const было = config.get('fullscreen');

        try {
            config.set('fullscreen', false);
            fullscreen.watch();

            document.dispatchEvent(new Event('pointerdown', { bubbles: true }));
            await new Promise((r) => setTimeout(r, 30));

            equal(s.calls.enter, 0);
        } finally {
            config.set('fullscreen', было);
            s.restore();
        }
    });
});

/*
 * Полный экран из манифеста (§31).
 *
 * Просить его у браузера нужно не всегда: `display: fullscreen` разворачивает
 * приложение сам, с первого запуска и без касания. Запрашивать поверх этого
 * нечего, и настройка в профиле там ни при чём.
 */
describe('Полный экран из манифеста', () => {

    /** Подменяет ответ на вопрос о режиме отображения. */
    function mode(value) {
        const real = window.matchMedia;

        window.matchMedia = (query) => (
            query.includes('display-mode')
                ? { matches: query.includes(value), media: query }
                : real.call(window, query)
        );

        return () => { window.matchMedia = real; };
    }

    it('видно, что система уже развернула приложение', () => {
        const restore = mode('fullscreen');

        try {
            equal(fullscreen.byManifest, true);
        } finally {
            restore();
        }
    });

    it('в таком режиме у браузера ничего не просим', () => {
        const s = stub();
        const restore = mode('fullscreen');
        const было = config.get('fullscreen');

        try {
            config.set('fullscreen', true);
            equal(fullscreen.wanted, false, 'просить нечего — режим уже есть');
        } finally {
            config.set('fullscreen', было);
            restore();
            s.restore();
        }
    });

    it('в оконном режиме просить по-прежнему надо', () => {
        const restore = mode('standalone');
        const было = config.get('fullscreen');

        try {
            config.set('fullscreen', true);
            equal(fullscreen.byManifest, false);
        } finally {
            config.set('fullscreen', было);
            restore();
        }
    });
});

/**
 * Значение по умолчанию и выход (§31).
 *
 * Полный экран задуман против системной панели навигации. На компьютере
 * такой панели нет, зато окно во весь экран прячет вкладки и панель задач,
 * а приложение там обычно одно из нескольких открытых.
 */
describe('Полный экран на компьютере', () => {

    /** Подменяет вид указателя: палец или мышь. */
    function pointer(value) {
        const real = window.matchMedia;

        window.matchMedia = (query) => (
            query.includes('pointer')
                ? { matches: query.includes(value), media: query }
                : real.call(window, query)
        );

        return () => { window.matchMedia = real; };
    }

    it('с мышью по умолчанию выключен, с пальцем включён', () => {
        const было = localStorage.getItem('wt_fullscreen');
        localStorage.removeItem('wt_fullscreen');

        let restore = pointer('coarse');
        try {
            equal(config.get('fullscreen'), true, 'на телефоне режим нужен');
        } finally { restore(); }

        restore = pointer('fine');
        try {
            equal(config.get('fullscreen'), false, 'на компьютере прятать нечего');
        } finally {
            restore();
            if (было !== null) localStorage.setItem('wt_fullscreen', было);
        }
    });

    /*
     * Выход обязан выключать настройку.
     *
     * Пока она включена, любое касание возвращает режим — иначе он слетал бы
     * от каждого системного окна. Выход «на время» поэтому невозможен, и
     * кнопка в профиле выключает настройку явно.
     */
    it('после выхода режим не просится обратно', async () => {
        const s = stub();
        const было = localStorage.getItem('wt_fullscreen');

        try {
            config.set('fullscreen', true);
            await fullscreen.enter();
            equal(fullscreen.active, true);

            await press('fs-off');

            equal(config.get('fullscreen'), false, 'настройка выключена');
            equal(fullscreen.active, false, 'режим снят');
            equal(fullscreen.wanted, false, 'обратно не просится');
        } finally {
            if (было === null) localStorage.removeItem('wt_fullscreen'); else localStorage.setItem('wt_fullscreen', было);
            s.restore();
        }
    });
});
