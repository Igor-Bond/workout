/**
 * Полнота перевода (§53 ТЗ).
 *
 * Здесь решается, можно ли показывать выбор языка людям. Пока приложение
 * переведено наполовину, экран читается не как «часть ещё не готова», а как
 * сломанный, и признак i18n.ready держит переключатель скрытым.
 *
 * Проверка написана так, чтобы быть верной по обе стороны от этого признака.
 * Пока он ложен, она молча собирает список недоделанного и не падает —
 * падать было бы нечестно: работа объявлена незаконченной. Как только он
 * станет истинным, тот же список превратится в требование.
 *
 * Судить о полноте по списку ключей нельзя: забытая строка в ключи не
 * попадает. Поэтому мера прямая — нарисовать экран и посмотреть, осталась ли
 * в нём кириллица. База для проверки засеивается латиницей, поэтому всё
 * оставшееся — интерфейс, а не данные человека.
 */

import { describe, it, assert, equal } from '../runner.js';
import { screen, seed, workout } from '../helpers/dom.js';
import { inLang, leftovers, TARGETS } from '../helpers/lang.js';
import { i18n } from '../../js/core/i18n.js';
import { dbService } from '../../js/services/db.js';

import { home } from '../../js/modules/home.js';
import { plan } from '../../js/modules/plan.js';
import { summary } from '../../js/modules/summary.js';
import { session } from '../../js/modules/session.js';
import { intervalScreen } from '../../js/modules/interval.js';
import { history } from '../../js/modules/history.js';
import { calendar } from '../../js/modules/calendar.js';
import { stats } from '../../js/modules/stats.js';
import { recordsScreen } from '../../js/modules/records.js';
import { templates } from '../../js/modules/templates.js';
import { exercises } from '../../js/modules/exercises.js';
import { profile } from '../../js/modules/profile.js';
import { guide } from '../../js/modules/guide.js';
import { surveyScreen } from '../../js/modules/survey.js';

/** Экраны, которые обязаны переводиться целиком. */
const SCREENS = [
    ['Главная', home],
    ['План', plan],
    ['История', history],
    ['Календарь', calendar],
    ['Статистика', stats],
    ['Рекорды', recordsScreen],
    ['Шаблоны', templates],
    ['Справочник', exercises],
    ['Профиль', profile],
    ['Справка', guide],
    ['Отзыв', surveyScreen]
];

/**
 * База с латинскими данными.
 *
 * Иначе название упражнения и тип тренировки, записанные по-русски, попадут
 * в список недоделанного — и правильно попадут: отличить их от забытой
 * подписи разметка не позволяет. Проще не давать проверке повода.
 */
async function seedLatin() {
    const ex = await seed({ name: 'Bench press', kind: 'weight', group: 'Chest' });
    await workout(ex, [[10, 60], [8, 60]], { type: 'Strength' });
    return ex;
}

describe('Полнота перевода', () => {

    for (const lang of TARGETS) {
        it(`экраны на «${lang}» переведены целиком`, async () => {
            await seedLatin();

            const остатки = [];

            await inLang(lang, async () => {
                for (const [название, экран] of SCREENS) {
                    const view = await screen(экран);
                    const found = leftovers(view);

                    if (found.length) остатки.push(`${название}: ${found.slice(0, 6).join(' · ')}`);
                }
            });

            if (!i18n.ready) {
                // Работа объявлена незаконченной — падать нечестно, но
                // список недоделанного должен быть виден
                console.info(`[Перевод ${lang}] осталось экранов: ${остатки.length}`);
                остатки.forEach((line) => console.info(`  ${line}`));
                return;
            }

            assert(остатки.length === 0,
                `не переведено:\n${остатки.join('\n')}`);
        });
    }

    /*
     * Экраны, в которые обычным переходом не попасть: у них есть состояние —
     * незавершённая тренировка, идущая программа, только что законченная
     * тренировка. Именно в них и нашлись первые пропуски, когда проверка их
     * ещё не охватывала.
     */
    it('экраны с состоянием переведены', async () => {
        const ex = await seedLatin();

        const активная = await dbService.createWorkout({
            type: 'Strength',
            plan: [{ exerciseId: ex.id, plannedSets: 3, targetReps: 10, weight: 60, skipped: false }]
        });

        const остатки = [];

        const собрать = async (lang, название, экран, params = []) => {
            const found = leftovers(await screen(экран, params));
            if (found.length) остатки.push(`${lang} ${название}: ${found.slice(0, 6).join(' · ')}`);
        };

        for (const lang of TARGETS) {
            await inLang(lang, async () => {
                await собрать(lang, 'Выполнение', session, [активная.id]);

                await dbService.updateWorkout(активная.id, {
                    interval: { work: 20, rest: 10, rounds: 2, roundRest: 60, lead: 10 },
                    run: { state: 'idle', elapsed: 0, startedAt: null }
                });

                await собрать(lang, 'Программа', intervalScreen);
            });
        }

        await dbService.finishWorkout(активная.id);

        for (const lang of TARGETS) {
            await inLang(lang, async () => {
                await собрать(lang, 'Итоги', summary, [активная.id, 'done']);
            });
        }

        if (!i18n.ready) {
            остатки.forEach((line) => console.info(`  ${line}`));
            return;
        }

        assert(остатки.length === 0, `не переведено:\n${остатки.join('\n')}`);
    });
});

