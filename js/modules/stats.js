/**
 * Статистика (§23–§27 ТЗ).
 *
 * Правило раздела: у каждого числа должен быть либо масштаб, либо
 * сравнение. Поэтому показатели идут с изменением к предыдущему периоду, а
 * распределения — графиками, а не списками цифр.
 */

import { ui } from '../core/ui.js';
import { actions } from '../core/actions.js';
import { dialog } from '../core/dialog.js';
import { dbService } from '../services/db.js';
import { stats as calc, NO_GROUP } from '../core/stats.js';
import { rhythm } from '../core/rhythm.js';
import { chart } from '../core/chart.js';
import { format } from '../core/format.js';
import { dates } from '../core/dates.js';
import { t, i18n } from '../core/i18n.js';
import { estimate } from '../core/estimate.js';
import { plan as planCore } from '../core/plan.js';
import { currentPlan, noteDecision, PLAN_KEY } from './planner.js';
import { reserve } from '../core/reserve.js';
import { haptics } from '../core/haptics.js';
import { observations } from '../services/howgoing.js';
import { putQuestion } from './coach.js';
import { app } from '../app.js';
import { currentWellness, currentActivities } from './watch.js';
import { recovery } from '../core/recovery.js';
import { effort } from '../core/effort.js';
import { ICU_STEPS_GOAL } from '../services/icu.js';
import { scale, SCALE_USER } from '../services/scale.js';

/** Выбранный период переживает уход на карточку упражнения и возврат. */
let period = 'month';

/**
 * Что сейчас происходит с весами (§65).
 *
 * Разговор с устройством идёт секундами и требует от человека встать на весы
 * и выбрать на них своё место. Молчащее приложение в эти секунды неотличимо
 * от сломанного, и человек уходит, не дождавшись.
 */
let сВесов = '';

/**
 * Плитка с показателем и изменением к предыдущему периоду (§23.1).
 *
 * Для длительности и тоннажа рост — это хорошо, для всех показателей здесь
 * тоже, поэтому отдельного «плохого роста» не бывает и цвет один на всех.
 */
function tile(label, value, change) {
    const delta = change?.delta;

    const sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
    const direction = delta > 0 ? 'is-up' : delta < 0 ? 'is-down' : '';

    return ui.html`
        <div class="tile">
            <strong>${value}</strong>
            <span>${label}</span>
            ${delta !== null && delta !== undefined && delta !== 0 ? ui.html`
                <span class="tile-delta ${direction}">
                    ${sign}${format.decimal(Math.abs(change.percent), 0)} %
                </span>
            ` : ''}
        </div>
    `;
}

/**
 * «июнь 2026» — для лучшего месяца (§23.1).
 *
 * Строчная буква только по-русски: месяц там имя нарицательное и посреди
 * фразы пишется малой. В английском и немецком это имя собственное, и
 * «juni 2026» читается как опечатка.
 */
function monthName(at) {
    const d = new Date(at);
    const month = dates.MONTHS_NOM[d.getMonth()];

    return `${i18n.lang === 'ru' ? month.toLowerCase() : month} ${d.getFullYear()}`;
}

/**
 * Карта открывается на сегодняшнем дне, а не на начале истории.
 *
 * Свежие недели справа — как на любом графике времени, — и без этого
 * человек каждый раз видел бы позапрошлый год и сам домотывал до «сейчас».
 */
function scrollHeatToToday() {
    const box = document.querySelector('.heatmap-scroll');
    if (box) box.scrollLeft = box.scrollWidth;
}

/** Подписи месяцев над тепловой картой: столбец — неделя. */
function monthLabels(days) {
    const labels = [];
    let lastMonth = -1;

    days.forEach((d, i) => {
        if (i % 7 !== 0) return;

        const month = new Date(d.day).getMonth();
        if (month === lastMonth) return;

        lastMonth = month;
        labels.push({ week: i / 7, label: dates.MONTHS_NOM[month].slice(0, 3) });
    });

    // Первая подпись часто налезает на край — она и так очевидна по второй
    return labels.slice(1);
}

/**
 * Что привезли часы — компактно, в статистике (§62.6, Р-91).
 *
 * Раньше это жило только на экране настройки часов, куда заходят один раз, и
 * в сводке тренеру. Выходило, что человек видит свой сон и пульс покоя реже
 * всех: тренер получает их каждую неделю, а хозяин — когда вспомнит.
 *
 * Здесь плитками, а не строками: числа в ряд читаются одним взглядом, как и
 * остальные плитки статистики. Толкование — то же самое, что уходит
 * собеседнику, и лежит оно строками ниже: два разных объяснения одних чисел
 * были бы двумя разными приложениями.
 *
 * Пусто — карточки нет вовсе: часы не у всех, и «нет данных» в разделе за
 * разделом это шум, а не сведения.
 */
