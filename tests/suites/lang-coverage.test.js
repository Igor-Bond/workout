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

import { describe, it, assert } from '../runner.js';
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
