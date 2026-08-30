/**
 * Перевод диалогов и ветвлений экрана (§53).
 *
 * Два слепых пятна проверки полноты, и оба нашлись не ею, а глазами.
 *
 * Первое: диалог не часть разметки экрана. Он открывается по действию, и
 * увидеть его можно, только нажав. Здесь диалоги подменяются на запись —
 * действие вызывается, окно не показывается, а весь его текст проверяется.
 *
 * Второе: экран показывает разное на разных данных. Карточка веса при пустой
 * истории говорит одно, при заполненной — другое, и вторая ветка проверялась
 * ровно ноль раз, потому что база для проверки веса не содержала. Поэтому
 * здесь несколько наборов данных, а не один.
 */

import { describe, it, assert } from '../runner.js';
import { screen, seed, workout, press, hasAction } from '../helpers/dom.js';
import { inLang, leftovers, TARGETS } from '../helpers/lang.js';
import { watchDialogs } from '../helpers/dialogs.js';
import { dbService } from '../../js/services/db.js';

import { home } from '../../js/modules/home.js';
import { stats } from '../../js/modules/stats.js';
import { history } from '../../js/modules/history.js';
import { exercises } from '../../js/modules/exercises.js';
import { templates } from '../../js/modules/templates.js';
import { session } from '../../js/modules/session.js';
import { summary } from '../../js/modules/summary.js';
import { recordsScreen } from '../../js/modules/records.js';
import { plan } from '../../js/modules/plan.js';
import { profile } from '../../js/modules/profile.js';
import { exercise as exerciseCard } from '../../js/modules/exercise.js';

/**
 * Действия, каждое из которых открывает окно.
 *
 * Список ведётся руками и потому неполон по определению — но неполный
 * список всё равно ловит то, чего не ловит ничто другое.
 */
const ДЕЙСТВИЯ = [
    ['вес тела', 'body-add', {}],
    ['длительность отдыха', 'rest-exact', {}],
    ['новое упражнение', 'ex-add', {}],
    ['новый шаблон', 'tpl-new', {}],
    ['отбор по упражнению', 'hist-exercise', {}]
];

describe('Перевод диалогов', () => {

    for (const lang of TARGETS) {
        it(`окна на «${lang}» переведены`, async () => {
            const ex = await seed({ name: 'Bench press', kind: 'weight', group: 'Chest' });
            await workout(ex, [[10, 60]], { type: 'Strength' });
            await dbService.setBodyWeight({ weight: 78 });

            const остатки = [];

            await inLang(lang, async () => {
                // Экраны рисуются заранее: часть действий читает состояние,
                // сложенное отрисовкой
                await screen(stats);
                await screen(exercises);
                await screen(templates);
                await screen(profile);
                await screen(history);

                for (const [название, действие, данные] of ДЕЙСТВИЯ) {
                    const найдено = await watchDialogs(() => press(действие, данные));
                    if (найдено.length) остатки.push(`${название}: ${найдено.join(' · ')}`);
                }
            });

            assert(остатки.length === 0, `в окнах остался русский:\n${остатки.join('\n')}`);
        });
    }
});

