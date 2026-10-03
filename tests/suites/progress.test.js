/**
 * Как идёт программа (§63 ТЗ).
 *
 * Модуль складывает пять величин в несколько строк, и ошибка здесь звучит так
 * же уверенно, как попадание: «можно тяжелее» в неделю, когда человек не
 * спит, — это не подсказка, а вред. Поэтому пороги и совпадения проверяются
 * отдельно от того, откуда взялись числа.
 */

import { describe, it, equal, assert } from '../runner.js';
import { progress } from '../../js/core/progress.js';

const DAY = 86400000;
const NOW = new Date(2026, 8, 6, 12).getTime();

const текст = (строки) => строки.map((с) => с.text).join(' | ');

describe('Запас в подходе', () => {

    it('называет упражнение поимённо', () => {
        const строки = progress.describe({ reserve: [{ name: 'Бицепс резинка', verdict: 'harder' }] });

        assert(строки[0].text.includes('Бицепс резинка'), `без имени это отнесут ко всей программе: ${строки[0].text}`);
        equal(строки[0].kind, 'up');
    });

    it('потерянный запас — отдельное наблюдение', () => {
        const строки = progress.describe({ reserve: [{ name: 'Отжимания', verdict: 'easier' }] });

        equal(строки[0].kind, 'down');
        assert(строки[0].text.includes('до отказа'));
    });

    it('без ряда молчит', () => {
        equal(progress.describe({ reserve: [{ name: 'Пресс', verdict: null }] }).length, 0);
    });

});

describe('Восстановление', () => {

    it('короткий сон и высокий пульс вместе — довод против прибавки', () => {
        const строки = progress.describe({
            recovery: progress.recovery({
                sleep: 6 * 3600,
                resting: { now: 58, base: 52, shift: 6, threshold: 3 }
            })
        });

        equal(строки[0].kind, 'down');
        assert(строки[0].text.includes('не для прибавки'), текст(строки));
    });

    it('один короткий сон ничего не значит', () => {
        const строки = progress.describe({
            recovery: progress.recovery({ sleep: 6 * 3600, resting: { now: 52, base: 52, shift: 0, threshold: 3 } })
        });

        equal(строки.length, 0, 'короткий сон бывает от кино, и порознь эти признаки значат мало');
    });

    it('один высокий пульс покоя — повод присмотреться, не более', () => {
        const строки = progress.describe({
            recovery: progress.recovery({ sleep: 8 * 3600, resting: { now: 58, base: 52, shift: 6, threshold: 3 } })
        });

        equal(строки[0].kind, 'watch');
    });

    it('пульс ниже обычного тревогой не считается', () => {
        const признаки = progress.recovery({ sleep: 8 * 3600, resting: { now: 46, base: 52, shift: -6, threshold: 3 } });

        equal(признаки.highResting, false, 'низкий пульс покоя — это не то же, что высокий');
    });

});

