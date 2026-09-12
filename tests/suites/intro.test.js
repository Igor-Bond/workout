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

/**
 * Знакомство не выдумывает замеров и не теряет набранного (§26.3, §58, Р-119).
 */
describe('Знакомство и чужие данные', () => {

    /** Поле шага: экран собран строкой, поля в проверке заводятся руками. */
    function поле(id, value) {
        const el = document.createElement('input');
        el.id = id;
        el.value = value;
        document.body.appendChild(el);
        return el;
    }

    /*
     * Главное здесь. Поля веса и талии заполняются последним замером — чтобы
     * человек с историей не вводил заново известное. Но сохранение идёт при
     * каждом «Далее» и при каждом чипе, а setBodyWeight пишет сегодняшним
     * днём: достаточно было открыть знакомство из профиля и нажать что
     * угодно, чтобы замер недельной давности стал сегодняшним. Взвешивания не
     * было, а на главном появлялось «92,8 кг · сегодня».
     */
    it('подставленный из базы вес обратно не записывается', async () => {
        await сначала();

        const неделю = Date.now() - 7 * 86400000;
        await dbService.setBodyWeight({ weight: 92.8, waist: 102, at: неделю });

        const было = await dbService.listBodyWeight();

        await screen(intro);
        await вперёд(3);
        await press('intro-gear', { value: 'гиря' });

        const стало = await dbService.listBodyWeight();

        equal(стало.length, было.length, 'новой записи взяться неоткуда — человек ничего не вводил');
        equal(стало[0].weight, 92.8);
        equal(стало[0].at, было[0].at, 'и день чужого замера не переносится на сегодня');
    });

    it('а введённый руками — записывается', async () => {
        await сначала();
        await dbService.setBodyWeight({ weight: 92.8, waist: 102, at: Date.now() - 7 * 86400000 });

        await screen(intro);
        await вперёд(3);

        поле('in-weight', '91,4');

        try {
            await вперёд(1);
        } finally {
            document.getElementById('in-weight')?.remove();
        }

        const замеры = await dbService.listBodyWeight();

        equal(замеры[замеры.length - 1].weight, 91.4, 'иначе знакомство молча теряет то, ради чего спрашивало');
    });

    /*
     * Половина починки Р-102 не работала: снять() перечисляет восемь полей, а
     * этих двух в списке не было — набранное «петли» исчезало при перерисовке
     * молча, и в сводке на месте инвентаря стояло «не сказано».
     */
    it('дописанное «своё» не пропадает без «Добавить»', async () => {
        await сначала();
        await screen(intro);
        await вперёд(2);

        поле('in-gear', 'петли');

        try {
            await вперёд(1);
        } finally {
            document.getElementById('in-gear')?.remove();
        }

        equal((await dbService.getSetting(ATHLETE_KEY, null)).equipment, ['петли']);
    });

    it('и своё ограничение тоже', async () => {
        await сначала();
        await screen(intro);
        await вперёд(2);

        поле('in-limit', 'нет турника');

        try {
            await вперёд(1);
        } finally {
            document.getElementById('in-limit')?.remove();
        }

        const профиль = await dbService.getSetting(ATHLETE_KEY, null);

        equal(профиль.limits.map((l) => l.name), ['нет турника']);
    });

    it('дважды набранное не задваивается', async () => {
        await сначала();
        await screen(intro);
        await вперёд(2);

        поле('in-gear', 'петли');

        try {
            await press('intro-gear-add');
            await press('intro-sex', { value: 'male' });
            await вперёд(1);
        } finally {
            document.getElementById('in-gear')?.remove();
        }

        equal((await dbService.getSetting(ATHLETE_KEY, null)).equipment, ['петли']);
    });

});

/**
 * Шаг вопросов и сводка ответов (§61, Р-123).
 */
