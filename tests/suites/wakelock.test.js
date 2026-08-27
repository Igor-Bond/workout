/**
 * Удержание экрана во время тренировки (§28 ТЗ).
 *
 * Настоящий Wake Lock здесь не проверить: браузер отказывает, когда
 * страница не видна, а в проверках она именно такая. Поэтому API
 * подменяется — проверяется свой код, а не браузер.
 *
 * Главное, что проверяется: система сама снимает блокировку при
 * сворачивании, и после возврата её надо запрашивать заново. Без этого
 * настройка работала бы только до первого переключения приложения —
 * то есть почти никогда.
 */

import { describe, it, equal } from '../runner.js';
import { wakeLock } from '../../js/core/wakelock.js';
import { config } from '../../js/config.js';

/** Подменяет видимость и сам API, возвращает счётчики и способ всё вернуть. */
function stub() {
    const real = navigator.wakeLock;
    const counts = { granted: 0, released: 0 };
    let onRelease = null;

    Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });

    Object.defineProperty(navigator, 'wakeLock', {
        configurable: true,
        value: {
            request: async () => {
                counts.granted += 1;
                return {
                    addEventListener: (_, cb) => { onRelease = cb; },
                    release: async () => { counts.released += 1; }
                };
            }
        }
    });

    return {
        counts,
        systemRelease: () => onRelease?.(),
        restore: () => {
            Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: real });
            delete document.visibilityState;
        }
    };
}

const wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));

// В приложении это делает main.js при запуске. Здесь его нет, а без
// подписки возврат на вкладку ничего бы не восстанавливал.
wakeLock.init();

describe('Удержание экрана', () => {

    it('включается и отпускается', async () => {
        const s = stub();
        config.set('keepAwake', true);

        await wakeLock.enable();
        equal(wakeLock.active, true);

        await wakeLock.disable();
        equal(wakeLock.active, false);
        equal(s.counts.released, 1);

        s.restore();
    });

    it('выключенная настройка ничего не запрашивает', async () => {
        const s = stub();
        config.set('keepAwake', false);

        await wakeLock.enable();

        equal(wakeLock.active, false);
        equal(s.counts.granted, 0);

        config.set('keepAwake', true);
        s.restore();
    });

    it('возвращается после того, как система сняла его', async () => {
        const s = stub();
        config.set('keepAwake', true);

        await wakeLock.enable();
        s.systemRelease();
        equal(wakeLock.active, false, 'система снимает блокировку при сворачивании');

        document.dispatchEvent(new Event('visibilitychange'));
        await wait();

        equal(wakeLock.active, true, 'иначе настройка работала бы до первого переключения');
        equal(s.counts.granted, 2);

        await wakeLock.disable();
        s.restore();
    });

    it('после отключения возврат на вкладку ничего не запрашивает', async () => {
        const s = stub();
        config.set('keepAwake', true);

        await wakeLock.enable();
        await wakeLock.disable();

        document.dispatchEvent(new Event('visibilitychange'));
        await wait();

        equal(s.counts.granted, 1, 'тренировка закончилась — держать экран незачем');
        equal(wakeLock.active, false);

        s.restore();
    });

    it('отказ браузера ничего не роняет', async () => {
        const real = navigator.wakeLock;
        Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
        Object.defineProperty(navigator, 'wakeLock', {
            configurable: true,
            value: { request: async () => { throw new Error('запрещено настройками'); } }
        });

        config.set('keepAwake', true);
        await wakeLock.enable();

        equal(wakeLock.active, false, 'отказ — не повод падать');

        Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: real });
        delete document.visibilityState;
    });
});
