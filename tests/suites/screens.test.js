/**
 * Проверки экранов (§45 ТЗ).
 *
 * До них все ошибки в модулях экранов ловились руками через браузер — и два
 * дефекта из разбора нашлись именно так, случайно. Здесь закрыты те пути,
 * по которым пользователь ходит каждый день, и отдельно — состояния,
 * которые легко забыть: пустая база, отсутствующая запись, история, не
 * соответствующая виду упражнения.
 *
 * Настоящего приложения не требуется: экраны возвращают разметку строкой.
 */

import { describe, it, equal, assert } from '../runner.js';
import { screen, text, hasAction, press, seed, workout } from '../helpers/dom.js';

import { home } from '../../js/modules/home.js';
import { history } from '../../js/modules/history.js';
import { calendar } from '../../js/modules/calendar.js';
import { stats } from '../../js/modules/stats.js';
import { recordsScreen } from '../../js/modules/records.js';
import { templates } from '../../js/modules/templates.js';
import { session } from '../../js/modules/session.js';
import { summary } from '../../js/modules/summary.js';
import { exercise as exerciseCard } from '../../js/modules/exercise.js';
import { exercises } from '../../js/modules/exercises.js';

import { dbService } from '../../js/services/db.js';

const DAY = 86400000;
const has = (node, part) => text(node).includes(part);

describe('Экран: главная', () => {

    it('пустая база предлагает начать тренировку', async () => {
        await seed();
        const view = await screen(home);

        assert(hasAction(view, 'nav'), 'кнопка начала должна быть');
        assert(has(view, 'Начать тренировку'));
        assert(!has(view, 'Незавершённая'), 'нечего продолжать');
    });

    it('незавершённая тренировка предлагается к продолжению', async () => {
        const ex = await seed();
        await dbService.createWorkout({ type: 'Силовая', plan: [
            { exerciseId: ex.id, plannedSets: 3, targetReps: 10, weight: 60, skipped: false }
        ]});

        const view = await screen(home);

        assert(has(view, 'Незавершённая тренировка'));
        assert(has(view, 'Продолжить'));
        assert(has(view, '0 из 3 подходов'), 'прогресс должен быть виден сразу');
    });

    it('забытая тренировка предлагается к завершению, а не к продолжению', async () => {
        const ex = await seed();
        const w = await dbService.createWorkout({ type: 'Силовая', plan: [
            { exerciseId: ex.id, plannedSets: 3, targetReps: 10, weight: 60, skipped: false }
        ]});

        // Старше двенадцати часов (§18)
        await dbService.updateWorkout(w.id, { startedAt: Date.now() - 20 * 3600000 });

        const view = await screen(home);

        assert(has(view, 'Завершить прошедшей датой'));
        assert(!has(view, 'Продолжить'), 'иначе к длительности прибавятся забытые часы');
    });

    it('повтор прошлой тренировки предлагается упражнениями, а не типом', async () => {
        const ex = await seed();
        await workout(ex, [[10, 60], [8, 60]]);

        const view = await screen(home);

        assert(hasAction(view, 'nav-plan-repeat'), 'главный способ начать — повтор');
        assert(has(view, 'Жим лёжа'), 'тренировку узнают по упражнениям');
        assert(has(view, '2 подхода'), 'итоги прошлой видны на самой карточке');
    });

    /*
     * Подсказка по периодичности упражнений (§26.2.3). Она точнее подсказки
     * по типу тренировки: тип у всех может быть один — «Силовая», — и цикла
     * в одинаковых значениях нет.
     */
    it('предлагает упражнения, которым пора', async () => {
        const жим = await seed({ name: 'Жим лёжа' });
        const пресс = await dbService.createExercise({ name: 'Пресс', kind: 'reps' });

        // Жим раз в три дня, а не было девять — просрочен втрое
        for (const daysAgo of [9, 12, 15]) {
            await workout(жим, [[10, 60]], { at: Date.now() - daysAgo * DAY });
        }

        // Пресс раз в два дня и делали вчера — он в графике
        for (const daysAgo of [1, 3, 5]) {
            await workout(пресс, [[20, 0]], { at: Date.now() - daysAgo * DAY });
        }

        const view = await screen(home);

        assert(has(view, 'Пора по периодичности'));
        assert(has(view, 'Жим лёжа'));
        assert(hasAction(view, 'nav-plan-due'), 'из просроченного собирается тренировка');
    });

    it('последние семь дней показывают проведённое', async () => {
        const ex = await seed();
        await workout(ex, [[10, 60], [8, 60]]);

        const view = await screen(home);

        assert(has(view, 'Последние семь дней'));
        assert(has(view, 'Тоннаж'));
    });

    /*
     * Вес показывается только тем, кто его ведёт: строка с просьбой
     * взвеситься заняла бы место обращением, а не сведениями.
     */
    it('вес тела появляется, только когда он отмечался', async () => {
        const ex = await seed();
        await workout(ex, [[10, 60]]);

        assert(!has(await screen(home), 'Вес тела'), 'без взвешиваний блока нет');

        await dbService.setBodyWeight({ weight: 78.4 });
        const view = await screen(home);

        assert(has(view, '78,4'));
        assert(hasAction(view, 'body-add'), 'запись открывается в одно нажатие');
    });

    /*
     * Одновременно идёт одна тренировка (§18). Пока она не закрыта, способы
     * начать новую только отвлекают: любой из них упрётся в тот же вопрос
     * о её судьбе, который задан выше на этом же экране.
     */
    it('при незавершённой тренировке способы начать новую не показываются', async () => {
        const ex = await seed();
        await workout(ex, [[10, 60]]);
        await dbService.createWorkout({ type: 'Силовая', plan: [
            { exerciseId: ex.id, plannedSets: 3, targetReps: 10, weight: 60, skipped: false }
        ]});

        const view = await screen(home);

        assert(has(view, 'Продолжить'));
        assert(!hasAction(view, 'nav-plan-repeat'), 'повтор увёл бы от незакрытой тренировки');
        assert(!has(view, 'Начать тренировку'));
    });
});

