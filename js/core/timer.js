/**
 * Таймер отдыха (§16 ТЗ).
 *
 * Отсчёт ведётся от момента окончания, а не счётчиком тиков: интервалы в
 * свёрнутой вкладке браузер придерживает, и досчитывать надо по часам.
 * Поэтому таймер переживает и сворачивание приложения, и перерисовку экрана.
 *
 * Он никогда не блокирует ввод: пользователь может записать следующий подход
 * не дожидаясь конца отдыха.
 */

import { config } from '../config.js';

let endsAt = 0;
let handle = 0;
let exerciseId = null;

const listeners = { tick: new Set(), finish: new Set() };

function emit(event) {
    listeners[event].forEach((cb) => {
        try { cb(); } catch (e) { console.error('[Отдых] Ошибка слушателя:', e); }
    });
}

/**
 * Три восходящих тона, около секунды.
 *
 * Один короткий сигнал в зале терялся: полсекунды на фоне музыки и лязга —
 * это ничто. Три тона подряд и с растущей высотой слышны как «сигнал», а не
 * как случайный звук, и не похожи на уведомление мессенджера.
 */
const TONES = [880, 1100, 1320];
const TONE_LENGTH = 0.28;
const TONE_GAP = 0.14;

/**
 * Громкость тона (§16).
 *
 * Было 0,3 — и это оказалось втрое тише сигналов интервальной программы.
 * Замер: у конца отдыха средний уровень 0,028, у «начали» 0,088, у конца
 * программы 0,127. Ухо слышит средний уровень, а не пик, так что разница
 * слышна именно такой — сигнал отдыха звучал вполголоса рядом с табатой,
 * хотя нужен в тех же условиях и для того же.
 *
 * Сжатие с подъёмом, как у интервальных сигналов, здесь не нужно: там оно
 * лечило форму удара — короткий всплеск при низком среднем. Синус с плавной
 * огибающей и так плотный, ему достаточно усиления.
 *
 * Выше 0,9 не поднимается: три тона идут по очереди и не накладываются, но
 * запас до потолка дорожки нужен — на нём начинается хрип.
 */
const TONE_GAIN = 0.85;

/*
 * Звук выкладывается заранее, а не играется в момент срабатывания (§16).
 *
 * Так пришлось из-за двух бед сразу, и обе прятались за одной строкой
 * `new AudioContext()` в конце отсчёта.
 *
 * На iPhone контекст, созданный не в ответ на нажатие, стартует спящим —
 * и сигнал не звучит вовсе. Тестировщик так и написал: «добавить звуковое
 * сопровождение в обычный режим», хотя оно было и было включено. Здесь
 * контекст создаётся при запуске отдыха, то есть сразу после нажатия
 * «Выполнено», и права на звук у него уже есть.
 *
 * Вторая беда общая для всех телефонов: сигнал висел на том же интервале,
 * что и цифры на экране, а свёрнутому приложению браузер придерживает
 * интервалы до одного срабатывания в минуту. Звуковой поток идёт своим
 * чередом и отыгрывает выложенное вовремя.
 *
 * Чего это не чинит: на iPhone с погашенным экраном засыпает и сам
 * контекст. Телефон рядом — звучит, в кармане — нет, и обещать обратное
 * нельзя (§28).
 */
let ctx = null;
let planned = [];

function audio() {
    if (ctx && ctx.state !== 'closed') return ctx;

    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;

    ctx = new Ctx();
    return ctx;
}

/** Снять выложенное: отдых продлили, укоротили или прервали. */
function cancelSignal() {
    for (const node of planned) {
        try { node.stop(); } catch (e) { /* уже отыграл */ }
    }

    planned = [];
}

/**
 * Выложить сигнал на момент окончания.
 *
 * Считается от разницы с часами, а не от прошлого расчёта: между вызовами
 * отдых могли продлить, а контекст — усыпить вместе с приложением, и его
 * собственное время отстанет от настоящего.
 */
