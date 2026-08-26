/**
 * Шаблоны тренировок (§8 ТЗ).
 *
 * Появляются на этапе 5, после базы и движка тренировки.
 */

import { ui } from '../core/ui.js';

export const templates = {

    title: 'Шаблоны',
    nav: 'workout',

    render() {
        return ui.html`
            ${ui.raw(ui.title('Шаблоны', 'Сохранённые тренировки для повторного запуска'))}
            ${ui.raw(ui.stub(
                'Шаблоны тренировок',
                5,
                'Создание, правка и дублирование шаблонов, а также сохранение шаблона '
                + 'из проведённой тренировки.'
            ))}
            <button class="btn btn-ghost" data-action="nav" data-screen="home">← На главную</button>
        `;
    }
};
