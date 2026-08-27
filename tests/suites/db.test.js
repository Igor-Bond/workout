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

describe('Уборка давно удалённых записей', () => {

    const DAY = 86400000;

    /** Тренировка с подходом, удалённая указанное количество дней назад. */
    async function buried(daysAgo) {
        const ex = await dbService.createExercise({ name: `Упражнение ${daysAgo}` });
        const w = await dbService.createWorkout({ type: 'Силовая', plan: [] });

        await dbService.addSet({ workoutId: w.id, exerciseId: ex.id, order: 1, setNumber: 1, reps: 10 });
        await dbService.finishWorkout(w.id);
        await dbService.deleteWorkout(w.id);

        // Отодвигаем отметку удаления в прошлое
        const at = Date.now() - daysAgo * DAY;
        await db.workouts.update(w.id, { deletedAt: at });

        for (const key of await db.sets.where('workoutId').equals(w.id).primaryKeys()) {
            await db.sets.update(key, { deletedAt: at });
        }

        return w;
    }

    it('надгробие старше срока убирается совсем', async () => {
        await reset();
        const w = await buried(100);

        await dbService.purgeDeleted({ before: Date.now() - 90 * DAY });

        equal(await db.workouts.get(w.id), undefined, 'записи больше нет физически');
        equal((await db.sets.where('workoutId').equals(w.id).count()), 0, 'подходы тоже убраны');
    });

    it('свежее удаление не трогается', async () => {
        await reset();
        const w = await buried(10);

        await dbService.purgeDeleted({ before: Date.now() - 90 * DAY });

        assert(await db.workouts.get(w.id), 'иначе удаление не доедет до второго устройства');
    });

    it('живые записи не задеваются', async () => {
        await reset();
        const ex = await dbService.createExercise({ name: 'Живое' });

        await dbService.purgeDeleted({ before: Date.now() });

        assert(await dbService.getExercise(ex.id));
    });

    it('нулевая граница ничего не убирает', async () => {
        await reset();
        const w = await buried(1000);

        // Так выглядит «синхронизация включена, но обмена ещё не было»
        equal(await dbService.purgeDeleted({ before: 0 }), {});
        assert(await db.workouts.get(w.id), 'до первого обмена надгробия трогать нельзя');
    });

    it('сообщает, что и сколько убрано', async () => {
        await reset();
        await buried(100);
        await buried(200);

        const removed = await dbService.purgeDeleted({ before: Date.now() - 90 * DAY });

        equal(removed.workouts, 2);
        equal(removed.sets, 2);
    });
});

