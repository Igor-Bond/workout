/**
 * Доли собственного веса (§15.2 ТЗ).
 *
 * Упражнение со своим весом не называет нагрузку числом: по записи
 * «25 отжиманий» о ней не сказать ничего. Приложение считает её само — доля
 * собственного веса, умноженная на вес тела в тот день, — и вся статистика
 * такого упражнения держится на этой доле.
 *
 * Долю надо было где-то показать и дать поправить. Таблица знает только
 * базовые названия: у заведённого самостоятельно упражнения берётся общая
 * по виду — две трети, — и она не знает ни про наклон в отжиманиях Тайсона,
 * ни про упор в скамью. Пока доля жила только в коде, человек видел
 * посчитанное по ней число и не мог ни проверить его, ни исправить.
 *
 * Доля не хранится в подходах — она свойство упражнения. Поэтому правка
 * пересчитывает всю историю разом, включая тренировки годичной давности:
 * править записанное руками не нужно и невозможно.
 */

import { ui } from '../core/ui.js';
import { actions } from '../core/actions.js';
import { dialog } from '../core/dialog.js';
import { dbService } from '../services/db.js';
import { estimate } from '../core/estimate.js';
import { format } from '../core/format.js';
import { t } from '../core/i18n.js';
import { app } from '../app.js';

/** Границы доли: ниже пятой части и выше полутора весов это уже не доля. */
const МИНИМУМ = 0.05;
const МАКСИМУМ = 1.5;

const процент = (доля) => Math.round(доля * 100);

/**
 * Строка упражнения.
 *
 * Кроме самой доли показывается, во что она превращается при нынешнем весе
 * тела: «65 % — это ≈ 60 кг» человек проверяет по себе, а «0,65» ни с чем
 * не сравнить.
 */
function row(exercise, { bodyWeight, weighted, подходов }) {
    const доля = estimate.shareOf(exercise);
    const своя = Number(exercise.bodyShare) > 0;
    const нагрузка = bodyWeight ? Math.round(доля * bodyWeight * 2) / 2 : 0;

    return ui.html`
        <div class="ex-row" data-id="${exercise.id}">
            <div class="ex-main">
                <button class="ex-name" data-action="share-open" data-id="${exercise.id}">
                    ${exercise.name}
                </button>
                <div class="ex-meta">
                    ${t('{доля} %', { доля: процент(доля) })}
                    ${своя ? ui.raw(` · ${ui.esc(t('своя'))}`) : ui.raw(` · ${ui.esc(t('из справочника'))}`)}
                    ${нагрузка ? ui.raw(` · ≈ ${ui.esc(format.weight(нагрузка))} ${ui.esc(t('кг'))}`) : ''}
                    ${подходов ? ui.raw(` · ${ui.esc(format.count(подходов, format.WORDS.set))}`) : ''}
                    ${exercise.archived ? ui.raw(` · ${ui.esc(t('в архиве'))}`) : ''}
                </div>

                <!--
                    Довес показывается только там, где он записан: для того,
                    кто пояса не надевал, это лишняя строка, а для того, кто
                    вписывал в это поле общую прикидку, — единственный способ
                    узнать, что она у него в тоннаже.
                -->
                ${weighted ? ui.html`
                    <div class="ex-meta">
                        ${t('дополнительный вес записан в {сколько} подходах', { сколько: weighted })}
                        <button class="link-btn" data-action="share-clear" data-id="${exercise.id}">
                            ${t('убрать')}
                        </button>
                    </div>
                ` : ''}
            </div>
            <div class="ex-actions">
                <button class="icon-btn" data-action="share-edit" data-id="${exercise.id}"
                        title="${t('Изменить долю')}">✎</button>
                ${своя
                    ? ui.raw(`<button class="icon-btn" data-action="share-reset" data-id="${ui.esc(exercise.id)}" title="${ui.esc(t('Вернуть как в справочнике'))}">↩</button>`)
                    : ''}
            </div>
        </div>
    `;
}

