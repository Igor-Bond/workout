/**
 * Экран выполнения (§12 ТЗ).
 *
 * Каждый подход пишется в базу сразу, поэтому отдельного сохранения нет, а
 * незавершённая тренировка переживает закрытие вкладки (§18).
 *
 * Режим влияет только на то, куда приложение переводит взгляд после подхода:
 * данные пишутся одинаково, и в любой момент можно уйти на другое упражнение
 * (§11, §14).
 */

import { ui } from '../core/ui.js';
import { actions } from '../core/actions.js';
import { dialog } from '../core/dialog.js';
import { dbService } from '../services/db.js';
import { engine, STATE } from '../core/engine.js';
import { records } from '../core/records.js';
import { estimate } from '../core/estimate.js';
import { isBackground } from '../core/rhythm.js';
import { restTimer } from '../core/timer.js';
import { hold } from '../core/hold.js';
import { reserve } from '../core/reserve.js';
import { haptics } from '../core/haptics.js';
import { beeper } from '../core/beeper.js';
import { wakeLock } from '../core/wakelock.js';
import { config, MODES } from '../config.js';
import { format } from '../core/format.js';
import { dates } from '../core/dates.js';
import { t } from '../core/i18n.js';
import { app } from '../app.js';

/**
 * На сколько кнопки двигают отдых (§16).
 *
 * Было тридцать секунд, и половина разумных значений оказывалась
 * недостижимой: между минутой и полутора нет ничего, 45 и 75 не набрать
 * вовсе. Грубость к тому же не разовая — кнопка меняет и настройку по
 * умолчанию (Р-26), то есть закрепляет её на все следующие паузы.
 *
 * Пять секунд — мелко настолько, что подойдёт любому; дальность добирается
 * удержанием: кнопка помечена data-hold и при удержании повторяется всё
 * быстрее.
 */
const REST_STEP = 5;

/**
 * Сколько отдыхать после этого упражнения (§16).
 *
 * Своя величина, если она у упражнения есть, иначе общая настройка. Общая
 * остаётся началом отсчёта для незнакомого: пока человек ничего не сказал
 * про конкретное упражнение, ему нечего и помнить.
 *
 * Живёт свободным полем у упражнения, а не отдельной таблицей: схему
 * хранилища трогать нельзя, откат на прошлую версию должен оставаться
 * возможным (§35).
 */
let знакомые = {};

/**
 * Паузы, заданные руками в этой тренировке (Р-81).
 *
 * Старше всего остального, включая дневную паузу плана: человек, поправивший
 * длительность посреди тренировки, сказал своё слово о сегодняшнем дне — а
 * прежде оно молча проигрывало плану, и правка выглядела не сработавшей.
 *
 * Живут в модуле и уходят вместе с экраном: это про сегодняшний день, а не
 * про упражнение вообще. Про упражнение — то, что записано в справочник.
 */
let правки = {};

/**
 * Последняя пауза, заданная в этой тренировке.
 *
 * Ею начинается упражнение, о котором приложение ещё ничего не знает.
 * Раньше таким начиналась общая настройка из профиля, и человек, работающий
 * сегодня с десятиминутными паузами, задавал их заново на каждом новом
 * упражнении.
 */
let последняя = null;

function restOf(exerciseId) {
    /*
     * Порядок старшинства:
     *
     * 1. правка этой тренировки — самое свежее слово человека;
     * 2. своя пауза упражнения из строки плана (Р-84): она сказана про это
     *    упражнение в этом дне и потому точнее дневной;
     * 3. пауза дня из плана (§56.2): одно упражнение стоит в днях с разной
     *    паузой, и своя длительность упражнения такого различия не знает;
     * 4. своя длительность упражнения — сказанное о нём когда-то;
     * 5. последняя пауза этой тренировки — сегодняшний темп;
     * 6. общая настройка.
     */
    const правка = restTimer.clamp(правки[exerciseId]);
    if (правка) return правка;

    const строка = restTimer.clamp(
        view?.workout?.plan?.find((р) => р.exerciseId === exerciseId)?.restSeconds);
    if (строка) return строка;

    const дневная = restTimer.clamp(view?.workout?.restSeconds);
    if (дневная) return дневная;

    const своё = restTimer.clamp(знакомые[exerciseId]?.restSeconds);
    if (своё) return своё;

    return restTimer.clamp(последняя) || config.get('restSeconds');
}

/** Запомнить заданную руками паузу: и за упражнением, и как сегодняшний темп. */
function запомнитьПаузу(exerciseId, seconds) {
    if (exerciseId) правки[exerciseId] = seconds;
    последняя = seconds;
}

/**
 * Записывать ли поправку в само упражнение (Р-101).
 *
 * Записывать — когда паузу диктует само упражнение или общая настройка:
 * «если минуты мало сейчас, её мало и в следующий раз» (Р-46).
 *
 * Не записывать — когда паузу диктует сегодняшний день: строка плана (Р-84)
 * или пауза дня (§56.2). Там поправка про сегодня, а не про упражнение, и
 * записанная в справочник она уезжает в другие тренировки. Владелец поймал
 * это на зарядке: десятиминутная пауза планового понедельника оказалась
 * пятью минутами отдыха посреди восьмиминутной утренней разминки.
 */
function паузаОтДня(exerciseId) {
    const строка = view?.workout?.plan?.find((р) => р.exerciseId === exerciseId)?.restSeconds;

    return !!restTimer.clamp(строка) || !!restTimer.clamp(view?.workout?.restSeconds);
}

/**
 * Довес упражнения с внешним сопротивлением помнится за упражнением (Р-86).
 *
 * У штанги вес — решение на сегодня, и приложение его не предсказывает
 * (§10.2): подставить прошлый значило бы решить за человека, что он поднимет.
 * У резинки это не решение, а свойство снаряда: связка «синяя + зелёная +
 * красная + жёлтая» тянет одинаково в понедельник и в пятницу, и вписывать её
 * заново каждую тренировку — та же морока, что с паузой до Р-46.
 *
 * Признак ровно один и он уже есть: нулевая доля собственного веса (Р-85).
 * Она стоит там, где нагрузка внешняя и другого способа её записать нет.
 */
async function запомнитьДовес(вес) {
    const exercise = знакомые[currentId];
    if (!exercise || !currentId) return;

    if (estimate.shareOf({ ...exercise, kind: exercise.kind || 'weight' }) !== 0) return;

    const число = Number(вес) || 0;
    if (число === (Number(exercise.defaultWeight) || 0)) return;

    // Свой снимок правится сразу: следующая отрисовка читает его, а не базу
    знакомые[currentId] = { ...exercise, defaultWeight: число || undefined };
    await dbService.updateExercise(currentId, { defaultWeight: число || undefined });
}

/** Выбранное упражнение и режим переживают перерисовку экрана. */
let currentId = null;
let mode = null;
let ticker = 0;
let unsubscribe = [];

/** Данные последней отрисовки — чтобы обработчики не ходили в базу заново. */
let view = null;

/** Идёт ли запись подхода прямо сейчас: второе нажатие ждать не станет (Р-112). */
let пишем = false;

/**
 * Идущий отсчёт подхода на время (§57): { exerciseId, target, startedAt }.
 *
 * Живёт в модуле, как и таймер отдыха, и перезагрузку страницы не переживает.
 * Хранить его в базе значило бы завести запись, которая почти всегда мусор:
 * подход на время длится минуту, а перезагрузка посреди планки — случай,
 * которого за тренировку не бывает. Сворачивание приложения он переживает:
 * состояние считается от часов, а не копится тиками.
 */
let отсчёт = null;

/** Сколько раз перевыкладывали сигналы: ключ очереди обязан меняться. */
let выкладка = 0;

const STATE_LABEL = {
    [STATE.PENDING]: 'не начато',
    [STATE.ACTIVE]:  'в работе',
    [STATE.DONE]:    'выполнено',
    [STATE.SKIPPED]: 'пропущено',
    [STATE.EXTRA]:   'вне плана'
};

async function load() {
    const workout = await dbService.getActiveWorkout();
    if (!workout) return null;

    const [sets, list, body, проведённые] = await Promise.all([
        dbService.listSets(workout.id),
        dbService.listExercises({ includeArchived: true }),
        dbService.lastBodyWeight(),
        dbService.listWorkouts()
    ]);

    const exercises = Object.fromEntries(list.map((e) => [e.id, e]));

    // Отсюда берётся своя длительность отдыха: полоса и запуск таймера
    // читают её по идентификатору упражнения (§16)
    знакомые = exercises;
    const rows = engine.progress(workout.plan, sets);

    /*
     * Выбранное упражнение могло закончиться — тогда возвращаемся к подсказке
     * движка. А вот пропущенное отбрасывать нельзя (Р-114).
     *
     * §14 обещает «пропустить упражнение и вернуться к нему позже», а выходило
     * наоборот: строка оставалась в списке и нажималась, но нажатие молча
     * показывало другое упражнение. Человек пропускал жим, потому что скамью
     * заняли, — и вернуться к ней было нечем до конца тренировки.
     */
    const valid = rows.some((r) => r.exerciseId === currentId);
    if (!valid) currentId = engine.nextStep(workout.plan, sets)?.exerciseId || rows[0]?.exerciseId || null;

    // История нужна только по текущему упражнению: тянуть её по всем сразу
    // означало бы читать половину базы ради двух строк на экране
    const kind = exercises[currentId]?.kind || 'weight';
    const history = currentId ? await dbService.listSetsByExercise(currentId) : [];

    return {
        workout, sets, exercises, rows, kind, history,
        bodyWeight: body?.weight || 0,
        last: сравнимый(history, workout, проведённые),
        best: records.best(history, kind, workout.id)
    };
}

