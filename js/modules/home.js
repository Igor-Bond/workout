/**
 * Стартовый экран (§29 ТЗ).
 *
 * Первое, что здесь решается, — судьба незавершённой тренировки (§18). Она
 * существует в базе с момента старта, поэтому переживает закрытие вкладки, и
 * пользователь обязан увидеть предложение, а не начинать заново с пустого
 * места.
 */

import { ui } from '../core/ui.js';
import { actions } from '../core/actions.js';
import { dialog } from '../core/dialog.js';
import { dbService } from '../services/db.js';
import { engine } from '../core/engine.js';
import { format } from '../core/format.js';
import { dates } from '../core/dates.js';
import { app } from '../app.js';

/**
 * Порог, после которого тренировку считаем забытой.
 *
 * Продолжать её нельзя: длительность считается от старта, и забытая с вечера
 * тренировка добавила бы к статистике десяток часов (§18).
 */
const STALE_MS = 12 * 60 * 60 * 1000;

async function activeBlock() {
    const workout = await dbService.getActiveWorkout();
    if (!workout) return null;

    const sets = await dbService.listSets(workout.id);
    const totals = engine.totals(workout.plan, sets);
    const stale = Date.now() - workout.startedAt > STALE_MS;

    return ui.html`
        <div class="section">
            <div class="section-title">Незавершённая тренировка</div>

            <div class="card">
                <div class="active-head">
                    <div>
                        <div class="active-type">${workout.type}</div>
                        <div class="active-meta">
                            начата ${dates.formatDayLabel(workout.startedAt)} в ${dates.formatTime(workout.startedAt)}
                            · ${String(totals.done)} из ${String(totals.planned)} подходов
                        </div>
                    </div>
                </div>

                ${stale ? ui.html`
                    <p class="hint">Прошло больше 12 часов. Продолжать её не стоит — время тренировки считается от старта.</p>
                    <button class="btn btn-accent" data-action="home-finish-stale" data-id="${workout.id}">
                        Завершить прошедшей датой
                    </button>
                ` : ui.html`
                    <button class="btn btn-accent" data-action="nav" data-screen="session">Продолжить</button>
                    <button class="btn btn-ghost" data-action="home-finish" data-id="${workout.id}">Завершить как есть</button>
                `}

                <button class="btn btn-danger" data-action="home-drop" data-id="${workout.id}">Удалить</button>
            </div>
        </div>
    `;
}

async function lastBlock() {
    const [last] = await dbService.listWorkouts({ limit: 1 });
    if (!last) return null;

    const sets = await dbService.listSets(last.id);

    return ui.html`
        <div class="section">
            <div class="section-title">Прошлая тренировка</div>
            <button class="history-item" data-action="nav-summary" data-id="${last.id}">
                <span class="h-date">
                    <span>${dates.formatDayLabel(last.startedAt)}</span>
                    <span class="h-badge">${last.type}</span>
                </span>
                <span class="h-stats">
                    ${format.count(sets.length, format.WORDS.set)}
                    · ${format.duration((last.finishedAt || last.startedAt) - last.startedAt)}
                </span>
            </button>
        </div>
    `;
}

export const home = {

    title: 'Тренировка',
    nav: 'workout',

    async render() {
        const [active, last] = await Promise.all([activeBlock(), lastBlock()]);

        return ui.html`
            ${ui.title('Тренировка')}

            ${active || ''}

            ${active ? '' : ui.html`
                <button class="btn btn-accent btn-lg" data-action="nav" data-screen="plan">
                    Начать тренировку
                </button>
            `}

            ${last || ''}

            <div class="section">
                <div class="section-title">Быстрый старт</div>
                ${ui.stub(
                    'Шаблоны и повтор прошлой',
                    5,
                    'Сохранённые тренировки и повтор последней с её фактическим составом.'
                )}
            </div>
        `;
    }
};

// ================== ДЕЙСТВИЯ ==================

actions.on('nav-summary', (el) => app.go('summary', el.dataset.id));

actions.on('home-finish', async (el) => {
    const ok = await dialog.confirm({
        title: 'Завершить тренировку?',
        text: 'Записанные подходы сохранятся, остальное останется невыполненным.',
        confirmText: 'Завершить'
    });

    if (!ok) return;

    await dbService.finishWorkout(el.dataset.id);
    app.go('summary', el.dataset.id);
});

actions.on('home-finish-stale', async (el) => {
    const workout = await dbService.getWorkout(el.dataset.id);
    const sets = await dbService.listSets(workout.id);

    // Временем окончания берём последний записанный подход, а не «сейчас»:
    // иначе забытая тренировка получит десяток часов длительности
    const last = sets[sets.length - 1];
    const finishedAt = last?.performedAt || workout.startedAt;

    await dbService.finishWorkout(workout.id, finishedAt);
    app.go('summary', workout.id);
});

actions.on('home-drop', async (el) => {
    const ok = await dialog.confirm({
        title: 'Удалить тренировку?',
        text: 'Всё записанное в ней пропадёт.',
        confirmText: 'Удалить',
        danger: true
    });

    if (!ok) return;

    await dbService.deleteWorkout(el.dataset.id);
    app.render();
});
