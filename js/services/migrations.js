/**
 * Наполнение справочника и перенос данных версии 1 (§5, §37 ТЗ).
 *
 * Здесь только чистые преобразования — ни одного обращения к базе. Так их
 * можно прогнать тестами на выдуманных данных, не создавая хранилище и не
 * рискуя настоящей историей. Записывает результат в базу сервис db.js.
 */

/** Ключ, под которым версия 1 хранила историю в localStorage. */
export const V1_KEY = 'workout_history_v2';

/**
 * Базовый справочник упражнений. Появляется при первом запуске, чтобы
 * составление плана не начиналось с пустого экрана.
 *
 * Вид определяет, какие поля показываются при вводе подхода (§6).
 */
export const BASE_EXERCISES = [
    // Грудь
    { name: 'Жим лёжа',                 kind: 'weight',   group: 'Грудь' },
    { name: 'Жим гантелей лёжа',        kind: 'weight',   group: 'Грудь' },
    { name: 'Разведение гантелей',      kind: 'weight',   group: 'Грудь' },
    { name: 'Отжимания',                kind: 'reps',     group: 'Грудь' },
    { name: 'Брусья',                   kind: 'reps',     group: 'Грудь' },

    // Спина
    { name: 'Подтягивания',             kind: 'reps',     group: 'Спина' },
    { name: 'Тяга верхнего блока',      kind: 'weight',   group: 'Спина' },
    { name: 'Тяга штанги в наклоне',    kind: 'weight',   group: 'Спина' },
    { name: 'Тяга горизонтального блока', kind: 'weight', group: 'Спина' },
    { name: 'Становая тяга',            kind: 'weight',   group: 'Спина' },

    // Ноги
    { name: 'Приседания со штангой',    kind: 'weight',   group: 'Ноги' },
    { name: 'Приседания',               kind: 'reps',     group: 'Ноги' },
    { name: 'Жим ногами',               kind: 'weight',   group: 'Ноги' },
    { name: 'Выпады',                   kind: 'weight',   group: 'Ноги' },
    { name: 'Разгибание ног',           kind: 'weight',   group: 'Ноги' },
    { name: 'Сгибание ног',             kind: 'weight',   group: 'Ноги' },
    { name: 'Подъём на носки',          kind: 'weight',   group: 'Ноги' },

    // Плечи и руки
    { name: 'Жим стоя',                 kind: 'weight',   group: 'Плечи' },
    { name: 'Махи гантелями в стороны', kind: 'weight',   group: 'Плечи' },
    { name: 'Подъём штанги на бицепс',  kind: 'weight',   group: 'Руки' },
    { name: 'Подъём гантелей на бицепс', kind: 'weight',  group: 'Руки' },
    { name: 'Французский жим',          kind: 'weight',   group: 'Руки' },

    // Пресс
    { name: 'Пресс',                    kind: 'reps',     group: 'Пресс' },
    { name: 'Скручивания',              kind: 'reps',     group: 'Пресс' },
    { name: 'Подъём ног в висе',        kind: 'reps',     group: 'Пресс' },
    { name: 'Планка',                   kind: 'time',     group: 'Пресс' },

    // Кардио
    { name: 'Бег',                      kind: 'distance', group: 'Кардио' },
    { name: 'Ходьба',                   kind: 'distance', group: 'Кардио' },
    { name: 'Велотренажёр',             kind: 'distance', group: 'Кардио' },
    { name: 'Скакалка',                 kind: 'time',     group: 'Кардио' },
    { name: 'Берпи',                    kind: 'reps',     group: 'Всё тело' },

    /*
     * Для интервальных тренировок (§50).
     *
     * Список выше собирался под силовую тренировку в зале: снаряды, подходы,
     * вес. Табата — другое: двадцать секунд своим весом, без инвентаря, и
     * из прежнего списка ей годились только отжимания, приседания, бёрпи и
     * скакалка. Здесь то, из чего её обычно и складывают.
     *
     * Все на повторения или на время — снаряда в них нет, а значит нет и
     * веса, который пришлось бы вводить между отрезками.
     */
    { name: 'Прыжки «звёздочка»',       kind: 'reps',     group: 'Всё тело' },
    { name: 'Альпинист',                kind: 'reps',     group: 'Всё тело' },
    { name: 'Бег на месте',             kind: 'time',     group: 'Кардио' },
    { name: 'Высокое поднимание колен', kind: 'time',     group: 'Кардио' },
    { name: 'Выпрыгивания из приседа',  kind: 'reps',     group: 'Ноги' },
    { name: 'Прыжки в выпадах',         kind: 'reps',     group: 'Ноги' },
    { name: 'Ягодичный мостик',         kind: 'reps',     group: 'Ноги' },
    { name: 'Планка с касанием плеч',   kind: 'reps',     group: 'Пресс' },
    { name: 'Боковая планка',           kind: 'time',     group: 'Пресс' },
    { name: 'Русский твист',            kind: 'reps',     group: 'Пресс' },
    { name: 'Велосипед',                kind: 'reps',     group: 'Пресс' },
    { name: 'Складка',                  kind: 'reps',     group: 'Пресс' },
    { name: 'Медвежья походка',         kind: 'time',     group: 'Всё тело' },
    { name: 'Приседания «сумо»',        kind: 'reps',     group: 'Ноги' }
];

