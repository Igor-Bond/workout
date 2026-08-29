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
 * Сигнал окончания.
 *
 * Звук синтезируется, а не берётся файлом: один короткий тон не стоит
 * лишнего запроса и места в кэше. AudioContext создаётся в момент сигнала —
 * к этому времени пользователь уже нажимал кнопку, и браузер не считает
 * звук самовольным.
 */
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

function signal() {
    if (config.get('restVibration') && navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 400]);
    }

    if (!config.get('restSound')) return;

    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;

        const ctx = new Ctx();
        const start = ctx.currentTime;

        TONES.forEach((frequency, i) => {
            const at = start + i * (TONE_LENGTH + TONE_GAP);

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.value = frequency;

            // Плавное нарастание и затухание: резко оборванный тон щёлкает
            gain.gain.setValueAtTime(0.0001, at);
            gain.gain.exponentialRampToValueAtTime(0.3, at + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, at + TONE_LENGTH);

            osc.connect(gain).connect(ctx.destination);
            osc.start(at);
            osc.stop(at + TONE_LENGTH + 0.02);

            // Контекст закрывается один раз — после последнего тона
            if (i === TONES.length - 1) osc.onended = () => ctx.close();
        });
    } catch (e) {
        console.warn('[Отдых] Звук недоступен:', e);
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

        handle = setInterval(() => {
            if (restTimer.running) return emit('tick');

            stopInterval();
            endsAt = 0;
            signal();
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

        emit('tick');
    },

    /** Меньше этого отдых не укорачивается — дальше только «Пропустить». */
    SHORTEST: 5,

    /** Пропустить: сигнала не будет, отдых просто закончен. */
    stop() {
        stopInterval();
        endsAt = 0;
        exerciseId = null;
        emit('tick');
    },

    /** Подписка. Возвращает функцию отписки. */
    on(event, callback) {
        listeners[event].add(callback);
        return () => listeners[event].delete(callback);
    }
};
