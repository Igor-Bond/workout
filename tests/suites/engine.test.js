/**
 * Движок тренировки (§4, §11, §13, §14, §19 ТЗ).
 *
 * Главная проверяемая мысль: план и журнал — разные вещи. Подходы можно
 * записывать в любом порядке, а приложение обязано правильно считать, сколько
 * сделано и что осталось.
 */

import { describe, it, equal, assert } from '../runner.js';
import { engine, STATE } from '../../js/core/engine.js';

const PLAN = [
    { exerciseId: 'бицепс', plannedSets: 3, targetReps: 12, weight: 14 },
    { exerciseId: 'пресс',  plannedSets: 3, targetReps: 20, weight: 0 },
    { exerciseId: 'плечи',  plannedSets: 3, targetReps: 12, weight: 10 }
];

/** Подход в свободном порядке: order — сквозной номер по тренировке. */
const set = (order, exerciseId, setNumber, extra = {}) =>
    ({ id: `s${order}`, order, exerciseId, setNumber, reps: 10, ...extra });

/** Тот самый чередующийся порядок из §3 ТЗ. */
const INTERLEAVED = [
    set(1, 'бицепс', 1, { weight: 14 }),
    set(2, 'пресс',  1),
    set(3, 'бицепс', 2, { weight: 14 }),
    set(4, 'плечи',  1, { weight: 10 }),
    set(5, 'пресс',  2),
    set(6, 'бицепс', 3, { weight: 14 })
];

describe('Прогресс по упражнениям', () => {

    it('считает выполненное против запланированного', () => {
        const rows = engine.progress(PLAN, INTERLEAVED);

        equal(rows.map((r) => `${r.done}/${r.planned}`), ['3/3', '2/3', '1/3']);
    });

    it('различает не начатое, начатое и выполненное', () => {
        const rows = engine.progress(PLAN, INTERLEAVED);

        equal(rows.map((r) => r.state), [STATE.DONE, STATE.ACTIVE, STATE.ACTIVE]);
        equal(engine.progress(PLAN, [])[0].state, STATE.PENDING);
    });

    it('пропущенное упражнение помечено и не мешает остальным', () => {
        const plan = [PLAN[0], { ...PLAN[1], skipped: true }];
        const rows = engine.progress(plan, []);

        equal(rows[1].state, STATE.SKIPPED);
    });

    it('упражнение, добавленное по ходу, попадает в список', () => {
        const sets = [...INTERLEAVED, set(7, 'икры', 1, { weight: 40 })];
        const rows = engine.progress(PLAN, sets);

        equal(rows.length, 4);
        equal(rows[3].exerciseId, 'икры');
        equal(rows[3].state, STATE.EXTRA);
        equal(rows[3].planned, 0);
    });

    it('подходов можно сделать больше, чем в плане', () => {
        const sets = [...INTERLEAVED, set(7, 'бицепс', 4, { weight: 14 })];
        const rows = engine.progress(PLAN, sets);

        equal(`${rows[0].done}/${rows[0].planned}`, '4/3');
        equal(rows[0].state, STATE.DONE, 'перевыполнение — это выполнено, а не ошибка');
    });
});

