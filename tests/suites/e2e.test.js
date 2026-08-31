/**
 * Сквозные проверки (§45.1 ТЗ).
 *
 * Остальные наборы проверяют части по отдельности: движок без базы,
 * хранилище без экранов, экраны без обмена. Здесь проходятся целые
 * пользовательские пути — те, на которых ошибка проявляется только на
 * стыке, а по частям всё выглядит исправным.
 *
 * Сценарии взяты из разбора: тренировка в свободном порядке, прерванная
 * тренировка, отправка в облако, приём чужих изменений вместе с удалением,
 * работа без сети с последующим обменом.
 *
 * Firestore подменяется хранилищем в памяти: настоящая сеть в проверках не
 * нужна, а проверить надо именно свою логику обмена.
 */

import { describe, it, equal, assert } from '../runner.js';
import { dbService } from '../../js/services/db.js';
import { engine } from '../../js/core/engine.js';
import { records } from '../../js/core/records.js';
import { sync } from '../../js/services/sync.js';
import { auth } from '../../js/services/auth.js';
import { config } from '../../js/config.js';
import { migrations } from '../../js/services/migrations.js';

// ================== ОБЛАКО В ПАМЯТИ ==================

/**
 * Подставное хранилище вместо Firestore.
 *
 * Повторяет ровно ту часть API, которой пользуется sync.js: коллекции,
 * запрос по updatedAt, пакетную запись и setDoc. `fail` заставляет его
 * падать — так проверяется поведение без сети.
 */
function fakeCloud() {
    const data = new Map();          // «коллекция» → Map(id → документ)
    const state = { fail: false, reads: 0, writes: 0 };

    // Часы сервера: только растут и с часами устройства не связаны — ровно
    // это свойство и делает границу приёма надёжной
    let serverClock = 1_000_000;

    const collection = (name) => {
        if (!data.has(name)) data.set(name, new Map());
        return data.get(name);
    };

    const guard = () => {
        if (state.fail) throw new Error('нет соединения');
    };

    /** Проставляет серверное время вместо метки-заглушки. */
    const stamp = (value) => {
        const copy = structuredClone(value);
        if (copy.syncedAt?.__server) copy.syncedAt = (serverClock += 1);
        return copy;
    };

    const fs = {
        collection: (_db, _users, _uid, name) => ({ name }),
        doc: (target, ...rest) => (target?.name
            ? { collection: target.name, id: rest[0] }
            : { collection: '__profile__', id: rest.join('/') }),

        query: (ref, ...conditions) => ({ ref, conditions }),
        where: (field, op, value) => ({ field, op, value }),

        serverTimestamp: () => ({ __server: true }),
        Timestamp: { fromMillis: (ms) => ({ toMillis: () => ms }) },

        getDocs: async ({ ref, conditions }) => {
            guard();

            // Документ без отметки сервера обычному отбору невидим — так же,
            // как в настоящем Firestore
            const after = conditions.find((c) => c.field === 'syncedAt')?.value;

            const docs = [...collection(ref.name).values()]
                .filter((d) => !after || (d.syncedAt || 0) > after.toMillis())
                .map((d) => ({ data: () => structuredClone(d) }));

            state.reads += docs.length;
            return { docs };
        },

        setDoc: async (ref, value) => {
            guard();
            state.writes += 1;
            collection(ref.collection).set(ref.id, stamp(value));
        },

        writeBatch: () => {
            const pending = [];
            return {
                set: (ref, value) => pending.push([ref, value]),
                commit: async () => {
                    guard();
                    for (const [ref, value] of pending) {
                        state.writes += 1;
                        collection(ref.collection).set(ref.id, stamp(value));
                    }
                }
            };
        }
    };

    return {
        state,
        ctx: { fs, db: {}, uid: 'проверка' },
        put: (name, record) => collection(name).set(record.id, structuredClone(record)),
        get: (name, id) => collection(name).get(id),
        all: (name) => [...collection(name).values()]
    };
}