/**
 * Прошлый раз, с которым есть смысл сравнивать (Р-54).
 *
 * Брали просто последний, и для упражнения из двух разных тренировок это
 * давало не тот ориентир: отжимания входят и в зарядку одним подходом, и в
 * дневную тренировку на двенадцать. Стоя на двенадцати, человек видел вместо
 * ориентира утреннюю зарядку — «65 повт.» без всякого счёта подходов.
 *
 * Порядок предпочтений:
 *
 *   1. тренировка того же типа — «как я делал это в такой же раз»;
 *   2. любая, кроме фоновой, — зарядка ориентиром для дневной работы не
 *      служит, она делается сама собой (§29.1);
 *   3. вообще любая — иначе первый раз в новом типе остался бы без ориентира,
 *      хотя история есть.
 *
 * Рекорд по этому правилу не отбирается: рекорд один на упражнение, и делить
 * его по типам тренировок значило бы завести несколько лучших результатов.
 */
function сравнимый(history, workout, проведённые) {
    const типы = new Map(проведённые.map((w) => [w.id, w.type]));

    const тот_же = history.filter((s) => типы.get(s.workoutId) === workout.type);
    const не_фон = history.filter((s) => {
        const тип = типы.get(s.workoutId);
        return тип !== undefined && !isBackground({ type: тип });
    });

    return records.lastSession(тот_же, workout.id)
        || records.lastSession(не_фон, workout.id)
        || records.lastSession(history, workout.id);
}

/**
 * Примерная нагрузка у упражнения со своим весом (§15.2).
 *
 * У снаряда нагрузка названа числом прямо в поле ввода, и повторять её
 * строкой незачем. А по записи «25 отжиманий» о нагрузке не сказать
 * ничего: это две трети собственного веса, и сколько это в килограммах —
 * единственный способ сравнить их с жимом.
 */
function loadLine({ exercises, kind, bodyWeight }, prefill) {
    const exercise = exercises[currentId] || {};

    /*
     * У нулевой доли вес тела ни при чём (Р-85, Р-86): своего веса в
     * упражнении нет, а довес есть — и показать его надо, даже если человек
     * ни разу не взвешивался. Взвешивание требуется только там, где долю на
     * него умножают.
     */
    const доля = estimate.shareOf({ ...exercise, kind });
    const свой = доля === 0 ? 0 : estimate.bodyLoad({ exercise: { ...exercise, kind }, bodyWeight });

    if (свой === null) return '';

    const довес = Number(prefill?.weight) || 0;
    const когда = kind === 'time' ? t('на удержании') : t('за повторение');

    return ui.html`
        <!--
            У резинки доля своего веса нулевая (Р-85), и строки «своим весом»
            быть не должно: своего веса там не поднимают. Но вторая строка
            нужна и ей — тем и записывается нагрузка резинки, если её
            измерили.
        -->
        ${свой > 0 ? ui.html`
            <div class="rec-line">
                <span class="rec-label">${t('Своим весом')}</span>
                <span class="rec-value">≈ ${format.load(свой)} ${t('кг')}</span>
                <span class="rec-when">${когда}</span>
            </div>
        ` : ''}

        <!--
            Вторая строка стоит в разметке всегда, но показывается, только
            когда есть что складывать. Так она успевает ответить на ввод:
            цифру вписывают до записи подхода, и увидеть, во что она
            превратилась, нужно тогда же, а не после (Р-53).
        -->
        <div class="rec-line" id="rec-extra" ${ui.raw(довес > 0 ? '' : 'hidden')}>
            <span class="rec-label">${t('С дополнительным весом')}</span>
            <span class="rec-value" id="rec-extra-value">≈ ${format.load(свой + довес)} ${t('кг')}</span>
            <span class="rec-when">${когда}</span>
        </div>
    `;
}

/**
 * Пересчёт строки «с дополнительным весом» на месте (Р-53).
 *
 * Без перерисовки: она вырвала бы фокус из поля, в котором прямо сейчас
 * набирают цифру, — тем же правилом живёт полоса отдыха.
 */
function refreshExtraLine() {
    const row = document.getElementById('rec-extra');
    if (!row || !view) return;

    const exercise = { ...(view.exercises[currentId] || {}), kind: view.kind };

    const доля = estimate.shareOf(exercise);
    const свой = доля === 0 ? 0 : estimate.bodyLoad({ exercise, bodyWeight: view.bodyWeight });

    if (свой === null) return;

    const довес = Number(document.getElementById('f-weight')?.value) || 0;
    row.hidden = довес <= 0;

    const value = document.getElementById('rec-extra-value');
    const текст = `≈ ${format.load(свой + довес)} ${t('кг')}`;

    if (value && value.textContent !== текст) value.textContent = текст;
}

/**
 * Ориентиры перед подходом (§15).
 *
 * Текущая тренировка в рекорд не входит, пока не завершена: иначе «лучший
 * результат» обновлялся бы прямо во время выполнения и сравнивать было бы
 * не с чем.
 */
function recordsBlock({ last, best, kind }) {
    if (!last && !best) {
        return ui.html`<div class="rec-line rec-empty">${t('Первый раз — ориентиров пока нет')}</div>`;
    }

    return ui.html`
        ${last ? ui.html`
            <div class="rec-line">
                <span class="rec-label">${t('Последний раз')}</span>
                <span class="rec-value">${records.describeSession(last.sets, kind)}</span>
                <span class="rec-when">${dates.formatDayLabel(last.performedAt)}</span>
            </div>
        ` : ''}

        ${best ? ui.html`
            <div class="rec-line">
                <span class="rec-label">${t('Лучший результат')}</span>
                <span class="rec-value">${records.describe(best, kind)}</span>
            </div>
        ` : ''}
    `;
}

/*
 * Разовый максимум с этого экрана убран намеренно.
 *
 * Он оценочный, считается по формуле и выше десяти повторений заметно
 * врёт, а место занимал в самом тесном месте приложения. Между подходами
 * важно, что было в прошлый раз и каков рекорд, — прикидка не нужна.
 * На карточке упражнения, где место есть, он остался.
 */

/**
 * Изменение последнего подхода к прошлому разу (§15.1).
 *
 * Без него человек сравнивает числа в уме: «в прошлый раз во втором
 * подходе было 60 на 9, сейчас 62,5 на 8 — это лучше или хуже?». Приложение
 * знает оба числа и должно отвечать само.
 *
 * Сравнивается подход с тем же номером: второй со вторым. К концу
 * упражнения сил меньше, и сравнение третьего подхода с первым всегда
 * показывало бы спад.
 */
function deltaLine({ last, kind }, own) {
    if (!last) return '';

    const current = own[own.length - 1];
    const previous = last.sets.find((s) => s.setNumber === current.setNumber);

    const delta = records.delta(current, previous, kind);
    if (!delta) return '';

    if (delta.parts.length === 0) {
        return ui.html`<div class="sess-delta is-same">${t('как в прошлый раз')}</div>`;
    }

    return ui.html`
        <div class="sess-delta ${delta.better === true ? 'is-up' : delta.better === false ? 'is-down' : ''}">
            ${t('{изменения} к прошлому разу', { изменения: delta.parts.join(', ') })}
        </div>
    `;
}

/** Полоса отдыха. Ввод следующего подхода она не перекрывает (§16). */
function restBar() {
    if (!restTimer.running) return '';

    /*
     * Чья это величина — общая или своя у упражнения (§16).
     *
     * Без подписи переход к следующему упражнению менял бы число «сам собой»:
     * то самое удивление, из-за которого своя длительность когда-то и была
     * убрана (Р-26). Теперь она вернулась, но названа вслух.
     */
    const своё = знакомые[restTimer.exerciseId]?.restSeconds;

    return ui.html`
        <div class="rest-bar">
            <span class="rest-label">${своё ? t('Отдых для этого упражнения') : t('Отдых')}</span>
            <strong id="rest-remaining">${format.seconds(restTimer.remaining)}</strong>
            <button class="chip" data-action="rest-shorten" data-hold>${t('−{n} с', { n: REST_STEP })}</button>
            <button class="chip" data-action="rest-extend" data-hold>${t('+{n} с', { n: REST_STEP })}</button>
            <button class="chip" data-action="rest-skip">${t('Пропустить')}</button>
        </div>
    `;
}

/**
 * Экран идущего отсчёта (§57).
 *
 * Крупное число — оставшиеся секунды, если цель задана, и прошедшие, если
 * это секундомер. На него смотрят из планки одним глазом, и всё остальное на
 * этом месте лишнее.
 *
 * «Готово» записывает то, что правда прошло, а не цель: остановиться на
 * тридцатой секунде из сорока пяти — обычное дело, и записать за это сорок
 * пять значило бы соврать ровно там, ради чего отсчёт и заводился.
 */
