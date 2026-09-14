/**
 * Графики на SVG (§27 ТЗ).
 *
 * Своим кодом, без библиотек: приложение обязано работать офлайн, а
 * четыре вида графиков не стоят внешней зависимости в кэше.
 *
 * Цвета задаются через var(--...) прямо в атрибутах: SVG внутри страницы
 * видит переменные документа, поэтому палитра остаётся в одном месте (§30)
 * и графики меняются вместе с темой.
 *
 * Все размеры — в координатах viewBox, а не в пикселях: график тянется по
 * ширине контейнера и одинаково выглядит на телефоне и на ноутбуке.
 */

import { dates } from './dates.js';
import { ui } from './ui.js';
import { format } from './format.js';
import { t } from './i18n.js';

const esc = ui.esc;

/** Одинаковое поведение при отсутствии данных у всех графиков. */
function empty(message = t('Нет данных за период')) {
    return ui.html`<div class="chart-empty">${message}</div>`;
}

/** Подпись под столбцом: длинные названия обрезаются, а не наезжают друг на друга. */
const short = (label, max) => (label.length > max ? `${label.slice(0, max - 1)}…` : label);

/** Округление для имени графика: десятые у мелких величин, целое у крупных. */
const кратко = (v) => (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10)
    .toLocaleString('ru-RU')
    .replace('-', '−');

/**
 * Имя графика для читалки экрана (§45, Р-143).
 *
 * У всех графиков стоит role="img", и без имени читалка говорит
 * «изображение» и замолкает: для незрячего содержимое картинки пропадает
 * целиком, а на этих картинках весь ответ и нарисован.
 *
 * Что именно нарисовано, график не знает — знает тот, кто его позвал, и
 * передаёт заголовком. Остальное график досказывает сам: сколько значений, за
 * какой срок, между какими числами. Зрячий читает это со шкалы и подписей, а
 * в имени иначе не будет ничего.
 */
function имя(заголовок, описание) {
    return esc(заголовок ? `${заголовок}. ${описание}` : описание);
}

