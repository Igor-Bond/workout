/**
 * Высота экрана и поведение при поднятой клавиатуре (§31 ТЗ).
 *
 * Две отдельные проблемы телефона:
 *
 * 1. 100vh на мобильных браузерах считается по высоте окна без адресной
 *    строки, поэтому нижнее меню уезжает под неё. Современные браузеры
 *    понимают 100svh, но не все, поэтому то же значение дублируется
 *    переменной --app-height — и подставляется сюда только там, где svh не
 *    понимают (Р-69).
 *
 * 2. Поднятая клавиатура не уменьшает окно — она его перекрывает. Кнопка
 *    «Выполнено» оказывается под клавиатурой ровно в тот момент, когда она
 *    нужнее всего. Величину перекрытия сообщает visualViewport, и она
 *    выкладывается в --keyboard-inset, чтобы разметка могла подвинуться.
 */

let raf = 0;

/**
 * Умеет ли браузер svh — высоту окна при развёрнутой адресной строке.
 *
 * Умеет — и трогать --app-height нельзя (Р-69): в CSS уже стоит 100svh,
 * значение постоянное, а window.innerHeight меняется каждый раз, когда
 * адресная строка сворачивается при прокрутке. Записывать его поверх значило
 * бы возвращать ту самую пляску высоты, ради устранения которой всё и
 * затевалось.
 */
const УМЕЕТ_SVH = typeof CSS !== 'undefined' && CSS.supports?.('height', '100svh');

function apply() {
    const doc = document.documentElement;

    // Страница, загруженная в фоновой вкладке, отдаёт нулевую высоту окна.
    // Записать ноль нельзя: он перекроет запасное значение 100vh из :root,
    // и разметка схлопнется. Ждём момента, когда вкладку покажут.
    if (window.innerHeight === 0) return;

    if (!УМЕЕТ_SVH) doc.style.setProperty('--app-height', `${window.innerHeight}px`);

    const vv = window.visualViewport;
    if (!vv) return;

    // Сколько нижней части окна перекрыто. Отрицательные значения даёт
    // прокрутка резинкой на iOS — они не нужны.
    const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);

    doc.style.setProperty('--keyboard-inset', `${Math.round(covered)}px`);
    doc.classList.toggle('keyboard-open', covered > 120);
}

/**
 * Окно не должно уезжать при открытой клавиатуре (Р-80).
 *
 * Тело ровно в высоту окна и не прокручивается, но Safari при фокусе в поле
 * всё равно сдвигает окно вверх, чтобы показать поле над клавиатурой.
 * Приложению это не нужно: каркас уже укоротился на высоту клавиатуры
 * (§31), и поле видно и так. А сдвиг показывает пустоту под телом и
 * выглядит как прокрутка на ровном месте.
 *
 * Возвращаем на место только при открытой клавиатуре и только если окно
 * правда уехало: в остальное время трогать прокрутку окна незачем.
 */
function держатьОкно() {
    if (!document.documentElement.classList.contains('keyboard-open')) return;
    if (window.scrollY === 0 && window.scrollX === 0) return;

    window.scrollTo(0, 0);
}

function schedule() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(apply);
}

export const viewport = {

    /** Вызывать до первой отрисовки: иначе меню встанет по неверной высоте. */
    init() {
        apply();

        window.addEventListener('scroll', держатьОкно, { passive: true });
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
