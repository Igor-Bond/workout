/**
 * Календарь тренировок (§22 ТЗ).
 */

import { ui } from '../core/ui.js';

export const calendar = {

    title: 'Календарь',
    nav: 'history',

    render() {
        return ui.html`
            ${ui.raw(ui.title('Календарь'))}

            <div class="chips">
                <button class="chip" data-action="nav" data-screen="history">Список</button>
                <button class="chip is-active" data-action="nav" data-screen="calendar">Календарь</button>
            </div>

            ${ui.raw(ui.stub(
                'Помесячный просмотр',
                5,
                'Отметки дней с тренировками по типу, переход к тренировкам выбранного дня.'
            ))}
        `;
    }
};