describe('Прогресс всей тренировки', () => {

    it('складывает подходы по всем упражнениям', () => {
        equal(engine.totals(PLAN, INTERLEAVED), { done: 6, planned: 9 });
    });

    it('нетронутое пропущенное упражнение уходит из знаменателя', () => {
        const plan = [PLAN[0], { ...PLAN[1], skipped: true }, PLAN[2]];

        equal(engine.totals(plan, []).planned, 6, 'иначе прогресс никогда не дойдёт до конца');
    });

    it('подходы, сделанные до пропуска, остаются в знаменателе', () => {
        const plan = [PLAN[0], { ...PLAN[1], skipped: true }, PLAN[2]];
        const totals = engine.totals(plan, INTERLEAVED);

        // Пресс успел получить 2 подхода и был пропущен: 3 + 2 + 3
        equal(totals, { done: 6, planned: 8 });
        assert(totals.done <= totals.planned, 'числитель не должен обгонять знаменатель');
    });

    it('упражнение вне плана добавляется и в знаменатель', () => {
        const sets = [...INTERLEAVED, set(7, 'икры', 1)];
        const totals = engine.totals(PLAN, sets);

        equal(totals, { done: 7, planned: 10 });
    });

    it('перевыполнение не выводит прогресс за сто процентов', () => {
        const full = PLAN.flatMap((p, i) => [1, 2, 3].map((n) => set(i * 3 + n, p.exerciseId, n)));
        const totals = engine.totals(PLAN, [...full, set(10, 'бицепс', 4)]);

        equal(totals, { done: 10, planned: 10 });
    });
});

describe('Подсказка следующего шага', () => {

    it('ведёт по порядку плана', () => {
        equal(engine.nextStep(PLAN, []), { exerciseId: 'бицепс', setNumber: 1, planIndex: 0 });
    });

    it('продолжает начатое упражнение', () => {
        const step = engine.nextStep(PLAN, [set(1, 'бицепс', 1)]);

        equal(step.exerciseId, 'бицепс');
        equal(step.setNumber, 2);
    });

    it('переходит к следующему, когда план упражнения выполнен', () => {
        const sets = [set(1, 'бицепс', 1), set(2, 'бицепс', 2), set(3, 'бицепс', 3)];

        equal(engine.nextStep(PLAN, sets).exerciseId, 'пресс');
    });

    it('перешагивает через пропущенное', () => {
        const plan = [{ ...PLAN[0], skipped: true }, PLAN[1]];

        equal(engine.nextStep(plan, []).exerciseId, 'пресс');
    });

    it('после свободного порядка ведёт к тому, что осталось', () => {
        const step = engine.nextStep(PLAN, INTERLEAVED);

        equal(step.exerciseId, 'пресс', 'бицепс уже выполнен, значит следующий — пресс');
        equal(step.setNumber, 3);
    });

    it('выполненный план заканчивается', () => {
        const full = PLAN.flatMap((p, i) =>
            [1, 2, 3].map((n) => set(i * 3 + n, p.exerciseId, n)));

        equal(engine.nextStep(PLAN, full), null);
        equal(engine.isComplete(PLAN, full), true);
        equal(engine.isComplete(PLAN, INTERLEAVED), false);
    });

    it('пустой план сразу завершён', () => {
        equal(engine.isComplete([], []), true);
    });
});

/*
 * Круг в обычной тренировке — проход по всем упражнениям плана (§16.1,
 * Р-170). По нему считается своя пауза, названная при сборе.
 */
describe('Конец круга', () => {

    const план = [
        { exerciseId: 'A', plannedSets: 3 },
        { exerciseId: 'B', plannedSets: 3 },
        { exerciseId: 'C', plannedSets: 3 }
    ];

    const подходы = (...ids) => ids.map((id, i) => ({ exerciseId: id, order: i + 1 }));

    it('круг кончается на последнем упражнении плана', () => {
        equal(engine.closesRound(план, подходы('A'), 'A'), false);
        equal(engine.closesRound(план, подходы('A', 'B'), 'B'), false);
        equal(engine.closesRound(план, подходы('A', 'B', 'C'), 'C'), true);
    });

    it('и на каждом следующем круге тоже', () => {
        equal(engine.closesRound(план, подходы('A', 'B', 'C', 'A', 'B', 'C'), 'C'), true);
    });

    /*
     * Когда незакрытым осталось одно упражнение, выбор возвращается к нему
     * же — и каждый подход считался бы концом круга, хотя кругов больше нет.
     */
    it('одно упражнение — кругов нет', () => {
        equal(engine.closesRound([{ exerciseId: 'A', plannedSets: 5 }], подходы('A'), 'A'), false);
    });

    it('план закрыт — круга нет: отдыхать уже не перед чем', () => {
        const один = [{ exerciseId: 'A', plannedSets: 1 }, { exerciseId: 'B', plannedSets: 1 }];

        equal(engine.closesRound(один, подходы('A', 'B'), 'B'), false);
    });

    it('упражнения нет в плане — его добавили по ходу', () => {
        equal(engine.closesRound(план, подходы('A'), 'Я'), false);
    });
});

