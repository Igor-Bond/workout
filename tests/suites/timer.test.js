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

    it('«плюс» двигает и отсчёт, и настройку', () => своё(90, async () => {
        restTimer.start();
        await press('rest-extend');

        equal(config.get('restSeconds'), 95, 'иначе на каждой паузе пришлось бы нажимать заново');
        assert(restTimer.remaining > 90, `текущий отдых тоже должен вырасти, вышло ${restTimer.remaining}`);
    }));

    it('«минус» тоже', () => своё(90, async () => {
        restTimer.start();
        await press('rest-shorten');

        equal(config.get('restSeconds'), 85);
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

/**
 * Сигнал окончания выкладывается заранее (§16).
 *
 * Раньше звук играли в момент срабатывания, и это не работало дважды: на
 * iPhone контекст, созданный не по нажатию, стартует спящим, а свёрнутому
 * приложению браузер придерживает интервалы, к которым сигнал был привязан.
 */
describe('Сигнал отдыха', () => {

    const Ctx = window.AudioContext || window.webkitAudioContext;

    /** На какие моменты вперёд выложены тоны при таком-то действии. */
    function записать(действие) {
        const было = Ctx.prototype.createOscillator;
        const моменты = [];

        Ctx.prototype.createOscillator = function () {
            const osc = было.call(this);
            const start = osc.start.bind(osc);

            osc.start = (at) => {
                моменты.push(at - this.currentTime);
                return start(at);
            };

            return osc;
        };

        try { действие(); } finally { Ctx.prototype.createOscillator = было; }

        return моменты;
    }

    it('выкладывается на момент окончания, а не играется в конце', () => {
        config.set('restSound', true);

        const моменты = записать(() => запустить(30));
        restTimer.stop();

        assert(моменты.length > 0, 'при запуске отдыха звук должен быть уже выложен');
        assert(Math.abs(моменты[0] - 30) < 1, `первый тон ожидался около 30 с, вышло ${моменты[0]}`);
    });

    /*
     * Выложенное держится на своём сроке и не знает, что отдых продлили.
     * Без переклада сигнал прозвучал бы посреди паузы.
     */
    it('перекладывается при продлении', () => {
        config.set('restSound', true);
        запустить(30);

        const моменты = записать(() => restTimer.extend(60));
        restTimer.stop();

        assert(моменты.length > 0, 'продление обязано переложить сигнал');
        assert(моменты[0] > 80, `после +60 с первый тон ожидался около 90 с, вышло ${моменты[0]}`);
    });

    it('без звука в настройках ничего не выкладывается', () => {
        config.set('restSound', false);

        const моменты = записать(() => запустить(30));
        restTimer.stop();
        config.set('restSound', true);

        equal(моменты.length, 0);
    });
});

/**
 * Громкость сигнала отдыха (§16).
 *
 * Он звучит в тех же условиях, что сигналы интервальной программы, и должен
 * быть слышен так же. Раньше был втрое тише: средний уровень 0,028 против
 * 0,088 у «начали». Ухо слышит средний уровень, а не пик, — и разницу
 * слышало именно такой.
 */
describe('Громкость отдыха', () => {

    it('слышен наравне с сигналами программы и не срезается', async () => {
        const было = window.AudioContext;
        const contexts = [];

        class Offline extends OfflineAudioContext {
            constructor() {
                super(2, 44100 * 3, 44100);
                contexts.push(this);
            }
        }

        window.AudioContext = Offline;

        try {
            config.set('restEnabled', true);
            config.set('restSound', true);

            // Свежий модуль: звуковой контекст он заводит один раз и держит,
            // а нам нужен подменённый
            const { restTimer: fresh } = await import('../../js/core/timer.js?volume');

            fresh.start(1);

            const buffer = await contexts[contexts.length - 1].startRendering();

            let peak = 0;
            let square = 0;
            let count = 0;

            for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
                const data = buffer.getChannelData(channel);

                for (let i = 0; i < data.length; i++) {
                    const value = Math.abs(data[i]);
                    if (value > peak) peak = value;
                    square += value * value;
                    count += 1;
                }
            }

            const rms = Math.sqrt(square / count);

            assert(peak <= 0.95, `пик ${peak.toFixed(2)} — дорожка срежет верхушку`);
            assert(rms >= 0.05, `средний уровень ${rms.toFixed(3)} — тише сигналов программы`);
        } finally {
            window.AudioContext = было;
        }
    });
});
