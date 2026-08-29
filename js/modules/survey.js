/**
 * Экран анкеты тестировщика (§52 ТЗ), маршрут #/survey.
 *
 * Анкета живёт внутри приложения, а не на стороннем сервисе, по двум
 * причинам. Первая: адрес приложения открыт всем, и ссылку на анкету можно
 * дать кому угодно, ничего не настраивая. Вторая важнее — приложение знает
 * о себе то, что человек ввёл бы с ошибкой: свою версию, браузер, установлено
 * ли оно на экран, сколько тренировок проведено.
 *
 * Ответы уходят в отдельную коллекцию, откуда их нельзя прочитать (§52):
 * тестировщики не видят ответы друг друга.
 *
 * Отправить может не получиться — нет сети, отказали правила, не настроен
 * Firebase. Тогда экран собирает ответ текстом и предлагает отправить его
 * сообщением. Потерянный ответ хуже неудобного: человек уже потратил пять
 * минут, и предложить ему набрать всё заново нельзя.
 */

import { ui } from '../core/ui.js';
import { actions } from '../core/actions.js';
import { survey } from '../core/survey.js';
import { feedback } from '../services/feedback.js';
import { app } from '../app.js';

const DONE_KEY = 'surveySent';

/** Выбранное. Живёт в модуле: экран перерисовывается на каждом нажатии. */
let values = {};

/** null · 'sending' · 'done' · { failed: 'причина', entry } */
let outcome = null;

/** Сведения об устройстве: читаются один раз, чтобы показать до отправки. */
let about = null;
let aboutOpen = false;

function option(q, value, label, on) {
    return ui.html`
        <button class="opt ${on ? 'is-on' : ''}" data-action="sv-pick"
                data-q="${q.id}" data-v="${String(value)}">${label}</button>
    `;
}

function control(q) {
    if (q.type === 'one') {
        return ui.html`<div class="opts">
            ${q.opts.map((o) => option(q, o, o, values[q.id] === o))}
        </div>`;
    }

    if (q.type === 'many') {
        const picked = values[q.id] || [];
        return ui.html`<div class="opts">
            ${q.opts.map((o) => option(q, o, o, picked.includes(o)))}
        </div>`;
    }

    if (q.type === 'scale') {
        return ui.html`<div class="opts sv-scale">
            <span class="sv-end">хуже</span>
            ${[1, 2, 3, 4, 5].map((n) => option(q, n, String(n), values[q.id] === n))}
            <span class="sv-end">лучше</span>
        </div>`;
    }

    if (q.type === 'text') {
        return ui.html`<input type="text" data-change="sv-text" data-q="${q.id}"
                              value="${values[q.id] || ''}" placeholder="${q.placeholder || ''}"
                              autocomplete="off">`;
    }

    return ui.html`<textarea rows="3" data-change="sv-text" data-q="${q.id}"
                             placeholder="${q.placeholder || ''}">${values[q.id] || ''}</textarea>`;
}

function question(q, flagged) {
    return ui.html`
        <div class="sv-q ${flagged ? 'is-missing' : ''}" id="sv-${q.id}">
            <div class="sv-label">${q.label}${q.required ? ui.raw(' <span class="sv-req">*</span>') : ''}</div>
            ${q.hint ? ui.html`<div class="hint sv-hint">${q.hint}</div>` : ''}
            ${control(q)}
        </div>
    `;
}

/**
 * Что приложится к ответу.
 *
 * Свёрнуто, но открывается одним нажатием. Собирать о человеке молча то,
 * чего он не видел, нельзя — а разворачивать список на весь экран ради
 * сведений, которые почти никого не заинтересуют, незачем.
 */
function aboutBlock() {
    if (!about) return '';

    const rows = Object.keys(about).map((key) => ui.html`
        <div class="info-row"><span>${key}</span><strong>${about[key]}</strong></div>
    `);

    return ui.html`
        <div class="card">
            <button class="link-btn" data-action="sv-about">
                ${aboutOpen ? '− Скрыть' : '+ Что приложится к ответу'}
            </button>
            ${aboutOpen ? ui.html`<div class="sv-about">${rows}</div>` : ''}
        </div>
    `;
}

function failedBlock() {
    if (!outcome || !outcome.failed) return '';

    return ui.html`
        <div class="card sv-failed">
            <div class="card-title">Отправить не вышло</div>
            <p class="hint">${outcome.failed} Ответ не пропал: скопируй текст и отправь его сообщением разработчику.</p>
            <textarea class="sv-text" rows="12" readonly>${survey.asText(outcome.entry)}</textarea>
            <button class="btn btn-accent" data-action="sv-copy">Скопировать</button>
            <button class="btn btn-ghost" data-action="sv-send">Попробовать отправить ещё раз</button>
        </div>
    `;
}

