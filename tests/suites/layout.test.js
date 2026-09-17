/**
 * Ничего не торчит за край телефона (§45, Р-182).
 *
 * Три дефекта за два дня были об одном и том же: экран, правильный в
 * разметке и сломанный в вёрстке. Кнопка «Закончить» не там, журнал подходов
 * сцеплялся с браузером, заметка о еде вылезала из карточки и уводила всё
 * окно вбок за пальцем. Ни один из них не видно ни в разметке, ни в тексте —
 * только глазом на узком экране, а глаз есть не у каждого прогона.
 *
 * Здесь экраны показываются по-настоящему: в отдельном окне шириной 375
 * точек, с тем же `css/style.css` и тем же каркасом. Вопрос один и тот же ко
 * всем: не шире ли содержимое окна.
 *
 * Текст всюду длинный намеренно. Короткий помещается в любую вёрстку, и
 * проверка на нём отчитывалась бы об успехе ровно до того дня, когда человек
 * запишет настоящую заметку.
 */

import { describe, it, assert } from '../runner.js';
import { наТелефоне, самопроверка, опустить, ТЕЛЕФОН } from '../helpers/layout.js';
import { seed, workout } from '../helpers/dom.js';
import { dbService } from '../../js/services/db.js';
import { config } from '../../js/config.js';
import { ICU_STEPS_GOAL, ICU_ACTS, ICU_DATA } from '../../js/services/icu.js';

import { home } from '../../js/modules/home.js';
import { history } from '../../js/modules/history.js';
import { stats } from '../../js/modules/stats.js';
import { condition } from '../../js/modules/condition.js';
import { summary } from '../../js/modules/summary.js';
import { session } from '../../js/modules/session.js';
import { intervalScreen } from '../../js/modules/interval.js';
import { exercises } from '../../js/modules/exercises.js';
import { recordsScreen } from '../../js/modules/records.js';
import { templates } from '../../js/modules/templates.js';
import { profile } from '../../js/modules/profile.js';
import { athleteScreen } from '../../js/modules/athlete.js';

/** Заметка такой длины, какую пишет разбор фотографии (§68). */
const ДЛИННАЯ = '0.5 светлого нефильтрованного, орешки криспы 100 гр, мороженое в вафельном стаканчике';

/** Название, какое заводит собеседник по плану от тренера. */
const ДЛИННОЕ_ИМЯ = 'Сгибание рук с резинкой на бицепс стоя, хват снизу, с паузой в верхней точке';

const проверить = async (модуль, params = []) => {
    const { лишку, торчат, вразнобой } = await наТелефоне(await модуль.render(params));

    assert(лишку === 0,
        `шире экрана на ${лишку} точек: ${торчат.join('; ') || 'кто именно — не видно'}`);

    /*
     * Поля одного ряда — одной высоты (Р-187). Родной список выше поля ввода,
     * и рядом они стояли вразнобой: в «Кто вы» пол выбирают списком, а год и
     * рост набирают, и одно окно выпирало.
     */
    assert(вразнобой.length === 0,
        `в ряду поля разной высоты: ${вразнобой.join(' | ')}`);
};