async function часыБлок() {
    const [{ rows, at }, занятия, цель] = await Promise.all([
        currentWellness(),
        currentActivities(),
        dbService.getSetting(ICU_STEPS_GOAL, 0)
    ]);

    if (rows.length === 0 && занятия.length === 0) return null;

    const сон = recovery.sleep(rows);
    const пульс = recovery.resting(rows);
    const шаги = recovery.steps(rows);

    const свежие = effort.recent(занятия);
    const пульсЗанятий = свежие.length
        ? свежие.map((a) => Number(a.avgHr)).filter((v) => v > 0)
        : [];

    const средний = пульсЗанятий.length
        ? Math.round(пульсЗанятий.reduce((s, v) => s + v, 0) / пульсЗанятий.length)
        : 0;

    const выводы = [...recovery.describe(rows), ...effort.describe(занятия)];

    return ui.html`
        <div class="card">
            <div class="card-title">${t('С часов')}</div>

            <div class="tiles">
                <!--
                    Сон часами и минутами, а не «7:15:00»: секунды сна не
                    измеряют, а двоеточий в плитке и так хватает
                -->
                ${сон !== null ? tile(t('Сон'), t('{часы} ч {минуты} мин', {
                    часы: Math.floor(сон / 3600), минуты: Math.round((сон % 3600) / 60)
                })) : ''}
                <!--
                    У пульса покоя изменения в плитке нет намеренно: там рост
                    красится хорошим цветом, а у этой величины рост — плохой
                    знак. Сдвиг к обычному сказан словами строкой ниже.
                -->
                ${пульс ? tile(t('Пульс покоя'), String(пульс.now)) : ''}
                ${шаги !== null ? tile(t('Шаги в день'), format.decimal(Math.round(шаги), 0)) : ''}
                ${средний ? tile(t('Пульс занятий'), String(средний)) : ''}
                ${цель > 0 && шаги !== null
                    ? tile(t('Цель по шагам'), `${Math.min(999, Math.round((шаги / цель) * 100))} %`)
                    : ''}
            </div>

            ${выводы.map((с) => ui.html`<div class="plan-rule">${с}</div>`)}

            <p class="hint">
                ${t('Среднее за неделю. Привезено {когда}.', {
                    когда: dates.formatDayLabel(at, Date.now(), { lower: true })
                })}
                <button class="link-btn" data-action="nav" data-screen="watch">${t('Данные с часов')}</button>
            </p>
        </div>
    `;
}

/**
 * Дата для поля ввода и обратно (§26.3, Р-98).
 *
 * `input[type=date]` понимает только «2026-09-10» и отдаёт то же самое.
 * Разбирать его через `new Date(строка)` нельзя: такая строка читается как
 * UTC, и у тех, кто живёт западнее Гринвича, замер уезжал бы на день назад.
 */
function дляПоля(at) {
    const d = new Date(at);
    const два = (n) => String(n).padStart(2, '0');

    return `${d.getFullYear()}-${два(d.getMonth() + 1)}-${два(d.getDate())}`;
}

