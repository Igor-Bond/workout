/**
 * Сбор наблюдений о ходе программы (§63).
 *
 * Отдельным модулем, а не в экране статистики: наблюдения нужны двоим —
 * самому экрану и разговору с тренером, где из них собирается вопрос про
 * следующий этап (§63.1). Экран, который импортируют ради одной функции,
 * рано или поздно потянет за собой и всё остальное, что на нём есть.
 *
 * Здесь только сбор. Все пороги и все слова живут в ядре (js/core/progress.js)
 * и проверяются отдельно от базы: вывод «пора тяжелее» ошибается так же
 * убедительно, как и попадает.
 */

import { dbService } from './db.js';
import { progress } from '../core/progress.js';
import { reserve } from '../core/reserve.js';
import { recovery } from '../core/recovery.js';
import { report } from '../core/report.js';
import { plan as planCore } from '../core/plan.js';
import { isBackground } from '../core/rhythm.js';
import { dates } from '../core/dates.js';
import { t } from '../core/i18n.js';
import { currentPlan } from '../modules/planner.js';
import { currentWellness } from '../modules/watch.js';

const DAY = 86400000;

/** Признаки восстановления за неделю — одним счётом для всех, кто их читает. */
function восстановлениеНедели(rows, now) {
    const пульс = recovery.resting(rows, { now });

    return progress.recovery({
        sleep: recovery.sleep(rows, { now }),
        resting: пульс ? { ...пульс, threshold: recovery.SHIFT } : null
    });
}

/**
 * Против ли сон и пульс прибавки на этой неделе (§63, Р-206).
 *
 * Отдельно от наблюдений: тот же ответ нужен экрану выполнения. Совет «пора
 * тяжелее» стоит там у самой резинки, где решение и принимают, — и спорить с
 * доводом против он должен так же, как строка на статистике. Иначе одно и то
 * же приложение на одном экране говорило бы «подождите», а на другом —
 * «пора».
 */
export async function противПрибавки({ now = Date.now() } = {}) {
    const замеры = await currentWellness();
    const итог = восстановлениеНедели(замеры.rows, now);

    return итог.shortSleep && итог.highResting;
}

/**
 * Где план не выполнен по числам (§63, Р-216).
 *
 * Считается по составу самой тренировки — он хранит то, что план просил, —
 * но показывается только когда то же число ещё стоит в действующем плане.
 * Иначе «в плане 4 × 25» говорило бы про строку, которой уже нет: либо план
 * поправили, либо состав взят из прошлой тренировки, а не из плана, и
 * поправить там нечего.
 *
 * workoutId — только эта тренировка (экран итогов); без него — упражнения
 * последних двух недель, и у каждого берётся самая свежая тренировка, где оно
 * было: старый недобор, перекрытый хорошим занятием, больше не новость.
 */
export async function недоборы({ now = Date.now(), workoutId = null } = {}) {
    const [сводки, sets, список, план] = await Promise.all([
        dbService.listWorkoutSummaries(),
        dbService.allSets(),
        dbService.listExercises({ includeArchived: true }),
        currentPlan()
    ]);

    // Без действующего плана числа сверять не с чем и поправить нечего
    if (!план?.text || !planCore.active(план, now)) return [];

    const names = Object.fromEntries(список.map((e) => [e.id, e.name]));
    const строкиПлана = planCore.items(план);

    const свежие = сводки
        .map((e) => e.workout)
        .filter((w) => !isBackground(w) && w.plan?.length)
        .filter((w) => (workoutId ? w.id === workoutId : w.startedAt >= now - 14 * DAY))
        .sort((a, b) => b.startedAt - a.startedAt);

    const увиденные = new Set();
    const итог = [];

    for (const w of свежие) {
        const состав = w.plan.filter((п) => !увиденные.has(п.exerciseId));

        for (const п of состав) увиденные.add(п.exerciseId);

        const свои = sets.filter((s) => s.workoutId === w.id && !s.deletedAt);

        // Делалось ли упражнение до этой тренировки: первый раз — отдельная новость
        const раньше = new Set(
            sets.filter((s) => !s.deletedAt && s.workoutId !== w.id && s.performedAt < w.startedAt)
                .map((s) => s.exerciseId)
        );

        for (const н of progress.shortfall(состав, свои, { names, earlier: раньше })) {
            const стоит = строкиПлана.some((с) => planCore.same(с.name, н.name) && Number(с.reps) === н.target);
            if (стоит) итог.push(н);
        }
    }

    return итог;
}

