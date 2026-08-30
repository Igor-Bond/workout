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

/**
 * Удержание кнопки повторяет нажатие (§16).
 *
 * Главная ловушка здесь — перерисовка. Разметка собирается строками и
 * пересобирается целиком после каждого действия, так что кнопка, за которую
 * держатся, заменяется новым узлом. Ссылка на прежний узел после первого же
 * повтора указывала бы в никуда, и удержание срабатывало один раз.
 */
describe('Удержание кнопки', () => {

    /** Кнопка, которая при каждом нажатии пересоздаёт саму себя. */
    function рисовать(counter) {
        const host = document.createElement('div');
        document.body.appendChild(host);

        const draw = () => {
            host.innerHTML = '<button data-action="проба-удержания" data-hold>+</button>';
        };

        actions.on('проба-удержания', () => {
            counter.count += 1;
            draw();
        });

        draw();
        return host;
    }

    it('повторяется, даже когда кнопка перерисовывается', async () => {
        actions.init();

        const counter = { count: 0 };
        const host = рисовать(counter);

        host.querySelector('button').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

        // Два повтора, а не «сколько успеет»: под общей нагрузкой прогона
        // таймеры отстают, и точное число сделало бы проверку гадалкой
        await new Promise((r) => setTimeout(r, 2000));

        const заВремя = counter.count;

        document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 500));

        const после = counter.count;
        host.remove();

        assert(заВремя >= 2, `ожидалось хотя бы два повтора, вышло ${заВремя}`);
        equal(после, заВремя, 'отпустили — повтор прекратился');
    });

    /*
     * Первое повторение отложено: без задержки обычное нажатие срабатывало бы
     * дважды — и подход записался бы дважды.
     */
    it('короткое нажатие повтора не запускает', async () => {
        actions.init();

        const counter = { count: 0 };
        const host = рисовать(counter);
        const button = host.querySelector('button');

        button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 100));
        document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));

        await new Promise((r) => setTimeout(r, 600));
        host.remove();

        equal(counter.count, 0, 'сам pointerdown нажатием не считается — его даёт click');
    });
});