describe(`Вёрстка на ширине ${ТЕЛЕФОН}`, () => {

    it('главная с длинным названием упражнения', async () => {
        const e = await seed({ name: ДЛИННОЕ_ИМЯ });
        await workout(e, [[12, 60], [10, 62.5]]);

        await проверить(home);
    });

    it('история', async () => {
        const e = await seed({ name: ДЛИННОЕ_ИМЯ });
        await workout(e, [[12, 60]]);

        await проверить(history);
    });

    it('статистика', async () => {
        const e = await seed({ name: ДЛИННОЕ_ИМЯ });
        await workout(e, [[12, 60], [10, 62.5], [8, 65]]);

        await проверить(stats);
    });

    it('справочник упражнений', async () => {
        await seed({ name: ДЛИННОЕ_ИМЯ });

        await проверить(exercises);
    });

    it('рекорды', async () => {
        const e = await seed({ name: ДЛИННОЕ_ИМЯ });
        await workout(e, [[12, 60]]);

        await проверить(recordsScreen);
    });

    it('шаблоны', async () => {
        const e = await seed({ name: ДЛИННОЕ_ИМЯ });

        await dbService.saveTemplate({
            name: 'Полная тренировка верха тела с резинкой и гантелями',
            type: 'Силовая',
            items: [{ exerciseId: e.id, plannedSets: 3, targetReps: 12, weight: 14 }]
        });

        await проверить(templates);
    });

    it('профиль', async () => {
        await seed();

        await проверить(profile);
    });

    /*
     * «Рамки» — самый плотный ряд полей в приложении: три числа в строку
     * (Р-185). На узком экране он и обязан переноситься, а не распирать.
     */
    it('о себе с целями и ограничениями', async () => {
        await seed();

        await dbService.setSetting(ICU_STEPS_GOAL, 12000);

        await проверить(athleteScreen);
    });

    /*
     * Тот самый случай (Р-182): заметка в полсотни слов не ужималась ни на
     * точку, вылезала из карточки и уводила всё окно вбок за пальцем.
     */
    it('кондиции с длинной заметкой о еде', async () => {
        await seed();

        config.set('profile', { sex: 'male', height: 185, birthYear: 1985 });

        await dbService.setBodyWeight({ at: Date.now() - 40 * 86400000, weight: 93, waist: 101 });
        await dbService.setBodyWeight({ at: Date.now(), weight: 91.3, waist: 98.3 });

        await dbService.addIntake({ kcal: 810 });
        await dbService.addIntake({ kcal: 950, note: ДЛИННАЯ });

        /*
         * Полосы разбора нагрузки — самая узкая строка экрана (Р-188): имя
         * вида, полоса и доля в один ряд на 375 точках.
         */
        const ДЕНЬ = 86400000;
        const занятие = (n, type, load) => ({
            id: `a${n}`, name: type, type,
            start: Date.now() - n * ДЕНЬ, end: Date.now() - n * ДЕНЬ + 3600000,
            seconds: 3600, avgHr: 128, maxHr: 165, calories: 520, load
        });

        await dbService.setSetting(ICU_ACTS, { at: Date.now(), rows: [
            занятие(1, 'Basketball', 96),
            занятие(2, 'WeightTraining', 41),
            занятие(3, 'Бег по пересечённой местности зимой', 18)
        ]});

        await dbService.setSetting(ICU_DATA, { at: Date.now(), rows: [
            { date: Date.now() - ДЕНЬ, ctl: 47, atl: 66, sleepSecs: 25200, restingHr: 54 }
        ]});

        await проверить(condition);
    });

    it('итоги с длинной заметкой к подходу', async () => {
        const e = await seed({ name: ДЛИННОЕ_ИМЯ });
        const w = await workout(e, [[12, 60], [10, 62.5], [8, 65]]);

        const [подход] = await dbService.listSets(w.id);
        await dbService.updateSet(подход.id, { note: ДЛИННАЯ });

        await проверить(summary, [w.id]);
    });

    it('выполнение с длинным названием', async () => {
        const e = await seed({ name: ДЛИННОЕ_ИМЯ });

        await dbService.createWorkout({
            type: 'Силовая',
            plan: [{ exerciseId: e.id, plannedSets: 3, targetReps: 12, weight: 14, skipped: false }]
        });

        await проверить(session);
    });

    it('интервальная программа с длинными названиями', async () => {
        const e = await seed({ name: ДЛИННОЕ_ИМЯ });

        const w = await dbService.createWorkout({
            type: 'Табата',
            plan: [{ exerciseId: e.id, plannedSets: 8, skipped: false }]
        });

        await dbService.updateWorkout(w.id, {
            interval: { work: 20, rest: 10, rounds: 8, roundRest: 60, lead: 10 },
            run: { state: 'idle', elapsed: 0, startedAt: null }
        });

        await проверить(intervalScreen);
    });

    /*
     * Проверка обязана уметь падать: рама, которая ничего не меряет, о любой
     * вёрстке отчитается одинаково хорошо.
     */
    it('замер и вправду видит вылезшее', async () => {
        const { лишку, торчат } = await самопроверка();

        assert(лишку > 400, `девятисотточечный блок обязан быть замечен, а лишку вышло ${лишку}`);
        assert(торчат.length > 0, 'и виновник обязан быть назван');

        опустить();
    });
});
