/**
 * Таймер отдыха (§16 ТЗ).
 *
 * Проверяется только арифметика сдвига: отсчёт ведётся по часам, и ждать
 * его в проверках нечего — а вот укоротить отдых в ноль можно случайно,
 * и тогда отсчёт оборвётся без сигнала там, где ждали кнопку.
 */

import { describe, it, equal, assert } from '../runner.js';
import { restTimer } from '../../js/core/timer.js';
import { config } from '../../js/config.js';

/** Таймер молча не запускается, если отдых выключен в настройках. */
function запустить(seconds) {
    config.set('restEnabled', true);
    return restTimer.start(seconds);
}

describe('Сдвиг отдыха', () => {

    it('плюс продлевает', () => {
        запустить(60);
        const было = restTimer.remaining;

        restTimer.extend(30);

        assert(restTimer.remaining >= было + 29, `ожидалось около ${было + 30}, вышло ${restTimer.remaining}`);
        restTimer.stop();
    });

    it('минус укорачивает', () => {
        запустить(90);
        restTimer.extend(-30);

        assert(restTimer.remaining <= 61 && restTimer.remaining >= 59,
            `ожидалось около 60, вышло ${restTimer.remaining}`);
        restTimer.stop();
    });

    /*
     * Укоротить отдых до нуля — это «Пропустить», но без сигнала и без
     * нажатия на кнопку с этим словом. Пользователь, отнимающий последние
     * секунды, ждёт короткого отдыха, а не оборванного.
     */
    it('в ноль не укорачивает', () => {
        запустить(20);
        restTimer.extend(-30);

        assert(restTimer.running, 'отсчёт должен остаться');
        equal(restTimer.remaining, restTimer.SHORTEST);

        restTimer.stop();
    });

    it('несколько минусов подряд не уводят в минус', () => {
        запустить(60);
        restTimer.extend(-30);
        restTimer.extend(-30);
        restTimer.extend(-30);

        equal(restTimer.remaining, restTimer.SHORTEST);
        restTimer.stop();
    });

    it('остановленный таймер сдвигать нечего', () => {
        restTimer.stop();
        restTimer.extend(30);

        equal(restTimer.running, false, 'иначе кнопка воскрешала бы законченный отдых');
    });
});
