/**
 * Полноэкранный режим (§31 ТЗ).
 *
 * На Android системная панель навигации в установленном приложении светлая,
 * если светлая тема системы, и покрасить её со стороны страницы нечем:
 * `theme-color` красит строку состояния, а панель навигации следует системе.
 * Снизу остаётся белая полоса, которая к приложению не относится и портит
 * тёмный экран.
 *
 * Убрать её можно только полноэкранным режимом. В манифесте его ставить
 * нельзя: `display` читается в момент установки, и уже установленному
 * приложению значение не поменять — пришлось бы удалять значок и добавлять
 * заново. Поэтому Fullscreen API, который включается на ходу.
 *
 * Браузер требует, чтобы вход в полный экран шёл от действия пользователя.
 * Запуск тренировки — как раз действие, и там панели мешают больше всего.
 * Вне тренировки режим не нужен: часы и заряд полезнее сплошного экрана.
 */

import { config } from '../config.js';

const supported = () =>
    typeof document !== 'undefined'
    && !!document.documentElement?.requestFullscreen;

export const fullscreen = {

    /** Умеет ли браузер вообще. На iOS — нет, и это нормально. */
    get supported() {
        return supported();
    },

    get active() {
        return !!document.fullscreenElement;
    },

    /**
     * Войти. Возвращает false, если не вышло, — и это не ошибка:
     * браузер отказывает, когда вызов не связан с действием пользователя,
     * а такое случается при обычной перерисовке.
     */
    async enter() {
        if (!supported() || fullscreen.active) return fullscreen.active;

        try {
            await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
            return true;
        } catch (e) {
            console.warn('[Экран] Полноэкранный режим не включился:', e?.message || e);
            return false;
        }
    },

    async exit() {
        if (!fullscreen.active) return;

        try {
            await document.exitFullscreen();
        } catch (e) {
            console.warn('[Экран] Не удалось выйти из полноэкранного режима:', e?.message || e);
        }
    },

    /** Включён ли режим в настройках и доступен ли вообще. */
    get wanted() {
        return supported() && !!config.get('fullscreen');
    },

    /** Войти, если пользователь этого просил. Вызывать из обработчика действия. */
    async enterIfWanted() {
        if (!fullscreen.wanted) return false;
        return fullscreen.enter();
    }
};