function holdBlock() {
    const состояние = hold.at(отсчёт.target, (Date.now() - отсчёт.startedAt) / 1000);

    const подготовка = состояние.phase === 'lead';

    const число = подготовка ? состояние.left
        : отсчёт.target ? состояние.left
        : состояние.worked;

    return ui.html`
        <div class="hold ${подготовка ? 'is-lead' : ''}">
            <div class="big-input hold-number" id="hold-number">${число}</div>
            <div class="big-label" id="hold-label">
                ${подготовка ? t('приготовься') : отсчёт.target ? t('секунд осталось') : t('секунд идёт')}
            </div>
        </div>

        <button class="btn btn-done btn-lg" data-action="sess-hold-stop">
            ${подготовка ? t('Отмена') : t('Готово')}
        </button>
    `;
}

/**
 * Выбранный запас — до записи подхода он живёт только на экране.
 *
 * В модуле, а не в поле ввода: чипы перерисовываются вместе с карточкой, и
 * выбор иначе слетал бы при каждой отрисовке. Сбрасывается после записи —
 * запас относится к подходу, а не к упражнению.
 */
let запас = null;

/**
 * Запас в подходе (§59).
 *
 * Три ответа, а не число: между «ещё два» и «ещё три» человек не различает,
 * а «почти до отказа», «около двух» и «было легко» различает уверенно.
 *
 * Ряд стоит на виду, а не под «Ещё…»: он и есть то, ради чего затевалось
 * правило прогрессии, и спрятанный он не нажимался бы никогда. Но и не
 * обязателен: не ответил — подход запишется без отметки, а правило подождёт
 * следующего раза.
 *
 * Подсказка правила стоит здесь же, рядом с ответом, который её и породил.
 */
function запасБлок({ history, kind, exercises }) {
    const занятия = records.sessions(history || []).map((s) => s.sets);
    const итог = reserve.verdict(занятия);

    const чип = (value, label) => ui.html`
        <button class="chip ${запас === value ? 'is-active' : ''}"
                data-action="sess-reserve" data-value="${value}">${label}</button>
    `;

    const прошлые = kind === 'weight' ? t('вес') : t('сопротивление');

    return ui.html`
        <div class="reserve">
            <!--
                Подпись называет единицу (§59, Р-120).

                Было «Запас в подходе», и единицы не было нигде: ни в подписи,
                ни в ответах. Новичок читает «около двух» и не понимает — два
                подхода? две минуты? Не поняв, он не отвечает вовсе, и правило
                прогрессии молчит навсегда: ему нечем считать.

                Подпись стоит отдельной строкой над чипами, не в один ряд с
                ними, — длина её ничего не ломает, а ряд ответов остаётся тем
                же (Р-74).
            -->
            <span class="reserve-label">${t('Сколько повторений в запасе')}</span>
            <div class="chips">
                <!--
                    Подписи короткие: три ответа обязаны стоять в один ряд
                    (Р-74). Перенос на вторую строку превращал выбор в список,
                    а спрашивают это между подходами, одним взглядом.

                    Смысл при этом сохранён. «До отказа» было бы неправдой:
                    это ноль запаса, а речь про один; «почти отказ» — то же
                    самое, что «почти до отказа», только без лишних слов.
                -->
                ${чип(reserve.LOW, t('почти отказ'))}
                ${чип(reserve.TARGET, t('около двух'))}
                ${чип(reserve.HIGH, t('легко'))}
            </div>

        </div>

        ${итог.verdict === 'harder' ? ui.html`
            <p class="hint is-accent">
                ${t('Два занятия подряд запас был большой — пора увеличить {что}. Повторения при этом вниз примерно на пятую часть.', { что: прошлые })}
            </p>
        ` : итог.verdict === 'easier' ? ui.html`
            <p class="hint">
                ${t('Два занятия подряд подход шёл почти до отказа. Это тяжелее, чем нужно: цель — оставлять около двух повторений.')}
            </p>
        ` : ''}
    `;
}

/**
 * В чём человек считает это упражнение на время (Р-87).
 *
 * Планку держат секундами, а баскетбол играют часами: 90 минут в поле для
 * секунд — это 5400, и вписывать такое никто не станет. Единица помнится за
 * упражнением, как пауза (Р-46) и вес резинки (Р-86): она свойство занятия, а
 * не сегодняшнее решение.
 *
 * Внутри всё по-прежнему в секундах — в базе, в отсчёте, в истории. Минуты
 * живут только на входе и на подписи.
 */
const МИНУТА = 60;

function вМинутах(exercise) {
    return exercise?.timeUnit === 'min';
}

/** Множитель ввода: во что превращается вписанное число. */
function шагВремени(exercise) {
    return вМинутах(exercise) ? МИНУТА : 1;
}

/** Поля ввода зависят от вида упражнения (§6). */
function fields(kind, prefill, exercise = {}) {
    const value = (v) => (v === null || v === undefined ? '' : v);

    if (kind === 'time') {
        /*
         * Пока идёт отсчёт, поля ввода нет вовсе (§57).
         *
         * Держать планку и печатать одновременно нельзя, и поле на этом
         * месте только предлагало бы соврать. Вместо него — то самое число,
         * ради которого всё и затевалось, крупно.
         */
        if (отсчёт?.exerciseId === currentId) return holdBlock();

        const минуты = вМинутах(exercise);
        const введённое = prefill.duration === null || prefill.duration === undefined
            ? null
            : (минуты ? Math.round((prefill.duration / МИНУТА) * 10) / 10 : prefill.duration);

        return ui.html`
            <input type="number" class="big-input" id="f-duration" min="0" inputmode="decimal"
                   placeholder="0" value="${value(введённое)}" data-enter="sess-done">
            <label class="big-label" for="f-duration">${минуты ? t('минут') : t('секунд')}</label>

            <!--
                Отсчёт предлагается, но не навязывается: поле остаётся, и
                вписать число руками можно по-прежнему. Секундомер без цели
                тоже нужен — планку «до отказа» никакой целью не описать.

                Занятие на час отсчётом не меряют вовсе — его записывают по
                факту, одним числом (Р-87). Поэтому рядом переключатель
                единицы: он же и говорит, в чём приложение сейчас считает.
            -->
            <div class="row-links">
                <button class="btn btn-accent" data-action="sess-hold-start">${t('Отсчёт')}</button>
                <button class="link-btn" data-action="sess-time-unit">
                    ${минуты ? t('считать в секундах') : t('считать в минутах')}
                </button>
            </div>
        `;
    }

    if (kind === 'distance') {
        return ui.html`
            <input type="number" class="big-input" id="f-distance" min="0" inputmode="numeric"
                   placeholder="0" value="${value(prefill.distance)}" data-enter="sess-done">
            <label class="big-label" for="f-distance">${t('метров')}</label>
            <div class="inline-field">
                <label for="f-duration">${t('время:')}</label>
                <input type="number" id="f-duration" min="0" inputmode="numeric"
                       placeholder="—" value="${value(prefill.duration)}">
                <span>${t('сек')}</span>
            </div>
        `;
    }

    return ui.html`
        <!--
            Повторения правятся и без клавиатуры (§12, Р-120).

            Поправка на одно-два повторения — самое частое, что делают на этом
            экране, а делают его стоя, между подходами, мокрой рукой. Раньше
            она стоила открытия клавиатуры и трёх-четырёх точных касаний:
            в поле стоит число прошлого подхода, по касанию оно не выделялось,
            и чтобы из «12» получить «8», надо было попасть в поле, дважды
            стереть и набрать. Промах давал не мусор, а правдоподобное неверное
            число — «128» или «812», — которое потом уезжало в рекорды и тоннаж.

            Удержание повторяет шаг: механика та же, что у длительности отдыха.
        -->
        <div class="big-row">
            <button class="step-btn" data-action="sess-reps-down" data-hold
                    aria-label="${t('На одно меньше')}">−</button>

            <input type="number" class="big-input" id="f-reps" min="0" inputmode="numeric"
                   placeholder="0" value="${value(prefill.reps)}" data-enter="sess-done">

            <button class="step-btn" data-action="sess-reps-up" data-hold
                    aria-label="${t('На одно больше')}">+</button>
        </div>
        <!--
            Подпись поля — label, а не строка рядом (§31, Р-122).

            На остальных экранах — в профиле, в плане, в знакомстве, в окнах с
            полями — label стоит везде; единственными без него остались поля
            того экрана, ради которого приложение и открывают. Экранный диктор
            называл их «поле ввода», и на слух было не различить, в какое из
            трёх набирают.

            Заодно возвращается попадание: нажатие на слово «повторений»
            выглядело подписью поля, а не вело никуда.
        -->
        <label class="big-label" for="f-reps">${t('повторений')}</label>

        <!--
            У упражнения со своим весом поле значит дополнительный вес — пояс,
            гантель между стоп, — а не всю нагрузку (Р-49). Оно спрятано за
            ссылкой, как заметка: надевают пояс редко, а открытое поле с
            прочерком звало вписать в него общую прикидку. Именно так в него и
            попадали числа, которые потом считались железом.

            Открыто сразу, если вес уже записан: иначе спрятанным оказалось бы
            то, что человек только что ввёл.
        -->
        ${kind === 'reps' ? ui.html`
            <div class="note-row">
                <!--
                    Ссылка остаётся на месте и переключает знак — свернуть
                    надо тем же движением, каким открыли (Р-53). Спрятанная,
                    она оставляла поле открытым до конца тренировки.
                -->
                <button class="link-btn" data-action="sess-weight-toggle">
                    ${prefill.weight ? t('− дополнительный вес') : t('＋ дополнительный вес')}
                </button>
            </div>
        ` : ''}

        <!--
            У своего веса подписи здесь нет: её роль играет ссылка над полем
            (Р-53). Со своей подписью выходило два одинаковых слова подряд —
            «− дополнительный вес» и «дополнительный вес:» строкой ниже.
        -->
        <div class="inline-field" id="f-weight-row" ${ui.raw(kind === 'reps' && !prefill.weight ? 'hidden' : '')}>
            ${kind === 'reps' ? '' : ui.html`<label for="f-weight">${t('вес:')}</label>`}
            <input type="number" id="f-weight" min="0" step="0.5" inputmode="decimal"
                   placeholder="—" value="${value(prefill.weight)}"
                   aria-label="${kind === 'reps' ? t('дополнительный вес, кг') : t('вес, кг')}">
            <span>${t('кг')}</span>
        </div>
    `;
}

