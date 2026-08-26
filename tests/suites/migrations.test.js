/**
 * Перенос истории версии 1 (§37 ТЗ).
 *
 * Проверяется на выдуманных данных того же вида, что писала версия 1.
 * Настоящая история пользователя существует в одном экземпляре, и ронять
 * её ради проверки нельзя.
 */

import { describe, it, equal, assert } from '../runner.js';
import { migrations } from '../../js/services/migrations.js';

// Предсказуемые идентификаторы: результат сравнивается целиком
function counter() {
    let n = 0;
    return () => `id-${++n}`;
}

const RECORD = {
    date: '2026-08-20T18:00:00.000Z',
    type: 'Силовая',
    durationMs: 3600000,
    exercises: [
        { name: 'Жим лёжа', weight: 60, sets: [
            { set: 1, reps: 10, weight: 60 },
            { set: 2, reps: 8,  weight: 60 }
        ] },
        { name: 'Пресс', weight: 0, sets: [
            { set: 1, reps: 20, weight: 0 }
        ] }
    ]
};

describe('Приведение названий', () => {

    it('регистр и «ё» не создают разных упражнений', () => {
        equal(migrations.normalizeName('Жим лёжа'), 'жим лежа');
        equal(migrations.normalizeName('  ЖИМ   ЛЕЖА '), 'жим лежа');
    });

    it('пустое название даёт пустой ключ', () => {
        equal(migrations.normalizeName('   '), '');
        equal(migrations.normalizeName(null), '');
    });
});

describe('Определение вида упражнения', () => {

    it('вес хотя бы в одном подходе делает упражнение силовым', () => {
        equal(migrations.detectKind([{ reps: 10, weight: 0 }, { reps: 8, weight: 40 }]), 'weight');
    });

    it('без веса — собственный вес', () => {
        equal(migrations.detectKind([{ reps: 20, weight: 0 }]), 'reps');
        equal(migrations.detectKind([]), 'reps');
    });
});

describe('Преобразование записи версии 1', () => {

    it('создаёт тренировку, упражнения и подходы', () => {
        const r = migrations.convertV1([RECORD], { newId: counter() });

        equal(r.workouts.length, 1);
        equal(r.exercises.length, 2);
        equal(r.sets.length, 3);
        equal(r.skipped.length, 0);
    });

    it('сквозной порядок подходов отражает фактическое выполнение', () => {
        const r = migrations.convertV1([RECORD], { newId: counter() });

        equal(r.sets.map((s) => s.order), [1, 2, 3]);
        equal(r.sets.map((s) => s.setNumber), [1, 2, 1]);
    });

    it('время подходов разложено по длительности тренировки', () => {
        const r = migrations.convertV1([RECORD], { newId: counter() });
        const start = Date.parse(RECORD.date);

        equal(r.sets[0].performedAt, start);
        equal(r.sets[1].performedAt, start + 1200000);
        equal(r.sets[2].performedAt, start + 2400000);

        // Порядок обязан быть строго возрастающим: на нём держатся рекорды
        assert(r.sets[0].performedAt < r.sets[1].performedAt);
        assert(r.sets[1].performedAt < r.sets[2].performedAt);
    });

    it('нулевой вес не сохраняется', () => {
        const r = migrations.convertV1([RECORD], { newId: counter() });

        equal(r.sets[0].weight, 60);
        equal('weight' in r.sets[2], false, 'у подхода без веса поля быть не должно');
    });

    it('план восстанавливается по фактически выполненному', () => {
        const r = migrations.convertV1([RECORD], { newId: counter() });

        equal(r.workouts[0].plan.map((p) => p.plannedSets), [2, 1]);
        equal(r.workouts[0].plan[0].weight, 60);
        equal(r.workouts[0].status, 'done');
        equal(r.workouts[0].finishedAt - r.workouts[0].startedAt, 3600000);
    });

    it('вид упражнения определяется по его подходам', () => {
        const r = migrations.convertV1([RECORD], { newId: counter() });

        equal(r.exercises.map((e) => e.kind), ['weight', 'reps']);
    });
});

describe('Склейка одинаковых упражнений', () => {

    it('разное написание в разных тренировках даёт одно упражнение', () => {
        const second = {
            date: '2026-08-18T17:00:00.000Z',
            type: 'Силовая',
            durationMs: 1800000,
            exercises: [{ name: 'жим лежа', weight: 55, sets: [{ set: 1, reps: 12, weight: 55 }] }]
        };

        const r = migrations.convertV1([RECORD, second], { newId: counter() });

        equal(r.exercises.length, 2, 'Жим лёжа и Пресс — всего два упражнения');

        const bench = r.exercises.find((e) => e.nameKey === 'жим лежа');
        const benchSets = r.sets.filter((s) => s.exerciseId === bench.id);
        equal(benchSets.length, 3, 'все подходы жима должны быть у одной записи');
    });

    it('уже известное упражнение не создаётся заново', () => {
        const r = migrations.convertV1([RECORD], {
            newId: counter(),
            knownExercises: [{ id: 'существующий', nameKey: 'жим лежа', kind: 'weight' }]
        });

        equal(r.exercises.length, 1, 'создаётся только Пресс');
        equal(r.sets[0].exerciseId, 'существующий');
    });
});

describe('Негодные записи', () => {

    it('запись с неразбираемой датой пропускается', () => {
        const r = migrations.convertV1([{ date: 'мусор', exercises: [] }], { newId: counter() });

        equal(r.workouts.length, 0);
        equal(r.skipped.length, 1);
        equal(r.skipped[0].reason, 'Неразбираемая дата');
    });

    it('тренировка без подходов пропускается', () => {
        const r = migrations.convertV1(
            [{ date: RECORD.date, type: 'Кардио', exercises: [] }],
            { newId: counter() }
        );

        equal(r.workouts.length, 0);
        equal(r.skipped[0].reason, 'Нет ни одного подхода');
    });

    it('годные записи переносятся, несмотря на негодные рядом', () => {
        const r = migrations.convertV1([{ date: 'мусор' }, RECORD], { newId: counter() });

        equal(r.workouts.length, 1);
        equal(r.skipped.length, 1);
    });

    it('пустой и испорченный ввод не роняют перенос', () => {
        equal(migrations.convertV1([], { newId: counter() }).workouts.length, 0);
        equal(migrations.convertV1(null, { newId: counter() }).workouts.length, 0);
    });
});

describe('Чтение хранилища версии 1', () => {

    const fake = (value) => ({ getItem: () => value });

    it('отсутствие ключа даёт пустой массив', () => {
        equal(migrations.readV1(fake(null)), []);
    });

    it('испорченный JSON не роняет запуск', () => {
        equal(migrations.readV1(fake('{не json')), []);
    });

    it('значение не-массив отбрасывается', () => {
        equal(migrations.readV1(fake('{"a":1}')), []);
    });
});