describe('Экран: история', () => {

    it('пустая история так и говорит', async () => {
        await seed();
        const view = await screen(history);

        assert(has(view, 'Проведённых тренировок пока нет'));
    });

    it('показывает состав и итоги тренировки', async () => {
        const ex = await seed();
        await workout(ex, [[10, 60], [8, 60]]);

        const view = await screen(history);

        assert(has(view, 'Жим лёжа'));
        assert(has(view, '2 подхода'));
        assert(has(view, '18 повторений'));
    });

    it('длинная история показывается по частям', async () => {
        const ex = await seed();
        for (let i = 0; i < 35; i++) await workout(ex, [[10, 60]], { at: Date.now() - i * DAY });

        await press('hist-reset');
        const view = await screen(history);

        equal(view.querySelectorAll('.history-item').length, 30, 'строить восемьсот карточек незачем');
        assert(hasAction(view, 'hist-more'));
        assert(has(view, 'Показать ещё 5 из 5'));
    });

    it('следующая часть достраивает список', async () => {
        const ex = await seed();
        for (let i = 0; i < 35; i++) await workout(ex, [[10, 60]], { at: Date.now() - i * DAY });

        await press('hist-reset');
        await press('hist-more');
        const view = await screen(history);

        equal(view.querySelectorAll('.history-item').length, 35);
        assert(!hasAction(view, 'hist-more'), 'показывать больше нечего');
    });

    it('фильтр по типу сужает список и начинает показ заново', async () => {
        const ex = await seed();
        for (let i = 0; i < 35; i++) await workout(ex, [[10, 60]], { at: Date.now() - i * DAY });
        await workout(ex, [[20, 0]], { at: Date.now(), type: 'Зарядка' });

        await press('hist-reset');
        await press('hist-more');
        await press('hist-type', { type: 'Зарядка' });

        const view = await screen(history);

        equal(view.querySelectorAll('.history-item').length, 1);
        assert(has(view, 'Подходит: 1 из 36'));

        await press('hist-reset');
    });
});

