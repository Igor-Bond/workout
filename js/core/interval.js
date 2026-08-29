/**
 * Интервальная программа: табата и всё, что на неё похоже (§50 ТЗ).
 *
 * Здесь приложение впервые не записывает за человеком, а ведёт его. Всё
 * остальное построено на «сделал — записали»: подход пишется, когда нажали
 * «Выполнено». В интервальной тренировке нажимать нечего — двадцать секунд
 * работы не оставляют времени на телефон, — поэтому порядок задаётся заранее
 * и отсчитывается сам.
 *
 * Программа — плоская последовательность отрезков. Разворачивать её заранее,
 * а не считать на ходу, важно по двум причинам: по ней сразу видно общее
 * время, и по ней же вперёд планируются все звуковые сигналы, которые иначе
 * сбились бы вместе с придержанным в фоне таймером.
 *
 * Состояние выводится из прошедшего времени, а не накапливается тиками. Тик
 * в свёрнутом приложении браузер придерживает, и счётчик отстал бы; часы —
 * нет. По той же причине программа переживает перезагрузку страницы.
 */

/** Готовые наборы. Табата — та самая, 20 на 10 восемь раз. */
export const PRESETS = [
    { key: 'tabata', label: 'Табата 20/10', work: 20, rest: 10, rounds: 8,  roundRest: 60 },
    { key: '30-15',  label: '30/15',        work: 30, rest: 15, rounds: 4,  roundRest: 60 },
    { key: '40-20',  label: '40/20',        work: 40, rest: 20, rounds: 4,  roundRest: 90 }
];

/** Отсчёт перед первым отрезком: начинать в ту же секунду, что нажал, — жестоко. */
const LEAD = 10;

/** Как часто во время работы напоминать, что она идёт. */
const PULSE = 5;

export const DEFAULTS = { work: 20, rest: 10, rounds: 8, roundRest: 60, lead: LEAD };

/** Границы полей: без них опечатка превращает тренировку в шестичасовую. */
export const LIMITS = {
    work:      { min: 5,  max: 600 },
    rest:      { min: 0,  max: 600 },
    rounds:    { min: 1,  max: 30 },
    roundRest: { min: 0,  max: 900 },
    lead:      { min: 0,  max: 60 }
};