describe('Исполнение плана', () => {

    const день = (n, есть) => ({ day: NOW - n * DAY, session: есть ? { name: 'Бицепс' } : null });

    it('два пропуска за две недели — уже расхождение', () => {
        const дни = [день(1, true), день(3, true), день(5, true), день(7, true)];
        const сделано = new Set([дни[0].day, дни[1].day]);

        const строки = progress.describe({ adherence: progress.adherence(дни, сделано) });

        assert(строки[0].text.includes('2 из 4'), текст(строки));
        equal(строки[0].kind, 'watch');
    });

    it('один пропуск — это жизнь, и о нём молчат', () => {
        const дни = [день(1, true), день(3, true), день(5, true)];
        const сделано = new Set([дни[0].day, дни[1].day]);

        equal(progress.describe({ adherence: progress.adherence(дни, сделано) }).length, 0);
    });

    it('полностью выполненный план назван', () => {
        const дни = [день(1, true), день(3, true)];
        const сделано = new Set(дни.map((d) => d.day));

        const строки = progress.describe({ adherence: progress.adherence(дни, сделано) });

        equal(строки[0].kind, 'ok');
    });

    it('дни отдыха в счёт не идут', () => {
        const итог = progress.adherence([день(1, true), день(2, false)], new Set());

        equal(итог.planned, 1);
    });

    /*
     * Главное в Р-120. Сетка при пропуске не двигается (Р-62), а человек
     * двигается: сдвинулся на день — и тренировка не засчитывалась никуда.
     */
    it('тренировка днём раньше или позже засчитывается', () => {
        const дни = [день(2, true), день(6, true)];
        const сделано = new Set([день(1, true).day, день(7, true).day]);

        const итог = progress.adherence(дни, сделано);

        equal(итог.done, 2, 'день туда, день сюда — это та же тренировка, а не пропуск');
        equal(итог.planned, 2);
    });

    /*
     * Находка владельца по живому экрану (Р-121). План на шесть дней в
     * неделю, понедельник пропущен — а карточка отчиталась «выполнен
     * полностью». Допуск разбирал дни жадно: понедельник забирал вторничную
     * тренировку, вторник — среду, и пропуск исчезал по цепочке.
     */
    it('пропуск в плотном плане остаётся пропуском', () => {
        // Шесть дней подряд по плану, тренировки — все, кроме первого дня
        const дни = [13, 12, 11, 10, 9, 8].map((n) => день(n, true));
        const сделано = new Set([12, 11, 10, 9, 8].map((n) => день(n, true).day));

        const итог = progress.adherence(дни, сделано, { from: NOW - 13 * DAY, to: NOW });

        equal(итог.done, 5, 'пять тренировок на шесть дней плана — это пять');
        equal(итог.planned, 6);

        const строки = progress.describe({ adherence: итог });

        assert(!строки.some((s) => s.text.includes('выполнен полностью')),
            `хвалить за пропущенное нельзя: ${текст(строки)}`);
    });

    it('своя тренировка сильнее соседней', () => {
        // У вторника своя тренировка есть; понедельник не должен её забирать
        const дни = [день(5, true), день(4, true)];
        const сделано = new Set([день(4, true).day]);

        equal(progress.adherence(дни, сделано).done, 1, 'вторничная принадлежит вторнику');
    });

    it('одна тренировка не закрывает два дня сетки', () => {
        const дни = [день(4, true), день(5, true)];
        const сделано = new Set([день(4, true).day]);

        equal(progress.adherence(дни, сделано).done, 1, 'иначе приложение хвалит за то, чего не было');
    });

    /*
     * «Программа идёт быстрее вас» — самому старательному. У владельца
     * 29 тренировок за восемь недель, а засчитывалось две: он занимается чаще
     * плана, но не по его дням. Такую строку перестают читать, а с ней
     * перестают читать и остальные наблюдения, которые верны.
     */
    it('занимавшемуся чаще плана говорится про сетку, а не про отставание', () => {
        const окно = { from: NOW - 13 * DAY, to: NOW };

        // Сетка пореже: три дня за две недели
        const дни = [день(13, true), день(9, true), день(5, true)];

        // Тренировок больше, чем дней плана, и ни одна не легла на сетку
        const сделано = new Set([день(11, true).day, день(7, true).day,
            день(3, true).day, день(1, true).day]);

        const строки = progress.describe({ adherence: progress.adherence(дни, сделано, окно) });

        assert(строки[0].text.includes('сетка разошлась'), текст(строки));
        assert(!строки[0].text.includes('быстрее вас'), `упрёк не по адресу: ${текст(строки)}`);
    });

    it('а по-настоящему отставшему — прежними словами', () => {
        const окно = { from: NOW - 13 * DAY, to: NOW };

        const дни = [день(13, true), день(9, true), день(5, true), день(3, true)];
        const сделано = new Set([день(13, true).day]);

        const строки = progress.describe({ adherence: progress.adherence(дни, сделано, окно) });

        assert(строки[0].text.includes('быстрее вас'), текст(строки));
    });

});

