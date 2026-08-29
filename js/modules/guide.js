/**
 * Как пользоваться — разбор приложения для того, кто открыл его впервые.
 *
 * Приложение специально молчаливое: оно считает подходы и не командует, а
 * значит и не объясняет себя по ходу дела. Тому, кто уже знает порядок, так
 * удобнее; тому, кто видит экран впервые, — нет: кнопка «Новая тренировка»
 * ведёт к плану, план к выполнению, выполнение к итогам, и связь этих трёх
 * экранов ниоткуда не следует.
 *
 * Разделы свёрнуты, кроме первого. Развёрнутые целиком, они дают полотно в
 * несколько экранов, по которому нельзя понять, где искать нужное; свёрнутые
 * — это оглавление, а оно и есть ответ на вопрос «где что».
 *
 * Свёртывание сделано на <details>, а не на своём переключателе: состояние
 * живёт в самом элементе, а не в переменной модуля, и открытый раздел
 * переживает любую перерисовку экрана.
 *
 * Сам текст живёт отдельно, в js/i18n/guide.js, и написан на каждом языке
 * своими словами (§53). Здесь остаётся только то, как он выглядит: экран
 * ничего не знает о содержании, кроме видов блоков.
 */

import { ui } from '../core/ui.js';
import { actions } from '../core/actions.js';
import { beeper } from '../core/beeper.js';
import { i18n, t } from '../core/i18n.js';
import { guideContent } from '../i18n/guide.js';
import { app } from '../app.js';

/**
 * Выделение внутри строки: *текст* становится жирным.
 *
 * Звёздочками, а не тегами: в тексте, который пишут и правят как текст,
 * незакрытый тег однажды обязательно появится, а звёздочка сама по себе
 * ничего не ломает. Экранирование идёт до разметки, поэтому «<» в тексте
 * остаётся символом, а не началом тега.
 */
function markup(text) {
    return ui.raw(ui.esc(String(text)).replace(/\*([^*]+)\*/g, '<b>$1</b>'));
}

/** Раздел-гармошка. open — только у первого: он же ответ на «с чего начать». */
function part(section) {
    return ui.html`
        <details class="guide" ${ui.raw(section.open ? 'open' : '')}>
            <summary>${section.name}</summary>
            <div class="guide-body">${section.blocks.map(block)}</div>
        </details>
    `;
}

/** Один блок содержания. Вид определяется тем, какое поле в нём заполнено. */
function block(item) {
    if (item.p) return ui.html`<p>${markup(item.p)}</p>`;
    if (item.hint) return ui.html`<p class="hint">${markup(item.hint)}</p>`;
    if (item.example) return ui.html`<p class="guide-example">${markup(item.example)}</p>`;
    if (item.sub) return ui.html`<div class="guide-sub">${item.sub}</div>`;

    if (item.steps) {
        return ui.html`
            <ol class="guide-steps">
                ${item.steps.map((s) => ui.html`<li>${markup(s)}</li>`)}
            </ol>
        `;
    }

    if (item.rows) {
        return ui.html`
            <div class="guide-rows">
                ${item.rows.map(([name, text]) => ui.html`
                    <div class="guide-row">
                        <div class="guide-row-name">${name}</div>
                        <div class="guide-row-text">${markup(text)}</div>
                    </div>
                `)}
            </div>
        `;
    }

    /*
     * Сигналы с прослушиванием: узнавать их посреди бёрпи поздно, а раньше
     * знакомиться было негде.
     */
    if (item.sounds) {
        return ui.html`
            <div class="guide-sounds">
                ${item.sounds.map(([type, label, text]) => ui.html`
                    <div class="guide-sound">
                        <div class="guide-sound-text">
                            <div class="guide-row-name">${label}</div>
                            <div class="guide-row-text">${text}</div>
                        </div>
                        <button class="chip" data-action="try-sound" data-sound="${type}">${t('Послушать')}</button>
                    </div>
                `)}
            </div>
        `;
    }

    return '';
}

export const guide = {

    title: 'Как пользоваться',
    nav: 'profile',

    async render() {
        const content = guideContent(i18n.lang);

        return ui.html`
            ${ui.title(content.title, content.sub)}

            ${content.sections.map(part)}

            <button class="btn btn-ghost" data-action="nav" data-screen="profile">${t('← В профиль')}</button>
        `;
    }
};

// ================== ДЕЙСТВИЯ ==================

/**
 * Прослушивание сигнала.
 *
 * Экран не перерисовывается: перерисовка схлопнула бы все развёрнутые
 * разделы, а нажимают эту кнопку как раз внутри развёрнутого.
 */
actions.on('try-sound', (el) => {
    beeper.play(el.dataset.sound);
});

actions.on('nav-guide', () => app.go('guide'));