describe('Экран: итоги', () => {

    it('несуществующая тренировка не роняет экран', async () => {
        await seed();
        const view = await screen(summary, ['нет-такой']);

        assert(has(view, 'не найдена'));
    });

    it('показывает подходы, тоннаж и среднее', async () => {
        const ex = await seed();
        const w = await workout(ex, [[10, 60], [8, 60]]);

        const view = await screen(summary, [w.id]);

        assert(has(view, 'Жим лёжа'));
        assert(has(view, '1080'), 'тоннаж 10×60 + 8×60');
        assert(has(view, '18'), 'повторений');
    });

    it('новый рекорд отмечается', async () => {
        const ex = await seed();
        await workout(ex, [[10, 60]], { at: Date.now() - 7 * DAY });
        const second = await workout(ex, [[8, 70]], { at: Date.now() });

        const view = await screen(summary, [second.id]);

        assert(has(view, 'Новый рекорд'));
        assert(has(view, '70 кг × 8'));
    });

    it('повторение прежнего результата рекордом не считается', async () => {
        const ex = await seed();
        await workout(ex, [[10, 60]], { at: Date.now() - 7 * DAY });
        const second = await workout(ex, [[10, 60]], { at: Date.now() });

        assert(!has(await screen(summary, [second.id]), 'Новый рекорд'));
    });
});

describe('Экран: карточка упражнения', () => {

    it('несуществующее упражнение не роняет экран', async () => {
        await seed();
        assert(has(await screen(exerciseCard, ['нет-такого']), 'не найдено'));
    });

    it('упражнение без истории так и говорит', async () => {
        const ex = await seed();
        assert(has(await screen(exerciseCard, [ex.id]), 'ни разу не выполнялось'));
    });

    it('показывает рекорд и суммы', async () => {
        const ex = await seed();
        await workout(ex, [[10, 60], [8, 65]]);

        const view = await screen(exerciseCard, [ex.id]);

        assert(has(view, '65 кг × 8'), 'лучший результат');
        assert(has(view, 'Подходов'));
    });

    /*
     * Тот самый дефект из разбора: вид упражнения меняли в справочнике, и
     * вся его история превращалась в «00:00».
     */
    it('смена вида не обнуляет историю', async () => {
        const ex = await seed();
        await workout(ex, [[10, 60], [8, 65]]);

        await dbService.updateExercise(ex.id, { kind: 'time' });
        const view = await screen(exerciseCard, [ex.id]);

        assert(has(view, '65 кг × 8'), 'история считается по подходам, а не по текущему виду');
        assert(!has(view, '00:00'));
    });
});

describe('Экран: справочник', () => {

    it('используемое упражнение удалить нельзя', async () => {
        const ex = await seed();
        await workout(ex, [[10, 60]]);

        const row = (await screen(exercises)).querySelector('.ex-row');

        assert(!row.querySelector('[data-action="ex-delete"]'), 'удаление разорвало бы историю');
        assert(row.querySelector('[data-action="ex-archive"]'), 'но архивировать можно');
    });

    it('неиспользованное удалить можно', async () => {
        await seed();
        const row = (await screen(exercises)).querySelector('.ex-row');

        assert(row.querySelector('[data-action="ex-delete"]'));
    });

    it('объединение доступно у каждого упражнения', async () => {
        await seed();
        assert(hasAction(await screen(exercises), 'ex-merge'));
    });

    it('архив показывается отдельным разделом', async () => {
        const ex = await seed();
        await dbService.setExerciseArchived(ex.id, true);

        const view = await screen(exercises);

        assert(has(view, 'Архив'));
        assert(hasAction(view, 'ex-restore'));
    });
});

