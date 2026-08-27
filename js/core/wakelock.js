/**
 * Блокировка гашения экрана во время тренировки (§28 ТЗ).
 *
 * Между подходами проходит минута-полторы, и экран успевает погаснуть
 * ровно к моменту, когда надо записать результат. Разблокировать телефон
 * мокрыми руками посреди подхода — то самое неудобство, ради которого
 * настройка и заводится.
 *
 * Две особенности, из-за которых просто попросить один раз недостаточно:
 *
 *   - система сама снимает блокировку, когда вкладку сворачивают или
 *     экран гаснет по другой причине. После возврата её нужно запрашивать
 *     заново, иначе она действует только до первого переключения;
 *   - в Safari до 16.4 и в части браузеров Wake Lock нет вовсе. Отсутствие
 *     не должно ничего ломать — приложение просто работает как раньше.
 */

import { config } from '../config.js';

let sentinel = null;
let wanted = false;

const supported = () => 'wakeLock' in navigator;

async function acquire() {
    if (!wanted || !supported() || sentinel) return;
    if (document.visibilityState !== 'visible') return;

    try {
        sentinel = await navigator.wakeLock.request('screen');

        // Система может снять блокировку сама — тогда обнуляем ссылку,
        // чтобы следующий запрос не считал её действующей
        sentinel.addEventListener('release', () => { sentinel = null; });
    } catch (e) {
        // Отказ — не повод падать: экономия батареи, запрет в настройках
        console.warn('[Экран] Не удалось удержать экран:', e?.message || e);
        sentinel = null;
    }
}

async function drop() {
    if (!sentinel) return;

    try {
        await sentinel.release();
    } catch { /* уже снята системой */ }

    sentinel = null;
}

export const wakeLock = {

    /** Поддерживает ли браузер удержание экрана. */
    get supported() {
        return supported();
    },

    /** Действует ли блокировка прямо сейчас. */
    get active() {
        return !!sentinel;
    },

    /**
     * Просить не гасить экран. Ничего не делает, если выключено в
     * настройках, — проверка здесь, чтобы вызывающему не приходилось
     * помнить о ней каждый раз.
     */
    async enable() {
        if (!config.get('keepAwake')) return false;

        wanted = true;
        await acquire();
        return wakeLock.active;
    },

    /** Отпустить экран. Вызывается при уходе с экрана выполнения. */
    async disable() {
        wanted = false;
        await drop();
    },

    /**
     * Подписка на возвращение вкладки. Вызывается один раз при запуске:
     * без этого блокировка действовала бы только до первого сворачивания.
     */
    init() {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') acquire();
        });
    }
};
