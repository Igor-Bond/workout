/**
 * Единственная точка работы с хранилищем (§33 ТЗ).
 *
 * Остальное приложение обращается только к dbService и не знает, что под ним
 * Dexie. Когда появится синхронизация, менять придётся этот файл, а не
 * десяток модулей.
 *
 * Правила:
 *   - никаких обращений к `db.*` вне этого файла;
 *   - каждая запись получает updatedAt — без него невозможен обмен с облаком;
 *   - удаление мягкое (deletedAt), иначе оно не доедет до других устройств;
 *   - идентификаторы — строковые UUID, а не автоинкремент (§35).
 */

import Dexie from '../../vendor/dexie.min.js';
import { migrations } from './migrations.js';
import { howTo } from './howto.js';
import { i18n, t } from '../core/i18n.js';
import { localizeExercise, canonicalName, canonicalGroup, deliveredHowTo } from '../i18n/exercises.js';

/**
 * Имя базы можно подменить до первого импорта модуля. Нужно ровно одному
 * потребителю — тестам: они обязаны работать в стороне от настоящей истории.
 * Приложение эту переменную не задаёт никогда.
 */
const DB_NAME = globalThis.__WORKOUT_DB__ || 'WorkoutTrackerDB';

export const db = new Dexie(DB_NAME);

db.version(1).stores({
    exercises: 'id, nameKey, kind, updatedAt',
    templates: 'id, name, updatedAt',
    workouts:  'id, startedAt, status, updatedAt',
    sets:      'id, workoutId, exerciseId, performedAt, updatedAt, [workoutId+order], [exerciseId+performedAt]',
    settings:  'key'
});

// Версия 2: вес тела (§26.3). Отдельная таблица, а не поле в тренировке:
// взвешиваются не только в дни занятий, и одно к другому не привязано.
db.version(2).stores({
    exercises: 'id, nameKey, kind, updatedAt',
    templates: 'id, name, updatedAt',
    workouts:  'id, startedAt, status, updatedAt',
    sets:      'id, workoutId, exerciseId, performedAt, updatedAt, [workoutId+order], [exerciseId+performedAt]',
    settings:  'key',
    bodyWeight: 'id, at, updatedAt'
});

/*
 * Версия 3: сводка внутри тренировки (§34.1).
 *
 * Состав таблиц не меняется — меняется содержимое записей, поэтому нужен
 * только upgrade. Он считает сводку для всех уже проведённых тренировок:
 * без этого списки продолжали бы читать подходы целиком.
 */
db.version(3).stores({
    exercises: 'id, nameKey, kind, updatedAt',
    templates: 'id, name, updatedAt',
    workouts:  'id, startedAt, status, updatedAt',
    sets:      'id, workoutId, exerciseId, performedAt, updatedAt, [workoutId+order], [exerciseId+performedAt]',
    settings:  'key',
    bodyWeight: 'id, at, updatedAt'
}).upgrade(async (tx) => {
    const sets = await tx.table('sets').toArray();
    const byWorkout = new Map();

    for (const set of sets) {
        byWorkout.set(set.workoutId, [...(byWorkout.get(set.workoutId) || []), set]);
    }

    // updatedAt намеренно не трогаем: сводка выводится из уже имеющихся
    // подходов, ничего нового пользователь не сделал, и гнать всю историю
    // в облако заново незачем
    await tx.table('workouts').toCollection().modify((workout) => {
        workout.summary = summarize(byWorkout.get(workout.id) || []);
    });

    console.log(`[База] Миграция 3: сводка посчитана для ${byWorkout.size} тренировок.`);
});

/**
 * Базовый справочник кладётся при создании базы, а не при каждом запуске:
 * иначе удалённые пользователем упражнения воскресали бы после перезагрузки.
 *
 * Идентификатор выводится из названия, а не берётся случайным. Случайный
 * означал бы, что на каждом устройстве заводится свой набор тех же самых
 * упражнений, а обмен, сводящий записи по идентификатору, складывает наборы
 * вместо того, чтобы их узнать. Выведенный из названия совпадает у всех.
 */
const baseId = (name) => `base-${migrations.normalizeName(name).replace(/\s+/g, '-')}`;

/**
 * Сколько упражнений было в базовом списке до появления интервальных.
 *
 * У баз, созданных раньше, отметки о доставке нет вовсе, и без этого числа
 * приложение решило бы, что им не доставлено ничего, — и попыталось бы
 * положить весь список заново.
 */
const BASE_BEFORE_INTERVALS = 31;

/*
 * Новая база наполняется на языке первого запуска (§53).
 *
 * Это главный путь для того, кто открывает приложение впервые: справочник
 * кладётся целиком и сразу. Язык к этому моменту уже определён — main.js
 * спрашивает его до того, как открыть базу.
 */