describe('Номера следующего подхода', () => {

    it('сквозной номер продолжает тренировку', () => {
        equal(engine.nextOrder(INTERLEAVED), 7);
        equal(engine.nextOrder([]), 1);
    });

    it('номер внутри упражнения считается отдельно', () => {
        equal(engine.nextSetNumber(INTERLEAVED, 'бицепс'), 4);
        equal(engine.nextSetNumber(INTERLEAVED, 'плечи'), 2);
        equal(engine.nextSetNumber(INTERLEAVED, 'икры'), 1);
    });
});

describe('Предзаполнение полей', () => {

    it('берёт значения последнего подхода этого упражнения', () => {
        const sets = [set(1, 'бицепс', 1, { weight: 14, reps: 12 }), set(2, 'бицепс', 2, { weight: 16, reps: 10 })];

        equal(engine.prefill(PLAN, sets, 'бицепс').weight, 16, 'вес не должен откатываться к плановому');
        equal(engine.prefill(PLAN, sets, 'бицепс').reps, 10);
    });

    it('для первого подхода берёт значения из плана', () => {
        const values = engine.prefill(PLAN, [], 'бицепс');

        equal(values.weight, 14);
        equal(values.reps, 12);
    });

    it('для упражнения вне плана значений нет', () => {
        equal(engine.prefill(PLAN, [], 'икры'), { reps: null, weight: null, duration: null, distance: null });
    });

    /*
     * Довес резинки — свойство снаряда, а не решение на сегодня (Р-86): связка
     * тянет одинаково в понедельник и в пятницу. Подставляется он только
     * первому подходу; дальше ведёт запись, иначе правка посреди тренировки
     * откатывалась бы к постоянному значению.
     */
    it('постоянный довес подставляется первому подходу', () => {
        equal(engine.prefill(PLAN, [], 'икры', { weight: 20 }).weight, 20);

        const sets = [set(1, 'икры', 1, { weight: 25, reps: 30 })];
        equal(engine.prefill(PLAN, sets, 'икры', { weight: 20 }).weight, 25,
            'записанное сильнее постоянного');
    });

    it('план сильнее постоянного довеса', () => {
        equal(engine.prefill(PLAN, [], 'бицепс', { weight: 20 }).weight, 14,
            'вес из плана сказан про этот день');
    });

    it('цель по времени подставляется так же, как повторения', () => {
        const план = [{ exerciseId: 'планка', plannedSets: 2, targetDuration: 45 }];

        equal(engine.prefill(план, [], 'планка').duration, 45,
            'план говорит «Планка 2 × 45» — сорок пять секунд должны стоять в поле');
    });
});

