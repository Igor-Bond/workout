/**
 * Знакомство при первом запуске (§61 ТЗ).
 *
 * Проверять тут надо три вещи: кому оно показывается, что шаги идут по
 * одному, и что отказ запоминается. Первое потому, что ошибка в условии
 * встретит знакомством человека с полугодовой историей; второе потому, что
 * список из пяти карточек человек закрывает целиком; третье потому, что
 * спрошенное дважды об одном — это не вопрос, а навязчивость.
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

describe('Шаги идут по одному', () => {

    it('первым спрашивается профиль', async () => {
        await seed();

        const view = await screen(intro);
        const строка = text(view);

        assert(строка.includes('О себе'), `первый шаг: ${строка.slice(0, 200)}`);
        assert(строка.includes('шаг 1 из 5'), `номер шага обязателен: ${строка.slice(0, 200)}`);
        assert(строка.includes('колен'), 'без последствия отказ выходит наугад');
    });

    it('заполненный профиль пропускает шаг вперёд', async () => {
        await seed();
        await dbService.setSetting(ATHLETE_KEY, { goal: 'сила', limits: [] });

        const строка = text(await screen(intro));

        assert(строка.includes('Вес тела'), `следующим идёт вес: ${строка.slice(0, 200)}`);
        assert(строка.includes('шаг 2 из 5'));
    });

    it('вес спрашивается прямо здесь, а не ссылкой', async () => {
        await seed();
        await dbService.setSetting(ATHLETE_KEY, { goal: 'сила', limits: [] });

        const view = await screen(intro);

        assert(hasAction(view, 'intro-weight'),
            'уводить за одним числом на другой экран значит потерять человека на полпути');
    });

    it('отложенный шаг помнится и не спрашивается снова', async () => {
        await seed();

        await press('intro-skip', { step: 'athlete' });

        const сохранено = await dbService.getSetting(INTRO_KEY, null);
        equal(сохранено.skipped.includes('athlete'), true);

        const строка = text(await screen(intro));

        assert(строка.includes('Вес тела'), `после отказа идёт следующий шаг: ${строка.slice(0, 200)}`);
        assert(строка.includes('пропущено'), 'пройденное и отложенное видно строками');
    });

    it('когда шагов не осталось, знакомство прощается', async () => {
        await seed();

        for (const шаг of ['athlete', 'weight', 'exercises', 'coach', 'plan']) {
            await press('intro-skip', { step: шаг });
        }

        const строка = text(await screen(intro));

        assert(строка.includes('можно тренироваться'), `итог: ${строка.slice(0, 200)}`);
    });

    it('выход есть на любом шаге', async () => {
        await seed();

        assert(hasAction(await screen(intro), 'intro-done'), 'знакомство не ловушка');
    });

    it('«начать» закрывает знакомство навсегда', async () => {
        await seed();

        await press('intro-done');

        equal((await dbService.getSetting(INTRO_KEY, null))?.done, true);
        equal(await нужноЗнакомство(), false);
    });

});