function currentCard({ workout, sets, exercises, rows }) {
    const row = rows.find((r) => r.exerciseId === currentId);
    if (!row) return ui.empty(t('Добавь упражнение, чтобы начать.'));

    const exercise = exercises[currentId] || {};
    // Довес резинки — свойство снаряда, а не решение на сегодня (Р-86):
    // движку он приносится готовым, справочника тот не знает
    const prefill = engine.prefill(workout.plan, sets, currentId, {
        weight: estimate.shareOf({ ...exercise, kind: exercise.kind || 'weight' }) === 0
            ? exercise.defaultWeight
            : null
    });
    const own = engine.setsOf(sets, currentId);

    const planItem = workout.plan.find((p) => p.exerciseId === currentId);

    return ui.html`
        <div class="card session-card">
            <div class="sess-name">${exercise.name || t('Упражнение')}</div>
            <div class="sess-set">
                ${row.planned > 0
                    ? t('Подход {n} из {всего}', { n: row.done + 1, всего: row.planned })
                    : t('Подход {n}', { n: row.done + 1 })}
            </div>

            <div class="rec-block">
                ${recordsBlock(view)}
                ${loadLine(view, prefill)}
            </div>

            ${fields(exercise.kind || 'weight', prefill, exercise)}

            <!--
                Во время отсчёта заметки и «Выполнено» убраны (§57): свою
                кнопку отсчёт показывает сам, а вторая рядом означала бы два
                разных способа закончить один подход.
            -->
            ${отсчёт?.exerciseId === currentId ? '' : ui.html`
                ${запасБлок(view)}
                <div class="note-row">
                    <button class="link-btn" data-action="sess-note-toggle">${t('＋ заметка к подходу')}</button>
                    <input type="text" id="f-note" class="note-input" hidden
                           placeholder="${t('техника, самочувствие, особенности')}" autocomplete="off">
                </div>

                <button class="btn btn-done btn-lg" data-action="sess-done">${t('Выполнено')}</button>
            `}

            ${restBar()}

            ${own.length ? ui.html`
                <div class="sess-done">
                    <span class="sess-done-label">${t('Сделано')}</span>
                    <span class="num">${records.describeSession(own, exercise.kind)}</span>
                </div>
                ${deltaLine(view, own)}
            ` : ''}

            <!--
                Редкие действия убраны под «Ещё»: пропуск, отмена и заметка
                нужны в одном подходе из двадцати, а место на главном экране
                занимали постоянно. Список сворачивается обратно после каждой
                записи — так и задумано.
            -->
            <div class="note-row">
                <button class="link-btn" data-action="sess-more">${t('Ещё…')}</button>
            </div>

            <div class="sess-tools" hidden>
                <!--
                    У пропущенного — дорога назад, а не второй пропуск (Р-114):
                    §14 обещает «вернуться к нему позже», и обещание должно быть
                    чем-то обеспечено.
                -->
                ${row.state === STATE.SKIPPED ? ui.html`
                    <button class="btn btn-ghost btn-sm" data-action="sess-unskip">${t('Вернуть в план')}</button>
                ` : ui.html`
                    <button class="btn btn-ghost btn-sm" data-action="sess-skip">${t('Пропустить упражнение')}</button>
                `}
                <!--
                    Кнопка живёт, пока в тренировке есть хоть один подход, а не
                    только у этого упражнения (Р-113): режимы «по кругу» и «по
                    одному» уводят дальше сразу после записи, и отменять было
                    нечего ровно тогда, когда ошибку и замечают.
                -->
                ${sets.length ? ui.html`
                    <button class="btn btn-ghost btn-sm" data-action="sess-undo">${t('Отменить последний подход')}</button>
                ` : ''}
                <button class="btn btn-ghost btn-sm" data-action="sess-note-exercise">
                    ${planItem?.note ? `${t('Заметка к упражнению')} ✎` : t('Заметка к упражнению')}
                </button>
                <button class="btn btn-ghost btn-sm" data-action="sess-rest">
                    ${t('Отдых: {время}', { время: format.seconds(restOf(currentId)) })}
                </button>
            </div>

            ${planItem?.note ? ui.html`<p class="note-shown">${planItem.note}</p>` : ''}
        </div>
    `;
}

function exerciseList({ exercises, rows }) {
    const items = rows.map((row, i) => ui.html`
        <button class="prog-row ${row.exerciseId === currentId ? 'is-current' : ''} is-${row.state}"
                data-action="sess-select" data-id="${row.exerciseId}">
            ${i < 9 ? ui.html`<span class="prog-key">${String(i + 1)}</span>` : ''}
            <span class="prog-name">${exercises[row.exerciseId]?.name || 'Упражнение'}</span>
            <span class="prog-count">${row.planned > 0 ? `${row.done}/${row.planned}` : String(row.done)}</span>
            <span class="prog-state">${t(STATE_LABEL[row.state])}</span>
        </button>
    `);

    return ui.html`
        <div class="card">
            <div class="card-title">${t('Упражнения')}</div>
            <div class="prog-list">${items}</div>
            <button class="btn btn-ghost btn-sm" data-action="sess-add">${t('+ Добавить упражнение')}</button>
            <p class="hint keys-hint">${t('Цифра — выбрать упражнение, Enter — записать подход, пробел — пропустить отдых.')}</p>
        </div>
    `;
}

