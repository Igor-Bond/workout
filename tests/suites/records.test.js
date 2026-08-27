/**
 * Прошлый и лучший результат (§15 ТЗ).
 *
 * Главное, что проверяется: правило «лучшего» у каждого вида упражнения своё,
 * и подходы текущей тренировки не участвуют в рекорде, пока она не завершена.
 */

import { describe, it, equal } from '../runner.js';
import { records } from '../../js/core/records.js';

const s = (over) => ({ id: 'x', workoutId: 'w1', order: 1, setNumber: 1, ...over });

describe('Лучший подход: силовое упражнение', () => {

    it('побеждает больший вес', () => {
        const best = records.best([
            s({ weight: 60, reps: 12 }),
            s({ weight: 70, reps: 6 })
        ], 'weight');

        equal(best.weight, 70);
    });

    it('при равном весе побеждают повторения', () => {
        const best = records.best([
            s({ weight: 60, reps: 9 }),
            s({ weight: 60, reps: 11 })
        ], 'weight');

        equal(best.reps, 11);
    });

    it('пустая история рекорда не даёт', () => {
        equal(records.best([], 'weight'), null);
    });
});

describe('Лучший подход: остальные виды', () => {

    it('собственный вес — по повторениям', () => {
        const best = records.best([s({ reps: 15 }), s({ reps: 22 })], 'reps');
        equal(best.reps, 22);
    });

    it('на время — по длительности', () => {
        const best = records.best([s({ duration: 60 }), s({ duration: 95 })], 'time');
        equal(best.duration, 95);
    });

    it('кардио — по дистанции', () => {
        const best = records.best([
            s({ distance: 3000, duration: 900 }),
            s({ distance: 5000, duration: 1800 })
        ], 'distance');

        equal(best.distance, 5000);
    });

    it('при равной дистанции побеждает меньшее время', () => {
        const best = records.best([
            s({ distance: 5000, duration: 1800 }),
            s({ distance: 5000, duration: 1500 })
        ], 'distance');

        equal(best.duration, 1500);
    });

    it('дистанция без отметки времени проигрывает такой же со временем', () => {
        const best = records.best([
            s({ distance: 5000 }),
            s({ distance: 5000, duration: 1800 })
        ], 'distance');

        equal(best.duration, 1800);
    });
});

describe('Текущая тренировка и рекорд', () => {

    const history = [
        s({ id: 'a', workoutId: 'старая', weight: 60, reps: 10 }),
        s({ id: 'b', workoutId: 'текущая', weight: 80, reps: 5 })
    ];

    it('незавершённая тренировка в рекорд не входит', () => {
        equal(records.best(history, 'weight', 'текущая').weight, 60);
    });

    it('после завершения входит наравне со всеми', () => {
        equal(records.best(history, 'weight').weight, 80);
    });
});

describe('Подходы прошлого раза', () => {

    // Так их отдаёт база: свежие первыми
    const newestFirst = [
        s({ id: 'c', workoutId: 'сегодня', order: 2, performedAt: 300, weight: 65, reps: 8 }),
        s({ id: 'b', workoutId: 'сегодня', order: 1, performedAt: 200, weight: 65, reps: 9 }),
        s({ id: 'a2', workoutId: 'вчера', order: 2, performedAt: 120, weight: 60, reps: 8 }),
        s({ id: 'a1', workoutId: 'вчера', order: 1, performedAt: 100, weight: 60, reps: 10 })
    ];

    it('берёт все подходы ближайшей предыдущей тренировки', () => {
        const last = records.lastSession(newestFirst, 'сегодня');

        equal(last.workoutId, 'вчера');
        equal(last.sets.map((x) => x.id), ['a1', 'a2'], 'внутри — по порядку выполнения');
    });

    it('без исключения текущей берёт самую свежую', () => {
        equal(records.lastSession(newestFirst).workoutId, 'сегодня');
    });

    it('первое в жизни упражнение прошлого раза не имеет', () => {
        equal(records.lastSession([], 'сегодня'), null);
        equal(records.lastSession([s({ workoutId: 'сегодня' })], 'сегодня'), null);
    });
});

