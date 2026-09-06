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
import { icu, ICU_KEY, ICU_ATHLETE, ICU_DATA } from '../services/icu.js';
import { recovery } from '../core/recovery.js';
import { haptics } from '../core/haptics.js';
import { dates } from '../core/dates.js';
import { t } from '../core/i18n.js';
import { app } from '../app.js';

/** Идёт ли обращение прямо сейчас: вторую кнопку нажимать нельзя. */
let ждём = false;

/** Последняя осечка: показывается вместо данных и не мешает попробовать снова. */
let ошибка = '';

/** Замеры, привезённые в прошлый раз: { at, rows }. */
export async function currentWellness() {
    const хранимое = await dbService.getSetting(ICU_DATA, null);
    return Array.isArray(хранимое?.rows) ? хранимое : { at: 0, rows: [] };
}

/**
 * Строки о восстановлении для сводки и для дела тренеру (§55, §60).
 *
 * Пустой массив, если часы не привязаны или замеров нет: выдумывать
 * восстановление приложение не станет, а «данных нет» в сводке — строка,
 * которую собеседник читает как шум.
 */
export async function recoveryLines({ now = Date.now() } = {}) {
    const { rows } = await currentWellness();
    return recovery.describe(rows, { now });
}

/** Сон в человеческом виде: «7 ч 10 мин». */
function сон(secs) {
    const часы = Math.floor(secs / 3600);
    const минуты = Math.round((secs % 3600) / 60);

    return t('{часы} ч {минуты} мин', { часы, минуты });
}

export const watch = {

    title: 'Данные с часов',
    nav: 'profile',

    async render() {
        const [key, athlete, хранимое] = await Promise.all([
            dbService.getSetting(ICU_KEY, ''),
            dbService.getSetting(ICU_ATHLETE, ''),
            currentWellness()
        ]);

        const привязаны = icu.ready(key, athlete);
        const последняя = recovery.last(хранимое.rows);
        const выводы = recovery.describe(хранимое.rows);

        return ui.html`
            ${ui.raw(ui.title(t('Данные с часов'),
                t('Сон и пульс покоя — то, чего приложение о вас не знает, а программа от этого зависит')))}

            ${ошибка ? ui.html`<div class="banner is-danger"><span>${ошибка}</span></div>` : ''}

            ${привязаны && хранимое.rows.length ? ui.html`
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
        const rows = await icu.wellness({ key, athlete, days: recovery.BASE });

        await dbService.setSetting(ICU_DATA, { at: Date.now(), rows });
        haptics.tap();

        if (rows.length === 0) {
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

    haptics.tap();
    await app.render();
});
