/**
 * Сервис хранилища (§33–§37 ТЗ).
 *
 * Работает на отдельной базе: имя подменяется в tests/index.html до первого
 * импорта db.js. Настоящий справочник и история при запуске проверок не
 * затрагиваются.
 */

import { describe, it, equal, assert, throws } from '../runner.js';
import { db, dbService } from '../../js/services/db.js';
import { migrations } from '../../js/services/migrations.js';

/** Чистая база перед каждой проверкой: порядок наборов не должен влиять. */
async function reset() {
    await dbService.open();
    await dbService.wipe();
}

/** Базовый справочник кладётся событием populate, при wipe он пропадает. */
async function withBaseExercises() {
    const now = Date.now();

    await db.exercises.bulkAdd(migrations.BASE_EXERCISES.map((e) => ({
        id: dbService.newId(),
        name: e.name,
        nameKey: migrations.normalizeName(e.name),
        kind: e.kind,
        group: e.group,
        archived: false,
        createdAt: now,
        updatedAt: now
    })));
}

describe('Идентификаторы', () => {

    it('уникальны и имеют вид UUID', () => {
        const ids = new Set(Array.from({ length: 500 }, () => dbService.newId()));

        equal(ids.size, 500);
        assert(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test([...ids][0]),
            'идентификатор должен быть UUID');
    });
});

describe('Справочник упражнений', () => {

    it('упражнение находится по названию в любом написании', async () => {
        await reset();
        await dbService.createExercise({ name: 'Жим лёжа', kind: 'weight' });

        assert(await dbService.findExerciseByName('жим лежа'), 'должно находиться без «ё» и в нижнем регистре');
        assert(await dbService.findExerciseByName('  ЖИМ  ЛЁЖА '), 'лишние пробелы не должны мешать');
    });

    it('ensureExercise не плодит одинаковые записи', async () => {
        await reset();

        const first = await dbService.ensureExercise({ name: 'Приседания' });
        const second = await dbService.ensureExercise({ name: 'приседания' });

        equal(first.id, second.id);
        equal((await dbService.listExercises()).length, 1);
    });

    it('переименование обновляет ключ поиска', async () => {
        await reset();
        const created = await dbService.createExercise({ name: 'Жим' });

        await dbService.updateExercise(created.id, { name: 'Жим стоя' });

        assert(await dbService.findExerciseByName('жим стоя'), 'должно находиться по новому названию');
        equal(await dbService.findExerciseByName('Жим'), null, 'по старому названию находиться не должно');
    });

    it('название без содержимого не принимается', async () => {
        await reset();
        await throws(() => dbService.createExercise({ name: '   ' }));
    });

    it('архивное упражнение остаётся в базе, но исчезает из списка', async () => {
        await reset();
        const created = await dbService.createExercise({ name: 'Планка', kind: 'time' });

        await dbService.setExerciseArchived(created.id, true);

        equal((await dbService.listExercises()).length, 0);
        equal((await dbService.listExercises({ includeArchived: true })).length, 1);
        assert(await dbService.getExercise(created.id), 'запись обязана остаться — на неё ссылается история');
    });

    it('упражнение из истории удалить нельзя', async () => {
        await reset();
        const created = await dbService.createExercise({ name: 'Тяга' });
        const workout = await dbService.createWorkout({ type: 'Силовая' });

        await dbService.addSet({
            workoutId: workout.id, exerciseId: created.id,
            order: 1, setNumber: 1, reps: 10, weight: 50
        });

        await throws(() => dbService.deleteExercise(created.id),
            'удаление использованного упражнения разорвало бы историю');
    });

    it('неиспользованное упражнение удаляется', async () => {
        await reset();
        const created = await dbService.createExercise({ name: 'Лишнее' });

        await dbService.deleteExercise(created.id);
        equal(await dbService.getExercise(created.id), null);
    });

    it('базовый справочник не содержит повторов', async () => {
        await reset();
        await withBaseExercises();

        const all = await dbService.listExercises();
        const keys = new Set(all.map((e) => e.nameKey));

        equal(keys.size, all.length, 'каждое базовое упражнение должно быть уникальным');
    });
});

