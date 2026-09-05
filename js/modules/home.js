/**
 * Стартовый экран (§29 ТЗ).
 *
 * Порядок блоков — по частоте нажатия, а не по важности темы. Сначала судьба
 * незавершённой тренировки (§18), потом способы начать новую — от самого
 * частого к самому редкому: первый из очереди карточкой, остальная очередь
 * плашками, забытое упражнение, шаблоны кнопкой (§8), тренировка с нуля.
 * Ярким выделен только последний пункт этой лестницы: он завершает её и
 * потому стоит внизу, где палец и так оказывается.
 *
 * Повтора прошлой здесь нет: он переехал в итоги тренировки (§9). Для того,
 * кто чередует группы, он был антисоветом — вчера была спина, значит сегодня
 * спина и не нужна.
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
import { rhythm, isBackground } from '../core/rhythm.js';
import { stats } from '../core/stats.js';
import { estimate } from '../core/estimate.js';
import { format } from '../core/format.js';
import { dates } from '../core/dates.js';
import { t } from '../core/i18n.js';
import { app } from '../app.js';
import { plan as planCore } from '../core/plan.js';
import { currentPlan } from './planner.js';

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

/**
 * Сколько названий влезает в плашку быстрого старта.
 *
 * Меньше, чем на карточке повтора: плашки стоят в ряд, и длинная занимает
 * строку целиком, а ряды съедают то место, ради которого всё и затевалось.
 * Мера — не число рядов, а видимость кнопки «Новая тренировка» (§29.1).
 */
const NAMES_ON_CHIP = 2;

/** Фоновая тренировка — понятие общее, живёт в ядре (§29.1). */
const фон = isBackground;

/**
 * Которое из забытых упражнений показано сейчас (§29.1).
 *
 * Живёт в модуле, а не в хранилище: это положение листалки, а не решение
 * человека, и переживать перезапуск ему незачем.
 */
let показано = 0;

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
function exerciseLine(entry, names, limit = NAMES_SHOWN) {
    const list = (entry.exerciseIds || []).map((id) => names.get(id)).filter(Boolean);

    if (list.length === 0) return entry.workout.type;

    const shown = list.slice(0, limit).join(' · ');
    return list.length > limit ? `${shown} ${t('и ещё {n}', { n: list.length - limit })}` : shown;
}

/**
 * Сколько дней с прошлого раза — подпись на плашке и в карточке (§29.1).
 *
 * Одна величина на весь экран: и в очереди, и в забытом. По ней же выстроен
 * ряд, и это главное — подпись обязана называть то, по чему идёт сортировка.
 *
 * До неё пробовали множитель повторов и опоздание со знаком («+18 дн»,
 * «−5 дн»). Оба точнее, оба сортировали правильнее — и оба приходилось
 * объяснять словами, а ряд без объяснения читался как поломка. Дни человек
 * проверяет по себе, не считая ничего.
 */
const давность = (place) => t('{n} дн', { n: place.daysSince });

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

    // Два названия, а не три: плашка стоит в ряд с другими, и длинная
    // занимает строку целиком, а ряды теснят кнопку внизу (§29.1)
    return exerciseLine({ exerciseIds: group.exerciseIds, workout: { type: t('Тренировка') } }, names, NAMES_ON_CHIP);
}

/**
 * Способы начать: очередь, забытое, шаблоны, тренировка с нуля.
 *
 * Лестница от частого к редкому. Первый из очереди стоит карточкой, но
 * оформлен спокойно: ярких пятен на экране должно быть одно, и оно отдано
 * кнопке внизу, которая завершает перебор. На карточке крупно — упражнения:
 * по ним узнают тренировку, а тип и дни это лишь уточняют.
 */