export const surveyScreen = {

    title: 'Анкета',
    nav: 'profile',

    async render() {
        if (!about) about = await feedback.about().catch(() => ({}));

        if (outcome === 'done') {
            return ui.html`
                ${ui.raw(ui.title('Спасибо'))}
                <div class="card">
                    <p>Ответ записан. Если вспомнится что-то ещё — напиши разработчику,
                       или заполни анкету снова: лишним не будет.</p>
                    <button class="btn btn-ghost" data-action="sv-again">Заполнить ещё раз</button>
                    <button class="btn btn-accent" data-action="nav" data-screen="home">К тренировкам</button>
                </div>
            `;
        }

        const flagged = outcome && outcome.flagged ? outcome.flagged : [];
        const sending = outcome === 'sending';

        const sections = survey.SECTIONS.map((s) => ui.html`
            <div class="section">
                <div class="section-title">${s.title}</div>
                ${s.hint ? ui.html`<p class="hint sv-sec-hint">${s.hint}</p>` : ''}
                ${s.items.map((q) => question(q, flagged.includes(q.id)))}
            </div>
        `);

        return ui.html`
            ${ui.raw(ui.title('Анкета тестировщика',
                'Пять минут. Обязательный вопрос один — остальное отвечай там, где есть что сказать'))}

            <div class="card">
                <p class="hint" style="margin:0">
                    Что было непонятно, что сломалось и чего не хватает — самое ценное.
                    Модель телефона и версию приложение знает само, вводить их не надо.
                </p>
            </div>

            ${sections}

            ${aboutBlock()}

            <button class="btn btn-accent btn-lg" data-action="sv-send" ${ui.raw(sending ? 'disabled' : '')}>
                ${sending ? 'Отправляю…' : 'Отправить ответы'}
            </button>

            ${failedBlock()}

            <button class="btn btn-ghost" data-action="nav" data-screen="home">← К тренировкам</button>
        `;
    }
};

// ================== ДЕЙСТВИЯ ==================

actions.on('sv-pick', (el) => {
    const q = survey.find(el.dataset.q);
    if (!q) return;

    const raw = el.dataset.v;
    const value = q.type === 'scale' ? Number(raw) : raw;

    if (q.type === 'many') {
        const picked = values[q.id] || [];
        values[q.id] = picked.includes(value)
            ? picked.filter((v) => v !== value)
            : picked.concat([value]);
    } else {
        // Повторное нажатие снимает выбор: иначе передумавшему некуда деться,
        // а обязательных вопросов здесь почти нет
        values[q.id] = values[q.id] === value ? undefined : value;
    }

    // Подсветка снимается сразу, как на вопрос ответили: рамка, висящая
    // над заполненным полем, обвиняет ни за что
    if (outcome && outcome.flagged) {
        outcome = { flagged: outcome.flagged.filter((id) => id !== q.id) };
    }

    app.render();
});

/*
 * Текст пишется без перерисовки.
 *
 * Перерисовка на каждой букве отнимала бы фокус у поля и уносила курсор в
 * начало — набрать абзац про сломавшееся стало бы невозможно.
 */
actions.onChange('sv-text', (el) => {
    values[el.dataset.q] = el.value;
});

actions.on('sv-about', () => {
    aboutOpen = !aboutOpen;
    app.render();
});

actions.on('sv-again', () => {
    values = {};
    outcome = null;
    app.render();
});

actions.on('sv-copy', async (el) => {
    const box = document.querySelector('.sv-text');
    if (!box) return;

    box.select();
    box.setSelectionRange(0, box.value.length);

    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }

    if (!ok && navigator.clipboard) {
        ok = await navigator.clipboard.writeText(box.value).then(() => true, () => false);
    }

    el.textContent = ok ? 'Скопировано' : 'Выдели и скопируй вручную';
});

actions.on('sv-send', async () => {
    const answers = survey.compose(values);
    const нет = survey.missing(answers);

    if (нет.length) {
        outcome = { flagged: нет.map((q) => q.id) };
        app.render();

        document.getElementById(`sv-${нет[0].id}`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    const entry = { at: new Date().toISOString(), answers, about: about || {} };

    outcome = 'sending';
    await app.render();

    try {
        await feedback.send(entry);

        outcome = 'done';
        try { localStorage.setItem(`wt_${DONE_KEY}`, '1'); } catch { /* приватное окно */ }
    } catch (e) {
        console.warn('[Анкета] Отправить не вышло:', e);

        outcome = {
            entry,
            failed: !feedback.available
                ? 'Облако у этой сборки не настроено.'
                : 'Похоже, нет связи.'
        };
    }

    app.render();
});
