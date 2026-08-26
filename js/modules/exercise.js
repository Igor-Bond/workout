/**
 * Карточка упражнения (§24 ТЗ).
 *
 * Открывается по #/exercise/<id> из статистики, истории и экрана выполнения.
 */

import { ui } from '../core/ui.js';

export const exercise = {

    title: 'Упражнение',
    nav: 'stats',

    render(params) {
        const id = params[0];

        return ui.html`
            ${ui.raw(ui.title('Упражнение'))}
            ${ui.raw(ui.stub(
                'Рекорды и история упражнения',
                6,
                'Лучший вес и подход, разовый максимум, суммарные подходы и тоннаж, '
                + 'график динамики, полная история подходов.'
            ))}
            ${id ? ui.raw(`<div class="hint">Запрошенное упражнение: ${ui.esc(id)}</div>`) : ''}
            <button class="btn btn-ghost" data-action="nav" data-screen="stats">← К статистике</button>
        `;
    }
};
