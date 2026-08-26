/**
 * Стартовый экран (§29 ТЗ).
 *
 * Отсюда начинается любая тренировка. Порядок блоков соответствует частоте
 * использования: продолжить начатое, повторить прошлое, взять шаблон,
 * составить с нуля.
 */

import { ui } from '../core/ui.js';

export const home = {

    title: 'Тренировка',
    nav: 'workout',

    render() {
        return ui.html`
            ${ui.raw(ui.title('Тренировка'))}

            <button class="btn btn-accent btn-lg" data-action="nav" data-screen="plan">
                Начать тренировку
            </button>

            <div class="section">
                <div class="section-title">Незавершённая тренировка</div>
                ${ui.raw(ui.stub(
                    'Продолжение начатого',
                    3,
                    'Активная тренировка будет храниться в базе с момента старта, '
                    + 'и приложение предложит её продолжить, завершить или удалить.'
                ))}
            </div>

            <div class="section">
                <div class="section-title">Быстрый старт</div>
                ${ui.raw(ui.stub(
                    'Шаблоны и повтор прошлой',
                    5,
                    'Сохранённые тренировки и повтор последней с её фактическим составом.'
                ))}
                <button class="btn btn-ghost" data-action="nav" data-screen="templates">
                    Открыть шаблоны
                </button>
            </div>
        `;
    }
};