/** Включает обмен с подставным облаком и возвращает способ всё вернуть. */
function connect(cloud) {
    const realContext = auth.context;
    const realConfigured = auth.isConfigured;
    const realInit = auth.init;

    auth.context = async () => cloud.ctx;
    auth.isConfigured = () => true;
    auth.init = async () => {};

    const descriptor = Object.getOwnPropertyDescriptor(auth, 'isSignedIn');
    Object.defineProperty(auth, 'isSignedIn', { configurable: true, get: () => true });

    config.set('syncEnabled', true);
    sync.reset();

    return () => {
        auth.context = realContext;
        auth.isConfigured = realConfigured;
        auth.init = realInit;
        Object.defineProperty(auth, 'isSignedIn', descriptor);
        config.set('syncEnabled', false);
        sync.reset();
    };
}

// ================== ПОДГОТОВКА ==================

async function clean() {
    await dbService.open();
    await dbService.wipe();
}

/** Три упражнения, как в обычной силовой тренировке. */
async function threeExercises() {
    return {
        biceps: await dbService.createExercise({ name: 'Бицепс', kind: 'weight', group: 'Руки' }),
        abs: await dbService.createExercise({ name: 'Пресс', kind: 'reps', group: 'Пресс' }),
        shoulders: await dbService.createExercise({ name: 'Плечи', kind: 'weight', group: 'Плечи' })
    };
}

const записать = (workout, exercise, order, setNumber, values) =>
    dbService.addSet({ workoutId: workout.id, exerciseId: exercise.id, order, setNumber, ...values });

/**
 * Ожидание фонового обмена: он запускается без ожидания, и подловить его
 * можно только по следу в подставном облаке.
 *
 * Возвращает управление сразу, как условие сошлось, — а не по истечении
 * срока: иначе каждая такая проверка стоила бы секунды.
 */
async function дождаться(условие, предел = 2000) {
    const срок = Date.now() + предел;

    while (Date.now() < срок) {
        if (условие()) return true;
        await new Promise((resolve) => setTimeout(resolve, 5));
    }

    return false;
}

// ================== СЦЕНАРИИ ==================

describe('Сквозной путь: тренировка в свободном порядке', () => {

    it('от плана до истории и рекордов', async () => {
        await clean();
        const { biceps, abs, shoulders } = await threeExercises();

        const workout = await dbService.createWorkout({
            type: 'Силовая',
            plan: [biceps, abs, shoulders].map((e) => ({
                exerciseId: e.id, plannedSets: 3, targetReps: 10, weight: 14, skipped: false
            }))
        });

        // Тот самый чередующийся порядок из §3 ТЗ
        await записать(workout, biceps, 1, 1, { reps: 12, weight: 14 });
        await записать(workout, abs, 2, 1, { reps: 20 });
        await записать(workout, biceps, 3, 2, { reps: 10, weight: 14 });
        await записать(workout, shoulders, 4, 1, { reps: 12, weight: 10 });
        await записать(workout, abs, 5, 2, { reps: 18 });
        await записать(workout, biceps, 6, 3, { reps: 8, weight: 14 });

        // Прогресс по ходу — то, что видно на экране выполнения
        const sets = await dbService.listSets(workout.id);
        const rows = engine.progress(workout.plan, sets);

        equal(rows.map((r) => `${r.done}/${r.planned}`), ['3/3', '2/3', '1/3']);
        equal(engine.nextStep(workout.plan, sets).exerciseId, abs.id, 'бицепс закрыт, дальше пресс');

        await dbService.finishWorkout(workout.id);

        // История: сводка сошлась с фактом
        const [entry] = await dbService.listWorkoutSummaries();

        equal(entry.workout.id, workout.id);
        equal(entry.sets, 6);
        equal(entry.reps, 80);
        equal(entry.exerciseIds.length, 3);

        // Итоги: порядок упражнений — плановый, подходы — фактические
        const exercises = Object.fromEntries(
            (await dbService.listExercises()).map((e) => [e.id, e])
        );
        const { blocks, totals } = engine.summarize({
            plan: workout.plan, sets, exercises, durationMs: 3600000
        });

        equal(blocks.map((b) => b.name), ['Бицепс', 'Пресс', 'Плечи']);
        equal(totals.sets, 6);
        equal(totals.volume, 14 * 30 + 10 * 12, 'пресс без веса в тоннаж не идёт');

        // Рекорд по упражнению виден сразу после завершения
        const best = records.best(await dbService.listSetsByExercise(biceps.id), 'weight');
        equal(records.describe(best, 'weight'), '14 кг × 12');
    });
});

