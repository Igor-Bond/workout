/**
 * Экран плана (§56 ТЗ).
 *
 * Сюда вставляют текст плана — от тренера, от языковой модели или свой — и
 * здесь же видят, что из него понято. Утверждённый план ведёт главный экран:
 * «сегодня по плану» встаёт вместо очереди составов.
 *
 * Разбор и развёртка живут в ядре, здесь только показ, приём и утверждение.
 */

import { ui } from '../core/ui.js';
import { actions } from '../core/actions.js';
import { dialog } from '../core/dialog.js';
import { dbService } from '../services/db.js';
import { plan as ядро } from '../core/plan.js';
import { dates } from '../core/dates.js';
import { format } from '../core/format.js';
import { t } from '../core/i18n.js';
import { app } from '../app.js';

/** Черновик живёт в модуле: экран перерисовывается, а вставленный текст должен уцелеть. */
let черновик = null;

/** Ключ настройки, под которым лежит утверждённый план. */
export const PLAN_KEY = 'plan';

/** Прочитать утверждённый план. */
export const currentPlan = () => dbService.getSetting(PLAN_KEY, null);

function строкаДня(день) {
    const занятие = день.session;

    return ui.html`
        <div class="plan-day ${занятие ? '' : 'is-rest'}">
            <span class="plan-day-date">${dates.formatDayLabel(день.at)}</span>
            <span class="plan-day-body">${занятие ? ядро.describe(занятие) : t('отдых')}</span>
        </div>
    `;
}

export const planner = {

    title: 'План тренировок',
    nav: 'workout',

    async render() {
        const сохранённый = await currentPlan();
        

        const разобран = черновик
            ? ядро.parse(черновик.text)
            : сохранённый;

        const развёртка = разобран?.from ? ядро.expand(разобран, { days: 14 }) : [];

        return ui.html`
            ${ui.raw(ui.title(t('План тренировок'),
                t('Недельная сетка, которой приложение следует вместо того, чтобы угадывать ритм по истории')))}

            ${сохранённый && !черновик ? ui.html`
                <div class="card">
                    <div class="card-title">${t('Действует')}</div>
                    <p>${t('С {начало} по {конец}, {недели}.', {
                        начало: dates.formatDate(сохранённый.from),
                        конец: dates.formatDate(ядро.until(сохранённый)),
                        недели: format.count(сохранённый.weeks, format.WORDS.week)
                    })}</p>

                    ${сохранённый.stages?.length ? ui.html`
                        <p class="hint">${сохранённый.stages.join(' · ')}</p>
                    ` : ''}

                    <button class="btn btn-ghost btn-sm" data-action="sheet-drop">${t('Убрать план')}</button>
                </div>
            ` : ''}

            ${развёртка.length ? ui.html`
                <div class="card">
                    <div class="card-title">${t('Ближайшие две недели')}</div>
                    ${развёртка.map(строкаДня)}
                </div>
            ` : ''}

            ${разобран?.problems?.length ? ui.html`
                <div class="card">
                    <div class="card-title">${t('Не понято')}</div>
                    <p class="hint">${t('Эти строки приложение пропустило. Остальное разобрано.')}</p>
                    ${разобран.problems.map((s) => ui.html`<div class="plan-day is-rest">${s}</div>`)}
                </div>
            ` : ''}

            <!--
                Действующий план лежит в поле своим же текстом (§56).
                Он сохраняется вместе с разобранным именно за этим: иначе
                поправить одну строку значило бы найти переписку и вставить
                весь план заново, а поле при живом плане выглядело так,
                будто плана и нет.
            -->
            <div class="card">
                <div class="card-title">${сохранённый && !черновик ? t('Изменить план') : t('Вставить план')}</div>
                <p class="hint">
                    ${сохранённый && !черновик
                        ? t('Здесь лежит действующий план. Поправьте строку и нажмите «Разобрать» — увидите, что изменилось, прежде чем утверждать.')
                        : t('Попросите план в «Сводке для тренера» — там же есть образец ответа. Вставьте его сюда текстом или загрузите файлом.')}
                </p>

                <textarea id="plan-text" class="report-text" rows="12"
                          placeholder="${t('С 06.09.2026, 8 недель')}">${черновик?.text ?? сохранённый?.text ?? ''}</textarea>

                <div class="row-links">
                    <button class="btn btn-accent" data-action="sheet-parse">${t('Разобрать')}</button>
                    <label class="btn btn-ghost" for="plan-file">${t('Из файла')}</label>
                    <input type="file" id="plan-file" accept=".txt,.md,.csv,text/plain" hidden data-change="sheet-file">
                </div>

                ${черновик && ядро.usable(разобран) ? ui.html`
                    <button class="btn btn-accent btn-lg" data-action="sheet-apply">${t('Утвердить план')}</button>
                ` : ''}
            </div>

            <button class="btn btn-ghost" data-action="nav" data-screen="report">${t('Сводка для тренера')}</button>
        `;
    },

};

/*
 * Черновик не сбрасывается в unmount, хотя туда просится.
 *
 * unmount вызывается перед каждой отрисовкой, а не только при уходе с
 * экрана: «разобрать» ставило черновик, вызывало перерисовку — и та стирала
 * его прежде, чем показать. Кнопка выглядела мёртвой, хотя разбор проходил.
 *
 * Поэтому черновик живёт до утверждения или отказа. Вернувшемуся человеку он
 * покажет его же вставку, и это лучше пустого поля: текст он получил в
 * переписке и второй раз копировать не должен.
 */

actions.on('sheet-parse', async () => {
    const текст = document.getElementById('plan-text')?.value?.trim();

    if (!текст) {
        return dialog.alert({ title: t('Пусто'), text: t('Вставьте текст плана в поле.') });
    }

    const разобран = ядро.parse(текст);

    if (!ядро.usable(разобран)) {
        return dialog.alert({
            title: t('План не разобран'),
            text: t('Не нашлось ни даты начала, ни занятий по дням. Проверьте образец ответа в сводке.')
        });
    }

    черновик = { text: текст };
    await app.render();
});

actions.onChange('sheet-file', async (el) => {
    const файл = el.files?.[0];
    if (!файл) return;

    const текст = await файл.text();

    черновик = { text: текст };
    await app.render();

    // Тот же файл повторно не выберется, пока поле помнит прежний
    el.value = '';
});

actions.on('sheet-apply', async () => {
    const текст = document.getElementById('plan-text')?.value?.trim() || черновик?.text;
    const разобран = ядро.parse(текст || '');

    if (!ядро.usable(разобран)) return;

    await dbService.setSetting(PLAN_KEY, { ...разобран, text: текст });

    черновик = null;
    await app.render();

    await dialog.alert({
        title: t('План утверждён'),
        text: t('Главный экран будет вести по нему. Пропущенный день не переносится: сетка держится, а пропущенное вернётся через неделю на своём месте.')
    });
});

actions.on('sheet-drop', async () => {
    const ok = await dialog.confirm({
        title: t('Убрать план?'),
        text: t('Приложение вернётся к подсказкам по истории. Записанные тренировки не тронутся.'),
        confirmText: t('Убрать'),
        danger: true
    });

    if (!ok) return;

    await dbService.setSetting(PLAN_KEY, null);
    черновик = null;
    app.render();
});
