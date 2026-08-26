/**
 * Высота экрана и поведение при поднятой клавиатуре (§31 ТЗ).
 *
 * Две отдельные проблемы телефона:
 *
 * 1. 100vh на мобильных браузерах считается по высоте окна без адресной
 *    строки, поэтому нижнее меню уезжает под неё. Современные браузеры
 *    понимают 100dvh, но не все, поэтому то же значение дублируется
 *    переменной --app-height.
 *
 * 2. Поднятая клавиатура не уменьшает окно — она его перекрывает. Кнопка
 *    «Выполнено» оказывается под клавиатурой ровно в тот момент, когда она
 *    нужнее всего. Величину перекрытия сообщает visualViewport, и она
 *    выкладывается в --keyboard-inset, чтобы разметка могла подвинуться.
 */

let raf = 0;

function apply() {
    const doc = document.documentElement;

    // Страница, загруженная в фоновой вкладке, отдаёт нулевую высоту окна.
    // Записать ноль нельзя: он перекроет запасное значение 100vh из :root,
    // и разметка схлопнется. Ждём момента, когда вкладку покажут.
    if (window.innerHeight === 0) return;

    doc.style.setProperty('--app-height', `${window.innerHeight}px`);

    const vv = window.visualViewport;
    if (!vv) return;

    // Сколько нижней части окна перекрыто. Отрицательные значения даёт
    // прокрутка резинкой на iOS — они не нужны.
    const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);

    doc.style.setProperty('--keyboard-inset', `${Math.round(covered)}px`);
    doc.classList.toggle('keyboard-open', covered > 120);
}

function schedule() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(apply);
}

export const viewport = {

    /** Вызывать до первой отрисовки: иначе меню встанет по неверной высоте. */
    init() {
        apply();

        window.addEventListener('resize', schedule);
        window.addEventListener('orientationchange', schedule);

        window.visualViewport?.addEventListener('resize', schedule);
        window.visualViewport?.addEventListener('scroll', schedule);

        // Через requestAnimationFrame в скрытой вкладке ничего не выполняется,
        // а показ вкладки — как раз тот момент, когда высота наконец известна.
        // Поэтому здесь напрямую, без откладывания до кадра.
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') apply();
        });

        // Возврат «назад» на страницу из кэша переходов: события resize не будет
        window.addEventListener('pageshow', apply);
    },

    /** Перекрыта ли нижняя часть экрана клавиатурой. */
    get keyboardOpen() {
        return document.documentElement.classList.contains('keyboard-open');
    }
};