export const migrations = {

    V1_KEY,
    BASE_EXERCISES,

    /**
     * Ключ для поиска упражнения по названию.
     *
     * «Жим лёжа», «жим лежа» и «Жим  лёжа» должны находить одну и ту же
     * запись, иначе история упражнения рассыпается на несколько (§5).
     */
    normalizeName(name) {
        return String(name || '')
            .trim()
            .toLowerCase()
            .replace(/ё/g, 'е')
            .replace(/\s+/g, ' ');
    },

    /**
     * Вид упражнения по его подходам из версии 1.
     *
     * Там были только повторения и вес, поэтому различить можно ровно два
     * вида: есть хоть где-то вес — силовое, нет — собственный вес.
     */
    detectKind(sets) {
        const withWeight = (sets || []).some((s) => Number(s.weight) > 0);
        return withWeight ? 'weight' : 'reps';
    },

    /**
     * Преобразование истории версии 1 в записи новой схемы.
     *
     * Чистая функция: идентификаторы приходят снаружи (newId), уже известные
     * упражнения — тоже (knownExercises). Ничего не пишет и ничего не читает
     * из окружения, поэтому проверяется тестами напрямую.
     *
     * @param {Array}  records         содержимое workout_history_v2
     * @param {Object} ctx
     * @param {Function} ctx.newId     генератор идентификаторов
     * @param {Array}  ctx.knownExercises  [{ id, nameKey, kind }]
     * @returns {{exercises, workouts, sets, skipped}}
     */
    convertV1(records, { newId, knownExercises = [] }) {
        const exercises = [];
        const workouts = [];
        const sets = [];
        const skipped = [];

        // Справочник пополняется по ходу, поэтому копия, а не ссылка
        const known = new Map(knownExercises.map((e) => [e.nameKey, e]));

        const resolveExercise = (rawName, kind, createdAt) => {
            const name = String(rawName || '').trim() || 'Без названия';
            const nameKey = migrations.normalizeName(name);

            const found = known.get(nameKey);
            if (found) return found;

            const created = {
                id: newId(),
                name,
                nameKey,
                kind,
                group: '',
                archived: false,
                createdAt,
                updatedAt: createdAt
            };

            known.set(nameKey, created);
            exercises.push(created);
            return created;
        };

        for (const record of records || []) {
            const startedAt = Date.parse(record?.date);

            // Запись без разбираемой даты переносить некуда: она не встанет
            // ни в историю, ни в статистику, ни в календарь
            if (!Number.isFinite(startedAt)) {
                skipped.push({ record, reason: 'Неразбираемая дата' });
                continue;
            }

            const durationMs = Number(record.durationMs) > 0 ? Number(record.durationMs) : 0;
            const sourceExercises = Array.isArray(record.exercises) ? record.exercises : [];

            // Сколько всего подходов — нужно, чтобы разложить их по времени
            const totalSets = sourceExercises.reduce(
                (sum, ex) => sum + (Array.isArray(ex.sets) ? ex.sets.length : 0), 0
            );

            if (totalSets === 0) {
                skipped.push({ record, reason: 'Нет ни одного подхода' });
                continue;
            }

            const workoutId = newId();
            const plan = [];
            let order = 0;

            for (const source of sourceExercises) {
                const sourceSets = Array.isArray(source.sets) ? source.sets : [];
                if (sourceSets.length === 0) continue;

                const kind = migrations.detectKind(sourceSets);
                const exercise = resolveExercise(source.name, kind, startedAt);

                plan.push({
                    exerciseId: exercise.id,
                    plannedSets: sourceSets.length,
                    targetReps: null,
                    weight: Number(source.weight) || 0,
                    skipped: false
                });

                sourceSets.forEach((s, i) => {
                    order += 1;

                    // Точного времени подхода версия 1 не хранила. Раскладываем
                    // равномерно по длительности: порядок получается верный,
                    // а на нём держатся рекорды и график динамики.
                    const performedAt = totalSets > 1 && durationMs > 0
                        ? startedAt + Math.round((durationMs * (order - 1)) / totalSets)
                        : startedAt;

                    const set = {
                        id: newId(),
                        workoutId,
                        exerciseId: exercise.id,
                        order,
                        setNumber: Number(s.set) || i + 1,
                        performedAt,
                        reps: Number(s.reps) || 0,
                        updatedAt: startedAt
                    };

                    if (Number(s.weight) > 0) set.weight = Number(s.weight);

                    sets.push(set);
                });
            }

            workouts.push({
                id: workoutId,
                type: String(record.type || 'Тренировка'),
                name: '',
                templateId: null,
                status: 'done',
                note: '',
                startedAt,
                finishedAt: startedAt + durationMs,
                plan,
                importedFrom: 'v1',
                updatedAt: startedAt
            });
        }

        return { exercises, workouts, sets, skipped };
    },

    /**
     * Разовый перенос истории версии 1 в базу (§37).
     *
     * Сервис базы приходит параметром, а не импортом: так этот файл остаётся
     * свободным от зависимости на хранилище, а тесты подставляют свой.
     *
     * Возвращает сводку переноса или null, если переносить нечего.
     */
    async runV1Import(dbService, storage = localStorage) {
        if (await dbService.getSetting('v1ImportedAt')) return null;

        const records = migrations.readV1(storage);

        if (records.length === 0) {
            // Отмечаем и в этом случае: проверять localStorage при каждом
            // запуске незачем, данным версии 1 взяться уже неоткуда
            await dbService.setSetting('v1ImportedAt', Date.now());
            return null;
        }

        const known = await dbService.listExercises({ includeArchived: true });

        const result = migrations.convertV1(records, {
            newId: dbService.newId,
            knownExercises: known.map((e) => ({ id: e.id, nameKey: e.nameKey, kind: e.kind }))
        });

        await dbService.bulkImport(result);

        const summary = {
            workouts: result.workouts.length,
            sets: result.sets.length,
            exercises: result.exercises.length,
            skipped: result.skipped.length
        };

        await dbService.setSetting('v1ImportedAt', Date.now());
        await dbService.setSetting('v1ImportSummary', summary);

        // Исходные данные в localStorage не трогаем (§37): это единственная
        // копия до того, как заработает выгрузка и синхронизация
        return summary;
    },

    /** Чтение истории версии 1. Пустой массив, если её нет или она испорчена. */
    readV1(storage = localStorage) {
        try {
            const raw = storage.getItem(V1_KEY);
            if (!raw) return [];

            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
};