export const session = {

    title: 'Выполнение',
    nav: 'workout',

    async render() {
        if (mode === null) mode = config.mode();

        view = await load();

        if (!view) {
            return ui.html`
                ${ui.title(t('Выполнение'))}
                ${ui.empty(t('Активной тренировки нет.'))}
                <button class="btn btn-accent" data-action="nav" data-screen="plan">${t('Новая тренировка')}</button>
                <button class="btn btn-ghost" data-action="nav" data-screen="home">${t('← На главную')}</button>
            `;
        }

        const { workout, sets } = view;
        const totals = engine.totals(workout.plan, sets);
        const complete = engine.isComplete(workout.plan, sets);

        return ui.html`
            <div class="sess-head">
                <div>
                    <div class="sess-type">${workout.type}</div>
                    <div class="sess-meta">
                        <strong id="sess-elapsed">${format.duration(Date.now() - workout.startedAt)}</strong>
                        · ${t('{done} из {planned} подходов', { done: totals.done, planned: totals.planned })}
                    </div>
                </div>
                <div class="chips">
                    ${MODES.map((m) => ui.html`
                        <button class="chip ${mode === m.value ? 'is-active' : ''}"
                                data-action="sess-mode" data-mode="${m.value}"
                                title="${t(m.hint)}">${t(m.label)}</button>
                    `)}
                </div>
            </div>

            ${complete ? ui.html`
                <div class="banner"><span>${t('План выполнен — можно завершать')}</span></div>
            ` : ''}

            <div class="sess-layout">
                <div class="sess-main">${currentCard(view)}</div>
                <div class="sess-side">${exerciseList(view)}</div>
            </div>

            ${workout.note ? ui.html`
                <div class="card"><div class="card-title">${t('Заметка к тренировке')}</div><p>${workout.note}</p></div>
            ` : ''}

            <button class="btn btn-ghost" data-action="sess-note-workout">
                ${workout.note ? t('Изменить заметку к тренировке') : t('Заметка к тренировке')}
            </button>

            <button class="btn ${complete ? 'btn-accent' : 'btn-ghost'}" data-action="sess-finish">
                ${t('Завершить тренировку')}
            </button>
        `;
    },

    /**
     * Время идёт от сохранённого момента старта, а не от счётчика тиков
     * (§17): вкладку сворачивают, таймеры засыпают, и досчитывать надо от
     * часов, а не от того, сколько раз успел сработать интервал.
     */
    mount() {
        clearInterval(ticker);
        unsubscribe.forEach((off) => off());
        unsubscribe = [];

        if (!view) return;

        ticker = setInterval(() => {
            const live = document.getElementById('sess-elapsed');
            if (!live) return clearInterval(ticker);

            live.textContent = format.duration(Date.now() - view.workout.startedAt);

            // Отсчёт подхода идёт тем же тиком (§57): второй интервал рядом
            // с этим считал бы то же самое время по своим часам
            тикОтсчёта();
        }, 1000);

        /*
         * Возвращение из фона перекладывает сигналы отсчёта (§50.1).
         *
         * Пока приложение было свёрнуто, звуковой контекст мог уснуть, и его
         * часы отстали от настоящих: выложенное по старым прозвучало бы
         * позже срока, а то и после конца подхода. Тик при этом досчитает
         * сам — он смотрит на часы, а не на пропущенные срабатывания.
         */
        const вернулись = () => {
            if (document.visibilityState !== 'visible' || !отсчёт) return;
            выложитьСигналы((Date.now() - отсчёт.startedAt) / 1000);
        };

        document.addEventListener('visibilitychange', вернулись);
        unsubscribe.push(() => document.removeEventListener('visibilitychange', вернулись));

        // Полоса отдыха обновляется на месте: перерисовывать экран раз в
        // секунду означало бы вырывать фокус из поля ввода
        unsubscribe.push(restTimer.on('tick', () => {
            const el = document.getElementById('rest-remaining');
            if (el) el.textContent = format.seconds(restTimer.remaining);
        }));

        /*
         * Конец отдыха тоже убирается на месте (Р-111).
         *
         * Перерисовка была бы проще, но она пересобирает поля из подстановки
         * — то есть возвращает в них число прошлого подхода. Таймер написан
         * ровно под то, чтобы вводить во время паузы, и человек, набравший
         * «21» и замешкавшийся с кнопкой, получал обратно «12». Подмена
         * приходит без нажатия, заметить её между подходами нечем, и прошлый
         * результат записывается ещё раз как новый.
         *
         * Все ручные переключатели этого экрана — «Ещё…», довес, заметка —
         * сделаны без перерисовки по той же причине. Здесь это правило
         * нарушалось единственный раз, и нарушал его не человек, а таймер.
         */
        unsubscribe.push(restTimer.on('finish', () => {
            document.querySelector('.rest-bar')?.remove();
            refreshRest();
        }));

        /*
         * Строка нагрузки отвечает на ввод довеса сразу (Р-53).
         *
         * Событие input, а не change: change приходит по потере фокуса, то
         * есть уже после того, как человек нажал «Выполнено», — и ответ
         * опаздывал бы ровно на тот подход, ради которого его и смотрят.
         */
        const weightField = document.getElementById('f-weight');

        if (weightField) {
            const слушатель = () => refreshExtraLine();
            weightField.addEventListener('input', слушатель);
            unsubscribe.push(() => weightField.removeEventListener('input', слушатель));
        }

        keyboard.attach();

        // Между подходами проходит минута-полторы, и экран успевает
        // погаснуть ровно к моменту записи результата (§28)
        wakeLock.enable();
    },

    unmount() {
        clearInterval(ticker);
        unsubscribe.forEach((off) => off());
        unsubscribe = [];

        keyboard.detach();
        wakeLock.disable();
    },

    /**
     * Уход с экрана: отсчёт снимается вместе со звуком (§57).
     *
     * Не в unmount: тот вызывается перед каждой отрисовкой, и снятый там
     * отсчёт кончался бы, не начавшись. Уход же настоящий — ушёл с экрана
     * выполнения, значит подход прерван, и досчитывать его вслепую, пока
     * человек смотрит историю, приложению незачем.
     *
     * Заодно забываются сегодняшние правки пауз (Р-81): они про эту
     * тренировку, а не про упражнение вообще. То, что сказано об упражнении
     * насовсем, лежит в справочнике и переживает всё.
     */
    leave() {
        if (отсчёт) снятьОтсчёт();

        правки = {};
        последняя = null;
    }
};

/**
 * Клавиатура на экране выполнения (§32).
 *
 * За компьютером руки уже на клавиатуре, и тянуться мышью к списку
 * упражнений после каждого подхода — лишнее движение. Цифра выбирает
 * упражнение по его номеру в списке, Enter записывает подход (это делает
 * data-enter на поле), пробел пропускает отдых.
 *
 * Обработчик снимается при уходе с экрана: иначе цифры продолжали бы
 * что-то выбирать в истории и статистике.
 */
const keyboard = {

    handler: null,

    attach() {
        keyboard.detach();

        keyboard.handler = (e) => {
            // В поле ввода цифры — это цифры, а не команды.
            // Цель события не всегда элемент, поэтому проверка через ?.
            if (e.target?.matches?.('input, textarea, select')) return;
            if (e.ctrlKey || e.altKey || e.metaKey) return;

            if (e.code === 'Space' && restTimer.running) {
                e.preventDefault();
                restTimer.stop();
                return app.render();
            }

            const digit = Number(e.key);
            if (!Number.isInteger(digit) || digit < 1 || digit > 9) return;

            const row = view?.rows[digit - 1];
            if (!row) return;

            e.preventDefault();
            currentId = row.exerciseId;
            mode = 'free';
            app.render();
        };

        document.addEventListener('keydown', keyboard.handler);
    },

    detach() {
        if (!keyboard.handler) return;

        document.removeEventListener('keydown', keyboard.handler);
        keyboard.handler = null;
    }
};

// ================== ЗАПИСЬ ПОДХОДА ==================

/**
 * Поле не прошло проверку (Р-115).
 *
 * Раньше это была только красная рамка, гаснущая через 0,8 секунды. Человек в
 * этот момент смотрит на кнопку, а не на поле: восемьсот миллисекунд спустя
 * единственное свидетельство того, что подход не записался, исчезало бесследно
 * — кнопка не сработала, экран прежний, объяснения нет.
 *
 * Теперь рамка держится, пока в поле не начнут вписывать, и рядом стоит
 * строка, которая говорит, чего не хватает.
 */
/**
 * Шаг повторений кнопкой (§12, Р-120).
 *
 * Правится поле, а не черновик: числа этого экрана живут в разметке до
 * нажатия «Выполнено», и заводить ради шага второе место хранения значило бы
 * держать два ответа на один вопрос.
 *
 * Событие input рассылается вручную: на нём снимается пометка ошибки, и без
 * него исправленное кнопкой поле осталось бы красным.
 */
function шагПовторений(шаг) {
    const поле = document.getElementById('f-reps');
    if (!поле) return;

    const было = Number(поле.value);

    поле.value = String(Math.max(0, (Number.isFinite(было) ? было : 0) + шаг));
    поле.dispatchEvent(new Event('input', { bubbles: true }));

    haptics.tap();
}

actions.on('sess-reps-up', () => шагПовторений(1));
actions.on('sess-reps-down', () => шагПовторений(-1));

/*
 * Касание по полю выделяет число целиком (Р-120).
 *
 * В поле стоит прошлый результат, и набранное к нему дописывалось: касание
 * ставило курсор внутрь числа, и «8» поверх «12» давало «128». Выделенное
 * число набранное заменяет — так ведут себя поля везде, где в них стоит
 * значение по умолчанию.
 *
 * Слушатель один на модуль, а не на поле: экран перерисовывается после
 * каждого действия, и повешенное на узел терялось бы вместе с ним.
 */
document.addEventListener('focusin', (e) => {
    const поле = e.target;

    if (!(поле instanceof HTMLInputElement)) return;
    if (!['f-reps', 'f-weight', 'f-duration', 'f-distance'].includes(поле.id)) return;

    // Отложено на такт: часть браузеров ставит курсор уже после focus, и
    // немедленное выделение они же и снимают
    setTimeout(() => {
        if (document.activeElement === поле) поле.select();
    }, 0);
});

function invalid(id, сообщение = t('Впишите число')) {
    const el = document.getElementById(id);
    if (!el) return;

    el.focus();
    el.classList.add('is-invalid');
    el.setAttribute('aria-invalid', 'true');

    const прежняя = el.parentElement?.querySelector('.field-error');
    if (прежняя) прежняя.remove();

    const строка = document.createElement('div');
    строка.className = 'field-error';
    строка.textContent = сообщение;
    el.parentElement?.insertBefore(строка, el.nextSibling);

    const снять = () => {
        el.classList.remove('is-invalid');
        el.removeAttribute('aria-invalid');
        строка.remove();
        el.removeEventListener('input', снять);
    };

    el.addEventListener('input', снять);
}

/**
 * Число, выпавшее из ряда, спрашивается вслух (Р-113).
 *
 * Промах в поле даёт не очевидный мусор, а правдоподобное число: «128» вместо
 * «8», «1212» вместо «12». На таком глаз не спотыкается, а записанный подход
 * тут же становится личным рекордом, ложится в тоннаж и в сравнение «к
 * прошлому разу». Исправить его потом нечем.
 *
 * Спрашиваем только при разнице втрое и больше: прибавка — обычное дело, и
 * вопрос на каждый прирост был бы хуже молчания. Ориентир — лучшее из
 * рекорда и уже сделанного сегодня; нет ориентира — не о чем и спрашивать.
 *
 * Ноль — отдельный случай: он проходит как выполненный подход и попадает в
 * счёт. Не отвергаем — неудавшийся подход тоже бывает записью, — но называем.
 */