function startBlock(last, templates, suggestion, names, due, frequent, очередь, записи, ежедневное, поПлану) {

    // Сегодняшняя полночь: по ней видно, перенесено ли занятие с прошлого дня
    const сегодняшнийДень = dates.startOfDay(Date.now());

    /*
     * Первый из очереди поднят в карточку — на самое видное место (§29.1).
     *
     * Там стоял повтор прошлой, и для того, кто чередует группы, это был
     * антисовет: вчера была спина, значит сегодня спина и не нужна. Очередь
     * же годится обоим — у того, кто делает одну программу каждый день, она
     * поставит первой её же, потому что просрочена именно она.
     *
     * Повтор переехал в историю, к нужной тренировке: он нужен изредка — не
     * доделал, хочешь тот же состав, — и ради этого держать самое видное
     * место незачем. Но пока очереди нет, он остаётся здесь: экран без
     * единого предложения хуже неточного предложения.
     */
    const первое = очередь.length && записи.has(очередь[0].workoutId)
        ? { ...очередь[0], запись: записи.get(очередь[0].workoutId) }
        : null;

    // Из плашек первый убран: он уже стоит карточкой, и повторять его —
    // значит занимать место тем же самым дважды
    const хвост = первое ? очередь.slice(1) : очередь;

    // Подсказка чередования полезна, только если предлагает не то же самое,
    // что кнопка повтора: иначе она повторяет её же словами
    const differs = suggestion && (!last || suggestion.type !== last.workout.type);

    // Подсказка называет тип тренировки, а у шаблона тип может быть общим
    // («Силовая») при говорящем названии («Ноги») — поэтому сверяем и с ним
    const suggests = (t) => differs && (t.type === suggestion.type || t.name === suggestion.type);

    /*
     * Быстрый старт: составы, до которых пора вернуться (§29.1).
     *
     * Раньше здесь стояли шаблоны — но шаблон надо сначала завести, а
     * повторяющийся состав виден и без этого, прямо из истории. У того, кто
     * шаблонов не создавал, строка была пуста, хотя одну и ту же тренировку
     * он проводил семь раз подряд.
     *
     * Потом здесь стояла частота — и это было измерение не того. Частота
     * говорит, что человек делает много, а помощь нужна с тем, к чему пора
     * вернуться. Теперь плашки — очередь: у каждого состава свой промежуток,
     * и впереди тот, чей срок ближе. Сделал — ушёл в конец очереди, на его
     * место встал следующий.
     *
     * Очередь, а не список просроченного: у того, кто тренируется по своему
     * кругу, просроченного почти никогда и нет — и строгий порог оставлял от
     * трёх привычных тренировок одну, пряча остальные ровно за то, что их
     * делали вовремя.
     *
     * Подпись — дни с прошлого раза, и по ним же порядок. Пробовали
     * множитель повторов и опоздание со знаком; оба точнее, оба сортировали
     * правильнее — и оба приходилось объяснять, а ряд без объяснения читался
     * как поломка. Простое правило, совпадающее с тем, что видно, лучше
     * точного, которое нужно расшифровывать.
     *
     * Периодичность из расчёта при этом не ушла: она решает, что считать
     * заброшенным и отдохнула ли мышца. Она просто перестала спорить с
     * подписью за порядок.
     *
     * Частота осталась запасным вариантом: пока состав не повторился трижды,
     * промежутка не знаем, и очереди из чего строить нет.
     */
    const запас = frequent.length ? 'frequent' : templates.length ? 'templates' : null;

    const chips = хвост.length
        ? хвост.map((f) => ui.html`
            <button class="chip" data-action="home-like" data-id="${f.workoutId}">
                ${compositionName(f, names, templates)}
                <span class="chip-count">${давность(f)}</span>
            </button>
        `)
        : запас === 'frequent'
        ? frequent.map((f) => ui.html`
            <button class="chip" data-action="home-like" data-id="${f.workoutId}">
                ${compositionName(f, names, templates)}
                <span class="chip-count">${давность(f)}</span>
            </button>
        `)
        : запас === 'templates'
        ? templates.slice(0, 4).map((t) => ui.html`
            <button class="chip ${suggests(t) ? 'is-active' : ''}"
                    data-action="home-template" data-id="${t.id}">${t.name}</button>
        `)
        : [];

    /*
     * У каждой ветки свой заголовок (§29.1).
     *
     * Раньше он был один на все три, и над шаблонами у человека без единой
     * тренировки стояло «Пора вернуться» — возвращаться было некуда.
     * Заголовок обязан описывать то, что под ним, а не то место, где он
     * стоит.
     */
    const заголовок = хвост.length
        ? (первое ? t('Следом') : t('Пора вернуться'))
        : запас === 'frequent' ? t('Что повторяете')
        : t('Шаблоны');

    /*
     * Забытые упражнения (§26.2.3).
     *
     * Это остаток от плашек: упражнение, просроченное по своей периодичности,
     * но не собранное ни в один повторяющийся состав. Оно расходится по
     * разным тренировкам и потому выпадает из очереди — а из виду выпадает
     * вместе с ней.
     *
     * Раньше стояло карточкой в рамке, рядом с повтором прошлой. После того
     * как плашки стали очередью, карточка почти всегда показывала одно
     * упражнение, а места занимала как полноценный способ начать. Теперь это
     * такая же плашка, только пунктиром: пунктир и говорит, что тренировку
     * ещё предстоит собрать, а не повторить готовую.
     */
    const forgotten = due
        .filter((d) => names.get(d.exerciseId))
        .map((d) => ({ name: names.get(d.exerciseId), daysSince: d.daysSince }));

    /*
     * Забытых бывает много, а показывается одно. Поэтому листалка: стрелки
     * перебирают их по кругу, не занимая рядов. Список целиком здесь не
     * нужен — нужно узнать, что выпало из виду.
     *
     * Плашка во всю ширину, в отличие от очереди: там плашки сравнивают друг
     * с другом и потому ставят рядом, а здесь показана одна, и жаться ей не
     * к кому. Заодно широкая цель попадает под палец, не глядя.
     *
     * Подпись — дни с прошлого раза, и по ним же порядок: от большего к
     * меньшему. Не опоздание, как в очереди: там плашки стоят рядом и
     * сравниваются друг с другом, а здесь показана одна, и вопрос к ней
     * простой — сколько её не было. Следом счётчик «которое из скольких»:
     * у листалки надо понимать, есть ли дальше что-то ещё.
     */
    const место = forgotten.length ? ((показано % forgotten.length) + forgotten.length) % forgotten.length : 0;

    const стрелка = (шаг, знак, подпись) => ui.html`
        <button class="chip-arrow" data-action="home-forgotten-${шаг}"
                aria-label="${подпись}">${ui.raw(знак)}</button>
    `;

    const forgottenChip = forgotten.length ? ui.html`
        <span class="chip is-draft is-wide">
            ${forgotten.length > 1 ? стрелка('prev', '&lsaquo;', t('Предыдущее')) : ''}
            <button class="chip-main" data-action="nav-plan-due">
                ${forgotten[место].name}
                <span class="chip-count">
                    ${t('{n} дн', { n: forgotten[место].daysSince })}${forgotten.length > 1
                        ? ` · ${место + 1}/${forgotten.length}`
                        : ''}
                </span>
            </button>
            ${forgotten.length > 1 ? стрелка('next', '&rsaquo;', t('Следующее')) : ''}
        </span>
    ` : '';

    return ui.html`
        <div class="section">
            <div class="section-title">${t('Начать')}</div>

            <!--
                Когда план объявлен, он идёт первым и отменяет очередь (§56).
                Очередь угадывает ритм по истории и с задуманным кругом
                расходится: замер дал 17 попаданий из 31. План не угадывает —
                он сказан, и спорить с ним подсказке незачем.
            -->
            ${поПлану ? ui.html`
                <!--
                    Занятие едет на самой кнопке, а не вычисляется заново по
                    нажатию: пересчёт шёл без списка сделанного за неделю и
                    выдавал понедельничное там, где на карточке стояло
                    четверговое. Кнопка обязана начинать ровно то, что назвала.
                -->
                <button class="repeat-card is-queue" data-action="today-start"
                        data-name="${поПлану.name}"
                        data-sets="${поПлану.sets ?? ''}"
                        data-reps="${поПлану.reps ?? ''}">
                    <span class="rep-label">${t('Сегодня по плану')}</span>
                    <span class="rep-names">${поПлану.name}</span>
                    <span class="rep-meta">
                        ${поПлану.sets ? planCore.describe(поПлану).replace(`${поПлану.name} `, '') : t('без объёма')}
                        ${поПлану.planned !== сегодняшнийДень
                            ? ui.raw(` · ${ui.esc(t('перенесено с {день}', { день: dates.formatDayLabel(поПлану.planned, Date.now(), { lower: true }) }))}`)
                            : ''}
                    </span>
                </button>
            ` : первое ? ui.html`
                <button class="repeat-card is-queue" data-action="home-like" data-id="${первое.workoutId}">
                    <span class="rep-label">${t('На очереди')}</span>
                    <span class="rep-names">${compositionName(первое, names, templates)}</span>
                    <span class="rep-meta">
                        ${первое.запись.workout.type}
                        · ${давность(первое)}
                        · ${format.count(первое.запись.sets, format.WORDS.set)}
                    </span>
                </button>
            ` : last ? ui.html`
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

            ${!forgotten.length && differs ? ui.html`
                <p class="hint">
                    ${suggestion.reason === 'cycle'
                        ? t('По чередованию дальше — «{тип}»', { тип: suggestion.type })
                        : t('Дольше всего не было «{тип}»', { тип: suggestion.type })}
                </p>
            ` : ''}

            <!--
                Два подзаголовка вместо одной сплошной россыпи плашек.
                Внешне они похожи, а отвечают на разные вопросы: очередь — «к
                чему вернуться из того, что делаешь», забытое — «что вообще
                выпало из виду». Без границы это читалось как один список с
                непонятно почему разным оформлением (§29.1)
            -->
            ${chips.length ? ui.html`
                <div class="sub-title">${заголовок}</div>
                <div class="chips">${chips}</div>
            ` : ''}

            <!--
                Фон стоит между очередью и забытым: делают его чаще всего
                остального, но выбора он не требует, и потому не спорит за
                место с тем, что требует (§29.1)
            -->
            ${ежедневное.length ? ui.html`
                <div class="sub-title">${t('Чаще всего')}</div>
                <!--
                    Цветом здесь отвечают на единственный вопрос к
                    ежедневному: сегодня уже или ещё нет. Зелёная рамка —
                    сделано, тёплая — нет. Приглушённо: это отметка о
                    состоянии, а не призыв, и спорить с кнопкой внизу ей
                    незачем (§29.1)
                -->
                <div class="chips">
                    ${ежедневное.map((f) => ui.html`
                        <button class="chip is-full ${f.daysSince === 0 ? 'is-done' : 'is-todo'}"
                                data-action="home-like" data-id="${f.workoutId}">
                            ${compositionName(f, names, templates)}
                            <span class="chip-count">
                                ${f.daysSince === 0 ? t('сегодня') : давность(f)}
                            </span>
                        </button>
                    `)}
                </div>
            ` : ''}

            ${forgotten.length ? ui.html`
                <div class="sub-title">${t('Забытое')}</div>
                <div class="chips">${forgottenChip}</div>
            ` : ''}

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
        const [active, сводки, templates, exercises, body, подходы, объявленный] = await Promise.all([
            activeBlock(),
            dbService.listWorkoutSummaries(),
            dbService.listTemplates(),
            dbService.listExercises({ includeArchived: true }),
            dbService.listBodyWeight(),
            dbService.allSets(),
            currentPlan()
        ]);

        // Тоннаж — вся нагрузка, вместе с собственным весом (Р-52). Считается
        // здесь, а не в сводке: доля упражнения и вес тела в подходы не
        // пишутся, и правка любого из них обязана пересчитать историю
        const entries = stats.withBodyLoad(
            сводки, подходы,
            Object.fromEntries(exercises.map((e) => [e.id, e])),
            body,
            (exercise) => estimate.shareOf(exercise)
        );

        const workouts = entries.map((e) => e.workout);
        const names = new Map(exercises.map((e) => [e.id, e.name]));

        // Архив — это «я это больше не делаю». Предлагать оттуда нельзя,
        // а просрочено оно сильнее всего (§26.2.3)
        const архив = new Set(exercises.filter((e) => e.archived).map((e) => e.id));

        // Группы мышц: состав со свежей нагрузкой уходит вниз очереди, каким
        // бы просроченным он ни был (§29.1)
        const группы = new Map(exercises.filter((e) => e.group).map((e) => [e.id, e.group]));

        const очередь = rhythm.dueWorkouts(entries, Date.now(), { groupOf: группы, background: фон });

        /*
         * Фон отдельной строкой (§29.1).
         *
         * Убрав зарядку из очереди, мы оставили её вовсе без быстрого пути:
         * начать её стало можно только через шаблоны. А делают её чаще всего
         * остального — она и должна быть под рукой, просто не соревнуясь с
         * тем, что требует выбора.
         *
         * Тот же расчёт, вывернутый наизнанку: «фоном» здесь объявляется всё
         * нефоновое, и в разбор попадает только зарядка. Мышцы ей ни к чему —
         * очерёдности внутри одного состава не бывает.
         */
        const ежедневное = rhythm.dueWorkouts(entries, Date.now(), {
            background: (w) => !фон(w),
            limit: 2,

            // Сделанное сегодня здесь остаётся, в отличие от очереди: у
            // ежедневного вопрос не «когда вернуться», а «сегодня уже или
            // ещё нет», и исчезнувшая плашка на него не отвечает — она
            // выглядит так же, как если бы зарядки не было вовсе
            includeToday: true
        });

        // Карточке нужны итоги той самой тренировки — тип и число подходов
        const записи = new Map(entries.map((e) => [e.workout.id, e]));

        /*
         * Что сегодня по объявленному плану (§56).
         *
         * Сделанным на этой неделе считается название состава: план говорит
         * «Бицепс резинка», а в истории лежит тренировка из этого упражнения.
         * Сверяться по названию проще и честнее, чем по набору
         * идентификаторов: человек мог добавить упражнение по ходу, и это не
         * повод считать день невыполненным.
         *
         * Зарядка при этом не в счёт. Она идёт каждый день и часто повторяет
         * те же упражнения малым объёмом; засчитай её — и утренняя разминка
         * молча закрывала бы дневное задание, которого никто не делал.
         */
        const сегодняшнийДень = dates.startOfDay(Date.now());
        const понедельник = сегодняшнийДень - ((new Date(сегодняшнийДень).getDay() + 6) % 7) * DAY;

        const сделаноЗаНеделю = entries
            .filter((e) => e.workout.startedAt >= понедельник && !фон(e.workout))
            .flatMap((e) => (e.exerciseIds || []).map((id) => names.get(id)).filter(Boolean));

        const поПлану = planCore.today(объявленный, { done: сделаноЗаНеделю });

        // Карточка «Пора по периодичности» и плашки говорят об одном и том же
        // долге. Что плашки уже предлагают одним нажатием, из карточки убираем:
        // иначе те же названия стоят на экране дважды, а карточке остаётся
        // только то, чего плашки не закрывают — за этим она и нужна.
        //
        // Но вычитаем лишь по-настоящему просроченные плашки: у той, до
        // которой очередь ещё не дошла, срок не вышел, и молчать о её
        // упражнениях карточка не обязана — они могут быть просрочены сами
        // по себе, в других тренировках
        const покрыто = new Set([
            ...архив,
            ...очередь.filter((f) => f.overdue >= 1).flatMap((f) => f.exerciseIds),

            // Упражнения зарядки стоят разделом выше — и просрочены они
            // всегда: делают их ежедневно, значит промежуток равен дню, и
            // назавтра каждое уже «пора». В забытом им делать нечего
            ...ежедневное.flatMap((f) => f.exerciseIds)
        ]);

        return ui.html`
            ${ui.raw(ui.title(t('Тренировка')))}



            ${active || startBlock(
                entries[0],
                templates,
                rhythm.suggestType(workouts),
                names,
                rhythm.dueExercises(entries, Date.now(), { skip: покрыто }),
                rhythm.frequentWorkouts(entries.filter((e) => !фон(e.workout))),
                очередь,
                записи,
                ежедневное,
                поПлану
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

/**
 * Начать то, что сегодня по плану (§56).
 *
 * Задание берётся с самой кнопки: карточка уже решила, что сегодня, с учётом
 * сделанного за неделю, и повторять этот счёт по нажатию нечем — списка
 * сделанного здесь нет, а без него план откатывался бы к началу недели.
 *
 * Упражнение ищется по названию: план написан словами — тренером или
 * языковой моделью, — а справочник хранит записи. Не нашлось — говорим прямо
 * и предлагаем завести, а не собираем пустую тренировку молча.
 */
actions.on('today-start', async (el) => {
    const занятие = {
        name: el.dataset.name || '',
        sets: Number(el.dataset.sets) || null,
        reps: Number(el.dataset.reps) || null
    };

    if (!занятие.name) return app.render();

    /*
     * Упражнения может не оказаться — и это обычный случай, а не сбой.
     *
     * План составляет тренер или языковая модель, и названия в нём свои.
     * Отказать здесь значило бы отправить человека заводить запись руками, а
     * потом возвращаться и начинать заново — ради строки, которая уже есть.
     * Поэтому предлагаем завести прямо отсюда и сразу начать; вид упражнения
     * ставим обычный, а поправить его можно в справочнике.
     */
    let exercise = await dbService.findExerciseByName(занятие.name);

    if (!exercise) {
        const ok = await dialog.confirm({
            title: t('Упражнения нет в справочнике'),
            text: t('План называет «{название}», а такого упражнения не заведено. Завести и начать?', {
                название: занятие.name
            }),
            confirmText: t('Завести')
        });

        if (!ok) return;

        exercise = await dbService.createExercise({ name: занятие.name });
    }

    const workout = await dbService.createWorkout({
        type: t('Силовая'),
        plan: [{
            exerciseId: exercise.id,
            plannedSets: занятие.sets || 1,
            targetReps: занятие.reps ?? null,
            weight: 0,
            skipped: false
        }]
    });

    app.go(workout.interval ? 'interval' : 'session');
});

actions.on('home-forgotten-next', () => { показано += 1; app.render(); });
actions.on('home-forgotten-prev', () => { показано -= 1; app.render(); });

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
