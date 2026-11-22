/**
 * Сколько займёт тренировка (§29.1, §12, Р-225).
 *
 * Человек не знал до начала, час это или полтора: приложение знало и план, и
 * историю, но времени нигде не называло. Цифры ниже — со вторников, понедельников
 * и суббот реального плана: по истории они ходят в пределах нескольких минут, по
 * паузам плана выходят в десять процентов от факта.
 */

import { describe, it, equal, assert } from '../runner.js';
import { duration } from '../../js/core/duration.js';

const MIN = 60000;

/** Завершённая тренировка с этим составом, длившаяся столько-то минут. */
const день = (id, ids, минут, extra = {}) => ({
    id, status: 'done', startedAt: 1000000, finishedAt: 1000000 + минут * MIN,
    plan: ids.map((exerciseId) => ({ exerciseId })), ...extra
});

/** Серия дней, у каждого своё «старше»: чем больше номер, тем свежее. */
const серия = (ids, минуты, extra = {}) => минуты.map((м, i) => день(`д${i}`, ids, м, { startedAt: 1000 + i * 1000, finishedAt: 1000 + i * 1000 + м * MIN, ...extra }));

describe('Длительность тренировки: что считать занятием', () => {

    it('минуты — от начала до конца', () => {
        equal(duration.minutes({ startedAt: 0, finishedAt: 65 * MIN }), 65);
    });

    it('незавершённую, мгновенную и забытую на сутки в счёт не берём', () => {
        equal(duration.minutes({ startedAt: 0, finishedAt: null }), null);
        equal(duration.minutes({ startedAt: 0, finishedAt: 20000 }), null, 'меньше минуты — не тренировка');
        equal(duration.minutes({ startedAt: 0, finishedAt: 24 * 60 * MIN }), null, 'забытое «Завершить» растянуло бы день на сутки');
        equal(duration.minutes(null), null);
    });
});

describe('Длительность по истории', () => {

    it('медиана последних занятий с тем же составом', () => {
        const такие = серия(['а', 'б'], [56, 61, 67, 61, 58]);
        const оценка = duration.fromHistory({ id: 'сейчас', plan: [{ exerciseId: 'а' }, { exerciseId: 'б' }] }, такие);

        equal(минутыОценки(оценка), 61);
        equal([оценка.from, оценка.to], [56, 67]);
        equal(оценка.n, 5);
        equal(оценка.source, 'history');
    });

    it('берутся только последние пять: давнее на ожидание не влияет', () => {
        const такие = серия(['а', 'б'], [120, 120, 60, 61, 62, 60, 61]);

        equal(минутыОценки(duration.fromHistory({ id: 'х', plan: [{ exerciseId: 'а' }, { exerciseId: 'б' }] }, такие)), 61);
    });

    it('другой состав, незавершённая, удалённая и забытая не в счёт', () => {
        const сейчас = { id: 'х', plan: [{ exerciseId: 'а' }, { exerciseId: 'б' }] };

        const такие = [
            ...серия(['а', 'б'], [60, 62]),
            день('другой', ['а', 'в'], 200, { startedAt: 9000, finishedAt: 9000 + 200 * MIN }),
            день('идёт', ['а', 'б'], 300, { status: 'active', startedAt: 9100 }),
            день('удалён', ['а', 'б'], 300, { deletedAt: 1, startedAt: 9200, finishedAt: 9200 + 300 * MIN }),
            день('забыт', ['а', 'б'], 1500, { startedAt: 9300, finishedAt: 9300 + 1500 * MIN })
        ];

        equal(минутыОценки(duration.fromHistory(сейчас, такие)), 61);
    });

    it('зарядка с зарядкой, рабочая с рабочей', () => {
        const фон = (w) => w.type === 'Зарядка';
        const сейчас = { id: 'х', plan: [{ exerciseId: 'а' }] };

        const такие = [
            ...серия(['а'], [8, 9], { type: 'Зарядка' }),
            ...серия(['а'], [58, 60]).map((w, i) => ({ ...w, id: `р${i}` }))
        ];

        equal(минутыОценки(duration.fromHistory(сейчас, такие, { background: фон })), 59, 'утренняя разминка к вечерней работе не ориентир');
    });

    it('истории нет — null', () => {
        equal(duration.fromHistory({ id: 'х', plan: [{ exerciseId: 'а' }] }, []), null);
        equal(duration.fromHistory({ id: 'х', plan: [] }, серия(['а'], [60])), null);
    });
});

