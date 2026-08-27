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

    it('повтор прошлой тренировки предлагается первым и с итогами', async () => {
        const ex = await seed();
        await workout(ex, [[10, 60], [8, 60]]);

        const view = await screen(home);

        assert(has(view, 'Повторить «Силовая»'), 'главный способ начать — повтор');
        assert(has(view, '2 подхода'), 'итоги прошлой видны на самой кнопке');
        assert(hasAction(view, 'nav-plan-repeat'));
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