describe('Перевод на разных данных', () => {

    /**
     * Наборы данных, при которых экраны показывают разное.
     *
     * Каждый отвечает за ветку, которой при пустой базе просто нет: вес
     * отмечен или не отмечен, тренировка идёт или закончена, история пуста
     * или полна.
     */
    const НАБОРЫ = {
        'ни одного подхода': async () => seed({ name: 'Bench press', kind: 'weight', group: 'Chest' }),

        'есть история': async () => {
            const ex = await seed({ name: 'Bench press', kind: 'weight', group: 'Chest' });
            await workout(ex, [[10, 60], [8, 60]], { type: 'Strength' });
            return ex;
        },

        'своим весом': async () => {
            const ex = await seed({ name: 'Pull-ups', kind: 'reps', group: 'Back' });
            await workout(ex, [[8, 0], [6, 0]], { type: 'Strength' });
            return ex;
        },

        'отмечен вес тела': async () => {
            const ex = await seed({ name: 'Pull-ups', kind: 'reps', group: 'Back' });
            await workout(ex, [[8, 0]], { type: 'Strength' });

            // Два взвешивания: при одном не рисуется ни график, ни изменение
            await dbService.setBodyWeight({ weight: 80, at: Date.now() - 7 * 86400000 });
            await dbService.setBodyWeight({ weight: 78.5 });

            return ex;
        },

        'идёт тренировка': async () => {
            const ex = await seed({ name: 'Bench press', kind: 'weight', group: 'Chest' });
            await dbService.createWorkout({
                type: 'Strength',
                plan: [{ exerciseId: ex.id, plannedSets: 3, targetReps: 10, weight: 60, skipped: false }]
            });
            return ex;
        }
    };

    const ЭКРАНЫ = [
        ['Главная', home], ['Статистика', stats], ['История', history],
        ['Справочник', exercises], ['Рекорды', recordsScreen]
    ];

    for (const [набор, подготовить] of Object.entries(НАБОРЫ)) {
        it(`«${набор}» — экраны переведены`, async () => {
            const остатки = [];

            for (const lang of TARGETS) {
                const ex = await подготовить();

                await inLang(lang, async () => {
                    for (const [название, экран] of ЭКРАНЫ) {
                        const found = leftovers(await screen(экран));
                        if (found.length) остатки.push(`${lang} ${название}: ${found.slice(0, 5).join(' · ')}`);
                    }

                    // Карточка упражнения — отдельно: её содержимое зависит и
                    // от вида упражнения, и от того, есть ли у него подходы
                    const карточка = leftovers(await screen(exerciseCard, [ex.id]));
                    if (карточка.length) остатки.push(`${lang} Карточка: ${карточка.slice(0, 5).join(' · ')}`);
                });
            }

            assert(остатки.length === 0, `не переведено:\n${остатки.join('\n')}`);
        });
    }

    /**
     * Интервальный режим включается на любом языке.
     *
     * Он опознавался по подписи типа, а подпись переводится: по-немецки тип
     * называется Tabata, сравнение с «Табата» не совпадало, и режим не
     * включался вовсе — ни настроек отрезков, ни программы. Проверяется по
     * наличию готовых наборов: они есть только в карточке отрезков.
     */
    it('табата остаётся интервальной на любом языке', async () => {
        await seed({ name: 'Burpees', kind: 'reps', group: 'Ganzkörper' });

        for (const lang of TARGETS) {
            await inLang(lang, async () => {
                await screen(plan);
                await press('plan-type', { type: 'Табата' });

                assert(hasAction(await screen(plan), 'plan-preset'),
                    `${lang}: отрезки не появились — интервальный режим не включился`);

                // Тип возвращается на место: черновик живёт в модуле и
                // переехал бы в следующую проверку
                await press('plan-type', { type: 'Силовая' });
            });
        }
    });

    /*
     * Выполнение и итоги — на настоящей тренировке, а не на пустой: поля
     * ввода, прошлый результат и рекорд появляются только там, где есть с
     * чем сравнивать.
     */
    it('выполнение и итоги с историей переведены', async () => {
        const ex = await seed({ name: 'Bench press', kind: 'weight', group: 'Chest' });
        await workout(ex, [[10, 60], [8, 60]], { type: 'Strength' });

        const активная = await dbService.createWorkout({
            type: 'Strength',
            plan: [{ exerciseId: ex.id, plannedSets: 3, targetReps: 10, weight: 60, skipped: false }]
        });

        await dbService.addSet({
            workoutId: активная.id, exerciseId: ex.id, order: 1, setNumber: 1, reps: 10, weight: 62.5
        });

        const остатки = [];

        for (const lang of TARGETS) {
            await inLang(lang, async () => {
                const наВыполнении = leftovers(await screen(session, [активная.id]));
                if (наВыполнении.length) остатки.push(`${lang} выполнение: ${наВыполнении.slice(0, 5).join(' · ')}`);

                const вИтогах = leftovers(await screen(summary, [активная.id, 'done']));
                if (вИтогах.length) остатки.push(`${lang} итоги: ${вИтогах.slice(0, 5).join(' · ')}`);
            });
        }

        assert(остатки.length === 0, `не переведено:\n${остатки.join('\n')}`);
    });
});
