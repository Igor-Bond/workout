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
