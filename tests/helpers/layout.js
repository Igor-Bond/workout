/**
 * Замер вёрстки на ширине телефона (§45, Р-182).
 *
 * Остальные проверки экранов смотрят на разметку: есть ли кнопка, то ли
 * число. Разметка при этом бывает совершенно правильной, а экран — сломанным:
 * заметка в полсотни слов вылезает из карточки, распирает прокрутку каркаса,
 * и всё окно начинает ездить вбок за пальцем. В строке разметки этого не
 * видно вообще ничем.
 *
 * Поэтому здесь экран показывается по-настоящему: в отдельном окне шириной с
 * телефон, с тем же самым `css/style.css` и тем же каркасом, что и в
 * приложении. И спрашивается одно — не торчит ли что-нибудь за край.
 *
 * Окно одно на все замеры: поднять раму со стилями стоит дороже, чем сам
 * замер, а замеров десятки.
 */

/** Ширина, на которой меряем. Айфон SE — самый узкий из живых. */
export const ТЕЛЕФОН = 375;

let рама = null;
let готова = null;

/**
 * Рама с настоящими стилями и каркасом приложения.
 *
 * Стили кладутся внутрь строкой, а не ссылкой, и это важно. Ссылка грузится
 * своим чередом, и ждать её пришлось бы таймером — а в свёрнутой вкладке
 * браузер растягивает таймеры до секунды, и прогон вставал бы намертво там,
 * где проверок больше десятка. Ни `requestAnimationFrame` по той же причине:
 * в невидимой вкладке он не срабатывает вовсе.
 */
function поднять() {
    if (готова) return готова;

    готова = (async () => {
        const адрес = new URL('../css/style.css', location.href).href;
        const css = await (await fetch(адрес, { cache: 'no-store' })).text();

        рама = document.createElement('iframe');

        рама.width = String(ТЕЛЕФОН);
        рама.height = '812';

        // Убрана с глаз, но не `display: none`: у скрытой рамы нет разметки
        // вовсе, и все замеры вернули бы нули
        рама.style.cssText = 'position:fixed;left:-9999px;top:0;border:0;';

        рама.srcdoc = `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">
            <style>${css}</style>
            </head><body><div class="shell">
            <div class="content" tabindex="0"><main id="screen" class="screen"></main></div>
            </div></body></html>`;

        await new Promise((resolve) => {
            рама.addEventListener('load', resolve, { once: true });
            document.body.appendChild(рама);
        });

        return рама;
    })();

    return готова;
}

/**
 * Показать разметку экрана и померить, что торчит за край.
 *
 * Возвращает { лишку, торчат } — на сколько точек содержимое шире окна и кто
 * именно виноват, по одному описанию на элемент.
 *
 * Ждать после вставки нечего: `getBoundingClientRect` сам заставляет браузер
 * посчитать разметку, а своих шрифтов у приложения нет — системные готовы
 * сразу, и мерить после них нечего.
 */
export async function наТелефоне(html) {
    await поднять();

    const док = рама.contentWindow.document;

    const экран = док.getElementById('screen');
    экран.innerHTML = String(html);

    const каркас = док.querySelector('.content');
    const край = каркас.getBoundingClientRect().right;

    const торчат = [...экран.querySelectorAll('*')]
        .filter((el) => el.getBoundingClientRect().right > край + 1)
        .map((el) => {
            const имя = el.className
                ? `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`
                : el.tagName.toLowerCase();

            return `${имя} («${el.textContent.trim().slice(0, 30)}»)`;
        });

    return {
        лишку: Math.max(0, каркас.scrollWidth - каркас.clientWidth),

        // Повторы убраны: у вылезшей кнопки торчат и все её потомки, и список
        // из десяти строк об одной ошибке читать нельзя
        торчат: [...new Set(торчат)].slice(0, 6)
    };
}

/** Проверить, что рама вообще меряет: без этого она о любой вёрстке молчит. */
export async function самопроверка() {
    return наТелефоне('<div style="width: 900px; height: 20px">нарочно широкий</div>');
}

/** Убрать раму: держать её после набора незачем. */
export function опустить() {
    рама?.remove();
    рама = null;
    готова = null;
}
