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
 * Что сейчас происходит с весами — полосой поверх любого экрана (§65, Р-110).
 *
 * Разговор идёт секундами и требует от человека встать на весы и выбрать на
 * них своё место. Молчащее приложение в эти секунды неотличимо от сломанного,
 * и человек уходит, не дождавшись.
 *
 * Полосой, а не строкой в карточке веса: окно записи открывается и с главного
 * экрана, и оттуда строка в разметке статистики не видна вовсе — главная
 * просьба «встаньте на весы» не доходила до того, кому она сказана.
 *
 * Обновляется на месте, без перерисовки: перерисовка посреди разговора стёрла
 * бы то, что человек набирает в это время на другом экране.
 */
function полосаВесов(текст) {
    if (!текст) return app.hideBanner('scale');

    const висит = document.querySelector('[data-banner="scale"] span');

    if (висит) {
        висит.textContent = текст;
        return;
    }

    app.showBanner('scale', ui.html`<span>${текст}</span>`);
}

/**
 * Тоннаж коротко: «112 т» вместо «111 560 кг» (Р-116).
 *
 * В подписи полосы места на девять знаков нет — число уезжало за край поля.
 * А точность здесь и не нужна: полосы сравнивают между собой, и «112 т» против
 * «51 т» отвечает на вопрос не хуже, чем сотни килограммов.
 */
