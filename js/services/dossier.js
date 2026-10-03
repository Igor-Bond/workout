/**
 * Сводка дела — одна сборка на двоих (§55, §60, Р-210).
 *
 * Её читают двое: экран «Сводка для тренера», откуда текст копируют в чужую
 * переписку, и разговор с тренером внутри приложения, где он уходит первым
 * сообщением. Собиралась она дважды — одними и теми же двумя десятками
 * строк в двух модулях, — и это ровно то место, где второе написание
 * рано или поздно расходится с первым: добавь раздел в одну сборку и забудь
 * в другой, и тренер в приложении будет знать меньше, чем тренер в чужом окне.
 *
 * Здесь только сбор. Что и как написано, решает ядро (js/core/report.js) и
 * проверяется без базы: неверные числа в сводке выглядят так же убедительно,
 * как верные.
 */

import { dbService } from './db.js';
import { observations } from './howgoing.js';
import { report } from '../core/report.js';
import { estimate } from '../core/estimate.js';
import { isBackground } from '../core/rhythm.js';
import { athlete } from '../core/athlete.js';
import { planJournal } from '../core/journal-plan.js';
import { dates } from '../core/dates.js';
import { format } from '../core/format.js';
import { t } from '../core/i18n.js';
import { currentAthlete } from '../modules/athlete.js';
import { recoveryLines } from '../modules/watch.js';
import { currentJournal } from '../modules/planner.js';
import { питаниеСтроками } from '../modules/condition.js';

/**
 * Текст сводки.
 *
 * withRequest — приписывать ли задание (§55): в сводке для чужой переписки
 * оно обязательно, в разговоре внутри приложения спорило бы с вопросом
 * человека (§60).
 */
export async function сводкаДела({ withRequest = true } = {}) {
    const [entries, sets, exerciseList, weights, профиль, ход, питание, восстановление, журнал] = await Promise.all([
        dbService.listWorkoutSummaries(),
        dbService.allSets(),
        dbService.listExercises({ includeArchived: true }),
        dbService.listBodyWeight(),
        currentAthlete(),
        observations(),
        питаниеСтроками(),
        recoveryLines(),
        currentJournal()
    ]);

    return report.build({
        entries,
        sets,
        exercises: Object.fromEntries(exerciseList.map((e) => [e.id, e])),
        weights,
        shareOf: (exercise) => estimate.shareOf(exercise),
        background: isBackground,
        withRequest,

        // Справочник целиком, а не только сделанное за период (§55): иначе
        // подзабытое упражнение в план не попадёт никогда, а на его место
        // придут выдуманные названия
        catalogue: exerciseList.filter((e) => !e.archived && !athlete.excluded(профиль).has(e.id)),

        // Сон и пульс покоя с часов, если они привязаны (§62)
        recovery: восстановление,

        // Что и почему меняли в программе (§64): единственное, чего нет в числах
        journal: planJournal.describe(журнал, { format: (at) => dates.formatDate(at) }),

        /*
         * Как идёт программа (§63, Р-210): исполнение плана, объём, сон с
         * пульсом против прибавки. Без этого тренер правил программу, не зная,
         * что из пяти дней делается три.
         *
         * Запас сюда не идёт: он уже стоит в строке каждого упражнения, и
         * дважды названный он читался бы как два разных наблюдения.
         */
        progress: ход.filter((н) => н.topic !== 'reserve').map((н) => н.text),

        // Питание (§68, Р-210): съеденное против потолка и проверка весами
        nutrition: питание,

        // Объявленное в профиле — на случай пустой истории (Р-147)
        daysPerWeek: профиль?.days || null,

        // Профиль складывается в строки здесь: ядро не переводит и за
        // названиями упражнений в базу не ходит (§58)
        profile: athlete.describe(
            профиль,
            new Map(exerciseList.map((e) => [e.id, e.name])),
            {
                male: t('мужчина'),
                female: t('женщина'),
                // Слово при возрасте склоняется: «44 года», а не «44 лет» (Р-147)
                years: format.plural(athlete.age(профиль) || 0, format.WORDS.year),
                cm: t('см'),
                goal: t('Цель'),
                days: t('дней в неделю'),
                minutes: t('минут на тренировку'),
                equipment: t('Инвентарь'),
                limit: t('Ограничение'),
                exclude: t('нельзя'),
                prefer: t('взамен')
            }
        )
    });
}