describe('Знакомство: вопросы видно и ответы читаются', () => {

    /*
     * Шаг шёл так: серая строка, чипы, поле — и ещё раз серая строка, чипы,
     * поле. Ряд частей тела под рядом снарядов в приложении про тренировки
     * читается как «что качать», а нажавший «спина» получает ограничение.
     */
    it('у двух вопросов шага свои заголовки', async () => {
        await сначала();
        await screen(intro);
        await вперёд(2);

        const view = await screen(intro);
        const заголовки = [...view.querySelectorAll('.intro-group')].map((h) => h.textContent.trim());

        equal(заголовки.length, 2, 'вопросов на шаге два, и каждый должен назваться');
        assert(заголовки[0].includes('есть'), заголовки.join(' / '));
        assert(заголовки[1].includes('мешает'), заголовки.join(' / '));
    });

    /*
     * Экран называется «Проверьте ответы» и просит проверить то, чего сам не
     * показывал целиком: значение стояло одной линией с многоточием.
     */
    it('строка сводки переносится и нажимается целиком', async () => {
        await сначала();
        await screen(intro);
        await вперёд(1);

        await press('intro-goal', { value: 'набрать силу' });
        await press('intro-goal', { value: 'убрать живот' });
        await вперёд(4);

        const view = await screen(intro);
        const строки = [...view.querySelectorAll('.intro-sum')];

        assert(строки.length > 0, 'сводка обязана быть');

        for (const строка of строки) {
            equal(строка.tagName, 'BUTTON', 'нажимается вся строка, а не значок в 34 точки');
            equal(строка.dataset.action, 'intro-goto');
        }

        const цель = строки.find((с) => с.textContent.includes('набрать силу'));

        assert(цель, 'цель обязана быть в сводке');
        assert(цель.querySelector('.ex-name.is-wrap'), 'значение должно переноситься, а не обрываться');
    });
});

describe('Выход из знакомства', () => {

    /*
     * «Пропустить настройку» отменяла знакомство насовсем — вместе со
     * справкой и развилкой (Р-121). А над кнопкой написано, что пропустить
     * можно каждый вопрос. Отказ от анкеты и отказ от объяснения — разные
     * решения, и кнопка у них должна быть разная.
     */
    it('«пропустить настройку» пропускает вопросы, а не объяснение', async () => {
        await сначала();
        await screen(intro);

        await press('intro-skip');

        const состояние = await dbService.getSetting(INTRO_KEY, null);

        assert(!состояние?.done, 'знакомство не закрыто: справка и развилка впереди');

        const view = await screen(intro);

        assert(!text(view).includes('шаг 1 из 5'), 'вопросы позади');
        assert(hasAction(view, 'intro-next'), 'дорога дальше осталась');
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
     * Полоса возврата зовёт обратно того, кто ушёл со знакомства на другой
     * экран (§61, Р-94). На самом знакомстве её не показывают — это решает
     * app.js, — а метку ставит сам экран, с первого же показа.
     */
    it('пройденное знакомство обратно не зовёт', async () => {
        await сначала();
        await screen(intro);
        await вперёд(7);
        await press('intro-finish', { screen: 'home' });

        equal(await знакомствоЖдёт(), null);
    });

    /*
     * Номер шага сохраняется ради возврата в начатую анкету. У прошедшего он
     * равен последнему, и кнопка «Знакомство: с чего начать» открывала не
     * начало, а экран «Готово · Пять шагов позади» (Р-121).
     */
    it('пройденное открывается сначала, а не на «готово»', async () => {
        await сначала();
        await screen(intro);
        await вперёд(7);
        await press('intro-finish', { screen: 'home' });

        intro.leave();
        const view = await screen(intro);

        assert(text(view).includes('шаг 1 из 5'), `открылось не начало: ${text(view).slice(0, 120)}`);
    });

    it('с развилки можно вернуться назад', async () => {
        await сначала();
        await screen(intro);
        await вперёд(7);

        assert(hasAction(await screen(intro), 'intro-back'),
            'заметил на развилке опечатку в росте — и некуда');
    });

    it('до знакомства полосы нет', async () => {
        await сначала();

        equal(await знакомствоЖдёт(), null, 'звать обратно ещё неоткуда');
    });

    /*
     * Главная починка Р-119: метку не ставил никто, и полоса не появлялась
     * никогда. Нажал «История» на третьем шаге — оставшиеся два не встретятся
     * больше: следующий запуск знакомство не спросит, адрес уже не пустой.
     */
    it('открытое знакомство зовёт обратно и называет шаг', async () => {
        await сначала();
        await screen(intro);
        await вперёд(2);

        // Так уходят: экран покинут, ответы забыты, метка осталась
        intro.leave();

        equal(await знакомствоЖдёт(), { номер: 3, всего: 5 });
    });

    it('зовёт обратно и с первого шага', async () => {
        await сначала();
        await screen(intro);
        intro.leave();

        equal(await знакомствоЖдёт(), { номер: 1, всего: 5 },
            'уйти можно и с приветствия — звать обратно всё равно нужно');
    });

    it('дойдя до развилки, зовёт на последний вопрос, а не дальше', async () => {
        await сначала();
        await screen(intro);
        await вперёд(6);
        intro.leave();

        equal(await знакомствоЖдёт(), { номер: 5, всего: 5 }, 'шагов всего пять, шестого не бывает');
    });

});
