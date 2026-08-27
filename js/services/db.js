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

/**
 * Базовый справочник кладётся при создании базы, а не при каждом запуске:
 * иначе удалённые пользователем упражнения воскресали бы после перезагрузки.
 */
db.on('populate', (tx) => {
    const now = Date.now();

    tx.table('exercises').bulkAdd(migrations.BASE_EXERCISES.map((e) => ({
        id: newId(),
        name: e.name,
        nameKey: migrations.normalizeName(e.name),
        kind: e.kind,
        group: e.group || '',
        archived: false,
        createdAt: now,
        updatedAt: now
    })));
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

    async findExerciseByName(name) {
        const nameKey = migrations.normalizeName(name);
        if (!nameKey) return null;

        const found = await db.exercises.where('nameKey').equals(nameKey).first();
        return alive(found) ? found : null;
    },

    async createExercise({ name, kind = 'weight', group = '' }) {
        const clean = String(name || '').trim();
        if (!clean) throw new Error('У упражнения должно быть название');

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
            if (!clean) throw new Error('У упражнения должно быть название');
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
            throw new Error('Упражнение встречается в истории — его можно только архивировать');
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
        if (sourceId === targetId) throw new Error('Упражнение нельзя объединить с самим собой');

        const [source, target] = await Promise.all([
            dbService.getExercise(sourceId),
            dbService.getExercise(targetId)
        ]);

        if (!source) throw new Error('Исходное упражнение не найдено');
        if (!target) throw new Error('Целевое упражнение не найдено');

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
                if (!plan) continue;

                await db.workouts.update(workout.id, { plan, updatedAt: now });
                moved.workouts += 1;
            }

            for (const template of await db.templates.toArray()) {
                const items = rewrite(template.items);
                if (!items) continue;

                await db.templates.update(template.id, { items, updatedAt: now });
                moved.templates += 1;
            }

            // Исходное упражнение больше ничем не занято — удаляем совсем,
            // а не мягко: ссылаться на него уже неоткуда, и в облаке его
            // отсутствие приедет вместе с переписанными тренировками
            await db.exercises.delete(sourceId);
        });

        return { ...moved, from: source.name, to: target.name };
    },

    // ================== ТРЕНИРОВКИ (§4) ==================

    /** Активная тренировка или null. Она всегда одна (§18). */
    async getActiveWorkout() {
        const found = await db.workouts.where('status').equals('active').first();
        return alive(found) ? found : null;
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

    /** finishedAt задаётся явно для тренировки, завершаемой задним числом. */
    finishWorkout(id, finishedAt = Date.now()) {
        return dbService.updateWorkout(id, { status: 'done', finishedAt });
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

    async deleteSet(id) {
        const now = Date.now();
        await db.sets.update(id, { deletedAt: now, updatedAt: now });
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
        const [workouts, sets] = await Promise.all([
            db.workouts.orderBy('startedAt').reverse().toArray(),
            db.sets.toArray()
        ]);

        const grouped = new Map();

        for (const set of sets) {
            if (!alive(set)) continue;

            const entry = grouped.get(set.workoutId)
                || { sets: 0, reps: 0, volume: 0, exerciseIds: new Set() };

            entry.sets += 1;
            entry.reps += set.reps || 0;
            if (set.weight) entry.volume += (set.reps || 0) * set.weight;
            entry.exerciseIds.add(set.exerciseId);

            grouped.set(set.workoutId, entry);
        }

        return workouts
            .filter((w) => alive(w) && (!status || w.status === status))
            .map((workout) => {
                const entry = grouped.get(workout.id);

                return {
                    workout,
                    sets: entry?.sets || 0,
                    reps: entry?.reps || 0,
                    volume: entry?.volume || 0,
                    exerciseIds: entry ? [...entry.exerciseIds] : []
                };
            });
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

    async saveTemplate({ id, name, type = 'Тренировка', items = [] }) {
        const now = Date.now();

        if (id) {
            await db.templates.update(id, { name, type, items, updatedAt: now });
            return dbService.getTemplate(id);
        }

        const record = { id: newId(), name, type, items, updatedAt: now };
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
        if (!table) throw new Error(`Нет таблицы «${name}»`);

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
            await db.workouts.put(workout);

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
        await db.transaction('rw', db.exercises, db.workouts, db.sets, async () => {
            if (exercises.length) await db.exercises.bulkAdd(exercises);
            if (workouts.length) await db.workouts.bulkAdd(workouts);
            if (sets.length) await db.sets.bulkAdd(sets);
        });

        return { exercises: exercises.length, workouts: workouts.length, sets: sets.length };
    },

    /** Полная очистка. Используется тестами и кнопкой в профиле. */
    async wipe() {
        await db.transaction('rw', db.exercises, db.templates, db.workouts, db.sets, db.settings, async () => {
            await Promise.all([
                db.exercises.clear(), db.templates.clear(),
                db.workouts.clear(), db.sets.clear(), db.settings.clear()
            ]);
        });
    }
};
