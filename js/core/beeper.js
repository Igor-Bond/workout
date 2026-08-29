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

/*
 * Почему здесь три способа получить звук, а не один осциллятор.
 *
 * Первая версия была набором чистых тонов с полкой громкости — то есть
 * буквально пищалкой из детской игрушки. Различить сигналы она позволяла,
 * но слушать её восемь кругов подряд неприятно: ухо считает такой звук
 * поломкой техники, а не командой.
 *
 * Разница между «пищит» и «звучит» держится на трёх вещах, и ни одна из них
 * не про громкость:
 *
 * 1. Спектр. У настоящего удара есть обертоны, и они гаснут быстрее основного
 *    тона — оттого звук «металлический», а не «электронный». Отсюда bell:
 *    несколько призвуков с разной скоростью затухания.
 *
 * 2. Огибающая. Живой звук начинается мгновенно и затухает с первой же
 *    миллисекунды. Полка громкости, которая держится, а потом обрывается, —
 *    и есть та самая примитивность.
 *
 * 3. Помещение. Сухой звук звучит так, будто его вырезали ножницами. Короткий
 *    хвост отражений не слышен сам по себе, но без него сигнал кажется
 *    дешёвым. Отсюда общая «комната» на свёртке.
 */

/** Короткий шумовой щелчок: отсчёт. Так звучит метроном, а не будильник. */
const TICK = 'tick';

/** Колокол с призвуками: смены. Так звучит гонг в зале. */
const BELL = 'bell';

/** Низкий толчок с падающим тоном: пульс. Его скорее чувствуешь, чем слышишь. */
const THUD = 'thud';

/**
 * Голоса сигналов.
 *
 * Правило, по которому их не надо запоминать, осталось прежним: **вверх —
 * начинай, вниз — заканчивай**. Изменился тембр, а не смысл, и выученное
 * за месяцы работы никуда не делось.
 */
const VOICES = {
    // Отсчёт «три, два, один» — сухой щелчок, ничего лишнего
    count: [{ kind: TICK, freq: 2400, length: 0.035, gain: 0.5, send: 0.04 }],

    /*
     * Пульс во время работы: «да, всё ещё работаешь».
     *
     * Низкий и очень короткий: он должен попадать в промежуток между
     * ударами сердца, а не спорить с музыкой в наушниках. Падающий тон
     * даёт ощущение толчка вместо писка.
     */
    pulse: [{ kind: THUD, freq: 170, to: 95, length: 0.11, gain: 0.5, send: 0 }],

    /*
     * Начало работы — один яркий колокол.
     *
     * Три щелчка отсчёта и удар — это стартовая команда, как на дорожке:
     * узнаётся без объяснений. Он единственный высокий и одиночный; всё
     * остальное либо ниже, либо идёт парами.
     *
     * Ля вместо до: до звенело резко и на телефонном динамике отдавало
     * писком. Ниже опускать некуда — под ним сразу первая нота конца
     * работы, и «начинай» с «заканчивай» начнут путаться.
     */
    go: [{ kind: BELL, freq: 880, length: 1.3, gain: 0.85, send: 0.4 }],

    // Конец работы — два удара вниз: «стоп». Зеркало предыдущего
    rest: [
        { kind: BELL, freq: 784, length: 0.5, gain: 0.7, send: 0.28 },
        { kind: BELL, freq: 523, length: 0.9, gain: 0.7, send: 0.32, after: 0.13 }
    ],

    /*
     * Конец круга — два удара в одну ноту, как гонг на ринге.
     *
     * Нисходящей тройкой он был раньше и оттого не запоминался: конец
     * работы — тоже нисходящая фигура, и два похожих жеста подряд ухо
     * сливает в один. Двойной удар в одну и ту же ноту ни на что в
     * программе не похож, а вне её знаком каждому, кто видел бокс: раунд
     * кончился, отдыхай.
     *
     * Под вторым ударом идёт октава ниже — она даёт вес, не поднимая
     * высоту: маленький динамик отзывается на низ телом, а не хрипом.
     */
    round: [
        { kind: BELL, freq: 587, length: 0.5,  gain: 0.7,  send: 0.24 },
        { kind: BELL, freq: 587, length: 1.8,  gain: 0.72, send: 0.38, after: 0.24 },
        { kind: BELL, freq: 294, length: 1.9,  gain: 0.34, send: 0.22, after: 0.24 }
    ],

    /*
     * Конец программы — трезвучие вверх и разрешение вниз, в тонику.
     *
     * Последняя нота была на октаву выше и держалась две секунды: на
     * телефонном динамике это не звук, а перегруз — длинный тон около
     * килогерца ему просто не по силам. Разрешение вниз и звучит законченнее,
     * и снимает нагрузку: та же музыкальная мысль на вдвое меньшей высоте.
     *
     * Под последней нотой — октава ниже, для веса.
     */
    done: [
        { kind: BELL, freq: 523, length: 0.32, gain: 0.7,  send: 0.2 },
        { kind: BELL, freq: 659, length: 0.32, gain: 0.72, send: 0.2,  after: 0.14 },
        { kind: BELL, freq: 784, length: 0.4,  gain: 0.75, send: 0.26, after: 0.28 },
        { kind: BELL, freq: 523, length: 2.2,  gain: 0.8,  send: 0.42, after: 0.46 },
        { kind: BELL, freq: 262, length: 2.4,  gain: 0.38, send: 0.22, after: 0.46 }
    ]
};