describe('Экран: выполнение', () => {

    it('без активной тренировки предлагает составить', async () => {
        await seed();
        const view = await screen(session);

        assert(has(view, 'Активной тренировки нет'));
        assert(has(view, 'Составить тренировку'));
    });

    it('показывает текущее упражнение и номер подхода', async () => {
        const ex = await seed();
        await dbService.createWorkout({ type: 'Силовая', plan: [
            { exerciseId: ex.id, plannedSets: 3, targetReps: 10, weight: 60, skipped: false }
        ]});

        const view = await screen(session);

        assert(has(view, 'Жим лёжа'));
        assert(has(view, 'Подход 1 из 3'));
        assert(view.querySelector('#f-reps'), 'силовое упражнение спрашивает повторения');
        assert(view.querySelector('#f-weight'));
    });

    it('поля соответствуют виду упражнения', async () => {
        const plank = await seed({ name: 'Планка', kind: 'time', group: 'Пресс' });
        await dbService.createWorkout({ type: 'Силовая', plan: [
            { exerciseId: plank.id, plannedSets: 2, targetReps: null, weight: 0, skipped: false }
        ]});

        const view = await screen(session);

        assert(view.querySelector('#f-duration'), 'у планки спрашивают время');
        assert(!view.querySelector('#f-reps'), 'а не повторения');
    });

    it('первое выполнение честно говорит, что ориентиров нет', async () => {
        const ex = await seed();
        await dbService.createWorkout({ type: 'Силовая', plan: [
            { exerciseId: ex.id, plannedSets: 3, targetReps: 10, weight: 60, skipped: false }
        ]});

        assert(has(await screen(session), 'ориентиров пока нет'));
    });

    it('прошлый результат показывается перед подходом', async () => {
        const ex = await seed();
        await workout(ex, [[10, 60], [9, 60]], { at: Date.now() - 3 * DAY });

        await dbService.createWorkout({ type: 'Силовая', plan: [
            { exerciseId: ex.id, plannedSets: 3, targetReps: 10, weight: 60, skipped: false }
        ]});

        const view = await screen(session);

        assert(has(view, 'Последний раз'));
        assert(has(view, '60 кг × 10, 60 × 9'));
    });
});

describe('Экран: статистика и рекорды', () => {

    it('пустая база не роняет статистику', async () => {
        await seed();
        assert(has(await screen(stats), 'сначала проведи тренировку'));
    });

    it('считает показатели за период', async () => {
        const ex = await seed();
        await workout(ex, [[10, 60], [8, 60]], { at: Date.now() - DAY });

        const view = await screen(stats);

        assert(has(view, 'Тренировок'));
        assert(has(view, 'Подходов'));
        assert(has(view, 'Вес тела'), 'блок веса тела должен быть даже без записей');
    });

    it('рекорды без истории так и говорят', async () => {
        await seed();
        assert(has(await screen(recordsScreen), 'появятся после первой тренировки'));
    });

    it('рекорд показывается по каждому упражнению', async () => {
        const ex = await seed();
        await workout(ex, [[10, 60], [8, 70]]);

        const view = await screen(recordsScreen);

        assert(has(view, 'Жим лёжа'));
        assert(has(view, '70 кг × 8'));
    });
});

describe('Экран: календарь и шаблоны', () => {

    it('календарь показывает месяц и считает тренировки', async () => {
        const ex = await seed();
        await workout(ex, [[10, 60]]);

        const view = await screen(calendar);

        assert(view.querySelector('.cal-grid'), 'сетка должна быть');
        assert(has(view, '1 тренировка'));
    });

    it('день без тренировки нажать нельзя', async () => {
        await seed();
        const view = await screen(calendar);
        const cells = [...view.querySelectorAll('[data-action="cal-day"]')];

        assert(cells.length > 0);
        assert(cells.every((c) => c.hasAttribute('disabled')), 'иначе откроется пустая карточка дня');
    });

    it('пустые шаблоны объясняют, откуда они берутся', async () => {
        await seed();
        assert(has(await screen(templates), 'сохранить из проведённой тренировки'));
    });

    it('шаблон показывает состав', async () => {
        const ex = await seed();
        await dbService.saveTemplate({ name: 'Грудь', type: 'Силовая', items: [
            { exerciseId: ex.id, plannedSets: 3, targetReps: 10, weight: 60 }
        ]});

        const view = await screen(templates);

        assert(has(view, 'Грудь'));
        assert(has(view, 'Жим лёжа'));
        assert(has(view, '3 подхода'));
    });
});

