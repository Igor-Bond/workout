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
import { plan } from '../../js/modules/plan.js';
import { intervalScreen } from '../../js/modules/interval.js';
import { summary } from '../../js/modules/summary.js';
import { exercise as exerciseCard } from '../../js/modules/exercise.js';
import { exercises } from '../../js/modules/exercises.js';
import { profile } from '../../js/modules/profile.js';
import { guide } from '../../js/modules/guide.js';
import { surveyScreen } from '../../js/modules/survey.js';
import { survey } from '../../js/core/survey.js';
import { dialog } from '../../js/core/dialog.js';
import { restTimer } from '../../js/core/timer.js';
import { config } from '../../js/config.js';

import { beeper } from '../../js/core/beeper.js';
import { dbService } from '../../js/services/db.js';

const DAY = 86400000;
const has = (node, part) => text(node).includes(part);

describe('Экран: главная', () => {

    /*
     * «Новая тренировка», а не «Начать»: кнопка ведёт на подбор упражнений, а сама
     * тренировка стартует уже оттуда. Одинаковая надпись на двух разных
     * действиях обещала первым нажатием то, чего оно не делает.
     */
    it('пустая база предлагает новую тренировку', async () => {
        await seed();
        const view = await screen(home);

        assert(hasAction(view, 'nav'), 'кнопка начала должна быть');
        assert(has(view, 'Новая тренировка'));
        assert(!has(view, 'Начать тренировку'), 'начинать пока нечего — упражнения не выбраны');
        assert(!has(view, 'Незавершённая'), 'нечего продолжать');

        // Разделы появляются, только когда им есть что показать
        for (const раздел of ['На очереди', 'Следом', 'Пора вернуться', 'Чаще всего', 'Забытое']) {
            assert(!has(view, раздел), `«${раздел}» без данных не показывается`);
        }
    });

    /*
     * Заголовок обязан описывать то, что под ним. Один на все три ветки
     * означал, что над шаблонами у человека без единой тренировки стояло
     * «Пора вернуться» — возвращаться было некуда (§29.1).
     */
    it('заголовок называет то, что под ним, а не место, где стоит', async () => {
        const ex = await seed();

        await dbService.saveTemplate({
            name: 'Ноги',
            type: 'Силовая',
            items: [{ exerciseId: ex.id, plannedSets: 3, targetReps: 10, weight: 50 }]
        });

        const пусто = await screen(home);

        assert(has(пусто, 'Шаблоны'), 'без истории под плашками стоят шаблоны');
        assert(!has(пусто, 'Пора вернуться'), 'возвращаться некуда — тренировок не было');

        // Два раза — состав повторяется, но промежутка ещё не знаем
        await workout(ex, [[10, 60]], { at: Date.now() - 2 * DAY });
        await workout(ex, [[10, 60]], { at: Date.now() - 6 * DAY });

        const мало = await screen(home);

        assert(has(мало, 'Что повторяете'), 'ритма ещё нет, но повтор уже виден');
        assert(has(мало, '2 дн'), 'подпись та же, что везде');
        assert(!has(мало, '×'), 'множителя повторов на экране больше нет');
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
     * Плашка быстрого старта — это долг состава (§29.1): прошло больше
     * обычного, и одно нажатие его закрывает.
     */
    it('предлагает вернуться к просроченному составу', async () => {
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

        assert(has(view, 'Жим лёжа'), 'просроченное предлагается');
        assert(has(view, '9 дн'), 'подпись — дни с прошлого раза');
        // Пресс делали вчера, он в графике — а значит, показана ветка долгов,
        // а не запасная частотная с множителем
        assert(!has(view, '×'), 'при долгах множитель частоты не показывается');
        assert(hasAction(view, 'home-like'), 'нажатие повторяет ту самую тренировку');

        // Плашка уже предлагает жим одним нажатием — карточке нечего добавить
        assert(!has(view, 'Забытое'), 'одни и те же названия дважды на экране не стоят');
    });

    /*
     * Первый из очереди стоит карточкой на самом видном месте (§29.1).
     *
     * Раньше там был повтор прошлой, и для чередующего группы это был
     * антисовет: вчера была спина — сегодня спина не нужна.
     */
    it('на самом видном месте — первый из очереди, а не вчерашнее', async () => {
        const спина = await seed({ name: 'Тяга' });
        const пресс = await dbService.createExercise({ name: 'Пресс', kind: 'reps' });

        // Тяга раз в три дня, не было девять
        for (const daysAgo of [9, 12, 15]) {
            await workout(спина, [[10, 60]], { at: Date.now() - daysAgo * DAY });
        }

        // Пресс через день, делали вчера
        for (const daysAgo of [1, 3, 5]) {
            await workout(пресс, [[20, 0]], { at: Date.now() - daysAgo * DAY });
        }

        const view = await screen(home);

        assert(has(view, 'На очереди'));
        assert(!has(view, 'Повторить прошлую'), 'повтор переехал в историю');

        const карточка = text(view).indexOf('На очереди');
        const следом = text(view).indexOf('Следом');

        assert(следом > карточка, 'остальная очередь идёт под карточкой');
        assert(text(view).slice(карточка, следом).includes('Тяга'), 'в карточке — просроченное, а не вчерашнее');
        assert(!text(view).slice(следом).includes('Тяга'), 'первый не повторяется плашкой ниже');
    });

    /*
     * Зарядку убрали из очереди (§29.1) — и она пропала с экрана целиком:
     * начать её стало можно только через шаблоны, хотя делают её чаще всего
     * остального. Свой раздел вернул ей быстрый путь.
     */
    it('зарядка стоит своим разделом, а не в очереди', async () => {
        const жим = await seed({ name: 'Жим лёжа' });
        const пресс = await dbService.createExercise({ name: 'Пресс', kind: 'reps' });

        for (const daysAgo of [4, 8, 12]) {
            await workout(жим, [[10, 60]], { at: Date.now() - daysAgo * DAY });
        }

        for (const daysAgo of [1, 2, 3, 4]) {
            await workout(пресс, [[20, 0]], { at: Date.now() - daysAgo * DAY, type: 'Зарядка' });
        }

        const view = await screen(home);
        const строка = text(view);

        assert(has(view, 'Чаще всего'));

        const день = строка.indexOf('Чаще всего');

        assert(строка.slice(день).includes('Пресс'), 'зарядка — в своём разделе');
        assert(!строка.slice(0, день).includes('Пресс'), 'и не в очереди выше');
        assert(строка.slice(0, день).includes('Жим лёжа'), 'а целевая тренировка — в очереди');
    });

    /*
     * Для очереди «сделанное сегодня не показывается» — правило верное:
     * закрытый долг обязан уйти с глаз. Для ежедневного оно отвечает не на
     * тот вопрос: к зарядке вопрос единственный — сегодня уже или ещё нет, —
     * и пустое место на него не отвечает (§29.1).
     */
    it('сделанная сегодня зарядка остаётся и метится цветом', async () => {
        const пресс = await seed({ name: 'Пресс', kind: 'reps' });

        for (const daysAgo of [0, 1, 2, 3]) {
            await workout(пресс, [[20, 0]], { at: Date.now() - daysAgo * DAY, type: 'Зарядка' });
        }

        const view = await screen(home);

        assert(has(view, 'Чаще всего'), 'раздел не исчезает после выполнения');
        assert(has(view, 'сегодня'), 'подпись говорит «сегодня», а не «0 дн»');
        assert(view.querySelector('.chip.is-done'), 'сделанное отмечено цветом');
        assert(!view.querySelector('.chip.is-todo'), 'и не помечено как несделанное');
    });

    /*
     * Очередь строится по повторяющимся составам, и пока их нет, предложить
     * нечего. Экран без единого предложения хуже неточного предложения —
     * поэтому здесь повтор остаётся.
     */
    it('без очереди на видном месте остаётся повтор прошлой', async () => {
        const ex = await seed();
        await workout(ex, [[10, 60], [8, 60]]);

        const view = await screen(home);

        assert(has(view, 'Повторить прошлую'));
        assert(!has(view, 'На очереди'), 'очереди нет — и называть её нечем');
    });

    /*
     * Подсказка по периодичности упражнений (§26.2.3). Она точнее подсказки
     * по типу тренировки: тип у всех может быть один — «Силовая», — и цикла
     * в одинаковых значениях нет.
     *
     * Плашки её не заменяют: они знают только целые составы, а упражнение
     * может расходиться по разным тренировкам и не повторить ни одной. Тогда
     * состав неизвестен, а долг упражнения — известен, и собирается он
     * карточкой.
     */
    it('предлагает упражнения, которым пора, когда состав не повторялся', async () => {
        const жим = await seed({ name: 'Жим лёжа' });

        const пары = [
            await dbService.createExercise({ name: 'Пресс', kind: 'reps' }),
            await dbService.createExercise({ name: 'Планка', kind: 'time' }),
            await dbService.createExercise({ name: 'Приседания', kind: 'reps' })
        ];

        // Жим раз в три дня, а не было девять — но каждый раз с новым соседом,
        // и потому ни один состав не повторился
        for (let i = 0; i < 3; i++) {
            const at = Date.now() - (9 + i * 3) * DAY;
            const пара = пары[i];

            const w = await dbService.createWorkout({ type: 'Силовая', plan: [
                { exerciseId: жим.id, plannedSets: 1, targetReps: 10, weight: 60, skipped: false },
                { exerciseId: пара.id, plannedSets: 1, targetReps: 20, weight: 0, skipped: false }
            ]});

            for (const ex of [жим, пара]) {
                await dbService.addSet({ workoutId: w.id, exerciseId: ex.id, order: 1, setNumber: 1, reps: 10, performedAt: at });
            }

            await dbService.updateWorkout(w.id, { startedAt: at });
            await dbService.finishWorkout(w.id, at + 1800000);
        }

        const view = await screen(home);

        assert(has(view, 'Забытое'), 'выпавшее из очереди упражнение вынесено в свой раздел');
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
        assert(!has(view, 'Новая тренировка'));
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

    /*
     * Повтор живёт здесь, а не на главной (§29.1): там его место заняла
     * очередь. Нужен он изредка — не доделал, хочешь тот же состав, — и
     * тогда за ним идут в историю, к нужной тренировке.
     */
    it('из истории тренировку можно повторить', async () => {
        const ex = await seed();
        const w = await workout(ex, [[10, 60]]);

        assert(hasAction(await screen(summary, [w.id]), 'summary-repeat'));

        // Сразу после занятия звать повторить его же незачем: экран
        // подводит итог, а не предлагает начать сначала
        assert(!hasAction(await screen(summary, [w.id, 'done']), 'summary-repeat'));
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

    /*
     * Тренировка записана ещё до того, как открылся этот экран, — кнопки
     * «Сохранить» здесь быть не может. Но без прямой строки об этом экран
     * читается незаконченным: показывает итоги, предлагает править и ничем
     * не подтверждает, что записанное уцелеет, если просто уйти.
     */
    it('только что законченная тренировка объявлена записанной', async () => {
        const ex = await seed();
        const w = await workout(ex, [[10, 60]]);

        const view = await screen(summary, [w.id, 'done']);

        assert(has(view, 'Тренировка записана'));
        assert(has(view, 'Готово'), 'ярким должен быть выход с экрана');
        assert(!!view.querySelector('.btn-accent[data-screen="home"]'), 'выход ведёт на главную');
    });

    /*
     * Листающему историю это ни к чему: он и так знает, что смотрит
     * прошлое, а «Готово» обещало бы завершение того, что давно кончилось.
     */
    it('та же тренировка из истории обходится без объявления', async () => {
        const ex = await seed();
        const w = await workout(ex, [[10, 60]]);

        const view = await screen(summary, [w.id]);

        assert(!has(view, 'Тренировка записана'));
        assert(!has(view, 'Готово'));
        assert(!!view.querySelector('.btn-accent[data-screen="history"]'), 'ярким остаётся возврат в историю');
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

    /*
     * На подбор упражнений ведут три кнопки — с главной, отсюда и с итогов.
     * Названы они одинаково: один переход должен называться одним словом,
     * иначе три названия читаются как три разных действия.
     */
    it('без активной тренировки предлагает новую', async () => {
        await seed();
        const view = await screen(session);

        assert(has(view, 'Активной тренировки нет'));
        assert(has(view, 'Новая тренировка'));
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
        assert(has(view, '60 кг × 10, 9'), 'вес не повторяется, пока не изменился');
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

    /*
     * У собственного веса вес тоже есть — довес: пояс на подтягиваниях,
     * блин на брусьях. Нагрузка от него и считается: повторения × (вес тела
     * + довес). Без колонки его негде ни увидеть, ни исправить.
     */
    it('собственный вес — повторения и довес', async () => {
        const view = await однимУпражнением('reps', { reps: 25 });

        equal(колонки(view), ['Подход', 'Повторения', 'Вес, кг']);
        assert(has(view, '—'), 'без довеса клетка пустует, но колонка на месте');
    });

    it('довес показывается и правится', async () => {
        const view = await однимУпражнением('reps', { reps: 8, weight: 20 });

        equal(колонки(view), ['Подход', 'Повторения', 'Вес, кг']);
        assert(has(view, '20'));
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

describe('Экран: интервальная программа', () => {

    /** Табата из трёх упражнений, отсчёт которой уже идёт. */
    async function табата(прошло = 0, config = {}) {
        const ex = await seed({ name: 'Отжимания', kind: 'reps' });
        const b = await dbService.createExercise({ name: 'Приседания', kind: 'reps' });

        const w = await dbService.createWorkout({
            type: 'Табата',
            plan: [ex, b].map((e) => ({ exerciseId: e.id, skipped: false }))
        });

        await dbService.updateWorkout(w.id, {
            interval: { work: 20, rest: 10, rounds: 2, roundRest: 60, lead: 0, ...config },
            run: { state: 'running', elapsed: 0, startedAt: Date.now() - прошло * 1000 }
        });

        return { w, ex, b };
    }

    it('во время работы видно упражнение и что дальше', async () => {
        await табата(1);
        const view = await screen(intervalScreen);

        assert(has(view, 'Работа'));
        assert(has(view, 'Отжимания'));
        assert(has(view, 'дальше — Приседания'), 'предупреждать о следующем — половина смысла');
    });

    /*
     * В паузе следующее упражнение уже стоит крупно, и строка «дальше»
     * напечатала бы то же название второй раз подряд.
     */
    it('в паузе название не печатается дважды', async () => {
        await табата(25);
        const view = await screen(intervalScreen);

        assert(has(view, 'Отдых'));
        assert(!has(view, 'дальше —'), 'в паузе строка «дальше» лишняя');
    });

    it('отдых между кругами отличается от обычного', async () => {
        // work20 rest10 work20 roundRest60 ...
        await табата(55);
        const view = await screen(intervalScreen);

        assert(has(view, 'Отдых между кругами'));
    });

    it('пройденная программа предлагает завершить', async () => {
        await табата(10000);
        const view = await screen(intervalScreen);

        assert(has(view, 'Программа пройдена'));
        assert(hasAction(view, 'iv-finish'));
    });

    it('без интервальной тренировки экран честно пустой', async () => {
        await seed();
        const view = await screen(intervalScreen);

        assert(has(view, 'Интервальной тренировки нет'));
    });

    /*
     * Полей ввода на экране нет вовсе — в этом всё отличие от выполнения:
     * двадцать секунд работы не оставляют времени на телефон.
     */
    it('полей ввода на экране нет', async () => {
        await табата(1);
        const view = await screen(intervalScreen);

        equal(view.querySelectorAll('input').length, 0);
    });
});

describe('Экран: история интервальных тренировок', () => {

    /** Завершённая табата: подходы на время, без повторений и веса. */
    async function табата() {
        const ex = await seed({ name: 'Берпи', kind: 'reps' });

        const w = await dbService.createWorkout({
            type: 'Табата',
            plan: [{ exerciseId: ex.id, skipped: false }]
        });

        await dbService.updateWorkout(w.id, {
            interval: { work: 20, rest: 10, rounds: 4, roundRest: 0, lead: 0 }
        });

        for (let i = 1; i <= 4; i++) {
            await dbService.addSet({ workoutId: w.id, exerciseId: ex.id, order: i, setNumber: i, duration: 20 });
        }

        await dbService.finishWorkout(w.id, Date.now() + 180000);
        return w;
    }

    /*
     * Чипы типов строятся из того, что есть в истории, поэтому «Табата»
     * появляется среди них сама — как только проведена первая.
     */
    it('среди фильтров появляется «Табата»', async () => {
        await табата();
        const view = await screen(history);

        const чипы = [...view.querySelectorAll('[data-action="hist-type"]')].map((b) => b.textContent.trim());

        assert(чипы.includes('Табата'), `в фильтрах должно быть «Табата», а есть ${чипы.join(', ')}`);
    });

    /*
     * Повторения печатались всегда, и у интервальной тренировки карточка
     * сообщала «0 повторений». Ноль здесь не сведение, а его отсутствие.
     */
    it('нулевые величины в карточке не печатаются', async () => {
        await табата();
        const view = await screen(history);

        assert(has(view, '4 подхода'));
        assert(!has(view, '0 повторений'), 'нечего показывать — нечего и печатать');
        assert(!has(view, '0 кг'));
    });
});

/*
 * Справка (§29).
 *
 * Проверяется не текст — он меняется, — а то, из-за чего справка молча
 * устаревает: набор разделов, свёрнутость всех кроме первого и совпадение
 * списка сигналов с настоящими голосами. Добавить голос и забыть про
 * справку легче всего, а узнать об этом можно только на своей табате.
 */
describe('Экран: как пользоваться', () => {

    const РАЗДЕЛЫ = [
        'С чего начать',
        'Четыре раздела: где что искать',
        'Быстрые способы начать',
        'Во время тренировки',
        'Табата и интервальные программы',
        'Что настроить сразу',
        'Данные, копия и установка',
        'Частые вопросы'
    ];

    it('все разделы на месте', async () => {
        const view = await screen(guide);
        const заголовки = [...view.querySelectorAll('details.guide > summary')].map((s) => s.textContent.trim());

        equal(заголовки.length, РАЗДЕЛЫ.length);

        for (const название of РАЗДЕЛЫ) {
            assert(заголовки.includes(название), `нет раздела «${название}», есть ${заголовки.join(' · ')}`);
        }
    });

    /*
     * Развёрнутые целиком, разделы дают полотно в несколько экранов, по
     * которому нельзя понять, где искать нужное. Открыт только первый — он
     * же ответ на вопрос, с которого справку открывают.
     */
    it('открыт только первый раздел', async () => {
        const view = await screen(guide);
        const открытые = [...view.querySelectorAll('details.guide[open] > summary')].map((s) => s.textContent.trim());

        equal(открытые.length, 1);
        equal(открытые[0], 'С чего начать');
    });

    /*
     * Выделение названий кнопок собирается разметкой, а ui.html экранирует
     * подстановки: обычная строка с <b> печаталась в тексте как есть —
     * «Всё это в <b>Профиле</b>».
     */
    it('разметка выделения не попадает в текст', async () => {
        const view = await screen(guide);
        const t = text(view);

        assert(!t.includes('<b>') && !t.includes('</b>'), 'выделение должно быть жирным, а не напечатанным');
        assert(view.querySelectorAll('.guide-body b').length > 0, 'выделение должно быть');
    });

    it('послушать можно каждый сигнал табаты', async () => {
        const view = await screen(guide);
        const кнопки = [...view.querySelectorAll('[data-action="try-sound"]')].map((b) => b.dataset.sound);

        for (const голос of Object.keys(beeper.VOICES)) {
            assert(кнопки.includes(голос), `сигнал «${голос}» не объяснён в справке`);
        }

        equal(кнопки.length, Object.keys(beeper.VOICES).length, 'лишние кнопки означают несуществующий сигнал');
    });

    /*
     * В профиле сигналов больше нет: там их искали не за объяснением, а
     * натыкались на таблицу частот среди настроек. Объяснение переехало
     * туда, где рядом сказано, что эти сигналы значат.
     */
    it('из профиля сигналы убраны, а справка доступна', async () => {
        await seed();
        const view = await screen(profile);

        assert(!hasAction(view, 'try-sound'), 'таблица сигналов в настройках лишняя');
        assert(!!view.querySelector('[data-screen="guide"]'), 'в профиль нужен вход в справку');
    });
});

/*
 * Отзыв о приложении (§52).
 *
 * Проверяется то, из-за чего ответ теряется или искажается: обязательное
 * поле, пустые значения и сборка текста для запасного пути. Отправка
 * требует сети и здесь не трогается.
 */
describe('Экран: отзыв о приложении', () => {

    it('открывается и показывает все разделы', async () => {
        const view = await screen(surveyScreen);
        const заголовки = [...view.querySelectorAll('.section-title')].map((s) => s.textContent.trim());

        equal(заголовки.length, survey.SECTIONS.length);
        assert(has(view, 'Оставить отзыв'));
        assert(hasAction(view, 'sv-send'), 'без кнопки отправки анкета бесполезна');
    });

    it('обязательный вопрос ровно один', () => {
        const обязательные = survey.QUESTIONS.filter((q) => q.required).map((q) => q.id);

        equal(обязательные, ['freq'], 'анкета, где обязательно всё, собирает выдуманные ответы');
    });

    /*
     * Ключ с пустой строкой в разборе неотличим от ответа «ничего», а
     * разница существенная: пропущенный вопрос это не мнение.
     */
    it('пустое не отправляется', () => {
        const собрано = survey.compose({ freq: '3–4 раза', unclear: '   ', used: [], r_look: null, tg: '' });

        equal(Object.keys(собрано), ['freq']);
    });

    it('незаполненное обязательное находится', () => {
        equal(survey.missing({}).map((q) => q.id), ['freq']);
        equal(survey.missing({ freq: '3–4 раза' }), []);
    });

    it('множественный выбор и оценки доходят как есть', () => {
        const собрано = survey.compose({ freq: '3–4 раза', used: ['Табата', 'История'], r_speed: 4 });

        equal(собрано.used, ['Табата', 'История']);
        equal(собрано.r_speed, 4);
    });

    /*
     * Запасной путь: отправить может не выйти, и тогда единственное, что
     * стоит между человеком и потерянными пятью минутами, — этот текст.
     */
    it('ответ собирается текстом', () => {
        const текст = survey.asText({
            answers: { freq: '3–4 раза', used: ['Табата', 'История'], bug: 'сломалось вот тут' },
            about: { 'Версия приложения': '9.9.9' }
        });

        assert(текст.includes('Как часто тренируешься?: 3–4 раза'));
        assert(текст.includes('Табата, История'), 'список должен быть перечислением, а не массивом');
        assert(текст.includes('сломалось вот тут'));
        assert(текст.includes('Версия приложения: 9.9.9'), 'сведения об устройстве нужны и в запасном пути');
    });

    it('пустой ответ не печатает пустых разделов', () => {
        const текст = survey.asText({ answers: {}, about: {} });

        equal(текст, 'Отзыв о приложении «Трекер»');
    });
});

/**
 * Создание упражнения из плана (§5, §10).
 *
 * Раньше отсюда бралось одно название, и получался полуфабрикат: вид всегда
 * «вес», группа пуста. Вид решает, какие поля человек увидит на выполнении;
 * группа участвует в расчёте отдыха мышц (§29.1).
 */
describe('Экран: план, новое упражнение', () => {

    /** Подменить окна: выбор возвращает «создать», форма — заполненные поля. */
    async function создать(values, { existing = null } = {}) {
        const было = { pick: dialog.pick, form: dialog.form, confirm: dialog.confirm };
        const спрошено = { form: null, confirm: null };

        dialog.pick = async () => ({ create: existing || values.name });
        dialog.form = async (options) => { спрошено.form = options; return values; };
        dialog.confirm = async (options) => { спрошено.confirm = options; return true; };

        try {
            await press('plan-add');
        } finally {
            Object.assign(dialog, было);
        }

        return спрошено;
    }

    /*
     * Черновик плана живёт в модуле и переживает смену экрана. Заведённые
     * здесь упражнения остались бы в нём и всплыли в проверке перевода —
     * поэтому маршрут в конце меняется, и черновик пересобирается пустым.
     */
    async function очистить() {
        await screen(plan, ['template', 'нет-такого']);
    }

    it('спрашивает вид и группу, а не только название', async () => {
        await seed();
        await screen(plan);

        const спрошено = await создать({ name: 'Тяга резинки', kind: 'reps', group: 'Спина' });

        const поля = (спрошено.form?.fields || []).map((f) => f.name);

        equal(поля, ['name', 'kind', 'group', 'howTo'], 'те же поля, что в справочнике');

        const заведено = await dbService.findExerciseByName('Тяга резинки');

        equal(заведено.kind, 'reps', 'вид берётся из формы, а не «вес» по умолчанию');
        equal(заведено.group, 'Спина', 'без группы упражнение невидимо для отдыха мышц');

        await очистить();
    });

    /*
     * Прежний ensureExercise молча возвращал найденное, и человек не понимал,
     * что упражнение не создалось, а подобралось. С архивным выходило
     * страннее всего: в план вставало то, от чего он сам отказался.
     */
    it('о совпадении говорит вслух и отдельно про архив', async () => {
        const ex = await seed({ name: 'Жим лёжа' });
        await dbService.setExerciseArchived(ex.id, true);
        await screen(plan);

        const спрошено = await создать({}, { existing: 'Жим лёжа' });

        assert(спрошено.confirm, 'совпадение обязано быть названо');
        assert(String(спрошено.confirm.text).includes('архив'), 'про архив сказано отдельно');
        assert(!спрошено.form, 'второе упражнение с тем же именем не заводится');

        await очистить();
    });
});

/**
 * Память длительности отдыха (§16).
 *
 * После тяжёлого приседа нужно три минуты, после планки тридцать секунд.
 * Одна величина на всё приложение (Р-26) заставляла править её каждый раз
 * заново — теперь она запоминается за упражнением.
 */
describe('Экран: выполнение, память паузы', () => {

    /** Начать тренировку из одного упражнения и открыть выполнение. */
    async function начать(exercise) {
        await dbService.createWorkout({
            type: 'Силовая',
            plan: [{ exerciseId: exercise.id, plannedSets: 3, targetReps: 10, weight: 50, skipped: false }]
        });

        await screen(session);
    }

    it('кнопки правят величину упражнения, а не общую настройку', async () => {
        const ex = await seed();

        config.set('restEnabled', true);
        config.set('restSeconds', 90);

        await начать(ex);
        restTimer.start(90, ex.id);

        await press('rest-extend');

        const заведено = await dbService.getExercise(ex.id);

        equal(заведено.restSeconds, 95, 'своя величина упражнения выросла на шаг');
        equal(config.get('restSeconds'), 90, 'общая настройка — начало отсчёта для незнакомых, её не трогаем');

        restTimer.stop();
    });

    /*
     * Без подписи переход к следующему упражнению менял бы число «сам собой» —
     * то самое удивление, из-за которого своя длительность когда-то была
     * убрана (Р-26). Теперь она вернулась, но названа вслух.
     */
    it('своя величина названа на полосе отдыха', async () => {
        const ex = await seed();

        config.set('restEnabled', true);
        config.set('restSeconds', 90);

        await начать(ex);
        restTimer.start(90, ex.id);

        const общий = await screen(session);
        assert(!has(общий, 'Отдых для этого упражнения'), 'пока величина общая, говорить не о чем');

        await dbService.updateExercise(ex.id, { restSeconds: 150 });

        const свой = await screen(session);
        assert(has(свой, 'Отдых для этого упражнения'), 'своя величина обязана быть названа');

        restTimer.stop();
    });

    it('незнакомое упражнение берёт общую настройку', async () => {
        const ex = await seed();

        config.set('restEnabled', true);
        config.set('restSeconds', 75);

        await начать(ex);
        const view = await screen(session);

        assert(has(view, '1:15'), 'в меню отдыха стоит общая величина');
    });
});