async function числоПравдоподобно(values) {
    const свои = engine.setsOf(view.sets, currentId);

    const ориентир = (поле) => Math.max(
        Number(view.best?.[поле]) || 0,
        ...свои.map((s) => Number(s[поле]) || 0),
        0
    );

    if (values.reps === 0) {
        return dialog.confirm({
            title: t('Ноль повторений'),
            text: t('Подход не получился? Он всё равно запишется и попадёт в счёт.'),
            confirmText: t('Записать'),
            cancelText: t('Поправить')
        });
    }

    for (const поле of ['reps', 'weight']) {
        const введено = Number(values[поле]) || 0;
        const было = ориентир(поле);

        if (!было || введено < 30 || введено < было * 3) continue;

        const ok = await dialog.confirm({
            title: t('Проверьте число'),
            text: t('{введено} — втрое больше, чем было раньше ({было}). Записать как есть?', {
                введено, было
            }),
            confirmText: t('Записать'),
            cancelText: t('Поправить')
        });

        if (!ok) {
            invalid(поле === 'reps' ? 'f-reps' : 'f-weight');
            return false;
        }
    }

    return true;
}

/** Значения полей по виду упражнения. null означает «не прошло проверку». */
function readFields(kind, exercise = {}) {
    const num = (id) => {
        const el = document.getElementById(id);
        if (!el || el.value.trim() === '') return null;
        const value = Number(el.value);
        return Number.isFinite(value) ? value : null;
    };

    if (kind === 'time') {
        // Вписать могли в минутах (Р-87), а хранится всегда в секундах
        const введённое = num('f-duration');
        const duration = введённое === null ? null : Math.round(введённое * шагВремени(exercise));

        if (!duration || duration <= 0) { invalid('f-duration'); return null; }
        return { duration };
    }

    if (kind === 'distance') {
        const distance = num('f-distance');
        const duration = num('f-duration');
        if (!distance && !duration) { invalid('f-distance'); return null; }
        return { distance: distance || undefined, duration: duration || undefined };
    }

    const reps = num('f-reps');
    if (reps === null || reps < 0) { invalid('f-reps'); return null; }

    return { reps, weight: num('f-weight') || undefined };
}

actions.on('sess-done', async () => {
    if (!view || !currentId) return;

    const exercise = view.exercises[currentId] || {};
    const kind = exercise.kind || 'weight';

    const values = readFields(kind, exercise);
    if (!values) return;

    if (!await числоПравдоподобно(values)) return;

    // Запас едет с подходом, если он отмечен (§59). Не отмечен — подход
    // пишется без него, и правило подождёт следующего раза
    if (reserve.valid(запас)) values.rir = запас;

    await записатьПодход(values);
});

/**
 * Записать подход и увести взгляд дальше (§11, §12.1).
 *
 * Вынесено из обработчика кнопки, потому что путей записи стало два: руками
 * по «Выполнено» и сам собой по концу отсчёта (§57). Оставь это в
 * обработчике — и подход из отсчёта не запускал бы отдых, не закрывал бы
 * упражнение и не задавал бы вопроса о судьбе плана.
 */
async function записатьПодход(values) {
    /*
     * Засов от второго нажатия (Р-112).
     *
     * Кнопка крупная и зелёная, палец мокрый, база на телефоне отвечает не
     * мгновенно. Номер подхода и его порядок берутся из снимка последней
     * отрисовки, и второе нажатие, пришедшее раньше, чем закончится запись,
     * читает тот же снимок — в тренировку ложатся два одинаковых подхода.
     *
     * Лишний подход завышает тоннаж, двигает план на шаг вперёд и может
     * подделать личный рекорд, а заметить его можно только пересчитав подходы
     * в итогах. Того же боялись при заведении обработчиков событий: «подход
     * записался бы дважды» — там защита есть, здесь не было.
     */
    if (пишем) return;
    пишем = true;

    let спросить = null;

    try {
        спросить = await записатьПодходНабело(values);
    } finally {
        пишем = false;
    }

    /*
     * Вопрос после закрытия плана задаётся уже без засова.
     *
     * Он ждёт ответа человека сколько угодно долго, а засов на это время
     * запирал бы кнопку — и «Продолжить» в окне оборачивалось бы мёртвой
     * кнопкой под ним. Засов стережёт запись, а не разговор.
     */
    if (спросить) await askAfterPlan(спросить.ask, спросить.workout);
}

async function записатьПодходНабело(values) {
    const { workout, sets } = view;

    // Запас относится к подходу, а не к упражнению: следующий начинается с
    // чистого ряда, иначе один ответ молча повторялся бы весь вечер
    запас = null;

    const note = document.getElementById('f-note')?.value.trim();

    await dbService.addSet({
        workoutId: workout.id,
        exerciseId: currentId,
        order: engine.nextOrder(sets),
        setNumber: engine.nextSetNumber(sets, currentId),
        note: note || undefined,
        ...values
    });

    // Подход записан — короткий отклик под палец (§28.1)
    haptics.tap();

    await запомнитьДовес(values.weight);

    // Отдых запускается от нажатия, а не от отрисовки: пользователь уже
    // взаимодействовал со страницей, и браузер разрешит звук в конце.
    //
    // Длительность одна на всё приложение (§16): поменянная посреди
    // тренировки, она действует и на следующие упражнения
    restTimer.start(restOf(currentId), currentId);

    /*
     * Что изменилось этим подходом. Записанное в базу читать заново незачем:
     * достаточно приписать его к тому, что уже на экране.
     */
    const after = [...sets, { exerciseId: currentId, order: 0 }];

    const stateOf = (list) => engine.progress(workout.plan, list)
        .find((r) => r.exerciseId === currentId)?.state;

    const justClosed = stateOf(sets) !== STATE.DONE && stateOf(after) === STATE.DONE;
    const allDone = engine.isComplete(workout.plan, after);

    // Разговор о судьбе тренировки — только там, где это правда развилка
    // (§12.1). В круговом приложение и так ведёт дальше, и спрашивать после
    // каждого закрытого упражнения значит прерывать ровно тот поток, ради
    // которого круговой и нужен
    const ask = allDone ? 'workout'
        : (mode === 'linear' && justClosed && workout.plan.length > 1) ? 'exercise'
        : null;

    /*
     * Перевод взгляда (§11). В круговом уходим с упражнения, даже если его
     * план не закрыт; по одному — остаёмся, пока не закрыт; в свободном не
     * трогаем вовсе.
     *
     * Кроме случая, когда сейчас спросим: увести и тут же предложить
     * «перейти к следующему» — значит спросить о том, что уже сделано.
     */
    if (mode !== 'free' && ask !== 'exercise') {
        const next = mode === 'circuit'
            ? engine.nextCircuit(workout.plan, after, currentId)
            : engine.nextStep(workout.plan, after);

        if (next) currentId = next.exerciseId;
    }

    await app.render();

    // Сам вопрос задаёт вызывающий — уже сняв засов записи
    return ask ? { ask, workout } : null;
}

/**
 * Выбор запаса (§59).
 *
 * Повторное нажатие снимает выбор: ответить и передумать — обычное дело, а
 * снимать ответ было бы нечем, кроме перезагрузки.
 *
 * Перерисовка на месте, а не всего экрана: нажатие на чип не должно ни
 * выдирать фокус из поля повторений, ни гасить полосу отдыха.
 */
actions.on('sess-reserve', (el) => {
    const value = Number(el.dataset.value);
    запас = запас === value ? null : value;

    for (const чип of document.querySelectorAll('[data-action="sess-reserve"]')) {
        чип.classList.toggle('is-active', Number(чип.dataset.value) === запас);
    }
});

// ================== ОТСЧЁТ ПОДХОДА НА ВРЕМЯ (§57) ==================

/**
 * Выложить сигналы отсчёта.
 *
 * Ключ меняется каждый раз намеренно: beeper пропускает повторную выкладку
 * с тем же ключом, чтобы не обрывать звучащий сигнал, а здесь перевыкладка
 * бывает только по делу — при пуске и при возвращении из фона, где очередь
 * как раз и надо переложить по настоящим часам.
 */
function выложитьСигналы(elapsed = 0) {
    выкладка += 1;
    beeper.schedule(hold.cues(отсчёт.target), elapsed, { key: `hold-${отсчёт.startedAt}-${выкладка}` });
}

/** Снять отсчёт: и состояние, и всё, что он выложил в звук. */
function снятьОтсчёт() {
    отсчёт = null;
    beeper.stop();
}

/**
 * Пуск отсчёта (§57).
 *
 * Цель берётся из поля, а не из плана: перед подходом её могли поправить, и
 * отсчитывать плановые сорок пять там, где человек только что вписал
 * шестьдесят, значило бы спорить с ним молча. Пустое поле — секундомер.
 */
actions.on('sess-hold-start', () => {
    if (!view || !currentId) return;

    // Поле может считать в минутах (Р-87), а отсчёт идёт секундами
    const вписано = Number(document.getElementById('f-duration')?.value) || 0;
    const target = hold.clamp(вписано * шагВремени(знакомые[currentId]));

    отсчёт = { exerciseId: currentId, target, startedAt: Date.now() };

    // Выкладывается из обработчика нажатия: без нажатия браузер звук не
    // разрешит, и вся очередь окажется беззвучной (§50.1)
    выложитьСигналы(0);

    app.render();
});

