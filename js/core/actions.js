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
    }
};