function тонны(кг) {
    return кг >= 1000
        ? `${format.decimal(кг / 1000, кг >= 10000 ? 0 : 1)} ${t('т')}`
        : `${format.decimal(кг, 0)} ${t('кг')}`;
}

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

    /*
     * Отставшие данные названы здесь, а не только на экране часов (§62.3, Р-129).
     *
     * Привязка приложения часов к Intervals.icu отваливается — молча, и у
     * владельца она отвалилась целиком. Узнал он об этом только потому, что
     * его спросили: приложение продолжало показывать средние за неделю и
     * писать «Привезено сегодня» — правду про забор и неправду про то, о чём
     * спрашивают.
     *
     * Экран часов теперь говорит, что отстало и почему (Р-127, Р-128), но
     * заходят на него раз в месяц. Сказать надо там, куда смотрят: средние
     * недельные стареют тихо, и неделю спустя карточка описывает позапрошлую
     * жизнь, ничем этого не выдавая.
     */
    const СУТКИ = 86400000;

    const свежий = rows.reduce((m, r) => Math.max(m, r.date || 0), 0);

    const отстал = свежий
        ? Math.round((dates.startOfDay(Date.now()) - dates.startOfDay(свежий)) / СУТКИ)
        : null;

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

            <p class="hint ${отстал > 1 ? 'is-bad' : ''}">
                ${отстал > 1
                    ? t('Данные кончаются на {день} — новее с часов не приходило. Проверьте привязку в приложении часов.', {
                        день: dates.formatDate(свежий)
                    })
                    : t('Среднее за неделю. Привезено {когда}.', {
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
                }], { height: 130, unit: t('кг'), minSpan: 2 }) : ''}

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
                    }], { height: 110, unit: t('см'), minSpan: 4 })}
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


            <!--
                Кнопка одна (Р-108). Весы живут внутри окна записи, рядом с
                полем веса: это не два дела, а два способа заполнить одно и то
                же поле. Отдельная кнопка на карточке заставляла бы решать,
                чем сегодня взвешиваться, ещё до того, как человек посмотрел
                на поле, — и путала бы вход в запись с самой записью.
            -->
            <button class="btn btn-ghost btn-sm" data-action="body-add">
                ${last ? t('Отметить вес') : t('Отметить вес сегодня')}
            </button>
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
                ${ui.empty(t('Нет данных — сначала проведите тренировку.'))}
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
         * Приписка, ради которой отдельно считалась нагрузка собственным
         * весом, теперь безусловна (Р-121) — считать стало нечего.
         */

        const muscles = calc.muscleVolume(sets, exercises, current, { weights, shareOf });

        /*
         * Есть ли чем мерить объём (Р-114).
         *
         * У того, кто занимается только своим весом и ни разу не взвешивался,
         * тоннаж по группам весь нулевой: доля собственного веса считается от
         * веса тела, а его нет. Рисовать пустые полосы и называть это объёмом
         * — врать дважды, поэтому там карточка честно считает подходы и
         * называется по ним.
         */
        const тоннажЕсть = muscles.some((m) => m.volume > 0);

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
                    <!--
                        Слова целиком, а не обрубки капсом (§23, Р-124).

                        Рядом в той же сетке стоят «ТРЕНИРОВОК», «ПОДХОДОВ»,
                        «ПОВТОРЕНИЙ» — и тут же стояли «ПОДХ. / ТРЕН.» и
                        «ПОВТ. / ПОДХ.»: те же самые слова, обрезанные на
                        середине. Капс, разрядка и точки сокращения
                        складываются в шифр, а косая черта между обрубками
                        требует сообразить, что это деление; «ТРЕН.»
                        одинаково читается как тренировка, тренер и тренд.

                        Приложение тут же показывает, что умеет писать
                        «ПОДХОДОВ» целиком, — экономить буквы было незачем:
                        подпись переносится, и в колонку она встаёт двумя
                        строками.
                    -->
                    ${tile(t('Подходов за тренировку'), format.decimal(now.avgSets), change.avgSets)}
                    ${tile(t('Повторений за подход'), format.decimal(now.avgReps), change.avgReps)}
                    ${tile(t('Средняя длительность'), format.duration(now.avgDuration), change.avgDuration)}
                </div>

                <!--
                    Объяснение безусловное (§26.1, Р-121).

                    Оно стояло под условием bodyVolume — то есть показывалось
                    только тому, у кого есть нагрузка собственным весом. У
                    работающего с одним железом слова «тоннаж» не объяснял
                    никто и нигде. Условие тут вообще не к месту: строка
                    объясняет слово, а не состав числа.
                -->
                <p class="hint">
                    ${t('Тоннаж — сколько всего поднято: железо плюс доля собственного веса (у отжиманий — около двух третей).')}
                    <button class="link-btn" data-action="nav" data-screen="shares">${t('Доли своего веса')}</button>
                </p>

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

                <!--
                    Мерка названа вслух (Р-114). Три плитки из четырёх считают
                    по всей истории, четвёртая — по выбранному периоду, и
                    человек, поставивший «Месяц», читал их подряд как четыре
                    числа за месяц: «Рекорд недель 8» рядом с «Дней с
                    тренировкой 12» складывается в бессмыслицу, а заметить это
                    нечем. Переключил на «3 месяца» — три плитки не
                    шелохнулись, и это выглядело поломкой.
                -->
                <p class="hint">
                    ${t('Серии — за всю историю. «Дней с тренировкой» — за выбранный период.')}
                </p>

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
                    { months: monthLabels(heat), action: 'stats-heat-day' }
                )}

                <!--
                    Шкала с числами, а не «меньше — больше» (Р-118).

                    Насыщенность обещала «количество подходов», но какое
                    количество даёт какой цвет, не было сказано нигде: тёмная
                    клетка читалась как «мало», а насколько мало — на глаз.
                    Пороги названы, и карта из настроения становится мерой.
                -->
                <div class="heat-legend">
                    <span class="heat-key heat-0"></span>0
                    <span class="heat-key heat-1"></span>1–6
                    <span class="heat-key heat-2"></span>7–12
                    <span class="heat-key heat-3"></span>13–20
                    <span class="heat-key heat-4"></span>21+
                    <span class="heat-legend-unit">${t('подходов за день')}</span>
                </div>

                <p class="hint">${t('Насыщенность — по количеству подходов за день. Карта листается вбок и показывает всю историю, а не выбранный период.')}</p>
                <p class="hint heat-pick" aria-live="polite"></p>
            </div>

            <!--
                Перекос виден тоннажем, а не счётом подходов (§26.1, Р-114).

                Заголовок обещал объём, а в полосы уходило число подходов —
                голым числом, без единиц. Во всём остальном приложении «объём»
                значит килограммы: так названа плитка «Тоннаж», так считает
                история, так устроена карточка упражнения. А шесть тяжёлых
                подходов приседа и шесть лёгких на пресс давали одинаковые
                полосы — то есть карточка, ради которой перекос и смотрят, его
                как раз и не показывала.

                Килограммы считались рядом и выбрасывались: muscleVolume берёт
                и отягощение, и долю собственного веса (Р-52, Р-85).

                Подходы не пропали — они стоят рядом с тоннажем в подписи
                полосы: две мерки одного разреза отвечают на разные вопросы, и
                §26.1 просит обе.
            -->
            <div class="card">
                <div class="card-title">${t('Подходы по группам мышц')}</div>
                ${chart.hbars(
                    muscles.map((m) => ({
                        label: t(m.group),
                        value: m.sets,
                        тоннаж: m.volume
                    })),
                    { format: (v, d) => (d.тоннаж > 0 ? `${v} · ${тонны(d.тоннаж)}` : `${v}`) }
                )}
                <p class="hint">
                    ${тоннажЕсть
                        ? t('Полоса — подходы: они сравнимы у всех групп. Тоннаж стоит рядом там, где его есть из чего посчитать: у резинки сопротивление неизвестно, и тоннажа у неё нет.')
                        : t('Полоса — подходы. Тоннаж появится, когда будет отмечен вес тела или отягощение.')}
                </p>
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

