/**
 * Делегирование событий.
 *
 * Разметка собирается строками и перерисовывается целиком, поэтому вешать
 * addEventListener на каждый элемент бессмысленно — после перерисовки
 * слушатели теряются вместе с узлами. Вместо этого элемент объявляет
 * намерение атрибутом:
 *
 *   <button data-action="nav" data-screen="history">История</button>
 *   <input type="checkbox" data-change="setting" data-key="restSound">
 *
 * а обработчик регистрируется один раз на всё приложение. Inline-обработчики
 * onclick при этом не нужны, и модули не приходится выкладывать в window.
 */

let started = false;

const clickHandlers = new Map();
const changeHandlers = new Map();

function dispatch(map, event, attribute) {
    const el = event.target.closest(`[${attribute}]`);
    if (!el) return;

    const name = el.getAttribute(attribute);
    const handler = map.get(name);

    if (!handler) {
        console.warn(`[Действия] Нет обработчика «${name}»`);
        return;
    }

    /*
     * Почти все обработчики асинхронные, и обычный try их отказы не ловит:
     * они уходят в необработанные обещания и не доходят никуда.
     *
     * Для журнала тренировок это худший из возможных исходов. Если запись
     * подхода не удалась — кончилось место, база занята другим окном,
     * приватный режим, — пользователь нажимает «Выполнено», экран не
     * меняется, сообщения нет. Он решит, что промахнулся по кнопке, и
     * нажмёт ещё раз, а подход так и не запишется.
     */
    Promise.resolve()
        .then(() => handler(el, event))
        .catch((e) => report(name, e));
}

/** Куда сообщать об ошибке. Задаётся приложением, чтобы ядро не знало про диалоги. */
let onError = null;

function report(name, error) {
    console.error(`[Действия] Ошибка в обработчике «${name}»:`, error);

    try {
        onError?.(error, name);
    } catch (e) {
        console.error('[Действия] Ошибка в сообщении об ошибке:', e);
    }
}

export const actions = {

    /** Обработчик нажатия: data-action="имя". */
    on(name, handler) {
        clickHandlers.set(name, handler);
    },

    /** Обработчик изменения поля: data-change="имя". */
    onChange(name, handler) {
        changeHandlers.set(name, handler);
    },

    /**
     * Куда сообщать об упавшем действии. Вызывается с (ошибка, имя).
     * Задаётся один раз при запуске приложения.
     */
    onError(callback) {
        onError = callback;
    },

    init() {
        // Повторный вызов навесил бы вторые слушатели, и каждое нажатие
        // сработало бы дважды: подход записался бы дважды, отдых прыгнул бы
        // на два шага
        if (started) return;
        started = true;

        document.addEventListener('click', (e) => dispatch(clickHandlers, e, 'data-action'));
        document.addEventListener('change', (e) => dispatch(changeHandlers, e, 'data-change'));

        // Enter в поле ввода равнозначен нажатию главной кнопки формы.
        // На телефоне это единственный быстрый способ записать подход,
        // не убирая палец с клавиатуры.
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            const field = e.target.closest('[data-enter]');
            if (!field) return;

            e.preventDefault();
            const target = document.querySelector(`[data-action="${field.dataset.enter}"]`);
            if (target) target.click();
        });

        holdRepeat();
    }
};

/*
 * Удержание кнопки повторяет её нажатие (data-hold).
 *
 * Нужно там, где шаг мелкий, а пройти надо далеко: длительность отдыха
 * шагом в пять секунд от минуты до трёх — это восемнадцать тычков, а
 * удержанием одно движение (§16).
 *
 * Первое повторение отложено на полсекунды: без задержки обычное нажатие
 * успевало бы сработать дважды. Дальше шаг ускоряется до восьми раз в
 * секунду и на этом останавливается — без потолка палец за секунду уводит
 * отдых с минуты на полчаса, а он ещё и запоминается в настройке (Р-26).
 *
 * Восемь в секунду выбраны под шаг в пять секунд: две секунды удержания
 * дают около минуты. Медленнее — и до трёх минут пришлось бы держать
 * полдесятка секунд, быстрее — цифра мелькает и её не поймать.
 *
 * Слушается pointer, а не touch с mouse по отдельности: один набор событий
 * на палец, мышь и перо. Уход пальца с кнопки и отмена жеста системой
 * останавливают повтор — иначе он продолжался бы при прокрутке, а промах
 * по соседней кнопке в тесном ряду отдыха отменил бы паузу.
 */
const HOLD_DELAY = 500;
const HOLD_FASTEST = 120;

function holdRepeat() {
    let timer = 0;
    let step = HOLD_DELAY;

    const stop = () => {
        clearTimeout(timer);
        timer = 0;
        step = HOLD_DELAY;
    };

    const tick = (el) => {
        if (!el.isConnected) return stop();

        el.click();

        step = Math.max(HOLD_FASTEST, step * 0.75);
        timer = setTimeout(() => tick(el), step);
    };

    document.addEventListener('pointerdown', (e) => {
        const el = e.target.closest('[data-hold]');
        if (!el) return;

        stop();
        timer = setTimeout(() => tick(el), HOLD_DELAY);
    });

    for (const event of ['pointerup', 'pointercancel', 'pointerleave']) {
        document.addEventListener(event, stop);
    }

    // Долгое нажатие на телефоне вызывает выделение и системное меню —
    // на кнопке с повтором это мешает и выглядит поломкой
    document.addEventListener('contextmenu', (e) => {
        if (e.target.closest('[data-hold]')) e.preventDefault();
    });
}