/**
 * Остановка (§57).
 *
 * В подготовке это отмена: работа ещё не началась, и записывать нечего.
 * Дальше — запись того, что правда прошло.
 */
actions.on('sess-hold-stop', async () => {
    if (!отсчёт) return;

    const состояние = hold.at(отсчёт.target, (Date.now() - отсчёт.startedAt) / 1000);

    снятьОтсчёт();

    if (состояние.phase === 'lead' || состояние.worked < 1) return app.render();

    await записатьПодход({ duration: состояние.worked });
});

/**
 * Тик отсчёта: обновляет число на месте и сам записывает подход в конце.
 *
 * На месте, а не перерисовкой экрана: перерисовка раз в секунду выдирала бы
 * фокус и мигала бы всей карточкой. Перерисовка нужна ровно дважды — когда
 * подготовка сменяется работой и когда отсчёт кончился.
 */
async function тикОтсчёта() {
    if (!отсчёт) return;

    const состояние = hold.at(отсчёт.target, (Date.now() - отсчёт.startedAt) / 1000);

    if (состояние.phase === 'done') {
        снятьОтсчёт();
        await записатьПодход({ duration: состояние.worked });
        return;
    }

    const число = document.getElementById('hold-number');
    if (!число) return;

    const было = число.textContent.trim();
    const стало = String(состояние.phase === 'lead' ? состояние.left
        : отсчёт.target ? состояние.left
        : состояние.worked);

    if (было !== стало) число.textContent = стало;

    // Смена подготовки на работу меняет и подпись, и кнопку — это уже состав
    // экрана, а не одно число
    if (состояние.phase === 'work' && число.parentElement?.classList.contains('is-lead')) {
        await app.render();
    }
}

/** Завершение с переходом к итогам — общее для кнопки и разговора о плане. */
async function finishWorkout(workout) {
    await dbService.finishWorkout(workout.id);

    // Тренировка закрыта — это последнее закреплённое действие в ней (§28.1)
    haptics.tap();

    restTimer.stop();
    currentId = null;
    mode = null;

    app.go('summary', workout.id, 'done');
}

/**
 * Что делать после закрытого плана (§12.1).
 *
 * Без этого разговора закрытый план не отличался от любого другого подхода:
 * приложение молча уводило дальше, а человек узнавал о конце тренировки
 * только заглянув в список упражнений.
 *
 * «Продолжить» ничего не делает намеренно: лишние подходы уже считаются как
 * «вне плана» и знаменатель прогресса не ломают.
 */
async function askAfterPlan(what, workout) {
    if (what === 'workout') {
        const choice = await dialog.choose({
            title: t('План тренировки выполнен'),
            text: t('Можно завершать, а можно добавить ещё — записанное не пропадёт.'),
            options: [
                { value: 'continue', label: t('Продолжить'), hint: t('Подходы сверх плана') },
                { value: 'finish', label: t('Завершить тренировку'), hint: t('Перейти к итогам') }
            ]
        });

        if (choice === 'finish') await finishWorkout(workout);
        return;
    }

    const choice = await dialog.choose({
        title: t('План по упражнению закрыт'),
        options: [
            { value: 'continue', label: t('Продолжить'), hint: t('Ещё подход этого же упражнения') },
            { value: 'next', label: t('Следующее упражнение'), hint: t('Дальше по плану') },
            { value: 'finish', label: t('Завершить тренировку'), hint: t('Остальное останется невыполненным') }
        ]
    });

    if (choice === 'next') {
        const sets = await dbService.listSets(workout.id);
        const next = engine.nextStep(workout.plan, sets);

        if (next) currentId = next.exerciseId;
        app.render();
        return;
    }

    if (choice === 'finish') await finishWorkout(workout);
}

// ================== ОТДЫХ ==================

actions.on('rest-skip', () => {
    restTimer.stop();
    app.render();
});

/**
 * Кнопки отдыха двигают и текущий отсчёт, и то, с чем упражнение придёт
 * в следующий раз.
 *
 * Правка «на один раз» здесь бесполезна: если минуты мало сейчас, её мало и
 * между следующими подходами. Раньше сдвиг жил ровно до конца этого отдыха,
 * и на каждой паузе приходилось нажимать заново.
 *
 * Запоминается за упражнением, а не в общей настройке (Р-46). После
 * тяжёлого приседа нужно три минуты, после планки тридцать секунд, и одна
 * величина на всё заставляла править её каждый раз заново.
 *
 * Сразу, а не по завершении тренировки: брошенная на середине потеряла бы
 * правку, а человек был бы уверен, что сказал приложению своё слово.
 */
async function shiftRest(step) {
    const было = restOf(currentId);

    // Ниже нуля шаг уводит легко, и clamp() посчитал бы это за «не задано»,
    // то есть молча ничего не сделал бы. Здесь ноль означает не «убрать
    // отдых», а «короче некуда»
    const стало = restTimer.clamp(Math.max(restTimer.SHORTEST, было + step));

    if (стало !== null && стало !== было) запомнитьПаузу(currentId, стало);

    // В справочник — только когда паузу диктует само упражнение, а не
    // сегодняшний день (Р-101)
    if (стало !== null && стало !== было && currentId && !паузаОтДня(currentId)) {
        // Свой снимок правится сразу: подпись и меню читают его, а ждать
        // ответа базы нечего — на экране число должно измениться от нажатия
        знакомые[currentId] = { ...знакомые[currentId], restSeconds: стало };
        await dbService.updateExercise(currentId, { restSeconds: стало });
    }

    restTimer.extend(step);
    refreshRest();
}

/*
 * Полоса и меню правятся на месте, без перерисовки экрана (§16).
 *
 * При удержании кнопка повторяется до восьми раз в секунду, и полная
 * перерисовка на каждый шаг заставляла экран мигать. Само число отдыха
 * обновляется подпиской на тик, а меняться при сдвиге могут ещё две вещи:
 * подпись — когда у упражнения впервые появилась своя величина, — и строка
 * «Отдых: …» в меню «Ещё…».
 */
// Пишем, только если текст правда изменился: лишняя запись — это мутация
// узла, а их при удержании набирается восемь в секунду
const setText = (el, text) => {
    if (el && el.textContent !== text) el.textContent = text;
};

function refreshRest() {
    const своё = знакомые[restTimer.exerciseId]?.restSeconds;

    setText(document.querySelector('.rest-label'),
        своё ? t('Отдых для этого упражнения') : t('Отдых'));

    setText(document.querySelector('[data-action="sess-rest"]'),
        t('Отдых: {время}', { время: format.seconds(restOf(currentId)) }));
}

actions.on('rest-extend', () => shiftRest(REST_STEP));
actions.on('rest-shorten', () => shiftRest(-REST_STEP));

// ================== ЗАМЕТКИ (§20) ==================

actions.on('sess-more', (el) => {
    const tools = document.querySelector('.sess-tools');
    if (!tools) return;

    // Без перерисовки: она сбросила бы уже введённые в поля значения
    tools.hidden = !tools.hidden;

    /*
     * Подпись через перевод (§53, Р-125).
     *
     * Подставлялись голые строки, хотя переводы обеих лежат в словарях: на
     * английском экране «More…» после первого же нажатия становилось
     * «Свернуть» и обратно английским не делалось до перерисовки. Правка в
     * одну строку, а выглядит как поломка приложения.
     *
     * Соседний переключатель заметки эту же ошибку уже пережил — там в
     * комментарии записано то же самое.
     */
    el.textContent = tools.hidden ? t('Ещё…') : t('Свернуть');
});

actions.on('sess-weight-toggle', (el) => {
    const row = document.getElementById('f-weight-row');
    const input = document.getElementById('f-weight');
    if (!row) return;

    // Без перерисовки, как и заметка: введённые повторения должны уцелеть
    row.hidden = !row.hidden;
    el.textContent = row.hidden ? t('＋ дополнительный вес') : t('− дополнительный вес');

    /*
     * Свернули — значит довеса нет, и поле очищается (Р-53).
     *
     * Спрятанное, но заполненное записалось бы молча: человек убрал строку
     * с глаз, а килограммы уехали бы в подход. Такое невидимое, но
     * действующее число мы уже вычищали из планов (Р-49).
     */
    if (row.hidden) {
        if (input) input.value = '';
    } else {
        input?.focus();
    }

    refreshExtraLine();
});

actions.on('sess-note-toggle', (el) => {
    const input = document.getElementById('f-note');
    if (!input) return;

    // Без перерисовки: поле открывается рядом с уже введёнными значениями,
    // и терять их ради показа одной строки незачем
    input.hidden = !input.hidden;

    // Через t(): подпись переключалась голой русской строкой, и на английском
    // экране заметка после первого же нажатия становилась русской
    el.textContent = input.hidden ? t('＋ заметка к подходу') : t('− заметка к подходу');

    if (!input.hidden) input.focus();
});

