/**
 * Восстановление: сон и пульс покоя (§62 ТЗ).
 *
 * Проверять надо две вещи: что выводы делаются по неделе, а не по одной
 * ночи, и что пропуски остаются пропусками. Часы снимают не каждую ночь, и
 * подставленный вместо пропуска ноль превратил бы обычную неделю в неделю
 * бессонницы — а выглядело бы это так же убедительно, как правда.
 */

import { describe, it, equal, assert } from '../runner.js';
import { recovery } from '../../js/core/recovery.js';
import { icu } from '../../js/services/icu.js';

const DAY = 86400000;
const NOW = new Date(2026, 8, 6, 12).getTime();

/** Ряд замеров: days — [[сон в часах, пульс покоя], ...], свежие первыми. */
function ряд(days) {
    return days.map(([сон, пульс], i) => ({
        date: NOW - i * DAY,
        sleep: сон === null ? null : сон * 3600,
        rhr: пульс ?? null
    }));
}

describe('Сон', () => {

    it('считается средним за неделю', () => {
        const rows = ряд([[7, 52], [8, 52], [6, 52], [7, 52], [7, 52], [7, 52], [7, 52]]);

        equal(Math.round(recovery.sleep(rows, { now: NOW }) / 60), 420, 'ровно семь часов в среднем');
    });

    it('пропуск не считается нулём', () => {
        const rows = ряд([[8, null], [null, null], [8, null]]);

        equal(recovery.sleep(rows, { now: NOW }) / 3600, 8,
            'ночь без замера — это ночь без замера, а не ночь без сна');
    });

    it('старое в окно не попадает', () => {
        const rows = [{ date: NOW - 30 * DAY, sleep: 3600, rhr: 80 }];

        equal(recovery.sleep(rows, { now: NOW }), null);
    });

});

describe('Пульс покоя', () => {

    it('сравнивается с месячной базой', () => {
        const неделя = ряд([[7, 58], [7, 58], [7, 58], [7, 58], [7, 58], [7, 58], [7, 58]]);
        const месяц = Array.from({ length: 21 }, (_, i) => ({ date: NOW - (7 + i) * DAY, sleep: 7 * 3600, rhr: 52 }));

        const итог = recovery.resting([...неделя, ...месяц], { now: NOW });

        equal(итог.now, 58);
        assert(итог.base < 58 && итог.shift > 0, `неделя должна быть выше базы: ${JSON.stringify(итог)}`);
    });

    it('без замеров молчит', () => {
        equal(recovery.resting([], { now: NOW }), null);
    });

});

describe('Что сказано о восстановлении', () => {

    it('называет сон и пульс', () => {
        const строки = recovery.describe(ряд([[7, 52], [7, 52], [7, 52]]), { now: NOW });

        equal(строки.length, 2);
        assert(строки[0].includes('7'), `сон: ${строки[0]}`);
        assert(строки[1].includes('52'), `пульс: ${строки[1]}`);
    });

    it('без данных не говорит ничего', () => {
        equal(recovery.describe([], { now: NOW }).length, 0,
            '«данных нет» в каждом разделе сводки — это шум, а не сведения');
    });

    it('заметный сдвиг пульса называет прежнее значение', () => {
        const неделя = ряд([[7, 60], [7, 60], [7, 60], [7, 60], [7, 60], [7, 60], [7, 60]]);
        const месяц = Array.from({ length: 21 }, (_, i) => ({ date: NOW - (7 + i) * DAY, sleep: 7 * 3600, rhr: 50 }));

        const строки = recovery.describe([...неделя, ...месяц], { now: NOW });

        assert(строки.some((с) => с.includes('обычно')), `сдвиг обязан быть назван: ${строки.join(' | ')}`);
    });

});

describe('Разбор ответа Intervals.icu', () => {

    it('берёт сон, пульс и вариабельность', () => {
        const rows = icu.read([
            { id: '2026-09-05', sleepSecs: 25200, restingHR: 52, hrv: 60, steps: 8000 }
        ]);

        equal(rows.length, 1);
        equal(rows[0].sleep, 25200);
        equal(rows[0].rhr, 52);
        equal(new Date(rows[0].date).getDate(), 5);
    });

    it('пустые дни выбрасывает', () => {
        const rows = icu.read([
            { id: '2026-09-05', sleepSecs: 25200 },
            { id: '2026-09-04' },
            { id: '2026-09-03', restingHR: 0 }
        ]);

        equal(rows.length, 1, 'сервис заводит запись на каждый день, в том числе пустую');
    });

    it('мусор ничего не роняет', () => {
        equal(icu.read(null).length, 0);
        equal(icu.read([{ id: 'не дата', sleepSecs: 100 }]).length, 0);
    });

    it('без ключа обмен не идёт', () => {
        equal(icu.ready('', 'i1'), false);
        equal(icu.ready('key', ''), false);
        equal(icu.ready('key', 'i1'), true);
    });

});
