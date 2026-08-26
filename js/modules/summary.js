/**
 * Итоги тренировки (§19 ТЗ).
 *
 * Тем же экраном открывается карточка тренировки из истории — данные
 * одинаковые, различается только набор действий внизу.
 */

import { ui } from '../core/ui.js';

export const summary = {

    title: 'Итоги',
    nav: 'workout',

    render(params) {
        const id = params[0];

        return ui.html`
            ${ui.raw(ui.title('Итоги тренировки'))}
            ${ui.raw(ui.stub(
                'Сводка по тренировке',
                3,
                'Таблицы подходов по упражнениям, отметки новых рекордов, тоннаж, '
                + 'среднее число повторений, сохранение как шаблон.'
            ))}
            ${id ? ui.raw(`<div class="hint">Запрошенная тренировка: ${ui.esc(id)}</div>`) : ''}
            <button class="btn btn-ghost" data-action="nav" data-screen="home">← На главную</button>
        `;
    }
};
