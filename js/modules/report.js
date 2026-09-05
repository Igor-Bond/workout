/**
 * Сводка для тренера (§55 ТЗ).
 *
 * Экран, который готовит два десятка строк о том, что человек делает: что,
 * как часто, каким объёмом, куда идёт вес тела. Их копируют и отдают тому,
 * кто составляет программу, — живому тренеру или языковой модели.
 *
 * Отдельно от резервной копии (§41) намеренно. Копия — это все данные для
 * переноса на другое устройство, тысячи строк с идентификаторами. Сводка —
 * это то, что человек прочтёт и поймёт: она короткая и без единого
 * служебного числа.
 *
 * Сам текст собирает ядро; здесь только показ и копирование.
 */

import { ui } from '../core/ui.js';
import { actions } from '../core/actions.js';
import { dialog } from '../core/dialog.js';
import { dbService } from '../services/db.js';
import { report as build } from '../core/report.js';
import { estimate } from '../core/estimate.js';
import { isBackground } from '../core/rhythm.js';
import { format } from '../core/format.js';
import { t } from '../core/i18n.js';

/** Готовый текст последней сборки — его копирует кнопка. */
let текст = '';

export const report = {

    title: 'Сводка для тренера',
    nav: 'profile',

    async render() {
        const [entries, sets, exerciseList, weights] = await Promise.all([
            dbService.listWorkoutSummaries(),
            dbService.allSets(),
            dbService.listExercises({ includeArchived: true }),
            dbService.listBodyWeight()
        ]);

        текст = build.build({
            entries,
            sets,
            exercises: Object.fromEntries(exerciseList.map((e) => [e.id, e])),
            weights,
            shareOf: (exercise) => estimate.shareOf(exercise),
            background: isBackground
        });

        return ui.html`
            ${ui.raw(ui.title(t('Сводка для тренера'),
                t('Что вы делаете, как часто и каким объёмом — за последние {недели}', {
                    недели: format.count(build.WEEKS, format.WORDS.week)
                })))}

            <div class="card">
                <p class="hint">
                    ${t('Скопируйте и отдайте тому, кто составляет программу: тренеру или ИИ. Здесь нет служебных чисел — только то, что читает человек.')}
                </p>

                <!--
                    Поле правимое, а не только для чтения. Задание в конце
                    сводки — заготовка: у кого-то другое число дней, кто-то
                    хочет иной срок или добавить условие. Править его перед
                    отправкой естественнее, чем в чужой переписке.

                    Заодно текст в поле выделяется и копируется руками там,
                    где буфер обмена недоступен: в установленном приложении
                    на iPhone так бывает.
                -->
                <textarea id="report-text" class="report-text" rows="22">${текст}</textarea>

                <button class="btn btn-accent" data-action="report-copy">${t('Скопировать')}</button>
            </div>

            <p class="hint">
                ${t('Данные никуда не уходят сами: пока вы не скопировали текст, он остаётся на устройстве.')}
            </p>

            <button class="btn btn-ghost" data-action="nav" data-screen="profile">${t('← В профиль')}</button>
        `;
    }
};

actions.on('report-copy', async () => {
    const поле = document.getElementById('report-text');

    /*
     * Сначала выделяем, потом копируем.
     *
     * Буфер обмена доступен не везде: в установленном приложении на iPhone
     * и без защищённого соединения его нет. Выделенный текст остаётся
     * рабочим запасным путём — его копируют пальцем.
     */
    поле?.select();

    try {
        // Из поля, а не из сборки: задание правят перед отправкой, и
        // копироваться должно то, что человек видит
        await navigator.clipboard.writeText(поле?.value ?? текст);
        await dialog.alert({ title: t('Скопировано'), text: t('Текст в буфере обмена — вставьте его в переписку.') });
    }
    catch (e) {
        console.warn('[Сводка] Буфер обмена недоступен:', e);
        await dialog.alert({
            title: t('Не вышло скопировать'),
            text: t('Браузер не дал доступ к буферу. Текст уже выделен — скопируйте его сами.')
        });
    }
});