describe('Сквозной путь: прерванная тренировка', () => {

    it('переживает закрытие приложения и продолжается', async () => {
        await clean();
        const { biceps, abs } = await threeExercises();

        const workout = await dbService.createWorkout({
            type: 'Силовая',
            plan: [
                { exerciseId: biceps.id, plannedSets: 3, targetReps: 10, weight: 14, skipped: false },
                { exerciseId: abs.id, plannedSets: 2, targetReps: 20, weight: 0, skipped: false }
            ]
        });

        await записать(workout, biceps, 1, 1, { reps: 12, weight: 14 });
        await записать(workout, abs, 2, 1, { reps: 20 });

        /*
         * Закрытие приложения: в памяти не остаётся ничего, всё состояние
         * лежит в базе. Поэтому «перезапуск» — это просто чтение заново.
         */
        const restored = await dbService.getActiveWorkout();

        assert(restored, 'незавершённая тренировка обязана найтись');
        equal(restored.id, workout.id);

        const sets = await dbService.listSets(restored.id);
        equal(sets.length, 2, 'записанные подходы на месте');
        equal(sets.map((s) => s.order), [1, 2], 'и в том же порядке');

        // Продолжаем с того места, где остановились
        const next = engine.nextStep(restored.plan, sets);
        equal(next.exerciseId, biceps.id);
        equal(next.setNumber, 2);

        await записать(restored, biceps, engine.nextOrder(sets), next.setNumber, { reps: 10, weight: 14 });
        await dbService.finishWorkout(restored.id);

        equal(await dbService.getActiveWorkout(), null);
        equal((await dbService.listWorkoutSummaries())[0].sets, 3);
    });
});

