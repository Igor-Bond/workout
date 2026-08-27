/**
 * Делегирование событий и судьба упавших действий.
 *
 * Проверяется главным образом одно: ошибка в обработчике не должна
 * пропадать. Молча потерянный подход — худшее, что может сделать журнал
 * тренировок, и раньше именно так и было: почти все обработчики
 * асинхронные, а обычный try их отказы не ловит.
 */

import { describe, it, equal, assert } from '../runner.js';
import { actions } from '../../js/core/actions.js';

const wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));

/** Кнопка с действием, которая сама себя убирает после нажатия. */
async function press(action) {
    const btn = document.createElement('button');
    btn.dataset.action = action;
    document.body.appendChild(btn);
    btn.click();
    await wait();
    btn.remove();
}

describe('Обработчики действий', () => {

    it('вызываются по data-action', async () => {
        let вызван = false;
        actions.on('проба-вызова', () => { вызван = true; });

        await press('проба-вызова');
        equal(вызван, true);
    });

    it('получают сам элемент', async () => {
        let получил = null;
        actions.on('проба-элемента', (el) => { получил = el.dataset.action; });

        await press('проба-элемента');
        equal(получил, 'проба-элемента');
    });
});

describe('Упавшее действие', () => {

    it('синхронная ошибка доходит до сообщения', async () => {
        let поймано = null;
        actions.onError((e) => { поймано = e.message; });
        actions.on('проба-синх', () => { throw new Error('синхронно'); });

        await press('проба-синх');
        equal(поймано, 'синхронно');
    });

    it('асинхронная ошибка тоже доходит', async () => {
        let поймано = null;
        actions.onError((e) => { поймано = e.message; });
        actions.on('проба-асинх', async () => { throw new Error('запись не удалась'); });

        await press('проба-асинх');
        equal(поймано, 'запись не удалась',
            'иначе пользователь нажимает «Выполнено», и не происходит ничего');
    });

    it('сообщение получает имя действия', async () => {
        let имя = null;
        actions.onError((e, name) => { имя = name; });
        actions.on('проба-имени', async () => { throw new Error('x'); });

        await press('проба-имени');
        equal(имя, 'проба-имени');
    });

    it('ошибка в самом сообщении ничего не роняет', async () => {
        actions.onError(() => { throw new Error('и тут сломалось'); });
        actions.on('проба-двойной', async () => { throw new Error('первая'); });

        await press('проба-двойной');
        assert(true, 'до этой строки дойти обязаны');
    });

    it('успешное действие сообщения не вызывает', async () => {
        let звали = false;
        actions.onError(() => { звали = true; });
        actions.on('проба-успеха', async () => 'всё хорошо');

        await press('проба-успеха');
        equal(звали, false);
    });
});