/*
 * Нажатая клетка карты называет свой день (Р-118).
 *
 * Строкой под картой, а не всплывающей подсказкой: подсказка живёт под
 * курсором, а на телефоне курсора нет. Строка же читается одинаково везде и
 * никуда не исчезает, пока не нажали другую клетку.
 *
 * Правим узел, а не перерисовываем экран: перерисовка увела бы карту обратно
 * к сегодняшнему дню, и нажатие на клетку прошлого года само отматывало бы
 * от неё прочь.
 */
actions.on('stats-heat-day', (el) => {
    const строка = document.querySelector('.heat-pick');
    if (строка) строка.textContent = el.dataset.title || '';

    for (const клетка of document.querySelectorAll('.heat.is-picked')) клетка.classList.remove('is-picked');
    el.classList.add('is-picked');
});

actions.on('body-add', () => окноВеса());

/**
 * Окно записи веса — одно на оба способа (§65, Р-108).
 *
 * Весы стоят рядом с ручным вводом, а не отдельной кнопкой на карточке: это
 * не два дела, а два способа заполнить одно и то же поле. Отдельная кнопка
 * заставляла бы человека решать, чем он сегодня будет взвешиваться, ещё до
 * того, как он посмотрел на поле.
 *
 * Снятое с весов возвращается в это же окно заполненным: талию мерят той же
 * рукой и в ту же минуту (Р-88), и закрыть окно сразу после веса значило бы
 * потребовать открыть его снова.
 */
async function окноВеса(сВесовВес = null) {
    const today = await dbService.getBodyWeightOn(Date.now());
    const last = today || await dbService.lastBodyWeight();

    const values = await dialog.form({
        title: t('Вес тела'),
        text: today
            ? t('Сегодня вес уже отмечен — новое значение заменит прежнее.')
            : t('Одна запись на день: утреннее и вечернее взвешивание в графике превратились бы в шум.'),
        fields: [
            {
                name: 'weight', label: t('Вес, кг'), type: 'number', required: true,
                value: сВесовВес ?? last?.weight ?? ''
            },

            /*
             * Талия необязательна и стоит второй (Р-88): её мерят не каждый
             * раз, а требовать ленту ради взвешивания значило бы не получить
             * ни того, ни другого. Пустое поле прежний замер не стирает.
             */
            { name: 'waist', label: t('Талия, см (необязательно)'), type: 'number', value: today?.waist ?? '' },
            { name: 'note', label: t('Заметка (необязательно)'), value: today?.note || '' }
        ],
        confirmText: t('Сохранить'),

        // Кнопки нет там, где браузер не умеет разговаривать с устройствами:
        // в Firefox и на iPhone Web Bluetooth нет вовсе
        extra: scale.available() ? t('Снять с весов') : null
    });

    if (values === 'extra') return снятьСВесов();

    if (!values || !values.weight) return;

    await dbService.setBodyWeight({ weight: values.weight, waist: values.waist, note: values.note });
    app.render();
}

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
async function снятьСВесов() {
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
            onStatus: полосаВесов
        });

        полосаВесов('');

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

        /*
         * Возвращаемся в то же окно с уже вписанным весом.
         *
         * Талию мерят той же рукой и в ту же минуту, и человек, снявший вес,
         * стоит с лентой рядом. Закрыть окно сразу значило бы потребовать
         * открыть его снова ради одного числа. Отказ ничего не теряет: вес
         * уже записан.
         */
        await окноВеса(Math.round(последний.weight.weight * 10) / 10);
    } catch (e) {
        полосаВесов('');
        await app.render();

        /*
         * Неверный номер места забывается сразу (Р-110).
         *
         * Спрашивали его один раз в жизни, и ошибка в двузначном коде,
         * списанном с экрана весов, становилась приговором: окно с полями
         * открывалось только при пустой настройке, а стереть её было нечем —
         * «Сбросить настройки» чистит localStorage, а номер лежит в базе.
         * Спрашивать раз в жизни и не давать поправить — разные вещи.
         */
        if (e?.reason === 'user') {
            await dbService.setSetting(SCALE_USER, null);

            return dialog.alert({
                title: t('Весы не признали'),
                text: t('Номер места или код не подошли. Забыли их — нажмите «Снять с весов» ещё раз и введите заново. Весы показывают и то и другое в настройках пользователя.')
            });
        }

        await dialog.alert({ title: t('Весы не ответили'), text: e.message });
    }
}

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