export const shares = {

    title: 'Доли своего веса',
    nav: 'profile',

    async render() {
        const [all, weights, sets] = await Promise.all([
            dbService.listExercises({ includeArchived: true }),
            dbService.listBodyWeight(),
            dbService.allSets()
        ]);

        // Только собственный вес: у снаряда нагрузка названа числом в самой
        // записи, и доли у неё нет
        const свои = all.filter((e) => e.kind === 'reps');

        const bodyWeight = weights[weights.length - 1]?.weight || 0;

        // Обе величины считаются одним проходом по подходам: запрос на
        // упражнение означал бы под сотню обращений к базе ради одного экрана
        const подходов = new Map();
        const weighted = new Map();

        for (const set of sets) {
            подходов.set(set.exerciseId, (подходов.get(set.exerciseId) || 0) + 1);
            if (set.weight) weighted.set(set.exerciseId, (weighted.get(set.exerciseId) || 0) + 1);
        }

        /*
         * Впереди то, что человек делает, а не весь базовый справочник по
         * алфавиту: в нём три десятка упражнений со своим весом, и своё
         * тонуло между «Австралийскими подтягиваниями» и «Велосипедом».
         */
        свои.sort((a, b) => (подходов.get(b.id) || 0) - (подходов.get(a.id) || 0)
            || a.name.localeCompare(b.name));

        return ui.html`
            ${ui.raw(ui.title(t('Доли своего веса'),
                t('Сколько собственного веса приходится на упражнение. По этой доле считается нагрузка и весь объём таких упражнений')))}

            ${bodyWeight ? '' : ui.html`
                <p class="hint">
                    ${t('Вес тела не отмечен, поэтому нагрузка не считается ни по какой доле.')}
                    <button class="link-btn" data-action="nav" data-screen="stats">${t('Отметить в статистике')}</button>
                </p>
            `}

            ${свои.length
                ? ui.html`<div class="ex-list">${свои.map((e) => row(e, {
                    bodyWeight, weighted: weighted.get(e.id), подходов: подходов.get(e.id) || 0
                }))}</div>`
                : ui.empty(t('Нет ни одного упражнения со своим весом.'))}

            <p class="hint">
                ${t('Отжимания — около двух третей веса, подтягивания — вес целиком, скручивания — треть. Правка пересчитывает всю историю: доля не записывается в подходы, а считается при показе.')}
            </p>

            <button class="btn btn-ghost" data-action="nav" data-screen="exercises">
                ${t('← В справочник')}
            </button>
        `;
    }
};

actions.on('share-open', (el) => app.go('exercise', el.dataset.id));

actions.on('share-edit', async (el) => {
    const exercise = await dbService.getExercise(el.dataset.id);
    if (!exercise) return;

    const было = процент(estimate.shareOf(exercise));

    const values = await dialog.form({
        title: exercise.name,
        text: t('Какая часть собственного веса приходится на это упражнение, в процентах.'),
        fields: [{ name: 'share', label: t('Доля, %'), type: 'number', value: было, required: true }]
    });

    if (!values) return;

    const доля = Number(values.share) / 100;

    if (!Number.isFinite(доля) || доля < МИНИМУМ || доля > МАКСИМУМ) {
        return dialog.alert({
            title: t('Не похоже на долю'),
            text: t('Ожидается от {от} до {до} процентов.', { от: процент(МИНИМУМ), до: процент(МАКСИМУМ) })
        });
    }

    await dbService.updateExercise(exercise.id, { bodyShare: доля });
    await app.render();
});

actions.on('share-reset', async (el) => {
    /*
     * Ноль, а не значение из таблицы: записанное число перестало бы следовать
     * за справочником, если тот однажды уточнят.
     *
     * И не undefined: обмен с облаком выкидывает пустые поля перед отправкой
     * (иначе Firestore не примет запись), и сброс не доехал бы до второго
     * устройства — там осталась бы прежняя своя доля.
     */
    await dbService.updateExercise(el.dataset.id, { bodyShare: 0 });
    await app.render();
});

actions.on('share-clear', async (el) => {
    const exercise = await dbService.getExercise(el.dataset.id);
    if (!exercise) return;

    const сколько = await dbService.countWeightedSets(exercise.id);

    const ok = await dialog.confirm({
        title: t('Убрать дополнительный вес?'),
        text: t('В {сколько} подходах упражнения «{упражнение}» записан дополнительный вес. Он считается тоннажем — как поднятое железо. Убрать его из всех подходов?', {
            сколько, упражнение: exercise.name
        }),
        confirmText: t('Убрать'),
        danger: true
    });

    if (!ok) return;

    const итог = await dbService.clearSetWeights(exercise.id);

    await app.render();

    await dialog.alert({
        title: t('Готово'),
        text: t('Дополнительный вес убран из {подходы} подходов, пересчитано тренировок: {тренировки}.', {
            подходы: итог.sets, тренировки: итог.workouts
        })
    });
});
