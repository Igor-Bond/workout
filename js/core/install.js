/**
 * Установка приложения на домашний экран.
 *
 * Chrome и производные сообщают о готовности событием beforeinstallprompt,
 * причём один раз и в произвольный момент — обычно уже после первой
 * отрисовки. Событие перехватывается и придерживается до нажатия кнопки,
 * а подписчики узнают, что кнопку пора показать.
 *
 * Safari такого события не шлёт: там установка делается вручную через
 * «Поделиться → На экран Домой», и это объясняется текстом в профиле.
 */

let deferred = null;
const listeners = new Set();

function emit() {
    listeners.forEach((cb) => {
        try { cb(); } catch (e) { console.error('[Установка] Ошибка слушателя:', e); }
    });
}

export const install = {

    /** Можно ли предложить установку прямо сейчас. */
    get available() {
        return deferred !== null;
    },

    /** Уже открыто как установленное приложение. */
    get installed() {
        return window.matchMedia('(display-mode: standalone)').matches
            || window.navigator.standalone === true;
    },

    /** Показывает ли браузер системное окно установки вообще. */
    get supported() {
        return 'onbeforeinstallprompt' in window;
    },

    /** Подписка на изменение доступности. Возвращает функцию отписки. */
    onChange(callback) {
        listeners.add(callback);
        return () => listeners.delete(callback);
    },

    async prompt() {
        if (!deferred) return false;

        deferred.prompt();
        const { outcome } = await deferred.userChoice;

        // Событие одноразовое: повторно вызвать prompt() нельзя
        deferred = null;
        emit();

        return outcome === 'accepted';
    },

    init() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferred = e;
            emit();
        });

        window.addEventListener('appinstalled', () => {
            deferred = null;
            emit();
        });
    }
};