describe('Итоги тренировки', () => {

    const EXERCISES = {
        'бицепс': { name: 'Бицепс', kind: 'weight' },
        'пресс':  { name: 'Пресс',  kind: 'reps' },
        'плечи':  { name: 'Плечи',  kind: 'weight' }
    };

    const summary = () => engine.summarize({
        plan: PLAN, sets: INTERLEAVED, exercises: EXERCISES, durationMs: 3600000
    });

    it('группирует подходы по упражнениям в порядке плана', () => {
        equal(summary().blocks.map((b) => b.name), ['Бицепс', 'Пресс', 'Плечи']);
        equal(summary().blocks[0].sets.length, 3);
    });

    it('упражнение без подходов в итоги не попадает', () => {
        const result = engine.summarize({ plan: PLAN, sets: [set(1, 'бицепс', 1)], exercises: EXERCISES });

        equal(result.blocks.length, 1);
        equal(result.totals.exercises, 1);
    });

    it('считает подходы, повторения и среднее', () => {
        const t = summary().totals;

        equal(t.sets, 6);
        equal(t.reps, 60);
        equal(t.avgReps, 10);
    });

    it('тоннаж считается только по подходам с весом', () => {
        const t = summary().totals;

        // Бицепс 3 × 10 × 14 + плечи 1 × 10 × 10; пресс без веса не участвует
        equal(t.volume, 520);
        equal(t.hasWeight, true);
    });

    it('без единого веса тоннаж не показывается', () => {
        const result = engine.summarize({
            plan: [PLAN[1]], sets: [set(1, 'пресс', 1)], exercises: EXERCISES
        });

        equal(result.totals.volume, 0);
        equal(result.totals.hasWeight, false);
    });

    it('длительность и время на упражнение считаются для своих видов', () => {
        const result = engine.summarize({
            plan: [{ exerciseId: 'планка', plannedSets: 2 }],
            sets: [
                { id: 'a', order: 1, exerciseId: 'планка', setNumber: 1, duration: 60 },
                { id: 'b', order: 2, exerciseId: 'планка', setNumber: 2, duration: 45 }
            ],
            exercises: { 'планка': { name: 'Планка', kind: 'time' } }
        });

        equal(result.blocks[0].duration, 105);
        equal(result.totals.reps, 0, 'у упражнения на время повторений нет');
    });

    it('пустая тренировка не роняет расчёт', () => {
        const result = engine.summarize({});

        equal(result.blocks.length, 0);
        equal(result.totals.avgReps, 0);
    });
});

describe('Круговой обход упражнений', () => {

    /** План из трёх упражнений по три подхода. */
    const plan = [
        { exerciseId: 'жим', plannedSets: 3, skipped: false },
        { exerciseId: 'тяга', plannedSets: 3, skipped: false },
        { exerciseId: 'присед', plannedSets: 3, skipped: false }
    ];

    const подходы = (...ids) => ids.map((exerciseId, i) => ({ exerciseId, order: i + 1 }));

    /*
     * Отличие от последовательного обхода в одном: круг уходит с текущего
     * упражнения, даже если его план не закрыт. Так и тренируются: пока
     * отдыхает грудь, работает спина.
     */
    it('уходит на следующее, не закрыв текущее', () => {
        equal(engine.nextCircuit(plan, подходы('жим'), 'жим').exerciseId, 'тяга');
        equal(engine.nextStep(plan, подходы('жим')).exerciseId, 'жим',
            'а последовательный остаётся — в этом и разница');
    });

    it('замыкается на начало плана', () => {
        equal(engine.nextCircuit(plan, подходы('жим', 'тяга', 'присед'), 'присед').exerciseId, 'жим');
    });

    it('закрытые упражнения пропускаются', () => {
        const sets = подходы('жим', 'жим', 'жим', 'тяга');

        equal(engine.nextCircuit(plan, sets, 'тяга').exerciseId, 'присед');
        equal(engine.nextCircuit(plan, sets, 'присед').exerciseId, 'тяга',
            'жим закрыт, круг перешагивает через него');
    });

    it('пропущенные тоже', () => {
        const свой = plan.map((p) => (p.exerciseId === 'тяга' ? { ...p, skipped: true } : p));

        equal(engine.nextCircuit(свой, подходы('жим'), 'жим').exerciseId, 'присед');
    });

    /*
     * Круг из одного упражнения — это оно само, а не пустота: иначе после
     * подхода приложение уводило бы взгляд в никуда.
     */
    it('возвращается к текущему, когда открытых больше нет', () => {
        const sets = подходы('жим', 'тяга', 'тяга', 'тяга', 'присед', 'присед', 'присед');

        equal(engine.nextCircuit(plan, sets, 'жим').exerciseId, 'жим');
    });

    it('закрытый план круга не даёт', () => {
        const все = подходы(...Array(9).fill(0).flatMap((_, i) =>
            ['жим', 'тяга', 'присед'][i % 3]));

        equal(engine.nextCircuit(plan, все, 'жим'), null);
    });

    it('упражнение вне плана начинает круг с начала', () => {
        equal(engine.nextCircuit(plan, подходы('добавленное'), 'добавленное').exerciseId, 'жим');
    });

    it('пустой план круга не даёт', () => {
        equal(engine.nextCircuit([], [], null), null);
    });
});