/**
 * Длительность отдыха правится прямо с выполнения (§16).
 *
 * Правится величина этого упражнения — та же, что двигают кнопки «±5 с», —
 * а не общая настройка из профиля. Общая остаётся началом отсчёта для
 * незнакомых упражнений (Р-46).
 */
/**
 * Переключить единицу упражнения на время (Р-87).
 *
 * Помнится за упражнением: планку всегда считают секундами, баскетбол всегда
 * минутами, и спрашивать об этом каждый раз незачем. Записанное в истории не
 * трогается — оно в секундах и там и остаётся.
 */
actions.on('sess-time-unit', async () => {
    if (!currentId) return;

    const было = знакомые[currentId] || {};
    const timeUnit = вМинутах(было) ? 'sec' : 'min';

    знакомые[currentId] = { ...было, timeUnit };
    await dbService.updateExercise(currentId, { timeUnit });

    haptics.tap();
    await app.render();
});

actions.on('sess-rest', async () => {
    const идёт = restTimer.running && restTimer.exerciseId === currentId;

    const values = await dialog.form({
        title: t('Длительность отдыха'),
        text: идёт
            ? t('Отсчёт уже идёт: введённое считается всей длительностью паузы, от последнего подхода. Прошедшее вычтется само.')
            : t('От {мин} до {макс} секунд.', { мин: restTimer.SHORTEST, макс: restTimer.LONGEST }),
        fields: [{
            name: 'rest',
            label: t('Секунд'),
            type: 'number',
            value: restOf(currentId)
        }]
    });

    if (!values) return;

    const seconds = restTimer.clamp(values.rest);
    if (seconds === null) return;

    /*
     * Правка действует сразу и на идущий отсчёт (Р-81).
     *
     * Раньше она ложилась только в справочник и дожидалась следующего
     * подхода — а человек, поправивший паузу во время неё, видел прежние
     * цифры на полосе и считал, что ввод не сработал.
     */
    запомнитьПаузу(currentId, seconds);

    // В справочник — только когда паузу диктует упражнение, а не день (Р-101):
    // поправка на плановом дне про сегодня, и в зарядку ей ехать незачем
    if (currentId && !паузаОтДня(currentId)) {
        знакомые[currentId] = { ...знакомые[currentId], restSeconds: seconds };
        await dbService.updateExercise(currentId, { restSeconds: seconds });
    }

    if (идёт) restTimer.retotal(seconds);

    app.render();
});

actions.on('sess-note-exercise', async () => {
    if (!view || !currentId) return;

    const item = view.workout.plan.find((p) => p.exerciseId === currentId);

    const values = await dialog.form({
        title: t('Заметка: {название}', { название: view.exercises[currentId]?.name || t('упражнение') }),
        text: t('Относится к этому упражнению в текущей тренировке.'),
        fields: [{ name: 'note', label: t('Заметка'), type: 'textarea', value: item?.note || '' }]
    });

    if (!values) return;

    // Заметки нет — нет и поля: undefined внутри строки плана роняет обмен
    // целиком (Р-97), а очистка по верхнему слою его не замечает
    const plan = view.workout.plan.map((p) => {
        if (p.exerciseId !== currentId) return p;

        const { note: _было, ...остальное } = p;
        return values.note ? { ...остальное, note: values.note } : остальное;
    });

    await dbService.updateWorkout(view.workout.id, { plan });
    app.render();
});

actions.on('sess-note-workout', async () => {
    if (!view) return;

    const values = await dialog.form({
        title: t('Заметка к тренировке'),
        text: t('Самочувствие, общие впечатления, что учесть в следующий раз.'),
        fields: [{ name: 'note', label: t('Заметка'), type: 'textarea', value: view.workout.note || '' }]
    });

    if (!values) return;

    await dbService.updateWorkout(view.workout.id, { note: values.note });
    app.render();
});

/**
 * Последний записанный подход тренировки — любого упражнения (Р-113).
 *
 * Раньше отменялся последний подход текущего упражнения, и кнопки не было,
 * когда своих подходов нет. Но в режимах «по кругу» и «по одному» приложение
 * сразу после записи уводит на следующее упражнение — и отменять становилось
 * нечего ровно в ту секунду, когда ошибку и замечают. Чтобы стереть только что
 * записанное, надо было найти прежнее упражнение в списке (а это молча
 * переводит тренировку в свободный режим), раскрыть «Ещё…», нажать отмену и
 * подтвердить — четыре нажатия по горячим следам.
 */
function последнийПодход() {
    const все = view?.sets || [];
    if (!все.length) return null;

    return все.reduce((лучший, s) => ((s.order ?? 0) > (лучший.order ?? 0) ? s : лучший), все[0]);
}

actions.on('sess-undo', async () => {
    const last = последнийПодход();
    if (!last) return;

    const exercise = view.exercises[last.exerciseId] || {};

    const ok = await dialog.confirm({
        title: t('Отменить подход?'),

        // Называем, что именно уйдёт: подход мог быть записан в другом
        // упражнении, и «последний подход» без имени звучит как этот
        text: t('Уйдёт из журнала: {что}.', {
            что: `${exercise.name || t('упражнение')} — ${records.describe(last, exercise.kind)}`
        }),
        confirmText: t('Отменить подход'),
        danger: true
    });

    if (!ok) return;

    await dbService.deleteSet(last.id);
    app.render();
});

// ================== НАВИГАЦИЯ ПО УПРАЖНЕНИЯМ ==================

actions.on('sess-select', (el) => {
    currentId = el.dataset.id;

    // Ручной выбор — это и есть свободный режим: иначе следующий же подход
    // отбросил бы пользователя обратно к плану
    mode = 'free';
    app.render();
});

/**
 * Смена режима (§11) не двигает текущее упражнение (Р-51).
 *
 * Двигала: при переключении на ведомый режим приложение сразу показывало,
 * «куда оно ведёт», — то есть подставляло следующее по кругу. На экране это
 * выглядело так, будто переключатель листает список упражнений: стоишь на
 * втором, меняешь способ — оказываешься на третьем.
 *
 * Режим говорит, куда идти **после** подхода, а не вместо него. Выбор
 * упражнения — отдельное действие, и переключатель не вправе его отменять:
 * человек уже стоит у снаряда, о котором приложение ничего не знает.
 *
 * Показывать, куда ведёт режим, всё равно есть чем: после «Выполнено»
 * следующее упражнение подставляется по нему же.
 */
actions.on('sess-mode', (el) => {
    mode = el.dataset.mode;
    app.render();
});

actions.on('sess-skip', async () => {
    if (!view || !currentId) return;

    const plan = view.workout.plan.map((item) =>
        item.exerciseId === currentId ? { ...item, skipped: true } : item);

    await dbService.updateWorkout(view.workout.id, { plan });

    currentId = null;   // load() подберёт следующее по подсказке движка
    app.render();
});

/**
 * Вернуть пропущенное в план (§14, Р-114).
 *
 * Пропуск — не приговор: скамью заняли, через десять минут она свободна.
 * Обратного пути не было вовсе — `skipped` обратно в `false` не ставил ни один
 * обработчик во всём приложении.
 */
actions.on('sess-unskip', async () => {
    if (!view || !currentId) return;

    const plan = view.workout.plan.map((item) =>
        item.exerciseId === currentId ? { ...item, skipped: false } : item);

    await dbService.updateWorkout(view.workout.id, { plan });
    app.render();
});

actions.on('sess-add', async () => {
    const all = await dbService.listExercises();
    const inPlan = new Set(view.workout.plan.map((p) => p.exerciseId));

    const chosen = await dialog.pick({
        title: t('Добавить упражнение'),
        text: t('Оно встанет в план текущей тренировки.'),
        items: all.filter((e) => !inPlan.has(e.id))
            .map((e) => ({ value: e.id, label: e.name, group: e.group, hint: e.group })),
        groups: [...new Set(all.map((e) => e.group).filter(Boolean))].sort(),
        createLabel: t('Создать')
    });

    if (!chosen) return;

    const exercise = chosen.create
        ? await dbService.ensureExercise({ name: chosen.create })
        : all.find((e) => e.id === chosen);

    if (!exercise) return;

    const plan = [...view.workout.plan, {
        exerciseId: exercise.id,
        plannedSets: 3,
        targetReps: null,
        weight: 0,
        skipped: false
    }];

    await dbService.updateWorkout(view.workout.id, { plan });

    currentId = exercise.id;
    mode = 'free';
    app.render();
});

// ================== ЗАВЕРШЕНИЕ ==================

actions.on('sess-finish', async () => {
    if (!view) return;

    const { workout, sets } = view;

    if (sets.length === 0) {
        const choice = await dialog.choose({
            title: t('Ни одного подхода не записано'),
            text: t('Завершать нечего.'),
            options: [
                { value: 'delete', label: t('Удалить тренировку'), danger: true },
                { value: 'stay', label: t('Вернуться к тренировке') }
            ]
        });

        if (choice !== 'delete') return;

        await dbService.deleteWorkout(workout.id);
        return app.go('home');
    }

    const ok = await dialog.confirm({
        title: t('Завершить тренировку?'),
        text: t('Записано {подходы}.', { подходы: format.count(sets.length, format.WORDS.set) }),
        confirmText: t('Завершить')
    });

    if (!ok) return;

    await finishWorkout(workout);
});
