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
import { icu, ICU_KEY, ICU_ATHLETE, ICU_DATA, ICU_ACTS, ICU_PUSH, ICU_STEPS_GOAL } from '../services/icu.js';
import { recovery } from '../core/recovery.js';
import { effort } from '../core/effort.js';
import { schedule } from '../core/schedule.js';
import { pushPlan } from '../services/watchplan.js';
import { currentPlan } from './planner.js';
import { haptics } from '../core/haptics.js';
import { dates } from '../core/dates.js';
import { format } from '../core/format.js';
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
/** Сутки в миллисекундах: считаем, на сколько дней отстали данные. */
const DAY = 86400000;

function привезеноБлок(замеры, занятия) {
    const счёт = (поле) => замеры.rows.filter((r) => r[поле]).length;

    /*
     * «Когда забрали» и «по какой день данные» — разные вопросы (§62.3, Р-127).
     *
     * Строка говорила «Привезено сегодня» — и это правда про забор: запрос
     * ушёл, Intervals.icu ответил, ответ записан. А человек читает её как
     * ответ на свой вопрос, «свежее ли это», и получает «да» там, где надо
     * «нет»: сервис отвечает исправно, но новее восьмого сентября у него
     * ничего нет.
     *
     * В цепочке из трёх звеньев это и есть главный вопрос — какое молчит.
     * Приложение знает ответ точно: если забор прошёл, а самый свежий замер
     * позавчерашний, молчит не оно и не Intervals.icu, а то, что пишет в
     * Intervals.icu. Так и сказано, чтобы человек не чинил работающее.
     */
    const свежий = замеры.rows.reduce((m, r) => Math.max(m, r.date || 0), 0);

    /** Самый свежий день, в котором эта величина правда есть. */
    const свежесть = (поле) => замеры.rows.reduce((m, r) => (r[поле] ? Math.max(m, r.date || 0) : m), 0);

    const отстал = свежий
        ? Math.round((dates.startOfDay(Date.now()) - dates.startOfDay(свежий)) / DAY)
        : null;

    return ui.html`
        <div class="card">
            <div class="card-title">${t('Что привезено')}</div>

            <!--
                Когда привезено и что дальше — первой строкой (Р-90, Р-92).
                Забор идёт сам, и человек, открывший этот экран, приходит с
                вопросом «свежее ли это», а не «как забрать».
            -->
            <p class="hint">
                ${замеры.at
                    ? t('Привезено {когда}, дальше само — при запуске и возвращении, не чаще раза в три часа.', {
                        когда: dates.formatDayLabel(замеры.at, Date.now(), { lower: true })
                    })
                    : t('Пока ничего не привозили. Забор идёт сам при запуске, но можно и сейчас.')}
            </p>

            <!--
                Сроки по величинам показываются, только когда есть что
                показать (§62.3, Р-129).

                Свежесть считать порознь надо: сон и пульс приходят ночной
                выгрузкой, шаги дневной, и останавливается это по отдельности —
                общий «самый свежий замер» скажет «сегодня», пока идёт хоть
                что-нибудь, и спрячет ровно то, что ищут (Р-128).

                Но когда всё свежее, три даты подряд и две строки пояснений —
                это шум на экране, куда заходят раз в месяц. Работает — одна
                строка со счётом; отстало — тогда и сроки, и виновник.
            -->
            <div class="plan-rule ${отстал > 1 ? 'is-bad' : ''}">
                ${t('Замеров за месяц: {n}', { n: замеры.rows.length })}

                ${отстал > 1 ? ui.html`
                    <span class="plan-day-rest">
                        ${[
                            { поле: 'sleep', имя: t('сон') },
                            { поле: 'rhr', имя: t('пульс покоя') },
                            { поле: 'steps', имя: t('шаги') }
                        ].map(({ поле, имя }) => {
                            const свой = свежесть(поле);

                            return свой
                                ? t('{имя} — по {день}', { имя, день: dates.formatDate(свой) })
                                : t('{имя} — ни одного', { имя });
                        }).join('; ')}
                    </span>
                ` : ''}
            </div>

            <!--
                Слово по направлению, а не общее на обе дороги (§62, Р-123).

                Здесь стояло «Занятий за месяц», а двумя карточками ниже — «К
                отправке занятий»: одно слово, две встречные дороги, один
                экран. Человек видел «Занятий за месяц: 0» и под ним «К
                отправке занятий: 6» и делал единственный разумный вывод —
                шесть отправил, ноль дошло, связка сломана. И шёл чинить то,
                что работает.

                Экран часов и без того собран из трёх чужих звеньев; именно
                здесь нельзя давать поводов заподозрить поломку там, где её
                нет. Привезённое — «тренировки с часов», уезжающее — «дни
                плана».
            -->
            <div class="plan-rule">
                ${t('Тренировок с часов за месяц: {n}', { n: занятия.rows.length })}

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
                    ${t('Пульс на тренировке появится, только если вы запускаете занятие на самих часах: приложение сопоставит его с тренировкой по времени. Наружу уходит то, что часы записали как занятие, — и Zepp, и HUAWEI Health отдают именно это.')}
                </p>
            ` : ''}

            ${занятия.probe?.keys?.length ? ui.html`
                <details class="guide">
                    <summary>${t('Поля, которые прислал сервис')}</summary>
                    <div class="guide-body"><p class="hint">${занятия.probe.keys.join(', ')}</p></div>
                </details>
            ` : ''}

            <div class="row-links">
                <button class="btn btn-ghost btn-sm" data-action="watch-load" ${ui.raw(ждём ? 'disabled' : '')}>
                    ${ждём ? t('Забираю…') : t('Забрать сейчас')}
                </button>

                <!--
                    Сами числа и выводы — в статистике (§62.6). Отсюда до них
                    один переход, и это честнее, чем показать их дважды.
                -->
                <button class="link-btn" data-action="nav" data-screen="stats">${t('Смотреть в статистике')}</button>
            </div>
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


