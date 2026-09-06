/**
 * Данные с часов (§62 ТЗ).
 *
 * Приложение считает нагрузку и ничего не знает о восстановлении, а
 * программа зависит от него не меньше: неделя коротких ночей и пульс покоя
 * выше обычного — это причина перенести тяжёлый день, а не «показалось».
 *
 * Часы Zepp наружу свои данные не отдают, а прямых путей больше нет: Google
 * Fit закрывает REST в конце 2026 года, Health Connect живёт только на
 * Android. Остаётся тот путь, который предлагает сам Zepp, — привязка
 * стороннего сервиса; из его списка открытый ключ на чтение есть у
 * Intervals.icu. Цепочка выходит в три звена, но настраивается один раз.
 *
 * Экран отдельный, а не строка в профиле: настройка требует объяснения — без
 * него «номер спортсмена» и «ключ» это два поля неизвестно от чего.
 */

import { ui } from '../core/ui.js';
import { actions } from '../core/actions.js';
import { dialog } from '../core/dialog.js';
import { dbService } from '../services/db.js';
import { icu, ICU_KEY, ICU_ATHLETE, ICU_DATA, ICU_ACTS, ICU_PUSH } from '../services/icu.js';
import { recovery } from '../core/recovery.js';
import { effort } from '../core/effort.js';
import { schedule } from '../core/schedule.js';
import { currentPlan } from './planner.js';
import { haptics } from '../core/haptics.js';
import { dates } from '../core/dates.js';
import { t } from '../core/i18n.js';
import { app } from '../app.js';

/** Идёт ли обращение прямо сейчас: вторую кнопку нажимать нельзя. */
let ждём = false;

/** Идёт ли отправка плана на часы: она дольше забора и о ней надо сказать. */
let шлём = false;

/** Последняя осечка: показывается вместо данных и не мешает попробовать снова. */
let ошибка = '';

/** Замеры, привезённые в прошлый раз: { at, rows }. */
export async function currentWellness() {
    const хранимое = await dbService.getSetting(ICU_DATA, null);
    return Array.isArray(хранимое?.rows) ? хранимое : { at: 0, rows: [] };
}

/** Занятия с часов, привезённые в прошлый раз (§62.2). */
export async function currentActivities() {
    const хранимое = await dbService.getSetting(ICU_ACTS, null);
    return Array.isArray(хранимое?.rows) ? хранимое.rows : [];
}

/** Всё, что известно о прошлой привозке занятий, — вместе с разбором пустоты. */
async function сведенияОЗанятиях() {
    const хранимое = await dbService.getSetting(ICU_ACTS, null);

    return {
        at: хранимое?.at || 0,
        rows: Array.isArray(хранимое?.rows) ? хранимое.rows : [],
        probe: хранимое?.probe || null
    };
}

/**
 * Что привезено — по числам, а не по ощущению (§62.3).
 *
 * Настройка идёт через три звена: часы, Zepp, Intervals.icu. Пустой экран в
 * такой цепочке ничего не сообщает — виноватым может быть любое звено, и
 * человек начинает гадать. Числа отвечают прямо: сколько записей пришло и
 * что в них было.
 */
function привезеноБлок(замеры, занятия) {
    const счёт = (поле) => замеры.rows.filter((r) => r[поле]).length;

    return ui.html`
        <div class="card">
            <div class="card-title">${t('Что привезено')}</div>

            <div class="plan-rule">
                ${t('Замеров за месяц: {n}', { n: замеры.rows.length })}
                <span class="plan-day-rest">
                    ${t('сон — {сон}, пульс покоя — {пульс}, шаги — {шаги}', {
                        сон: счёт('sleep'), пульс: счёт('rhr'), шаги: счёт('steps')
                    })}
                </span>
            </div>

            <div class="plan-rule">
                ${t('Занятий за месяц: {n}', { n: занятия.rows.length })}

                ${занятия.rows.length === 0 && занятия.probe ? ui.html`
                    <span class="plan-day-rest">
                        ${занятия.probe.count
                            ? t('сервис прислал записей: {n}, но пульса и времени в них не нашлось', { n: занятия.probe.count })
                            : t('сервис не прислал ни одной')}
                    </span>
                ` : ''}
            </div>

            ${занятия.rows.length === 0 ? ui.html`
                <p class="hint">
                    ${t('Пульс на тренировке появится, только если Вы запускаете занятие на самих часах: приложение сопоставит его с тренировкой по времени. Zepp отдаёт наружу то, что часы записали как занятие.')}
                </p>
            ` : ''}

            ${занятия.probe?.keys?.length ? ui.html`
                <details class="guide">
                    <summary>${t('Поля, которые прислал сервис')}</summary>
                    <div class="guide-body"><p class="hint">${занятия.probe.keys.join(', ')}</p></div>
                </details>
            ` : ''}
        </div>
    `;
}


