/**
 * Мелкие помощники сборки разметки.
 *
 * Разметка собирается строками, поэтому любое значение, пришедшее от
 * пользователя, обязано пройти через escape. В версии 1 названия упражнений
 * подставлялись в innerHTML как есть, и символ «<» в названии ломал вёрстку.
 */

const ESCAPE_MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
};

export const ui = {

    /** Экранирование текста для вставки в разметку. Всегда для данных. */
    esc(value) {
        if (value === null || value === undefined) return '';
        return String(value).replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
    },

    /**
     * Шаблонная строка с автоматическим экранированием подстановок:
     *   html`<div>${name}</div>`
     *
     * Массивы склеиваются без разделителя — удобно для списков.
     *
     * Результат помечен как готовая разметка, поэтому шаблоны вкладываются
     * друг в друга без оговорок: экранируются только простые значения.
     * Сырую строку из чужого источника помечать ui.raw() вручную.
     */
    html(strings, ...values) {
        const out = strings.reduce((acc, part, i) => {
            if (i === 0) return part;
            return acc + ui.render(values[i - 1]) + part;
        }, '');

        return ui.raw(out);
    },

    render(value) {
        if (value === null || value === undefined || value === false) return '';
        if (Array.isArray(value)) return value.map(ui.render).join('');
        if (value && value.__raw) return value.value;
        return ui.esc(value);
    },

    /**
     * Пометить строку как готовую разметку, не требующую экранирования.
     *
     * toString обязателен: помеченная разметка попадает и в innerHTML, и в
     * обычные шаблонные строки, а там объект должен превращаться в свой текст
     * сам, без вызова .value на каждой площадке.
     */
    raw(value) {
        return {
            __raw: true,
            value: String(value ?? ''),
            toString() { return this.value; }
        };
    },

    /** Заголовок экрана. */
    title(text, sub) {
        return ui.html`
            <div class="screen-head">
                <h1>${text}</h1>
                ${sub ? ui.raw(`<p class="screen-sub">${ui.esc(sub)}</p>`) : ''}
            </div>
        `;
    },

    /** Пояснение вместо содержимого: данных нет, но экран не пустой. */
    empty(text) {
        return ui.html`<div class="empty-note">${text}</div>`;
    },

    /**
     * Заглушка нереализованного раздела.
     *
     * Показывается вместо содержимого и честно называет этап, на котором
     * раздел появится. Ни одна заглушка не должна дожить до выпуска: их
     * список — это и есть список незакрытых пунктов STATUS.md.
     */
    stub(title, stage, text) {
        return ui.html`
            <div class="stub">
                <div class="stub-stage">Этап ${stage}</div>
                <div class="stub-title">${title}</div>
                <p>${text}</p>
            </div>
        `;
    }
};
