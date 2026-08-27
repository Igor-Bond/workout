/**
 * Проверка обновлений (§42 ТЗ).
 *
 * Браузер сверяет сервис-воркер при загрузке страницы. Установленное на
 * телефон приложение страницу не загружает: его сворачивают и разворачивают,
 * процесс живёт неделями — и новая версия не доезжает, пока пользователь не
 * закроет приложение из списка запущенных. Догадаться об этом нельзя, а
 * выглядит это как «обновление не пришло».
 *
 * Поэтому проверка запускается сама при возвращении к приложению и, отдельно,
 * по кнопке в профиле — когда обновления ждут прямо сейчас и хочется знать
 * наверняка, а не гадать.
 */

/** Как часто проверять при возвращении. Чаще — значит дёргать сеть впустую. */
const INTERVAL = 15 * 60 * 1000;

let registration = null;
let lastCheck = 0;

export const updater = {

    INTERVAL,

    /** Есть ли вообще чем обновляться: без воркера проверять нечего. */
    get available() {
        return registration !== null;
    },

    use(reg) {
        registration = reg || null;
    },

    /**
     * Проверка. Возвращает true, если нашлась новая версия, false — если
     * стоит последняя, и null — если воркера нет или проверяли только что.
     *
     * Найденная версия ставится и перезагружает приложение сама: этим
     * занимается подписка на controllerchange в main.js.
     */
    async check({ force = false } = {}) {
        if (!registration) return null;
        if (!force && Date.now() - lastCheck < INTERVAL) return null;

        lastCheck = Date.now();
        await registration.update();

        return !!(registration.installing || registration.waiting);
    },

    /** Проверять при каждом возвращении к приложению. */
    watch() {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState !== 'visible') return;
            updater.check().catch((e) => console.warn('[PWA] Проверка обновления не удалась:', e));
        });
    }
};