describe('Длительность по паузам плана', () => {

    it('работа подхода: повторения по темпу, время — само, минуты — в секундах', () => {
        equal(duration.workSeconds({ reps: 30 }), 60);
        equal(duration.workSeconds({ reps: 80, exercise: { kind: 'time' } }), 80);
        equal(duration.workSeconds({ reps: 90, exercise: { kind: 'time', timeUnit: 'min' } }), 5400);
        equal(duration.workSeconds({}), 0);
    });

    it('«по одному»: подход, пауза, подход — вторник из плана ≈ 68 минут (по факту 56–67)', () => {
        // Махи 6 × 30 и Разведение 6 × 18, пауза 5 минут
        const минут = duration.fromPlan({
            linear: true,
            items: [
                { sets: 6, work: 60, rest: 300 },
                { sets: 6, work: 36, rest: 300 }
            ]
        });

        equal(минут, 68);
    });

    it('круг: пресс делается в паузу сгибания, десять минут — между кругами; понедельник ≈ 68 (по факту 61–69)', () => {
        // Сгибание 6 × 50 (пауза 1 мин) + Пресс 6 × 25, пауза 10 мин
        const минут = duration.fromPlan({
            items: [
                { sets: 6, work: 100, rest: 60 },
                { sets: 6, work: 50, rest: 600 }
            ]
        });

        equal(минут, 68);
    });

    it('если следом дольше, чем пауза, круг идёт по работе, а не по паузе', () => {
        // Пауза первого — секунда; всё остальное считается подряд
        const короткая = duration.fromPlan({ items: [{ sets: 1, work: 60, rest: 1 }, { sets: 1, work: 600, rest: 0 }] });
        const длинная = duration.fromPlan({ items: [{ sets: 1, work: 60, rest: 900 }, { sets: 1, work: 600, rest: 0 }] });

        equal(короткая, 12, '(60+15) + (600+15) = 690 секунд');
        equal(длинная, 16, 'пауза в пятнадцать минут решает: 75 + 900');
    });

    it('суббота: пять упражнений по кругу, пять секунд на переход, три минуты между кругами ≈ 33 (по факту 33–38)', () => {
        const минут = duration.fromPlan({
            roundRest: 180,
            items: [
                { sets: 4, work: 40, rest: 5 },
                { sets: 4, work: 40, rest: 5 },
                { sets: 4, work: 70, rest: 5 },
                { sets: 4, work: 50, rest: 5 },
                { sets: 4, work: 80, rest: 180 }
            ]
        });

        equal(минут, 33);
    });

    it('у упражнений разное число подходов — поздние круги короче', () => {
        const ровно = duration.fromPlan({ items: [{ sets: 6, work: 60, rest: 60 }, { sets: 6, work: 60, rest: 300 }] });
        const короче = duration.fromPlan({ items: [{ sets: 6, work: 60, rest: 60 }, { sets: 4, work: 60, rest: 300 }] });

        assert(короче < ровно, `${короче} < ${ровно}`);
    });

    it('без подходов считать нечего: «Баскетбол» по плану не оценить', () => {
        equal(duration.fromPlan({ items: [{ sets: 0, work: 0, rest: 0 }] }), null);
        equal(duration.fromPlan({ items: [] }), null);
    });

    it('одно упражнение подряд: круг и «по одному» дают то же', () => {
        const items = [{ sets: 4, work: 60, rest: 300 }];

        equal(duration.fromPlan({ items }), duration.fromPlan({ items, linear: true }));
    });
});

describe('Сколько ещё осталось', () => {

    it('с третьего подхода — по темпу: оставшиеся подходы на средний промежуток', () => {
        // Подходы в 0, 5 и 10 минут; осталось девять из двенадцати
        const ещё = duration.remaining({ planned: 12, done: 3, times: [0, 5 * MIN, 10 * MIN] });

        equal(ещё, 45);
    });

    it('круг, где минута и десять чередуются, считается средним промежутком', () => {
        // 0, 1, 11 минут: средний промежуток 5,5 минут; осталось девять
        const ещё = duration.remaining({ planned: 12, done: 3, times: [0, 1 * MIN, 11 * MIN] });

        equal(ещё, 50);
    });

    it('раньше третьего подхода — по прошлым: обычно минус уже прошедшее', () => {
        const ещё = duration.remaining({
            planned: 12, done: 1, times: [0],
            now: 20 * MIN, startedAt: 0, typical: { minutes: 65 }
        });

        equal(ещё, 45);
    });

    it('прошлых нет и темпа нет — молчим', () => {
        equal(duration.remaining({ planned: 12, done: 1, times: [0], now: 20 * MIN, startedAt: 0 }), null);
    });

    it('затянулось дольше обычного — не называем: говорить «осталось ноль» неправда', () => {
        equal(duration.remaining({ planned: 12, done: 1, times: [0], now: 70 * MIN, startedAt: 0, typical: { minutes: 65 } }), null);
    });

    it('всё сделано — молчим', () => {
        equal(duration.remaining({ planned: 12, done: 12, times: [0, 5 * MIN, 10 * MIN] }), null);
    });
});

describe('Длительность словами', () => {

    it('до полутора часов — в минутах, дальше — в часах', () => {
        equal(duration.words(45), '45 мин');
        equal(duration.words(89), '89 мин');
        equal(duration.words(90), '1 ч 30 мин');
        equal(duration.words(120), '2 ч');
    });

    it('по истории: «≈ 65 мин», а широкий разброс — границами', () => {
        equal(duration.label({ source: 'history', minutes: 65, from: 61, to: 69, n: 4 }), '≈ 65 мин');
        equal(duration.label({ source: 'history', minutes: 109, from: 79, to: 117, n: 5 }), 'от 79 до 117 мин',
            'баскетбол то час двадцать, то два: одно число — обещание, которое не сбудется');
    });

    it('одно занятие разбросом не бывает: число, а не границы', () => {
        equal(duration.label({ source: 'history', minutes: 86, from: 86, to: 86, n: 1 }), '≈ 86 мин');
    });

    it('по плану называется иначе: число грубее', () => {
        equal(duration.label({ source: 'plan', minutes: 68 }), '≈ 68 мин по паузам плана');
    });

    it('нет оценки — нет строки', () => {
        equal(duration.label(null), '');
    });
});

// Минуты оценки: оценка может быть null, и тогда проверка должна упасть понятно
function минутыОценки(оценка) {
    assert(оценка, 'оценка есть');

    return оценка.minutes;
}
