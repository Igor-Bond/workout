/**
 * Знакомство при первом запуске (§61 ТЗ).
 *
 * Проверять тут надо четыре вещи: кому оно показывается, что шаги идут по
 * одному и ходят в обе стороны, что ответы доезжают туда, где живут
 * постоянно, и что в конце человека не бросают на пустом экране.
 *
 * Первое потому, что ошибка в условии встретит знакомством человека с
 * полугодовой историей. Второе потому, что мастер без «назад» — это допрос.
 * Третье потому, что вопрос, ответ на который никуда не попал, хуже
 * незаданного. Четвёртое потому, что «готово» без дороги дальше — это тупик.
 */

import { describe, it, equal, assert } from '../runner.js';
import { screen, text, hasAction, press, seed, workout } from '../helpers/dom.js';
import { intro, INTRO_KEY, нужноЗнакомство, знакомствоЖдёт } from '../../js/modules/intro.js';
import { ATHLETE_KEY } from '../../js/modules/athlete.js';
import { KEY_SETTING } from '../../js/services/ai.js';
import { dbService } from '../../js/services/db.js';

/** Начать знакомство с чистого листа: ответы живут в модуле и переживают экран. */
async function сначала() {
    const упражнение = await seed();
    intro.leave();

    return упражнение;
}

/** Пройти вперёд столько раз, сколько сказано. */
async function вперёд(раз = 1) {
    for (let i = 0; i < раз; i++) await press('intro-next');
}

describe('Кому показывать знакомство', () => {

    it('на пустой базе — да', async () => {
        await сначала();

        equal(await нужноЗнакомство(), true);
    });

    it('пройденное больше не появляется', async () => {
        await сначала();
        await dbService.setSetting(INTRO_KEY, { done: true });

        equal(await нужноЗнакомство(), false);
    });

    it('человеку с историей — нет', async () => {
        const упражнение = await сначала();
        await workout(упражнение, [[10, 60]]);

        equal(await нужноЗнакомство(), false,
            'встретить знакомством того, кто занимается полгода, — объяснять ему, что такое тренировка');
    });

});

describe('Шаги идут по одному', () => {

    it('начинается с приветствия, а не с вопроса', async () => {
        await сначала();

        const строка = text(await screen(intro));

        assert(строка.includes('журнал тренировок'), `сначала о том, куда человек попал: ${строка.slice(0, 200)}`);
        assert(строка.includes('шаг 1 из 5'), 'номер шага обязателен');
        assert(hasAction(await screen(intro), 'intro-skip'), 'настройку можно пропустить целиком');
    });

    it('«далее» ведёт по шагам, «назад» возвращает', async () => {
        await сначала();
        await screen(intro);

        await вперёд(1);
        assert(text(await screen(intro)).includes('шаг 2 из 5'), 'второй шаг');

        await вперёд(2);
        assert(text(await screen(intro)).includes('шаг 4 из 5'), 'четвёртый шаг');

        await press('intro-back');
        assert(text(await screen(intro)).includes('шаг 3 из 5'), 'назад — обязательная дорога, иначе это допрос');
    });

    it('на первом шаге назад некуда', async () => {
        await сначала();

        assert(!hasAction(await screen(intro), 'intro-back'));
    });

    it('шаги никуда не уводят со страницы', async () => {
        await сначала();
        await screen(intro);

        for (let i = 0; i < 5; i++) {
            const view = await screen(intro);

            assert(!hasAction(view, 'nav'),
                `шаг ${i + 1} обязан спрашивать здесь: уводящий шаг обрывает знакомство`);

            await вперёд(1);
        }
    });

    it('после пяти шагов идёт сводка ответов', async () => {
        await сначала();
        await screen(intro);
        await вперёд(5);

        const строка = text(await screen(intro));

        assert(строка.includes('Проверьте'), `итог: ${строка.slice(0, 200)}`);
        assert(hasAction(await screen(intro), 'intro-goto'), 'каждую строку сводки можно поправить');
    });

    it('правка из сводки возвращает на нужный шаг', async () => {
        await сначала();
        await screen(intro);
        await вперёд(5);

        await press('intro-goto', { step: 'about' });

        assert(text(await screen(intro)).includes('шаг 2 из 5'), 'вернулись именно туда, что правим');
    });

    it('за сводкой короткая справка, за ней развилка', async () => {
        await сначала();
        await screen(intro);
        await вперёд(6);

        assert(text(await screen(intro)).includes('Как это работает'), 'справка');

        await вперёд(1);
        const конец = await screen(intro);

        assert(text(конец).includes('С чего начнёте'), 'развилка вместо одинокого «готово»');
        assert(hasAction(конец, 'intro-finish'), 'и дороги дальше');
    });

});

