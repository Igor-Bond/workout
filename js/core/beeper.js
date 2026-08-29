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

/** Голоса сигналов: частота, длительность и громкость каждого. */
const VOICES = {
    // Щелчки отсчёта «три, два, один» — короткие и тихие
    count: [{ freq: 660,  length: 0.08, gain: 0.18 }],

    // Начало работы — длинный и высокий, его нельзя спутать с отсчётом
    go:    [{ freq: 1320, length: 0.45, gain: 0.35 }],

    // Начало отдыха — ниже и короче: расслабиться, а не рвануть
    rest:  [{ freq: 520,  length: 0.28, gain: 0.28 }],

    // Конец круга — два тона: пауза здесь длинная, и её начало важно не проспать
    round: [
        { freq: 520, length: 0.22, gain: 0.3 },
        { freq: 392, length: 0.4,  gain: 0.3, after: 0.3 }
    ],

    // Конец программы — восходящая тройка, как у отдыха между подходами
    done:  [
        { freq: 880,  length: 0.25, gain: 0.32 },
        { freq: 1100, length: 0.25, gain: 0.32, after: 0.38 },
        { freq: 1320, length: 0.4,  gain: 0.32, after: 0.76 }
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

    osc.type = 'sine';
    osc.frequency.value = freq;

    // Нарастание и затухание: резко оборванный тон щёлкает
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + 0.015);
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