/**
 * Наблюдения о том, как идёт программа.
 *
 * Возвращает [{ kind, text }] — пустой массив, если сказать нечего.
 */
export async function observations({ now = Date.now() } = {}) {
    const [сводки, sets, список, план, замеры] = await Promise.all([
        dbService.listWorkoutSummaries(),
        dbService.allSets(),
        dbService.listExercises({ includeArchived: true }),
        currentPlan(),
        currentWellness()
    ]);

    const exercises = Object.fromEntries(список.map((e) => [e.id, e]));
    const сегодня = dates.startOfDay(now);

    /*
     * Зарядка считается отдельно везде, где считается что-либо по нагрузке
     * (Р-33, Р-64, Р-66). Здесь тем более: утренний бицепс на сорок пять раз
     * закрыл бы собой и запас, и объём вечерней работы.
     */
    const фоновые = new Set(сводки.filter((e) => isBackground(e.workout)).map((e) => e.workout.id));
    const рабочие = sets.filter((s) => !s.deletedAt && !фоновые.has(s.workoutId));

    // Запас по каждому упражнению: правило прогрессии считается по нему (§59)
    const занятия = report.byExercise(рабочие.filter((s) => s.performedAt >= now - 28 * DAY));

    const запас = [];

    /*
     * Частые вперёд (Р-207): своей строкой называются только два, и это должны
     * быть основные упражнения программы, а не то, что база отдала первым.
     */
    const поЧастоте = [...занятия.entries()].sort((a, b) => b[1].length - a[1].length);

    for (const [id, список_занятий] of поЧастоте) {
        const { verdict } = reserve.verdict(список_занятий);

        // Способ прибавки — по тому, чем упражнение нагружено (Р-206)
        if (verdict) {
            запас.push({
                name: exercises[id]?.name || t('упражнение'),
                verdict,
                step: reserve.step(exercises[id] || {}, список_занятий)
            });
        }
    }

    const восстановление = восстановлениеНедели(замеры.rows, now);

    /*
     * Исполнение плана: прошедшие дни, сегодняшний не в счёт.
     *
     * Сегодня ещё не пропущено — вечер впереди, — и считать его невыполненным
     * значит упрекать человека в полдень за то, чего он не делал.
     */
    const сделаноВ = new Set(
        сводки
            .filter((e) => !isBackground(e.workout))
            .map((e) => dates.startOfDay(e.workout.startedAt))
    );

    const дни = planCore.active(план, now)
        ? planCore.expand(план, { from: сегодня - 13 * DAY, days: 14 })
            .filter((d) => dates.startOfDay(d.at) < сегодня)
            .map((d) => ({ day: dates.startOfDay(d.at), session: d.session }))
        : [];

    /*
     * Объём считаем повторениями: у работы с резинкой и своим весом железа
     * нет, и тоннаж молчал бы там, где нагрузка есть (§15.2).
     *
     * Сегодняшний день в счёт не идёт — ни в эту неделю, ни в прошлую (Р-73).
     * Он ещё не кончился: вечерняя тренировка впереди, а неделя уже посчитана
     * без неё, и приложение объявляло спад ровно в тот день, когда человек
     * собирался заниматься. Сравниваем семь полных дней с семью полными.
     */
    const повторений = (от, до) => рабочие
        .filter((s) => s.performedAt >= от && s.performedAt < до)
        .reduce((sum, s) => sum + (s.reps || 0), 0);

    /*
     * Сколько дней в окне вообще занимались (Р-162).
     *
     * Нужно затем, чтобы отличить прибавку от сравнения с полупустой
     * неделей: вдвое больше повторений при вдвое большем числе занятий — это
     * про прошлую неделю, а не про нынешнюю работу.
     */
    const дней = (от, до) => new Set(
        рабочие
            .filter((s) => s.performedAt >= от && s.performedAt < до)
            .map((s) => dates.startOfDay(s.performedAt))
    ).size;

    return progress.describe({
        reserve: запас,
        shortfalls: await недоборы({ now }),
        recovery: восстановление,
        adherence: progress.adherence(дни, сделаноВ, { from: сегодня - 13 * DAY, to: сегодня }),
        volume: {
            current: повторений(сегодня - 7 * DAY, сегодня),
            previous: повторений(сегодня - 14 * DAY, сегодня - 7 * DAY),
            currentDays: дней(сегодня - 7 * DAY, сегодня),
            previousDays: дней(сегодня - 14 * DAY, сегодня - 7 * DAY)
        }
    });
}
