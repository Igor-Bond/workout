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

import { ui } from './ui.js';

const esc = ui.esc;

/** Одинаковое поведение при отсутствии данных у всех графиков. */
function empty(message = 'Нет данных за период') {
    return ui.html`<div class="chart-empty">${message}</div>`;
}

/** Подпись под столбцом: длинные названия обрезаются, а не наезжают друг на друга. */
const short = (label, max) => (label.length > max ? `${label.slice(0, max - 1)}…` : label);

export const chart = {

    /**
     * Столбчатый график. data — [{ label, value, hint }].
     * highlight — индекс столбца, который надо выделить.
     */
    bars(data = [], { height = 150, maxLabel = 6, highlight = -1, format = String } = {}) {
        if (data.length === 0) return empty();

        const width = 320;
        const bottom = height - 22;
        const top = 18;
        const max = Math.max(1, ...data.map((d) => d.value));
        const step = width / data.length;

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
                <text x="${x + w / 2}" y="${height - 6}" text-anchor="middle"
                      class="chart-label">${esc(short(String(d.label), maxLabel))}</text>
            `);
        });

        return ui.html`
            <svg class="chart" viewBox="0 0 ${String(width)} ${String(height)}" role="img">
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
    hbars(data = [], { format = String } = {}) {
        if (data.length === 0) return empty();

        const rowHeight = 26;
        const width = 320;
        const labelWidth = 96;
        const height = data.length * rowHeight;
        const max = Math.max(1, ...data.map((d) => d.value));

        const rows = data.map((d, i) => {
            const y = i * rowHeight;
            const barWidth = Math.max(2, (d.value / max) * (width - labelWidth - 44));

            return ui.raw(`
                <text x="0" y="${y + 16}" class="chart-label">${esc(short(String(d.label), 13))}</text>
                <rect x="${labelWidth}" y="${y + 5}" width="${barWidth}" height="13" rx="2"
                      fill="var(--accent-dim)"></rect>
                <text x="${labelWidth + barWidth + 6}" y="${y + 16}" class="chart-value">${esc(format(d.value))}</text>
            `);
        });

        return ui.html`
            <svg class="chart" viewBox="0 0 ${String(width)} ${String(height)}" role="img">${rows}</svg>
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
    line(series = [], { height = 160, marks = [] } = {}) {
        const all = series.flatMap((s) => s.segments.flat());
        if (all.length === 0) return empty();

        const width = 320;
        const padding = { top: 14, right: 8, bottom: 20, left: 8 };

        const xs = all.map((p) => p.x);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const spanX = maxX - minX || 1;

        const scaleX = (x) => padding.left + ((x - minX) / spanX) * (width - padding.left - padding.right);

        const paths = series.map((s) => {
            const values = s.segments.flat().map((p) => p.y);
            const maxY = Math.max(...values);
            const minY = Math.min(...values);
            const spanY = (maxY - minY) || Math.max(1, maxY);

            // Небольшой запас сверху и снизу, иначе линия липнет к краю
            const scaleY = (y) => height - padding.bottom
                - ((y - minY + spanY * 0.1) / (spanY * 1.2)) * (height - padding.top - padding.bottom);

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

            return ui.raw(drawn + dots);
        });

        const labels = [all[0], all[all.length - 1]].map((p, i) => ui.raw(`
            <text x="${i === 0 ? padding.left : width - padding.right}" y="${height - 4}"
                  text-anchor="${i === 0 ? 'start' : 'end'}" class="chart-label">${esc(p.label || '')}</text>
        `));

        return ui.html`
            <svg class="chart" viewBox="0 0 ${String(width)} ${String(height)}" role="img">
                <line x1="0" y1="${String(height - padding.bottom)}" x2="${String(width)}"
                      y2="${String(height - padding.bottom)}" stroke="var(--line)" stroke-width="1"></line>
                ${paths}
                ${labels}
            </svg>
        `;
    },

    /**
     * Тепловая карта года: столбец — неделя, строка — день недели.
     * days — из stats.heatmap().
     */
    heatmap(days = [], { months = [] } = {}) {
        if (days.length === 0) return empty();

        const cell = 9;
        const gap = 2;
        const topOffset = 12;

        const weeks = Math.ceil(days.length / 7);
        const width = weeks * (cell + gap);
        const height = topOffset + 7 * (cell + gap);

        const rects = days.map((d, i) => {
            const week = Math.floor(i / 7);
            const weekday = i % 7;

            return ui.raw(`<rect x="${week * (cell + gap)}" y="${topOffset + weekday * (cell + gap)}"
                width="${cell}" height="${cell}" rx="2"
                class="heat heat-${d.level}"><title>${esc(d.title)}</title></rect>`);
        });

        const labels = months.map((m) => ui.raw(`
            <text x="${m.week * (cell + gap)}" y="8" class="chart-label">${esc(m.label)}</text>
        `));

        return ui.html`
            <div class="heatmap-scroll">
                <svg class="heatmap" viewBox="0 0 ${String(width)} ${String(height)}"
                     width="${String(width)}" height="${String(height)}" role="img">
                    ${labels}
                    ${rects}
                </svg>
            </div>
        `;
    }
};