/**
 * План на часы (§62.4): обратный ход цепочки.
 *
 * Стоит после привезённого, а не перед: сперва то, что приложение получает,
 * потом то, что отдаёт. Порядок читается сам собой и объясняет, почему обмен
 * двусторонний.
 */
function планБлок(план, занятия, отправка) {
    const осталось = schedule.left(отправка?.at);

    return ui.html`
        <div class="card">
            <div class="card-title">${t('План на часы')}</div>

            <p class="hint">
                ${t('Intervals.icu отдаёт запланированное на часы — у Zepp это «Загружать плановые тренировки», у HUAWEI Health приём плана идёт через ту же привязку. Уехавший план виден на запястье в тот момент, когда он нужен.')}
            </p>

            <!--
                Про модели сказано прямо (§62.4). Intervals.icu отдаёт
                плановые тренировки не всем часам: у Amazfit это на сегодня
                только T-Rex 3 Pro, у Huawei — только бег, ходьба и походы.
                Человек, чьи часы в список не попали, иначе будет искать
                поломку у себя и не найдёт: отправка проходит, а на часах
                пусто.
            -->
            <p class="hint">
                ${t('Не все часы это принимают: Amazfit — пока только T-Rex 3 Pro, Huawei — только бег, ходьбу и походы. Если на запястье ничего не появилось, дело в этом, а не в отправке. Тогда берите план в календарь телефона — он ложится на любые часы уведомлением.')}
            </p>


            ${план ? ui.html`
                <div class="plan-rule">
                    ${t('К отправке дней плана: {n}', { n: занятия.length })}
                    <span class="plan-day-rest">${t('на ближайшие две недели, дни отдыха не отправляются')}</span>
                </div>

                <!--
                    Список уезжающего — не украшение, а единственный способ
                    сверить (§62.4). Что показывает Zepp на часах, приложение
                    не знает и знать не может; человек сверяет сам, и сверять
                    ему надо с датами и названиями, а не с числом «четыре».
                -->
                ${занятия.map((з) => ui.html`
                    <div class="plan-day">
                        <span class="plan-day-date">${dates.formatDayLabel(з.date)}</span>
                        <span class="plan-day-body">${з.name}</span>
                    </div>
                `)}


                ${отправка?.at ? ui.html`
                    <p class="hint">
                        ${t('Отправлено {когда}: {n}. Повторная отправка сначала убирает своё прежнее.', {
                            когда: dates.formatDayLabel(отправка.at, Date.now(), { lower: true }),
                            n: отправка.count
                        })}
                    </p>

                    <!--
                        Край отправленного уезжает в прошлое сам собой, и часы
                        об этом не скажут: они просто перестанут показывать
                        занятия, и человек решит, что план кончился (§62.4).
                    -->
                    ${осталось !== null && осталось <= 3 ? ui.html`
                        <p class="hint">
                            ${осталось > 0
                                ? t('Отправленного хватит ещё на {n} — пора отправить снова.', { n: format.count(осталось, format.WORDS.day) })
                                : t('Отправленное кончилось: часы уже не знают, что сегодня по плану.')}
                        </p>
                    ` : ''}
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
        const [key, athlete, хранимое, занятия, план, отправка, цельШагов] = await Promise.all([
            dbService.getSetting(ICU_KEY, ''),
            dbService.getSetting(ICU_ATHLETE, ''),
            currentWellness(),
            сведенияОЗанятиях(),
            currentPlan(),
            dbService.getSetting(ICU_PUSH, null),
            dbService.getSetting(ICU_STEPS_GOAL, 0)
        ]);

        const привязаны = icu.ready(key, athlete);

        return ui.html`
            ${ui.raw(ui.title(t('Данные с часов'),
                t('Сон, пульс покоя, шаги и пульс занятий. Забираются сами — здесь настройка и проверка')))}

            ${ошибка ? ui.html`<div class="banner is-danger"><span>${ошибка}</span></div>` : ''}

            <!--
                Выводов здесь больше нет: те же строки стоят в статистике,
                рядом с остальными числами о себе (Р-91, Р-92). Экран
                настройки — место для проверки цепочки, а не второе место для
                тех же сведений: расходятся такие пары быстро, и человек потом
                гадает, какому из двух показов верить.
            -->
            ${привязаны && (хранимое.rows.length || занятия.at) ? привезеноБлок(хранимое, занятия) : ''}

            <!--
                Порядок настройки объяснён здесь целиком, а не отослан в
                справку: без цепочки «часы → приложение часов → Intervals.icu»
                два поля внизу непонятно от чего, и человек закроет экран.
            -->
            <div class="card">
                <div class="card-title">${t('Как это связано')}</div>
                <p class="hint">
                    ${t('Приложение часов умеет отдавать данные стороннему сервису, а Intervals.icu умеет отдавать их по ключу. Приложение забирает у Intervals.icu сон, пульс покоя, шаги и занятия — и больше ничего.')}
                </p>

                <!--
                    Оба приложения часов в одной строке, а не двумя шагами с
                    одним номером: шаг здесь один — разрешить обмен, — а вот
                    путь к нему у Zepp и Huawei разный.
                -->
                <div class="plan-rule">${t('1. В приложении часов разрешите Intervals.icu: Zepp — Профиль → Добавить аккаунты → Intervals.icu; Huawei Health — Сторонние сервисы → Health Service Kit, затем на intervals.icu подключить HUAWEI Health.')}</div>
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

                <!--
                    Пока не привязано — кнопка забора здесь: проверить связку
                    надо сразу, а карточки «Что привезено» ещё нет. После
                    привязки забор живёт в ней, и второй кнопке тут не место.
                -->
                <div class="row-links">
                    ${привязаны ? ui.html`
                        <button class="link-btn" data-action="watch-forget">${t('Отвязать')}</button>
                    ` : ui.html`
                        <button class="btn btn-accent" data-action="watch-load" ${ui.raw(ждём ? 'disabled' : '')}>
                            ${ждём ? t('Забираю…') : t('Проверить связку')}
                        </button>
                    `}
                </div>
            </div>

            <!--
                Цель по шагам стоит здесь, а не в профиле (Р-89): шаги
                приезжают отсюда, и настройка живёт рядом со своим источником.
                Ставит её человек — сколько ему нужно, приложение не знает, а
                десять тысяч из рекламы шагомеров не норма и не цель.
            -->
            <div class="card">
                <div class="card-title">${t('Шаги')}</div>

                <p class="hint">
                    ${цельШагов > 0
                        ? t('Цель — {n} шагов в день. Она видна на главном экране рядом с сегодняшним числом.', { n: format.decimal(цельШагов, 0) })
                        : t('Без цели шаги просто показываются числом. Цель нужна не приложению, а вам: она превращает ходьбу в то, что видно сделанным.')}
                </p>

                <button class="btn btn-ghost btn-sm" data-action="steps-goal">
                    ${цельШагов > 0 ? t('Изменить цель') : t('Поставить цель')}
                </button>
            </div>

            <!--
                План на часы свёрнут (Р-92): путь необязательный и работает не
                у всех — Amazfit принимает его только на T-Rex 3 Pro, Huawei
                только бегом и ходьбой. Разворачивает его тот, кому он нужен;
                остальным он занимал половину экрана рассказом о том, чего у
                них не будет.
            -->
            ${привязаны ? ui.html`
                <details class="guide">
                    <summary>${t('Отправить план на часы (необязательно)')}</summary>
                    <div class="guide-body">
                        ${планБлок(план, schedule.build(план, { rules: план?.rules || [] }), отправка)}
                    </div>
                </details>
            ` : ''}

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
/**
 * Забрать замеры и занятия (§62.1).
 *
 * Один и тот же ход для кнопки и для автоматического забора (Р-90) — иначе
 * это были бы два разных забора с разной судьбой ошибок и разным составом
 * запросов, и расходиться они начали бы с первой же правки.
 *
 * `тихо` — про голос, а не про действие: молчаливый забор не рисует ни
 * ожидания, ни красной полосы. Осечка при нём — обычное дело (метро, самолёт,
 * выключенный вайфай), и сообщать о ней тому, кто ничего не нажимал, незачем;
 * место осечки — рядом с кнопкой, которую нажали.
 *
 * `notSooner` — не чаще, чем раз в столько-то: возвращение в приложение
 * случается два десятка раз за тренировку, а замеры за это время не меняются.
 */
export async function забратьСЧасов({ notSooner = 0, тихо = true } = {}) {
    if (ждём) return null;

    const [key, athlete] = await Promise.all([
        dbService.getSetting(ICU_KEY, ''),
        dbService.getSetting(ICU_ATHLETE, '')
    ]);

    if (!icu.ready(key, athlete)) return null;

    if (notSooner > 0) {
        const прошлый = await currentWellness();
        if (прошлый.at && Date.now() - прошлый.at < notSooner) return null;
    }

    ждём = !тихо;
    if (!тихо) { ошибка = ''; await app.render(); }

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
            беды.push(занятия.reason?.message || t('Тренировки с часов забрать не удалось.'));
        }

        const приехало = замеры.status === 'fulfilled' || занятия.status === 'fulfilled';

        if (тихо) return { received: приехало };

        haptics.tap();

        if (беды.length) ошибка = беды.join(' ');
        else if (замеры.value.length === 0) {
            ошибка = t('Intervals.icu ответил, но замеров за месяц там нет. Значит в него ничего не пишут: проверьте привязку в приложении часов — Zepp или HUAWEI Health.');
        }

        return { received: приехало };
    } catch (e) {
        // Молчаливому забору осечка не повод рисовать полосу: он идёт сам,
        // а объясняться приложение обязано перед тем, кто нажал
        if (!тихо) ошибка = e.message;
        else console.warn('[Часы] Молчаливый забор не удался:', e);

        return { received: false };
    } finally {
        if (!тихо) {
            ждём = false;
            await app.render();
        }
    }
}