describe('Объём', () => {

    it('спад четверти — наблюдение', () => {
        const строки = progress.describe({ volume: { current: 600, previous: 1000 } });

        assert(строки[0].text.includes('40'), текст(строки));
        equal(строки[0].kind, 'watch');
    });

    /*
     * Процент без обоих чисел — наблюдение без основания (Р-162). По одному
     * «на 127 % выше» нельзя понять, сравнили ли с полной неделей или с
     * полупустой, а это и есть первый вопрос, который человек задаёт.
     */
    it('проценты называют оба числа, из которых выведены', () => {
        const строки = progress.describe({ volume: { current: 1420, previous: 625 } });

        assert(строки[0].text.includes('1420'), текст(строки));
        assert(строки[0].text.includes('625'), текст(строки));
    });

    it('редкая прошлая неделя названа прямо', () => {
        const строки = progress.describe({
            volume: { current: 1420, previous: 625, currentDays: 4, previousDays: 2 }
        });

        assert(строки[0].text.includes('занятий было меньше'), текст(строки));
        assert(строки[0].text.includes('2') && строки[0].text.includes('4'), текст(строки));
    });

    it('при равном числе занятий оговорки нет', () => {
        const строки = progress.describe({
            volume: { current: 1420, previous: 625, currentDays: 3, previousDays: 3 }
        });

        assert(!строки[0].text.includes('занятий было меньше'), текст(строки));
    });

    it('колебание в десятую часть — не событие', () => {
        equal(progress.describe({ volume: { current: 1100, previous: 1000 } }).length, 0);
    });

    it('первая неделя не с чем сравнивать', () => {
        equal(progress.describe({ volume: { current: 500, previous: 0 } }).length, 0);
    });

    it('умеренная прибавка — хорошая новость', () => {
        const строки = progress.describe({ volume: { current: 1300, previous: 1000 } });

        equal(строки[0].kind, 'up', текст(строки));
        assert(строки[0].text.includes('30'), текст(строки));
    });

    /*
     * Приложение говорило «выше прошлой на 127 %» тем же зелёным, каким
     * хвалит выполненный план, — и спорило само с собой: на кондициях ровно
     * тот же скачок называется лучшим известным признаком скорого срыва.
     */
    it('удвоение за неделю — не успех, а разгон', () => {
        const строки = progress.describe({ volume: { current: 2270, previous: 1000 } });

        equal(строки[0].kind, 'watch', текст(строки));
        assert(строки[0].text.includes('127'), текст(строки));
        assert(строки[0].text.includes('разгон'), `и названо своим словом: ${текст(строки)}`);
    });

    it('черта между прибавкой и разгоном названа вслух', () => {
        equal(progress.RAMP, 0.5, 'половина сверху за неделю — это отношение 1,5 к прошлой');
    });

});

/*
 * Допуск в сутки заведён нарочно (Р-120), но человек про него не знает: он
 * помнит пропущенный понедельник, а карточка пишет «выполнен полностью».
 */
describe('Сдвиг на сутки называется вслух', () => {

    const DAY = 86400000;
    const пн = new Date(2026, 8, 7).getTime();

    it('день, закрытый соседним, посчитан и назван', () => {
        const дни = [{ day: пн, session: { } }, { day: пн + 2 * DAY, session: { } }];

        // Понедельник пропущен, занимались во вторник; среда своя
        const сделано = new Set([пн + DAY, пн + 2 * DAY]);

        const итог = progress.adherence(дни, сделано, { from: пн - DAY, to: пн + 3 * DAY });

        equal(итог.done, 2, 'допуск в сутки остаётся: сетка не двигается, а человек двигается');
        equal(итог.shifted, 1, 'и сдвинутый день посчитан отдельно');

        const строки = progress.describe({ adherence: итог });

        assert(строки[0].text.includes('Со сдвигом на сутки'), текст(строки));
        assert(строки[0].text.includes('1 день'), текст(строки));
    });

    it('когда всё день в день, про сдвиг не говорится', () => {
        const дни = [{ day: пн, session: { } }, { day: пн + 2 * DAY, session: { } }];
        const сделано = new Set([пн, пн + 2 * DAY]);

        const итог = progress.adherence(дни, сделано, { from: пн - DAY, to: пн + 3 * DAY });

        equal(итог.shifted, 0);

        assert(!progress.describe({ adherence: итог })[0].text.includes('сдвиг'),
            'лишняя оговорка там, где всё совпало, — это шум');
    });
});

