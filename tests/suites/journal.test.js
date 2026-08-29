/**
 * Журнал ошибок (§54 ТЗ).
 *
 * Тот редкий код, который обязан работать, когда всё остальное сломано: его
 * зовут из обработчика ошибки, и упасть там — значит потерять и саму ошибку,
 * и то, что о ней собирались рассказать. Поэтому проверяется не только то,
 * что он пишет, но и то, что он молчит при любом мусоре на входе.
 */

import { describe, it, equal, assert } from '../runner.js';
import { journal } from '../../js/core/journal.js';

/** Своё хранилище на время проверки: настоящий журнал трогать незачем. */
function свой(body) {
    const было = localStorage.getItem('wt_errors');
    localStorage.removeItem('wt_errors');

    try {
        return body();
    } finally {
        if (было === null) localStorage.removeItem('wt_errors');
        else localStorage.setItem('wt_errors', было);
    }
}

describe('Журнал ошибок', () => {

    it('записывает сообщение и место', () => свой(() => {
        journal.add(new Error('база не открылась'), 'sess-done');

        const [запись] = journal.list();

        equal(запись.message, 'база не открылась');
        equal(запись.where, 'sess-done');
        assert(запись.at > 0, 'без времени запись бесполезна');
    }));

    /*
     * Цикл, падающий на каждом такте, иначе вытеснил бы из журнала всё
     * остальное за секунду — и заодно скрыл бы то, с чего всё началось.
     */
    it('повтор одной ошибки не плодит записи', () => свой(() => {
        for (let i = 0; i < 5; i++) journal.add(new Error('одно и то же'), 'tick');

        equal(journal.count, 1);
        equal(journal.list()[0].repeats, 5);
    }));

    it('разные ошибки записываются по отдельности', () => свой(() => {
        journal.add(new Error('первая'), 'а');
        journal.add(new Error('вторая'), 'а');
        journal.add(new Error('первая'), 'б');

        equal(journal.count, 3, 'то же сообщение из другого места — другая ошибка');
    }));

    it('старое вытесняется, свежее остаётся', () => свой(() => {
        for (let i = 0; i < journal.LIMIT + 10; i++) journal.add(new Error(`ошибка ${i}`), 'цикл');

        const список = journal.list();

        equal(список.length, journal.LIMIT);
        equal(список[список.length - 1].message, `ошибка ${journal.LIMIT + 9}`, 'последняя должна остаться');
    }));

    /*
     * В обработчик ошибки прилетает что угодно: строка, объект события,
     * отменённое обещание без причины. Разбираться с этим — его работа.
     */
    it('мусор на входе не роняет журнал', () => свой(() => {
        journal.add('просто строка', 'страница');
        journal.add({ message: 'объект с сообщением' }, '');
        journal.add(null);
        journal.add(undefined);
        journal.add({ code: 'quota' }, 'обещание');

        const список = journal.list();

        equal(список.length, 3, 'пустое не записывается, остальное записывается');
        equal(список[2].message, '{"code":"quota"}', 'объект без message записывается содержимым');
    }));

    /*
     * «[object Object]» занимает место и не говорит ничего: отменённое
     * обещание с объектом вместо причины — обычное дело, и потерять его
     * содержимое значит потерять всю ошибку.
     */
    it('объект без сообщения не превращается в «[object Object]»', () => свой(() => {
        journal.add({}, 'обещание');

        equal(journal.list()[0].message, '{}');
    }));

    it('испорченное хранилище читается как пустое', () => свой(() => {
        localStorage.setItem('wt_errors', 'это не JSON');

        equal(journal.list(), [], 'иначе журнал ошибок сам стал бы ошибкой');

        journal.add(new Error('после порчи'), 'а');
        equal(journal.count, 1, 'и продолжает работать');
    }));

    it('очистка убирает всё', () => свой(() => {
        journal.add(new Error('раз'), 'а');
        journal.clear();

        equal(journal.count, 0);
    }));
});
