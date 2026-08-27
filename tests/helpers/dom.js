/**
 * Помощники для проверок экранов.
 *
 * Экраны возвращают разметку строкой, поэтому проверять их можно без
 * настоящего приложения: разобрать в отдельный узел и спросить, что там
 * оказалось. Ни маршрутизатор, ни сервис-воркер для этого не нужны.
 */

import { dbService } from '../../js/services/db.js';

/** Разметка экрана в виде узла, по которому можно искать. */
export function parse(html) {
    const box = document.createElement('div');
    box.innerHTML = String(html);
    return box;
}

/** Отрисовать экран и разобрать результат. */
export async function screen(module, params = []) {
    return parse(await module.render(params));
}

/** Весь текст узла одной строкой — удобно спрашивать «а есть ли там». */
export function text(node) {
    return (node?.textContent || '').replace(/\s+/g, ' ').trim();
}

/** Есть ли в разметке кнопка с таким действием. */
export function hasAction(node, action) {
    return !!node.querySelector(`[data-action="${action}"]`);
}

/**
 * Нажать действие так, как это делает пользователь.
 *
 * Через настоящее делегирование событий: часть экранов держит состояние в
 * модуле (отбор в истории, период в статистике), и добраться до него можно
 * только тем же путём, что и пользователь.
 */
export async function press(action, dataset = {}) {
    const btn = document.createElement('button');
    btn.dataset.action = action;
    Object.assign(btn.dataset, dataset);

    document.body.appendChild(btn);
    btn.click();

    await new Promise((r) => setTimeout(r, 80));
    btn.remove();
}

/** Чистая база с одним упражнением — основа для большинства проверок. */
export async function seed({ name = 'Жим лёжа', kind = 'weight', group = 'Грудь' } = {}) {
    await dbService.open();
    await dbService.wipe();

    return dbService.createExercise({ name, kind, group });
}

/**
 * Завершённая тренировка с подходами.
 * sets — массив вида [[повторения, вес], ...].
 */
export async function workout(exercise, sets = [[10, 60]], { at = Date.now(), type = 'Силовая' } = {}) {
    const record = await dbService.createWorkout({
        type,
        plan: [{ exerciseId: exercise.id, plannedSets: sets.length, targetReps: sets[0][0], weight: sets[0][1], skipped: false }]
    });

    for (let i = 0; i < sets.length; i++) {
        await dbService.addSet({
            workoutId: record.id,
            exerciseId: exercise.id,
            order: i + 1,
            setNumber: i + 1,
            reps: sets[i][0],
            weight: sets[i][1] || undefined,
            performedAt: at + i * 60000
        });
    }

    await dbService.updateWorkout(record.id, { startedAt: at });
    await dbService.finishWorkout(record.id, at + 1800000);

    return dbService.getWorkout(record.id);
}