/**
 * Тот же день и порядок по истории (§11.3, §15, Р-219).
 *
 * Приложение не помнило, как человек вёл этот день: порядок стартовал по кругу
 * каждый раз, а «прошлый раз» брался из тренировки того же типа — то есть
 * субботней вместо понедельничной.
 */
describe('Состав тренировки и порядок по истории', () => {

    const шаг = (exerciseId, order) => ({ exerciseId, order, performedAt: order * 1000 });
    const ряд = (...ids) => ids.map((id, i) => шаг(id, i + 1));
    const день = (id, ids, extra = {}) => ({
        id, status: 'done', startedAt: 1000, plan: ids.map((exerciseId) => ({ exerciseId })), ...extra
    });

    it('состав — это набор упражнений, без чисел и без порядка', () => {
        equal(engine.composition([{ exerciseId: 'б' }, { exerciseId: 'а' }]), engine.composition([{ exerciseId: 'а' }, { exerciseId: 'б' }]));
        assert(engine.composition([{ exerciseId: 'а' }]) !== engine.composition([{ exerciseId: 'а' }, { exerciseId: 'б' }]));
        equal(engine.composition([]), '');
    });

    it('тот же день — последняя завершённая тренировка с тем же составом', () => {
        const сейчас = день('сейчас', ['а', 'б']);
        const тренировки = [
            день('давно', ['а', 'б'], { startedAt: 1000 }),
            день('недавно', ['б', 'а'], { startedAt: 5000 }),
            день('другая', ['а', 'в'], { startedAt: 9000 }),
            день('идёт', ['а', 'б'], { startedAt: 9500, status: 'active' }),
            день('удалена', ['а', 'б'], { startedAt: 9800, deletedAt: 1 }),
            сейчас
        ];

        equal(engine.sameDay(сейчас, тренировки)?.id, 'недавно', 'порядок упражнений в плане день не меняет');
    });

    it('рабочая сравнивается с рабочей, а зарядка — с зарядкой', () => {
        const фон = (w) => w.type === 'Зарядка';
        const утро = день('утро', ['а', 'б'], { startedAt: 9000, type: 'Зарядка' });
        const вечер = день('вечер', ['а', 'б'], { startedAt: 2000 });

        equal(engine.sameDay(день('сейчас', ['а', 'б']), [утро, вечер], { background: фон })?.id, 'вечер',
            'утренняя зарядка дневной работе не ориентир');

        equal(engine.sameDay(день('сейчас', ['а', 'б'], { type: 'Зарядка' }), [утро, вечер], { background: фон })?.id, 'утро',
            'а зарядке ориентир — прошлая зарядка');
    });

    it('без состава и без такой же тренировки — null', () => {
        equal(engine.sameDay(день('х', []), [день('у', ['а'])]), null);
        equal(engine.sameDay(день('х', ['а']), [день('у', ['б'])]), null);
    });

    it('упражнения одно за другим — «по одному»', () => {
        equal(engine.sequenceOf(ряд('а', 'а', 'а', 'б', 'б', 'б', 'в', 'в', 'в')), 'linear');
    });

    it('с возвратами — по кругу', () => {
        equal(engine.sequenceOf(ряд('а', 'б', 'а', 'б', 'а', 'б')), 'circuit');
    });

    it('так, как шли отжимания в октябре: 4 + 4 + 4 — по одному', () => {
        equal(engine.sequenceOf(ряд('н', 'н', 'н', 'н', 'у', 'у', 'у', 'у', 'о', 'о', 'о', 'о')), 'linear');
    });

    it('порядок берётся по номеру подхода, а не по тому, как записи лежат в базе', () => {
        const вразброс = [...ряд('а', 'а', 'б', 'б')].reverse();

        equal(engine.sequenceOf(вразброс), 'linear');
    });

    it('выводить не из чего — null: одно упражнение или по одному подходу', () => {
        equal(engine.sequenceOf(ряд('а', 'а', 'а')), null);
        equal(engine.sequenceOf(ряд('а', 'б', 'в')), null, 'по одному подходу круг от «по одному» не отличить');
        equal(engine.sequenceOf([]), null);
    });

    it('удалённые подходы порядка не меняют', () => {
        const подходы = [...ряд('а', 'а', 'б', 'б'), { exerciseId: 'а', order: 2.5, performedAt: 2500, deletedAt: 1 }];

        equal(engine.sequenceOf(подходы), 'linear');
    });
});