/**
 * Строки о восстановлении и нагрузке для сводки и для дела тренеру (§55, §60).
 *
 * Пустой массив, если часы не привязаны или замеров нет: выдумывать
 * восстановление приложение не станет, а «данных нет» в сводке — строка,
 * которую собеседник читает как шум.
 */
export async function recoveryLines({ now = Date.now() } = {}) {
    const [{ rows }, занятия] = await Promise.all([currentWellness(), currentActivities()]);

    return [...recovery.describe(rows, { now }), ...effort.describe(занятия, { now })];
}


/** Сон в человеческом виде: «7 ч 10 мин». */
function сон(secs) {
    const часы = Math.floor(secs / 3600);
    const минуты = Math.round((secs % 3600) / 60);

    return t('{часы} ч {минуты} мин', { часы, минуты });
}

/**
 * План на часы (§62.4): обратный ход цепочки.
 *
 * Стоит после привезённого, а не перед: сперва то, что приложение получает,
 * потом то, что отдаёт. Порядок читается сам собой и объясняет, почему обмен
 * двусторонний.
 */
function планБлок(план, занятия, отправка) {
    return ui.html`
        <div class="card">
            <div class="card-title">${t('План на часы')}</div>

            <p class="hint">
                ${t('Intervals.icu отдаёт запланированное на часы — у Zepp это «Загружать плановые тренировки». Уехавший план виден на запястье в тот момент, когда он нужен.')}
            </p>

            ${план ? ui.html`
                <div class="plan-rule">
                    ${t('К отправке занятий: {n}', { n: занятия.length })}
                    <span class="plan-day-rest">${t('на ближайшие две недели, дни отдыха не отправляются')}</span>
                </div>

                ${отправка?.at ? ui.html`
                    <p class="hint">
                        ${t('Отправлено {когда}: {n}. Повторная отправка сначала убирает своё прежнее.', {
                            когда: dates.formatDayLabel(отправка.at, Date.now(), { lower: true }),
                            n: отправка.count
                        })}
                    </p>
                ` : ''}

                <button class="btn btn-accent" data-action="watch-push" ${ui.raw(шлём || !занятия.length ? 'disabled' : '')}>
                    ${шлём ? t('Отправляю…') : t('Отправить план на часы')}
                </button>
            ` : ui.html`
                <p class="hint">${t('Плана нет — отправлять нечего.')}</p>
                <button class="btn btn-ghost btn-sm" data-action="nav" data-screen="planner">${t('К плану')}</button>
            `}
        </div>
    `;
}