db.on('populate', (tx) => {
    const now = Date.now();

    tx.table('exercises').bulkAdd(migrations.BASE_EXERCISES.map((e) => {
        const local = localizeExercise(e, i18n.lang, howTo(migrations.normalizeName(e.name)));

        return {
            id: baseId(local.name),
            name: local.name,
            nameKey: migrations.normalizeName(local.name),
            kind: e.kind,
            group: local.group,
            howTo: local.howTo || undefined,
            archived: false,
            createdAt: now,
            updatedAt: now
        };
    }));

    // Новой базе список положен целиком — доставлять ей нечего
    tx.table('settings').put({ key: 'baseInstalled', value: migrations.BASE_EXERCISES.length });
});

// ================== ОБЩЕЕ ==================

/**
 * Идентификатор записи. crypto.randomUUID есть во всех браузерах с 2022
 * года, но требует защищённого соединения: по http на телефоне в локальной
 * сети его не будет, а разработка идёт именно так.
 */
function newId() {
    if (globalThis.crypto?.randomUUID) return crypto.randomUUID();

    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Живые записи: удалённые мягко не показываются и не считаются (§36). */
const alive = (record) => !!record && !record.deletedAt;

/**
 * Сводка по тренировке (§34.1).
 *
 * Считается один раз — при завершении тренировки и при любом позднейшем
 * изменении её подходов — и лежит внутри записи. Списку истории, календарю
 * и главному экрану этого достаточно, и они перестают читать подходы:
 * раньше показ любого из них означал полное чтение таблицы.
 *
 * Денормализация опасна ровно одним: сводка может разойтись с фактом.
 * Поэтому пересчёт вызывается отовсюду, где подходы меняются, — при
 * удалении подхода, объединении упражнений, загрузке из копии и приёме
 * тренировки из облака.
 */
function summarize(sets = []) {
    const exerciseIds = new Set();
    let count = 0;
    let reps = 0;
    let volume = 0;

    for (const set of sets) {
        if (set.deletedAt) continue;

        count += 1;
        reps += set.reps || 0;
        if (set.weight) volume += (set.reps || 0) * set.weight;
        exerciseIds.add(set.exerciseId);
    }

    return { sets: count, reps, volume, exerciseIds: [...exerciseIds] };
}

/** Полночь дня, которому принадлежит момент. Вес тела хранится по дням. */
function startOfDay(ts) {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

export const dbService = {

    newId,

    /** Готова ли база к работе. */
    async open() {
        if (!db.isOpen()) await db.open();
        return db;
    },

    // ================== УПРАЖНЕНИЯ (§5) ==================

    async listExercises({ includeArchived = false } = {}) {
        const all = await db.exercises.orderBy('nameKey').toArray();
        return all.filter((e) => alive(e) && (includeArchived || !e.archived));
    },

    async getExercise(id) {
        const found = await db.exercises.get(id);
        return alive(found) ? found : null;
    },

    /**
     * Упражнение по названию.
     *
     * Удалённые отсеиваются до выбора первого: объединение двойников
     * оставляет надгробие с тем же ключом названия, и, попадись оно первым,
     * приложение решило бы, что упражнения нет, — и завело бы третье.
     */
    async findExerciseByName(name) {
        const nameKey = migrations.normalizeName(name);
        if (!nameKey) return null;

        const found = await db.exercises.where('nameKey').equals(nameKey).filter(alive).first();
        return found || null;
    },

    async createExercise({ name, kind = 'weight', group = '' }) {
        const clean = String(name || '').trim();
        if (!clean) throw new Error(t('У упражнения должно быть название'));

        const now = Date.now();
        const record = {
            id: newId(),
            name: clean,
            nameKey: migrations.normalizeName(clean),
            kind,
            group,
            archived: false,
            createdAt: now,
            updatedAt: now
        };

        await db.exercises.add(record);
        return record;
    },

    /** Найти по названию или создать. Основной способ добавления в план. */
    async ensureExercise({ name, kind = 'weight', group = '' }) {
        return (await dbService.findExerciseByName(name))
            || dbService.createExercise({ name, kind, group });
    },

    async updateExercise(id, changes) {
        const patch = { ...changes, updatedAt: Date.now() };

        // Ключ поиска обязан идти следом за названием, иначе упражнение
        // перестанет находиться по своему же новому имени
        if (changes.name !== undefined) {
            const clean = String(changes.name).trim();
            if (!clean) throw new Error(t('У упражнения должно быть название'));
            patch.name = clean;
            patch.nameKey = migrations.normalizeName(clean);
        }

        await db.exercises.update(id, patch);
        return dbService.getExercise(id);
    },

    setExerciseArchived(id, archived) {
        return dbService.updateExercise(id, { archived: !!archived });
    },

    /** Сколько подходов ссылается на упражнение — от этого зависит удаление. */
    countSetsOfExercise(exerciseId) {
        return db.sets.where('exerciseId').equals(exerciseId).count();
    },

    /**
     * Удаление разрешено только для упражнения без единого подхода (§5):
     * иначе история, рекорды и статистика начали бы ссылаться в пустоту.
     * Всё остальное отправляется в архив.
     */
    async deleteExercise(id) {
        const used = await dbService.countSetsOfExercise(id);
        if (used > 0) {
            throw new Error(t('Упражнение встречается в истории — его можно только архивировать'));
        }

        await db.exercises.delete(id);
    },

    /**
     * Слияние двух упражнений (§5.1).
     *
     * Опечатка в названии заводит второе упражнение, и история разрезается
     * надвое — ровно то, ради чего справочник и придуман. Переименование не
     * помогает: записи остаются разными, а занять чужое имя нельзя.
     *
     * Все подходы исходного упражнения переходят к целевому, ссылки в планах
     * тренировок и в шаблонах переписываются, исходное удаляется.
     *
     * Одной транзакцией: половина перенесённой истории хуже неперенесённой.
     */
    async mergeExercises(sourceId, targetId) {
        if (sourceId === targetId) throw new Error(t('Упражнение нельзя объединить с самим собой'));

        const [source, target] = await Promise.all([
            dbService.getExercise(sourceId),
            dbService.getExercise(targetId)
        ]);

        if (!source) throw new Error(t('Исходное упражнение не найдено'));
        if (!target) throw new Error(t('Целевое упражнение не найдено'));

        const now = Date.now();
        const moved = { sets: 0, workouts: 0, templates: 0 };

        /**
         * Замена ссылки в списке упражнений плана или шаблона.
         *
         * Оба упражнения могли встречаться в одной тренировке — тогда после
         * замены в плане окажутся две записи об одном и том же. Их надо
         * слить, а не оставить рядом: иначе прогресс будет считать одно
         * упражнение дважды.
         */
        const rewrite = (items = []) => {
            if (!items.some((i) => i.exerciseId === sourceId)) return null;

            const result = [];

            for (const item of items) {
                const next = item.exerciseId === sourceId ? { ...item, exerciseId: targetId } : item;
                const existing = result.find((r) => r.exerciseId === next.exerciseId);

                if (!existing) {
                    result.push(next);
                    continue;
                }

                existing.plannedSets = (existing.plannedSets || 0) + (next.plannedSets || 0);
                existing.note = existing.note || next.note;
                existing.skipped = existing.skipped && next.skipped;
            }

            return result;
        };

        await db.transaction('rw', db.exercises, db.sets, db.workouts, db.templates, async () => {
            const sets = await db.sets.where('exerciseId').equals(sourceId).toArray();

            await db.sets.bulkPut(sets.map((s) => ({ ...s, exerciseId: targetId, updatedAt: now })));
            moved.sets = sets.length;

            for (const workout of await db.workouts.toArray()) {
                const plan = rewrite(workout.plan);
                const touchesSets = workout.summary?.exerciseIds?.includes(sourceId);

                if (!plan && !touchesSets) continue;

                // Список упражнений в сводке тоже ссылается на исходное
                // упражнение — без пересчёта история показывала бы старое
                // название до следующего изменения тренировки
                const summary = touchesSets
                    ? { ...workout.summary, exerciseIds: [...new Set(
                        workout.summary.exerciseIds.map((id) => (id === sourceId ? targetId : id))
                    )] }
                    : workout.summary;

                await db.workouts.update(workout.id, {
                    plan: plan || workout.plan,
                    summary,
                    updatedAt: now
                });

                moved.workouts += 1;
            }

            for (const template of await db.templates.toArray()) {
                const items = rewrite(template.items);
                if (!items) continue;

                await db.templates.update(template.id, { items, updatedAt: now });
                moved.templates += 1;
            }

            // Мягко, а не совсем: обмен сводит записи по идентификатору и
            // о бесследно исчезнувшем упражнении не узнает — второе
            // устройство прислало бы его обратно, и двойник вернулся бы
            await db.exercises.update(sourceId, { deletedAt: now, updatedAt: now });
        });

        return { ...moved, from: source.name, to: target.name };
    },

    /**
     * Сведение двойников по названию (§5.1).
     *
     * Базовый справочник кладётся при создании базы, а идентификаторы у
     * записей случайные (§35): на каждом устройстве получается свой набор
     * тех же упражнений с другими идентификаторами. Обмен сводит записи по
     * идентификатору и потому складывает оба набора — справочник
     * раздваивается, а история разрезается пополам.
     *
     * Победитель — строго меньший идентификатор, и только он.
     *
     * Устройства сводят двойников независимо друг от друга и на разных
     * данных: сведение делается и при запуске, до всякого обмена. Значит
     * признак выбора обязан быть тем, который не меняется никогда, — иначе
     * устройства выберут по-разному, сольют записи навстречу друг другу и
     * обменяются надгробиями. Упражнение исчезнет целиком, вместе с обоими.
     *
     * Ровно так и вышло с прежним правилом «действующее перевешивает
     * архивное»: пока отметка архива не доехала, устройства видели её
     * по-разному. Признак архива теперь не выбирает победителя, а
     * переносится на него: упражнение, действующее хоть где-то, остаётся
     * действующим — и к этому оба устройства приходят одинаково.
     */
    async dedupeExercises() {
        const all = (await db.exercises.toArray()).filter(alive);
        const groups = new Map();

        for (const exercise of all) {
            const key = exercise.nameKey || migrations.normalizeName(exercise.name);
            if (!key) continue;

            groups.set(key, [...(groups.get(key) || []), exercise]);
        }

        const merged = [];

        for (const group of groups.values()) {
            if (group.length < 2) continue;

            const [target, ...rest] = [...group].sort((a, b) => (a.id < b.id ? -1 : 1));

            for (const source of rest) {
                await dbService.mergeExercises(source.id, target.id);
                merged.push(source.name);
            }

            // Отметка архива не выбирала победителя, но потеряться не должна
            if (target.archived && group.some((e) => !e.archived)) {
                await dbService.setExerciseArchived(target.id, false);
            }
        }

        if (merged.length) console.warn('[База] Сведены двойники упражнений:', merged);

        return merged;
    },

    // ================== ТРЕНИРОВКИ (§4) ==================

    /**
     * Активная тренировка или null. Она всегда одна (§18).
     *
     * Удаление мягкое (§21), и статус при нём не меняется: удалённая
     * тренировка остаётся «активной» в индексе. Поэтому удалённые
     * отсеиваются до выбора первой — иначе одна брошенная тренировка
     * навсегда закрывала бы собой все последующие, и порядок обхода
     * индекса решал бы, увидит ли пользователь свою незавершённую.
     */
    async getActiveWorkout() {
        const found = await db.workouts.where('status').equals('active').filter(alive).first();
        return found || null;
    },

    async createWorkout({ type = 'Тренировка', name = '', templateId = null, plan = [] }) {
        const now = Date.now();
        const record = {
            id: newId(),
            type, name, templateId,
            status: 'active',
            note: '',
            startedAt: now,
            finishedAt: null,
            plan,
            updatedAt: now
        };

        await db.workouts.add(record);
        return record;
    },

    async updateWorkout(id, changes) {
        await db.workouts.update(id, { ...changes, updatedAt: Date.now() });
        return dbService.getWorkout(id);
    },

    /**
     * Пересчёт сводки одной тренировки (§34.1).
     *
     * Читает подходы только этой тренировки — по индексу, миллисекунда.
     * touch = false, когда сводка лишь догоняет уже учтённое изменение и
     * поднимать updatedAt повторно незачем.
     */
    async recomputeSummary(workoutId, { touch = true } = {}) {
        const sets = await db.sets.where('workoutId').equals(workoutId).toArray();
        const summary = summarize(sets);

        await db.workouts.update(workoutId, touch
            ? { summary, updatedAt: Date.now() }
            : { summary });

        return summary;
    },

    /**
     * finishedAt задаётся явно для тренировки, завершаемой задним числом.
     *
     * Здесь же считается сводка: состав тренировки с этого момента
     * фиксируется, и списки смогут обходиться без чтения подходов.
     */
    async finishWorkout(id, finishedAt = Date.now()) {
        const sets = await db.sets.where('workoutId').equals(id).toArray();

        return dbService.updateWorkout(id, {
            status: 'done',
            finishedAt,
            summary: summarize(sets)
        });
    },

    async getWorkout(id) {
        const found = await db.workouts.get(id);
        return alive(found) ? found : null;
    },

    async listWorkouts({ limit = 0, status = 'done' } = {}) {
        let collection = db.workouts.orderBy('startedAt').reverse();

        const all = await collection.toArray();
        const filtered = all.filter((w) => alive(w) && (!status || w.status === status));

        return limit > 0 ? filtered.slice(0, limit) : filtered;
    },

    /** Мягкое удаление вместе с подходами: они уезжают в облако вместе. */
    async deleteWorkout(id) {
        const now = Date.now();

        await db.transaction('rw', db.workouts, db.sets, async () => {
            await db.workouts.update(id, { deletedAt: now, updatedAt: now });
            const ids = await db.sets.where('workoutId').equals(id).primaryKeys();
            await db.sets.bulkUpdate(ids.map((key) => ({ key, changes: { deletedAt: now, updatedAt: now } })));
        });
    },

    // ================== ПОДХОДЫ (§4) ==================

    /**
     * Запись подхода. order — сквозной номер в тренировке, он и задаёт
     * фактический порядок выполнения; setNumber — номер внутри упражнения.
     */
    async addSet({ workoutId, exerciseId, order, setNumber, reps, weight, duration, distance, note, performedAt }) {
        const now = Date.now();
        const record = {
            id: newId(),
            workoutId,
            exerciseId,
            order,
            setNumber,
            performedAt: performedAt ?? now,
            updatedAt: now
        };

        // Незаполненные поля не сохраняются (§6): пустой вес у планки — не ноль,
        // а отсутствие величины, и в статистику он попадать не должен
        if (Number.isFinite(reps)) record.reps = reps;
        if (Number.isFinite(weight) && weight > 0) record.weight = weight;
        if (Number.isFinite(duration) && duration > 0) record.duration = duration;
        if (Number.isFinite(distance) && distance > 0) record.distance = distance;
        if (note) record.note = note;

        await db.sets.add(record);
        return record;
    },

    async listSets(workoutId) {
        const all = await db.sets.where('workoutId').equals(workoutId).sortBy('order');
        return all.filter(alive);
    },

    /** Подходы упражнения, новые первыми. Основа рекордов и динамики (§15). */
    async listSetsByExercise(exerciseId, { limit = 0 } = {}) {
        const all = await db.sets
            .where('[exerciseId+performedAt]')
            .between([exerciseId, Dexie.minKey], [exerciseId, Dexie.maxKey])
            .reverse()
            .toArray();

        const live = all.filter(alive);
        return limit > 0 ? live.slice(0, limit) : live;
    },

    /**
     * Доставка упражнений, появившихся в базовом списке позже (§5).
     *
     * Список кладётся при создании базы, а у тех, кто пользуется давно, база
     * уже есть — новые упражнения к ним иначе не попадут никогда.
     *
     * Сделано настройкой, а не миграцией схемы, намеренно: миграция подняла
     * бы версию базы, и прежняя версия приложения её уже не открыла бы —
     * то есть откат перестал бы работать (см. DEPLOY.md §2.2).
     *
     * Что не добавляется: упражнение с таким же идентификатором или таким же
     * названием, даже удалённое. Возвращать то, что пользователь убрал сам,
     * приложение не вправе.
     */
    async installBaseExercises() {
        const delivered = Number(await dbService.getSetting('baseInstalled', BASE_BEFORE_INTERVALS));
        const all = migrations.BASE_EXERCISES;

        if (delivered >= all.length) return [];

        const now = Date.now();
        const added = [];

        for (const item of all.slice(delivered)) {
            /*
             * Название ставится на языке первого запуска (§53).
             *
             * Идентификатор и ключ поиска считаются от него же, а не от
             * русского оригинала. Иначе человек, у которого в справочнике
             * «Bench press», завёл бы вторым таким же названием второе
             * упражнение: ключ у записанного был бы «жим лежа», и совпадения
             * приложение не увидело бы.
             *
             * Цена решения: тот же справочник, поставленный на двух языках
             * под одной учётной записью, даст два набора записей. Это
             * редкость и меньшее из зол — одинаковые названия сведёт
             * dedupeExercises, а разные и должны остаться разными.
             */
            const local = localizeExercise(item, i18n.lang, howTo(migrations.normalizeName(item.name)));

            const id = baseId(local.name);
            const nameKey = migrations.normalizeName(local.name);

            if (await db.exercises.get(id)) continue;
            if (await db.exercises.where('nameKey').equals(nameKey).count()) continue;

            await db.exercises.add({
                id,
                name: local.name,
                nameKey,
                kind: item.kind,
                group: local.group,
                howTo: local.howTo || undefined,
                archived: false,
                createdAt: now,
                updatedAt: now
            });

            added.push(local.name);
        }

        await dbService.setSetting('baseInstalled', all.length);
        return added;
    },

    /**
     * Перевод базовых упражнений на текущий язык (§53).
     *
     * Справочник ставится один раз, на языке первого запуска, и при смене
     * языка не переименовывается сам: переименовывать записанное человеком
     * приложение не вправе. Но у того, кто сменил язык на своей давно
     * заведённой базе, остаётся русский список посреди немецкого экрана —
     * и это тоже неправильно.
     *
     * Поэтому переименование есть, но только по явной просьбе и только для
     * нетронутого: упражнение переводится, если его нынешнее название в
     * точности совпадает с базовым на каком-то из языков. Стоит человеку
     * поправить название хоть на букву — оно становится его, и действие
     * обходит его стороной.
     *
     * Идентификатор не меняется: на него ссылается вся история. Меняются
     * название, ключ поиска, группа и описание.
     */
    async relocalizeBaseExercises() {
        const all = await db.exercises.toArray();
        const занятые = new Set(all.filter(alive).map((e) => e.nameKey));

        const now = Date.now();
        const renamed = [];

        for (const exercise of all) {
            if (!alive(exercise) || !exercise.id.startsWith('base-')) continue;

            const canonical = canonicalName(exercise.name);
            if (!canonical) continue;

            const item = { name: canonical, group: canonicalGroup(exercise.group) };
            const local = localizeExercise(item, i18n.lang, howTo(migrations.normalizeName(canonical)));

            if (local.name === exercise.name && local.group === exercise.group) continue;

            const nameKey = migrations.normalizeName(local.name);

            // Такое название уже занято другой записью — переименование
            // склеило бы два разных упражнения в одно по ключу поиска
            if (nameKey !== exercise.nameKey && занятые.has(nameKey)) continue;

            занятые.delete(exercise.nameKey);
            занятые.add(nameKey);

            const changes = { name: local.name, nameKey, group: local.group, updatedAt: now };

            /*
             * Описание переписывается, только если прежнее тоже наше.
             *
             * Свой текст человека сильнее готового (§5.2), и заменить его
             * переводом — та же потеря, что переименовать упражнение,
             * которое он назвал сам.
             */
            const наше = !exercise.howTo
                || exercise.howTo === howTo(migrations.normalizeName(canonical))
                || deliveredHowTo(canonical).includes(exercise.howTo);

            if (наше && local.howTo) changes.howTo = local.howTo;

            await db.exercises.update(exercise.id, changes);
            renamed.push(local.name);
        }

        return renamed;
    },

    /**
     * Сколько базовых упражнений стоит не на текущем языке.
     *
     * По этому числу экран решает, предлагать ли перевод: предлагать его
     * там, где переводить нечего, значит держать на виду кнопку, которая
     * ничего не делает.
     */
    async countForeignBaseExercises() {
        const all = await db.exercises.toArray();
        let count = 0;

        for (const exercise of all) {
            if (!alive(exercise) || !exercise.id.startsWith('base-')) continue;

            const canonical = canonicalName(exercise.name);
            if (!canonical) continue;

            const local = localizeExercise({ name: canonical, group: canonicalGroup(exercise.group) }, i18n.lang);
            if (local.name !== exercise.name || local.group !== exercise.group) count += 1;
        }

        return count;
    },

    /**
     * Разовое заполнение описаний «как выполнять» (§5.2).
     *
     * Только пустые: текст пользователя всегда сильнее готового. И только
     * известные по названию — своё упражнение приложение описать не может.
     *
     * Метки времени не трогаются намеренно: описание не то изменение, ради
     * которого стоит гнать весь справочник в облако заново. Второе устройство
     * заполнит его у себя тем же способом.
     */
    async installHowTo() {
        if (await dbService.getSetting('howToInstalled', false)) return 0;

        const all = await db.exercises.toArray();
        let filled = 0;

        for (const exercise of all) {
            if (exercise.howTo) continue;

            const text = howTo(exercise.nameKey);
            if (!text) continue;

            await db.exercises.update(exercise.id, { howTo: text });
            filled += 1;
        }

        await dbService.setSetting('howToInstalled', true);
        return filled;
    },

    async getSet(id) {
        const found = await db.sets.get(id);
        return alive(found) ? found : null;
    },

    /**
     * Правка записанного подхода (§21.1).
     *
     * Ошибиться при записи легко — «60» вместо «6», — а до этого исправить
     * было нечем: оставалось удалить подход и потерять его место в
     * тренировке. Величины, которых у подхода нет, из него убираются, а не
     * записываются нулём: ноль повторений и отсутствие повторений — разные
     * вещи, и рекорды считают их по-разному.
     */
    async updateSet(id, changes = {}) {
        const set = await db.sets.get(id);
        if (!alive(set)) throw new Error(t('Подход не найден'));

        const next = { ...set, updatedAt: Date.now() };

        for (const field of ['reps', 'weight', 'duration', 'distance']) {
            if (!(field in changes)) continue;

            const value = Number(changes[field]);
            const empty = changes[field] === null || changes[field] === '' || !Number.isFinite(value);

            if (empty) delete next[field];
            else next[field] = value;
        }

        if ('note' in changes) {
            if (changes.note) next.note = String(changes.note);
            else delete next.note;
        }

        await db.sets.put(next);

        // Тоннаж и число повторений лежат в сводке (§34.1): без пересчёта
        // история показывала бы прежние числа рядом с исправленными
        await dbService.recomputeSummary(set.workoutId);

        return next;
    },

    /**
     * Та же правка — остальным подходам этого упражнения в тренировке.
     *
     * Ошибаются обычно не в одном подходе, а во всём упражнении: вес был
     * 62,5, а записан 60 — и так все три раза. Исправлять по одному значит
     * повторять одно и то же действие столько раз, сколько было подходов.
     *
     * Заметка сюда не попадает намеренно: она про конкретный подход, а не
     * про упражнение, и размножать её было бы неправдой.
     */
    async applySetToRest(id, changes = {}) {
        const set = await db.sets.get(id);
        if (!alive(set)) throw new Error(t('Подход не найден'));

        const rest = (await dbService.listSets(set.workoutId))
            .filter((s) => s.exerciseId === set.exerciseId && s.id !== set.id);

        for (const other of rest) {
            await dbService.updateSet(other.id, changes);
        }

        return rest.length;
    },

    async deleteSet(id) {
        const now = Date.now();
        const set = await db.sets.get(id);

        await db.sets.update(id, { deletedAt: now, updatedAt: now });

        // Иначе в истории останется прежнее число подходов, и сводка
        // разойдётся с тем, что показывают итоги той же тренировки
        if (set) await dbService.recomputeSummary(set.workoutId);
    },

    /** Все живые подходы. Нужны статистике, которой важен каждый подход. */
    async allSets() {
        const all = await db.sets.toArray();
        return all.filter(alive);
    },

    /**
     * Тренировки со сводкой по подходам — для истории, календаря и статистики.
     *
     * Все подходы читаются одним проходом и группируются в памяти. Запрос на
     * каждую тренировку отдельно выглядел бы аккуратнее, но при сотне
     * тренировок это сотня обращений к базе ради одного списка.
     */
    async listWorkoutSummaries({ status = 'done' } = {}) {
        const all = await db.workouts.orderBy('startedAt').reverse().toArray();
        const workouts = all.filter((w) => alive(w) && (!status || w.status === status));

        /*
         * Сводка лежит внутри записи (§34.1), поэтому подходы здесь не
         * читаются вовсе. Раньше показ истории, календаря или главной
         * означал полное чтение таблицы подходов — на пяти годах занятий
         * это 167 мс на настольном браузере и вчетверо больше на телефоне.
         *
         * Отсутствовать сводка может только у записи, пришедшей в обход
         * обычного пути. Такую считаем на месте: чтение по индексу одной
         * тренировки стоит миллисекунду.
         */
        const missing = workouts.filter((w) => !w.summary);

        if (missing.length) {
            console.warn(`[База] Сводки нет у ${missing.length} тренировок, считаю на месте`);

            await Promise.all(missing.map(async (workout) => {
                workout.summary = await dbService.recomputeSummary(workout.id, { touch: false });
            }));
        }

        return workouts.map((workout) => ({
            workout,
            sets: workout.summary?.sets || 0,
            reps: workout.summary?.reps || 0,
            volume: workout.summary?.volume || 0,
            exerciseIds: workout.summary?.exerciseIds || []
        }));
    },

    // ================== ШАБЛОНЫ (§8) ==================

    async listTemplates() {
        const all = await db.templates.orderBy('name').toArray();
        return all.filter(alive);
    },

    async getTemplate(id) {
        const found = await db.templates.get(id);
        return alive(found) ? found : null;
    },

    /**
     * interval — настройки отрезков интервальной программы (§50). Хранятся
     * внутри записи как есть: схема их не описывает, и версию базы поднимать
     * ради них не нужно — старая версия просто не заметит поля.
     */
    async saveTemplate({ id, name, type = 'Тренировка', items = [], interval = null }) {
        const now = Date.now();

        if (id) {
            await db.templates.update(id, { name, type, items, interval, updatedAt: now });
            return dbService.getTemplate(id);
        }

        const record = { id: newId(), name, type, items, interval, updatedAt: now };
        await db.templates.add(record);
        return record;
    },

    async deleteTemplate(id) {
        const now = Date.now();
        await db.templates.update(id, { deletedAt: now, updatedAt: now });
    },

    // ================== ВЕС ТЕЛА (§26.3) ==================

    /**
     * Запись веса. На день приходится одна запись: взвешиваться можно
     * сколько угодно раз, но в истории веса нужна одна точка на день,
     * иначе график превратится в шум от утренних и вечерних измерений.
     */
    async setBodyWeight({ at = Date.now(), weight, note = '' }) {
        const day = startOfDay(at);
        const now = Date.now();

        const existing = await db.bodyWeight.where('at').equals(day).first();

        if (existing) {
            await db.bodyWeight.update(existing.id, { weight, note, deletedAt: undefined, updatedAt: now });
            return dbService.getBodyWeightOn(day);
        }

        const record = { id: newId(), at: day, weight, note, updatedAt: now };
        await db.bodyWeight.add(record);
        return record;
    },

    async getBodyWeightOn(at) {
        const found = await db.bodyWeight.where('at').equals(startOfDay(at)).first();
        return alive(found) ? found : null;
    },

    /** Все взвешивания по возрастанию даты. */
    async listBodyWeight() {
        const all = await db.bodyWeight.orderBy('at').toArray();
        return all.filter(alive);
    },

    /** Последнее взвешивание. */
    async lastBodyWeight() {
        const all = await dbService.listBodyWeight();
        return all[all.length - 1] || null;
    },

    async deleteBodyWeight(id) {
        const now = Date.now();
        await db.bodyWeight.update(id, { deletedAt: now, updatedAt: now });
    },

    // ================== НАСТРОЙКИ ==================

    async getSetting(key, fallback = null) {
        const row = await db.settings.get(key);
        return row ? row.value : fallback;
    },

    async setSetting(key, value) {
        await db.settings.put({ key, value });
        return value;
    },

    // ================== СИНХРОНИЗАЦИЯ (§39) ==================

    /**
     * Записи, изменившиеся с указанного момента. Удалённые тоже: отметка
     * deletedAt обязана доехать до других устройств (§36).
     *
     * Для тренировок сразу подкладываются подходы — в облаке они лежат
     * внутри документа тренировки.
     */
    async changedSince(name, since = 0) {
        const table = db[name];
        if (!table) throw new Error(`[База] Нет таблицы «${name}»`);

        const changed = await table.where('updatedAt').above(since).toArray();

        if (name !== 'workouts') return changed;

        return Promise.all(changed.map(async (workout) => ({
            ...workout,
            sets: await db.sets.where('workoutId').equals(workout.id).sortBy('order')
        })));
    },

    /** Локальная запись для сравнения с входящей. Удалённые тоже нужны. */
    getRaw(name, id) {
        return db[name].get(id);
    },

    /**
     * Запись из облака кладётся как есть: updatedAt у неё уже проставлен
     * тем устройством, где её изменили, и трогать его нельзя — иначе она
     * тут же уедет обратно как «новая».
     */
    applyRemote(name, records = []) {
        return db[name].bulkPut(records);
    },

    /**
     * Тренировка из облака вместе с подходами.
     *
     * Подходы заменяются целиком: они меняются только пока тренировка
     * активна, а активная не синхронизируется — значит, входящий набор
     * полный и старые записи не нужны.
     */
    async applyRemoteWorkout(workout, sets = []) {
        await db.transaction('rw', db.workouts, db.sets, async () => {
            // Сводка считается здесь же, а не берётся из облака: там могла
            // остаться запись, сделанная версией без сводки, и тогда список
            // истории показал бы нули
            await db.workouts.put({ ...workout, summary: summarize(sets) });

            const existing = await db.sets.where('workoutId').equals(workout.id).primaryKeys();
            if (existing.length) await db.sets.bulkDelete(existing);

            if (sets.length) await db.sets.bulkPut(sets);
        });
    },

    // ================== ОБСЛУЖИВАНИЕ ==================

    /** Сводка для профиля: сколько чего лежит в базе. */
    async stats() {
        const [exercises, workouts, sets, templates] = await Promise.all([
            dbService.listExercises({ includeArchived: true }),
            db.workouts.toArray(),
            db.sets.count(),
            dbService.listTemplates()
        ]);

        return {
            exercises: exercises.length,
            archived: exercises.filter((e) => e.archived).length,
            workouts: workouts.filter(alive).length,
            sets,
            templates: templates.length
        };
    },

    /**
     * Массовая запись переноса. Одной транзакцией: половина перенесённой
     * истории хуже, чем неперенесённая.
     */
    async bulkImport({ exercises = [], workouts = [], sets = [] }) {
        // Сводка считается из того же набора, что и записывается: перенос
        // из версии 1 и загрузка копии иначе дали бы историю с нулями
        const byWorkout = new Map();
        for (const set of sets) {
            byWorkout.set(set.workoutId, [...(byWorkout.get(set.workoutId) || []), set]);
        }

        const withSummary = workouts.map((w) => ({
            ...w,
            summary: w.summary || summarize(byWorkout.get(w.id) || [])
        }));

        await db.transaction('rw', db.exercises, db.workouts, db.sets, async () => {
            if (exercises.length) await db.exercises.bulkAdd(exercises);
            if (withSummary.length) await db.workouts.bulkAdd(withSummary);
            if (sets.length) await db.sets.bulkAdd(sets);
        });

        return { exercises: exercises.length, workouts: workouts.length, sets: sets.length };
    },

    /**
     * Физическое удаление давно стёртых записей (§36).
     *
     * Мягкое удаление нужно, чтобы стирание доехало до других устройств:
     * запись остаётся с отметкой deletedAt и служит надгробием. Но вечно
     * хранить надгробия незачем — через положенный срок их можно убрать.
     *
     * Момент `before` считает вызывающий, и это принципиально: убирать
     * надгробие можно только после того, как удаление уехало в облако.
     * Иначе на втором устройстве запись останется живой и вернётся обратно
     * при следующем обмене — то есть удаление отменится само.
     */
    async purgeDeleted({ before }) {
        if (!Number.isFinite(before) || before <= 0) return {};

        const removed = {};
        const tables = ['exercises', 'templates', 'workouts', 'sets', 'bodyWeight'];

        for (const name of tables) {
            const doomed = await db[name]
                .filter((r) => r.deletedAt && r.deletedAt < before)
                .primaryKeys();

            if (doomed.length === 0) continue;

            await db[name].bulkDelete(doomed);
            removed[name] = doomed.length;
        }

        return removed;
    },

    /**
     * Полная очистка. Загрузка копии с заменой (§41) и проверки.
     *
     * Все таблицы, а не только очевидные: вес тела уезжает в копию наравне с
     * тренировками, и, оставшись здесь, он смешался бы с восстановленным —
     * замена перестала бы быть заменой. Дефект держался до тех пор, пока
     * очистка не понадобилась проверке экрана.
     */
    async wipe() {
        const tables = [db.exercises, db.templates, db.workouts, db.sets, db.bodyWeight, db.settings];

        await db.transaction('rw', tables, async () => {
            await Promise.all(tables.map((table) => table.clear()));
        });
    }
};
