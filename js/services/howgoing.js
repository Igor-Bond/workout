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

    for (const [id, список_занятий] of занятия.entries()) {
        const { verdict } = reserve.verdict(список_занятий);
        if (verdict) запас.push({ name: exercises[id]?.name || t('упражнение'), verdict });
    }

    const пульс = recovery.resting(замеры.rows, { now });

    const восстановление = progress.recovery({
        sleep: recovery.sleep(замеры.rows, { now }),
        resting: пульс ? { ...пульс, threshold: recovery.SHIFT } : null
    });

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
     */
    const повторений = (от, до) => рабочие
        .filter((s) => s.performedAt >= от && s.performedAt < до)
        .reduce((sum, s) => sum + (s.reps || 0), 0);

    return progress.describe({
        reserve: запас,
        recovery: восстановление,
        adherence: progress.adherence(дни, сделаноВ),
        volume: {
            current: повторений(сегодня - 6 * DAY, now + DAY),
            previous: повторений(сегодня - 13 * DAY, сегодня - 6 * DAY)
        }
    });
}