export const watch = {

    title: 'Данные с часов',
    nav: 'profile',

    async render() {
        const [key, athlete, хранимое, занятия, план, отправка] = await Promise.all([
            dbService.getSetting(ICU_KEY, ''),
            dbService.getSetting(ICU_ATHLETE, ''),
            currentWellness(),
            сведенияОЗанятиях(),
            currentPlan(),
            dbService.getSetting(ICU_PUSH, null)
        ]);

        const привязаны = icu.ready(key, athlete);
        const последняя = recovery.last(хранимое.rows);

        // Те же строки, что уходят в сводку и тренеру: человек должен видеть
        // отправляемое, а не его пересказ (§60)
        const выводы = [...recovery.describe(хранимое.rows), ...effort.describe(занятия.rows)];


        return ui.html`
            ${ui.raw(ui.title(t('Данные с часов'),
                t('Сон и пульс покоя — то, чего приложение о вас не знает, а программа от этого зависит')))}

            ${ошибка ? ui.html`<div class="banner is-danger"><span>${ошибка}</span></div>` : ''}

            ${привязаны && выводы.length ? ui.html`
                <div class="card">
                    <div class="card-title">${t('Восстановление')}</div>
                    ${выводы.map((с) => ui.html`<div class="plan-rule">${с}</div>`)}

                    ${последняя ? ui.html`
                        <p class="hint">
                            ${t('Последний замер {день}', { день: dates.formatDayLabel(последняя.date, Date.now(), { lower: true }) })}${последняя.sleep ? `: ${сон(последняя.sleep)}` : ''}
                        </p>
                    ` : ''}

                    <p class="hint">
                        ${t('Привезено {когда}. Эти же строки уходят в сводку и тренеру.', {
                            когда: dates.formatDayLabel(хранимое.at, Date.now(), { lower: true })
                        })}
                    </p>
                </div>
            ` : ''}

            ${привязаны && (хранимое.rows.length || занятия.at) ? привезеноБлок(хранимое, занятия) : ''}

            ${привязаны ? планБлок(план, schedule.build(план, { rules: план?.rules || [] }), отправка) : ''}

            <!--
                Порядок настройки объяснён здесь целиком, а не отослан в
                справку: без цепочки «часы → Zepp → Intervals.icu» два поля
                внизу непонятно от чего, и человек закроет экран.
            -->
            <div class="card">
                <div class="card-title">${t('Как это связано')}</div>
                <p class="hint">
                    ${t('Zepp умеет отдавать данные стороннему сервису, а Intervals.icu умеет отдавать их по ключу. Приложение забирает у Intervals.icu сон и пульс покоя — и больше ничего.')}
                </p>

                <div class="plan-rule">${t('1. В Zepp: Профиль → Добавить аккаунты → Intervals.icu.')}</div>
                <div class="plan-rule">${t('2. На intervals.icu: Settings → Developer → API key.')}</div>
                <div class="plan-rule">${t('3. Там же номер спортсмена — он вида i123456.')}</div>
            </div>

            <div class="card">
                <div class="card-title">${привязаны ? t('Часы привязаны') : t('Нужен ключ')}</div>

                <div class="field">
                    <label for="icu-athlete">${t('Номер спортсмена')}</label>
                    <input id="icu-athlete" type="text" autocomplete="off" spellcheck="false"
                           value="${athlete}" placeholder="i123456" data-change="watch-athlete">
                </div>

                <div class="field">
                    <label for="icu-key">${t('Ключ')}</label>
                    <input id="icu-key" type="password" autocomplete="off" spellcheck="false"
                           placeholder="${привязаны ? t('ключ сохранён') : '…'}" data-change="watch-key">
                </div>

                <p class="hint">
                    ${t('Ключ остаётся на этом устройстве и в облако не уезжает — на втором заведите свой.')}
                </p>

                <div class="row-links">
                    <button class="btn btn-accent" data-action="watch-load" ${ui.raw(ждём || !привязаны ? 'disabled' : '')}>
                        ${ждём ? t('Забираю…') : t('Забрать данные')}
                    </button>

                    ${привязаны ? ui.html`
                        <button class="link-btn" data-action="watch-forget">${t('Отвязать')}</button>
                    ` : ''}
                </div>
            </div>

            <button class="btn btn-ghost" data-action="nav" data-screen="profile">${t('← В профиль')}</button>
        `;
    },

    /** Уход с экрана гасит осечку: она про прошлое обращение, а не про экран. */
    leave() {
        ошибка = '';
    }
};

actions.onChange('watch-athlete', async (el) => {
    await dbService.setSetting(ICU_ATHLETE, el.value.trim());
    app.render();
});

actions.onChange('watch-key', async (el) => {
    const key = el.value.trim();
    if (!key) return;

    await dbService.setSetting(ICU_KEY, key);
    haptics.tap();
    app.render();
});

/**
 * Забрать замеры и сложить их у себя.
 *
 * Складываем намеренно: сводка и дело тренеру собираются в тот момент, когда
 * человек нажал «отправить», и ходить за сеть в этот момент значит либо
 * задерживать отправку, либо отправлять без данных. Привезённое лежит и
 * говорит, когда оно привезено.
 */
actions.on('watch-load', async () => {
    if (ждём) return;

    const [key, athlete] = await Promise.all([
        dbService.getSetting(ICU_KEY, ''),
        dbService.getSetting(ICU_ATHLETE, '')
    ]);

    if (!icu.ready(key, athlete)) return;

    ждём = true;
    ошибка = '';
    await app.render();

    try {
        /*
         * Замеры и занятия — двумя запросами, но одним нажатием.
         *
         * allSettled, а не all: у Intervals.icu это разные концы, и упавший
         * один не должен уносить второй. Сон приезжает даже тогда, когда
         * занятий нет вовсе, — а так оно у большинства и есть.
         */
        const [замеры, занятия] = await Promise.allSettled([
            icu.wellness({ key, athlete, days: recovery.BASE }),
            icu.activities({ key, athlete, days: recovery.BASE })
        ]);

        const беды = [];

        if (замеры.status === 'fulfilled') {
            await dbService.setSetting(ICU_DATA, { at: Date.now(), rows: замеры.value });
        } else {
            беды.push(замеры.reason?.message || t('Не удалось получить данные с часов.'));
        }

        /*
         * Занятия молчать не имеют права (§62.3).
         *
         * Раньше их осечка глоталась: сон приезжал, пульса не было, и
         * человек оставался с вопросом, часы виноваты или приложение. Так
         * настройка в три звена и превращается в гадание.
         */
        if (занятия.status === 'fulfilled') {
            const разбор = { at: Date.now(), rows: занятия.value };

            /*
             * Пусто — спрашиваем, что там на самом деле.
             *
             * Пустой список значит одно из трёх: занятий правда нет, Zepp их
             * не отдаёт, или приложение не узнало полей. Различить это можно
             * только по тому, что прислал сервис, — и лишний запрос ради
             * ответа на «почему пусто» дешевле, чем это «почему».
             */
            if (занятия.value.length === 0) {
                разбор.probe = await icu.probe({ key, athlete, days: recovery.BASE }).catch(() => null);
            }

            await dbService.setSetting(ICU_ACTS, разбор);
        } else {
            беды.push(занятия.reason?.message || t('Занятия забрать не удалось.'));
        }

        haptics.tap();

        if (беды.length) ошибка = беды.join(' ');
        else if (замеры.value.length === 0) {
            ошибка = t('Intervals.icu ответил, но замеров за месяц там нет. Проверьте, что Zepp туда пишет.');
        }
    } catch (e) {
        ошибка = e.message;
    } finally {
        ждём = false;
        await app.render();
    }
});