/**
 * Прошлый раз поднимает число в поле, но не опускает (§10.2, §15, Р-220).
 *
 * Человек сделал в субботу больше плана — двадцать приседаний вместо
 * пятнадцати, планку дольше, — а на следующий раз поле снова просило
 * пятнадцать и добавлять приходилось руками.
 */
describe('Предзаполнение: память прошлого раза', () => {

    const план = [{ exerciseId: 'приседы', plannedSets: 3, targetReps: 15 }];
    const планка = [{ exerciseId: 'планка', plannedSets: 3, targetDuration: 45 }];

    it('прошлый раз выше плана — в поле прошлое число', () => {
        equal(engine.prefill(план, [], 'приседы', { прошлый: { reps: 20 } }).reps, 20);
    });

    it('прошлый раз ниже плана — остаётся план: опускать решает кнопка, а не память', () => {
        equal(engine.prefill(план, [], 'приседы', { прошлый: { reps: 10 } }).reps, 15);
    });

    it('прошлый раз равен плану — план', () => {
        equal(engine.prefill(план, [], 'приседы', { прошлый: { reps: 15 } }).reps, 15);
    });

    it('у планки так же: секунды прошлого раза выше плана встают в поле', () => {
        equal(engine.prefill(планка, [], 'планка', { прошлый: { duration: 60 } }).duration, 60);
        equal(engine.prefill(планка, [], 'планка', { прошлый: { duration: 30 } }).duration, 45);
    });

    it('в плане цели нет — прошлый раз и есть ориентир', () => {
        const без = [{ exerciseId: 'приседы', plannedSets: 3, targetReps: null }];

        equal(engine.prefill(без, [], 'приседы', { прошлый: { reps: 12 } }).reps, 12);
        equal(engine.prefill([], [], 'приседы', { прошлый: { reps: 12 } }).reps, 12);
    });

    it('прошлого раза нет или в нём нули — план как был', () => {
        equal(engine.prefill(план, [], 'приседы', {}).reps, 15);
        equal(engine.prefill(план, [], 'приседы', { прошлый: {} }).reps, 15);
        equal(engine.prefill(план, [], 'приседы', { прошлый: { reps: 0 } }).reps, 15);
        equal(engine.prefill(план, [], 'приседы', { прошлый: { reps: null } }).reps, 15);
    });

    it('внутри тренировки ведёт последний подход этой же тренировки, а не прошлый раз', () => {
        const sets = [set(1, 'приседы', 1, { reps: 17 })];

        equal(engine.prefill(план, sets, 'приседы', { прошлый: { reps: 25 } }).reps, 17);
    });

    it('вес из прошлого раза не подставляется: он ходит за самочувствием, а не по кругу', () => {
        const с_весом = [{ exerciseId: 'бицепс', plannedSets: 3, targetReps: 12, weight: 14 }];

        equal(engine.prefill(с_весом, [], 'бицепс', { прошлый: { reps: 12, weight: 20 } }).weight, 14);
    });
});
