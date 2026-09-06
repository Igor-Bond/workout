/**
 * Запас в подходе и правило прогрессии (§59 ТЗ).
 *
 * Главное, что проверяется: правило срабатывает по двум занятиям подряд и не
 * обрывается о занятие, где человек промолчал. Молчание — не ответ, но и не
 * отрицание: обнуляй ряд на каждом пропуске, и правило не сработает никогда.
 */

import { describe, it, equal, assert } from '../runner.js';
import { reserve, LOW, TARGET, HIGH } from '../../js/core/reserve.js';

/** Занятие: подходы с отметками запаса; null — подход без ответа. */
const занятие = (...rir) => rir.map((r) => (r === null ? { reps: 10 } : { reps: 10, rir: r }));

describe('Запас занятия', () => {

    it('берётся с последнего подхода', () => {
        equal(reserve.of(занятие(HIGH, TARGET, LOW)), LOW);
    });

    it('берётся с последнего отмеченного, а не с последнего вообще', () => {
        equal(reserve.of(занятие(HIGH, TARGET, null, null)), TARGET,
            'молчание не ответ и сказанного не отменяет');
    });

    it('без единой отметки запаса нет', () => {
        equal(reserve.of(занятие(null, null)), null);
        equal(reserve.of([]), null);
    });

    it('мусор за отметку не принимается', () => {
        equal(reserve.of([{ reps: 10, rir: 7 }]), null);
        equal(reserve.of([{ reps: 10, rir: 'много' }]), null);
    });

});

describe('Правило прогрессии', () => {

    it('два занятия подряд с большим запасом — пора тяжелее', () => {
        const итог = reserve.verdict([занятие(TARGET), занятие(HIGH), занятие(HIGH)]);

        equal(итог.verdict, 'harder');
        equal(итог.streak, 2);
    });

    it('одного занятия мало', () => {
        equal(reserve.verdict([занятие(TARGET), занятие(HIGH)]).verdict, null,
            'одно занятие — это самочувствие, а не нагрузка');
    });

    it('два подряд почти до отказа — пора легче', () => {
        equal(reserve.verdict([занятие(LOW), занятие(LOW)]).verdict, 'easier');
    });

    it('смешанный ряд молчит', () => {
        equal(reserve.verdict([занятие(HIGH), занятие(LOW)]).verdict, null);
        equal(reserve.verdict([занятие(TARGET), занятие(TARGET)]).verdict, null,
            'попадание в цель — это не повод что-то менять');
    });

    /*
     * Занятие без отметки пропускается, а не обрывает ряд. Иначе одно
     * забытое нажатие обнуляло бы наблюдение, и правило не срабатывало бы
     * никогда у того, кто отвечает не всегда, — то есть у всех.
     */
    it('занятие без ответа ряд не обрывает', () => {
        const итог = reserve.verdict([занятие(HIGH), занятие(null, null), занятие(HIGH)]);

        equal(итог.verdict, 'harder');
    });

    it('пока ответов меньше двух — молчит и говорит, сколько их', () => {
        const итог = reserve.verdict([занятие(HIGH), занятие(null)]);

        equal(итог.verdict, null);
        equal(итог.seen, 1, 'по этому числу видно, что правило не молчит, а ещё копит');
    });

    it('пустая история молчит', () => {
        equal(reserve.verdict([]).verdict, null);
    });

    it('смотрит на свежие занятия, а не на первые', () => {
        const итог = reserve.verdict([занятие(LOW), занятие(LOW), занятие(HIGH), занятие(HIGH)]);

        equal(итог.verdict, 'harder', 'прошлогодний ряд к сегодняшней резинке отношения не имеет');
    });

});

describe('Повторения после смены сопротивления', () => {

    it('снижаются на пятую часть', () => {
        equal(reserve.lighter(50), 40);
        equal(reserve.lighter(35), 28);
    });

    it('округляются, а не оставляют дробь', () => {
        equal(reserve.lighter(22), 18, 'в подходе не бывает 17,6 повторения');
    });

    it('ниже одного не опускаются', () => {
        equal(reserve.lighter(1), 1);
    });

    it('пустое остаётся пустым', () => {
        equal(reserve.lighter(null), null);
        equal(reserve.lighter(0), null);
        equal(reserve.lighter('много'), null);
    });

});
