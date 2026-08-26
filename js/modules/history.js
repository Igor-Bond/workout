/**
 * История тренировок (§21 ТЗ).
 *
 * Список появляется на этапе 5. Карточка отдельной тренировки открывается
 * экраном итогов: #/summary/<id>.
 */

import { ui } from '../core/ui.js';

export const history = {

    title: 'История',
    nav: 'history',

    render() {
        return ui.html`
            ${ui.raw(ui.title('История'))}

            <div class="chips">
                <button class="chip" data-action="nav" data-screen="history">Список</button>
                <button class="chip" data-action="nav" data-screen="calendar">Календарь</button>
            </div>

            ${ui.raw(ui.stub(
                'Список тренировок',
                5,
                'Фильтры по типу и упражнению, поиск, карточка тренировки, '
                + 'удаление подхода и правка заметок.'
            ))}
        `;
    }
};
