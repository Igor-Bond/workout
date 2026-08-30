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
import { press } from '../helpers/dom.js';

// Действия отдыха живут на экране выполнения: без импорта их некому
// зарегистрировать, и нажатие ушло бы в пустоту
import '../../js/modules/session.js';

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

/**
 * Границы длительности отдыха (§16).
 *
 * Длительность задаётся из двух мест — из профиля и с выполнения, — и
 * границы у них обязаны быть одни. Разъехавшись, они дали бы отдых, который
 * с одной стороны задать можно, а с другой нельзя.
 */
describe('Границы отдыха', () => {

    it('пустое и мусор — это «не задано», а не ноль', () => {
        for (const value of ['', null, undefined, 0, -30, 'полторы минуты']) {
            equal(restTimer.clamp(value), null, String(value));
        }
    });

    it('слишком короткое поднимается до наименьшего', () => {
        equal(restTimer.clamp(1), restTimer.SHORTEST);
        equal(restTimer.clamp(restTimer.SHORTEST), restTimer.SHORTEST);
    });

    /*
     * Опечатка в поле, где ждут «90», однажды даёт «900» и дальше. Полчаса —
     * граница смысловая: дольше это уже не отдых между подходами.
     */
    it('слишком длинное срезается до получаса', () => {
        equal(restTimer.clamp(99999), restTimer.LONGEST);
        equal(restTimer.LONGEST, 1800);
    });

    it('обычные значения проходят как есть', () => {
        equal(restTimer.clamp(90), 90);
        equal(restTimer.clamp('480'), 480, 'из поля приходит строка');
        equal(restTimer.clamp(600.4), 600, 'дробные секунды округляются');
    });

    /*
     * Ползунок кончался на пяти минутах, и тем, кто тянет тяжёлое, его не
     * хватало: добирать приходилось кнопкой «+30 с» посреди отдыха. Длинный
     * отдых обязан доезжать до самого отсчёта, а не только до настроек.
     */
    it('длинный отдых доходит до отсчёта', () => {
        const было = config.get('restEnabled');

        try {
            config.set('restEnabled', true);
            restTimer.start(restTimer.clamp(600));

            assert(restTimer.running, 'отсчёт должен идти');
            assert(restTimer.remaining > 590, `осталось ${restTimer.remaining} с вместо десяти минут`);
        } finally {
            restTimer.stop();
            config.set('restEnabled', было);
        }
    });
});

/**
 * Длительность отдыха одна на всё приложение (§16).
 *
 * Своя длительность у каждого упражнения была и оказалась ловушкой: человек
 * менял отдых посреди тренировки, следующее упражнение брало своё значение,
 * и выглядело это как «поменял, а оно не поменялось». Теперь значение одно, и
 * правка на выполнении — это правка настройки.
 */
describe('Отдых правится с выполнения', () => {

    /** Своё значение на время проверки: настоящее трогать незачем. */
    async function своё(seconds, body) {
        const былоОтдых = localStorage.getItem('wt_restSeconds');
        const былоВключено = localStorage.getItem('wt_restEnabled');

        config.set('restSeconds', seconds);
        config.set('restEnabled', true);

        try {
            return await body();
        } finally {
            restTimer.stop();

            for (const [key, value] of [['wt_restSeconds', былоОтдых], ['wt_restEnabled', былоВключено]]) {
                if (value === null) localStorage.removeItem(key);
                else localStorage.setItem(key, value);
            }
        }
    }

    it('«+30 с» двигает и отсчёт, и настройку', () => своё(90, async () => {
        restTimer.start();
        await press('rest-extend');

        equal(config.get('restSeconds'), 120, 'иначе на каждой паузе пришлось бы нажимать заново');
        assert(restTimer.remaining > 110, `текущий отдых тоже должен вырасти, вышло ${restTimer.remaining}`);
    }));

    it('«−30 с» тоже', () => своё(90, async () => {
        restTimer.start();
        await press('rest-shorten');

        equal(config.get('restSeconds'), 60);
    }));

    /*
     * Настройка не уходит за границы даже частым нажатием: полторы секунды
     * отдыха — это не отдых, а оборванный отсчёт.
     */
    it('настройка не выходит за границы', () => своё(20, async () => {
        restTimer.start();

        for (let i = 0; i < 5; i++) await press('rest-shorten');

        equal(config.get('restSeconds'), restTimer.SHORTEST);
    }));
});
