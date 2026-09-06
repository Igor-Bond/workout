/**
 * Журнал решений по программе (§64 ТЗ).
 *
 * Проверяется то, ради чего он заведён: порядок (свежее сверху), причина
 * рядом с решением и предел, за которым журнал перестаёт быть журналом.
 */

import { describe, it, equal, assert } from '../runner.js';
import { planJournal, LIMIT } from '../../js/core/journal-plan.js';

const NOW = new Date(2026, 8, 7, 12).getTime();
const DAY = 86400000;

describe('Записи', () => {

    it('свежее впереди старого', () => {
        let журнал = planJournal.add([], { text: 'Первое', at: NOW - DAY });
        журнал = planJournal.add(журнал, { text: 'Второе', at: NOW });

        equal(журнал[0].text, 'Второе', 'вопрос «почему сейчас так» начинается с последнего решения');
    });

    it('пустая запись не заводится', () => {
        equal(planJournal.add([], { text: '   ' }).length, 0);
    });

    it('причина хранится отдельно от решения', () => {
        const [запись] = planJournal.add([], { text: 'Резинка потяжелее', why: 'запас был большой' });

        equal(запись.text, 'Резинка потяжелее');
        equal(запись.why, 'запас был большой');
    });

    it('незнакомый вид становится заметкой', () => {
        equal(planJournal.add([], { text: 'x', kind: 'что-то' })[0].kind, 'note');
    });

    it('журнал не растёт без предела', () => {
        let журнал = [];

        for (let i = 0; i < LIMIT + 5; i++) журнал = planJournal.add(журнал, { text: `Р${i}`, at: NOW + i });

        equal(журнал.length, LIMIT);
        equal(журнал[0].text, `Р${LIMIT + 4}`, 'выпадает старое, а не новое');
    });

    it('запись убирается по своему опознавателю', () => {
        const журнал = planJournal.add(planJournal.add([], { text: 'Первое' }), { text: 'Второе' });
        const остаток = planJournal.remove(журнал, журнал[0].id);

        equal(остаток.length, 1);
        equal(остаток[0].text, 'Первое');
    });

});

describe('Журнал словами', () => {

    const журнал = [
        { id: '1', at: NOW, kind: 'change', text: 'Резинка потяжелее', why: 'три занятия подряд запас большой' },
        { id: '2', at: NOW - DAY, kind: 'plan', text: 'Утверждён план с 07.09.2026', why: '' }
    ];

    const строки = planJournal.describe(журнал, { format: () => 'дата' });

    it('решение и причина в одной строке', () => {
        assert(строки[0].includes('Резинка потяжелее'), строки[0]);
        assert(строки[0].includes('три занятия подряд'), `без причины запись бессмысленна: ${строки[0]}`);
    });

    it('без причины строка остаётся целой', () => {
        assert(строки[1].includes('Утверждён план'));
        assert(!строки[1].includes('()'), `пустых скобок быть не должно: ${строки[1]}`);
    });

    it('в дело идёт не весь журнал', () => {
        const длинный = Array.from({ length: 20 }, (_, i) => ({ id: `${i}`, at: NOW, text: `Р${i}`, why: '' }));

        equal(planJournal.describe(длинный, { limit: 10 }).length, 10);
    });

});