actions.on('watch-forget', async () => {
    const точно = await dialog.confirm({
        title: t('Отвязать часы?'),
        text: t('Ключ и привезённые замеры будут стёрты. История тренировок не тронется.'),
        confirmText: t('Отвязать'),
        danger: true
    });

    if (!точно) return;

    await dbService.setSetting(ICU_KEY, '');
    await dbService.setSetting(ICU_DATA, null);
    await dbService.setSetting(ICU_ACTS, null);

    haptics.tap();
    await app.render();
});
/**
 * Отправить план на часы (§62.4).
 *
 * Обратный ход цепочки: до сих пор данные шли к приложению, здесь идут от
 * него. Intervals.icu отдаёт запланированное на часы, и у Zepp этот тумблер
 * стоит рядом с тем, которым забирают активность.
 *
 * Порядок такой: убрать своё прежнее за тот же отрезок, поставить новое. Не
 * наоборот и не «поверх»: сервис не различает повторов, и вторая отправка без
 * уборки поставила бы на каждый день по две одинаковых записи.
 *
 * Чужое не трогаем. В плане сервиса могут лежать тренировки, поставленные
 * руками или другим приложением; своё приложение узнаёт по опознавателю, а не
 * по названию — названия совпадают у кого угодно.
 *
 * Отправляем по одному. Занятий за две недели десяток, а общий запрос на всё
 * означал бы, что осечка на седьмом дне уносит и первые шесть: на часах
 * оказался бы обрывок программы, о котором приложение думает, что он целый.
 */
actions.on('watch-push', async () => {
    if (шлём) return;

    const [key, athlete, план] = await Promise.all([
        dbService.getSetting(ICU_KEY, ''),
        dbService.getSetting(ICU_ATHLETE, ''),
        currentPlan()
    ]);

    if (!icu.ready(key, athlete) || !план) return;

    const занятия = schedule.build(план, { rules: план.rules || [] });

    if (занятия.length === 0) {
        ошибка = t('В ближайшие две недели план не назначает ни одной тренировки.');
        return app.render();
    }

    шлём = true;
    ошибка = '';
    await app.render();

    let поставлено = 0;
    let убрано = 0;

    try {
        const отрезок = schedule.span({});

        // Своё прежнее за тот же отрезок: иначе на каждый день встанет по две
        // одинаковых записи, и разбирать их придётся человеку
        const было = await icu.events({ key, athlete, ...отрезок });

        for (const событие of было.filter(schedule.mine)) {
            await icu.removeEvent({ key, athlete, id: событие.id });
            убрано++;
        }

        for (const занятие of занятия) {
            await icu.addEvent({ key, athlete, event: schedule.event(занятие) });
            поставлено++;
        }

        await dbService.setSetting(ICU_PUSH, { at: Date.now(), count: поставлено });
        haptics.tap();
    } catch (e) {
        /*
         * Говорим, сколько успели.
         *
         * Отправка не откатывается: удалять уже поставленное из-за осечки на
         * середине значит второй раз лезть в чужой сервис ровно тогда, когда
         * он и так отвечает плохо. Честнее сказать, где остановились, — и
         * следующая отправка приведёт всё в порядок, потому что начинается
         * она с уборки своего.
         */
        ошибка = поставлено
            ? t('{что} Поставлено занятий: {n}, остальные — нет.', { что: e.message, n: поставлено })
            : e.message;
    } finally {
        шлём = false;
        await app.render();
    }
});
