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
import { screen, text, hasAction, press, change, seed, workout } from '../helpers/dom.js';
import { app } from '../../js/app.js';

import { home } from '../../js/modules/home.js';
import { history } from '../../js/modules/history.js';
import { calendar } from '../../js/modules/calendar.js';
import { stats } from '../../js/modules/stats.js';
import { recordsScreen } from '../../js/modules/records.js';
import { templates } from '../../js/modules/templates.js';
import { session } from '../../js/modules/session.js';
import { plan } from '../../js/modules/plan.js';
import { plan as planCore } from '../../js/core/plan.js';
import { scale, SCALE_USER } from '../../js/services/scale.js';
import { intervalScreen } from '../../js/modules/interval.js';
import { summary } from '../../js/modules/summary.js';
import { exercise as exerciseCard } from '../../js/modules/exercise.js';
import { exercises } from '../../js/modules/exercises.js';
import { profile } from '../../js/modules/profile.js';
import { guide } from '../../js/modules/guide.js';
import { watch } from '../../js/modules/watch.js';
import { shares } from '../../js/modules/shares.js';
import { condition } from '../../js/modules/condition.js';
import { surveyScreen } from '../../js/modules/survey.js';
import { planner, putDraft, PLAN_KEY } from '../../js/modules/planner.js';
import { ATHLETE_KEY, setGoal, GOALS_KEY } from '../../js/modules/athlete.js';
import { survey } from '../../js/core/survey.js';
import { dialog } from '../../js/core/dialog.js';
import { actions } from '../../js/core/actions.js';
import { sync } from '../../js/services/sync.js';
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

    /*
     * Дорога к записи еды шла через статистику и кондиции — три нажатия и
     * прокрутка, а записывают её три-пять раз в день (§68).
     */
    it('съеденное показывается на главном тому, кто его записывает', async () => {
        await seed();

        assert(!has(await screen(home), 'Питание'), 'без единой записи это была бы просьба, а не сведения');

        await dbService.addIntake({ kcal: 820, note: 'завтрак' });

        const view = await screen(home);

        assert(has(view, 'Питание'), `после записи строка есть: ${text(view).slice(0, 200)}`);
        assert(has(view, '820'), 'и называет съеденное за сегодня');
        assert(!!view.querySelector('[data-action="intake-add"]'), 'нажатие открывает запись, а не ведёт вглубь');
    });

    /**
     * Талия и шаги на главном (Р-88, Р-89).
     *
     * Обе строки показываются только тем, у кого есть что показывать: талия —
     * тому, кто её мерит, шаги — тому, у кого привязаны часы. Иначе это место
     * занимала бы просьба, а не сведения.
     */
    it('талия показывается тому, кто её мерит', async () => {
        await seed();
        await dbService.setBodyWeight({ weight: 93 });

        assert(!has(await screen(home), 'талия'), 'без замера строки нет');

        await dbService.setBodyWeight({ weight: 93, waist: 98 });
        const view = await screen(home);

        assert(has(view, 'талия'), `после замера строка есть: ${text(view).slice(0, 200)}`);
        assert(has(view, '98'), 'с самим числом');
    });

    it('шаги показываются только с привезёнными замерами', async () => {
        await seed();

        assert(!has(await screen(home), 'Шаги'), 'без часов шагам взяться неоткуда');

        await dbService.setSetting('icuWellness', {
            at: Date.now(),
            rows: [{ date: Date.now() - DAY, steps: 6400 }, { date: Date.now(), steps: 8200 }]
        });
        await dbService.setSetting('stepsGoal', 8000);

        const view = await screen(home);

        assert(has(view, 'Шаги'), `раздел появился: ${text(view).slice(0, 200)}`);
        assert(has(view, '8 200') || has(view, '8200'), 'показывается последний известный день');
        assert(has(view, '100 %'), 'цель выполнена — доля видна');
    });

    it('незавершённая тренировка предлагается к продолжению', async () => {
        const ex = await seed();
        await dbService.createWorkout({ type: 'Силовая', plan: [
            { exerciseId: ex.id, plannedSets: 3, targetReps: 10, weight: 60, skipped: false }
        ]});

        const view = await screen(home);

        assert(has(view, 'Незавершённая тренировка'));
        assert(has(view, 'Продолжить'));
        assert(has(view, 'подходов: 0 из 3'), 'прогресс должен быть виден сразу');
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

    /*
     * Тип правится прямо из списка (Р-50). Значок стоит внутри кнопки
     * строки, и это работает только потому, что обработчик берёт ближайший
     * data-action: разъедься эти два действия — нажатие на тип открывало бы
     * карточку, а тип остался бы неправимым, как и был.
     */
    it('тип тренировки нажимается отдельно от строки', async () => {
        const ex = await seed();
        const w = await workout(ex, [[10, 60]]);

        const view = await screen(history);
        const badge = view.querySelector('.h-badge');
        const row = badge.closest('.history-item');

        equal(badge.dataset.action, 'hist-retype');
        equal(badge.dataset.id, w.id, 'значок обязан знать, какую тренировку правит');
        equal(row.dataset.action, 'nav-summary', 'сама строка по-прежнему открывает карточку');
        equal(badge.closest('[data-action]'), badge, 'ближайшее действие — своё, а не строки');
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

/**
 * Поиск по справочнику отбирает на месте (§5.3, Р-93).
 *
 * Проверяется в настоящем документе, а не в отдельном узле: отбор работает
 * прямо по разметке, и смысл его в том, что экран при вводе не
 * перерисовывается — на телефоне перерисовка закрывала и открывала
 * клавиатуру после каждой буквы.
 */
describe('Экран: справочник, поиск', () => {

    /** Справочник из двенадцати упражнений: короче поле поиска не показывается. */
    async function положить() {
        await seed({ name: 'Жим лёжа', kind: 'weight', group: 'Грудь' });

        const прочие = [
            ['Приседания', 'Ноги'], ['Выпады', 'Ноги'], ['Ягодичный мостик', 'Ноги'],
            ['Тяга резинки к поясу', 'Спина'], ['Подтягивания', 'Спина'],
            ['Отжимания', 'Грудь'], ['Брусья', 'Грудь'],
            ['Жим стоя', 'Плечи'], ['Махи с резинкой в стороны', 'Плечи'],
            ['Пресс', 'Пресс'], ['Планка', 'Пресс']
        ];

        for (const [name, group] of прочие) {
            await dbService.createExercise({ name, kind: 'reps', group });
        }
    }

    /** Отрисовать справочник в настоящий документ и вернуть узел. */
    async function открыть() {
        const box = document.createElement('div');
        box.innerHTML = String(await exercises.render());
        document.body.appendChild(box);

        exercises.mount?.();

        return box;
    }

    /** Набрать в поле поиска — так же, как это делает человек. */
    async function набрать(box, текст) {
        const поле = box.querySelector('#ex-search');
        поле.value = текст;
        поле.dispatchEvent(new Event('input', { bubbles: true }));

        await new Promise((r) => setTimeout(r, 30));
    }

    const видимые = (box) => [...box.querySelectorAll('.ex-row')].filter((r) => !r.hidden);

    it('оставляет подходящее и считает найденное', async () => {
        await положить();
        const box = await открыть();

        try {
            assert(box.querySelector('#ex-search'), 'на длинном списке поле обязано быть');
            equal(видимые(box).length, 12, 'до ввода видно всё');

            await набрать(box, 'ног');

            const имена = видимые(box).map((r) => r.querySelector('.ex-name').textContent.trim());

            equal(имена.length, 3, `нашлось: ${имена.join(', ')}`);
            assert(имена.includes('Приседания') && имена.includes('Ягодичный мостик'),
                'ищется и по названию, и по группе');

            assert(box.querySelector('#ex-active-title').textContent.includes('3'),
                'заголовок считает найденное, а не всё подряд');
        } finally {
            box.remove();
        }
    });

    /*
     * Поле поиска обязано пережить ввод: перерисовка экрана подменяла его
     * новым узлом, и телефон закрывал клавиатуру после каждой буквы.
     */
    it('поле ввода не подменяется', async () => {
        await положить();
        const box = await открыть();

        try {
            const было = box.querySelector('#ex-search');

            await набрать(box, 'жим');
            await набрать(box, 'жим л');

            equal(box.querySelector('#ex-search'), было, 'узел поля обязан остаться тем же');
            equal(box.querySelector('#ex-search').value, 'жим л', 'и набранное в нём тоже');
        } finally {
            box.remove();
        }
    });

    it('пустой запрос возвращает весь список', async () => {
        await положить();
        const box = await открыть();

        try {
            await набрать(box, 'планка');
            equal(видимые(box).length, 1);

            await набрать(box, '');
            equal(видимые(box).length, 12);
        } finally {
            box.remove();
        }
    });

    it('ненайденное говорит об этом', async () => {
        await положить();
        const box = await открыть();

        try {
            await набрать(box, 'штанга на бицепс без ничего');

            equal(видимые(box).length, 0);
            equal(box.querySelector('#ex-nothing').hidden, false);
        } finally {
            box.remove();
        }
    });

    /*
     * Экран рисуется заново по другим поводам — архивации, переименованию, —
     * и набранное в поиске обязано пережить это: иначе после архивации из
     * поиска перед человеком молча разворачивается весь справочник.
     */
    it('отбор переживает перерисовку', async () => {
        await положить();
        const первый = await открыть();

        try {
            await набрать(первый, 'плеч');
            equal(видимые(первый).length, 2);
        } finally {
            первый.remove();
        }

        const второй = await открыть();

        try {
            equal(второй.querySelector('#ex-search').value, 'плеч', 'поле помнит набранное');
            equal(видимые(второй).length, 2, 'и список остаётся отобранным');
        } finally {
            второй.remove();

            // Поиск живёт в модуле и переживает экраны — следующей проверке
            // он достался бы набранным
            const поле = document.createElement('input');
            поле.id = 'ex-search';
            document.body.appendChild(поле);
            поле.dispatchEvent(new Event('input', { bubbles: true }));
            поле.remove();
        }
    });

});

/**
 * Яркая кнопка на экране плана одна (§56, Р-96).
 *
 * «Разобрать» и «Утвердить план» стояли одна под другой, обе оранжевые и обе
 * во всю ширину, — и сливались в одно пятно буквой Г. Проверяется по классам:
 * цвет берётся из них, и разъехаться они с разметкой не могут.
 */
describe('Экран: план, одна яркая кнопка', () => {

    /*
     * Смотрим карточку с полем плана, а не весь экран: рядом бывает своя
     * карточка «Завести все» — она про другое дело и стоит отдельно, между
     * карточками зазор есть всегда. Сливались же кнопки внутри одной.
     */
    const яркие = (view) => [...view.querySelector('#plan-text').closest('.card').querySelectorAll('.btn-accent')]
        .map((b) => b.textContent.trim());

    it('без черновика главное действие — «Разобрать»', async () => {
        await seed();
        putDraft('');

        const view = await screen(planner);

        equal(яркие(view), ['Разобрать']);
    });

    it('с разобранным черновиком яркое одно — «Утвердить план»', async () => {
        await seed();

        putDraft(['С 07.09.2026, 8 недель', '', 'Пн Отжимания 6 × 50, пауза 5 мин', 'Ср Баскетбол'].join('\n'));

        const view = await screen(planner);

        equal(яркие(view), ['Утвердить план'],
            'две оранжевые кнопки подряд читаются как одна');

        assert(view.querySelector('[data-action="sheet-parse"]').className.includes('btn-ghost'),
            '«Разобрать» гаснет, но остаётся: правку строки надо чем-то перечитать');

        putDraft('');
    });

    /*
     * Непонятый черновик утверждать нечего — и тогда «Разобрать» остаётся
     * главным: человеку надо поправить текст и нажать её снова.
     */
    it('на непонятом черновике яркое остаётся у «Разобрать»', async () => {
        await seed();

        putDraft('какой-то текст без даты и дней');

        const view = await screen(planner);

        equal(яркие(view), ['Разобрать']);
        assert(!hasAction(view, 'sheet-apply'), 'утверждать нечего');

        putDraft('');
    });

});


/**
 * Утверждение кончается главным экраном (Р-106).
 *
 * Экран плана — место, где план правят. Человек, только что сказавший «да»,
 * оставался на нём: рядом поле ввода и кнопка «Разобрать», будто утверждение
 * не засчиталось и надо что-то ещё.
 */
describe('Экран: после утверждения плана', () => {

    it('приложение уходит на главный', async () => {
        await seed();

        const былоAlert = dialog.alert;
        const былХеш = location.hash;

        dialog.alert = async () => true;
        putDraft(['С 07.09.2026, 8 недель', 'Пн Отжимания 6 × 50', 'Вс отдых'].join('\n'));

        try {
            await press('sheet-apply');

            equal(location.hash, '#/home',
                'оставлять на экране правки того, кто уже утвердил, — значит спрашивать заново');
        } finally {
            dialog.alert = былоAlert;
            location.hash = былХеш;
            putDraft('');
            await dbService.setSetting('plan', null);
        }
    });

});


/**
 * Весы живут в окне записи веса (Р-108).
 *
 * Не отдельной кнопкой на карточке: это не два дела, а два способа заполнить
 * одно и то же поле. Отдельная кнопка заставляла бы человека решать, чем он
 * сегодня будет взвешиваться, ещё до того, как посмотрел на поле.
 */

/**
 * Состав тела на главном (§65).
 *
 * Крупным числом жир, а не вода и не мышцы: именно он отвечает на вопрос, на
 * который вес молчит. Когда человек убирает живот, вес неделями стоит на
 * месте — жир уходит, мышцы приходят, — и без этой строки главный экран
 * говорит «ничего не происходит» ровно тогда, когда происходит главное.
 */
describe('Главный: состав тела с весов', () => {

    const DAY = 86400000;

    it('жир, вода и мышцы стоят строкой под весом', async () => {
        const ex = await seed();
        await workout(ex, [[10, 60]]);

        await dbService.setBodyWeight({
            weight: 92.9,
            body: { fat: 24.5, water: 46.3, muscle: 38.5 }
        });

        const строка = text(await screen(home));

        assert(строка.includes('24,5'), `жир крупным числом: ${строка.slice(0, 400)}`);
        assert(строка.includes('46,3'), 'вода');
        assert(строка.includes('38,5'), 'мышцы');
    });

    it('ход жира за месяц считается', async () => {
        const ex = await seed();
        await workout(ex, [[10, 60]]);

        await dbService.setBodyWeight({ at: Date.now() - 20 * DAY, weight: 93.6, body: { fat: 25.4 } });
        await dbService.setBodyWeight({ weight: 92.9, body: { fat: 24.5 } });

        assert(text(await screen(home)).includes('−0,9'),
            'без хода число ничего не говорит: у жира нет нормы, есть свой ход');
    });

    /*
     * Весы считают состав не всегда: человек встал в носках. Прочерк в строке
     * — просьба, а не сведения, и её тут быть не должно.
     */
    it('без состава строки нет вовсе', async () => {
        const ex = await seed();
        await workout(ex, [[10, 60]]);

        await dbService.setBodyWeight({ weight: 92.9 });

        const строка = text(await screen(home));

        assert(строка.includes('92,9'), 'вес на месте');
        assert(!строка.includes('жира'), 'пустой строки о жире не бывает');
    });

});

describe('Экран: запись веса', () => {

    async function спроситьОкно(умеет) {
        const былаФорма = dialog.form;
        const былоУмеет = scale.available;

        let спрошено = null;

        scale.available = () => умеет;
        dialog.form = async (options) => { спрошено = options; return null; };

        try {
            await press('body-add');
        } finally {
            dialog.form = былаФорма;
            scale.available = былоУмеет;
        }

        return спрошено;
    }

    it('весы предлагаются в том же окне, что и ручной ввод', async () => {
        await seed();

        const окно = await спроситьОкно(true);

        equal(окно.fields.map((f) => f.name), ['weight', 'waist', 'note']);
        assert(окно.extra, 'кнопка весов обязана стоять рядом с полем, которое она заполняет');
    });

    /*
     * Web Bluetooth есть только в Chrome. Обещать снятие с весов там, где его
     * нет, значит отправить человека за разочарованием.
     */
    it('где браузер не умеет — кнопки нет', async () => {
        await seed();

        equal((await спроситьОкно(false)).extra, null);
    });

    it('на карточке веса отдельной кнопки весов не осталось', async () => {
        await seed();

        assert(!hasAction(await screen(stats), 'scale-read'),
            'вход в запись и сама запись — разные вещи, и смешивать их нельзя');
    });

});


/**
 * Весы: разговор виден, а ошибка в номере места поправима (Р-110).
 *
 * Обе беды нашлись в коде, написанном в тот же день, и обе одного рода:
 * приложение знало, что происходит, и не сказало человеку.
 */
describe('Экран: разговор с весами', () => {

    async function снять({ ответ, место = null }) {
        const былаФорма = dialog.form;
        const былАлерт = dialog.alert;
        const былоУмеет = scale.available;
        const былоЧтение = scale.read;

        const сказано = [];

        scale.available = () => true;
        scale.read = ответ;
        dialog.form = async () => ({ extra: true });
        dialog.alert = async (o) => { сказано.push(o); return true; };

        if (место) await dbService.setSetting(SCALE_USER, место);

        try {
            await press('body-add');
        } finally {
            dialog.form = былаФорма;
            dialog.alert = былАлерт;
            scale.available = былоУмеет;
            scale.read = былоЧтение;
        }

        return сказано;
    }

    /*
     * Номер места и код списывают с экрана весов на глаз. Ошибка в них была
     * приговором: окно с полями открывалось только при пустой настройке, а
     * стереть её было нечем — «Сбросить настройки» чистит localStorage, а
     * номер лежит в базе.
     */
    it('неверный номер места забывается, чтобы его можно было ввести заново', async () => {
        await seed();

        const сказано = await снять({
            место: { index: 3, code: 1111 },
            ответ: async () => {
                const беда = new Error('Весы не признали: номер места или код не тот.');
                беда.reason = 'user';
                throw беда;
            }
        });

        equal(await dbService.getSetting(SCALE_USER, null), null,
            'иначе одна описка закрывает возможность навсегда');
        assert(сказано.some((o) => /не подошли/.test(o.text || '')), 'и человеку сказано, что делать');
    });

    /*
     * Сон весов, разрыв связи, отказ браузера — не вина человека, и звать его
     * править настройку там незачем.
     */
    it('прочие осечки настройку не трогают', async () => {
        await seed();

        await снять({
            место: { index: 3, code: 7818 },
            ответ: async () => { throw new Error('Весы ничего не прислали.'); }
        });

        equal((await dbService.getSetting(SCALE_USER, null))?.index, 3);
    });

    /*
     * Ход разговора виден там, куда человек в эту минуту смотрит (Р-192).
     *
     * Он стоит на весах и смотрит в середину экрана, а не в полосу наверху —
     * и не в карточку веса, которой с главного экрана не видно вовсе. Шаги
     * приходят в ту же строку окна ожидания: «ищу», «встаньте на весы».
     */
    it('ход разговора виден в окне, и окно закрывается после', async () => {
        await seed();

        let сказано = null;

        await снять({
            место: { index: 3, code: 7818 },
            ответ: async ({ onStatus }) => {
                onStatus('Встаньте на весы');
                сказано = document.querySelector('.dialog-backdrop .dialog-text')?.textContent || '';
                throw new Error('дальше не важно');
            }
        });

        assert(/Встаньте на весы/.test(сказано || ''),
            'молчащее приложение неотличимо от сломанного');

        equal(document.querySelector('.dialog-backdrop .dialog-wait'), null,
            'после разговора окно ожидания закрывается');
    });

});


/**
 * Конец отдыха не трогает набранное (Р-111).
 *
 * Таймер написан ровно под то, чтобы вводить во время паузы — в его шапке так
 * и сказано: «Он никогда не блокирует ввод». А перерисовка по концу отсчёта
 * пересобирала поля из подстановки и возвращала в них число прошлого подхода:
 * набрал «21», замешкался с кнопкой — записалось «12».
 */
describe('Выполнение: конец отдыха', () => {

    it('набранные повторения переживают конец паузы', async () => {
        const ex = await seed({ name: 'Отжимания', kind: 'reps' });

        const w = await dbService.createWorkout({ type: 'Силовая' });
        await dbService.addSet({
            workoutId: w.id, exerciseId: ex.id, order: 0, setNumber: 1,
            reps: 10, performedAt: Date.now()
        });

        // Экран ставится в настоящий документ: беда была в том, что его
        // пересобирали целиком, а увидеть это можно только на живых узлах
        const host = document.getElementById('screen');
        const было = host.innerHTML;

        config.set('restEnabled', true);
        host.innerHTML = await session.render();
        session.mounted?.();

        try {
            const поле = document.getElementById('f-reps');
            assert(поле, 'поле повторений на экране есть');

            поле.value = '21';

            restTimer.start(60, ex.id);
            restTimer.stop();

            equal(document.getElementById('f-reps')?.value, '21',
                'подмена приходит без нажатия, и заметить её между подходами нечем');
            equal(document.querySelector('.rest-bar'), null, 'а полоса отдыха убирается');
        } finally {
            session.unmount?.();
            host.innerHTML = было;
            restTimer.stop();
        }
    });

});


/**
 * Засов от второго нажатия «Выполнено» (Р-112).
 *
 * Номер подхода и его порядок берутся из снимка последней отрисовки, и второе
 * нажатие, пришедшее раньше, чем закончится запись, читает тот же снимок.
 * Лишний подход завышает тоннаж, двигает план на шаг вперёд и может подделать
 * рекорд, а заметить его можно только пересчитав подходы в итогах.
 */
describe('Выполнение: два нажатия подряд', () => {

    it('второе нажатие не пишет второй подход', async () => {
        const ex = await seed({ name: 'Отжимания', kind: 'reps' });

        const w = await dbService.createWorkout({ type: 'Силовая' });
        await dbService.addSet({
            workoutId: w.id, exerciseId: ex.id, order: 0, setNumber: 1,
            reps: 10, performedAt: Date.now()
        });

        const host = document.getElementById('screen');
        const было = host.innerHTML;

        host.innerHTML = await session.render();

        try {
            const поле = document.getElementById('f-reps');
            assert(поле, 'поле повторений на экране есть');
            поле.value = '12';

            // Оба нажатия уходят до того, как первое успеет дописать
            await Promise.all([press('sess-done'), press('sess-done')]);
            await пауза(400);

            const подходы = await dbService.listSets(w.id);

            equal(подходы.length, 2, 'был один записанный, прибавился ровно один');
        } finally {
            host.innerHTML = было;
        }
    });

});

/**
 * Ближайшие две недели — от сегодня (Р-112).
 *
 * Развёртка по умолчанию считается от начала плана, и карточка показывала
 * первые две недели вместо ближайших. На шестой неделе двенадцатинедельной
 * программы человек читает сверху «сейчас неделя 6», а под этим — дни
 * полуторамесячной давности.
 */
describe('Экран: план, ближайшие две недели', () => {

    const DAY = 86400000;

    it('действующий план показывает дни от сегодня', async () => {
        await seed();

        const начало = Date.now() - 35 * DAY;
        const d = new Date(начало);
        const два = (n) => String(n).padStart(2, '0');

        const текст = [
            `С ${два(d.getDate())}.${два(d.getMonth() + 1)}.${d.getFullYear()}, 12 недель`,
            'Пн Отжимания 6 × 20',
            'Вт отдых', 'Ср отдых', 'Чт отдых', 'Пт отдых', 'Сб отдых', 'Вс отдых'
        ].join('\n');

        await dbService.setSetting(PLAN_KEY, { ...planCore.parse(текст), text: текст });

        try {
            const view = await screen(planner);

            const карточки = [...view.querySelectorAll('.card')];
            const нужная = карточки.find((c) => /Ближайшие две недели/.test(c.textContent));

            assert(нужная, 'карточка на месте');

            const первый = нужная.querySelector('.plan-day-date')?.textContent.trim();

            equal(первый, 'Сегодня',
                'карточка подписана «ближайшие», а показывала первые две недели плана');
        } finally {
            await dbService.setSetting(PLAN_KEY, null);
        }
    });

});


/** Путь записи подхода длиннее, чем ждёт press: база, сводка, отрисовка. */
const пауза = (мс) => new Promise((r) => setTimeout(r, мс));

/**
 * Отмена подхода и проверка нелепого числа (Р-113).
 */
describe('Выполнение: отмена и проверка числа', () => {

    async function наЭкран(w) {
        const host = document.getElementById('screen');
        const было = host.innerHTML;
        host.innerHTML = await session.render();
        return () => { host.innerHTML = было; };
    }

    /*
     * В режимах «по кругу» и «по одному» приложение уводит на следующее
     * упражнение сразу после записи — и отменять становилось нечего ровно в ту
     * секунду, когда ошибку и замечают.
     */
    it('отменяется последний подход тренировки, а не текущего упражнения', async () => {
        const первое = await seed({ name: 'Отжимания', kind: 'reps' });
        const второе = await dbService.createExercise({ name: 'Приседания', kind: 'reps' });

        const w = await dbService.createWorkout({ type: 'Силовая' });
        await dbService.addSet({ workoutId: w.id, exerciseId: первое.id, order: 0, setNumber: 1, reps: 10, performedAt: Date.now() });

        const вернуть = await наЭкран(w);
        const былоConfirm = dialog.confirm;

        let спрошено = null;
        dialog.confirm = async (o) => { спрошено = o; return true; };

        try {
            // Стоим на втором упражнении, своих подходов у него нет
            await press('sess-select', { id: второе.id });
            await наЭкран(w);

            assert(hasAction(document.getElementById('screen'), 'sess-undo')
                || document.querySelector('[data-action="sess-undo"]'),
                'кнопка обязана быть, пока в тренировке есть хоть один подход');

            await press('sess-undo');
            await пауза(300);

            assert(/Отжимания/.test(спрошено?.text || ''),
                `называется то, что уйдёт: ${спрошено?.text}`);

            equal((await dbService.listSets(w.id)).length, 0, 'подход стёрт');
        } finally {
            dialog.confirm = былоConfirm;
            вернуть();
        }
    });

    /*
     * Промах в поле даёт не мусор, а правдоподобное число: «128» вместо «8».
     * Записанный подход тут же становится рекордом и ложится в тоннаж.
     */
    it('число втрое больше прежнего спрашивается вслух', async () => {
        const ex = await seed({ name: 'Отжимания', kind: 'reps' });

        const w = await dbService.createWorkout({ type: 'Силовая' });
        await dbService.addSet({ workoutId: w.id, exerciseId: ex.id, order: 0, setNumber: 1, reps: 12, performedAt: Date.now() });

        const вернуть = await наЭкран(w);
        const былоConfirm = dialog.confirm;

        let спрошено = null;
        dialog.confirm = async (o) => { спрошено = o; return false; };

        try {
            const поле = document.getElementById('f-reps');
            assert(поле, 'поле на месте');
            поле.value = '128';

            await press('sess-done');
            await пауза(400);

            assert(спрошено, 'приложение обязано переспросить');
            equal((await dbService.listSets(w.id)).length, 1, 'отказ ничего не записывает');
        } finally {
            dialog.confirm = былоConfirm;
            вернуть();
        }
    });

    /*
     * Прибавка — обычное дело, и вопрос на каждый прирост был бы хуже
     * молчания.
     */
    it('обычная прибавка вопросов не вызывает', async () => {
        const ex = await seed({ name: 'Отжимания', kind: 'reps' });

        const w = await dbService.createWorkout({ type: 'Силовая' });
        await dbService.addSet({ workoutId: w.id, exerciseId: ex.id, order: 0, setNumber: 1, reps: 12, performedAt: Date.now() });

        const вернуть = await наЭкран(w);
        const былоConfirm = dialog.confirm;

        let спрошено = false;
        dialog.confirm = async () => { спрошено = true; return true; };

        try {
            const поле = document.getElementById('f-reps');
            поле.value = '14';

            await press('sess-done');
            await пауза(400);

            equal(спрошено, false, 'четырнадцать после двенадцати — это не описка');
            equal((await dbService.listSets(w.id)).length, 2);
        } finally {
            dialog.confirm = былоConfirm;
            вернуть();
        }
    });

});

/**
 * Окно не отпускает фокус и возвращает его, когда закрывается (Р-113).
 */
describe('Диалог: фокус', () => {

    it('фокус входит в окно, даже если главной кнопки нет', async () => {
        const кнопка = document.createElement('button');
        document.body.appendChild(кнопка);
        кнопка.focus();

        const обещание = dialog.choose({
            title: 'Проба',
            options: [{ value: 'a', label: 'Первый' }, { value: 'b', label: 'Второй' }]
        });

        await new Promise((r) => setTimeout(r, 50));

        const внутри = document.querySelector('.dialog-backdrop')?.contains(document.activeElement);

        document.querySelector('.dialog-backdrop [data-value=""]')?.click();
        await обещание;

        кнопка.remove();

        assert(внутри, 'иначе Tab уходит вглубь страницы, а варианты недостижимы');
    });

    it('после закрытия фокус возвращается туда, откуда окно открыли', async () => {
        const кнопка = document.createElement('button');
        document.body.appendChild(кнопка);
        кнопка.focus();

        const обещание = dialog.alert({ title: 'Проба', text: 'Текст' });
        await new Promise((r) => setTimeout(r, 50));

        document.querySelector('.dialog-backdrop button')?.click();
        await обещание;

        const вернулся = document.activeElement === кнопка;
        кнопка.remove();

        assert(вернулся, 'иначе фокус падает на тело документа и клавиши перестают прокручивать');
    });

});


/**
 * Ревизия, четвёртый заход (Р-114).
 */
describe('Статистика: объём по группам и мерки', () => {

    it('в полосе подходы, а тоннаж рядом — там, где его есть из чего посчитать', async () => {
        const ex = await seed({ name: 'Жим лёжа', kind: 'weight', group: 'Грудь' });
        await workout(ex, [[10, 60], [10, 60]]);

        const строка = text(await screen(stats));

        assert(строка.includes('Подходы по группам мышц'), 'заголовок называет то, что в полосе');
        const кусок = строка.slice(строка.indexOf('Подходы по группам'), строка.indexOf('Подходы по группам') + 120);

        assert(/\d+ · \d+[^\d]* ?т/.test(кусок) || /\d+ · \d+ кг/.test(кусок),
            `тоннаж стоит рядом с подходами: ${кусок}`);
    });

    /*
     * У того, кто занимается только своим весом и ни разу не взвешивался,
     * тоннаж весь нулевой. Пустые полосы, названные объёмом, — враньё дважды.
     */
    it('без чего считать тоннаж — в полосе одни подходы', async () => {
        const ex = await seed({ name: 'Отжимания', kind: 'reps', group: 'Грудь' });
        await workout(ex, [[10, null], [10, null]]);

        const строка = text(await screen(stats));
        const кусок = строка.slice(строка.indexOf('Подходы по группам'), строка.indexOf('Подходы по группам') + 80);

        assert(!/ т|кг/.test(кусок), `нечего показывать — и не показываем: ${кусок}`);
    });

    it('мерка серий названа вслух', async () => {
        const ex = await seed();
        await workout(ex, [[10, 60]]);

        assert(text(await screen(stats)).includes('Серии — за всю историю'),
            'иначе четыре плитки в ряд читаются как четыре числа за период');
    });

});

/**
 * Пропущенное упражнение возвращается в план (§14, Р-114).
 */
describe('Выполнение: пропуск обратим', () => {

    it('пропущенное можно выбрать и вернуть', async () => {
        const первое = await seed({ name: 'Жим', kind: 'weight' });
        const второе = await dbService.createExercise({ name: 'Тяга', kind: 'weight' });

        const w = await dbService.createWorkout({ type: 'Силовая' });
        await dbService.updateWorkout(w.id, {
            plan: [
                { exerciseId: первое.id, plannedSets: 3, targetReps: 10, skipped: false },
                { exerciseId: второе.id, plannedSets: 3, targetReps: 10, skipped: false }
            ]
        });

        const host = document.getElementById('screen');
        const было = host.innerHTML;
        host.innerHTML = await session.render();

        try {
            await press('sess-select', { id: первое.id });
            await press('sess-skip');
            await пауза(300);

            const план = (await dbService.getWorkout(w.id)).plan;
            equal(план.find((p) => p.exerciseId === первое.id).skipped, true, 'пропущено');

            // Выбор пропущенного больше не отбрасывается
            await press('sess-select', { id: первое.id });
            host.innerHTML = await session.render();

            assert(document.querySelector('[data-action="sess-unskip"]'),
                '§14 обещает вернуться к пропущенному, и обещание должно быть чем-то обеспечено');

            await press('sess-unskip');
            await пауза(300);

            const после = (await dbService.getWorkout(w.id)).plan;
            equal(после.find((p) => p.exerciseId === первое.id).skipped, false, 'вернулось в план');
        } finally {
            host.innerHTML = было;
        }
    });

});


/**
 * Осечка обмена — своими словами (Р-115).
 *
 * Когда обмен падает, у человека ровно один вопрос: пропали ли тренировки.
 * Окно отвечало на вопрос разработчика — английской строкой Firestore.
 */
describe('Профиль: осечка обмена', () => {

    it('человеку отвечают на его вопрос, а не на вопрос разработчика', async () => {
        await seed();

        const былоAlert = dialog.alert;
        const былSync = sync.run;
        const сказано = [];

        dialog.alert = async (o) => { сказано.push(o); return true; };
        sync.run = async () => ({ error: 'Failed to get document because the client is offline' });

        try {
            await press('sync-now');
            await пауза(300);
        } finally {
            dialog.alert = былоAlert;
            sync.run = былSync;
        }

        const окно = сказано.find((o) => /Обмен не прошёл/.test(o.title || ''));

        assert(окно, `окно показано: ${JSON.stringify(сказано).slice(0, 200)}`);
        assert(/ничего не пропало|нет связи/.test(окно.text || ''),
            `у человека один вопрос — пропали ли тренировки: ${окно.text}`);
        assert(/client is offline/.test(окно.text || ''),
            'техническая строка остаётся под своей — с ней и разбираются');
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

    /*
     * Действия упражнения живут в меню за одной кнопкой (Р-111), а не рядом
     * значками. Поэтому проверяется не разметка строки, а само меню: что оно
     * предлагает и чего не предлагает.
     */
    async function меню(упражнение) {
        const былоChoose = dialog.choose;
        let спрошено = null;

        dialog.choose = async (options) => { спрошено = options; return null; };

        try {
            await press('ex-menu', { id: упражнение.id });
        } finally {
            dialog.choose = былоChoose;
        }

        return (спрошено?.options || []).filter(Boolean);
    }

    const значения = (пункты) => пункты.map((o) => o.value);

    it('у каждого упражнения одна кнопка действий, а не ряд значков', async () => {
        await seed();

        const строка = (await screen(exercises)).querySelector('.ex-row');

        assert(строка.querySelector('[data-action="ex-menu"]'), 'меню на месте');
        equal(строка.querySelectorAll('.ex-actions button').length, 1,
            'ряд из четырёх значков съедал половину строки и резал имена');
    });

    it('используемое упражнение удалить нельзя, но сказано почему', async () => {
        const ex = await seed();
        await workout(ex, [[10, 60]]);

        const пункты = await меню(ex);

        assert(!значения(пункты).includes('delete'), 'удаление разорвало бы историю');
        assert(значения(пункты).includes('archive'), 'но архивировать можно');
        assert(пункты.some((o) => /Удалить нельзя/.test(o.label || '')),
            'исчезающая кнопка ничего не объясняет, а строка объясняет');
    });

    it('неиспользованное удалить можно', async () => {
        const ex = await seed();

        assert(значения(await меню(ex)).includes('delete'));
    });

    it('объединение предлагается словами, а не значком', async () => {
        const ex = await seed();
        const пункты = await меню(ex);

        assert(значения(пункты).includes('merge'));
        assert(пункты.some((o) => o.value === 'merge' && /то же упражнение/.test(o.hint || '')),
            'угадать «⇥» было невозможно — теперь сказано, зачем это');
    });

    it('архивированному предлагается вернуться, а не уйти в архив', async () => {
        const ex = await seed();
        await dbService.setExerciseArchived(ex.id, true);

        const view = await screen(exercises);
        assert(has(view, 'Архив'), 'архив показывается отдельным разделом');

        const значки = значения(await меню(ex));

        assert(значки.includes('restore'));
        assert(!значки.includes('archive'));
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

    /*
     * Смена режима не двигает выбранное упражнение (Р-51). Двигала: при
     * переключении подставлялось следующее по кругу, и переключатель работал
     * как листалка по списку упражнений.
     */
    it('переключение режима оставляет текущее упражнение', async () => {
        const первое = await seed();
        const второе = await dbService.createExercise({ name: 'Тяга', kind: 'weight', group: 'Спина' });
        const третье = await dbService.createExercise({ name: 'Присед', kind: 'weight', group: 'Ноги' });

        await dbService.createWorkout({ type: 'Силовая', plan: [первое, второе, третье].map((e) => ({
            exerciseId: e.id, plannedSets: 3, targetReps: 10, weight: 60, skipped: false
        }))});

        await screen(session);

        // Смотреть надо на карточку, а не на весь экран: названия всех
        // упражнений стоят внизу списком, и проверка «есть ли на экране
        // слово» проходила бы при любом поведении
        const текущее = (view) => view.querySelector('.sess-name')?.textContent.trim();

        // Встали на второе руками — так же, как нажатием на него в списке
        await press('sess-select', { id: второе.id });
        equal(текущее(await screen(session)), 'Тяга', 'выбрали второе');

        for (const режим of ['circuit', 'linear', 'free']) {
            await press('sess-mode', { mode: режим });

            equal(текущее(await screen(session)), 'Тяга',
                `режим «${режим}» не должен уводить с выбранного упражнения`);
        }
    });

    /*
     * Дополнительный вес спрятан за ссылкой, а строка нагрузки стоит в
     * разметке всегда (Р-53): она обязана ответить на ввод до записи
     * подхода, а появиться в разметке по перерисовке — значит опоздать.
     */
    it('дополнительный вес спрятан, а строка нагрузки ждёт наготове', async () => {
        const отжимания = await seed({ name: 'Отжимания', kind: 'reps', group: 'Грудь' });
        await dbService.setBodyWeight({ weight: 80 });

        const w = await dbService.createWorkout({ type: 'Силовая', plan: [
            { exerciseId: отжимания.id, plannedSets: 3, targetReps: 20, weight: 0, skipped: false }
        ]});

        const пусто = await screen(session);

        equal(пусто.querySelector('#f-weight-row').hidden, true, 'поле довеса закрыто');
        equal(пусто.querySelector('[data-action="sess-weight-toggle"]').textContent.trim(),
            '＋ дополнительный вес', 'ссылка на месте и зовёт открыть');
        assert(пусто.querySelector('#rec-extra'), 'строка нагрузки должна быть в разметке заранее');
        equal(пусто.querySelector('#rec-extra').hidden, true, 'но молчит, пока складывать нечего');
        assert(has(пусто, 'Своим весом'), '80 × 0,64 — эта строка есть всегда');

        // Записан подход с поясом: следующий подход подставит его же
        await dbService.addSet({
            workoutId: w.id, exerciseId: отжимания.id, order: 1, setNumber: 1, reps: 20, weight: 10
        });

        const с_поясом = await screen(session);

        equal(с_поясом.querySelector('#f-weight-row').hidden, false, 'записанный довес прятать нельзя');
        equal(с_поясом.querySelector('[data-action="sess-weight-toggle"]').textContent.trim(),
            '− дополнительный вес', 'ссылка предлагает свернуть тем же движением');
        equal(с_поясом.querySelector('#rec-extra').hidden, false);
        assert(has(с_поясом, 'С дополнительным весом'), 'и называет, во что это сложилось');

        // Своей подписи у поля нет: её роль играет ссылка над ним, и со
        // своей выходило два одинаковых слова подряд
        equal(text(с_поясом.querySelector('#f-weight-row')), 'кг',
            'подпись поля повторяла бы ссылку слово в слово');
    });

    /*
     * Ориентир берётся из сравнимой тренировки (Р-54).
     *
     * Случай владельца: отжимания входят и в зарядку одним подходом, и в
     * дневную тренировку на двенадцать. Стоя на двенадцати, он видел вместо
     * ориентира утреннюю зарядку — один подход без всякого счёта.
     */
    it('прошлый раз берётся из тренировки того же типа, а не из зарядки', async () => {
        const отжимания = await seed({ name: 'Отжимания', kind: 'reps', group: 'Грудь' });

        // Позавчера — дневная тренировка на шесть подходов
        await workout(отжимания, Array.from({ length: 6 }, () => [20, 0]),
            { at: Date.now() - 2 * DAY, type: 'Дома без инвентаря' });

        // А сегодня утром зарядка, одним подходом
        await workout(отжимания, [[65, 0]], { at: Date.now() - 3600000, type: 'Зарядка' });

        await dbService.createWorkout({ type: 'Дома без инвентаря', plan: [
            { exerciseId: отжимания.id, plannedSets: 12, targetReps: 20, weight: 0, skipped: false }
        ]});

        const view = await screen(session);
        const строка = text(view.querySelector('.rec-line'));

        assert(строка.includes('6 подходов'), `ориентир должен быть дневной, а не зарядкой: «${строка}»`);
        assert(!строка.includes('65'), 'утренняя зарядка дневной работе не ориентир');
    });

    /*
     * Зарядке ориентир — прошлая зарядка: правило работает в обе стороны, а
     * не выкидывает фон отовсюду.
     */
    it('в самой зарядке ориентир — прошлая зарядка', async () => {
        const отжимания = await seed({ name: 'Отжимания', kind: 'reps', group: 'Грудь' });

        await workout(отжимания, Array.from({ length: 6 }, () => [20, 0]),
            { at: Date.now() - 2 * DAY, type: 'Дома без инвентаря' });
        await workout(отжимания, [[65, 0]], { at: Date.now() - DAY, type: 'Зарядка' });

        await dbService.createWorkout({ type: 'Зарядка', plan: [
            { exerciseId: отжимания.id, plannedSets: 1, targetReps: 65, weight: 0, skipped: false }
        ]});

        const строка = text((await screen(session)).querySelector('.rec-line'));

        assert(строка.includes('65'), `в зарядке сравнивают с зарядкой: «${строка}»`);
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
        assert(has(await screen(stats), 'сначала проведите тренировку'));
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

    /*
     * Замеры правятся и убираются (Р-98). До этого запись веса была
     * односторонней: ошибся цифрой — и «39,1 кг» оставались в графике
     * навсегда, перекашивая и линию, и «за период».
     */
    it('каждый замер можно поправить и убрать', async () => {
        const ex = await seed();
        await workout(ex, [[10, 60]]);

        await dbService.setBodyWeight({ weight: 93.1, waist: 98 });

        const view = await screen(stats);

        assert(has(view, 'Все замеры'), `список замеров обязан быть: ${text(view).slice(0, 200)}`);
        assert(hasAction(view, 'body-edit'), 'правка');
        assert(hasAction(view, 'body-drop'), 'удаление');
        assert(has(view, '98'), 'обхват виден в строке');
    });

    it('удаление убирает замер из графика и из счёта', async () => {
        const ex = await seed();
        await workout(ex, [[10, 60]]);

        const первый = await dbService.setBodyWeight({ at: Date.now() - 7 * DAY, weight: 94 });
        await dbService.setBodyWeight({ weight: 93 });

        const было = await dbService.listBodyWeight();
        equal(было.length, 2);

        const подтвердить = dialog.confirm;
        dialog.confirm = async () => true;

        try {
            await press('body-drop', { id: первый.id });
        } finally {
            dialog.confirm = подтвердить;
        }

        equal((await dbService.listBodyWeight()).length, 1);

        const view = await screen(stats);
        assert(!has(view, '94'), `убранный замер не должен считаться: ${text(view).slice(0, 200)}`);
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
     * блин на брусьях. Без колонки его негде ни увидеть, ни исправить.
     *
     * Колонка называется довесом, а не весом (Р-57): в подходе записан не
     * вес упражнения, а добавка к собственному, и на выполнении она так и
     * подписана. Одно число под двумя именами, причём второе неверное, —
     * это и заметил владелец.
     */
    it('собственный вес — повторения и довес', async () => {
        const view = await однимУпражнением('reps', { reps: 25 });

        equal(колонки(view), ['Подход', 'Повторения', 'Довес, кг']);
        assert(has(view, '—'), 'без довеса клетка пустует, но колонка на месте');
    });

    it('довес показывается и правится', async () => {
        const view = await однимУпражнением('reps', { reps: 8, weight: 20 });

        equal(колонки(view), ['Подход', 'Повторения', 'Довес, кг']);
        assert(has(view, '20'));
    });

    it('у силового упражнения колонка остаётся весом', async () => {
        const view = await однимУпражнением('weight', { reps: 10, weight: 60 });

        equal(колонки(view), ['Подход', 'Повторения', 'Вес, кг'],
            'там это и есть вес снаряда, а не добавка к своему');
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
        'Тренер и профиль',
        'Часы и календарь',
        'Кондиции: в каком вы состоянии',
        'Четыре раздела: где что искать',
        'Быстрые способы начать',
        'Во время тренировки',
        'План тренировок',
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
 * Справочник: счёт подходов и правда про архив (§5, Р-122).
 */
describe('Экран: справочник, счёт и поиск', () => {

    /*
     * Удаление подхода помечает запись, а не стирает: иначе удалённое на одном
     * устройстве вернулось бы с другого. Счёт же брал все строки подряд — и
     * упражнение навсегда теряло право быть удалённым.
     */
    it('удалённые подходы в счёт упражнения не идут', async () => {
        const ex = await seed();
        const w = await workout(ex, [[10, 60], [8, 60]]);

        equal(await dbService.countSetsOfExercise(ex.id), 2);

        for (const подход of await dbService.listSets(w.id)) await dbService.deleteSet(подход.id);

        equal(await dbService.countSetsOfExercise(ex.id), 0,
            'история стёрта — значит упражнение свободно');
    });

    it('стёртая история возвращает право удалить упражнение', async () => {
        const ex = await seed();
        const w = await workout(ex, [[10, 60]]);

        for (const подход of await dbService.listSets(w.id)) await dbService.deleteSet(подход.id);

        await dbService.deleteExercise(ex.id);

        equal(await dbService.getExercise(ex.id), null, 'иначе завести по ошибке — навсегда');
    });

    /*
     * Ищут в справочнике чаще всего затерявшееся — то, что когда-то убрали.
     * Прочитав «нет такого», человек заводит упражнение заново и разрезает
     * историю надвое: ровно то, ради чего справочник и существует.
     */
    it('о найденном в архиве говорится, а не «ничего не нашлось»', async () => {
        const ex = await seed({ name: 'Жим лёжа' });
        await dbService.setExerciseArchived(ex.id, true);

        // Поле поиска появляется только на длинном списке (§5.3)
        for (let i = 0; i < 12; i++) {
            await dbService.createExercise({ name: `Упражнение ${i}`, kind: 'weight', group: 'Спина' });
        }

        const view = await screen(exercises);

        document.body.appendChild(view);

        try {
            const поле = view.querySelector('#ex-search');
            поле.value = 'жим';
            поле.dispatchEvent(new Event('input', { bubbles: true }));

            await new Promise((r) => setTimeout(r, 60));

            const строка = view.querySelector('#ex-nothing');

            assert(!строка.hidden, 'в работе правда ничего');
            assert(строка.textContent.includes('архив') || строка.textContent.includes('Архив'),
                `неправда прямо над опровержением: «${строка.textContent}»`);
        } finally {
            view.remove();
        }
    });
});

/**
 * Кондиции (§66).
 *
 * Единственный экран, где приложение говорит «хорошо» или «стоит посмотреть».
 * Проверяется не арифметика — она своя, — а правило цвета: красится только то,
 * у чего есть с чем сравнить, и основание стоит рядом с оценкой.
 */
describe('Экран: кондиции', () => {

    const DAY = 86400000;

    async function профиль(over = {}) {
        await dbService.setSetting(ATHLETE_KEY, {
            sex: 'male', birthYear: 1982, height: 185, goal: 'убрать живот', ...over
        });
    }

    it('без роста и замеров честно говорит, что считать не из чего', async () => {
        await seed();
        await dbService.setSetting(ATHLETE_KEY, null);

        const строка = text(await screen(condition));

        assert(строка.includes('не из чего считать'), строка.slice(0, 200));
    });

    it('норма названа рядом с оценкой', async () => {
        await seed();
        await профиль();
        await dbService.setBodyWeight({ weight: 92.9, waist: 102 });

        const view = await screen(condition);
        const плитки = [...view.querySelectorAll('.cond-tile')];

        const имт = плитки.find((p) => p.textContent.includes('Индекс массы тела'));

        assert(имт, 'ИМТ обязан быть');
        assert(имт.textContent.includes('ВОЗ'), `чья мерка — часть оценки: ${имт.textContent.trim()}`);
        assert(имт.classList.contains('is-watch'), '27,1 выше нормы ВОЗ');

        await dbService.setSetting(ATHLETE_KEY, null);
    });

    /*
     * Доля мышц справочная: нормы у неё нет, и покрасив её, приложение
     * изобразило бы медицинское знание, которого у него нет.
     */
    it('справочные величины не красятся', async () => {
        await seed();
        await профиль();
        await dbService.setBodyWeight({
            weight: 92.9, waist: 102, body: { fat: 24.3, water: 54.2, muscle: 41 }
        });

        const плитки = [...(await screen(condition)).querySelectorAll('.cond-tile')];
        const мышцы = плитки.find((p) => p.dataset.key === 'muscle');

        assert(мышцы, 'доля мышц с весов обязана быть показана');
        assert(!мышцы.classList.contains('is-good') && !мышцы.classList.contains('is-watch'),
            'нормы у неё нет — красить нечем');

        /*
         * А воды на этом экране нет вовсе (Р-163): норм нет, толковать её
         * приложение не берётся, и плитка стояла седьмой в карточке из семи,
         * не говоря ничего. Число не пропало — оно на главном экране.
         */
        assert(!плитки.some((p) => p.dataset.key === 'water'),
            'вода убрана с кондиций: плитка, которая ничего не говорит, отнимает внимание у тех, что говорят');

        await dbService.setSetting(ATHLETE_KEY, null);
    });

    /*
     * Без цели в профиле «минус килограмм» — это и хорошо, и плохо, и решать
     * за человека приложение не вправе.
     */
    it('без цели вес не красится, и об этом сказано', async () => {
        await seed();
        await профиль({ goal: '' });
        await dbService.setBodyWeight({ at: Date.now() - 40 * DAY, weight: 95 });
        await dbService.setBodyWeight({ weight: 92.9 });

        const view = await screen(condition);
        const вес = [...view.querySelectorAll('.cond-tile')].find((p) => p.textContent.includes('Вес'));

        assert(!вес.classList.contains('is-good'), 'куда «хорошо» — решает цель, а её нет');
        assert(text(view).includes('не названа цель'), 'и молчать об этом нельзя');

        await dbService.setSetting(ATHLETE_KEY, null);
    });

    /*
     * Первый заход сравнивал сегодняшний замер с сегодняшним же: окно искало
     * первый замер после границы, а свежий в него и попадал (Р-134).
     */
    it('месяц назад — это замер месячной давности, а не сегодняшний', async () => {
        await seed();
        await профиль();
        await dbService.setBodyWeight({ at: Date.now() - 30 * DAY, weight: 94.1 });
        await dbService.setBodyWeight({ weight: 92.9 });

        const view = await screen(condition);
        const вес = [...view.querySelectorAll('.cond-tile')].find((p) => p.textContent.includes('Вес'));

        assert(вес.textContent.includes('1,2'), `ход обязан посчитаться: ${вес.textContent.trim()}`);
        assert(вес.classList.contains('is-good'), 'цель «убрать живот», вес вниз — это туда');

        await dbService.setSetting(ATHLETE_KEY, null);
    });

    /*
     * Нажатие раскрывает ход на месте, а не окном поверх экрана (Р-136).
     *
     * Окно приходилось закрывать, чтобы взглянуть на соседнее число, — а
     * вопрос «куда идёт» задают всем числам подряд.
     */
    it('плитка раскрывается графиком, и повторное нажатие его убирает', async () => {
        await seed();
        await профиль();
        await dbService.setBodyWeight({ at: Date.now() - 30 * DAY, weight: 94.1 });
        await dbService.setBodyWeight({ weight: 92.9 });

        await press('cond-why', { key: 'weight' });

        const view = await screen(condition);
        const разворот = view.querySelector('.cond-detail');

        assert(разворот, 'разворот обязан появиться');
        assert(разворот.querySelector('svg'), 'и в нём линия хода, а не одни слова');

        const вес = [...view.querySelectorAll('.cond-tile')].find((p) => p.dataset.key === 'weight');
        equal(вес.getAttribute('aria-expanded'), 'true');

        await press('cond-why', { key: 'weight' });

        assert(!(await screen(condition)).querySelector('.cond-detail'),
            'нажатие на раскрытую плитку её закрывает — иначе разворот нечем убрать');

        await dbService.setSetting(ATHLETE_KEY, null);
    });

    /*
     * «Вода» и «Мышцы» стояли под общим ключом: объяснение у них и правда
     * одно, но ряды разные, и нажатие на мышцы показывало бы ход воды.
     */
    it('у каждой плитки свой ряд, даже когда объяснение общее', async () => {
        await seed();
        await профиль();
        await dbService.setBodyWeight({
            at: Date.now() - 30 * DAY, weight: 94.1, body: { water: 55.1, muscle: 40.2 }
        });
        await dbService.setBodyWeight({ weight: 92.9, body: { water: 54.2, muscle: 41 } });

        await press('cond-why', { key: 'muscle' });

        const view = await screen(condition);

        equal(text(view.querySelector('.cond-detail .chart-title')), 'Мышцы');

        condition.leave();
        await dbService.setSetting(ATHLETE_KEY, null);
    });

    /*
     * Одна точка — это ещё не ход: линия по ней изображала бы движение там,
     * где его не видно.
     */
    it('по одному замеру ход не рисуется, и об этом сказано', async () => {
        await seed();
        await профиль();
        await dbService.setBodyWeight({ weight: 92.9 });

        await press('cond-why', { key: 'weight' });

        const view = await screen(condition);

        assert(!view.querySelector('.cond-detail svg'), 'линии по одной точке не бывает');
        assert(text(view).includes('два измерения'), 'и молчать об этом нельзя');

        condition.leave();
        await dbService.setSetting(ATHLETE_KEY, null);
    });

    /*
     * Безразмерной величине шкала нужна так же, как весу (Р-114, Р-136).
     *
     * Отношение талии к росту живёт между 0,4 и 0,6: прежде шкала бралась
     * только там, где названа единица измерения, а размах плоского ряда не
     * опускался ниже единицы — поле уезжало от нуля до единицы, и линия
     * ложилась посередине пустоты.
     */
    it('у отношения талии к росту шкала названа двумя разными числами', async () => {
        await seed();
        await профиль();
        await dbService.setBodyWeight({ at: Date.now() - 30 * DAY, weight: 94.1, waist: 103 });
        await dbService.setBodyWeight({ weight: 92.9, waist: 102 });

        await press('cond-why', { key: 'wht' });

        const view = await screen(condition);
        const подписи = [...view.querySelectorAll('.cond-detail .chart-label')]
            .map((n) => n.textContent.trim());

        const числа = подписи.filter((s) => /^0,\d/.test(s));

        equal(числа.length, 2, `шкала обязана быть подписана: ${подписи.join(' | ')}`);
        assert(числа[0] !== числа[1], `и называть два разных края: ${числа.join(' и ')}`);

        condition.leave();
        await dbService.setSetting(ATHLETE_KEY, null);
    });

    /*
     * Цифровая цель говорит то, чего не скажут слова (§67, Р-155).
     */
    it('объявленная цель показывает пройденное, остаток и срок', async () => {
        await seed();
        await профиль({ goal: '' });

        await dbService.setBodyWeight({ at: Date.now() - 28 * DAY, weight: 94.2 });
        await dbService.setBodyWeight({ weight: 92.6 });

        await setGoal('weight', 88, 94.2);

        condition.leave();
        await press('cond-why', { key: 'weight' });

        const разворот = text((await screen(condition)).querySelector('.cond-detail'));

        assert(разворот.includes('прошли 1,6'), `пройденное впереди остатка: ${разворот.slice(0, 160)}`);
        assert(разворот.includes('осталось 4,6'), разворот.slice(0, 160));

        condition.leave();
        for (const ключ of [GOALS_KEY, ATHLETE_KEY]) await dbService.setSetting(ключ, null);
    });

    /*
     * Словесная цель разбирается выражением и ошибается; названное число не
     * ошибается вовсе — из него направление видно точно.
     */
    it('цифра задаёт направление даже без слов в профиле', async () => {
        await seed();
        await профиль({ goal: '' });

        await dbService.setBodyWeight({ at: Date.now() - 30 * DAY, weight: 94.2 });
        await dbService.setBodyWeight({ weight: 92.6 });

        await setGoal('weight', 88, 94.2);

        const вес = [...(await screen(condition)).querySelectorAll('.cond-tile')]
            .find((p) => p.dataset.key === 'weight');

        assert(вес.classList.contains('is-good'),
            'цель ниже нынешнего веса — значит вниз хорошо, и слова для этого не нужны');

        for (const ключ of [GOALS_KEY, ATHLETE_KEY]) await dbService.setSetting(ключ, null);
    });

    /*
     * Идущему в другую сторону дата не обещается: это было бы выдумкой.
     */
    it('обратный ход называется прямо, а срок не выдумывается', async () => {
        await seed();
        await профиль({ goal: '' });

        await dbService.setBodyWeight({ at: Date.now() - 28 * DAY, weight: 92.0 });
        await dbService.setBodyWeight({ weight: 93.4 });

        await setGoal('weight', 88, 92.0);

        condition.leave();
        await press('cond-why', { key: 'weight' });

        const разворот = text((await screen(condition)).querySelector('.cond-detail'));

        assert(разворот.includes('в другую сторону'), разворот.slice(0, 160));
        assert(!разворот.includes('придёте'), 'срока у обратного хода нет');

        condition.leave();
        for (const ключ of [GOALS_KEY, ATHLETE_KEY]) await dbService.setSetting(ключ, null);
    });

    /*
     * Зарядка делается каждое утро, и вместе с ней у владельца выходило 7,8
     * «тренировок» в неделю — верхняя ступень коэффициента. Суточный расход
     * завышался на шестьсот с лишним килокалорий (Р-154).
     */
    it('зарядка не поднимает коэффициент активности', async () => {
        const ex = await seed();
        await профиль();
        await dbService.setBodyWeight({ weight: 92.9 });

        // Две настоящие тренировки в неделю и зарядка каждый день
        for (let i = 1; i <= 8; i++) {
            await workout(ex, [[10, 60]], { at: Date.now() - i * 3 * DAY });
        }

        for (let i = 1; i <= 26; i++) {
            await workout(ex, [[20, 0]], { at: Date.now() - i * DAY, type: 'Зарядка' });
        }

        const строка = text(await screen(condition));

        assert(строка.includes('Зарядка сюда не входит'), 'и сказано об этом прямо');

        const расход = [...(await screen(condition)).querySelectorAll('.cond-tile')]
            .find((p) => p.dataset.key === 'amr');

        assert(расход, 'плитка расхода обязана быть');
        assert(!расход.textContent.includes('1,9'),
            `коэффициент не должен быть верхней ступенью: ${расход.textContent.replace(/\s+/g, ' ').trim()}`);

        await dbService.setSetting(ATHLETE_KEY, null);
    });

    /*
     * Ход виден без нажатия (Р-153): за ним сюда и приходят, а раскрывать
     * каждую плитку ради наклона — десять нажатий на экран.
     */
    it('в плитке есть линия хода, когда есть из чего её строить', async () => {
        await seed();
        await профиль();
        await dbService.setBodyWeight({ at: Date.now() - 30 * DAY, weight: 94.1 });
        await dbService.setBodyWeight({ weight: 92.9 });

        const вес = [...(await screen(condition)).querySelectorAll('.cond-tile')]
            .find((p) => p.dataset.key === 'weight');

        assert(вес.querySelector('.spark'), 'линия стоит прямо в плитке');

        await dbService.setSetting(ATHLETE_KEY, null);
    });

    it('по одному замеру линии в плитке нет', async () => {
        await seed();
        await профиль();
        await dbService.setBodyWeight({ weight: 92.9 });

        const вес = [...(await screen(condition)).querySelectorAll('.cond-tile')]
            .find((p) => p.dataset.key === 'weight');

        assert(!вес.querySelector('.spark'), 'наклон по одной точке — выдумка');

        await dbService.setSetting(ATHLETE_KEY, null);
    });

    /*
     * Вариабельность и оценка сна приезжали с часов и хранились, а на
     * дашборде их не было вовсе (Р-153).
     */
    it('вариабельность и оценка сна показываются, когда часы их прислали', async () => {
        await seed();
        await профиль();

        const полночь = new Date(new Date().setHours(0, 0, 0, 0)).getTime();

        await dbService.setSetting('icuWellness', {
            at: Date.now(),
            rows: [6, 5, 4, 3, 2, 1].map((назад) => ({
                date: полночь - назад * DAY,
                sleep: 25200, rhr: 52, hrv: 48, steps: 9000, score: 81
            }))
        });

        const плитки = [...(await screen(condition)).querySelectorAll('.cond-tile')];

        const всп = плитки.find((p) => p.dataset.key === 'hrv');
        const оценка = плитки.find((p) => p.dataset.key === 'score');

        assert(всп, 'вариабельность хранилась и молчала');
        assert(всп.textContent.includes('48'), всп.textContent.replace(/\s+/g, ' ').trim());

        assert(оценка, 'оценка сна тоже');
        assert(оценка.textContent.includes('81'), оценка.textContent.replace(/\s+/g, ' ').trim());
        assert(!оценка.classList.contains('is-good') && !оценка.classList.contains('is-watch'),
            'её считают часы по своим соображениям — красить нечем');

        for (const ключ of ['icuWellness', ATHLETE_KEY]) await dbService.setSetting(ключ, null);
    });

    /*
     * Перекос — вопрос состояния, а не отчёта (Р-138). Ориентир взят из
     * тренировочных обзоров и потому назван рядом с числом, как и все
     * остальные мерки этого экрана.
     */
    it('нагрузка по группам названа с ориентиром и покрашена по нему', async () => {
        const грудь = await seed({ name: 'Жим лёжа', kind: 'weight', group: 'Грудь' });
        const ноги = await dbService.createExercise({ name: 'Присед', kind: 'weight', group: 'Ноги' });

        await профиль();

        // Не ближе недели: нынешняя неделя ещё идёт и в счёт не входит
        await workout(грудь, [[10, 60], [10, 60], [10, 60]], { at: Date.now() - 10 * DAY });
        await workout(ноги, [[10, 80]], { at: Date.now() - 12 * DAY });

        const view = await screen(condition);
        const плитки = [...view.querySelectorAll('.cond-tile')];

        const нога = плитки.find((p) => p.textContent.includes('Ноги'));

        assert(нога, `карточка нагрузки обязана быть: ${text(view).slice(0, 300)}`);
        assert(нога.textContent.includes('ориентир'), `мерка называется: ${нога.textContent.trim()}`);
        assert(нога.classList.contains('is-watch'), 'один подход за месяц — это «стоит посмотреть»');

        await dbService.setSetting(ATHLETE_KEY, null);
    });

    /*
     * У групп мышц ноль — это данные, а не пропуск: неделя без единого
     * подхода на спину и есть то, ради чего на график смотрят.
     */
    it('в развороте группы неделя без подходов остаётся на линии', async () => {
        const грудь = await seed({ name: 'Жим лёжа', kind: 'weight', group: 'Грудь' });

        await профиль();
        await workout(грудь, [[10, 60]], { at: Date.now() - 10 * DAY });
        await workout(грудь, [[10, 60]], { at: Date.now() - 24 * DAY });

        await press('cond-why', { key: 'group:Грудь' });

        const view = await screen(condition);
        const разворот = view.querySelector('.cond-detail');

        assert(разворот, 'плитка группы раскрывается так же, как все прочие');
        assert(разворот.querySelector('svg'), 'и в ней линия по неделям');
        equal(text(разворот.querySelector('.chart-title')), 'Грудь');

        condition.leave();
        await dbService.setSetting(ATHLETE_KEY, null);
    });

    /*
     * У колеблющихся величин полоса «как обычно» отвечает на вопрос, на
     * который линия сама по себе не отвечает: сегодняшнее число обычное или
     * нет (Р-139). У веса её нет — там направление, а не уровень.
     */
    it('у пульса покоя есть обычная полоса, у веса — нет', async () => {
        await seed();
        await профиль();

        await dbService.setBodyWeight({ at: Date.now() - 30 * DAY, weight: 94.1 });
        await dbService.setBodyWeight({ weight: 92.9 });

        const полночь = new Date(new Date().setHours(0, 0, 0, 0)).getTime();

        await dbService.setSetting('icuWellness', {
            at: Date.now(),
            rows: [7, 6, 5, 4, 3, 2, 1].map((назад, i) => ({
                date: полночь - назад * DAY,
                sleep: 25200, steps: 9000, rhr: 50 + i
            }))
        });

        await press('cond-why', { key: 'rhr' });
        const пульс = (await screen(condition)).querySelector('.cond-detail');

        assert(пульс.querySelector('rect'), 'полоса рисуется прямоугольником за линией');
        assert(text(пульс).includes('обычная полоса'), 'и сказано, что это за полоса');

        await press('cond-why', { key: 'weight' });
        const вес = (await screen(condition)).querySelector('.cond-detail');

        assert(!вес.querySelector('rect'), 'у веса полоса накрыла бы весь график и не сказала бы ничего');

        condition.leave();
        for (const ключ of ['icuWellness', ATHLETE_KEY]) await dbService.setSetting(ключ, null);
    });

    /*
     * Готовность говорит, где человек сейчас, разгон — как быстро он туда
     * шёл (Р-140). Второе из первого не прочесть: в лёгком минусе можно
     * оказаться и спокойно, и рывком.
     */
    it('разгон стоит рядом с готовностью и назван своей меркой', async () => {
        await seed();
        await профиль();

        const полночь = new Date(new Date().setHours(0, 0, 0, 0)).getTime();

        await dbService.setSetting('icuWellness', {
            at: Date.now(),
            rows: [
                { date: полночь - 2 * DAY, sleep: 25200, rhr: 52, ctl: 50, atl: 48 },
                { date: полночь - DAY, sleep: 25200, rhr: 52, ctl: 50, atl: 80 }
            ]
        });

        const view = await screen(condition);
        const плитки = [...view.querySelectorAll('.cond-tile')];
        const разгон = плитки.find((p) => p.dataset.key === 'ramp');

        assert(разгон, `разгон обязан быть: ${text(view).slice(0, 300)}`);
        assert(разгон.textContent.includes('1,6'), `80 к 50 — это 1,6: ${разгон.textContent.trim()}`);
        assert(разгон.textContent.includes('ориентир'), 'мерка называется рядом');
        assert(разгон.classList.contains('is-watch'), 'так и срываются');

        await dbService.setSetting('icuWellness', null);
        await dbService.setSetting(ATHLETE_KEY, null);
    });

    /*
     * Мерка в килограммах, а не в индексах (Р-141): «27,1» не говорит
     * ничего, «от 63 до 86 кг» говорит всё.
     */
    it('в развороте веса названа вилка в килограммах, а талии — пороги в сантиметрах', async () => {
        await seed();
        await профиль();
        await dbService.setBodyWeight({ at: Date.now() - 30 * DAY, weight: 94.1, waist: 103 });
        await dbService.setBodyWeight({ weight: 92.9, waist: 102 });

        await press('cond-why', { key: 'weight' });
        const вес = text((await screen(condition)).querySelector('.cond-detail'));

        assert(вес.includes('63,4') && вес.includes('85,5'), `вилка для 185 см: ${вес.slice(-260)}`);

        await press('cond-why', { key: 'waist' });
        const талия = text((await screen(condition)).querySelector('.cond-detail'));

        assert(талия.includes('94') && талия.includes('102'), `пороги для мужчины: ${талия.slice(-260)}`);

        condition.leave();
        await dbService.setSetting(ATHLETE_KEY, null);
    });

    /*
     * Зелёный вес рядом с жёлтым индексом выглядит спором карточки с самой
     * собой, пока не сказано, что цвет тут про ход, а не про величину.
     */
    it('сказано, что вес и талия покрашены по ходу, а не по величине', async () => {
        await seed();
        await профиль();
        await dbService.setBodyWeight({ at: Date.now() - 30 * DAY, weight: 94.1 });
        await dbService.setBodyWeight({ weight: 92.9 });

        const строка = text(await screen(condition));

        assert(строка.includes('по ходу, а не по величине'), строка.slice(0, 300));

        await dbService.setSetting(ATHLETE_KEY, null);
    });

    /*
     * Карточка заведена отвечать «не забыл ли я что-нибудь». Отбор по
     * «больше нуля подходов в неделю» выбрасывал из неё ровно забытое
     * (Р-142).
     */
    it('брошенная группа остаётся на виду и называет срок', async () => {
        const грудь = await seed({ name: 'Жим лёжа', kind: 'weight', group: 'Грудь' });
        const ноги = await dbService.createExercise({ name: 'Присед', kind: 'weight', group: 'Ноги' });

        await профиль();

        await workout(грудь, [[10, 60]], { at: Date.now() - 10 * DAY });
        await workout(ноги, [[10, 80]], { at: Date.now() - 45 * DAY });

        const view = await screen(condition);
        const нога = [...view.querySelectorAll('.cond-tile')].find((p) => p.dataset.key === 'group:Ноги');

        assert(нога, `брошенная группа обязана остаться: ${text(view).slice(0, 300)}`);
        assert(нога.textContent.includes('без единого подхода'),
            `и назвать срок, а не ориентир: ${нога.textContent.replace(/\s+/g, ' ').trim()}`);
        assert(нога.classList.contains('is-watch'), 'месяц без ног — это «стоит посмотреть»');

        await dbService.setSetting(ATHLETE_KEY, null);
    });

    /*
     * Перерисовка читает всю таблицу подходов: на пяти годах истории это
     * около полусекунды на каждое касание плитки (Р-142). Разворот собирается
     * из уже посчитанных рядов, и читать для него нечего.
     */
    it('раскрытие плитки правит узел и базу не трогает', async () => {
        await seed();
        await профиль();
        await dbService.setBodyWeight({ at: Date.now() - 30 * DAY, weight: 94.1 });
        await dbService.setBodyWeight({ weight: 92.9 });

        condition.leave();

        const настоящий = dbService.allSets;
        let чтений = 0;

        dbService.allSets = async (...args) => {
            чтений += 1;
            return настоящий.call(dbService, ...args);
        };

        const место = document.createElement('div');

        try {
            место.innerHTML = String(await condition.render());
            document.body.appendChild(место);

            equal(чтений, 1, 'отрисовка читает базу — это законно');

            const плитка = место.querySelector('.cond-tile[data-key="weight"]');

            плитка.click();
            await new Promise((r) => setTimeout(r, 60));

            const разворот = место.querySelector('.cond-detail');

            assert(разворот, 'разворот встаёт прямо в разметку');
            assert(разворот.previousElementSibling?.classList.contains('cond-grid'),
                'и ровно под сеткой, а не в середине ряда плиток');
            equal(плитка.getAttribute('aria-expanded'), 'true');

            плитка.click();
            await new Promise((r) => setTimeout(r, 60));

            assert(!место.querySelector('.cond-detail'), 'тем же нажатием убирается');
            equal(чтений, 1, 'и ни одно из нажатий базу не перечитало');
        } finally {
            dbService.allSets = настоящий;
            место.remove();
        }

        condition.leave();
        await dbService.setSetting(ATHLETE_KEY, null);
    });

    /*
     * Строка про непроставленную группу была тупиком: человек узнавал, что
     * часть его подходов не посчитана, и оставался с этим (Р-143).
     */
    it('от непроставленной группы есть дорога в справочник', async () => {
        const грудь = await seed({ name: 'Жим лёжа', kind: 'weight', group: 'Грудь' });
        const без = await dbService.createExercise({ name: 'Планка', kind: 'time', group: '' });

        await профиль();
        await workout(грудь, [[10, 60]], { at: Date.now() - 10 * DAY });
        await workout(без, [[30, 0]], { at: Date.now() - 10 * DAY });

        const view = await screen(condition);

        assert(text(view).includes('группа не указана'), 'сказать надо');
        assert(view.querySelector('[data-action="nav"][data-screen="exercises"]'),
            'и дать куда пойти');

        await dbService.setSetting(ATHLETE_KEY, null);
    });

    /*
     * У графиков стоит role="img", и без имени читалка говорит
     * «изображение» и замолкает — всё содержимое картинки пропадает (Р-143).
     */
    it('у графика есть имя для читалки экрана', async () => {
        await seed();
        await профиль();
        await dbService.setBodyWeight({ at: Date.now() - 30 * DAY, weight: 94.1 });
        await dbService.setBodyWeight({ weight: 92.9 });

        condition.leave();
        await press('cond-why', { key: 'weight' });

        const svg = (await screen(condition)).querySelector('.cond-detail svg');
        const подпись = svg?.getAttribute('aria-label') || '';

        assert(подпись.includes('Вес'), `имя начинается с названия величины: «${подпись}»`);
        assert(подпись.includes('92,9'), `и досказывает границы: «${подпись}»`);

        condition.leave();
        await dbService.setSetting(ATHLETE_KEY, null);
    });

    /*
     * Зеркало брошенной группы: начатая в понедельник пропадала с экрана
     * вовсе, потому что полных недель у неё ещё нет (Р-146).
     */
    it('группа, начатая на этой неделе, видна и не оценивается', async () => {
        const грудь = await seed({ name: 'Жим лёжа', kind: 'weight', group: 'Грудь' });
        const ноги = await dbService.createExercise({ name: 'Присед', kind: 'weight', group: 'Ноги' });

        await профиль();

        await workout(грудь, [[10, 60]], { at: Date.now() - 10 * DAY });
        await workout(ноги, [[10, 80], [10, 80]], { at: Date.now() });

        const view = await screen(condition);
        const нога = [...view.querySelectorAll('.cond-tile')].find((p) => p.dataset.key === 'group:Ноги');

        assert(нога, `начатая группа обязана быть видна: ${text(view).slice(0, 300)}`);
        assert(нога.textContent.includes('с понедельника'), `и объяснена: ${нога.textContent.replace(/\s+/g, ' ').trim()}`);
        assert(!нога.classList.contains('is-watch') && !нога.classList.contains('is-good'),
            'оценивать нечего: полных недель у неё ещё нет');

        await dbService.setSetting(ATHLETE_KEY, null);
    });

    /*
     * Пока приложение спрашивает наружу, человек видит окно (Р-161).
     *
     * Окно с полями к этому времени закрылось, ответа ещё нет, и без этого
     * не происходило ничего видимого секунд пять: нажал — и тишина.
     */
    it('на время вопроса наружу стоит окно ожидания', async () => {
        const окно = dialog.waiting({ title: 'Считаю', text: 'Подождите' });

        const узел = document.querySelector('.dialog[aria-busy="true"]');

        assert(узел, 'окно обязано быть на экране, пока идёт вопрос');
        assert(узел.textContent.includes('Считаю'), узел.textContent.trim());

        equal(узел.querySelectorAll('button').length, 0,
            'нажимать нечего: «Отмена», которая ничего не отменяет, хуже её отсутствия');

        // Следующее окно встаёт на место этого — так оно и закрывается.
        // Обещание alert не ждём здесь: закрыть его пока некому
        const ответ = dialog.alert({ title: 'Готово', text: '' });

        equal(document.querySelectorAll('.dialog[aria-busy="true"]').length, 0,
            'ожидание уходит, когда приходит ответ');

        document.querySelector('.dialog [data-primary]').click();

        await ответ;
        await окно;
    });

    /*
     * Молчание читается как произвол (Р-158).
     *
     * Человек видит зелёный вес и серую талию рядом и вправе знать, чем они
     * отличаются. Пустое место под числом этого не говорит.
     */
    it('некрашеная плитка называет причину, а не молчит', async () => {
        await seed();
        await профиль();

        // Месяц назад вес был, а талию не мерили — сравнивать её не с чем
        await dbService.setBodyWeight({ at: Date.now() - 30 * DAY, weight: 94.2 });
        await dbService.setBodyWeight({ weight: 92.6, waist: 101, body: { muscle: 41 } });

        const плитки = [...(await screen(condition)).querySelectorAll('.cond-tile')];

        const талия = плитки.find((p) => p.dataset.key === 'waist');
        const мышцы = плитки.find((p) => p.dataset.key === 'muscle');

        assert(!талия.classList.contains('is-good') && !талия.classList.contains('is-watch'),
            'красить нечем: второго замера талии нет');
        assert(талия.textContent.includes('не с чем сравнить'),
            `и сказано почему: ${талия.textContent.replace(/\s+/g, ' ').trim()}`);

        assert(мышцы.textContent.includes('нормы нет'),
            `у мышц причина своя: ${мышцы.textContent.replace(/\s+/g, ' ').trim()}`);

        await dbService.setSetting(ATHLETE_KEY, null);
    });

    /*
     * Перемена меньше того, на что врёт сама мерка, — не перемена. Но и
     * молчать о ней нельзя: цифра на плитке стоит, а цвета нет.
     */
    it('перемена меньше погрешности названа меньше погрешности', async () => {
        await seed();
        await профиль();

        await dbService.setBodyWeight({ at: Date.now() - 30 * DAY, weight: 92.9, waist: 101.4 });
        await dbService.setBodyWeight({ weight: 92.6, waist: 101 });

        const вес = [...(await screen(condition)).querySelectorAll('.cond-tile')]
            .find((p) => p.dataset.key === 'weight');

        assert(!вес.classList.contains('is-good'), '300 граммов — это вода, а не вес');
        assert(вес.textContent.includes('меньше погрешности'),
            вес.textContent.replace(/\s+/g, ' ').trim());

        await dbService.setSetting(ATHLETE_KEY, null);
    });

    /*
     * Питание — вторая половина разговора о весе (§68).
     *
     * Проверяется не арифметика съеденного (она своя), а то, как карточка
     * ведёт себя с пустотой: день без записи обязан выглядеть пустым, а не
     * съеденным на ноль, и дефицит обязан молчать, пока известна только
     * одна половина.
     */
    it('день без записи показан пустым, а не нулём', async () => {
        await seed();
        await профиль();
        await dbService.setBodyWeight({ weight: 92.6, waist: 101 });

        const view = await screen(condition);
        const еда = [...view.querySelectorAll('.cond-tile')].find((p) => p.dataset.key === 'intake');

        assert(еда, `карточка питания обязана быть: ${text(view).slice(0, 300)}`);
        assert(еда.textContent.includes('—'), `прочерк, а не ноль: ${еда.textContent.trim()}`);
        assert(еда.textContent.includes('не записано'), еда.textContent.trim());

        assert(!еда.classList.contains('is-good') && !еда.classList.contains('is-watch'),
            'отсутствие записи — не оценка, красить его нечем');

        const дефицит = [...view.querySelectorAll('.cond-tile')].find((p) => p.dataset.key === 'deficit');

        assert(!дефицит, 'расход без прихода — половина разговора, дефицитом её называть нельзя');

        await dbService.setSetting(ATHLETE_KEY, null);
    });

    it('записанное складывается и вычитается из суточного расхода', async () => {
        await seed();
        await профиль();
        await dbService.setBodyWeight({ weight: 92.6, waist: 101 });

        await dbService.addIntake({ kcal: 820, note: 'завтрак' });
        await dbService.addIntake({ kcal: 640, note: 'обед' });

        const view = await screen(condition);
        const плитки = [...view.querySelectorAll('.cond-tile')];

        const еда = плитки.find((p) => p.dataset.key === 'intake');
        const дефицит = плитки.find((p) => p.dataset.key === 'deficit');

        assert(еда.textContent.includes('1460'), `две записи складываются: ${еда.textContent.trim()}`);
        assert(еда.textContent.includes('2 записи о еде'), еда.textContent.trim());

        assert(дефицит, 'оба числа известны — дефицит обязан быть назван');
        assert(дефицит.textContent.includes('от расхода'),
            `и сказано, от чего он считается: ${дефицит.textContent.trim()}`);

        await dbService.setSetting(ATHLETE_KEY, null);
    });

    /*
     * Названный дефицит — это потолок съеденного (§68, §67, Р-166).
     *
     * Красить сам дефицит нельзя: с утра он равен всему расходу и убывает с
     * каждым куском, так что зелёная плитка к ужину желтела бы. Потолок ведёт
     * себя правильно и отвечает на тот вопрос, который человек и задаёт: не
     * «каков мой дефицит», а «сколько мне ещё можно».
     */
    it('названный дефицит превращается в потолок и говорит остаток', async () => {
        await seed();
        await профиль();
        await dbService.setBodyWeight({ weight: 92.6, waist: 101 });

        await setGoal('deficit', 500);
        await dbService.addIntake({ kcal: 900 });

        const еда = [...(await screen(condition)).querySelectorAll('.cond-tile')]
            .find((p) => p.dataset.key === 'intake');

        assert(еда.classList.contains('is-good'), 'в пределах названного — зелёное');
        assert(еда.textContent.includes('осталось'),
            `и сказано, сколько ещё можно: ${еда.textContent.replace(/\s+/g, ' ').trim()}`);

        // Перебрали — плитка желтеет и обратно не отыгрывает
        await dbService.addIntake({ kcal: 2200 });

        const после = [...(await screen(condition)).querySelectorAll('.cond-tile')]
            .find((p) => p.dataset.key === 'intake');

        assert(после.classList.contains('is-watch'), 'сверх названного — жёлтое');
        assert(после.textContent.includes('больше цели'),
            после.textContent.replace(/\s+/g, ' ').trim());

        for (const ключ of [GOALS_KEY, ATHLETE_KEY]) await dbService.setSetting(ключ, null);
    });

    /*
     * Без названной цели сравнивать не с чем: нормы питания, одной на всех,
     * нет, и красить съеденное приложение не вправе.
     */
    it('без цели съеденное не красится', async () => {
        await seed();
        await профиль();
        await dbService.setBodyWeight({ weight: 92.6, waist: 101 });
        await dbService.addIntake({ kcal: 900 });

        const еда = [...(await screen(condition)).querySelectorAll('.cond-tile')]
            .find((p) => p.dataset.key === 'intake');

        assert(!еда.classList.contains('is-good') && !еда.classList.contains('is-watch'),
            'красить нечем, пока цель не названа');
        assert(!еда.textContent.includes('осталось'), еда.textContent.trim());

        await dbService.setSetting(ATHLETE_KEY, null);
    });

    /*
     * Доля жира — такой же путь, как вес и талия: откуда вышли, куда идём.
     */
    it('цель по доле жира показывает пройденное в развороте', async () => {
        await seed();
        await профиль();

        await dbService.setBodyWeight({ at: Date.now() - 30 * DAY, weight: 94, body: { fat: 26 } });
        await dbService.setBodyWeight({ weight: 92.6, body: { fat: 24.6 } });

        await setGoal('fat', 20, 26);

        condition.leave();
        await press('cond-why', { key: 'fat' });

        const разворот = text((await screen(condition)).querySelector('.cond-detail'));

        assert(разворот.includes('Цель 20'), разворот.slice(0, 200));
        assert(разворот.includes('прошли 1,4'), `пройденное впереди остатка: ${разворот.slice(0, 200)}`);

        condition.leave();
        for (const ключ of [GOALS_KEY, ATHLETE_KEY]) await dbService.setSetting(ключ, null);
    });

    /*
     * Точка отсчёта есть не у всякой цели (§67, §68, Р-166). Вес, талия и
     * доля жира — это путь; дефицит никуда не идёт, его держат.
     */
    it('у дефицита точки отсчёта нет, и ноль вместо неё не пишется', async () => {
        await seed();
        await dbService.setSetting(GOALS_KEY, null);

        const цели = await setGoal('deficit', 500);

        equal(цели.deficit.target, 500);
        equal('from' in цели.deficit, false,
            'записанный ноль читался бы как «вышли от нуля», и весь путь вышел бы пройденным');

        await dbService.setSetting(GOALS_KEY, null);
    });

    /*
     * Зеркало Р-156 в разметке: список ключей у карточки постоянный, а набор
     * плиток — нет. Разворот «Дефицита» оставался раскрытым после того, как
     * убрали последнюю запись дня, — объяснение висело само по себе.
     */
    it('разворот пропадает вместе со своей плиткой', async () => {
        await seed();
        await профиль();
        await dbService.setBodyWeight({ weight: 92.6, waist: 101 });

        const запись = await dbService.addIntake({ kcal: 1460 });

        condition.leave();
        await press('cond-why', { key: 'deficit' });

        assert((await screen(condition)).querySelector('.cond-detail'),
            'пока плитка на месте, разворот раскрыт');

        await dbService.deleteIntake(запись.id);

        const после = await screen(condition);

        assert(!после.querySelector('[data-key="deficit"]'), 'без еды дефицита нет');
        assert(!после.querySelector('.cond-detail'),
            'и объяснения к нему тоже: числа, о котором оно написано, на экране больше нет');

        condition.leave();
        await dbService.setSetting(ATHLETE_KEY, null);
    });
});

/**
 * Ориентиры в развороте (§15, Р-131).
 */
describe('Экран: выполнение, разворот ориентиров', () => {

    const DAY = 86400000;

    /** Занятие из нескольких подходов — чтобы разбор был длинным. */
    async function занятие(ex, повторы, назад, over = {}) {
        const at = Date.now() - назад * DAY;
        const w = await dbService.createWorkout({ type: 'Силовая', plan: [
            { exerciseId: ex.id, plannedSets: повторы.length, targetReps: повторы[0], skipped: false }
        ]});

        for (const [i, reps] of повторы.entries()) {
            await dbService.addSet({
                workoutId: w.id, exerciseId: ex.id,
                order: i + 1, setNumber: i + 1, reps, performedAt: at + i * 60000, ...over
            });
        }

        await dbService.updateWorkout(w.id, { startedAt: at });
        await dbService.finishWorkout(w.id, at + 1800000);
    }

    /*
     * «45 повт. — 8 подходов, 40 повт. — 2 подхода, 35 повт., 30 повт.» на
     * узком экране занимает две длинные строки и выталкивает «Выполнено» под
     * нижнее меню. Перед подходом нужно число, а не опись сделанного.
     */
    it('свёрнутое называет числа, а разбор прячет', async () => {
        const ex = await seed({ name: 'Отжимания', kind: 'reps', group: 'Грудь' });

        await занятие(ex, [45, 45, 45, 40, 35, 30], 14);
        await dbService.createWorkout({ type: 'Силовая', plan: [
            { exerciseId: ex.id, plannedSets: 6, targetReps: 45, skipped: false }
        ]});

        const view = await screen(session);
        const кратко = view.querySelector('.rec-brief');
        const разбор = view.querySelector('#rec-details');

        assert(кратко, 'свёрнутая строка обязана быть');
        assert(кратко.textContent.includes('45'), `число прошлого раза: «${кратко.textContent.trim()}»`);
        assert(!кратко.textContent.includes('подхода'), 'опись сделанного — это уже разбор');

        assert(разбор.hidden, 'по умолчанию свёрнуто: ради этого всё и затевалось');
        assert(/подход/.test(разбор.textContent),
            `а внутри — полный разбор: «${разбор.textContent.replace(/\s+/g, " ").trim().slice(0, 80)}»`);

        // Строка нагрузки живёт снаружи: она отвечает на ввод до записи (Р-53)
        assert(!разбор.contains(view.querySelector('#rec-extra')), 'нагрузка не прячется за шторку');
    });

    it('нажатие раскрывает и складывает обратно', async () => {
        const ex = await seed({ name: 'Отжимания', kind: 'reps', group: 'Грудь' });

        await занятие(ex, [45, 40], 14);
        await dbService.createWorkout({ type: 'Силовая', plan: [
            { exerciseId: ex.id, plannedSets: 3, targetReps: 45, skipped: false }
        ]});

        const view = await screen(session);
        document.body.appendChild(view);

        try {
            await press('sess-rec-toggle');
            assert(!view.querySelector('#rec-details').hidden, 'нажали — раскрылось');

            await press('sess-rec-toggle');
            assert(view.querySelector('#rec-details').hidden, 'нажали ещё — сложилось');
        } finally {
            view.remove();
            await press('sess-rec-toggle');
        }
    });

    /*
     * Совет о запасе появляется редко и прячется вместе с разбором. Молчать
     * ему нельзя: спрятанного совета не бывает, бывает непрочитанный.
     */
    it('о спрятанном совете свёрнутая строка объявляет', async () => {
        const ex = await seed({ name: 'Отжимания', kind: 'reps', group: 'Грудь' });

        // Два занятия подряд почти до отказа — правило срабатывает
        await занятие(ex, [45, 40], 14, { rir: 1 });
        await занятие(ex, [45, 40], 7, { rir: 1 });

        await dbService.createWorkout({ type: 'Силовая', plan: [
            { exerciseId: ex.id, plannedSets: 3, targetReps: 45, skipped: false }
        ]});

        const view = await screen(session);

        /*
         * Кнопкой и глаголом, а не подписью: «есть совет» — утверждение, и
         * что с ним делать, неясно (Р-132).
         */
        const кнопка = view.querySelector('.rec-advice-row .chip');

        assert(кнопка, 'иначе совет не прочтут никогда');
        equal(кнопка.tagName, 'BUTTON', 'приглашение нажать выглядит кнопкой');
        assert(/Показать/.test(кнопка.textContent), `надпись говорит, что случится: «${кнопка.textContent.trim()}»`);
        equal(кнопка.dataset.action, 'sess-rec-toggle');

        assert(view.querySelector('#rec-details').textContent.includes('почти до отказа'),
            'сам совет лежит в развороте');
    });
});

/**
 * Полоса отдыха умещается на экране (§16, Р-130).
 *
 * Найдено владельцем на телефоне в 800 точек: отсчёт уходил под нижнее меню —
 * то есть единственное, ради чего на экран смотрят между подходами, видно не
 * было.
 */
describe('Экран: выполнение, полоса отдыха', () => {

    it('подпись и время стоят своей строкой над кнопками', async () => {
        const ex = await seed();
        await dbService.createWorkout({ type: 'Силовая', plan: [
            { exerciseId: ex.id, plannedSets: 3, targetReps: 12, weight: 60, skipped: false }
        ]});

        restTimer.start(90, ex.id);

        try {
            const view = await screen(session);
            const голова = view.querySelector('.rest-head');

            assert(голова, 'иначе полоса заворачивается в три ряда по сорок четыре точки');
            assert(голова.querySelector('.rest-label'), 'подпись — внутри головы');
            assert(голова.querySelector('#rest-remaining'), 'и время рядом с ней, а не среди кнопок');

            // Кнопки остаются снаружи головы — своим рядом
            for (const действие of ['rest-shorten', 'rest-extend', 'rest-skip']) {
                const кнопка = view.querySelector(`[data-action="${действие}"]`);

                assert(кнопка, `кнопка ${действие} обязана быть`);
                assert(!голова.contains(кнопка), 'кнопки идут под подписью, а не в одной строке с ней');
            }
        } finally {
            restTimer.stop();
        }
    });
});

/**
 * Повторения правятся без клавиатуры (§12, Р-120).
 */
describe('Экран: выполнение, шаг повторений', () => {

    it('кнопки меняют число на единицу и ниже нуля не уходят', async () => {
        const ex = await seed();
        await dbService.createWorkout({ type: 'Силовая', plan: [
            { exerciseId: ex.id, plannedSets: 3, targetReps: 12, weight: 60, skipped: false }
        ]});

        const view = await screen(session);

        assert(hasAction(view, 'sess-reps-up'), 'править повторения надо и без клавиатуры');
        assert(hasAction(view, 'sess-reps-down'));

        // Поле живёт в разметке — заводим его так же, как это делает экран
        const поле = document.createElement('input');
        поле.id = 'f-reps';
        поле.type = 'number';
        поле.value = '12';
        document.body.appendChild(поле);

        try {
            await press('sess-reps-down');
            equal(поле.value, '11', 'шаг на одно: поправка на пару повторений — самое частое здесь');

            await press('sess-reps-up');
            await press('sess-reps-up');
            equal(поле.value, '13');

            поле.value = '0';
            await press('sess-reps-down');
            equal(поле.value, '0', 'отрицательных повторений не бывает');
        } finally {
            поле.remove();
        }
    });
});

/**
 * Убранная строка плана возвращается (§10, Р-119).
 *
 * ↑, ↓ и × стояли подряд через четыре пикселя, а порядок правят так: жмут ↓
 * несколько раз подряд. Промах — и строка исчезала вместе с подходами,
 * повторениями и весом, вписанными минуту назад.
 */
describe('Экран: план, возврат убранного', () => {

    async function составИзДвух() {
        const жим = await seed({ name: 'Жим лёжа' });
        await dbService.createExercise({ name: 'Приседания', kind: 'weight', group: 'Ноги' });

        await workout(жим, [[10, 60]]);

        await screen(plan, ['repeat']);
    }

    it('убранное возвращается на своё место', async () => {
        await составИзДвух();

        const было = text(await screen(plan, ['repeat']));

        assert(было.includes('Жим лёжа'), 'состав повтора обязан содержать жим');

        await press('plan-remove', { index: '0' });

        assert(!text(await screen(plan, ['repeat'])).includes('Жим лёжа'), 'убрано — значит убрано');

        await press('plan-undo');

        assert(text(await screen(plan, ['repeat'])).includes('Жим лёжа'), 'вернуть должно быть чем');

        await screen(plan, ['template', 'нет-такого']);
    });

    it('уход с экрана снимает предложение вернуть', async () => {
        await составИзДвух();
        await screen(plan, ['repeat']);

        await press('plan-remove', { index: '0' });
        plan.leave();

        await press('plan-undo');

        assert(!text(await screen(plan, ['repeat'])).includes('Жим лёжа'),
            'полоса ушла вместе с экраном — и возвращать ей уже нечего');

        await screen(plan, ['template', 'нет-такого']);
    });
});

/**
 * Тепловая карта отвечает пальцу, а не только курсору (§23.1, Р-118).
 *
 * Подсказка жила в <title>: на компьютере она всплывает под мышью, а на
 * телефоне наведения нет вовсе — карта была картинкой, на которую можно
 * тыкать без единого ответа.
 */
describe('Экран: статистика, карта по дням', () => {

    it('клетка нажимается, а ступени названы числами', async () => {
        const ex = await seed();
        await workout(ex, [[10, 60]]);

        const view = await screen(stats);
        const строка = text(view);

        assert(hasAction(view, 'stats-heat-day'), 'на телефоне наведения нет — карта должна нажиматься');

        const клетка = view.querySelector('[data-action="stats-heat-day"]');

        assert(клетка.getAttribute('data-title'), 'нажатию нечего было бы показать');
        assert(view.querySelector('.heat-pick'), 'строке ответа нужно место, иначе карта прыгает');

        for (const порог of ['1–6', '7–12', '13–20', '21+']) {
            assert(строка.includes(порог), `ступень «${порог}» не названа, и цвет читается на глаз`);
        }
    });
});

/**
 * Ограничение и листалка забытого на экране плана (§58, §26.2.3, Р-118).
 *
 * Оба дефекта одного рода: экран плана не знал того, что знал главный.
 * Проверять их надо именно на собранном составе — по коду оба места
 * выглядят исправными, расходятся они только в готовом плане.
 */
describe('Экран: план из просроченного', () => {

    const ДЕНЬ = 86400000;

    /** Тренировка сразу из двух упражнений: по одиночным состав вышел бы в одно. */
    async function вместе(a, b, at) {
        const record = await dbService.createWorkout({
            type: 'Силовая',
            plan: [a, b].map((ex) => ({ exerciseId: ex.id, plannedSets: 1, targetReps: 10, weight: 60, skipped: false }))
        });

        for (const [i, ex] of [a, b].entries()) {
            await dbService.addSet({
                workoutId: record.id, exerciseId: ex.id,
                order: i + 1, setNumber: 1, reps: 10, weight: 60, performedAt: at + i * 60000
            });
        }

        await dbService.updateWorkout(record.id, { startedAt: at });
        await dbService.finishWorkout(record.id, at + 1800000);
    }

    /**
     * Два просроченных упражнения.
     *
     * По три занятия каждому: с двумя ритм ещё не сочтён, и просроченным
     * упражнение не считается вовсе. Жиму добавлено четвёртое, поодиночке, —
     * так у него своя давность, и порядок в составе становится проверяемым.
     */
    async function двое() {
        const жим = await seed({ name: 'Жим лёжа' });
        const присед = await dbService.createExercise({ name: 'Приседания', kind: 'weight', group: 'Ноги' });

        await вместе(жим, присед, Date.now() - 50 * ДЕНЬ);
        await вместе(жим, присед, Date.now() - 42 * ДЕНЬ);
        await вместе(жим, присед, Date.now() - 35 * ДЕНЬ);
        await workout(жим, [[10, 60]], { at: Date.now() - 30 * ДЕНЬ });

        // Черновик плана живёт в модуле и держится за прошлый маршрут:
        // без сброса следующая отрисовка «due» вернула бы состав прошлой проверки
        await screen(plan, ['template', 'нет-такого']);

        return { жим, присед };
    }

    it('исключённое ограничением в состав не встаёт', async () => {
        const { присед } = await двое();

        await dbService.setSetting(ATHLETE_KEY, {
            limits: [{ id: 'l1', name: 'Колено', exclude: [присед.id] }]
        });

        const view = await screen(plan, ['due']);

        assert(has(view, 'Жим лёжа'), 'непросроченное ограничением остаётся');
        assert(!has(view, 'Приседания'), 'главный экран это исключал, а здесь оно вставало первым');

        await dbService.setSetting(ATHLETE_KEY, null);
    });

    it('выбранное на листалке стоит первым', async () => {
        const { жим } = await двое();

        const строка = text(await screen(plan, ['due', жим.id]));

        assert(строка.includes('Приседания') && строка.includes('Жим лёжа'), 'состав по-прежнему из всего забытого');
        assert(строка.indexOf('Жим лёжа') < строка.indexOf('Приседания'),
            'без выбора он стоял бы вторым — иначе человек решит, что нажатие не сработало');
    });

    it('без выбора порядок прежний', async () => {
        await двое();

        const строка = text(await screen(plan, ['due']));

        assert(строка.indexOf('Приседания') < строка.indexOf('Жим лёжа'), 'по давности: присед забыт сильнее');
    });

    it('выбор упражнения называет исключённое ограничением', async () => {
        const { присед } = await двое();

        await dbService.setSetting(ATHLETE_KEY, {
            limits: [{ id: 'l1', name: 'Колено', exclude: [присед.id] }]
        });

        await screen(plan, ['due']);

        const было = dialog.pick;
        let спрошено = null;

        dialog.pick = async (options) => { спрошено = options; return null; };

        try {
            await press('plan-add');
        } finally {
            dialog.pick = было;
        }

        const строки = (спрошено?.items || []);
        const присед_ = строки.find((i) => i.label === 'Приседания');
        const жим_ = строки.find((i) => i.label === 'Жим лёжа');

        assert(присед_, 'прятать исключённое нельзя: сделать его можно и сознательно');
        assert(присед_.hint.includes('исключено ограничением'), 'но молча оно попадёт в план по забывчивости');
        assert(!жим_.hint.includes('исключено'), 'на всём подряд приписка ничего не значит');

        await dbService.setSetting(ATHLETE_KEY, null);
        await screen(plan, ['template', 'нет-такого']);
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

    /**
     * Начать тренировку из одного упражнения и открыть выполнение.
     *
     * С уходом с экрана: сегодняшние правки пауз живут в модуле (Р-81), а
     * база между проверками чистится и раздаёт те же самые идентификаторы —
     * без ухода правка одной проверки досталась бы упражнению следующей.
     */
    async function начать(exercise) {
        session.leave();

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

    /*
     * Сегодняшний темп (Р-81). Одна тренировка идёт в одном ритме, и тот, кто
     * поставил десять минут, не хочет задавать их заново на каждом следующем
     * упражнении — а прежде каждое новое начиналось с общей настройки, потому
     * что про него в справочнике ничего не записано.
     */
    async function вписать(seconds) {
        const было = dialog.form;
        const спрошено = {};

        dialog.form = async (options) => { спрошено.form = options; return { rest: seconds }; };

        try {
            await press('sess-rest');
        } finally {
            dialog.form = было;
        }

        return спрошено;
    }

    /** Начать тренировку из двух упражнений подряд. */
    async function начать_две(первое, второе) {
        session.leave();

        await dbService.createWorkout({
            type: 'Силовая',
            plan: [
                { exerciseId: первое.id, plannedSets: 3, targetReps: 10, weight: 50, skipped: false },
                { exerciseId: второе.id, plannedSets: 3, targetReps: 10, weight: 40, skipped: false }
            ]
        });

        await screen(session);
    }

    it('заданная руками пауза переходит на следующее упражнение', async () => {
        const первое = await seed();
        const второе = await dbService.createExercise({ name: 'Тяга', kind: 'weight', group: 'Спина' });

        config.set('restEnabled', true);
        config.set('restSeconds', 90);

        await начать_две(первое, второе);
        await вписать(600);

        await press('sess-select', { id: второе.id });
        const view = await screen(session);

        assert(has(view, '10:00'),
            `следующее упражнение обязано взять сегодняшний темп: ${text(view).slice(0, 200)}`);
    });

    /*
     * Пауза дня из плана старше собственной длительности упражнения (§56.2),
     * но не старше сказанного сегодня руками: человек, поправивший её посреди
     * тренировки, сказал последним — а прежде правка молча проигрывала плану
     * и выглядела не сработавшей.
     */
    it('правка старше дневной паузы плана', async () => {
        const ex = await seed();

        config.set('restEnabled', true);
        config.set('restSeconds', 90);

        await начать(ex);

        const workout = await dbService.getActiveWorkout();
        await dbService.updateWorkout(workout.id, { restSeconds: 300 });

        const дневная = await screen(session);
        assert(has(дневная, '5:00'), 'без правки день ведёт');

        await вписать(120);
        const своя = await screen(session);

        assert(has(своя, '2:00'), `правка обязана быть выше дня: ${text(своя).slice(0, 200)}`);
    });

    /*
     * Круговой день (Р-84): у главного упражнения пауза дня, у добора — своя,
     * записанная в строке плана. Своя обязана быть старше дневной, иначе круг
     * не описать: приложение дало бы десять минут и после минутного добора.
     */
    it('своя пауза упражнения из плана старше дневной', async () => {
        const первое = await seed();
        const второе = await dbService.createExercise({ name: 'Пресс', kind: 'reps', group: 'Пресс' });

        config.set('restEnabled', true);
        config.set('restSeconds', 90);

        session.leave();

        const workout = await dbService.createWorkout({
            type: 'Силовая',
            plan: [
                { exerciseId: первое.id, plannedSets: 6, targetReps: 50, restSeconds: 60, skipped: false },
                { exerciseId: второе.id, plannedSets: 6, targetReps: 25, skipped: false }
            ]
        });

        await dbService.updateWorkout(workout.id, { restSeconds: 600 });

        const своя = text(await screen(session));
        assert(своя.includes('1:00'), `у первого упражнения своя минута: ${своя.slice(0, 200)}`);

        await press('sess-select', { id: второе.id });
        const дневная = text(await screen(session));

        assert(дневная.includes('10:00'),
            `о втором своего не сказано — работает пауза дня: ${дневная.slice(0, 200)}`);
    });

    /*
     * Поправка на плановом дне — про сегодня, а не про упражнение (Р-101).
     * Владелец поймал это на зарядке: десятиминутная пауза планового
     * понедельника оказалась пятью минутами отдыха посреди восьмиминутной
     * утренней разминки, потому что кнопка «±5 с» записала её в справочник.
     */
    it('пауза дня не записывается в упражнение', async () => {
        const ex = await seed();

        config.set('restEnabled', true);
        config.set('restSeconds', 90);

        session.leave();

        const workout = await dbService.createWorkout({
            type: 'Силовая',
            plan: [{ exerciseId: ex.id, plannedSets: 6, targetReps: 50, skipped: false }]
        });

        await dbService.updateWorkout(workout.id, { restSeconds: 600 });
        await screen(session);

        await press('rest-extend');

        equal((await dbService.getExercise(ex.id)).restSeconds, undefined,
            'иначе десять минут планового дня уезжают в зарядку');

        const view = await screen(session);
        assert(has(view, '10:05'), `на сегодня поправка всё же действует: ${text(view).slice(0, 200)}`);
    });

    it('без паузы дня поправка по-прежнему помнится за упражнением', async () => {
        const ex = await seed();

        config.set('restEnabled', true);
        config.set('restSeconds', 90);

        session.leave();

        await dbService.createWorkout({
            type: 'Зарядка',
            plan: [{ exerciseId: ex.id, plannedSets: 4, targetReps: 50, skipped: false }]
        });

        await screen(session);
        await press('rest-extend');

        equal((await dbService.getExercise(ex.id)).restSeconds, 95,
            'Р-46 никуда не делся: сказанное о самом упражнении помнится');
    });

    it('ввод во время отсчёта правит идущую паузу, а не следующую', async () => {
        const ex = await seed();

        config.set('restEnabled', true);
        config.set('restSeconds', 90);

        await начать(ex);
        restTimer.start(90, ex.id);

        const спрошено = await вписать(300);

        assert(String(спрошено.form?.text).includes('Отсчёт уже идёт'),
            'окно обязано предупредить, что введённое считается всей паузой');
        assert(restTimer.remaining > 290,
            `идущий отсчёт обязан подхватить ввод, а осталось ${restTimer.remaining}`);

        restTimer.stop();
    });
});

/*
 * Заглушка «Загрузка…» при переходе (Р-47, Р-59).
 *
 * Правило двойное, и обе половины ломаются по-разному. Без задержки заглушка
 * мелькает на быстрых переходах — итоги тренировки готовятся полсотни
 * миллисекунд, и человек видит вспышку вместо перехода. Без самой заглушки
 * долгий переход выглядит зависанием.
 *
 * Проверяется через настоящий app.render на настоящем узле экрана: правило
 * живёт в нём, и проверять его копией смысла нет.
 */
describe('Экран: заглушка при переходе', () => {

    /** Отрисовать маршрут и сказать, появлялась ли заглушка. */
    async function переход(hash, задержка = 0) {
        // Сначала встаём на другой экран: переход на тот же самый переходом
        // не считается, и заглушки там не бывает вовсе — на этом первая
        // версия проверки и попалась
        location.hash = '#/home';
        await app.render();

        const модуль = history;
        const было = модуль.render;

        if (задержка) {
            модуль.render = async (...args) => {
                await new Promise((r) => setTimeout(r, задержка));
                return было.apply(модуль, args);
            };
        }

        const host = document.getElementById('screen');
        let мелькнула = false;

        const наблюдатель = new MutationObserver(() => {
            if (host.querySelector('.loading')) мелькнула = true;
        });

        наблюдатель.observe(host, { childList: true, subtree: true });

        try {
            location.hash = hash;
            await app.render();
        } finally {
            наблюдатель.disconnect();
            модуль.render = было;
        }

        return мелькнула;
    }

    it('быстрый переход обходится без заглушки', async () => {
        await seed();

        equal(await переход('#/history'), false,
            'полсотни миллисекунд — это не загрузка, а вспышка');
    });

    it('долгий переход заглушку показывает', async () => {
        await seed();

        equal(await переход('#/history', 400), true,
            'иначе долгий переход выглядит зависанием');
    });
});

/*
 * План кладётся в настройки так же, как его кладёт приложение: текстом, из
 * которого он и разобран (Р-104). Собранный руками разбор с подставным
 * текстом — это план, которого не бывает: читается он всё равно из текста.
 */
const ДНИ_НЕДЕЛИ = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

/** Дата для шапки плана: «07.09.2026». */
function датойПлана(ts) {
    const d = new Date(ts);
    const два = (n) => String(n).padStart(2, '0');

    return `${два(d.getDate())}.${два(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** Записать план из строк дней: «Bench 6 × 10» на сегодня и так далее. */
async function положитьПлан(from, дни) {
    const текст = [`С ${датойПлана(from)}, 8 недель`]
        .concat(дни.map(([at, задание]) => `${ДНИ_НЕДЕЛИ[new Date(at).getDay()]} ${задание}`))
        .join('\n');

    await dbService.setSetting('plan', { ...planCore.parse(текст), text: текст });
}

/**
 * Экран часов говорит, какое звено молчит (§62.3, Р-127).
 *
 * Цепочка из трёх звеньев — часы, Zepp, Intervals.icu, — и строка «Привезено
 * сегодня» отвечает про забор, а читается как ответ про свежесть: сервис
 * отвечает исправно, а новее восьмого сентября у него ничего нет.
 */
describe('Экран часов: свежесть данных', () => {

    const DAY = 86400000;
    const полночь = (ms) => new Date(new Date(ms).setHours(0, 0, 0, 0)).getTime();

    async function привезено(дни) {
        await dbService.setSetting('icuKey', 'ключ');
        await dbService.setSetting('icuAthlete', 'i1');

        await dbService.setSetting('icuWellness', {
            at: Date.now(),
            rows: дни.map((назад) => ({
                date: полночь(Date.now() - назад * DAY), sleep: 25200, rhr: 52, steps: 9000
            }))
        });
    }

    async function прибрать() {
        for (const ключ of ['icuWellness', 'icuKey', 'icuAthlete']) await dbService.setSetting(ключ, null);
    }

    /*
     * Когда всё свежее, три даты подряд — шум на экране, куда заходят раз в
     * месяц. Работает — одна строка со счётом (Р-129).
     */
    it('свежие данные не разводят подписей', async () => {
        await seed();
        await привезено([1, 0]);

        const view = await screen(watch);

        assert(text(view).includes('Замеров за месяц'), 'сколько привезено — сказать надо');
        assert(!view.querySelector('.is-bad'), 'тревожиться не о чем');
        assert(!text(view).includes('сон — по'), 'сроки порознь нужны только когда они расходятся');

        await прибрать();
    });

    it('отставшие данные называют сроки по каждой величине', async () => {
        await seed();
        await привезено([8, 7, 6, 4]);

        const view = await screen(watch);
        const беда = view.querySelector('.plan-rule.is-bad');

        assert(беда, 'молчание четвёртый день — это новость, а не подпись');
        assert(беда.textContent.includes('сон —') && беда.textContent.includes('шаги —'),
            `сроки порознь: их пишут разные выгрузки — «${беда.textContent.trim()}»`);

        await прибрать();
    });

    /*
     * Экран часов открывают раз в месяц. Привязка отваливается молча, и
     * средние недельные стареют тихо: сказать надо там, куда смотрят.
     */
    it('статистика сама говорит, что данные кончились', async () => {
        const ex = await seed();
        await workout(ex, [[10, 60]]);
        await привезено([9, 8, 7, 5]);

        const view = await screen(stats);
        const беда = view.querySelector('.hint.is-bad');

        assert(беда, 'иначе неделю спустя карточка описывает позапрошлую жизнь');
        assert(беда.textContent.includes('Данные кончаются'), беда.textContent.trim());

        await прибрать();
    });
});

/**
 * Старые данные с часов названы старыми (§62.5, Р-125).
 *
 * Найдено владельцем на живом экране: 12 сентября на главном висело «5145 из
 * 10000 · 8 сентября · 51 % · в среднем 12904 за неделю». Число
 * четырёхдневной давности, да ещё и обычно неполное, читалось как сегодняшний
 * провал.
 */
describe('Главный: шаги с часов', () => {

    const DAY = 86400000;

    /** Полночь дня: экран сверяет давность именно по полуночам. */
    const полночь = (ms) => new Date(new Date(ms).setHours(0, 0, 0, 0)).getTime();

    /** Записать в кэш самочувствия строки с шагами. */
    async function шаги(дни) {
        await dbService.setSetting('icuWellness', {
            at: Date.now(),
            rows: дни.map(([назад, steps]) => ({
                date: полночь(Date.now() - назад * DAY), steps
            }))
        });

        await dbService.setSetting('stepsGoal', 10000);
    }

    it('свежий день показывает цель и долю', async () => {
        await seed();
        await шаги([[1, 9000], [0, 5145]]);

        const view = await screen(home);
        const строка = text(view);

        assert(строка.includes('из 10 000') || строка.includes('из 10000'), строка.slice(0, 200));
        assert(!view.querySelector('.w-stale'), 'сегодняшнему дню стареть не с чего');

        await dbService.setSetting('icuWellness', null);
    });

    it('старый день называет свою давность и не считает долю от цели', async () => {
        await seed();
        await шаги([[5, 12000], [4, 5145]]);

        const view = await screen(home);
        const stale = view.querySelector('.w-stale');

        assert(stale, 'о давности надо сказать вслух, а не подписью в ряду процентов');
        assert(text(view).includes('5145'), 'само число остаётся: это последнее, что известно');
        assert(!text(view).includes('%'), 'доля от цели у старого и неполного дня объявляет провал');

        await dbService.setSetting('icuWellness', null);
    });

    /*
     * Окно среднего бралось «последние семь суток от сегодня»: когда часы
     * молчат четыре дня, среднее считалось по трём оставшимся — не за неделю,
     * а за то, что успело приехать.
     */
    it('среднее считается за неделю, кончающуюся показанным днём', async () => {
        await seed();
        await шаги([[13, 100], [5, 10000], [4, 12000]]);

        const строка = text(await screen(home));

        // Окно — семь суток до 8 сентября: 10000 и 12000 в нём, 100 за краем
        assert(строка.includes('11 000') || строка.includes('11000'),
            `среднее должно считаться от показанного дня: ${строка.slice(0, 300)}`);

        await dbService.setSetting('icuWellness', null);
    });
});

/**
 * Одно не называется дважды, и слова не рубятся (§29.1, §23, Р-124).
 */
describe('Главный: ближайший день называется один раз', () => {

    const DAY = 86400000;

    /*
     * Полоса писала «Следующая 14 сентября — …», а полутора сотнями точек
     * ниже тот же день стоял первой плашкой «Следом». Два одинаковых текста
     * рядом читаются не как повтор, а как два разных сообщения.
     */
    it('при плашках «Следом» полоса про следующий день молчит', async () => {
        const ex = await seed({ name: 'Bench', kind: 'weight' });
        const now = Date.now();

        await workout(ex, [[10, 60]], { at: now });

        // Сегодня сделано, а впереди есть дни — значит будут и плашки
        await положитьПлан(now - 3 * DAY, [[now, 'Bench 6 × 10'], [now + 2 * DAY, 'Squat 5 × 8']]);

        const строка = text(await screen(home));

        assert(!строка.includes('Следующая'), `день плана уже стоит плашкой ниже: ${строка.slice(0, 300)}`);
        assert(строка.includes('Squat'), 'сам день при этом обязан быть виден');

        await dbService.setSetting('plan', null);
    });

    /*
     * Про исход плана человеку говорит своя ветка полосы — «Сегодня последний
     * день», «План кончается через…», — и она не трогалась. Строка «Следующая
     * …» осталась в идущем плане запасным выходом на случай, когда впереди
     * дней нет вовсе; у недельной сетки такого не бывает, и проверять эту
     * ветку нечем.
     */

    it('подписи плиток статистики — слова, а не обрубки', async () => {
        const ex = await seed();
        await workout(ex, [[10, 60]]);

        const строка = text(await screen(stats));

        assert(!строка.includes('Подх. / трен.'), 'капс с точками читается как шифр');
        assert(!строка.includes('Повт. / подх.'));
        assert(строка.includes('Подходов за тренировку'), строка.slice(0, 200));
    });
});

/**
 * Вид обещает то действие, которое случится (§29.1, §61, §62, Р-123).
 */
describe('Вид и действие совпадают', () => {

    const DAY = 86400000;

    /*
     * В одной оправе стояли две разные вещи: одна карточка заводит тренировку
     * и уходит на выполнение, другая открывает сборку. Человек жмёт на то,
     * что крупное и в рамке, по памяти, не читая.
     */
    it('рамка есть только у карточки, которая начинает тренировку сразу', async () => {
        const ex = await seed({ name: 'Bench', kind: 'weight' });
        const now = Date.now();

        for (const d of [21, 14, 7]) await workout(ex, [[10, 60]], { at: now - d * DAY });

        await положитьПлан(now - 3 * DAY, [[now, 'Bench 6 × 10']]);

        const view = await screen(home);
        const сразу = view.querySelector('.repeat-card.is-now');

        assert(сразу, 'начинающая тренировку карточка обязана выглядеть по-своему');
        equal(сразу.dataset.action, 'today-start');

        for (const карточка of view.querySelectorAll('.repeat-card')) {
            if (карточка.classList.contains('is-now')) continue;

            assert(карточка.dataset.action !== 'today-start',
                'начать сразу можно только с отмеченной карточки');
        }

        await dbService.setSetting('plan', null);
    });

    /*
     * Приложение учит: оранжевое залитое — то самое, что надо нажать (Р-96).
     * Когда пятен два, правило отменяется, а ярче всего оказывалось названо
     * самое необязательное: нового плана приложение не требует.
     */
    it('залитая кнопка на главном одна', async () => {
        const ex = await seed({ name: 'Bench', kind: 'weight' });
        const now = Date.now();

        await workout(ex, [[10, 60]], { at: now - 20 * DAY });

        // План, который уже кончился: появляется полоса «План кончился …»
        await положитьПлан(now - 30 * DAY, [[now - 28 * DAY, 'Bench 6 × 10']]);

        const view = await screen(home);
        const строка = text(view);

        if (строка.includes('План кончился')) {
            const залитые = view.querySelectorAll('.btn-accent');

            equal(залитые.length, 1, `ярких пятен должно быть одно, а не ${залитые.length}`);
        }

        await dbService.setSetting('plan', null);
    });

    /*
     * Одно слово на две встречные дороги: «Занятий за месяц: 0» и ниже «К
     * отправке занятий: 6» читается как «шесть отправил, ноль дошло».
     */
    it('на экране часов привезённое и уезжающее названы по-разному', async () => {
        await seed();

        const строка = text(await screen(watch));

        assert(!строка.includes('Занятий за месяц'), 'привезённое — это тренировки с часов');
        assert(!строка.includes('К отправке занятий'), 'уезжающее — это дни плана');
    });

    /*
     * Число отвечает «дошло ли вообще», а спрашивают всегда другое: дошла ли
     * та самая тренировка, которую вчера запустили на часах (Р-137).
     */
    it('привезённые тренировки названы поимённо, с пульсом и нагрузкой', async () => {
        await seed();

        const час = 3600000;

        await dbService.setSetting('icuKey', 'ключ');
        await dbService.setSetting('icuAthlete', 'i1');

        await dbService.setSetting('icuActivities', {
            at: Date.now(),
            rows: [
                {
                    id: 'a1', name: 'Силовая', type: 'WeightTraining',
                    start: Date.now() - 26 * час, end: Date.now() - 25 * час,
                    seconds: 2880, avgHr: 112, maxHr: 146, calories: 320, load: 54
                },
                {
                    id: 'a2', name: 'Прогулка', type: 'Walk',
                    start: Date.now() - 50 * час, end: Date.now() - 49 * час,
                    seconds: 1800, avgHr: 96, maxHr: 108, calories: 140, load: 12
                }
            ]
        });

        const строка = text(await screen(watch));

        assert(строка.includes('Силовая'), `имя занятия — это и есть ответ: ${строка.slice(0, 200)}`);
        assert(строка.includes('48 мин'), 'сколько длилось');
        assert(строка.includes('пульс 112, макс 146'), 'и что от него привезено');
        assert(строка.includes('нагрузка 54'), 'нагрузку считает сервис — её и показываем');

        for (const ключ of ['icuActivities', 'icuKey', 'icuAthlete']) await dbService.setSetting(ключ, null);
    });
});

describe('Очередь и план на главном (Р-72)', () => {

    const DAY = 86400000;

    /** План, у которого тренировочный день — сегодня и через два дня. */
    async function сПланом(now) {
        await положитьПлан(now - 3 * DAY, [[now, 'Bench 6 × 10'], [now + 2 * DAY, 'Squat 5 × 8']]);
    }

    it('при плане «Следом» показывает его дни, а не очередь', async () => {
        const ex = await seed({ name: 'Bench', kind: 'weight' });
        const now = Date.now();

        for (const d of [21, 14, 7]) await workout(ex, [[10, 60]], { at: now - d * DAY });

        await сПланом(now);

        const view = await screen(home);
        const строка = text(view);

        assert(строка.includes('Сегодня по плану'), `план обязан занять карточку: ${строка.slice(0, 200)}`);
        assert(строка.includes('Squat'), `ближайший день плана обязан быть в плашках: ${строка.slice(0, 400)}`);

        await dbService.setSetting('plan', null);
    });

    it('без плана всё как было: первый карточкой, остальные плашками', async () => {
        const ex = await seed({ name: 'Bench', kind: 'weight' });
        const now = Date.now();

        for (const d of [21, 14, 7]) await workout(ex, [[10, 60]], { at: now - d * DAY });

        const строка = text(await screen(home));

        assert(строка.includes('На очереди'), `очередь без плана остаётся: ${строка.slice(0, 200)}`);
    });

});

/**
 * Единица упражнения на время (Р-87).
 *
 * Планку держат секундами, баскетбол играют часами: 90 минут в поле для секунд
 * — это 5400, и вписывать такое никто не станет. Единица помнится за
 * упражнением, а внутри всё остаётся секундами.
 */
describe('Экран: выполнение, минуты вместо секунд', () => {

    async function начать(exercise) {
        session.leave();

        await dbService.createWorkout({
            type: 'Силовая',
            plan: [{ exerciseId: exercise.id, plannedSets: 1, targetDuration: null, skipped: false }]
        });

        return screen(session);
    }

    it('по умолчанию считает секундами', async () => {
        const ex = await seed({ name: 'Планка', kind: 'time', group: 'Пресс' });

        const view = await начать(ex);

        assert(text(view).includes('секунд'), `подпись поля: ${text(view).slice(0, 200)}`);
        assert(hasAction(view, 'sess-time-unit'), 'переключатель обязан быть на виду');
    });

    it('переключение помнится за упражнением', async () => {
        const ex = await seed({ name: 'Баскетбол', kind: 'time', group: 'Кардио' });

        await начать(ex);
        await press('sess-time-unit');

        equal((await dbService.getExercise(ex.id)).timeUnit, 'min');

        const view = await screen(session);
        assert(text(view).includes('минут'), `подпись обязана смениться: ${text(view).slice(0, 200)}`);
    });

    /*
     * Прошлое значение показывается в той же единице, в которой его вводили:
     * 5400 секунд в поле «минут» — это 90, а не 5400.
     */
    it('прошлое значение переводится в минуты', async () => {
        const ex = await seed({ name: 'Баскетбол', kind: 'time', group: 'Кардио' });
        await dbService.updateExercise(ex.id, { timeUnit: 'min' });

        session.leave();

        const workout = await dbService.createWorkout({
            type: 'Силовая',
            plan: [{ exerciseId: ex.id, plannedSets: 2, targetDuration: null, skipped: false }]
        });

        await dbService.addSet({
            workoutId: workout.id, exerciseId: ex.id,
            order: 1, setNumber: 1, duration: 5400
        });

        const view = await screen(session);
        const поле = view.querySelector('#f-duration');

        equal(поле?.getAttribute('value'), '90', 'полтора часа — это 90 минут, а не 5400');
    });

});

/**
 * Очередь после сделанного дня плана (Р-82).
 *
 * Сегодняшнее по плану сделано — карточка «Сегодня по плану» уходит, и её
 * место занимает очередь по истории. Она и предлагала крупным планом то, что
 * план ставит на послезавтра, а плашки «Следом» тут же под карточкой об этом
 * и говорили: один экран, два голоса, одно дело.
 */
describe('Главный: очередь при действующем плане (Р-82)', () => {

    const DAY = 86400000;

    /** План: сегодня одно занятие, через два дня другое. */
    async function сПланом(now, сегодня_имя, через_имя) {
        await положитьПлан(now - 3 * DAY, [
            [now, `${сегодня_имя} 5 × 8`],
            [now + 2 * DAY, `${через_имя} 6 × 10`]
        ]);
    }

    /**
     * История с очередью по «Bench» и сделанным сегодня днём плана.
     *
     * Три повтора нужны очереди: пока состав не повторился трижды,
     * промежутка не знаем и очереди из чего строить нет.
     */
    async function история(now, сегодня_имя) {
        const bench = await seed({ name: 'Bench', kind: 'weight' });
        const сегодня = await dbService.createExercise({ name: сегодня_имя, kind: 'weight' });

        for (const d of [21, 14, 7]) await workout(bench, [[10, 60]], { at: now - d * DAY });
        await workout(сегодня, [[8, 80]], { at: now });
    }

    it('состав из ближайших дней плана карточкой не предлагается', async () => {
        const now = Date.now();

        await история(now, 'Squat');
        await сПланом(now, 'Squat', 'Bench');

        const строка = text(await screen(home));

        assert(строка.includes('Сегодня по плану сделано'), `день закрыт: ${строка.slice(0, 200)}`);
        assert(!строка.includes('На очереди'),
            `план ставит Bench через два дня — предлагать его сегодня значит спорить с планом: ${строка.slice(0, 300)}`);
        assert(!строка.includes('Повторить прошлую'),
            'прошлая — это только что сделанный день плана, предлагать его снова незачем');

        await dbService.setSetting('plan', null);
    });

    /*
     * Работать сверх плана нормально: убирается не очередь целиком, а только
     * то, что план и так закроет. Голос при этом другой — «На очереди» это
     * долг, а долг при объявленной программе назначает она.
     */
    it('то, чего в плане нет, предлагается — но как добавка', async () => {
        const now = Date.now();

        await история(now, 'Squat');
        await сПланом(now, 'Squat', 'Deadlift');

        const строка = text(await screen(home));

        assert(строка.includes('Если хочется добавить'),
            `состав вне плана остаётся, но не долгом: ${строка.slice(0, 300)}`);
        assert(строка.includes('Bench'), 'предлагается именно он');
        assert(!строка.includes('На очереди'), 'слово «очередь» при плане принадлежит плану');

        await dbService.setSetting('plan', null);
    });

    it('подсказка чередования при плане молчит', async () => {
        const now = Date.now();

        await история(now, 'Squat');
        await сПланом(now, 'Squat', 'Deadlift');

        const строка = text(await screen(home));

        assert(!строка.includes('Дольше всего не было') && !строка.includes('По чередованию дальше'),
            `чем чередовать, решает программа: ${строка.slice(0, 300)}`);

        await dbService.setSetting('plan', null);
    });

});

/**
 * Живых кнопок без обработчика не бывает (§45, Р-149).
 *
 * Кнопка с именем, которого никто не слушает, нажимается и молчит: с виду
 * живая, а не делает ничего. Такие уже находились глазами (Р-115) — а найти
 * их можно и разом, сверив разметку каждого экрана со списком подписок.
 *
 * Проверка идёт по отрисованным экранам, а не по коду: половина имён
 * собирается на лету — «home-forgotten-{шаг}», действие клетки карты года, —
 * и в исходнике их не видно.
 */
describe('Кнопки и обработчики', () => {

    const ЭКРАНЫ = [
        ['главная', home], ['история', history], ['календарь', calendar],
        ['статистика', stats], ['кондиции', condition], ['рекорды', recordsScreen],
        ['шаблоны', templates], ['справочник', exercises], ['часы', watch],
        ['профиль', profile], ['справка', guide], ['план', plan],
        ['планировщик', planner], ['интервалы', intervalScreen], ['доли веса', shares]
    ];

    /*
     * Общие действия живут в точке входа (js/main.js), а её проверки не
     * поднимают: вместе с ней поднялось бы всё приложение — маршрутизатор,
     * сервис-воркер, забор с часов. Поэтому они названы здесь поимённо.
     */
    const ИЗ_ТОЧКИ_ВХОДА = ['nav', 'install', 'reload', 'dismiss-banner'];

    /*
     * Свёрнутый текст под заголовком (§45, Р-168).
     *
     * Карточек с выводами стало три, и все текстовые: вместе они дают
     * несколько абзацев подряд в самом начале страницы, ровно там, где ищут
     * числа.
     */
    it('заголовок сворачивает текст и помнит это', async () => {
        await seed();

        await dbService.setSetting(ATHLETE_KEY, {
            sex: 'male', birthYear: 1982, height: 185, goal: 'убрать живот',
            limits: [], equipment: []
        });

        await dbService.setBodyWeight({ at: Date.now() - 30 * DAY, weight: 94.1, waist: 103 });
        await dbService.setBodyWeight({ weight: 92.6, waist: 101.5 });

        config.set('folded', {});

        const развёрнуто = await screen(condition);
        const кнопка = развёрнуто.querySelector('[data-action="fold"][data-key="digest"]');

        assert(кнопка, `итог обязан сворачиваться: ${text(развёрнуто).slice(0, 200)}`);
        equal(кнопка.getAttribute('aria-expanded'), 'true', 'по умолчанию развёрнуто');

        assert(кнопка.textContent.includes('Что изменилось'),
            'кнопка названа тем же словом, что и карточка, а не значком (Р-151)');

        assert(!развёрнуто.querySelector('.fold-body').classList.contains('is-folded'));

        // Свернули — и это запомнилось на устройстве
        await press('fold', { key: 'digest' });

        equal(config.get('folded').digest, true);

        const свёрнуто = await screen(condition);

        equal(свёрнуто.querySelector('[data-action="fold"][data-key="digest"]').getAttribute('aria-expanded'), 'false',
            'иначе это не настройка, а упражнение: сворачивать одно и то же при каждом заходе');

        assert(свёрнуто.querySelector('.fold-body').classList.contains('is-folded'));

        config.set('folded', {});
        await dbService.setSetting(ATHLETE_KEY, null);
    });

    /*
     * Свёртка убирает лишнее, а не прячет плохие новости.
     *
     * «Данные кончаются на 8 сентября, проверьте привязку» — это не разбор, а
     * предупреждение, и человек, свернувший карточку однажды, не увидел бы его
     * вовсе. Ровно с этой беды у владельца встали данные с часов.
     */
    it('предупреждение о давности не сворачивается', async () => {
        await seed();

        config.set('folded', { watch: true });

        const view = await screen(stats);
        const строка = [...view.querySelectorAll('.hint')]
            .find((p) => /Привезено|Данные кончаются/.test(p.textContent));

        if (строка) {
            assert(!строка.closest('.fold-body'),
                'строка о давности обязана остаться на виду и у свёрнутой карточки');
        }

        config.set('folded', {});
    });

    /*
     * Время подхода у своего веса (§6, Р-169).
     *
     * «Тридцать секунд альпиниста» и «двадцать повторений альпиниста» — одно
     * упражнение, а не два. До этого записать первое было нечем: у вида
     * «свой вес» полей было два, повторения и довес.
     */
    it('у своего веса есть время, а у силового с весом — нет', async () => {
        const свой = await seed({ name: 'Альпинист', kind: 'reps', group: 'Всё тело' });
        const железо = await dbService.createExercise({ name: 'Жим лёжа', kind: 'weight', group: 'Грудь' });

        const w = await dbService.createWorkout({
            type: 'Силовая',
            plan: [
                { exerciseId: свой.id, plannedSets: 3, targetDuration: 30, skipped: false },
                { exerciseId: железо.id, plannedSets: 3, targetReps: 8, weight: 60, skipped: false }
            ]
        });

        const view = await screen(session);

        assert(view.querySelector('[data-action="sess-duration-toggle"]'),
            `у своего веса время обязано быть: ${text(view).slice(0, 200)}`);

        const поле = view.querySelector('#f-duration-row');

        assert(поле, 'и поле под него');
        assert(!поле.hidden, 'план назвал тридцать секунд — поле открыто, а не спрятано');
        equal(view.querySelector('#f-duration')?.value, '30', 'и число уже стоит в нём');

        await dbService.deleteWorkout(w.id);
    });

    /*
     * Время задаёт тот, кто собирает тренировку, а не тот, кто её выполняет:
     * во время подхода набирать некогда (Р-169).
     */
    /*
     * Отсчёт у кардио (§57, Р-174).
     *
     * Он достался сперва упражнениям на время, потом своему весу — и оба раза
     * кардио пропустили. Разницы между «две минуты ходьбы» и «двадцать секунд
     * планки» для отсчёта нет никакой.
     */
    it('у кардио с названным временем есть отсчёт', async () => {
        await seed();

        const ex = await dbService.createExercise({ name: 'Ходьба тест', kind: 'distance', group: 'Кардио' });

        const w = await dbService.createWorkout({
            type: 'Кардио',
            plan: [{ exerciseId: ex.id, plannedSets: 1, targetDuration: 120, skipped: false }]
        });

        const view = await screen(session);

        assert(view.querySelector('[data-action="sess-hold-start"]'),
            `отсчёт обязан быть: ${text(view).slice(0, 200)}`);

        equal(view.querySelector('#f-duration')?.value, '120', 'и время из плана уже стоит');

        await dbService.deleteWorkout(w.id);
    });

    it('секунды задаются в плане у всего, кроме силового с весом', async () => {
        await seed();

        const виды = [
            { name: 'Ходьба тест', kind: 'distance', секунды: true, повторения: false },
            { name: 'Планка тест', kind: 'time', секунды: true, повторения: false },
            { name: 'Альпинист тест', kind: 'reps', секунды: true, повторения: true },
            { name: 'Жим тест', kind: 'weight', секунды: false, повторения: true }
        ];

        for (const вид of виды) {
            await screen(plan, ['template', 'нет-такого']);
            await screen(plan);

            const ex = await dbService.createExercise({ name: вид.name, kind: вид.kind, group: 'Всё тело' });

            const было = dialog.pick;
            dialog.pick = async () => ex.id;

            try {
                await press('plan-add');
            } finally {
                dialog.pick = было;
            }

            const подписи = [...(await screen(plan)).querySelectorAll('.plan-row label')]
                .map((l) => l.textContent.trim());

            equal(подписи.includes('Секунд'), вид.секунды, `${вид.name}: ${подписи.join(', ')}`);
            equal(подписи.includes('Повторения'), вид.повторения, `${вид.name}: ${подписи.join(', ')}`);
        }

        // Черновик живёт в модуле и переживает смену экрана — пересобираем пустым
        await screen(plan, ['template', 'нет-такого']);
    });

    /*
     * Паузы задаются при сборе (§16.1, Р-170).
     *
     * Отдых жил одной настройкой на всё приложение, и поправить его можно
     * было только во время самой тренировки — лезть в профиль, стоя между
     * подходами.
     */
    it('паузы задаются в сборке и переезжают на тренировку', async () => {
        const ex = await seed();

        await screen(plan, ['template', 'нет-такого']);
        await screen(plan);

        const было = dialog.pick;
        dialog.pick = async () => ex.id;

        try {
            await press('plan-add');
        } finally {
            dialog.pick = было;
        }

        const view = await screen(plan);
        const подписи = [...view.querySelectorAll('label')].map((l) => l.textContent.trim());

        assert(подписи.includes('Между подходами, с'), подписи.join(', '));
        assert(подписи.includes('Между кругами, с'), подписи.join(', '));

        await change('plan-rest', 30, { key: 'rest' });
        await change('plan-rest', 120, { key: 'roundRest' });

        await press('plan-start');

        const w = await dbService.getActiveWorkout();

        equal(w.restSeconds, 30, 'пауза между подходами уехала на тренировку');
        equal(w.roundRest, 120, 'и пауза между кругами');

        await dbService.finishWorkout(w.id);
        await screen(plan, ['template', 'нет-такого']);
    });

    /*
     * Паузы — часть шаблона наравне с отрезками (§16.1, Р-172).
     *
     * Владелец: «вбиваю числа и нажимаю сохранить шаблон. При следующем
     * редактировании там уже пустые поля».
     */
    it('паузы помнятся шаблоном', async () => {
        const ex = await seed();

        await screen(plan, ['template', 'нет-такого']);
        await screen(plan);

        const было = dialog.pick;
        dialog.pick = async () => ex.id;

        try {
            await press('plan-add');
        } finally {
            dialog.pick = было;
        }

        await change('plan-rest', 15, { key: 'rest' });
        await change('plan-rest', 90, { key: 'roundRest' });

        const былаФорма = dialog.form;
        const былАлерт = dialog.alert;

        dialog.form = async () => ({ name: 'Круговая проба' });
        dialog.alert = async () => true;

        try {
            await press('plan-as-template');
        } finally {
            dialog.form = былаФорма;
            dialog.alert = былАлерт;
        }

        const шаблон = (await dbService.listTemplates()).find((t) => t.name === 'Круговая проба');

        assert(шаблон, 'шаблон обязан сохраниться');
        equal(шаблон.rest, 15, 'и запомнить паузу между подходами');
        equal(шаблон.roundRest, 90, 'и паузу между кругами');

        // Открыли заново — числа на месте, а не пустота
        const снова = await screen(plan, ['template', шаблон.id]);
        const поля = [...снова.querySelectorAll('[data-change="plan-rest"]')]
            .map((el) => [el.dataset.key, el.value]);

        equal(поля, [['rest', '15'], ['roundRest', '90']], 'поля открываются заполненными');

        await screen(plan, ['template', 'нет-такого']);
    });

    /*
     * Повтор повторяет тренировку целиком, а не один её состав (Р-172).
     */
    it('повтор тренировки возвращает её паузы', async () => {
        const ex = await seed();

        const w = await dbService.createWorkout({
            type: 'Силовая',
            plan: [{ exerciseId: ex.id, plannedSets: 2, skipped: false }]
        });

        await dbService.updateWorkout(w.id, { restSeconds: 25, roundRest: 75 });
        await dbService.addSet({ workoutId: w.id, exerciseId: ex.id, order: 1, setNumber: 1, reps: 10 });
        await dbService.finishWorkout(w.id);

        const view = await screen(plan, ['repeat', w.id]);
        const поля = [...view.querySelectorAll('[data-change="plan-rest"]')]
            .map((el) => [el.dataset.key, el.value]);

        equal(поля, [['rest', '25'], ['roundRest', '75']], 'паузы того дня возвращаются');

        await screen(plan, ['template', 'нет-такого']);
    });

    it('у каждой кнопки и каждого поля есть кто-то на другом конце', async () => {
        const ex = await seed();
        await workout(ex, [[10, 60], [10, 60]]);
        await dbService.setBodyWeight({ weight: 92.9, waist: 102 });

        const подписки = actions.names();
        подписки.click.push(...ИЗ_ТОЧКИ_ВХОДА);
        const беда = [];

        for (const [имя, экран] of ЭКРАНЫ) {
            if (!экран?.render) continue;

            let view;
            try { view = await screen(экран); } catch { continue; }

            for (const узел of view.querySelectorAll('[data-action]')) {
                const действие = узел.dataset.action;
                if (!подписки.click.includes(действие)) беда.push(`${имя}: нажатие «${действие}»`);
            }

            for (const узел of view.querySelectorAll('[data-change]')) {
                const поле = узел.dataset.change;
                if (!подписки.change.includes(поле)) беда.push(`${имя}: поле «${поле}»`);
            }
        }

        assert(беда.length === 0, `кнопки без обработчика:\n${[...new Set(беда)].join('\n')}`);
    });

    /*
     * У каждого поля есть имя, и не из подсказки внутри (§45, Р-150).
     *
     * Читалка экрана объявляет поле по имени. Без имени незрячий слышит
     * «текстовое поле» и гадает, что в него писать. Подсказка внутри поля
     * именем не считается: она стоит, пока поле пусто, и исчезает от первой
     * же буквы — то есть ровно тогда, когда человек в поле и работает.
     *
     * Скрытые поля пропускаются: их читалка не видит, и имя им ни к чему.
     */
    it('у каждого видимого поля есть имя для читалки', async () => {
        const ex = await seed();
        await workout(ex, [[10, 60]]);
        await dbService.setBodyWeight({ weight: 92.9 });

        const беда = [];

        for (const [имя, экран] of ЭКРАНЫ) {
            if (!экран?.render) continue;

            let view;
            try { view = await screen(экран); } catch { continue; }

            for (const поле of view.querySelectorAll('input, select, textarea')) {
                if (поле.hasAttribute('hidden') || поле.type === 'hidden') continue;

                const id = поле.getAttribute('id');

                const названо = поле.closest('label')
                    || (id && view.querySelector(`label[for="${id}"]`))
                    || поле.getAttribute('aria-label')
                    || поле.getAttribute('aria-labelledby');

                if (!названо) беда.push(`${имя}: ${поле.tagName.toLowerCase()} «${id || поле.className || поле.type}»`);
            }
        }

        assert(беда.length === 0, `поля без имени:\n${[...new Set(беда)].join('\n')}`);
    });

    /*
     * Кнопка-значок называет себя словами (§45, Р-111, Р-151).
     *
     * «←», «✎», «↩» читалка произносит как «стрелка влево» и «карандаш» — то
     * есть описывает картинку, а не действие. Подсказка в title тут не
     * помощник: она живёт под курсором, а на телефоне курсора нет (Р-118).
     *
     * Ловится по имени: если всё, что у кнопки есть, — это один-два знака без
     * единой буквы и цифры, значит имени у неё нет.
     */
    it('кнопка-значок названа словами, а не значком', async () => {
        const ex = await seed();
        await workout(ex, [[10, 60]]);
        await dbService.setBodyWeight({ weight: 92.9 });

        const беда = [];

        for (const [имя, экран] of ЭКРАНЫ) {
            if (!экран?.render) continue;

            let view;
            try { view = await screen(экран); } catch { continue; }

            for (const кнопка of view.querySelectorAll('button, [role="button"]')) {
                const текст = (кнопка.textContent || '').replace(/\s+/g, '');
                const метка = кнопка.getAttribute('aria-label') || кнопка.getAttribute('aria-labelledby');

                const значок = текст.length > 0 && текст.length <= 2 && !/[\p{L}\p{N}]/u.test(текст);

                if (значок && !метка) беда.push(`${имя}: «${текст}» (${кнопка.dataset.action || кнопка.className})`);
            }
        }

        assert(беда.length === 0, `значки без слов:\n${[...new Set(беда)].join('\n')}`);
    });
});
