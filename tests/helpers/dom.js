/**
 * Помощники для проверок экранов.
 *
 * Экраны возвращают разметку строкой, поэтому проверять их можно без
 * настоящего приложения: разобрать в отдельный узел и спросить, что там
 * оказалось. Ни маршрутизатор, ни сервис-воркер для этого не нужны.
 */

import { dbService } from '../../js/services/db.js';

/**
 * Дать приложению доработать начатое (§45, Р-201).
 *
 * Обработчики действий асинхронны: нажатие возвращает управление сразу, а
 * запись в базу и перерисовка идут следом. Проверке надо дождаться их, и до
 * сих пор она ждала восемьдесят миллисекунд по часам.
 *
 * По часам ждать нельзя. В свёрнутой вкладке браузер растягивает таймеры до
 * секунды — прогон из полутора тысяч проверок встаёт на полторы минуты, — а
 * там, где ожидание опиралось на частоту опроса, оно просто не успевало:
 * пять попыток вместо тысячи. Прогон на чистом коде давал то сорок провалов,
 * то десять, то ни одного, и час ушёл на погоню за призраком.
 *
 * `MessageChannel` таким ограничениям не подчиняется: это такая же задача для
 * очереди событий, но без растяжения. Отдать ей управление много раз подряд
 * — это ровно то, чего проверке и надо: пусть доработают все обещания,
 * запросы к базе и отрисовки, сколько бы их ни было.
 */
export function тик() {
    return new Promise((resolve) => {
        const канал = new MessageChannel();

        канал.port1.onmessage = () => resolve();
        канал.port2.postMessage(0);
    });
}

/**
 * Дать доработать.
 *
 * Полтораста оборотов: самая длинная цепочка в приложении — утверждение плана
 * — это разбор текста, заведение недостающих упражнений, запись плана, запись
 * решения в журнал и переход на главный, и каждый шаг ходит в базу. Двадцати
 * оборотов ей не хватало.
 *
 * Дорого это не стоит: оборот очереди — это микросекунды, и весь прогон с
 * полутора тысячами проверок укладывается в двадцать секунд против прежних
 * девяноста.
 */
export async function осесть(оборотов = 150) {
    for (let i = 0; i < оборотов; i++) await тик();
}

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

    await осесть();
    btn.remove();
}

/**
 * Вписать в поле так, как это делает пользователь.
 *
 * Тем же делегированием, что и `press`: обработчики правки подписаны на
 * документ, и достать их можно только настоящим событием.
 */
export async function change(name, value, dataset = {}) {
    const field = document.createElement('input');

    field.dataset.change = name;
    Object.assign(field.dataset, dataset);
    field.value = String(value);

    document.body.appendChild(field);
    field.dispatchEvent(new Event('change', { bubbles: true }));

    await осесть();
    field.remove();
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
