/**
 * Стартовый экран (§29 ТЗ).
 *
 * Порядок блоков — по частоте нажатия, а не по важности темы. Сначала судьба
 * незавершённой тренировки (§18), потом способы начать новую — от самого
 * частого к самому редкому: повтор прошлой (§9), шаблоны (§8), тренировка
 * с нуля. Ярким выделен только последний пункт этой лестницы: он завершает
 * её и потому стоит внизу, где палец и так оказывается.
 *
 * Прогноза ритма здесь нет: он справка, а не действие, и на экране, с
 * которого начинают тренировку, занимал место, ничего не предлагая. Его
 * место — в «Постоянстве» на статистике, куда и ходят за такими числами
 * (§26.2).
 *
 * При незавершённой тренировке способы начать новую не показываются вовсе:
 * одновременно идёт только одна (§18), и вторая всё равно упёрлась бы в
 * вопрос о судьбе первой — а он уже задан здесь же, выше.
 */

import { ui } from '../core/ui.js';
import { actions } from '../core/actions.js';
import { dialog } from '../core/dialog.js';
import { dbService } from '../services/db.js';
import { engine } from '../core/engine.js';
import { rhythm } from '../core/rhythm.js';
import { stats } from '../core/stats.js';
import { format } from '../core/format.js';
import { dates } from '../core/dates.js';
import { t } from '../core/i18n.js';
import { app } from '../app.js';

const DAY = 86400000;

/**
 * Порог, после которого тренировку считаем забытой.
 *
 * Продолжать её нельзя: длительность считается от старта, и забытая с вечера
 * тренировка добавила бы к статистике десяток часов (§18).
 */
const STALE_MS = 12 * 60 * 60 * 1000;

/** Сколько упражнений перечислять, прежде чем свернуть остаток в «и ещё N». */
const NAMES_SHOWN = 3;

async function activeBlock() {
    const workout = await dbService.getActiveWorkout();
    if (!workout) return null;

    const sets = await dbService.listSets(workout.id);
    const totals = engine.totals(workout.plan, sets);
    const stale = Date.now() - workout.startedAt > STALE_MS;

    // Завершение и удаление — ссылками, а не кнопками: они нужны в одном
    // случае из десяти, а кнопкой выглядели наравне с продолжением
    const drop = ui.html`
        <button class="link-btn is-danger" data-action="home-drop" data-id="${workout.id}">${t('Удалить')}</button>
    `;

    return ui.html`
        <div class="section">
            <div class="section-title">${t('Незавершённая тренировка')}</div>

            <div class="card">
                <div class="active-type">${workout.type}</div>
                <div class="active-meta">
                    ${t('начата {день} в {время}', { день: dates.formatDayLabel(workout.startedAt, Date.now(), { lower: true }), время: dates.formatTime(workout.startedAt) })}
                    · ${t('{done} из {planned} подходов', { done: totals.done, planned: totals.planned })}
                </div>

                ${stale ? ui.html`
                    <p class="hint">${t('Прошло больше 12 часов. Продолжать её не стоит — время тренировки считается от старта.')}</p>
                    <button class="btn btn-accent" data-action="home-finish-stale" data-id="${workout.id}">
                        ${t('Завершить прошедшей датой')}
                    </button>
                    <div class="row-links">${drop}</div>
                ` : ui.html`
                    <!--
                        Интервальная тренировка живёт на своём экране (§50):
                        там отсчёт, а не поля ввода, и вести к обычному
                        выполнению значило бы показать пустую форму
                    -->
                    <button class="btn btn-accent btn-lg" data-action="nav"
                            data-screen="${workout.interval ? 'interval' : 'session'}">${t('Продолжить')}</button>
                    <div class="row-links">
                        <button class="link-btn" data-action="home-finish" data-id="${workout.id}">${t('Завершить как есть')}</button>
                        ${drop}
                    </div>
                `}
            </div>
        </div>
    `;
}