describe('Порядок наблюдений', () => {

    it('тело идёт раньше объёма', () => {
        const строки = progress.describe({
            reserve: [{ name: 'Бицепс', verdict: 'harder' }],
            volume: { current: 500, previous: 1000 }
        });

        equal(строки.length, 2);
        assert(строки[0].text.includes('Бицепс'), 'первое меняет сегодняшнюю тренировку, последнее — разговор через месяц');
    });

    it('без данных не говорит ничего', () => {
        equal(progress.describe({}).length, 0,
            '«всё в порядке» от приложения, смотрящего на пять величин, читается как поломка');
    });

});

describe('Окно объёма (Р-73)', () => {

    it('сегодняшний день не сравнивается с полной неделей', () => {
        // Сегодня — тренировочный день, вечер впереди: в текущем окне пусто
        const строки = progress.describe({ volume: { current: 0, previous: 0 } });

        equal(строки.length, 0, 'без прошлой недели сравнивать не с чем');
    });

    it('спад называется только по полным дням', () => {
        const строки = progress.describe({ volume: { current: 900, previous: 1000 } });

        equal(строки.length, 0, 'десятая часть — это колебание, а не спад');
    });

});

/**
 * Способ прибавки назван словами (Р-206).
 *
 * «Можно тяжелее» у приседаний своим весом читалось как «возьмите груз», а
 * груза нет: прибавляют там повторениями.
 */
describe('Способ прибавки в наблюдении', () => {

    it('своим весом — повторениями', () => {
        const [строка] = progress.describe({ reserve: [{ name: 'Приседания', verdict: 'harder', step: 'reps' }] });

        assert(строка.text.includes('прибавить повторения'), строка.text);
        assert(!/резинк|вес/i.test(строка.text.replace('Приседания', '')), `ни резинки, ни веса тут нет: ${строка.text}`);
        equal(строка.action.step, 'reps', 'окно прибавки посчитает по тому же способу');
    });

    it('резинкой — резинкой, снарядом — весом, на время — временем', () => {
        const одна = (name, step) => progress.describe({ reserve: [{ name, verdict: 'harder', step }] })[0].text;

        assert(одна('Бицепс резинка', 'resistance').includes('резинку жёстче'));
        assert(одна('Жим лёжа', 'weight').includes('добавить вес'));
        assert(одна('Планка', 'time').includes('прибавить время'));
    });

    it('способ не назван — снаряд, как и везде в приложении', () => {
        const [строка] = progress.describe({ reserve: [{ name: 'Жим лёжа', verdict: 'harder' }] });

        assert(строка.text.includes('добавить вес'), строка.text);
    });

    it('кардио о прибавке по запасу молчит: повторения в запасе к нему не относятся', () => {
        equal(progress.describe({ reserve: [{ name: 'Бег', verdict: 'harder', step: null }] }).length, 0);
    });
});

/**
 * Прибавка и сон с пульсом не спорят на одном экране (Р-206).
 *
 * Довод «неделя не для прибавки» стоял под строкой с кнопкой «принять
 * прибавку», и нажатие о нём ничего не знало.
 */
describe('Прибавка против восстановления', () => {

    const плохая = progress.recovery({ sleep: 6 * 3600, resting: { now: 58, base: 52, shift: 6, threshold: 3 } });

    it('довод против стоит первым', () => {
        const строки = progress.describe({
            reserve: [{ name: 'Бицепс резинка', verdict: 'harder', step: 'resistance' }],
            recovery: плохая
        });

        assert(строки[0].text.includes('не для прибавки'), текст(строки));
    });

    it('у прибавки в такую неделю нет кнопки, и сказано почему', () => {
        const строки = progress.describe({
            reserve: [{ name: 'Бицепс резинка', verdict: 'harder', step: 'resistance' }],
            recovery: плохая
        });

        const прибавка = строки.find((с) => с.text.includes('Бицепс резинка'));

        equal(прибавка.action, null, 'кнопка правила бы план вопреки доводу над ней');
        assert(прибавка.text.includes('не на этой неделе'), прибавка.text);
    });

    it('один высокий пульс прибавку не отменяет: порознь признаки значат мало', () => {
        const строки = progress.describe({
            reserve: [{ name: 'Бицепс резинка', verdict: 'harder', step: 'resistance' }],
            recovery: progress.recovery({ sleep: 8 * 3600, resting: { now: 58, base: 52, shift: 6, threshold: 3 } })
        });

        const прибавка = строки.find((с) => с.text.includes('Бицепс резинка'));

        equal(прибавка.action?.type, 'harder');
        assert(строки.some((с) => с.text.includes('Пульс покоя выше')), 'но присмотреться стоит');
    });
});

