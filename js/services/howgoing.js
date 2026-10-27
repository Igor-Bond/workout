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
 * Где план не выполнен по числам и где перевыполнен (§63, Р-216, Р-220).
 *
 * Возвращает { недобор, перебор } — по одному разбору, потому что условия
 * зеркальные, а читают одни и те же данные.
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
export async function расхождения({ now = Date.now(), workoutId = null } = {}) {
    const [сводки, sets, список, план] = await Promise.all([
        dbService.listWorkoutSummaries(),
        dbService.allSets(),
        dbService.listExercises({ includeArchived: true }),
        currentPlan()
    ]);

    // Без действующего плана числа сверять не с чем и поправить нечего
    if (!план?.text || !planCore.active(план, now)) return { недобор: [], перебор: [] };

    const names = Object.fromEntries(список.map((e) => [e.id, e.name]));
    const упражнения = Object.fromEntries(список.map((e) => [e.id, e]));
    const строкиПлана = planCore.items(план);

    const свежие = сводки
        .map((e) => e.workout)
        .filter((w) => !isBackground(w) && w.plan?.length)
        .filter((w) => (workoutId ? w.id === workoutId : w.startedAt >= now - 14 * DAY))
        .sort((a, b) => b.startedAt - a.startedAt);

    const увиденные = new Set();
    const недобор = [];
    const перебор = [];

    for (const w of свежие) {
        const состав = w.plan.filter((п) => !увиденные.has(п.exerciseId));

        for (const п of состав) увиденные.add(п.exerciseId);

        const свои = sets.filter((s) => s.workoutId === w.id && !s.deletedAt);

        // Делалось ли упражнение до этой тренировки: первый раз — отдельная новость
        const раньше = new Set(
            sets.filter((s) => !s.deletedAt && s.workoutId !== w.id && s.performedAt < w.startedAt)
                .map((s) => s.exerciseId)
        );

        /*
         * Упражнения на время в минутах не меряем (Р-220): в плане «Баскетбол
         * 1 × 90» девяносто — минуты, а подход записан в секундах, и перевод
         * числа плана в секунды и обратно здесь только прибавил бы ошибок.
         * Планка и прочее в секундах считаются как повторения.
         */
        const меряем = состав.filter((п) => упражнения[п.exerciseId]?.timeUnit !== 'min');

        const стоит = (н) => строкиПлана.some((с) => planCore.same(с.name, н.name) && Number(с.reps) === н.target);

        for (const н of progress.shortfall(меряем, свои, { names, earlier: раньше })) {
            if (стоит(н)) недобор.push(н);
        }

        const способы = Object.fromEntries(меряем.map((п) => [
            п.exerciseId,
            reserve.step(упражнения[п.exerciseId] || {}, [свои.filter((s) => s.exerciseId === п.exerciseId)])
        ]));

        for (const н of progress.overshoot(меряем, свои, { names, earlier: раньше, steps: способы })) {
            if (стоит(н)) перебор.push(н);
        }
    }

    return { недобор, перебор };
}

/** Только недоборы — прежнее имя, чтобы остальным не пришлось ничего менять (Р-216). */
export async function недоборы(параметры = {}) {
    return (await расхождения(параметры)).недобор;
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

    /*
     * Сколько у упражнения занятий за всё время (Р-219) — по рабочим подходам,
     * без зарядки. Одно занятие значит «впервые»: число для такого упражнения
     * составитель плана взял из головы, и ждать второго занятия, чтобы это
     * сказать, нечего.
     */
    const занятийВсего = new Map();

    for (const s of рабочие) {
        if (!занятийВсего.has(s.exerciseId)) занятийВсего.set(s.exerciseId, new Set());
        занятийВсего.get(s.exerciseId).add(s.workoutId);
    }

    // Что план просил в последний раз, — по свежей тренировке, где упражнение было
    const цели = new Map();

    for (const e of [...сводки].sort((a, b) => b.workout.startedAt - a.workout.startedAt)) {
        if (isBackground(e.workout)) continue;

        for (const п of e.workout.plan || []) {
            if (!цели.has(п.exerciseId) && Number(п.targetReps) > 0) цели.set(п.exerciseId, Number(п.targetReps));
        }
    }

    const строкиПлана = план?.text ? planCore.items(план) : [];

    for (const [id, список_занятий] of поЧастоте) {
        const впервые = (занятийВсего.get(id)?.size || 0) <= 1;

        // Первый раз судим по одному занятию, знакомое упражнение — по двум (§59, Р-219)
        const { verdict } = reserve.verdict(список_занятий, { need: впервые ? 1 : reserve.NEED });

        // Способ прибавки — по тому, чем упражнение нагружено (Р-206)
        if (verdict) {
            const имя = exercises[id]?.name || t('упражнение');
            const сделано = (список_занятий[список_занятий.length - 1] || []).map((s) => s.reps).filter((r) => r > 0);
            const цель = цели.get(id);

            /*
             * «Поправить план» у «запас потерян» (Р-219): цель чуть ниже, одним
             * нажатием. Только пока то же число стоит в действующем плане —
             * как и у недобора (Р-216): иначе поправить нечего.
             */
            const легче = verdict === 'easier' && цель && reserve.eased(цель)
                && строкиПлана.some((с) => planCore.same(с.name, имя) && Number(с.reps) === цель)
                ? { from: цель, to: reserve.eased(цель), done: сделано }
                : null;

            запас.push({
                name: имя,
                verdict,
                first: впервые,
                lower: легче,
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
        ? planCore.expand(план, { from: dates.addDays(сегодня, -13), days: 14 })
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

    // Недобор и перевыполнение плана по числам (Р-216, Р-220)
    const { недобор, перебор } = await расхождения({ now });

    // Границы окон — календарные, а не кратные 86 400 секундам (Р-218)
    const неделяНазад = dates.addDays(сегодня, -7);
    const двеНедели = dates.addDays(сегодня, -14);

    return progress.describe({
        reserve: запас,
        shortfalls: недобор,
        overshoots: перебор,
        recovery: восстановление,
        adherence: progress.adherence(дни, сделаноВ, { from: dates.addDays(сегодня, -13), to: сегодня }),
        volume: {
            current: повторений(неделяНазад, сегодня),
            previous: повторений(двеНедели, неделяНазад),
            currentDays: дней(неделяНазад, сегодня),
            previousDays: дней(двеНедели, неделяНазад)
        }
    });
}