describe('Экран: правка подхода', () => {

    /*
     * Поля выбирались по тому, что в подходе уже записано, — и подход
     * силового упражнения без веса состоял из одних повторений: добавить
     * вес было нечем. На это и пожаловались.
     */
    it('поле есть, даже если величину в подходе забыли', async () => {
        const ex = await seed({ name: 'Жим лёжа', kind: 'weight' });
        const w = await dbService.createWorkout({ type: 'Силовая', plan: [] });

        // Вес не указан вовсе
        await dbService.addSet({ workoutId: w.id, exerciseId: ex.id, order: 1, setNumber: 1, reps: 10 });
        await dbService.finishWorkout(w.id);

        const [подход] = await dbService.listSets(w.id);
        await dbService.updateSet(подход.id, { weight: 60 });

        equal((await dbService.listSets(w.id))[0].weight, 60, 'вес обязан добавляться к записанному подходу');
    });

    it('кардио правится и дистанцией, и временем', async () => {
        const ex = await seed({ name: 'Бег', kind: 'distance' });
        const w = await dbService.createWorkout({ type: 'Кардио', plan: [] });

        // Записано только время — дистанцию забыли
        await dbService.addSet({ workoutId: w.id, exerciseId: ex.id, order: 1, setNumber: 1, duration: 1500 });
        await dbService.finishWorkout(w.id);

        const [подход] = await dbService.listSets(w.id);
        await dbService.updateSet(подход.id, { distance: 5000 });

        const [после] = await dbService.listSets(w.id);
        equal(после.distance, 5000);
        equal(после.duration, 1500, 'нетронутое остаётся как было');
    });

    it('правка и удаление подхода стоят рядом, но не вплотную', async () => {
        const ex = await seed();
        await workout(ex, [[10, 60]]);

        const view = await screen(summary, [(await dbService.listWorkoutSummaries())[0].workout.id]);

        assert(hasAction(view, 'summary-edit-set'), 'править подход можно');
        assert(hasAction(view, 'summary-drop-set'));
    });
});

describe('Экран: журнал подходов по видам', () => {

    /*
     * Колонок было две на все виды сразу — «значение» и «вес / дистанция», —
     * и под одним заголовком оказывались килограммы, метры и секунды.
     * Размерность нагрузки у каждого вида своя, и называть её общим словом
     * значит не называть вовсе.
     */
    const колонки = (view) => [...view.querySelectorAll('thead th')]
        .map((th) => th.textContent.trim())
        .filter(Boolean);

    async function однимУпражнением(kind, набор) {
        const ex = await seed({ name: 'Проба', kind });
        const w = await dbService.createWorkout({ type: 'Проба', plan: [] });

        await dbService.addSet({ workoutId: w.id, exerciseId: ex.id, order: 1, setNumber: 1, ...набор });
        await dbService.finishWorkout(w.id);

        return screen(summary, [w.id]);
    }

    it('силовое упражнение — повторения и вес в килограммах', async () => {
        const view = await однимУпражнением('weight', { reps: 10, weight: 62.5 });

        equal(колонки(view), ['Подход', 'Повторения', 'Вес, кг']);
        assert(has(view, '62,5'), 'единица стоит в заголовке, а не в каждой строке');
    });

    it('собственный вес — только повторения', async () => {
        const view = await однимУпражнением('reps', { reps: 25 });

        equal(колонки(view), ['Подход', 'Повторения'], 'колонки веса быть не должно');
    });

    it('упражнение на время — только время', async () => {
        const view = await однимУпражнением('time', { duration: 95 });

        equal(колонки(view), ['Подход', 'Время']);
        assert(has(view, '01:35'));
    });

    it('кардио — дистанция и время', async () => {
        const view = await однимУпражнением('distance', { distance: 5000, duration: 1500 });

        equal(колонки(view), ['Подход', 'Дистанция', 'Время']);
        assert(has(view, '5 км'), 'у дистанции единица меняется, поэтому стоит в клетке');
    });

    /*
     * Вид меняют в справочнике, а записанное от этого не меняется. Спрятать
     * величину, которой по нынешнему виду быть не должно, значит её потерять.
     */
    it('величина не по виду упражнения всё равно показывается', async () => {
        const view = await однимУпражнением('time', { duration: 60, weight: 5 });

        equal(колонки(view), ['Подход', 'Вес, кг', 'Время']);
    });
});