function scheduleSignal() {
    cancelSignal();

    if (!config.get('restSound') || !endsAt) return;

    const seconds = (endsAt - Date.now()) / 1000;
    if (seconds <= 0) return;

    try {
        const a = audio();
        if (!a) return;

        // Контекст мог уснуть, пока приложение было свёрнуто
        if (a.state === 'suspended') a.resume().catch(() => {});

        const start = a.currentTime + seconds;

        TONES.forEach((frequency, i) => {
            const at = start + i * (TONE_LENGTH + TONE_GAP);

            const osc = a.createOscillator();
            const gain = a.createGain();

            osc.type = 'sine';
            osc.frequency.value = frequency;

            // Плавное нарастание и затухание: резко оборванный тон щёлкает
            gain.gain.setValueAtTime(0.0001, at);
            gain.gain.exponentialRampToValueAtTime(TONE_GAIN, at + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, at + TONE_LENGTH);

            osc.connect(gain).connect(a.destination);
            osc.start(at);
            osc.stop(at + TONE_LENGTH + 0.02);

            planned.push(osc);
        });
    } catch (e) {
        console.warn('[Отдых] Звук недоступен:', e);
    }
}

/*
 * Вибрация остаётся на месте срабатывания: выложить её заранее нельзя, а
 * в свёрнутом приложении она всё равно не сработает — как и на iPhone, где
 * navigator.vibrate не поддерживается вовсе.
 */
function buzz() {
    if (config.get('restVibration') && navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 400]);
    }
}

function stopInterval() {
    clearInterval(handle);
    handle = 0;
}

export const restTimer = {

    /** Идёт ли отсчёт прямо сейчас. */
    get running() {
        return endsAt > Date.now();
    },

    /** Сколько секунд осталось. */
    get remaining() {
        return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
    },

    /** Для какого упражнения запущен отдых — чтобы не путать полосу на экране. */
    get exerciseId() {
        return exerciseId;
    },

    /** Запуск. Ничего не делает, если таймер выключен в настройках. */
    start(seconds = config.get('restSeconds'), forExerciseId = null) {
        if (!config.get('restEnabled') || !seconds) return false;

        endsAt = Date.now() + seconds * 1000;
        exerciseId = forExerciseId;

        stopInterval();

        scheduleSignal();

        handle = setInterval(() => {
            if (restTimer.running) return emit('tick');

            stopInterval();
            endsAt = 0;
            buzz();
            emit('finish');
        }, 250);

        emit('tick');
        return true;
    },

    /**
     * Сдвинуть отдых на шаг. Отрицательный шаг укорачивает.
     *
     * Ниже нуля не опускается: отдых, укороченный до конца, — это
     * «Пропустить», и делать его молча, отняв последние секунды, значит
     * оборвать отсчёт без сигнала там, где пользователь ждал кнопки.
     * Поэтому остаётся минимум SHORTEST, а закончить можно только явно.
     */
    extend(seconds = 30) {
        if (!restTimer.running) return;

        const floor = Date.now() + restTimer.SHORTEST * 1000;
        endsAt = Math.max(floor, endsAt + seconds * 1000);

        // Сигнал был выложен на прежний срок — переложить на новый
        scheduleSignal();

        emit('tick');
    },

    /** Меньше этого отдых не укорачивается — дальше только «Пропустить». */
    SHORTEST: 5,

    /**
     * Дольше этого отдых не задаётся.
     *
     * Граница не физическая, а смысловая: полчаса — это уже не отдых между
     * подходами, а перерыв, и его не отсчитывают таймером. Нужна она против
     * опечатки: в поле, где ждут «90», однажды окажется «900», и человек
     * будет полтора часа ждать сигнала, решив, что приложение зависло.
     */
    LONGEST: 1800,

    /**
     * Привести введённую длительность к допустимой.
     *
     * null означает «не задано»: пустое поле у упражнения — это «как у
     * всех», а не «ноль секунд», и подставлять вместо него ноль значило бы
     * молча выключить отдых там, где его просто не переопределили.
     */
    clamp(seconds) {
        const value = Math.round(Number(seconds));
        if (!Number.isFinite(value) || value <= 0) return null;

        return Math.min(restTimer.LONGEST, Math.max(restTimer.SHORTEST, value));
    },

    /** Пропустить: сигнала не будет, отдых просто закончен. */
    stop() {
        stopInterval();
        cancelSignal();
        endsAt = 0;
        exerciseId = null;
        emit('tick');
    },

    /**
     * Перевыложить сигнал — приложение вернулось из фона.
     *
     * Пока оно было свёрнуто, звуковой контекст мог уснуть вместе с ним, и
     * его собственные часы отстали от настоящих. Выложенное по старым часам
     * прозвучало бы позже срока, а то и вовсе после конца отдыха.
     */
    resync() {
        if (restTimer.running) scheduleSignal();
    },

    /** Подписка. Возвращает функцию отписки. */
    on(event, callback) {
        listeners[event].add(callback);
        return () => listeners[event].delete(callback);
    }
};