describe('Отметка нового рекорда', () => {

    const previous = s({ weight: 60, reps: 10 });

    it('отмечается один подход, а не все побившие', () => {
        const workout = [
            s({ id: '1', weight: 65, reps: 8 }),
            s({ id: '2', weight: 65, reps: 9 }),
            s({ id: '3', weight: 65, reps: 7 })
        ];

        equal(records.recordSet(workout, previous, 'weight').id, '2', 'лучший из трёх');
    });

    it('повторение прежнего рекорда рекордом не считается', () => {
        equal(records.recordSet([s({ weight: 60, reps: 10 })], previous, 'weight'), null);
    });

    it('первый в истории подход — сразу рекорд', () => {
        equal(records.recordSet([s({ weight: 40, reps: 5 })], null, 'weight').weight, 40);
    });

    it('пустая тренировка рекорда не даёт', () => {
        equal(records.recordSet([], previous, 'weight'), null);
    });
});

describe('Смена вида упражнения не ломает историю', () => {

    /*
     * Вид упражнения можно поменять в справочнике, а записанные подходы от
     * этого не меняются. Раньше отображение считалось по текущему виду, и
     * силовая история превращалась в «00:00», а рекорд — в ноль.
     */
    const силовые = [
        s({ id: 'a', weight: 60, reps: 10 }),
        s({ id: 'b', weight: 65, reps: 8 })
    ];

    it('заявленный вид уважается, пока данные его подтверждают', () => {
        equal(records.measure(силовые, 'weight'), 'weight');
        equal(records.measure([s({ duration: 60 })], 'time'), 'time');
    });

    it('вид, которому данные не соответствуют, выводится из подходов', () => {
        equal(records.measure(силовые, 'time'), 'weight', 'в подходах нет длительности');
        equal(records.measure([s({ duration: 60 })], 'weight'), 'time');
        equal(records.measure([s({ distance: 5000 })], 'reps'), 'distance');
    });

    it('рекорд не обнуляется после смены вида', () => {
        equal(records.describe(records.best(силовые, 'time'), 'time'), '65 кг × 8');
    });

    it('история не превращается в нули', () => {
        equal(records.describeSession(силовые, 'time'), '60 кг × 10, 65 × 8');
    });

    it('подход показывается по тому, что в нём записано', () => {
        equal(records.describe(s({ reps: 20 }), 'distance'), '20 повт.');
        equal(records.describe(s({ duration: 90 }), 'weight'), '01:30');
    });

    it('пустые подходы вида не меняют', () => {
        equal(records.measure([], 'time'), 'time');
        equal(records.measure([]), 'reps');
    });
});

describe('Разовый максимум', () => {

    it('считается по формуле Эпли', () => {
        equal(Math.round(records.epley(100, 10)), 133);
        equal(records.epley(100, 1), 100 * (1 + 1 / 30));
    });

    it('без веса или повторений не считается', () => {
        equal(records.epley(0, 10), 0);
        equal(records.epley(100, 0), 0);
    });
});

describe('Читаемая запись результата', () => {

    it('силовой подход показывает вес и повторения', () => {
        equal(records.describe(s({ weight: 62.5, reps: 9 }), 'weight'), '62,5 кг × 9');
    });

    it('без веса остаются повторения', () => {
        equal(records.describe(s({ reps: 20 }), 'reps'), '20 повт.');
    });

    it('упражнение на время показывает длительность', () => {
        equal(records.describe(s({ duration: 95 }), 'time'), '01:35');
    });

    it('кардио показывает дистанцию и время', () => {
        equal(records.describe(s({ distance: 5000, duration: 1500 }), 'distance'), '5 км за 25:00');
    });

    it('подходы прошлого раза перечисляются одной строкой', () => {
        const sets = [
            s({ weight: 60, reps: 10 }),
            s({ weight: 60, reps: 9 }),
            s({ weight: 55, reps: 8 })
        ];

        equal(records.describeSession(sets, 'weight'), '60 кг × 10, 60 × 9, 55 × 8');
    });

    it('пустого прошлого раза не бывает', () => {
        equal(records.describeSession([], 'weight'), '—');
    });
});