/**
 * Запас своей строкой — не больше двух упражнений (Р-207).
 *
 * Только он рос без меры: по строке на упражнение. Шесть упражнений с
 * большим запасом давали шесть строк, и исполнение плана уезжало под них.
 */
describe('Предел строк запаса', () => {

    const шесть = ['Приседания', 'Отжимания', 'Пресс', 'Планка', 'Выпады', 'Тяга']
        .map((name) => ({ name, verdict: 'harder', step: 'reps' }));

    it('своей строкой — два, остальные одной строкой по именам', () => {
        const строки = progress.describe({ reserve: шесть });

        equal(строки.length, 3, текст(строки));
        assert(строки[0].text.startsWith('Приседания') && строки[1].text.startsWith('Отжимания'), 'первыми — пришедшие первыми');
        assert(['Пресс', 'Планка', 'Выпады', 'Тяга'].every((имя) => строки[2].text.includes(имя)),
            `срезанное без слова читается как «больше ничего нет»: ${строки[2].text}`);
        equal(строки[2].action, undefined, 'у сводной строки кнопки нет — решают на выполнении');
    });

    it('исполнение плана и объём под запасом не теряются', () => {
        const строки = progress.describe({
            reserve: шесть,
            adherence: { planned: 6, done: 2, sessions: 2 },
            volume: { current: 400, previous: 1000 }
        });

        assert(строки.some((с) => с.text.includes('2 из 6')), текст(строки));
        assert(строки.some((с) => с.text.includes('400 против 1000')), текст(строки));
        equal(строки.length, 5);
    });

    it('потерянный запас идёт раньше большого: он про то, что уже тяжело', () => {
        const строки = progress.describe({
            reserve: [
                { name: 'Приседания', verdict: 'harder', step: 'reps' },
                { name: 'Отжимания', verdict: 'harder', step: 'reps' },
                { name: 'Бицепс резинка', verdict: 'easier', step: 'resistance' }
            ]
        });

        assert(строки[0].text.startsWith('Бицепс резинка'), текст(строки));
        assert(строки[2].text.includes('Отжимания'), 'третье ушло в сводную строку');
    });

    it('при двух упражнениях сводной строки нет', () => {
        equal(progress.describe({ reserve: шесть.slice(0, 2) }).length, 2);
    });
});

/**
 * Тема у каждого наблюдения (Р-210): по ней сводка тренеру отбирает ход
 * программы и не дублирует запас, который уже стоит в строке упражнения.
 */
describe('Темы наблюдений', () => {

    it('у каждого наблюдения есть тема', () => {
        const строки = progress.describe({
            reserve: ['А', 'Б', 'В', 'Г'].map((name, i) => ({ name, verdict: i % 2 ? 'harder' : 'easier', step: 'reps' })),
            recovery: progress.recovery({ sleep: 6 * 3600, resting: { now: 58, base: 52, shift: 6, threshold: 3 } }),
            adherence: { planned: 6, done: 2, sessions: 2 },
            volume: { current: 400, previous: 1000 }
        });

        const без = строки.filter((с) => !['reserve', 'recovery', 'adherence', 'volume'].includes(с.topic));

        equal(без.length, 0, `без темы: ${без.map((с) => с.text).join(' | ')}`);
    });

    it('запас — своей темой, и сводные строки тоже', () => {
        const строки = progress.describe({
            reserve: ['А', 'Б', 'В'].map((name) => ({ name, verdict: 'harder', step: 'reps' }))
        });

        equal(строки.map((с) => с.topic), ['reserve', 'reserve', 'reserve']);
    });
});
