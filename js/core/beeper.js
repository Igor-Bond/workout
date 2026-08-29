/**
 * Сигналы интервальной программы (§50 ТЗ).
 *
 * Главное отличие от сигнала отдыха (§16): звуки не проигрываются по тику, а
 * выкладываются в звуковой движок заранее, все сразу, с точным временем.
 *
 * Так надо потому, что таймеры браузер в свёрнутом приложении придерживает —
 * до одного срабатывания в минуту. Отсчёт на экране от этого лишь дёрнется и
 * восстановится по часам, а вот сигнал, привязанный к тику, опоздал бы на
 * полминуты или не прозвучал вовсе. Звуковой поток идёт своим чередом и
 * отыгрывает выложенное точно в срок.
 *
 * Чего это не чинит: на iPhone звуковой контекст засыпает вместе с
 * приложением. Пока телефон лежит рядом с включённым экраном (§28) — работает;
 * убранный в карман — нет, и обещать обратное нельзя.
 */

import { config } from '../config.js';

/**
 * Голоса сигналов: частота, длительность и громкость каждого.
 *
 * Правило, по которому их не надо запоминать: **вверх — начинай, вниз —
 * заканчивай**. Раньше начало работы и начало отдыха отличались только
 * высотой одного тона, и на слух это было одно и то же «пик»: понять по
 * звуку, кончилось упражнение или началось, не выходило.
 *
 * Волна треугольная, а не синус: при той же громкости она заметно резче и
 * пробивается сквозь музыку в зале, ради чего сигнал и нужен.
 */
const WAVE = 'triangle';

const VOICES = {
    // Щелчки отсчёта «три, два, один» перед каждой сменой
    count: [{ freq: 880, length: 0.09, gain: 0.45 }],

    // Начало работы — восходящая пара: «поехали»
    go: [
        { freq: 1047, length: 0.12, gain: 0.85 },
        { freq: 1568, length: 0.35, gain: 0.85, after: 0.13 }
    ],

    // Конец работы — нисходящая пара: «стоп». Зеркало предыдущего
    rest: [
        { freq: 784, length: 0.14, gain: 0.75 },
        { freq: 523, length: 0.32, gain: 0.75, after: 0.15 }
    ],

    // Конец круга — нисходящая тройка: пауза здесь длинная, и это слышно
    round: [
        { freq: 784, length: 0.16, gain: 0.75 },
        { freq: 659, length: 0.16, gain: 0.75, after: 0.2 },
        { freq: 523, length: 0.45, gain: 0.75, after: 0.4 }
    ],

    // Конец программы — восходящая тройка, самая громкая
    done: [
        { freq: 523,  length: 0.2,  gain: 0.9 },
        { freq: 784,  length: 0.2,  gain: 0.9, after: 0.24 },
        { freq: 1047, length: 0.5,  gain: 0.9, after: 0.48 }
    ]
};

let ctx = null;
let planned = [];

function context() {
    if (ctx && ctx.state !== 'closed') return ctx;

    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;

    ctx = new Ctx();
    return ctx;
}

/** Один тон в заданный момент звукового движка. */
function tone(at, { freq, length, gain: peak }) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = WAVE;
    osc.frequency.value = freq;

    /*
     * Нарастание и затухание: резко оборванный тон щёлкает.
     *
     * Держим громкость на полке почти до конца и роняем в последней трети:
     * прежний тон затухал с самого начала и на слух был вдвое тише
     * собственного пика.
     */
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + 0.012);
    gain.gain.setValueAtTime(peak, at + length * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);

    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + length + 0.02);

    planned.push(osc);
}

export const beeper = {

    VOICES,

    get available() {
        return !!(window.AudioContext || window.webkitAudioContext);
    },

    /**
     * Выложить сигналы программы. cues — из interval.cues(), время в
     * секундах от начала; offset — сколько секунд программы уже прошло.
     *
     * Вызывать только из обработчика действия: без нажатия браузер звук не
     * разрешит, и вся очередь окажется беззвучной.
     */
    schedule(cues = [], offset = 0) {
        beeper.stop();

        if (!config.get('restSound')) return 0;

        const audio = context();
        if (!audio) return 0;

        // Контекст мог уснуть, пока приложение было свёрнуто
        if (audio.state === 'suspended') audio.resume().catch(() => {});

        const zero = audio.currentTime - offset;
        let count = 0;

        for (const cue of cues) {
            const voice = VOICES[cue.type];
            if (!voice) continue;

            const at = zero + cue.at;

            // Прошедшее не выкладываем: звуковой движок молча съедает время
            // в прошлом, но проверка избавляет от сотни мёртвых узлов
            if (at <= audio.currentTime) continue;

            for (const part of voice) tone(at + (part.after || 0), part);
            count += 1;
        }

        return count;
    },

    /** Снять всё выложенное — при паузе, пропуске и уходе с экрана. */
    stop() {
        for (const osc of planned) {
            try { osc.stop(); } catch { /* уже отыграл */ }
        }

        planned = [];
    },

    /** Закрыть движок совсем: экран покинут, звук больше не нужен. */
    release() {
        beeper.stop();

        if (ctx && ctx.state !== 'closed') {
            ctx.close().catch(() => {});
        }

        ctx = null;
    }
};