function изПоля(текст, запасной) {
    const m = String(текст || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return запасной;

    return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
}

/**
 * Вес тела (§26.3).
 *
 * Отдельная карточка, а не строка в общих показателях: это не результат
 * тренировок, а условие, в котором они проходят.
 */
function bodyBlock(weights, range) {
    const series = calc.bodySeries(weights, range);
    const change = calc.bodyChange(series);
    const last = weights[weights.length - 1];

    /*
     * Талия рядом с весом (Р-88).
     *
     * Весы отвечают не на тот вопрос, который задаёт человек, решивший убрать
     * живот: вес стоит, пока мышцы приходят на место ушедшего жира, — а
     * сантиметры уходят. Показывается только тем, кто мерит: пустая плитка с
     * прочерком звала бы вписать в неё что попало.
     */
    const талия = calc.bodySeries(weights, range, 'waist');
    const поТалии = calc.bodyChange(талия);
    const последняяТалия = талия[талия.length - 1];

    return ui.html`
        <div class="card">
            <div class="card-title">${t('Вес тела')}</div>

            ${last ? ui.html`
                <div class="tiles">
                    ${tile(t('Сейчас, кг'), format.weight(last.weight))}
                    ${change ? tile(
                        t('За период, кг'),
                        `${change.delta > 0 ? '+' : change.delta < 0 ? '−' : ''}${format.weight(Math.abs(change.delta))}`
                    ) : ''}
                    ${tile(t('Взвешиваний'), String(series.length))}

                    <!--
                        Жир показывается тем, у кого он есть (§65): его
                        привозят весы, и ровно он отвечает на вопрос, на
                        который вес молчит, — что именно уходит, пока стрелка
                        стоит. Плитки с прочерком тут не бывает по той же
                        причине, что и у талии.
                    -->
                    ${last.body?.fat ? tile(t('Жир, %'), format.decimal(last.body.fat, 1)) : ''}

                    ${последняяТалия ? tile(t('Талия, см'), format.weight(последняяТалия.weight)) : ''}
                    ${поТалии ? tile(
                        t('Талия за период, см'),
                        `${поТалии.delta > 0 ? '+' : поТалии.delta < 0 ? '−' : ''}${format.weight(Math.abs(поТалии.delta))}`
                    ) : ''}
                </div>

                ${series.length >= 2 ? chart.line([{
                    color: 'var(--purple)',
                    segments: [series.map((p) => ({
                        x: p.at, y: p.weight, key: String(p.at),
                        label: dates.formatShort(p.at)
                    }))]
                }], { height: 130 }) : ''}

                <!--
                    «За период» — величина, которую по одному числу не
                    прочесть, а ноль в ней и вовсе выглядит поломкой (Р-55).
                    Строка называет оба конца, из которых она посчитана, — и
                    заодно показывает случай, где сама величина молчит: между
                    первым и последним вес мог сходить туда и обратно.
                -->
                ${change ? ui.html`
                    <p class="hint">${t('За период — от первого взвешивания к последнему: {от} → {до} кг за {дни}.', {
                        от: format.weight(change.from),
                        до: format.weight(change.to),
                        дни: format.count(change.days, format.WORDS.day)
                    })}</p>
                ` : ''}

                <!--
                    Своя линия, а не вторая на графике веса (Р-88):
                    килограммы и сантиметры — величины разной природы, и
                    общая ось складывала бы их в одну картинку, где непонятно,
                    что именно пошло вниз.
                -->
                ${талия.length >= 2 ? ui.html`
                    <div class="chart-title">${t('Талия, см')}</div>
                    ${chart.line([{
                        color: 'var(--accent)',
                        segments: [талия.map((p) => ({
                            x: p.at, y: p.weight, key: `waist-${p.at}`,
                            label: dates.formatShort(p.at)
                        }))]
                    }], { height: 110 })}
                ` : ''}

                <p class="hint">${t('Последнее взвешивание — {день}.', { день: dates.formatDayLabel(last.at, Date.now(), { lower: true }) })}</p>

                <!--
                    Список замеров со правкой и удалением (Р-98).
                    Свёрнут: за год их полсотни, а нужны они в тот редкий раз,
                    когда в весе ошиблись цифрой. Свежие сверху — искать
                    ошибку идут в последнее, а не в позапрошлый год.
                -->
                <details class="guide">
                    <summary>${t('Все замеры — {n}', { n: weights.length })}</summary>
                    <div class="guide-body">
                        ${[...weights].reverse().map((r) => ui.html`
                            <div class="ex-row">
                                <div class="ex-main">
                                    <span class="ex-name">
                                        ${format.weight(r.weight)} ${t('кг')}${r.waist
                                            ? ` · ${format.weight(r.waist)} ${t('см')}`
                                            : ''}
                                    </span>
                                    <div class="ex-meta">
                                        ${dates.formatDayLabel(r.at, Date.now(), { lower: true })}${r.body?.fat
                                            ? ` · ${t('жир')} ${format.decimal(r.body.fat, 1)} %`
                                            : ''}${r.body?.water
                                            ? ` · ${t('вода')} ${format.decimal(r.body.water, 1)} ${t('кг')}`
                                            : ''}${r.note ? ` · ${r.note}` : ''}
                                    </div>
                                </div>
                                <div class="ex-actions">
                                    <button class="icon-btn" data-action="body-edit" data-id="${r.id}"
                                            title="${t('Изменить')}">✎</button>
                                    <button class="icon-btn is-danger" data-action="body-drop" data-id="${r.id}"
                                            title="${t('Убрать')}">×</button>
                                </div>
                            </div>
                        `)}
                    </div>
                </details>
            ` : ui.empty(t('Вес тела не отмечался. Он нужен, чтобы подтягивания и отжимания перестали считаться нулевой нагрузкой.'))}

            ${сВесов ? ui.html`<p class="hint">${сВесов}</p>` : ''}

            <div class="row-links">
                <button class="btn btn-ghost btn-sm" data-action="body-add">
                    ${last ? t('Отметить вес') : t('Отметить вес сегодня')}
                </button>

                <!--
                    Кнопка есть только там, где браузер умеет разговаривать с
                    устройствами (§65): в Firefox и на iPhone Web Bluetooth нет
                    вовсе, и обещать там снятие с весов значило бы отправить
                    человека за разочарованием.
                -->
                ${scale.available() ? ui.html`
                    <button class="btn btn-ghost btn-sm" data-action="scale-read">
                        ${t('Снять с весов')}
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}

/**
 * Карточка хода программы.
 *
 * Пустой не бывает: если сказать нечего, карточки нет вовсе. «Всё в порядке»
 * в приложении, которое смотрит на пять величин, читается как «оно не
 * работает», а молчание — как молчание.
 */
function ходБлок(наблюдения, планЕсть) {
    if (!наблюдения.length) return '';

    return ui.html`
        <div class="card">
            <div class="card-title">${t('Как идёт программа')}</div>

            <!--
                Кнопка рядом с наблюдением, а не одна на карточку (§63.1).
                Спрашивают о конкретном — «запас большой третье занятие», — а
                общий вопрос «как дела» человек всё равно допишет сам, и
                собеседник ответит общим же.
            -->
            ${наблюдения.map((н) => ui.html`
                <div class="plan-rule note-${н.kind}">
                    ${н.text}

                    <span class="row-links">
                        <!--
                            «Принять прибавку» стоит там же, где наблюдение
                            (§59.1): решение принимается по нему, и уводить
                            за ним на другой экран значило бы разрывать
                            единственное место, где видно и повод, и
                            последствие.
                        -->
                        ${н.action?.type === 'harder' && планЕсть ? ui.html`
                            <button class="link-btn" data-action="accept-harder" data-name="${н.action.name}">
                                ${t('принять прибавку')}
                            </button>
                        ` : ''}

                        <button class="link-btn" data-action="ask-coach" data-text="${н.text}">
                            ${t('спросить тренера')}
                        </button>
                    </span>
                </div>
            `)}


            <p class="hint">
                ${t('Приложение называет наблюдение и его основание — решаете вы.')}
            </p>
        </div>
    `;
}


export const stats = {

    title: 'Статистика',
    nav: 'stats',

    mount() {
        scrollHeatToToday();
    },

    async render() {
        const [сводки, sets, exerciseList, weights, объявленный] = await Promise.all([
            dbService.listWorkoutSummaries(),
            dbService.allSets(),
            dbService.listExercises({ includeArchived: true }),
            dbService.listBodyWeight(),
            currentPlan()
        ]);

        const shareOf = (exercise) => estimate.shareOf(exercise);

        /*
         * Тоннаж — вся нагрузка на мышцы, вместе с собственным весом (Р-52).
         *
         * Сводки пересчитываются здесь, до всего остального: на них держатся и
         * свод за период, и лучший месяц, и сравнение с прошлым периодом.
         * Пересчитай позже — и «лучший месяц по тоннажу» остался бы месяцем,
         * когда человек больше брался за железо, а не когда больше работал.
         */
        const entries = calc.withBodyLoad(
            сводки, sets,
            Object.fromEntries(exerciseList.map((e) => [e.id, e])),
            weights, shareOf
        );

        if (entries.length === 0) {
            /*
             * Часы и вес показываются и без тренировок: они про человека, а
             * не про подходы. Тому, кто ещё не занимался, но уже носит часы,
             * пустой раздел говорил бы, что приложение о нём ничего не знает.
             */
            return ui.html`
                ${ui.title(t('Статистика'))}
                ${ui.empty(t('Нет данных — сначала проведи тренировку.'))}
                ${(await часыБлок()) || ''}
                ${bodyBlock(weights, null)}
            `;
        }

        const exercises = Object.fromEntries(exerciseList.map((e) => [e.id, e]));
        const { current, previous } = calc.ranges(period);

        const now = calc.aggregate(entries, current);
        const was = previous ? calc.aggregate(entries, previous) : null;
        const change = calc.compare(now, was);

        // Лучший месяц считается по всей истории, а не по выбранному
        // периоду: «лучший за месяц» — бессмыслица (§23.1)
        const best = calc.bestMonth(entries);

        const days = calc.days(entries, current);
        const streaks = calc.streaks(calc.days(entries, null));
        const weekdays = calc.weekdays(entries, current);

        /*
         * Собственный вес отдельной плиткой не показывается (Р-52).
         *
         * Показывался — и рядом с полным тоннажем это выглядело как один и
         * тот же вес, названный дважды. Разбирать тоннаж на слагаемые здесь
         * незачем: у отдельного упражнения разбивка тривиальна, а на экране
         * периода она отвечает на вопрос, которого никто не задаёт.
         *
         * Величина считается только ради приписки: она объясняет, что в
         * тоннаж входит, и появляется, лишь когда собственный вес в нём есть.
         */
        const bodyVolume = calc.bodyVolume(sets, exercises, weights, current, shareOf);

        const muscles = calc.muscleVolume(sets, exercises, current, { weights, shareOf });
        const heat = calc.heatmap(entries);

        // Прогноз ритма (§26.2): справка к «Постоянству», а не действие
        const ритм = rhythm.analyze(entries.map((e) => e.workout));

        /*
         * При объявленном плане прогноз берётся из него (§56).
         *
         * Сделанное сегодня здесь не вычитается, в отличие от главного
         * экрана: там кнопка, и закрытый день с неё обязан исчезнуть, а
         * здесь справка — «сегодня по плану» остаётся верным и после того,
         * как день сделан.
         */
        const поПлану = planCore.active(объявленный)
            ? { today: planCore.today(объявленный), next: planCore.next(объявленный) }
            : null;

        const periodChips = calc.PERIODS.map((p) => ui.html`
            <button class="chip ${period === p.key ? 'is-active' : ''}"
                    data-action="stats-period" data-period="${p.key}">${t(p.label)}</button>
        `);

        // Объём последних тренировок: свежие справа, как на любом графике времени
        const recent = entries
            .filter((e) => calc.inRange(e.workout.startedAt, current))
            .slice(0, 12)
            .reverse()
            .map((e) => ({
                label: dates.formatShort(e.workout.startedAt),
                value: e.sets
            }));

        const ход = await observations();
        const часы = await часыБлок();

        return ui.html`
            ${ui.title(t('Статистика'))}

            ${ходБлок(ход, planCore.active(объявленный))}

            ${часы || ''}

            <div class="chips">${periodChips}</div>

            <div class="card">
                <div class="tiles">
                    ${tile(t('Тренировок'), String(now.workouts), change.workouts)}
                    ${tile(t('Подходов'), String(now.sets), change.sets)}
                    ${tile(t('Повторений'), String(now.reps), change.reps)}
                    ${tile(t('Тоннаж, кг'), format.decimal(now.volume, 0), change.volume)}
                    ${tile(t('Общее время'), format.duration(now.durationMs), change.durationMs)}
                    ${tile(t('Подх. / трен.'), format.decimal(now.avgSets), change.avgSets)}
                    ${tile(t('Повт. / подх.'), format.decimal(now.avgReps), change.avgReps)}
                    ${tile(t('Средняя длит.'), format.duration(now.avgDuration), change.avgDuration)}
                </div>

                ${bodyVolume ? ui.html`
                    <p class="hint">${t('Тоннаж — вся нагрузка: и отягощение, и собственный вес.')}</p>
                ` : ''}

                ${was ? ui.html`
                    <p class="hint">${t('Изменение — к предыдущему такому же периоду.')}</p>
                ` : ui.html`
                    <p class="hint">${t('Сравнивать не с чем: за всё время предыдущего периода нет.')}</p>
                `}

                ${best ? ui.html`
                    <div class="best-month">
                        <span class="best-label">${t('Лучший месяц за всё время')}</span>
                        <span>
                            ${monthName(best.byWorkouts.at)} —
                            ${format.count(best.byWorkouts.workouts, format.WORDS.workout)}
                        </span>
                        ${best.byVolume && best.byVolume.key !== best.byWorkouts.key ? ui.html`
                            <span>
                                ${t('по тоннажу {месяц} — {кг} кг', {
                                    месяц: monthName(best.byVolume.at),
                                    кг: format.decimal(best.byVolume.volume, 0)
                                })}
                            </span>
                        ` : best.byVolume ? ui.html`
                            <span>${t('он же лучший по тоннажу: {кг} кг', {
                                кг: format.decimal(best.byVolume.volume, 0)
                            })}</span>
                        ` : ''}
                    </div>
                ` : ''}
            </div>

            <div class="card">
                <div class="card-title">${t('Подходы по тренировкам')}</div>
                ${chart.bars(recent, { maxLabel: 5 })}
            </div>

            ${bodyBlock(weights, current)}

            <div class="card">
                <div class="card-title">${t('Постоянство')}</div>

                <div class="tiles">
                    ${tile(t('Недель подряд'), String(streaks.weeks))}
                    ${tile(t('Рекорд недель'), String(streaks.longestWeeks))}
                    ${tile(t('Дней подряд'), String(streaks.days))}
                    ${tile(t('Дней с тренировкой'), String(days.length))}
                </div>

                <div class="chart-title">${t('По дням недели')}</div>
                ${chart.bars(
                    dates.WEEKDAYS_SHORT.map((label, i) => ({ label, value: weekdays[i] })),
                    { height: 120, maxLabel: 3 }
                )}

                <!--
                    Прогноз ритма стоит здесь, а не на главном (§26.2).

                    Это справка, а не действие: нажать на неё нельзя, и на
                    экране, с которого начинают тренировку, она занимала
                    место, ничего не предлагая. Здесь она среди своих —
                    рядом с сериями и днями недели, за которыми сюда и
                    приходят.

                    Когда план объявлен, прогноз не гадает (§56). Сетка уже
                    назвала день недели, и выводить тот же день из медианы
                    промежутков значит подменять знание догадкой — да ещё и
                    расходиться с ней при первом же пропуске.

                    «Обычно раз в N» остаётся при обоих: это не прогноз, а
                    факт о прошлом, и рядом с планом он как раз показывает,
                    насколько человек в него попадает.
                -->
                ${поПлану ? ui.html`
                    <p class="hint">
                        ${поПлану.today
                            ? t('Сегодня по плану — {занятие}.', { занятие: planCore.describe(поПлану.today) })
                            : поПлану.next
                                ? t('Следующая по плану {день} — {занятие}.', {
                                    день: dates.formatDayLabel(поПлану.next.at, Date.now(), { lower: true }),
                                    занятие: planCore.describe(поПлану.next.session)
                                })
                                : t('До конца плана тренировок не запланировано.')}
                        ${ритм.enough ? t('Обычно раз в {n}', { n: format.count(ритм.medianInterval, format.WORDS.day) }) : ''}
                    </p>
                ` : ритм.enough ? ui.html`
                    <p class="hint">
                        ${ритм.state === 'overdue'
                            ? t('{n} без тренировки.', { n: format.count(ритм.daysSince, format.WORDS.day) })
                            : ритм.state === 'due'
                                ? t('Привычный промежуток вышел.')
                                : t('Следующая ожидается {день}.', { день: dates.formatDayLabel(ритм.nextAt, Date.now(), { lower: true }) })}
                        ${t('Обычно раз в {n}', { n: format.count(ритм.medianInterval, format.WORDS.day) })}${ритм.confidence === 'low' ? t(', ритм рваный — день примерный') : ''}
                    </p>
                ` : ''}
            </div>

            <div class="card">
                <div class="card-title">${t('По дням')}</div>

                ${chart.heatmap(
                    heat.map((d) => ({
                        ...d,
                        title: `${dates.formatDate(d.day)} — ${d.sets ? format.count(d.sets, format.WORDS.set) : t('без тренировки')}`
                    })),
                    { months: monthLabels(heat) }
                )}
                <p class="hint">${t('Насыщенность — по количеству подходов за день. Карта листается вбок.')}</p>
            </div>

            <div class="card">
                <div class="card-title">${t('Объём по группам мышц')}</div>
                ${chart.hbars(
                    muscles.map((m) => ({ label: t(m.group), value: m.sets })),
                    { format: (v) => `${v}` }
                )}
                ${muscles.some((m) => m.group === NO_GROUP) ? ui.html`
                    <p class="hint">
                        ${t('У части упражнений группа не указана.')}
                        <button class="link-btn" data-action="nav" data-screen="exercises">${t('Проставить в справочнике')}</button>
                    </p>
                ` : ''}
            </div>

            <button class="btn btn-ghost" data-action="nav" data-screen="records">${t('Личные рекорды')}</button>
        `;
    }
};

actions.on('stats-period', (el) => {
    period = el.dataset.period;
    app.render();
});

actions.on('body-add', async () => {
    const today = await dbService.getBodyWeightOn(Date.now());
    const last = today || await dbService.lastBodyWeight();

    const values = await dialog.form({
        title: t('Вес тела'),
        text: today
            ? t('Сегодня вес уже отмечен — новое значение заменит прежнее.')
            : t('Одна запись на день: утреннее и вечернее взвешивание в графике превратились бы в шум.'),
        fields: [
            { name: 'weight', label: t('Вес, кг'), type: 'number', required: true, value: last?.weight ?? '' },

            /*
             * Талия необязательна и стоит второй (Р-88): её мерят не каждый
             * раз, а требовать ленту ради взвешивания значило бы не получить
             * ни того, ни другого. Пустое поле прежний замер не стирает.
             */
            { name: 'waist', label: t('Талия, см (необязательно)'), type: 'number', value: today?.waist ?? '' },
            { name: 'note', label: t('Заметка (необязательно)'), value: today?.note || '' }
        ],
        confirmText: t('Сохранить')
    });

    if (!values || !values.weight) return;

    await dbService.setBodyWeight({ weight: values.weight, waist: values.waist, note: values.note });
    app.render();
});

/**
 * Снять вес с весов по Bluetooth (§65).
 *
 * Номер места и код спрашиваются один раз и живут в настройках этого
 * устройства. Завести место самому приложение не берётся, хотя профиль это
 * позволяет: заведённое так место не показывается на экране весов, а весы
 * перед измерением требуют, чтобы человек ткнул в своё, — и измерение уходит
 * в никуда. Место, заведённое кнопкой SET, весы показывают и принимают.
 *
 * Талию тут не спрашиваем: её мерят лентой и не каждый раз (Р-88), а
 * дописать её к готовой записи можно правкой.
 */
actions.on('scale-read', async () => {
    let свой = await dbService.getSetting(SCALE_USER, null);

    if (!свой?.index) {
        const values = await dialog.form({
            title: t('Весы'),
            text: t('Весы держат до восьми человек и без опознания молчат. Заведите себя на самих весах кнопкой SET — они покажут номер места и код сопряжения. Спрашиваем это один раз.'),
            fields: [
                { name: 'index', label: t('Номер места, 1–8'), type: 'number', required: true },
                { name: 'code', label: t('Код сопряжения'), type: 'number', required: true }
            ],
            confirmText: t('Сохранить')
        });

        if (!values?.index) return;

        свой = { index: Number(values.index), code: Number(values.code) };
        await dbService.setSetting(SCALE_USER, свой);
    }

    try {
        const замеры = await scale.read({
            index: свой.index,
            code: свой.code,
            onStatus: (текст) => { сВесов = текст; app.render(); }
        });

        сВесов = '';

        /*
         * Замеров может приехать несколько, и каждый ложится в свой день
         * (§65). Весы держат сделанное в памяти места и отдают накопленное
         * сразу, как только узнают человека: взвесился утром без телефона —
         * приедет утреннее, со своей же датой.
         */
        for (const { weight, body } of замеры) {
            await dbService.setBodyWeight({
                at: weight.at || Date.now(),
                weight: Math.round(weight.weight * 10) / 10,
                body: scale.keep(body)
            });
        }

        haptics.tap();
        await app.render();

        const последний = замеры[замеры.length - 1];

        await dialog.alert({
            title: t('Снято с весов'),
            text: [
                замеры.length > 1
                    ? t('Замеров принято: {n}. Последний:', { n: замеры.length })
                    : '',
                t('Вес: {кг} кг.', { кг: format.weight(последний.weight.weight) }),
                последний.body?.fat ? t('Жир {жир} %, вода {вода} кг, мышцы {мышцы} %.', {
                    жир: format.decimal(последний.body.fat, 1),
                    вода: format.decimal(последний.body.water, 1),
                    мышцы: format.decimal(последний.body.musclePercent, 1)
                }) : ''
            ].filter(Boolean).join(' ')
        });
    } catch (e) {
        сВесов = '';
        await app.render();

        await dialog.alert({ title: t('Весы не ответили'), text: e.message });
    }
});

/**
 * Правка замера (§26.3, Р-98).
 *
 * То же окно, что при записи, только с датой и с настоящей правкой: пустая
 * талия здесь убирает обхват, а не оставляет прежний. Ошибиться в весе на
 * цифру — обычное дело, и без правки запись оставалось только удалить, а
 * вписать её задним числом было нечем: запись всегда шла сегодняшним днём.
 */
actions.on('body-edit', async (el) => {
    const записи = await dbService.listBodyWeight();
    const запись = записи.find((r) => r.id === el.dataset.id);

    if (!запись) return;

    const values = await dialog.form({
        title: t('Замер {день}', { день: dates.formatDate(запись.at) }),
        text: t('Пустая талия уберёт обхват. Дату можно поправить — замер переедет на выбранный день.'),
        fields: [
            { name: 'date', label: t('Дата'), type: 'date', value: дляПоля(запись.at) },
            { name: 'weight', label: t('Вес, кг'), type: 'number', required: true, value: запись.weight },
            { name: 'waist', label: t('Талия, см (необязательно)'), type: 'number', value: запись.waist ?? '' },
            { name: 'note', label: t('Заметка (необязательно)'), value: запись.note || '' }
        ],
        confirmText: t('Сохранить')
    });

    if (!values || !values.weight) return;

    await dbService.updateBodyWeight(запись.id, {
        at: изПоля(values.date, запись.at),
        weight: values.weight,
        waist: values.waist,
        note: values.note
    });

    haptics.tap();
    app.render();
});

/**
 * Удаление замера (§26.3).
 *
 * С вопросом: график и «за период» считаются по этим точкам, и убранная
 * молча меняет обе величины. Мягко, как всё остальное, — иначе второе
 * устройство прислало бы её обратно.
 */
actions.on('body-drop', async (el) => {
    const записи = await dbService.listBodyWeight();
    const запись = записи.find((r) => r.id === el.dataset.id);

    if (!запись) return;

    const ok = await dialog.confirm({
        title: t('Убрать замер {день}?', { день: dates.formatDate(запись.at) }),
        text: t('{вес} кг. Он уйдёт из графика и из счёта за период.', { вес: format.weight(запись.weight) }),
        confirmText: t('Убрать')
    });

    if (!ok) return;

    await dbService.deleteBodyWeight(запись.id);
    haptics.tap();
    app.render();
});

/**
 * Спросить тренера об этом наблюдении (§63.1).
 *
 * Вопрос собирается здесь и кладётся в поле разговора, а не отправляется:
 * человек должен увидеть, о чём спрашивает, и дописать своё — «колено уже не
 * болит», «на этой неделе была командировка». Отправить за него значило бы
 * задать вопрос, которого он не задавал.
 */
actions.on('ask-coach', (el) => {
    putQuestion(t('Приложение заметило: «{наблюдение}» Что с этим делать?', {
        наблюдение: el.dataset.text
    }));

    app.go('coach');
});
/**
 * Принять прибавку (§59.1).
 *
 * Последнее звено цепочки: приложение заметило, что запас велик, знает, какими
 * станут числа, — и до сих пор человек шёл в план переписывать их руками, а
 * потом (если не забывал) записывал решение в журнал. Два захода там, где
 * довольно одного.
 *
 * Показываем конкретные числа, а не «снизь примерно на двадцать процентов»:
 * «было 6 × 50, станет 6 × 40» человек понимает сразу, а проценты будет
 * считать в уме стоя с резинкой.
 *
 * Правит только повторения. Подходы остаются: смена сопротивления — не смена
 * схемы, и трогать её приложение не вправе.
 */
actions.on('accept-harder', async (el) => {
    const имя = el.dataset.name;
    const план = await currentPlan();

    if (!имя || !план?.text) return;

    /*
     * Что станет с числами — считаем до вопроса, а не после.
     *
     * Спрашивать «принять прибавку?» и лишь потом показывать, что вышло,
     * значит просить согласия вслепую.
     */
    const пары = [];

    for (const у of planCore.items(план)) {
        if (!planCore.same(у.name, имя) || !у.reps || !у.sets) continue;

        const стало = reserve.lighter(у.reps);
        const строка = `${у.sets} × ${у.reps} → ${у.sets} × ${стало}`;

        if (стало && стало !== у.reps && !пары.includes(строка)) пары.push(строка);
    }

    if (пары.length === 0) {
        return dialog.alert({
            title: t('Нечего менять'),
            text: t('В плане нет «{упражнение}» с повторениями — поправьте его сами.', { упражнение: имя })
        });
    }

    const ok = await dialog.confirm({
        title: t('Сопротивление потяжелее'),
        text: [
            t('Возьмите резинку жёстче (или укоротите рычаг), а повторения приложение снизит на пятую часть:'),
            ...пары,
            t('Подходы остаются прежними. План будет поправлен, решение — записано.')
        ].join('\n'),
        confirmText: t('Принять')
    });

    if (!ok) return;

    const правленый = planCore.retune(план.text, имя, (r) => reserve.lighter(r));

    await dbService.setSetting(PLAN_KEY, { ...planCore.parse(правленый), text: правленый });

    await noteDecision({
        kind: 'change',
        text: t('{упражнение}: сопротивление потяжелее, повторения {пары}', { упражнение: имя, пары: пары.join('; ') }),
        why: t('два занятия подряд запас был большой')
    });

    haptics.tap();
    await app.render();
});
