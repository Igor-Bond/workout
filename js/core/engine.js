/**
 * Движок тренировки (§4, §11, §13, §14, §19 ТЗ).
 *
 * Здесь нет ни базы, ни разметки — только вычисления над двумя величинами:
 * планом (что собирались делать) и журналом подходов (что сделали). Из этого
 * разделения следует всё остальное: свободный порядок, прогресс, подсказка
 * следующего шага и итоги.
 *
 * Отсутствие зависимостей не ради красоты: движок — то место, где ошибка
 * стоит дороже всего, и его надо гонять тестами на выдуманных данных.
 */

/** Состояние упражнения в текущей тренировке. */
export const STATE = {
    PENDING: 'pending',   // ни одного подхода
    ACTIVE:  'active',    // начато, но план не выполнен
    DONE:    'done',      // подходов не меньше запланированного
    SKIPPED: 'skipped',   // помечено пропущенным
    EXTRA:   'extra'      // добавлено по ходу, плана не было
};

export const engine = {

    STATE,

    /** Подходы одного упражнения в порядке фактического выполнения. */
    setsOf(sets, exerciseId) {
        return sets
            .filter((s) => s.exerciseId === exerciseId)
            .sort((a, b) => a.order - b.order);
    },

    /**
     * Прогресс по каждому упражнению: «Бицепс 2/3».
     *
     * В список попадают и упражнения, которых в плане не было: §14 разрешает
     * добавить упражнение посреди тренировки, и оно обязано быть видно.
     */
    progress(plan = [], sets = []) {
        const done = new Map();
        for (const set of sets) {
            done.set(set.exerciseId, (done.get(set.exerciseId) || 0) + 1);
        }

        const rows = plan.map((item) => {
            const count = done.get(item.exerciseId) || 0;

            return {
                exerciseId: item.exerciseId,
                planned: item.plannedSets,
                done: count,
                targetReps: item.targetReps ?? null,
                weight: item.weight || 0,
                state: item.skipped ? STATE.SKIPPED
                    : count === 0 ? STATE.PENDING
                    : count < item.plannedSets ? STATE.ACTIVE
                    : STATE.DONE
            };
        });

        const planned = new Set(plan.map((p) => p.exerciseId));

        for (const [exerciseId, count] of done) {
            if (planned.has(exerciseId)) continue;

            rows.push({
                exerciseId,
                planned: 0,
                done: count,
                targetReps: null,
                weight: 0,
                state: STATE.EXTRA
            });
        }

        return rows;
    },

    /**
     * Прогресс всей тренировки в подходах.
     *
     * Знаменатель — не сумма плана, а сумма того, что ещё имеет смысл
     * сделать. Три случая, где простая сумма врёт:
     *
     *   - упражнение пропущено: оставшиеся подходы делать уже не будут, но
     *     сделанные до пропуска — были, и они в числителе;
     *   - упражнение добавлено по ходу: плана у него нет, а подходы есть;
     *   - подходов сделали больше плановых.
     *
     * Во всех трёх числитель без поправки обгонял бы знаменатель, и на экране
     * появлялось бы «10 из 9».
     */
    totals(plan = [], sets = []) {
        const rows = engine.progress(plan, sets);

        return {
            done: sets.length,
            planned: rows.reduce((sum, r) => sum + (
                r.state === STATE.SKIPPED ? r.done : Math.max(r.planned, r.done)
            ), 0)
        };
    },

    /**
     * Что делать дальше в режиме «по плану» (§11.1).
     *
     * Первое незавершённое и непропущенное упражнение по порядку плана.
     * null означает, что план выполнен и тренировку можно завершать.
     */
    nextStep(plan = [], sets = []) {
        const rows = engine.progress(plan, sets);

        for (let i = 0; i < plan.length; i++) {
            const row = rows[i];
            if (row.state === STATE.SKIPPED || row.state === STATE.DONE) continue;

            return {
                exerciseId: row.exerciseId,
                setNumber: row.done + 1,
                planIndex: i
            };
        }

        return null;
    },

    /** Выполнен ли план целиком. */
    isComplete(plan = [], sets = []) {
        return engine.nextStep(plan, sets) === null;
    },

    /**
     * Сквозной номер следующего подхода. Именно он задаёт фактический
     * порядок выполнения, на котором держатся итоги и история (§4).
     */
    nextOrder(sets = []) {
        return sets.reduce((max, s) => Math.max(max, s.order || 0), 0) + 1;
    },

    /** Номер подхода внутри своего упражнения. */
    nextSetNumber(sets = [], exerciseId) {
        return engine.setsOf(sets, exerciseId).length + 1;
    },

    /**
     * Значения, которыми предзаполняются поля следующего подхода (§12).
     *
     * Берутся из последнего подхода этого упражнения в текущей тренировке,
     * а если его ещё не было — из плана. Повторять ввод одного и того же
     * веса на каждом подходе никто не должен.
     */
    prefill(plan = [], sets = [], exerciseId) {
        const own = engine.setsOf(sets, exerciseId);
        const last = own[own.length - 1];

        if (last) {
            return {
                reps: last.reps ?? null,
                weight: last.weight ?? null,
                duration: last.duration ?? null,
                distance: last.distance ?? null
            };
        }

        const item = plan.find((p) => p.exerciseId === exerciseId);

        return {
            reps: item?.targetReps ?? null,
            weight: item?.weight || null,
            duration: null,
            distance: null
        };
    },

    /**
     * Итоги тренировки (§19).
     *
     * exercises — справочник вида { id: { name, kind } }: движок не ходит в
     * базу, названия ему приносят.
     */
    summarize({ plan = [], sets = [], exercises = {}, durationMs = 0 }) {
        const rows = engine.progress(plan, sets);

        const blocks = rows
            .map((row) => {
                const own = engine.setsOf(sets, row.exerciseId);
                if (own.length === 0) return null;

                const info = exercises[row.exerciseId] || {};

                const reps = own.reduce((sum, s) => sum + (s.reps || 0), 0);
                const volume = own.reduce(
                    (sum, s) => sum + (s.weight ? (s.reps || 0) * s.weight : 0), 0
                );
                const duration = own.reduce((sum, s) => sum + (s.duration || 0), 0);
                const distance = own.reduce((sum, s) => sum + (s.distance || 0), 0);

                return {
                    exerciseId: row.exerciseId,
                    name: info.name || 'Упражнение',
                    kind: info.kind || 'weight',
                    planned: row.planned,
                    sets: own,
                    reps, volume, duration, distance
                };
            })
            .filter(Boolean);

        const setsCount = sets.length;
        const reps = blocks.reduce((sum, b) => sum + b.reps, 0);
        const volume = blocks.reduce((sum, b) => sum + b.volume, 0);

        return {
            blocks,
            totals: {
                exercises: blocks.length,
                sets: setsCount,
                reps,
                volume,
                hasWeight: volume > 0,
                avgReps: setsCount > 0 ? reps / setsCount : 0,
                durationMs
            }
        };
    }
};