describe('Сквозной путь: обмен с облаком', () => {

    it('своё уезжает, а активная тренировка остаётся дома', async () => {
        await clean();
        const cloud = fakeCloud();
        const restore = connect(cloud);

        try {
            const { biceps } = await threeExercises();

            const done = await dbService.createWorkout({ type: 'Силовая', plan: [
                { exerciseId: biceps.id, plannedSets: 1, targetReps: 10, weight: 14, skipped: false }
            ]});
            await записать(done, biceps, 1, 1, { reps: 12, weight: 14 });
            await dbService.finishWorkout(done.id);

            // Незавершённая — она уезжать не должна (§39)
            const active = await dbService.createWorkout({ type: 'Кардио', plan: [] });

            const result = await sync.run({ silent: true });

            assert(result.sent > 0, 'что-то должно было уехать');
            equal(cloud.all('workouts').map((w) => w.id), [done.id]);
            equal(cloud.get('workouts', active.id), undefined,
                'активная тренировка живёт только на своём устройстве');

            // Подходы уехали внутри документа тренировки, а не отдельно
            equal(cloud.get('workouts', done.id).sets.length, 1);
            equal(cloud.all('sets').length, 0);

            equal(cloud.all('exercises').length, 3);
        } finally {
            restore();
        }
    });

    /*
     * Отправка по завершении тренировки (§39).
     *
     * Раньше единственным поводом отправить был уход со страницы, и на
     * компьютере тренировка не уезжала никуда: браузер обрывает запросы
     * вместе со страницей. Здесь проверяется, что явного обмена не нужно
     * вовсе — достаточно нажать «Готово».
     */
    it('законченная тренировка уезжает сама, без ухода со страницы', async () => {
        await clean();
        const cloud = fakeCloud();
        const restore = connect(cloud);

        // Ровно та связка, что заведена в main.js
        const отписаться = dbService.onWorkoutFinished(() => sync.now());

        try {
            const { biceps } = await threeExercises();

            const workout = await dbService.createWorkout({ type: 'Силовая', plan: [] });
            await записать(workout, biceps, 1, 1, { reps: 12, weight: 14 });

            equal(cloud.get('workouts', workout.id), undefined, 'пока идёт — дома');

            await dbService.finishWorkout(workout.id);
            await дождаться(() => cloud.get('workouts', workout.id));

            const уехала = cloud.get('workouts', workout.id);

            assert(уехала, 'после «Готово» тренировка должна быть в облаке без всякого ухода');
            equal(уехала.status, 'done');
            equal(уехала.sets.length, 1, 'подходы уехали внутри неё');
        } finally {
            отписаться();
            restore();
        }
    });

    /*
     * Придержка частых поводов. Возвращение в приложение случается при
     * каждом снятии блокировки — за тренировку это два десятка раз, и
     * обмениваться столько же незачем.
     */
    it('частые поводы придерживаются, важный проходит всегда', async () => {
        await clean();
        const cloud = fakeCloud();
        const restore = connect(cloud);

        try {
            await dbService.createExercise({ name: 'Бицепс', kind: 'weight' });

            await sync.run({ silent: true });
            const было = cloud.state.reads;

            sync.now({ notSooner: 60000 });
            await дождаться(() => cloud.state.reads > было, 200);

            equal(cloud.state.reads, было, 'только что обменивались — второй раз незачем');

            // Без придержки повод проходит: так уезжает завершённая тренировка
            sync.now();
            await дождаться(() => cloud.state.reads > было);

            assert(cloud.state.reads > было, 'важный повод придержкой не гасится');
        } finally {
            restore();
        }
    });

    it('второй обмен подряд ничего не отправляет', async () => {
        await clean();
        const cloud = fakeCloud();
        const restore = connect(cloud);

        try {
            const { biceps } = await threeExercises();
            const w = await dbService.createWorkout({ type: 'Силовая', plan: [] });
            await записать(w, biceps, 1, 1, { reps: 10, weight: 20 });
            await dbService.finishWorkout(w.id);

            await sync.run({ silent: true });
            const писалиПосле = cloud.state.writes;

            const second = await sync.run({ silent: true });

            equal(second.sent, 0, 'менять было нечего');
            equal(cloud.state.writes, писалиПосле,
                'и документ профиля впустую не переписывался');
        } finally {
            restore();
        }
    });

    it('чужие изменения приезжают, включая удаление', async () => {
        await clean();
        const cloud = fakeCloud();
        const restore = connect(cloud);

        try {
            const { biceps } = await threeExercises();

            /*
             * Метки времени идут от «сейчас», а не от условных единиц.
             * Обмен забирает только записи новее последнего обмена, а он
             * ставится по текущим часам, — с метками вроде 2000 (это 1970
             * год) чужая запись навсегда осталась бы «старой».
             */
            const t = Date.now();

            const remoteId = dbService.newId();
            cloud.put('workouts', {
                id: remoteId, type: 'Силовая', status: 'done', note: 'с телефона',
                startedAt: t - 3600000, finishedAt: t, plan: [], updatedAt: t + 1000,
                sets: [{ id: dbService.newId(), workoutId: remoteId, exerciseId: biceps.id,
                    order: 1, setNumber: 1, performedAt: t - 3000000, reps: 15, weight: 16,
                    updatedAt: t + 1000 }]
            });

            await sync.run({ silent: true });

            const local = await dbService.getWorkout(remoteId);
            assert(local, 'тренировка с другого устройства должна появиться');
            equal(local.note, 'с телефона');
            equal((await dbService.listSets(remoteId)).length, 1, 'вместе с подходами');
            equal((await dbService.listWorkoutSummaries())[0].sets, 1, 'и со сводкой');

            // На том устройстве её удалили — мягко, с отметкой
            cloud.put('workouts', {
                ...cloud.get('workouts', remoteId),
                deletedAt: t + 2000, updatedAt: t + 2000
            });

            await sync.run({ silent: true });

            equal(await dbService.getWorkout(remoteId), null,
                'удаление обязано доехать, иначе оно бессмысленно');
            equal((await dbService.listWorkoutSummaries()).length, 0);
        } finally {
            restore();
        }
    });

    it('своё удаление уезжает в облако', async () => {
        await clean();
        const cloud = fakeCloud();
        const restore = connect(cloud);

        try {
            const { biceps } = await threeExercises();
            const w = await dbService.createWorkout({ type: 'Силовая', plan: [] });
            await записать(w, biceps, 1, 1, { reps: 10, weight: 20 });
            await dbService.finishWorkout(w.id);

            await sync.run({ silent: true });
            await dbService.deleteWorkout(w.id);
            await sync.run({ silent: true });

            assert(cloud.get('workouts', w.id).deletedAt,
                'иначе на втором устройстве тренировка осталась бы жива');
        } finally {
            restore();
        }
    });
});