const clamp = (value, { min, max }, fallback) => {
    // Пустое — это «не задано», а не ноль: Number(null) даёт 0, и поле,
    // которого нет, молча превращалось бы в наименьшее допустимое
    if (value === null || value === undefined || value === '') return fallback;

    const n = Math.round(Number(value));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

export const interval = {

    PRESETS,
    DEFAULTS,
    LIMITS,

    /** Настройки, приведённые к допустимым: снаружи приходит что угодно. */
    normalize(config = {}) {
        const result = {};

        for (const [key, bounds] of Object.entries(LIMITS)) {
            result[key] = clamp(config[key], bounds, DEFAULTS[key]);
        }

        return result;
    },

    /**
     * Разворачивание программы в отрезки.
     *
     * После последнего упражнения круга обычный отдых заменяется отдыхом
     * между кругами, а не добавляется к нему: иначе на стыке набегало бы
     * два отдыха подряд. После последнего круга не остаётся ни того ни
     * другого — программа кончается работой.
     *
     * Упражнение одно — границы круга нет вовсе: классическая табата это
     * восемь кругов одного упражнения, и десять секунд между ними и есть
     * обычный отдых. Считать их отдыхом между кругами значило бы отнять у
     * протокола весь отдых, стоит выставить его в ноль.
     */
    build(config = {}, items = []) {
        const { work, rest, rounds, roundRest, lead } = interval.normalize(config);
        const list = items.filter((i) => i && i.exerciseId);

        if (list.length === 0) return [];

        const phases = [];

        if (lead > 0) phases.push({ kind: 'lead', seconds: lead });

        for (let round = 1; round <= rounds; round++) {
            list.forEach((item, index) => {
                phases.push({
                    kind: 'work',
                    seconds: work,
                    exerciseId: item.exerciseId,
                    round,
                    index
                });

                const lastOfList = index === list.length - 1;

                // Программа кончается работой: за последним отрезком паузы
                // нет, отдыхать уже не перед чем
                if (lastOfList && round === rounds) return;

                // Граница круга есть только когда упражнений больше одного
                const boundary = lastOfList && list.length > 1;

                const pause = boundary ? roundRest : rest;
                if (pause <= 0) return;

                phases.push({
                    kind: boundary ? 'roundRest' : 'rest',
                    seconds: pause,
                    round
                });
            });
        }

        return phases;
    },

    /** Сколько всего секунд займёт программа. */
    total(phases = []) {
        return phases.reduce((sum, p) => sum + p.seconds, 0);
    },

    /**
     * Где мы сейчас — по прошедшим секундам.
     *
     * Возвращает { done } на конце и никогда не выходит за границы: программа
     * может доотсчитаться, пока приложение было свёрнуто, и запрашивать её
     * состояние на минуте после конца — обычное дело.
     */
    at(phases = [], elapsed = 0) {
        const total = interval.total(phases);

        if (phases.length === 0) return { done: true, index: -1, phase: null, remaining: 0, elapsed: 0, total: 0 };
        if (elapsed >= total) return { done: true, index: phases.length, phase: null, remaining: 0, elapsed: total, total };

        const from = Math.max(0, elapsed);
        let passed = 0;

        for (let i = 0; i < phases.length; i++) {
            const phase = phases[i];

            if (from < passed + phase.seconds) {
                return {
                    done: false,
                    index: i,
                    phase,
                    // Округляем вверх: пока на экране «1», секунда ещё идёт,
                    // и ноль должен совпасть с сигналом, а не опередить его
                    remaining: Math.ceil(passed + phase.seconds - from),
                    elapsed: from,
                    total,
                    next: interval.nextWork(phases, i)
                };
            }

            passed += phase.seconds;
        }

        return { done: true, index: phases.length, phase: null, remaining: 0, elapsed: total, total };
    },

    /**
     * О чём сказать голосом при входе в отрезок (§50).
     *
     * Говорится один раз на паузу и только в паузу: во время работы речь
     * мешала бы, а не помогала. Возвращает { exerciseId, kind } — kind это
     * вид самой паузы, по нему подбирается фраза, — или null, если говорить
     * нечего.
     *
     * Молчим, когда следующее упражнение то же самое, что и сейчас.
     * Классическая табата — восемь кругов одного упражнения, и восемь раз
     * «дальше бёрпи» это шум, а не подсказка: смысл фразы в том, что
     * упражнение сменилось.
     */
    announceAt(phases = [], index = 0) {
        const phase = phases[index];
        if (!phase || phase.kind === 'work') return null;

        const next = interval.nextWork(phases, index);
        if (!next) return null;

        let prev = null;
        for (let i = index - 1; i >= 0; i--) {
            if (phases[i].kind === 'work') { prev = phases[i]; break; }
        }

        if (prev && prev.exerciseId === next.exerciseId) return null;

        return { exerciseId: next.exerciseId, kind: phase.kind };
    },

    /** Ближайший рабочий отрезок после указанного — для строки «дальше». */
    nextWork(phases = [], after = -1) {
        for (let i = after + 1; i < phases.length; i++) {
            if (phases[i].kind === 'work') return phases[i];
        }

        return null;
    },

    /**
     * Сигналы всей программы с их временем от старта.
     *
     * Отдаются заранее и целиком: звук планируется в звуковом движке вперёд,
     * а не проигрывается по тику. Тик в свёрнутом приложении придерживается,
     * звуковой поток — нет.
     */
    cues(phases = []) {
        const list = [];
        let at = 0;

        phases.forEach((phase, i) => {
            /*
             * Три щелчка перед концом любого отрезка, работы в том числе.
             *
             * Сначала отсчёт стоял только перед началом работы: казалось, что
             * работу незачем прерывать сигналом. Оказалось наоборот —
             * упражнение обрывалось без предупреждения, и по звуку нельзя
             * было понять, что оно кончилось. Знать, что осталось три
             * секунды, нужно в обе стороны.
             */
            for (let n = 3; n >= 1; n--) {
                const when = at + phase.seconds - n;
                if (when > at) list.push({ at: when, type: 'count' });
            }

            /*
             * Тихий пульс во время работы (§50).
             *
             * Без него между сигналами двадцать секунд тишины, и в них
             * непонятно, идёт работа или уже началась пауза, — особенно
             * когда на телефон не смотришь. Пульс отвечает на этот вопрос,
             * не отвлекая: он тише отсчёта втрое.
             *
             * В последние три секунды не звучит — там уже идёт отсчёт, и два
             * разных сигнала подряд сбивали бы с толку.
             */
            if (phase.kind === 'work') {
                for (let s = PULSE; s < phase.seconds - 3; s += PULSE) {
                    list.push({ at: at + s, type: 'pulse' });
                }
            }

            at += phase.seconds;

            const next = phases[i + 1];

            list.push({
                at,
                type: !next ? 'done'
                    : next.kind === 'work' ? 'go'
                    : next.kind === 'roundRest' ? 'round'
                    : 'rest'
            });
        });

        // По времени: внутри отрезка сигналы складываются не в том порядке,
        // в котором звучат, и очередь без сортировки читалась бы задом наперёд
        return list.sort((a, b) => a.at - b.at);
    },

    /** Сколько рабочих отрезков в программе — столько подходов и запишется. */
    workCount(phases = []) {
        return phases.filter((p) => p.kind === 'work').length;
    },

    /**
     * Рабочие отрезки, доведённые до конца к этому моменту.
     *
     * По ним пишутся подходы. Считается от прошедшего времени, а не
     * копится по ходу: программа могла доотсчитаться в свёрнутом
     * приложении, и записать надо всё, что успело пройти, — иначе
     * тренировка потеряется тем вернее, чем меньше на неё смотрели.
     */
    completedWork(phases = [], elapsed = 0) {
        const done = [];
        let at = 0;

        for (const phase of phases) {
            at += phase.seconds;
            if (phase.kind === 'work' && at <= elapsed) done.push(phase);
        }

        return done;
    },

    /** Конец отрезка в секундах от начала программы — для пропуска. */
    endOf(phases = [], index = 0) {
        let at = 0;

        for (let i = 0; i <= index && i < phases.length; i++) at += phases[i].seconds;

        return at;
    }
};