/**
 * Призвуки колокола: во сколько раз выше основного тона, насколько тише и
 * во сколько раз быстрее гаснут.
 *
 * Отношения не целые. У настоящего металла призвуки не кратны основному
 * тону — оттого он звенит, а не гудит; кратные дали бы орган.
 */
const PARTIALS = [
    { ratio: 1,    gain: 1,    decay: 1    },
    { ratio: 2.76, gain: 0.32, decay: 0.42 },
    { ratio: 5.4,  gain: 0.14, decay: 0.2  }
];

let ctx = null;
let master = null;
let room = null;
let planned = [];
let key = null;

/**
 * Отклик короткой комнаты — шум, затухающий за полсекунды.
 *
 * Записывать негде и незачем: на таком хвосте разница между настоящим
 * помещением и затухающим шумом не слышна, а файл пришлось бы класть в кэш.
 */
function impulse(audio, seconds = 0.6) {
    const rate = audio.sampleRate;
    const length = Math.floor(rate * seconds);
    const buffer = audio.createBuffer(2, length, rate);

    for (let channel = 0; channel < 2; channel++) {
        const data = buffer.getChannelData(channel);

        for (let i = 0; i < length; i++) {
            const fade = (1 - i / length) ** 2.4;
            data[i] = (Math.random() * 2 - 1) * fade;
        }
    }

    return buffer;
}

/**
 * Общий выход: сухой сигнал и посыл в комнату, оба через сжатие.
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
    comp.threshold.value = -20;
    comp.knee.value = 10;
    comp.ratio.value = 10;
    comp.attack.value = 0.002;
    comp.release.value = 0.15;
    comp.connect(ctx.destination);

    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(comp);

    const convolver = ctx.createConvolver();
    convolver.buffer = impulse(ctx);
    convolver.connect(comp);

    // Отдельная точка, к которой голоса подмешиваются своей долей: у щелчка
    // хвоста почти нет, у последней ноты программы он заметный
    room = convolver;

    return ctx;
}

/** Куда голос подключается: сухо и, если просили, с хвостом. */
function output(node, send) {
    node.connect(master);

    if (send > 0) {
        const wet = ctx.createGain();
        wet.gain.value = send;
        node.connect(wet);
        wet.connect(room);
    }
}

/**
 * Огибающая удара: мгновенная атака и затухание с первой миллисекунды.
 *
 * Именно она отличает удар от писка. Полки здесь нет намеренно — держать
 * громкость и потом оборвать умеет только техника, а не предмет.
 */
function strike(gain, at, peak, length) {
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
}

/** Колокол: основной тон плюс два призвука, гаснущих быстрее. */
function bell(at, { freq, length, gain: peak, send = 0 }) {
    for (const partial of PARTIALS) {
        const osc = ctx.createOscillator();
        const amp = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq * partial.ratio, at);

        strike(amp, at, peak * partial.gain, length * partial.decay);

        osc.connect(amp);
        output(amp, send * partial.gain);

        osc.start(at);
        osc.stop(at + length + 0.05);

        planned.push(osc);
    }
}

/** Щелчок: узкая полоса шума. Так звучит метроном, а не зуммер. */
function tick(at, { freq, length, gain: peak, send = 0 }) {
    const rate = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, Math.ceil(rate * length), rate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // Полоса узкая: широкий шум звучит как помеха, а не как удар
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.setValueAtTime(freq, at);
    band.Q.value = 6;

    const amp = ctx.createGain();
    strike(amp, at, peak, length);

    source.connect(band).connect(amp);
    output(amp, send);

    source.start(at);
    source.stop(at + length + 0.02);

    planned.push(source);
}

/** Толчок: низкий тон с падающей высотой. Его скорее чувствуешь. */
function thud(at, { freq, to, length, gain: peak, send = 0 }) {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, at);
    osc.frequency.exponentialRampToValueAtTime(to || freq / 2, at + length);

    strike(amp, at, peak, length);

    osc.connect(amp);
    output(amp, send);

    osc.start(at);
    osc.stop(at + length + 0.02);

    planned.push(osc);
}

const PLAYERS = { [BELL]: bell, [TICK]: tick, [THUD]: thud };

/** Один голос в заданный момент звукового движка. */
function voice(at, part) {
    const play = PLAYERS[part.kind];
    if (play) play(at, part);
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
            const parts = VOICES[cue.type];
            if (!parts) continue;

            const at = zero + cue.at;

            // Прошедшее не выкладываем: звуковой движок молча съедает время
            // в прошлом, но проверка избавляет от сотни мёртвых узлов
            if (at <= audio.currentTime) continue;

            for (const part of parts) voice(at + (part.after || 0), part);
            count += 1;
        }

        return count;
    },

    /** Снять всё выложенное — при паузе, пропуске и уходе с экрана. */
    stop() {
        for (const node of planned) {
            try { node.stop(); } catch { /* уже отыграл */ }
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
        for (const part of VOICES[type]) voice(at + (part.after || 0), part);

        return true;
    },

    /** Закрыть движок совсем: экран покинут, звук больше не нужен. */
    release() {
        beeper.stop();

        if (ctx && ctx.state !== 'closed') {
            ctx.close().catch(() => {});
        }

        ctx = null;
        master = null;
        room = null;
    }
};