/** Названия упражнений тренировки: три и «ещё N», чтобы строка не разъезжалась. */
function exerciseLine(entry, names) {
    const list = (entry.exerciseIds || []).map((id) => names.get(id)).filter(Boolean);

    if (list.length === 0) return entry.workout.type;

    const shown = list.slice(0, NAMES_SHOWN).join(' · ');
    return list.length > NAMES_SHOWN ? `${shown} ${t('и ещё {n}', { n: list.length - NAMES_SHOWN })}` : shown;
}

/**
 * Как назвать состав на плашке.
 *
 * Если такой набор упражнений уже сохранён шаблоном — его именем: человек
 * сам придумал ему название, и оно короче и понятнее любого перечисления.
 * Иначе перечислением, тем же, что на карточке повтора.
 */
function compositionName(group, names, templates) {
    const key = [...new Set(group.exerciseIds)].sort().join('|');

    const template = templates.find((tpl) =>
        [...new Set((tpl.items || []).map((i) => i.exerciseId))].sort().join('|') === key);

    if (template) return template.name;

    return exerciseLine({ exerciseIds: group.exerciseIds, workout: { type: t('Тренировка') } }, names);
}

/**
 * Способы начать: повтор прошлой, шаблоны, тренировка с нуля.
 *
 * Лестница от частого к редкому. Повтор стоит первым, но оформлен спокойно:
 * ярких пятен на экране должно быть одно, и оно отдано кнопке внизу, которая
 * завершает перебор. На самом повторе крупно — упражнения: по ним узнают
 * тренировку, а тип и дата это лишь уточняют.
 */
function startBlock(last, templates, suggestion, names, due, frequent) {

    // Подсказка чередования полезна, только если предлагает не то же самое,
    // что кнопка повтора: иначе она повторяет её же словами
    const differs = suggestion && (!last || suggestion.type !== last.workout.type);

    // Подсказка называет тип тренировки, а у шаблона тип может быть общим
    // («Силовая») при говорящем названии («Ноги») — поэтому сверяем и с ним
    const suggests = (t) => differs && (t.type === suggestion.type || t.name === suggestion.type);

    /*
     * Быстрый старт: то, что человек делает чаще всего (§29.1).
     *
     * Раньше здесь стояли шаблоны — но шаблон надо сначала завести, а
     * повторяющийся состав виден и без этого, прямо из истории. У того, кто
     * шаблонов не создавал, строка была пуста, хотя одну и ту же тренировку
     * он проводил семь раз подряд.
     *
     * Шаблоны остаются запасным вариантом: пока истории мало, показывать
     * нечего, а строка пустой быть не должна.
     */
    const chips = frequent.length
        ? frequent.map((f) => ui.html`
            <button class="chip" data-action="home-like" data-id="${f.workoutId}">
                ${compositionName(f, names, templates)}
                <span class="chip-count">×${String(f.count)}</span>
            </button>
        `)
        : templates.slice(0, 4).map((t) => ui.html`
            <button class="chip ${suggests(t) ? 'is-active' : ''}"
                    data-action="home-template" data-id="${t.id}">${t.name}</button>
        `);

    /*
     * Чему пора по периодичности каждого упражнения (§26.2.3).
     *
     * Точнее подсказки по типу тренировки: тип у всех может быть один —
     * «Силовая», — и цикла в одинаковых значениях нет. Упражнения же
     * различаются всегда, и у каждого свой промежуток.
     */
    const dueNames = due.map((d) => names.get(d.exerciseId)).filter(Boolean);

    return ui.html`
        <div class="section">
            <div class="section-title">${t('Начать')}</div>

            ${last ? ui.html`
                <button class="repeat-card" data-action="nav-plan-repeat">
                    <span class="rep-label">${t('Повторить прошлую')}</span>
                    <span class="rep-names">${exerciseLine(last, names)}</span>
                    <span class="rep-meta">
                        ${last.workout.type}
                        · ${dates.formatDayLabel(last.workout.startedAt, Date.now(), { lower: true })}
                        · ${format.count(last.sets, format.WORDS.set)}
                    </span>
                </button>
            ` : ''}

            ${dueNames.length ? ui.html`
                <button class="due-card" data-action="nav-plan-due">
                    <span class="rep-label">${t('Пора по периодичности')}</span>
                    <span class="rep-names">${dueNames.join(' · ')}</span>
                    <span class="rep-meta">${t('собрать тренировку')}</span>
                </button>
            ` : differs ? ui.html`
                <p class="hint">
                    ${suggestion.reason === 'cycle'
                        ? t('По чередованию дальше — «{тип}»', { тип: suggestion.type })
                        : t('Дольше всего не было «{тип}»', { тип: suggestion.type })}
                </p>
            ` : ''}

            ${templates.length ? ui.html`<div class="chips">${chips}</div>` : ''}

            <button class="btn btn-ghost" data-action="nav" data-screen="templates">
                ${templates.length ? t('Все шаблоны') : t('Создать шаблон')}
            </button>

            <!--
                Не «начать»: кнопка ведёт на подбор упражнений, а сама
                тренировка стартует уже оттуда, второй кнопкой. Одинаковая
                надпись на двух разных действиях обещала первым нажатием
                то, чего оно не делает.

                Не глагол вовсе: «создай», «собери», «составь» — указания, а
                название того, что получится, ни к чему не обязывает. Рядом
                стоит «Повторить прошлую», и пара читается сама собой:
                прошлую — или новую.

                Так же названы такие же кнопки на пустом выполнении и на
                итогах: один переход — одно название.
            -->
            <button class="btn btn-accent btn-lg" data-action="nav" data-screen="plan">
                ${t('Новая тренировка')}
            </button>
        </div>
    `;
}

