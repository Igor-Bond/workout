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

    /*
     * Пульс во время работы: «да, всё ещё работаешь».
     *
     * Втрое тише отсчёта и заметно ниже — чтобы отвечать на вопрос, а не
     * отвлекать от подхода. Спутать его с отсчётом нельзя ни по громкости,
     * ни по высоте.
     */
    pulse: [{ freq: 392, length: 0.05, gain: 0.15 }],

    /*
     * Начало работы — сплошной взлёт тона, а не две ноты.
     *
     * Раньше и старт, и конец программы были восходящими наборами нот и
     * потому путались между собой. Различать их высотой мало — различаться
     * должно само устройство сигнала: здесь непрерывный подъём, там
     * отдельные ноты.
     */
    go: [{ freq: 660, to: 1600, length: 0.42, gain: 0.9 }],

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

    /*
     * Конец программы — четыре отдельные ноты с долгой последней.
     *
     * Он один длится больше секунды: длительность сама по себе говорит, что
     * кончилось всё, а не очередной отрезок. Спутать с взлётом на старте
     * нельзя — там сплошная линия, здесь отчётливые ступени.
     */
    done: [
        { freq: 523,  length: 0.16, gain: 0.85 },
        { freq: 659,  length: 0.16, gain: 0.85, after: 0.18 },
        { freq: 784,  length: 0.16, gain: 0.85, after: 0.36 },
        { freq: 1047, length: 0.7,  gain: 0.9,  after: 0.54 }
    ]
};

let ctx = null;
let master = null;
let planned = [];
let key = null;

/**
 * Общий выход со сжатием.
 *
 * Сжатие поднимает то, что тише порога, и придерживает пики — на слух это
 * заметно громче при той же амплитуде. Без него сигнал упирается в потолок
 * дорожки и дальше растёт только хрипом.
 */
function context() {
    if (ctx && ctx.state !== 'closed') return ctx;

    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;

    ctx = new Ctx();

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -24;
    comp.knee.value = 8;
    comp.ratio.value = 12;
    comp.attack.value = 0.002;
    comp.release.value = 0.12;

    master = ctx.createGain();
    master.gain.value = 1;

    master.connect(comp).connect(ctx.destination);
    return ctx;
}

/**
 * Один тон в заданный момент звукового движка.
 *
 * Тон двойной: к основной частоте подмешивается октава выше вполовину тише.
 * Один голос на телефоне звучит плоско и теряется в шуме зала, а пара даёт
 * тембр, который слышно, не поднимая амплитуду.
 */
function tone(at, { freq, to = null, length, gain: peak }) {
    for (const [multiple, share] of [[1, 1], [2, 0.5]]) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = WAVE;
        osc.frequency.setValueAtTime(freq * multiple, at);

        // Сплошной подъём тона, если задан конец: сигнал старта отличается
        // от прочих не нотой, а самим движением
        if (to) osc.frequency.exponentialRampToValueAtTime(to * multiple, at + length * 0.75);

        const level = peak * share;

        /*
         * Нарастание и затухание: резко оборванный тон щёлкает.
         *
         * Громкость держится на полке до последней трети: тон, затухающий с
         * первой миллисекунды, на слух вдвое тише собственного пика.
         */
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(level, at + 0.012);
        gain.gain.setValueAtTime(level, at + length * 0.7);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + length);

        osc.connect(gain).connect(master);
        osc.start(at);
        osc.stop(at + length + 0.02);

        planned.push(osc);
    }
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
    schedule(cues = [], offset = 0, { key: token = null } = {}) {
        // Та же очередь уже выложена: снимать и класть заново значило бы
        // оборвать сигнал, который звучит прямо сейчас
        if (token && token === key) return 0;

        beeper.stop();
        key = token;

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
        key = null;
    },

    /**
     * Проиграть один сигнал прямо сейчас — для прослушивания в профиле.
     *
     * Сигналы интервальной программы слышны только во время программы, а
     * узнать, что означает каждый, хочется заранее: посреди бёрпи разбираться
     * поздно.
     */
    play(type) {
        if (!VOICES[type]) return false;

        const audio = context();
        if (!audio) return false;

        if (audio.state === 'suspended') audio.resume().catch(() => {});

        const at = audio.currentTime + 0.03;
        for (const part of VOICES[type]) tone(at + (part.after || 0), part);

        return true;
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