describe('Сквозной путь: без сети', () => {

    it('накопленное уезжает после восстановления связи', async () => {
        await clean();
        const cloud = fakeCloud();
        const restore = connect(cloud);

        try {
            const { biceps } = await threeExercises();

            // Сети нет
            cloud.state.fail = true;

            const w = await dbService.createWorkout({ type: 'Силовая', plan: [] });
            await записать(w, biceps, 1, 1, { reps: 10, weight: 20 });
            await dbService.finishWorkout(w.id);

            const failed = await sync.run({ silent: true });

            assert(failed.error, 'обмен без сети обязан честно сообщить об ошибке');
            equal(sync.getLastSync(), 0,
                'метка не сдвигается: иначе неотправленное пропало бы навсегда');
            equal(cloud.all('workouts').length, 0);

            // Тренировка при этом записана: запись в базу от сети не зависит
            equal((await dbService.listWorkoutSummaries()).length, 1);

            // Связь появилась
            cloud.state.fail = false;
            const ok = await sync.run({ silent: true });

            assert(ok.sent > 0);
            equal(cloud.all('workouts').map((x) => x.id), [w.id]);
        } finally {
            restore();
        }
    });
});

describe('Сквозной путь: два устройства с одинаковым справочником', () => {

    /*
     * Базовый справочник кладётся при создании базы, а идентификаторы у
     * записей случайные (§35). Значит на каждом устройстве получается свой
     * набор из тех же тридцати одного упражнения, но с другими
     * идентификаторами, — и обмен, который сводит записи по идентификатору,
     * складывает оба набора вместо того, чтобы их узнать.
     *
     * Пользователь видит справочник, где каждое упражнение дважды, а
     * история разрезана: часть подходов на одном «Жиме лёжа», часть на
     * другом.
     */
    it('одинаковые названия с разных устройств не удваиваются', async () => {
        await clean();
        const cloud = fakeCloud();
        const restore = connect(cloud);

        try {
            const свой = await dbService.createExercise({
                name: 'Жим лёжа', kind: 'weight', group: 'Грудь'
            });

            // Второе устройство завело то же упражнение самостоятельно
            cloud.put('exercises', {
                id: 'второе-устройство',
                name: 'Жим лёжа',
                nameKey: migrations.normalizeName('Жим лёжа'),
                kind: 'weight',
                group: 'Грудь',
                archived: false,
                createdAt: Date.now(),
                updatedAt: Date.now()
            });

            await sync.run({ silent: true });

            const все = await dbService.listExercises({ includeArchived: true });
            const жимы = все.filter((e) => e.name === 'Жим лёжа');

            equal(жимы.length, 1, 'справочник не должен раздваиваться после обмена');

            // Который именно выживет, неважно — важно, что оба устройства
            // решат это одинаково, а одинаково они могут решить только по
            // самому идентификатору
            const ожидаемый = [свой.id, 'второе-устройство'].sort()[0];
            equal(жимы[0].id, ожидаемый, 'выживает меньший идентификатор');

            // Проигравший обязан уехать надгробием: без него второе
            // устройство прислало бы его обратно, и двойник бы вернулся
            const проигравший = [свой.id, 'второе-устройство'].sort()[1];
            assert(cloud.get('exercises', проигравший)?.deletedAt, 'удаление должно уехать в облако');
        } finally {
            restore();
        }
    });
});