actions.on('watch-load', () => забратьСЧасов({ тихо: false }));



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

actions.on('watch-push', async () => {
    if (шлём) return;

    шлём = true;
    ошибка = '';
    await app.render();

    const итог = await pushPlan(await currentPlan());

    ошибка = итог.error;
    if (итог.placed) haptics.tap();

    шлём = false;
    await app.render();
});


/**
 * Цель по шагам (§62.5, Р-89).
 *
 * Ноль — «цели нет», и это законный ответ: тогда шаги просто показываются
 * числом. Пустое поле значит то же самое, а не «оставить как было»: убрать
 * цель человек должен уметь так же легко, как поставить.
 */
actions.on('steps-goal', async () => {
    const было = await dbService.getSetting(ICU_STEPS_GOAL, 0);

    const values = await dialog.form({
        title: t('Цель по шагам'),
        text: t('Сколько шагов в день вы считаете своим днём. Пусто — цели нет, шаги останутся просто числом.'),
        fields: [
            { name: 'goal', label: t('Шагов в день'), type: 'number', value: было || '', placeholder: '8000' }
        ],
        confirmText: t('Сохранить')
    });

    if (!values) return;

    const цель = Math.max(0, Math.round(Number(values.goal) || 0));

    await dbService.setSetting(ICU_STEPS_GOAL, цель);
    haptics.tap();
    await app.render();
});