describe('Ответы доезжают', () => {

    it('пол, цель, инвентарь и ограничение ложатся в профиль', async () => {
        await сначала();
        await screen(intro);
        await вперёд(1);

        await press('intro-sex', { value: 'male' });
        await press('intro-goal', { value: 'убрать живот' });
        await вперёд(1);

        await press('intro-gear', { value: 'резинка' });
        await press('intro-limit', { value: 'колено' });
        await вперёд(1);

        const профиль = await dbService.getSetting(ATHLETE_KEY, null);

        equal(профиль.sex, 'male');
        equal(профиль.goal, 'убрать живот');
        equal(профиль.equipment, ['резинка']);
        equal(профиль.limits.map((l) => l.name), ['колено']);
    });

    /*
     * Целей бывает несколько сразу (Р-102): «набрать силу» и «убрать живот»
     * не спорят, их хотят вместе, и выбор одного из четырёх давал полуправду.
     */
    it('целей можно выбрать несколько', async () => {
        await сначала();
        await screen(intro);
        await вперёд(1);

        await press('intro-goal', { value: 'набрать силу' });
        await press('intro-goal', { value: 'убрать живот' });
        await вперёд(1);

        equal((await dbService.getSetting(ATHLETE_KEY, null)).goal, 'набрать силу, убрать живот');
    });

    it('своё дописывается к готовым ответам', async () => {
        await сначала();
        await screen(intro);
        await вперёд(2);

        const поле = document.createElement('input');
        поле.id = 'in-gear';
        поле.value = 'петли';
        document.body.appendChild(поле);

        try {
            await press('intro-gear-add');
        } finally {
            поле.remove();
        }

        equal((await dbService.getSetting(ATHLETE_KEY, null)).equipment, ['петли']);
    });

    it('режим — дни и минуты — доезжает до профиля', async () => {
        await сначала();
        await screen(intro);
        await вперёд(1);

        for (const [id, value] of [['in-days', '4'], ['in-minutes', '60']]) {
            const поле = document.createElement('input');
            поле.id = id;
            поле.value = value;
            document.body.appendChild(поле);
        }

        try {
            await вперёд(1);
        } finally {
            document.getElementById('in-days')?.remove();
            document.getElementById('in-minutes')?.remove();
        }

        const профиль = await dbService.getSetting(ATHLETE_KEY, null);

        equal(профиль.days, 4);
        equal(профиль.minutes, 60, 'без этого тренер напишет пять дней по полтора часа');
    });

    /*
     * Ответы жили в модуле до ближайшего «далее», и закрытое посреди шага
     * приложение теряло выбранное (Р-102).
     */
    it('нажатие по чипу сохраняется сразу, не дожидаясь «далее»', async () => {
        await сначала();
        await screen(intro);
        await вперёд(2);

        await press('intro-gear', { value: 'гиря' });

        equal((await dbService.getSetting(ATHLETE_KEY, null)).equipment, ['гиря']);
    });

    it('нажатие по чипу второй раз его снимает', async () => {
        await сначала();
        await screen(intro);
        await вперёд(2);

        await press('intro-gear', { value: 'гиря' });
        await press('intro-gear', { value: 'гиря' });
        await вперёд(1);

        equal((await dbService.getSetting(ATHLETE_KEY, null)).equipment, []);
    });

    /*
     * Ответы живут в модуле между шагами, и без снятия набранного нажатие по
     * чипу стирало бы то, что дописано в поле рядом. Здесь это и проверяется:
     * поле заполняется, потом жмётся чип, потом смотрим, что сохранилось.
     */
    it('нажатие по чипу не стирает набранное в поле', async () => {
        await сначала();
        await screen(intro);
        await вперёд(1);

        const поле = document.createElement('input');
        поле.id = 'in-year';
        поле.value = '1985';
        document.body.appendChild(поле);

        try {
            await press('intro-sex', { value: 'female' });
            await вперёд(1);
        } finally {
            поле.remove();
        }

        equal((await dbService.getSetting(ATHLETE_KEY, null)).birthYear, 1985);
    });

    /*
     * Пропустивший шаг с ключом должен знать, куда вернуться (Р-103): экран
     * тренера лежит через профиль, и угадать это неоткуда.
     */
    it('шаг тренера говорит, где вставить ключ потом', async () => {
        await сначала();
        await screen(intro);
        await вперёд(4);

        const строка = text(await screen(intro));

        assert(строка.includes('Программа и тренер'), `путь назад обязан быть назван: ${строка.slice(0, 300)}`);
    });

    it('ключ тренера сохраняется', async () => {
        await сначала();
        await screen(intro);
        await вперёд(4);

        const поле = document.createElement('input');
        поле.id = 'in-key';
        поле.value = 'AIzaПроверочный';
        document.body.appendChild(поле);

        try {
            await вперёд(1);
        } finally {
            поле.remove();
        }

        equal(await dbService.getSetting(KEY_SETTING, ''), 'AIzaПроверочный');
    });

});

describe('Выход из знакомства', () => {

    it('«пропустить настройку» закрывает его насовсем', async () => {
        await сначала();
        await screen(intro);

        await press('intro-skip');

        equal((await dbService.getSetting(INTRO_KEY, null))?.done, true);
        equal(await нужноЗнакомство(), false);
    });

    it('развилка закрывает знакомство и ведёт, куда выбрали', async () => {
        await сначала();
        await screen(intro);
        await вперёд(7);

        await press('intro-finish', { screen: 'exercises' });

        equal((await dbService.getSetting(INTRO_KEY, null))?.done, true);
        equal(await нужноЗнакомство(), false);
    });

    /*
     * Полоса возврата осталась для тех случаев, когда человек всё же ушёл со
     * знакомства — из справки или из развилки (Р-94). Сами шаги никуда не
     * уводят, и во время них полосы не бывает.
     */
    it('пройденное знакомство обратно не зовёт', async () => {
        await сначала();
        await screen(intro);
        await press('intro-skip');

        equal(await знакомствоЖдёт(), null);
    });

    it('без метки ухода полосы нет', async () => {
        await сначала();
        await screen(intro);

        equal(await знакомствоЖдёт(), null);
    });

    it('метка ухода зовёт обратно и называет шаг', async () => {
        await сначала();
        await screen(intro);
        await вперёд(2);

        const состояние = await dbService.getSetting(INTRO_KEY, null);
        await dbService.setSetting(INTRO_KEY, { ...состояние, pending: 'gear' });

        equal(await знакомствоЖдёт(), { номер: 3, всего: 5 });
    });

});