describe('Сквозной путь: упражнение, заведённое на другом устройстве', () => {

    it('доезжает целиком, со своим видом, группой и описанием', async () => {
        await clean();
        const cloud = fakeCloud();
        const restore = connect(cloud);

        try {
            const свой = await dbService.createExercise({
                name: 'Тяга верхнего блока', kind: 'weight', group: 'Спина'
            });
            await dbService.updateExercise(свой.id, { howTo: 'Тянуть к груди, лопатки вниз.' });

            await sync.run({ silent: true });

            // Второе устройство: своя пустая база и свои отметки обмена
            await dbService.wipe();
            sync.reset();
            await sync.run({ silent: true });

            const приехало = await dbService.findExerciseByName('Тяга верхнего блока');

            assert(приехало, 'упражнение должно приехать');
            equal(приехало.id, свой.id);
            equal(приехало.kind, 'weight');
            equal(приехало.group, 'Спина');
            equal(приехало.howTo, 'Тянуть к груди, лопатки вниз.', 'описание — часть упражнения, а не настройка устройства');
        } finally {
            restore();
        }
    });

    /*
     * Второе устройство завело своё упражнение с тем же названием — как это
     * и происходит с базовым справочником. После обмена должно остаться одно
     * упражнение, а подходы обоих — на нём.
     */
    it('сходится с одноимённым местным, не теряя ни одного подхода', async () => {
        await clean();
        const cloud = fakeCloud();
        const restore = connect(cloud);

        try {
            const местное = await dbService.createExercise({ name: 'Приседания', kind: 'weight' });

            const w = await dbService.createWorkout({ type: 'Ноги', plan: [] });
            await записать(w, местное, 1, 1, { reps: 10, weight: 80 });
            await dbService.finishWorkout(w.id);

            // Чужое устройство: то же название, другой идентификатор, своя тренировка
            const чужое = {
                id: 'чужое-приседания', name: 'Приседания',
                nameKey: migrations.normalizeName('Приседания'),
                kind: 'weight', group: '', archived: false,
                createdAt: Date.now(), updatedAt: Date.now()
            };
            cloud.put('exercises', чужое);
            cloud.put('workouts', {
                id: 'чужая-тренировка', type: 'Ноги', name: '', templateId: null,
                status: 'done', note: '', startedAt: Date.now() - 3600000,
                finishedAt: Date.now() - 1800000, plan: [], updatedAt: Date.now(),
                sets: [{
                    id: 'чужой-подход', workoutId: 'чужая-тренировка', exerciseId: чужое.id,
                    order: 1, setNumber: 1, reps: 12, weight: 70,
                    performedAt: Date.now() - 3000000, updatedAt: Date.now()
                }]
            });

            const итог = await sync.run({ silent: true });

            const все = await dbService.listExercises({ includeArchived: true });
            const приседания = все.filter((e) => e.name === 'Приседания');

            equal(приседания.length, 1, 'одно упражнение, а не два');
            equal(итог.merged, 1, 'обмен обязан сказать, что сводил двойников');

            const подходы = await dbService.listSetsByExercise(приседания[0].id);
            equal(подходы.length, 2, 'подходы обоих устройств должны сойтись на одном упражнении');

            // История обеих тренировок цела
            equal((await dbService.listWorkoutSummaries()).length, 2);
        } finally {
            restore();
        }
    });
});

describe('Сквозной путь: запись, выложенная позже, чем сделана', () => {

    /*
     * Метка обмена бралась по своим часам — моменту начала синхронизации.
     * Но updatedAt у записи — это когда её изменили, а не когда выложили.
     * Второе устройство могло завести упражнение утром, а выйти на связь
     * вечером: к этому времени наша метка давно перешагнула утро, и запрос
     * «изменённое позже метки» такую запись не вернёт уже никогда.
     *
     * Ровно этот случай и наблюдался: упражнение с компьютера не появлялось
     * на телефоне, «Синхронизировать» на обоих устройствах не помогало, а
     * «Полный обмен заново» — помогал, потому что обнулял метку.
     */
    it('доезжает, хотя изменена раньше нашего прошлого обмена', async () => {
        await clean();
        const cloud = fakeCloud();
        const restore = connect(cloud);

        try {
            // Первый обмен: пустое облако, метка уходит вперёд
            await sync.run({ silent: true });

            // Второе устройство завело упражнение час назад, а выложило сейчас
            cloud.put('exercises', {
                id: 'заведено-раньше',
                name: 'Тяга штанги',
                nameKey: migrations.normalizeName('Тяга штанги'),
                kind: 'weight', group: 'Спина', archived: false,
                createdAt: Date.now() - 3600000,
                updatedAt: Date.now() - 3600000
            });

            await sync.run({ silent: true });

            assert(await dbService.findExerciseByName('Тяга штанги'),
                'иначе упражнение не появится никогда — до полного обмена заново');
        } finally {
            restore();
        }
    });
});
