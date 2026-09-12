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

    it('колебание в десятую часть — не событие', () => {
        equal(progress.describe({ volume: { current: 1100, previous: 1000 } }).length, 0);
    });

    it('первая неделя не с чем сравнивать', () => {
        equal(progress.describe({ volume: { current: 500, previous: 0 } }).length, 0);
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