describe('Слияние упражнений', () => {

    /** Два упражнения-дубля, у каждого своя история. */
    async function pair() {
        await reset();

        const right = await dbService.createExercise({ name: 'Отжимания', kind: 'reps' });
        const typo = await dbService.createExercise({ name: 'Отжымания', kind: 'reps' });

        const w1 = await dbService.createWorkout({ type: 'Дома', plan: [
            { exerciseId: right.id, plannedSets: 2, targetReps: 20, weight: 0, skipped: false }
        ]});
        await dbService.addSet({ workoutId: w1.id, exerciseId: right.id, order: 1, setNumber: 1, reps: 20 });
        await dbService.addSet({ workoutId: w1.id, exerciseId: right.id, order: 2, setNumber: 2, reps: 18 });
        await dbService.finishWorkout(w1.id);

        const w2 = await dbService.createWorkout({ type: 'Дома', plan: [
            { exerciseId: typo.id, plannedSets: 1, targetReps: 25, weight: 0, skipped: false }
        ]});
        await dbService.addSet({ workoutId: w2.id, exerciseId: typo.id, order: 1, setNumber: 1, reps: 25 });
        await dbService.finishWorkout(w2.id);

        return { right, typo, w1, w2 };
    }

    it('подходы переходят к целевому упражнению', async () => {
        const { right, typo } = await pair();

        const result = await dbService.mergeExercises(typo.id, right.id);

        equal(result.sets, 1);
        equal((await dbService.listSetsByExercise(right.id)).length, 3, 'история собралась воедино');
        equal((await dbService.listSetsByExercise(typo.id)).length, 0);
    });

    it('исходное упражнение исчезает из справочника', async () => {
        const { right, typo } = await pair();

        await dbService.mergeExercises(typo.id, right.id);

        equal(await dbService.getExercise(typo.id), null);
        equal((await dbService.listExercises()).map((e) => e.name), ['Отжимания']);
    });

    it('ссылки в планах тренировок переписываются', async () => {
        const { right, typo, w2 } = await pair();

        await dbService.mergeExercises(typo.id, right.id);
        const workout = await dbService.getWorkout(w2.id);

        equal(workout.plan[0].exerciseId, right.id, 'иначе план ссылался бы в пустоту');
    });

    it('ссылки в шаблонах переписываются', async () => {
        const { right, typo } = await pair();
        const tpl = await dbService.saveTemplate({ name: 'Домашняя', items: [
            { exerciseId: typo.id, plannedSets: 3, targetReps: 20, weight: 0 }
        ]});

        const result = await dbService.mergeExercises(typo.id, right.id);

        equal(result.templates, 1);
        equal((await dbService.getTemplate(tpl.id)).items[0].exerciseId, right.id);
    });

    it('в одной тренировке два упражнения сливаются в одну строку плана', async () => {
        const { right, typo } = await pair();

        // Оба попали в одну тренировку — так бывает, если опечатку заметили
        // не сразу и добавили упражнение второй раз
        const w = await dbService.createWorkout({ type: 'Дома', plan: [
            { exerciseId: right.id, plannedSets: 2, targetReps: 20, weight: 0, skipped: false },
            { exerciseId: typo.id, plannedSets: 3, targetReps: 20, weight: 0, skipped: false }
        ]});

        await dbService.mergeExercises(typo.id, right.id);
        const plan = (await dbService.getWorkout(w.id)).plan;

        equal(plan.length, 1, 'две строки об одном упражнении считали бы прогресс дважды');
        equal(plan[0].plannedSets, 5, 'подходы складываются');
    });

    it('перенесённые записи получают новую метку времени', async () => {
        const { right, typo, w2 } = await pair();
        const было = (await dbService.getWorkout(w2.id)).updatedAt;

        await new Promise((r) => setTimeout(r, 5));
        await dbService.mergeExercises(typo.id, right.id);

        assert((await dbService.getWorkout(w2.id)).updatedAt > было,
            'без этого слияние не доедет до других устройств');
    });

    it('упражнение нельзя объединить с самим собой', async () => {
        const { right } = await pair();

        await throws(() => dbService.mergeExercises(right.id, right.id));
    });

    it('несуществующее упражнение не сливается', async () => {
        const { right } = await pair();

        await throws(() => dbService.mergeExercises('нет-такого', right.id));
        await throws(() => dbService.mergeExercises(right.id, 'нет-такого'));
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

    /*
     * Удаление мягкое (§21) и статус не трогает, поэтому брошенная
     * тренировка остаётся «активной» в индексе. Пока удалённые не
     * отсеивались до выбора первой, одна такая закрывала собой все
     * следующие: главный экран не показывал незавершённую, а §18 не
     * замечал, что тренировка уже идёт.
     */
    it('удалённая тренировка не заслоняет собой новую активную', async () => {
        await reset();

        const dropped = await dbService.createWorkout({ type: 'Силовая' });
        await dbService.deleteWorkout(dropped.id);

        equal(await dbService.getActiveWorkout(), null, 'удалённая активной не считается');

        const fresh = await dbService.createWorkout({ type: 'Ноги' });

        equal((await dbService.getActiveWorkout())?.id, fresh.id);
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

describe('Сводка внутри тренировки', () => {

    /*
     * Денормализация опасна ровно одним: сводка расходится с фактом.
     * Поэтому проверяется каждый путь, где подходы меняются.
     */
    async function done(sets = [[10, 60], [8, 60]]) {
        await reset();

        const ex = await dbService.createExercise({ name: 'Жим', kind: 'weight' });
        const workout = await dbService.createWorkout({ type: 'Силовая', plan: [
            { exerciseId: ex.id, plannedSets: sets.length, targetReps: 10, weight: 60, skipped: false }
        ]});

        for (let i = 0; i < sets.length; i++) {
            await dbService.addSet({ workoutId: workout.id, exerciseId: ex.id,
                order: i + 1, setNumber: i + 1, reps: sets[i][0], weight: sets[i][1] });
        }

        await dbService.finishWorkout(workout.id);
        return { ex, workout };
    }

    const entryFor = async (id) =>
        (await dbService.listWorkoutSummaries()).find((e) => e.workout.id === id);

    it('считается при завершении тренировки', async () => {
        const { workout, ex } = await done();
        const saved = await dbService.getWorkout(workout.id);

        equal(saved.summary.sets, 2);
        equal(saved.summary.reps, 18);
        equal(saved.summary.volume, 1080);
        equal(saved.summary.exerciseIds, [ex.id]);
    });

    it('список истории отдаёт её без чтения подходов', async () => {
        const { workout } = await done();
        const entry = await entryFor(workout.id);

        equal({ sets: entry.sets, reps: entry.reps, volume: entry.volume }, { sets: 2, reps: 18, volume: 1080 });
    });

    it('пересчитывается при удалении подхода', async () => {
        const { workout } = await done();
        const [first] = await dbService.listSets(workout.id);

        await dbService.deleteSet(first.id);
        const entry = await entryFor(workout.id);

        equal(entry.sets, 1, 'иначе история и итоги той же тренировки разошлись бы');
        equal(entry.reps, 8);
        equal(entry.volume, 480);
    });

    it('переживает перенос версии 1 и загрузку копии', async () => {
        await reset();

        const ex = await dbService.createExercise({ name: 'Отжимания', kind: 'reps' });
        const id = dbService.newId();

        await dbService.bulkImport({
            workouts: [{ id, type: 'Дома', status: 'done', startedAt: 1000, finishedAt: 2000,
                plan: [], updatedAt: 1000 }],
            sets: [
                { id: dbService.newId(), workoutId: id, exerciseId: ex.id, order: 1, setNumber: 1, reps: 20, updatedAt: 1000 },
                { id: dbService.newId(), workoutId: id, exerciseId: ex.id, order: 2, setNumber: 2, reps: 18, updatedAt: 1000 }
            ]
        });

        const entry = await entryFor(id);

        equal(entry.sets, 2);
        equal(entry.reps, 38);
    });

    it('считается для тренировки, пришедшей из облака', async () => {
        await reset();

        const id = dbService.newId();
        await dbService.applyRemoteWorkout(
            { id, type: 'Силовая', status: 'done', startedAt: 1000, finishedAt: 2000, plan: [], updatedAt: 1000 },
            [{ id: dbService.newId(), workoutId: id, exerciseId: 'e1', order: 1, setNumber: 1, reps: 12, weight: 50, updatedAt: 1000 }]
        );

        const entry = await entryFor(id);

        equal(entry.sets, 1);
        equal(entry.volume, 600, 'сводка считается на месте, а не берётся из облака');
    });

    it('после объединения упражнений ссылается на целевое', async () => {
        const { workout, ex } = await done();
        const target = await dbService.createExercise({ name: 'Жим лёжа', kind: 'weight' });

        await dbService.mergeExercises(ex.id, target.id);
        const entry = await entryFor(workout.id);

        equal(entry.exerciseIds, [target.id], 'иначе история показывала бы исчезнувшее упражнение');
        equal(entry.sets, 2, 'подходы при этом никуда не делись');
    });

    it('удалённые подходы в сводку не попадают', async () => {
        const { workout } = await done([[10, 60], [8, 60], [6, 60]]);
        const sets = await dbService.listSets(workout.id);

        await dbService.deleteSet(sets[0].id);
        await dbService.deleteSet(sets[1].id);

        equal((await entryFor(workout.id)).sets, 1);
    });

    it('тренировка без подходов даёт нули, а не отсутствие сводки', async () => {
        await reset();

        const workout = await dbService.createWorkout({ type: 'Силовая', plan: [] });
        await dbService.finishWorkout(workout.id);

        const saved = await dbService.getWorkout(workout.id);
        equal(saved.summary, { sets: 0, reps: 0, volume: 0, exerciseIds: [] });
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