/**
 * Последние семь дней (§26).
 *
 * Скользящее окно, а не календарная неделя: в понедельник утром календарная
 * неделя пуста, и экран врал бы про спад, которого нет. Сегодня — всегда
 * крайняя правая клетка.
 */
function weekBlock(entries) {
    const now = Date.now();
    const today = dates.startOfDay(now);
    const from = today - 6 * DAY;

    const own = entries.filter((e) => e.workout.startedAt >= from);
    const trained = new Set(own.map((e) => dates.startOfDay(e.workout.startedAt)));

    const cells = [];
    for (let i = 0; i < 7; i++) {
        const day = from + i * DAY;
        const state = [
            trained.has(day) ? 'is-done' : '',
            day === today ? 'is-today' : ''
        ].filter(Boolean).join(' ');

        cells.push(ui.html`
            <div class="wk-day ${state}">${dates.WEEKDAYS_SHORT[dates.weekdayIndex(day)]}</div>
        `);
    }

    const sets = own.reduce((sum, e) => sum + e.sets, 0);
    const volume = own.reduce((sum, e) => sum + e.volume, 0);

    return ui.html`
        <div class="section">
            <div class="section-title">${t('Последние семь дней')}</div>

            <div class="card">
                <div class="week-strip">${cells}</div>

                <div class="tiles is-tight">
                    <div class="tile"><strong>${String(own.length)}</strong><span>${t('Тренировок')}</span></div>
                    <div class="tile"><strong>${String(sets)}</strong><span>${t('Подходов')}</span></div>
                    <div class="tile"><strong>${format.decimal(volume, 0)}</strong><span>${t('Тоннаж, кг')}</span></div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Вес тела (§25) — строкой, с переходом к записи в одно нажатие.
 *
 * Показывается только тем, кто уже отмечал вес: навязывать взвешивание тому,
 * кто его не ведёт, — значит занимать место просьбой, а не сведениями.
 * Запись открывает то же окно, что и на статистике: обработчик `body-add`
 * зарегистрирован там и, как и `nav`, доступен всему приложению.
 */
function bodyBlock(records) {
    if (records.length === 0) return null;

    const last = records[records.length - 1];
    const month = stats.bodyChange(records.filter((r) => r.at >= Date.now() - 30 * DAY));

    const sign = (v) => (v > 0 ? '+' : v < 0 ? '−' : '');

    return ui.html`
        <div class="section">
            <div class="section-title">${t('Вес тела')}</div>

            <button class="weight-row" data-action="body-add">
                <span class="w-value">${format.weight(last.weight)} <small>${t('кг')}</small></span>
                <span class="w-meta">
                    ${month && month.delta
                        ? `${sign(month.delta)}${format.weight(Math.abs(month.delta))} ${t('кг за месяц')} · `
                        : ''}${dates.formatDayLabel(last.at, Date.now(), { lower: true })}
                </span>
            </button>
        </div>
    `;
}

export const home = {

    title: 'Тренировка',
    nav: 'workout',

    async render() {
        const [active, entries, templates, exercises, body] = await Promise.all([
            activeBlock(),
            dbService.listWorkoutSummaries(),
            dbService.listTemplates(),
            dbService.listExercises({ includeArchived: true }),
            dbService.listBodyWeight()
        ]);

        const workouts = entries.map((e) => e.workout);
        const names = new Map(exercises.map((e) => [e.id, e.name]));

        // Архив — это «я это больше не делаю». Предлагать оттуда нельзя,
        // а просрочено оно сильнее всего (§26.2.3)
        const архив = new Set(exercises.filter((e) => e.archived).map((e) => e.id));

        return ui.html`
            ${ui.raw(ui.title(t('Тренировка')))}



            ${active || startBlock(
                entries[0],
                templates,
                rhythm.suggestType(workouts),
                names,
                rhythm.dueExercises(entries, Date.now(), { skip: архив }),
                rhythm.frequentWorkouts(entries)
            )}

            ${entries.length ? weekBlock(entries) : ''}

            ${bodyBlock(body) || ''}
        `;
    }
};

// ================== ДЕЙСТВИЯ ==================

actions.on('nav-summary', (el) => app.go('summary', el.dataset.id));
actions.on('nav-plan-repeat', () => app.go('plan', 'repeat'));
actions.on('nav-plan-due', () => app.go('plan', 'due'));
actions.on('home-template', (el) => app.go('plan', 'from', el.dataset.id));

/**
 * Начать такую же тренировку, как выбранная (§29.1).
 *
 * Ведёт туда же, куда повтор прошлой, только повторяется не последняя, а
 * названная плашкой: состав и веса берутся из неё.
 */
actions.on('home-like', (el) => app.go('plan', 'repeat', el.dataset.id));

actions.on('home-finish', async (el) => {
    const ok = await dialog.confirm({
        title: t('Завершить тренировку?'),
        text: t('Записанные подходы сохранятся, остальное останется невыполненным.'),
        confirmText: t('Завершить')
    });

    if (!ok) return;

    await dbService.finishWorkout(el.dataset.id);
    app.go('summary', el.dataset.id, 'done');
});

actions.on('home-finish-stale', async (el) => {
    const workout = await dbService.getWorkout(el.dataset.id);
    const sets = await dbService.listSets(workout.id);

    // Временем окончания берём последний записанный подход, а не «сейчас»:
    // иначе забытая тренировка получит десяток часов длительности
    const last = sets[sets.length - 1];
    const finishedAt = last?.performedAt || workout.startedAt;

    await dbService.finishWorkout(workout.id, finishedAt);
    app.go('summary', workout.id, 'done');
});

actions.on('home-drop', async (el) => {
    const ok = await dialog.confirm({
        title: t('Удалить тренировку?'),
        text: t('Всё записанное в ней пропадёт.'),
        confirmText: t('Удалить'),
        danger: true
    });

    if (!ok) return;

    await dbService.deleteWorkout(el.dataset.id);
    app.render();
});