export const chart = {

    /**
     * Столбчатый график. data — [{ label, value, hint }].
     * highlight — индекс столбца, который надо выделить.
     */
    bars(data = [], { height = 150, maxLabel = 6, highlight = -1, format = String, label = '' } = {}) {
        if (data.length === 0) return empty();

        const width = 320;
        const bottom = height - 22;
        const top = 18;
        const max = Math.max(1, ...data.map((d) => d.value));
        const step = width / data.length;

        /*
         * Подпись через одну, когда столбцы теснее подписи (Р-121).
         *
         * Кегль подписей поднят с восьми точек до одиннадцати — на двенадцати
         * столбцах шаг выходит 26,7 единицы, а «21.08» при таком кегле
         * занимает около тридцати, и соседние даты сталкиваются лбами.
         *
         * Считается от последнего столбца, а не от первого: крайний правый —
         * это сегодня, и он обязан быть подписан. Отсчёт от первого оставлял
         * бы последние две подписи рядом.
         *
         * Так же сделаны дни недели у карты года: там подписан каждый второй
         * по той же причине — семь подряд при такой высоте строки сливаются.
         */
        const шагПодписи = step < 34 ? 2 : 1;
        const подписан = (i) => (data.length - 1 - i) % шагПодписи === 0;

        const bars = data.map((d, i) => {
            const barHeight = d.value > 0 ? Math.max(2, (d.value / max) * (bottom - top)) : 0;
            const x = i * step + step * 0.15;
            const w = step * 0.7;
            const y = bottom - barHeight;

            return ui.raw(`
                <rect x="${x}" y="${y}" width="${w}" height="${barHeight}" rx="2"
                      fill="var(${i === highlight ? '--accent' : '--accent-dim'})"></rect>
                ${d.value > 0 ? `<text x="${x + w / 2}" y="${y - 4}" text-anchor="middle"
                      class="chart-value">${esc(format(d.value))}</text>` : ''}
                ${подписан(i) ? `<text x="${x + w / 2}" y="${height - 6}" text-anchor="middle"
                      class="chart-label">${esc(short(String(d.label), maxLabel))}</text>` : ''}
            `);
        });

        const описание = t('Столбцы: {n}, от {первый} до {последний}, наибольший {макс}.', {
            n: data.length,
            первый: String(data[0].label),
            последний: String(data[data.length - 1].label),
            макс: кратко(max)
        });

        return ui.html`
            <svg class="chart" viewBox="0 0 ${String(width)} ${String(height)}" role="img"
                 aria-label="${ui.raw(имя(label, описание))}">
                <line x1="0" y1="${String(bottom)}" x2="${String(width)}" y2="${String(bottom)}"
                      stroke="var(--line)" stroke-width="1"></line>
                ${bars}
            </svg>
        `;
    },

    /**
     * Горизонтальные полосы — для групп мышц и типов тренировок: названия
     * там длинные и в подпись под столбцом не помещаются.
     */
    hbars(data = [], { format = String, label = '' } = {}) {
        if (data.length === 0) return empty();

        const rowHeight = 26;
        const width = 320;
        const labelWidth = 96;
        const height = data.length * rowHeight;
        const max = Math.max(1, ...data.map((d) => d.value));

        /*
         * Место справа отводится под самую длинную подпись (Р-121).
         *
         * Было сорок четыре единицы на любую — их хватало, пока подписи шли
         * восемью точками и состояли из одного числа. С подъёмом кегля до
         * одиннадцати и с тоннажем рядом («36 · 43 т») подпись вылезла за
         * край картинки: svg.chart нарисован с overflow: visible, поэтому она
         * не обрезалась, а просто оказывалась за пределами карточки.
         *
         * Ширина знака взята 6,2 единицы — это примерно 0,55 кегля при
         * одиннадцати точках в системе координат шириной 320.
         */
        const самая = Math.max(...data.map((d) => String(format(d.value, d)).length));
        const запас = Math.max(44, самая * 6.2 + 8);

        const rows = data.map((d, i) => {
            const y = i * rowHeight;
            const barWidth = Math.max(2, (d.value / max) * (width - labelWidth - запас));

            return ui.raw(`
                <text x="0" y="${y + 16}" class="chart-label">${esc(short(String(d.label), 13))}</text>
                <rect x="${labelWidth}" y="${y + 5}" width="${barWidth}" height="13" rx="2"
                      fill="var(--accent-dim)"></rect>
                <text x="${labelWidth + barWidth + 6}" y="${y + 16}" class="chart-value">${esc(format(d.value, d))}</text>
            `);
        });

        const первая = [...data].sort((a, b) => b.value - a.value)[0];

        const описание = t('Полосы: {n}, наибольшая — {имя}, {значение}.', {
            n: data.length, имя: String(первая.label), значение: String(format(первая.value, первая))
        });

        return ui.html`
            <svg class="chart" viewBox="0 0 ${String(width)} ${String(height)}" role="img"
                 aria-label="${ui.raw(имя(label, описание))}">${rows}</svg>
        `;
    },

    /**
     * Линейный график. series — [{ points: [{x, y}], color, dashed, width }],
     * где x — любое число (обычно время), y — величина.
     *
     * Несколько рядов рисуются в общем масштабе по x, но каждый в своём по
     * y: вес и тоннаж — величины разного порядка, и в общем масштабе
     * рабочий вес прижался бы к нулю.
     */
    /**
     * Ломаная. series — [{ color, segments, dashed, width, dots }].
     *
     * scale — подписывать ли границы шкалы. По умолчанию идёт за единицей
     * измерения, потому что раньше решала она одна: есть единица — есть чем
     * подписать. Но безразмерным величинам — индексу массы тела, форме —
     * шкала нужна ровно так же: без границ глаз читает не величину, а форму,
     * а форма всегда драматическая (Р-114).
     *
     * floor — дно шкалы у величин, которые ниже него не бывают: подходов за
     * неделю бывает ноль и не бывает минус два (Р-138).
     *
     * band — { from, to }, затенённая полоса «как у вас обычно» (Р-139).
     * Считает её тот, кто знает величину; график только рисует.
     */
    line(series = [], {
        height = 160, marks = [], unit = '', minSpan = 0,
        scale = Boolean(unit), floor = null, band = null, label = ''
    } = {}) {
        const all = series.flatMap((s) => s.segments.flat());
        if (all.length === 0) return empty();

        const width = 320;

        /*
         * Слева освобождается место под числа шкалы, когда они просят (Р-114).
         *
         * Без них глаз читает не величину, а форму — а форма всегда
         * драматическая, потому что масштаб каждый раз подгоняется под размах
         * ряда. У веса это прямо вредно: полкило от воды и соли выглядели
         * обвалом у того, кто пришёл за ответом «идёт или стоит».
         */
        const padding = { top: 14, right: 8, bottom: 20, left: scale ? 34 : 8 };

        const xs = all.map((p) => p.x);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const spanX = maxX - minX || 1;

        const scaleX = (x) => padding.left + ((x - minX) / spanX) * (width - padding.left - padding.right);

        /** Границы шкалы первого ряда — по ним и подписываются числа. */
        let шкала = null;

        const paths = series.map((s, порядок) => {
            const values = s.segments.flat().map((p) => p.y);
            const maxY = Math.max(...values);
            const minY = Math.min(...values);

            /*
             * Размах не меньше заданного (Р-114).
             *
             * Ряд 92,8 → 92,6 → 93,0 растягивался на всю высоту поля, и неделя
             * топтания на месте выглядела то обвалом, то взлётом. Величины, у
             * которых своя естественная мерка, просят минимальный размах — и
             * тогда топтание выглядит топтанием.
             *
             * Ряд без размаха при этом — не повод рисовать шкалу от нуля.
             * Талия, не менявшаяся три замера, давала размах ноль, и прежний
             * запасной вариант брал за него саму величину: шкала уезжала от 41
             * до 163 вокруг ста двух. Плоскому ряду нужна узкая шкала, в
             * середине которой он и ляжет.
             */
            const свой = maxY - minY;
            const запасной = Math.max(1, Math.abs(maxY) * 0.1);

            /*
             * У заданного размаха своего нижнего предела нет.
             *
             * Раньше плоский ряд получал размах не меньше единицы — но это
             * годится, только пока величина измеряется единицами. Отношение
             * талии к росту живёт между 0,4 и 0,6, и единичный размах уводил
             * его шкалу от −0,02 до 0,98: линия ложилась посередине пустого
             * поля. Запасной размах по-прежнему не меньше единицы — он
             * считается от самой величины и другого предела не знает.
             */
            const размах = свой
                ? Math.max(свой, minSpan)
                : (minSpan || запасной);
            const середина = (maxY + minY) / 2;

            // Небольшой запас сверху и снизу, иначе линия липнет к краю
            const запас = размах * 0.1;
            const верх = середина + размах / 2 + запас;

            /*
             * Пол шкалы — там, где у величины есть дно (Р-138).
             *
             * Подходов за неделю бывает ноль и не бывает минус два, а
             * заданный размах спокойно уводил шкалу ниже нуля: ряд из нулей и
             * двоек получал поле от −2,6 до 4,6, и приложение подписывало
             * край числом, которого не бывает.
             */
            const свободный = середина - размах / 2 - запас;
            const низ = floor === null ? свободный : Math.max(floor, Math.min(свободный, minY));

            if (порядок === 0) шкала = { низ, верх };

            const scaleY = (y) => height - padding.bottom
                - ((y - низ) / (верх - низ)) * (height - padding.top - padding.bottom);

            /*
             * Полоса «как обычно» — за линией, а не поверх неё (§66, Р-139).
             *
             * Считается она по первому ряду и рисуется только у него: полоса
             * — это фон, на котором читается линия, а два фона друг под
             * другом превратились бы в кашу.
             */
            const полоса = band && порядок === 0
                ? `<rect x="${padding.left}" y="${scaleY(band.to)}"
                         width="${width - padding.left - padding.right}"
                         height="${Math.max(1, scaleY(band.from) - scaleY(band.to))}"
                         fill="var(--line)" opacity="0.7"></rect>`
                : '';

            const drawn = s.segments
                .filter((segment) => segment.length > 0)
                .map((segment) => {
                    // Одинокая точка линией не рисуется — её видно только кружком
                    if (segment.length === 1) {
                        const p = segment[0];
                        return `<circle cx="${scaleX(p.x)}" cy="${scaleY(p.y)}" r="3" fill="${s.color}"></circle>`;
                    }

                    const d = segment
                        .map((p, i) => `${i === 0 ? 'M' : 'L'}${scaleX(p.x)},${scaleY(p.y)}`)
                        .join(' ');

                    return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width || 2}"
                                  stroke-linecap="round" stroke-linejoin="round"
                                  ${s.dashed ? 'stroke-dasharray="4 4"' : ''}></path>`;
                })
                .join('');

            const dots = s.dots === false ? '' : s.segments.flat().map((p) => {
                const isMark = marks.includes(p.key);
                return `<circle cx="${scaleX(p.x)}" cy="${scaleY(p.y)}" r="${isMark ? 4 : 2.5}"
                                fill="${isMark ? 'var(--accent)' : s.color}"
                                ${isMark ? 'stroke="var(--bg)" stroke-width="1.5"' : ''}></circle>`;
            }).join('');

            return ui.raw(полоса + drawn + dots);
        });

        const labels = [all[0], all[all.length - 1]].map((p, i) => ui.raw(`
            <text x="${i === 0 ? padding.left : width - padding.right}" y="${height - 4}"
                  text-anchor="${i === 0 ? 'start' : 'end'}" class="chart-label">${esc(p.label || '')}</text>
        `));

        /*
         * Два числа у края поля — верх и низ шкалы (§27, Р-114).
         *
         * Больше не нужно: график здесь отвечает на вопрос «идёт или стоит», а
         * не «сколько именно» — точное число человек читает на плитке рядом.
         * Но без границ не понять, чего стоит размах, и полкило выглядело
         * обвалом.
         *
         * Знаков после запятой — по размаху шкалы, а не по каждому числу
         * (Р-136). Десятой доли хватает, пока поле охватывает единицы: у веса
         * это 92,9. Но у отношения талии к росту всё поле — шесть сотых, и обе
         * подписи округлялись в «0,5»: шкала называла один и тот же край
         * дважды. И знаков поровну у обоих концов — считая по каждому числу
         * отдельно, шкала подписывалась «28,2» и «27», а это не пара границ, а
         * два числа разной точности, взятые откуда попало.
         */
        const края = шкала ? Math.max(Math.abs(шкала.верх), Math.abs(шкала.низ)) : 0;
        const размах = шкала ? шкала.верх - шкала.низ : 1;

        const знаков = размах < 1 ? 2 : края >= 100 ? 0 : 1;

        /*
         * Ноль — без десятых: «0,0» у дна шкалы читается как измеренная
         * точность, а ноль подходов — это просто ноль.
         *
         * Минус — типографский, как и везде в приложении: короткий дефис у
         * цифр читается переносом, а не знаком.
         */
        const число = (v) => (v === 0 ? '0' : v
            .toLocaleString('ru-RU', { minimumFractionDigits: знаков, maximumFractionDigits: знаков })
            .replace('-', '−'));

        const шкалаПодписи = scale && шкала ? [шкала.верх, шкала.низ].map((v, i) => ui.raw(`
            <text x="0" y="${i === 0 ? padding.top + 4 : height - padding.bottom - 3}"
                  class="chart-label">${esc(число(v))}</text>
        `)) : '';

        /*
         * Имя собирается по первому ряду, в котором есть точки.
         *
         * Второй ряд на этих графиках — всегда пояснение к первому:
         * сглаженная кривая у рабочего результата, и своих чисел он не
         * приносит. Читать вслух оба значило бы называть одну величину
         * дважды.
         *
         * «В котором есть точки» — не придирка: пустой первый ряд при
         * непустом втором давал имя «Линия: 0 значений с  по , от ∞ до −∞».
         */
        const первый = series.map((s) => s.segments.flat()).find((т) => т.length) || all;
        const значения = первый.map((p) => p.y);

        const описание = t('Линия: {n} с {от} по {до}, от {низ} до {верх}.', {
            n: format.count(первый.length, format.WORDS.value),
            от: String(первый[0]?.label || ''),
            до: String(первый[первый.length - 1]?.label || ''),
            низ: кратко(Math.min(...значения)),
            верх: кратко(Math.max(...значения))
        });

        return ui.html`
            <svg class="chart" viewBox="0 0 ${String(width)} ${String(height)}" role="img"
                 aria-label="${ui.raw(имя(label, описание))}">
                <line x1="0" y1="${String(height - padding.bottom)}" x2="${String(width)}"
                      y2="${String(height - padding.bottom)}" stroke="var(--line)" stroke-width="1"></line>
                ${paths}
                ${labels}
                ${шкалаПодписи}
            </svg>
        `;
    },

    /**
     * Тепловая карта года: столбец — неделя, строка — день недели.
     * days — из stats.heatmap().
     */
    heatmap(days = [], { months = [], action = null, label = '' } = {}) {
        if (days.length === 0) return empty();

        /*
         * Размер клетки задан в пикселях и не подгоняется под ширину экрана:
         * вся история в одну карточку давала клетку в девять пикселей, где
         * оттенки неразличимы. Не помещается — прокручивается вбок.
         *
         * Просвет взят четвертью клетки, а не пятой: при 2 из 9 клетки
         * слипались в серую массу.
         */
        const cell = 20;
        const gap = 5;
        const topOffset = 18;

        const weeks = Math.ceil(days.length / 7);
        const width = weeks * (cell + gap);
        const height = topOffset + 7 * (cell + gap);

        const rects = days.map((d, i) => {
            const week = Math.floor(i / 7);
            const weekday = i % 7;

            /*
             * Клетка нажимается, а не только наводится (Р-118).
             *
             * Подсказка жила в <title>: на компьютере она всплывает под
             * мышью, а на телефоне наведения нет вовсе — карта там была
             * картинкой, на которую можно тыкать без единого ответа. Причём
             * тыкают: клетки выглядят кнопками, они разного цвета и явно
             * что-то значат.
             */
            const нажимается = action
                ? ` data-action="${esc(action)}" data-title="${esc(d.title)}"`
                : '';

            return ui.raw(`<rect x="${week * (cell + gap)}" y="${topOffset + weekday * (cell + gap)}"
                width="${cell}" height="${cell}" rx="3"
                class="heat heat-${d.level}"${нажимается}><title>${esc(d.title)}</title></rect>`);
        });

        const labels = months.map((m) => ui.raw(`
            <text x="${m.week * (cell + gap)}" y="11" class="chart-label heat-month">${esc(m.label)}</text>
        `));

        /*
         * Дни недели — отдельной колонкой рядом с прокруткой, а не внутри
         * картинки: внутри они уехали бы вместе с сеткой при первом же
         * движении пальца, и подписи не стало бы ровно тогда, когда она
         * нужна. Через один — семь подряд при такой высоте строки сливаются.
         */
        // Через один и на языке приложения: список берётся из dates, а не
        // пишется здесь, иначе он остался бы русским на любом языке
        const weekdays = dates.WEEKDAYS_SHORT.map((d, i) => (i % 2 === 0 ? d : '')).map((label) => ui.html`
            <span>${label}</span>
        `);

        return ui.html`
            <div class="heat-wrap" style="--heat-row: ${String(cell + gap)}px; --heat-top: ${String(topOffset)}px">
                <div class="heat-days">${weekdays}</div>

                <div class="heatmap-scroll">
                    <svg class="heatmap" width="${String(width)}" height="${String(height)}"
                         viewBox="0 0 ${String(width)} ${String(height)}" role="img"
                         aria-label="${ui.raw(имя(label, t('Карта года: {всего}, с занятиями — {занято}.', {
                             всего: format.count(days.length, format.WORDS.day),
                             занято: days.filter((d) => d.level > 0).length
                         })))}"
                        ${labels}
                        ${rects}
                    </svg>
                </div>
            </div>
        `;
    }
};