/*
 * Базовый справочник (§5, §53).
 *
 * Названия упражнений — данные, а не интерфейс: на них ссылается история, их
 * правит человек. Поэтому они не переводятся на лету, а ставятся один раз, на
 * языке первого запуска. Проверяется именно то, что видит открывший
 * приложение впервые.
 */
describe('Справочник на языке первого запуска', () => {

    for (const lang of TARGETS) {
        it(`на «${lang}» ставится целиком и без кириллицы`, async () => {
            await inLang(lang, async () => {
                await seed();

                /*
                 * Отметка о доставке сбрасывается: wipe() очищает таблицы, но
                 * база остаётся созданной, и наполнение при её создании уже не
                 * сработает. Ноль означает «не доставлено ничего» — то же
                 * состояние, что у открывшего приложение впервые.
                 */
                await dbService.setSetting('baseInstalled', 0);
                await dbService.installBaseExercises();

                const list = await dbService.listExercises({ includeArchived: true });
                const базовые = list.filter((e) => e.id.startsWith('base-'));

                assert(базовые.length >= 40, `поставлено всего ${базовые.length}`);

                const русские = базовые.filter((e) => /[А-Яа-яЁё]/.test(`${e.name} ${e.group} ${e.howTo || ''}`));
                assert(русские.length === 0,
                    `по-русски осталось ${русские.length}: ${русские.slice(0, 5).map((e) => e.name).join(', ')}`);

                // Описание техники — часть той же поставки: без него
                // упражнение приходится искать в интернете (§5.2)
                const сОписанием = базовые.filter((e) => e.howTo);
                assert(сОписанием.length === базовые.length,
                    `без описания осталось ${базовые.length - сОписанием.length}`);
            });
        });
    }

    /*
     * Поиск по названию должен находить то, что стоит в справочнике. Ключ
     * поиска выводится из показанного названия, а не из русского оригинала:
     * иначе человек, набравший «Bench press», завёл бы второе такое же
     * упражнение — совпадения приложение не увидело бы.
     */
    it('название из справочника находится поиском', async () => {
        await inLang('en', async () => {
            await seed();
            await dbService.setSetting('baseInstalled', 0);
            await dbService.installBaseExercises();

            const found = await dbService.findExerciseByName('Bench press');
            assert(!!found, 'поставленное упражнение обязано находиться по своему названию');
        });
    });
});

/*
 * Перевод справочника по просьбе (§53).
 *
 * Самое опасное действие во всём переводе: оно меняет данные человека.
 * Поэтому проверяется не то, что оно переводит, а то, чего оно не трогает.
 */
describe('Перевод базовых упражнений', () => {

    /** Русская база с двумя записями, которые трогать нельзя. */
    async function базаСоСвоим() {
        await inLang('ru', async () => {
            await seed();
            await dbService.setSetting('baseInstalled', 0);
            await dbService.installBaseExercises();

            await dbService.createExercise({ name: 'Моё упражнение', kind: 'reps', group: 'Своя группа' });

            const жим = await dbService.findExerciseByName('Жим лёжа');
            await dbService.updateExercise(жим.id, { name: 'Жим лёжа узким хватом' });
        });
    }

    it('переводит базовое и не трогает чужое', async () => {
        await базаСоСвоим();

        await inLang('de', async () => {
            const было = await dbService.countForeignBaseExercises();
            assert(было > 30, `переводить должно быть что: ${было}`);

            const renamed = await dbService.relocalizeBaseExercises();
            assert(renamed.length === было, `переведено ${renamed.length} из ${было}`);

            equal(await dbService.countForeignBaseExercises(), 0, 'после перевода чужого языка остаться не должно');

            const list = await dbService.listExercises({ includeArchived: true });

            assert(list.some((e) => e.name === 'Моё упражнение'),
                'своё упражнение переименовывать нельзя ни при каких условиях');
            assert(list.some((e) => e.name === 'Жим лёжа узким хватом'),
                'поправленное человеком название становится его — и остаётся');
        });
    });

    /*
     * История держится на идентификаторе, а не на названии. Если бы перевод
     * заводил новую запись, все подходы остались бы у старой — то есть
     * пропали бы из виду вместе с ней.
     */
    it('история переживает переименование', async () => {
        await inLang('ru', async () => {
            /*
             * Засев с другим названием намеренно: seed() заводит своё «Жим
             * лёжа» случайным идентификатором, и базовое с тем же названием
             * уже не поставится — а проверять надо именно базовое.
             */
            await seed({ name: 'Что-то своё', kind: 'reps' });
            await dbService.setSetting('baseInstalled', 0);
            await dbService.installBaseExercises();
        });

        const жим = await dbService.findExerciseByName('Жим лёжа');
        assert(жим.id.startsWith('base-'), 'проверяется базовое упражнение, а не заведённое засевом');
        await workout(жим, [[10, 60], [8, 60]], { type: 'Силовая' });

        const былоПодходов = await dbService.countSetsOfExercise(жим.id);

        await inLang('en', async () => {
            await dbService.relocalizeBaseExercises();

            const запись = await dbService.getExercise(жим.id);
            equal(запись.name, 'Bench press');
            equal(await dbService.countSetsOfExercise(жим.id), былоПодходов, 'подходы остаются при упражнении');
        });
    });
});