describe('Тренировки и подходы', () => {

    it('активная тренировка находится и завершается', async () => {
        await reset();
        const workout = await dbService.createWorkout({ type: 'Силовая' });

        assert(await dbService.getActiveWorkout(), 'начатая тренировка должна быть активной');

        await dbService.finishWorkout(workout.id);

        equal(await dbService.getActiveWorkout(), null);
        equal((await dbService.getWorkout(workout.id)).status, 'done');
    });

    it('подходы возвращаются в фактическом порядке выполнения', async () => {
        await reset();
        const bench = await dbService.createExercise({ name: 'Жим' });
        const abs = await dbService.createExercise({ name: 'Пресс', kind: 'reps' });
        const workout = await dbService.createWorkout({ type: 'Силовая' });

        // Чередование упражнений — тот самый свободный порядок из §14
        await dbService.addSet({ workoutId: workout.id, exerciseId: bench.id, order: 1, setNumber: 1, reps: 10, weight: 60 });
        await dbService.addSet({ workoutId: workout.id, exerciseId: abs.id,   order: 2, setNumber: 1, reps: 20 });
        await dbService.addSet({ workoutId: workout.id, exerciseId: bench.id, order: 3, setNumber: 2, reps: 8,  weight: 60 });

        const sets = await dbService.listSets(workout.id);

        equal(sets.map((s) => s.order), [1, 2, 3]);
        equal(sets.map((s) => s.exerciseId), [bench.id, abs.id, bench.id]);
    });

    it('незаполненные величины не сохраняются', async () => {
        await reset();
        const plank = await dbService.createExercise({ name: 'Планка', kind: 'time' });
        const workout = await dbService.createWorkout({});

        await dbService.addSet({
            workoutId: workout.id, exerciseId: plank.id,
            order: 1, setNumber: 1, duration: 60, weight: 0
        });

        const [set] = await dbService.listSets(workout.id);

        equal(set.duration, 60);
        equal('weight' in set, false, 'нулевой вес — это отсутствие величины, а не ноль');
        equal('reps' in set, false);
    });

    it('подходы упражнения отдаются свежими вперёд', async () => {
        await reset();
        const bench = await dbService.createExercise({ name: 'Жим' });
        const workout = await dbService.createWorkout({});

        const base = Date.parse('2026-08-01T10:00:00.000Z');
        for (let i = 0; i < 3; i++) {
            await dbService.addSet({
                workoutId: workout.id, exerciseId: bench.id,
                order: i + 1, setNumber: i + 1, reps: 10 - i, weight: 60,
                performedAt: base + i * 60000
            });
        }

        const sets = await dbService.listSetsByExercise(bench.id);

        equal(sets.map((s) => s.reps), [8, 9, 10], 'последний выполненный подход должен идти первым');
        equal((await dbService.listSetsByExercise(bench.id, { limit: 1 })).length, 1);
    });

    it('удаление тренировки мягкое и уносит её подходы', async () => {
        await reset();
        const bench = await dbService.createExercise({ name: 'Жим' });
        const workout = await dbService.createWorkout({});

        await dbService.addSet({ workoutId: workout.id, exerciseId: bench.id, order: 1, setNumber: 1, reps: 10, weight: 60 });
        await dbService.finishWorkout(workout.id);
        await dbService.deleteWorkout(workout.id);

        equal(await dbService.getWorkout(workout.id), null, 'из приложения тренировка исчезает');
        equal((await dbService.listSets(workout.id)).length, 0, 'её подходы тоже');
        equal((await dbService.listSetsByExercise(bench.id)).length, 0, 'и в рекорды они не попадают');

        // Но физически запись на месте — иначе удаление не доедет до облака
        assert(await db.workouts.get(workout.id), 'запись обязана остаться с отметкой deletedAt');
        assert((await db.workouts.get(workout.id)).deletedAt, 'должна стоять отметка удаления');
    });

    it('у каждой записи есть метка времени изменения', async () => {
        await reset();
        const exercise = await dbService.createExercise({ name: 'Жим' });
        const workout = await dbService.createWorkout({});
        const set = await dbService.addSet({ workoutId: workout.id, exerciseId: exercise.id, order: 1, setNumber: 1, reps: 5 });

        for (const record of [exercise, workout, set]) {
            assert(Number.isFinite(record.updatedAt), 'без updatedAt невозможен обмен с облаком');
        }
    });
});

describe('Разовый перенос версии 1', () => {

    const storage = (value) => ({ getItem: () => value });

    it('переносит историю и отмечает, что уже перенёс', async () => {
        await reset();

        const raw = JSON.stringify([{
            date: '2026-08-20T18:00:00.000Z', type: 'Силовая', durationMs: 1800000,
            exercises: [{ name: 'Жим лёжа', weight: 60, sets: [{ set: 1, reps: 10, weight: 60 }] }]
        }]);

        const summary = await migrations.runV1Import(dbService, storage(raw));

        equal(summary.workouts, 1);
        equal(summary.sets, 1);
        equal((await dbService.listWorkouts()).length, 1);

        // Второй запуск обязан ничего не делать, иначе история удвоится
        equal(await migrations.runV1Import(dbService, storage(raw)), null);
        equal((await dbService.listWorkouts()).length, 1);
    });

    it('переносимое упражнение склеивается с уже имеющимся', async () => {
        await reset();
        await withBaseExercises();

        const before = (await dbService.listExercises()).length;

        const raw = JSON.stringify([{
            date: '2026-08-20T18:00:00.000Z', type: 'Силовая', durationMs: 600000,
            exercises: [{ name: 'жим лежа', weight: 60, sets: [{ set: 1, reps: 10, weight: 60 }] }]
        }]);

        await migrations.runV1Import(dbService, storage(raw));

        equal((await dbService.listExercises()).length, before,
            '«жим лежа» должен найти базовый «Жим лёжа», а не создать второй');
    });

    it('пустое хранилище отмечается как перенесённое', async () => {
        await reset();

        equal(await migrations.runV1Import(dbService, storage(null)), null);
        assert(await dbService.getSetting('v1ImportedAt'), 'проверять localStorage при каждом запуске незачем');
    });
});
