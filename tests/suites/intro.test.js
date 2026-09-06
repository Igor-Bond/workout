/**
 * Знакомство при первом запуске (§61 ТЗ).
 *
 * Проверять тут надо ровно две вещи: кому оно показывается и что отказ
 * запоминается. Первое потому, что ошибка в условии встретит знакомством
 * человека с полугодовой историей; второе потому, что спрошенное дважды об
 * одном — это не вопрос, а навязчивость.
 */

import { describe, it, equal, assert } from '../runner.js';
import { screen, text, hasAction, press, seed, workout } from '../helpers/dom.js';
import { intro, INTRO_KEY, нужноЗнакомство } from '../../js/modules/intro.js';
import { ATHLETE_KEY } from '../../js/modules/athlete.js';
import { dbService } from '../../js/services/db.js';

describe('Кому показывать знакомство', () => {

    it('на пустой базе — да', async () => {
        await seed();

        equal(await нужноЗнакомство(), true);
    });

    it('пройденное больше не появляется', async () => {
        await seed();
        await dbService.setSetting(INTRO_KEY, { done: true });

        equal(await нужноЗнакомство(), false);
    });

    it('человеку с историей — нет', async () => {
        const упражнение = await seed();
        await workout(упражнение, [[10, 60]]);

        equal(await нужноЗнакомство(), false,
            'встретить знакомством того, кто занимается полгода, — объяснять ему, что такое тренировка');
    });

});

describe('Экран знакомства', () => {

    it('называет все четыре шага и последствие отказа', async () => {
        await seed();

        const view = await screen(intro);
        const строка = text(view);

        for (const шаг of ['О себе', 'Упражнения', 'Тренер', 'План']) {
            assert(строка.includes(шаг), `шаг «${шаг}» пропал: ${строка.slice(0, 200)}`);
        }

        assert(строка.includes('колен'), 'без последствия отказ выходит наугад');
        assert(hasAction(view, 'intro-done'), 'выход обязателен: знакомство не ловушка');
    });

    it('заполненный профиль отмечен готовым и не просит «потом»', async () => {
        await seed();
        await dbService.setSetting(ATHLETE_KEY, { goal: 'сила', limits: [] });

        const view = await screen(intro);
        const шаг = [...view.querySelectorAll('.card')].find((c) => text(c).startsWith('О себе'));

        assert(text(шаг).includes('готово'), `не отмечен готовым: ${text(шаг)}`);
        assert(!шаг.querySelector('[data-action="intro-skip"]'), 'предлагать отложить сделанное незачем');
    });

    it('отложенный шаг помнится и не спрашивается снова', async () => {
        await seed();

        await press('intro-skip', { step: 'coach' });

        const сохранено = await dbService.getSetting(INTRO_KEY, null);
        equal(сохранено.skipped.includes('coach'), true);

        const view = await screen(intro);
        const шаг = [...view.querySelectorAll('.card')].find((c) => text(c).startsWith('Тренер'));

        assert(text(шаг).includes('потом'), `отказ не отмечен: ${text(шаг)}`);
        assert(!шаг.querySelector('[data-action="intro-skip"]'), 'второй раз о том же не спрашивают');
    });

    it('кнопка внизу говорит, что осталось незаполненным', async () => {
        await seed();

        assert(text(await screen(intro)).includes('Пропустить остальное'),
            'обещать «начать», когда половина шагов не сделана, — врать о состоянии');
    });

    it('«начать» закрывает знакомство навсегда', async () => {
        await seed();

        await press('intro-done');

        equal((await dbService.getSetting(INTRO_KEY, null))?.done, true);
        equal(await нужноЗнакомство(), false);
    });

});
