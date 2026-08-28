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
