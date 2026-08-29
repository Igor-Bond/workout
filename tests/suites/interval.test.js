/**
 * Интервальная программа (§50 ТЗ).
 *
 * Единственное место, где приложение ведёт человека, а не записывает за ним.
 * Ошибка здесь не портит запись — она сбивает саму тренировку: не тот отрезок,
 * не та пауза, сигнал не вовремя. Поэтому программа разворачивается заранее и
 * проверяется целиком, а не по ходу.
 */

import { describe, it, equal, assert } from '../runner.js';
import { interval } from '../../js/core/interval.js';
import { beeper } from '../../js/core/beeper.js';

const УПР = [{ exerciseId: 'а' }, { exerciseId: 'б' }];

/** Короткая запись программы: «работа-отдых-работа-между кругами». */
const схема = (phases) => phases.map((p) => `${p.kind}:${p.seconds}`).join(' ');

describe('Разворачивание программы', () => {

    /*
     * При одном упражнении границы круга нет: восемь кругов одного
     * упражнения — это и есть протокол, а десять секунд между ними и есть
     * обычный отдых. Считай приложение их отдыхом между кругами, обнулённый
     * отдых между кругами отнял бы у табаты весь отдых.
     */
    it('классическая табата — восемь кругов одного упражнения', () => {
        const phases = interval.build(
            { work: 20, rest: 10, rounds: 8, roundRest: 0, lead: 0 },
            [{ exerciseId: 'бёрпи' }]
        );

        equal(interval.workCount(phases), 8);
        equal(схема(phases).split(' ').filter((s) => s === 'rest:10').length, 7);
        equal(interval.total(phases), 8 * 20 + 7 * 10, 'четыре минуты без последнего отдыха');
    });

    it('круг из нескольких упражнений идёт по порядку', () => {
        const phases = interval.build({ work: 20, rest: 10, rounds: 2, roundRest: 60, lead: 0 }, УПР);

        equal(схема(phases),
            'work:20 rest:10 work:20 roundRest:60 work:20 rest:10 work:20');
    });

    /*
     * После последнего упражнения круга обычный отдых заменяется отдыхом
     * между кругами, а не добавляется: иначе на стыке набегали бы два
     * отдыха подряд.
     */
    it('на стыке кругов один отдых, а не два', () => {
        const phases = interval.build({ work: 20, rest: 10, rounds: 2, roundRest: 60, lead: 0 }, УПР);
        const паузы = phases.filter((p) => p.kind !== 'work');

        equal(паузы.map((p) => p.kind), ['rest', 'roundRest', 'rest']);
    });

    it('программа кончается работой, а не отдыхом', () => {
        const phases = interval.build({ rounds: 3, lead: 0 }, УПР);

        equal(phases[phases.length - 1].kind, 'work');
    });

    it('отсчёт перед стартом идёт первым', () => {
        const phases = interval.build({ lead: 10, rounds: 1 }, УПР);

        equal(phases[0].kind, 'lead');
        equal(phases[0].seconds, 10);
    });

    it('нулевые паузы просто не появляются', () => {
        const phases = interval.build({ work: 20, rest: 0, rounds: 2, roundRest: 0, lead: 0 }, УПР);

        equal(phases.every((p) => p.kind === 'work'), true);
        equal(phases.length, 4);
    });

    it('без упражнений программы нет', () => {
        equal(interval.build({}, []), []);
        equal(interval.build({}, [{ }]), [], 'строка без упражнения не в счёт');
    });

    it('у рабочего отрезка известны упражнение, круг и место в круге', () => {
        const [первый, , третий] = interval.build({ rounds: 1, rest: 10, lead: 0 }, УПР);

        equal(первый.exerciseId, 'а');
        equal(первый.round, 1);
        equal(первый.index, 0);
        equal(третий.exerciseId, 'б');
        equal(третий.index, 1);
    });
});

describe('Границы настроек', () => {

    /*
     * Опечатка в поле превращает тренировку в шестичасовую, а ноль секунд
     * работы — в бесконечную череду сигналов.
     */
    it('значения приводятся к допустимым', () => {
        const c = interval.normalize({ work: 0, rest: -5, rounds: 999, roundRest: 100000, lead: 5 });

        equal(c.work, interval.LIMITS.work.min);
        equal(c.rest, interval.LIMITS.rest.min);
        equal(c.rounds, interval.LIMITS.rounds.max);
        equal(c.roundRest, interval.LIMITS.roundRest.max);
        equal(c.lead, 5, 'допустимое не трогается');
    });

    it('мусор заменяется значением по умолчанию', () => {
        const c = interval.normalize({ work: 'двадцать', rounds: null });

        equal(c.work, interval.DEFAULTS.work);
        equal(c.rounds, interval.DEFAULTS.rounds);
    });

    it('готовые наборы сами проходят проверку границ', () => {
        for (const p of interval.PRESETS) {
            const c = interval.normalize(p);

            equal(c.work, p.work, p.label);
            equal(c.rest, p.rest, p.label);
            equal(c.rounds, p.rounds, p.label);
        }
    });
});

describe('Где мы сейчас', () => {

    // work:20 rest:10 work:20 roundRest:60 work:20 rest:10 work:20
    const phases = interval.build({ work: 20, rest: 10, rounds: 2, roundRest: 60, lead: 0 }, УПР);

    it('состояние выводится из прошедшего времени, а не копится тиками', () => {
        equal(interval.at(phases, 0).phase.kind, 'work');
        equal(interval.at(phases, 19).phase.kind, 'work');
        equal(interval.at(phases, 20).phase.kind, 'rest', 'ровно на границе — уже следующий');
        equal(interval.at(phases, 31).phase.exerciseId, 'б');
    });

    it('остаток округляется вверх', () => {
        equal(interval.at(phases, 0).remaining, 20);
        equal(interval.at(phases, 19.5).remaining, 1, 'пока на экране 1, секунда ещё идёт');
    });

    it('знает, что будет дальше', () => {
        equal(interval.at(phases, 0).next.exerciseId, 'б', 'во время работы — следующее упражнение');
        equal(interval.at(phases, 25).next.exerciseId, 'б', 'во время отдыха — к чему готовиться');
        equal(interval.at(phases, interval.total(phases) - 1).next, null, 'после последнего — ничего');
    });

    /*
     * Программа могла доотсчитаться, пока приложение было свёрнуто.
     * Спросить её состояние на минуте после конца — обычное дело.
     */
    it('за концом не выходит', () => {
        const конец = interval.at(phases, interval.total(phases) + 500);

        equal(конец.done, true);
        equal(конец.phase, null);
        equal(конец.remaining, 0);
    });

    it('пустая программа сразу закончена', () => {
        equal(interval.at([], 0).done, true);
    });
});

describe('Сигналы', () => {

    const phases = interval.build({ work: 20, rest: 10, rounds: 2, roundRest: 60, lead: 5 }, УПР);
    const cues = interval.cues(phases);

    it('на каждой границе — свой сигнал', () => {
        const границы = cues.filter((c) => c.type !== 'count' && c.type !== 'pulse');

        equal(границы.length, phases.length, 'по одному на отрезок');
        equal(границы[границы.length - 1].type, 'done', 'конец программы звучит иначе');
    });

    it('начало работы и начало отдыха различаются', () => {
        const типы = new Set(cues.map((c) => c.type));

        assert(типы.has('go'), 'начало работы');
        assert(типы.has('rest'), 'начало отдыха');
        assert(типы.has('round'), 'начало отдыха между кругами');
    });

    it('перед работой идёт отсчёт три-два-один', () => {
        // Отсчёт в конце вводной паузы длиной 5 с — на 2, 3 и 4 секунде
        const отсчёт = cues.filter((c) => c.type === 'count' && c.at < 5).map((c) => c.at);

        equal(отсчёт, [2, 3, 4]);
    });

    /*
     * Сначала отсчёт стоял только перед началом работы: казалось, что работу
     * незачем прерывать сигналом. Оказалось наоборот — упражнение
     * обрывалось без предупреждения, и по звуку нельзя было понять, что оно
     * кончилось. Знать про оставшиеся три секунды нужно в обе стороны.
     */
    it('перед концом работы отсчёт тоже идёт', () => {
        // Первая работа идёт с 5 до 25 секунды
        const внутри = cues.filter((c) => c.type === 'count' && c.at > 5 && c.at < 25).map((c) => c.at);

        equal(внутри, [22, 23, 24]);
    });

    /*
     * Вверх — начинай, вниз — заканчивай. Раньше начало работы и начало
     * отдыха отличались только высотой одного тона, и на слух это было одно
     * и то же «пик».
     */
    /*
     * Три щелчка отсчёта и длинный сигнал — стартовая команда, как на
     * дорожке. Скольжение тона вверх пробовалось и отвергнуто: непрерывный
     * подъём звучит как мультфильм, а не как команда начинать.
     */
    it('начало работы — один долгий ровный тон', () => {
        const го = beeper.VOICES.go;

        equal(го.length, 1, 'одиночный, без ступеней');
        assert(!го[0].to, 'без скольжения тона — оно звучит мультяшно');
        assert(го[0].length > beeper.VOICES.count[0].length * 4,
            'заметно длиннее щелчка отсчёта, иначе сольётся с ним');
    });

    it('конец работы идёт вниз', () => {
        const стоп = beeper.VOICES.rest.map((p) => p.freq);

        assert(стоп[1] < стоп[0], 'конец работы — вниз');
    });

    /*
     * Конец круга различается с концом работы жестом, а не высотой.
     *
     * Нисходящей тройкой он был раньше и не запоминался: конец работы — тоже
     * нисходящая фигура, и два похожих жеста подряд ухо сливает в один.
     * Двойной удар в одну ноту не похож ни на что в программе, а вне её
     * знаком по боксу.
     */
    it('конец круга — двойной удар в одну ноту', () => {
        const круг = beeper.VOICES.round;
        const основные = круг.filter((p) => p.freq >= 400);

        equal(основные.length, 2, 'два удара, а не ступени');
        equal(основные[0].freq, основные[1].freq, 'в одну и ту же ноту');
        assert(основные[1].length > основные[0].length * 2, 'второй звенит дольше — дальше длинный отдых');

        const стоп = beeper.VOICES.rest.map((p) => p.freq);
        assert(!стоп.includes(основные[0].freq), 'нота не должна совпадать с концом работы');
    });

    /*
     * Раньше старт и конец программы были восходящими наборами нот и потому
     * путались. Различаться должно устройство сигнала: старт одиночный,
     * конец — ступени, и он единственный длиннее секунды.
     */
    it('старт и конец программы устроены по-разному', () => {
        const конец = beeper.VOICES.done;

        assert(конец.length >= 3, 'конец — отдельные ступени');

        const длина = конец.reduce((max, p) => Math.max(max, (p.after || 0) + p.length), 0);
        assert(длина > 1, `конец программы должен длиться дольше всего, вышло ${длина}`);
        assert(длина > beeper.VOICES.go[0].length, 'дольше старта');
        assert(beeper.VOICES.go.length === 1, 'старт одиночный');
    });

    /*
     * Долгая нота, которой сигнал заканчивается, не должна быть высокой:
     * телефонный динамик на длинном тоне около килогерца хрипит. Вес даёт
     * подложенная октава ниже, а не высота.
     */
    it('долгие ноты не забивают динамик', () => {
        for (const [name, parts] of Object.entries(beeper.VOICES)) {
            for (const part of parts) {
                if (part.length < 1.5) continue;

                assert(part.freq <= 700,
                    `${name}: ${part.freq} Гц держится ${part.length} с — динамик захрипит`);
            }
        }
    });

    it('сигналы слышны: громкость не ниже половины', () => {
        for (const [name, parts] of Object.entries(beeper.VOICES)) {
            // Пульс — единственный, кому громким быть нельзя: он отвечает на
            // вопрос, а не зовёт что-то делать
            if (name === 'pulse') continue;

            /*
             * Спрашивается с громкости сигнала, а не каждого слоя: под
             * основной нотой лежит тихая октава ниже, и её дело — дать вес,
             * а не звучать самой.
             */
            const громче = parts.reduce((max, p) => Math.max(max, p.gain), 0);

            assert(громче >= 0.4, `${name}: ${громче} — в зале такое тонет`);
            assert(parts.every((p) => p.gain <= 1), `${name}: выше единицы звук захрипит`);
        }
    });

    /*
     * Между сигналами двадцать секунд тишины, и в них непонятно, идёт
     * работа или уже пауза, — особенно когда на телефон не смотришь.
     */
    it('во время работы идёт тихий пульс', () => {
        // Первая работа: с 5 по 25 секунду
        const пульс = cues.filter((c) => c.type === 'pulse' && c.at > 5 && c.at < 25).map((c) => c.at);

        equal(пульс, [10, 15, 20], 'каждые пять секунд, кроме последних трёх');
    });

    it('в паузах пульса нет — в том и смысл', () => {
        // Отдых идёт с 25 по 35 секунду
        equal(cues.filter((c) => c.type === 'pulse' && c.at > 25 && c.at < 35), []);
    });

    it('пульс не накладывается на отсчёт', () => {
        const пульс = new Set(cues.filter((c) => c.type === 'pulse').map((c) => c.at));
        const отсчёт = cues.filter((c) => c.type === 'count').map((c) => c.at);

        assert(отсчёт.every((t) => !пульс.has(t)), 'два разных сигнала разом сбивают с толку');
    });

    it('короткому отрезку пульс не нужен', () => {
        const короткая = interval.cues(interval.build({ work: 5, rest: 3, rounds: 1, lead: 0 }, УПР));

        equal(короткая.filter((c) => c.type === 'pulse'), []);
    });

    it('сигналы идут по возрастанию времени', () => {
        const времена = cues.map((c) => c.at);
        const по = [...времена].sort((a, b) => a - b);

        equal(времена, по, 'иначе их нельзя выложить в звуковой движок одной очередью');
    });

    it('последний сигнал совпадает с концом программы', () => {
        equal(cues[cues.length - 1].at, interval.total(phases));
    });
});

/*
 * Что сказать голосом (§50).
 *
 * Голос называет следующее упражнение в паузе — там, где на экран не
 * смотрят. Проверяется главным образом молчание: сказать лишнее здесь
 * хуже, чем не сказать, — программа и без того шумная.
 */
describe('Объявление следующего упражнения', () => {

    const ОДНО = [{ exerciseId: 'а' }];

    it('в подготовке объявляется первое упражнение', () => {
        const phases = interval.build({ work: 20, rest: 10, rounds: 2, lead: 10 }, УПР);

        equal(phases[0].kind, 'lead');
        equal(interval.announceAt(phases, 0), { exerciseId: 'а', kind: 'lead' });
    });

    it('в отдыхе объявляется то, что дальше', () => {
        const phases = interval.build({ work: 20, rest: 10, rounds: 2, lead: 10 }, УПР);

        // 0 — подготовка, 1 — работа «а», 2 — отдых перед «б»
        equal(phases[2].kind, 'rest');
        equal(interval.announceAt(phases, 2), { exerciseId: 'б', kind: 'rest' });
    });

    /*
     * Классическая табата — восемь кругов одного упражнения. Восемь раз
     * «дальше бёрпи» это шум: смысл фразы в том, что упражнение сменилось.
     */
    it('одно упражнение на всю программу называется один раз', () => {
        const phases = interval.build({ work: 20, rest: 10, rounds: 8, lead: 10 }, ОДНО);

        const сказано = phases
            .map((p, i) => interval.announceAt(phases, i))
            .filter(Boolean);

        equal(сказано, [{ exerciseId: 'а', kind: 'lead' }]);
    });

    it('во время работы молчим', () => {
        const phases = interval.build({ work: 20, rest: 10, rounds: 2, lead: 10 }, УПР);

        const работа = phases
            .map((p, i) => (p.kind === 'work' ? interval.announceAt(phases, i) : null))
            .filter(Boolean);

        equal(работа, [], 'речь во время подхода мешает, а не помогает');
    });

    it('после последнего отрезка говорить не о чем', () => {
        const phases = interval.build({ work: 20, rest: 10, rounds: 1, lead: 0 }, УПР);

        equal(interval.announceAt(phases, phases.length), null, 'за концом программы упражнений нет');
        equal(interval.announceAt([], 0), null);
    });

    /*
     * Отдых между кругами — такая же пауза, и упражнение после неё
     * меняется: это первое упражнение следующего круга.
     */
    it('перед новым кругом объявляется его первое упражнение', () => {
        const phases = interval.build({ work: 20, rest: 10, rounds: 2, roundRest: 60, lead: 0 }, УПР);

        const круг = phases.findIndex((p) => p.kind === 'roundRest');

        assert(круг > 0, 'граница круга должна быть');
        equal(interval.announceAt(phases, круг), { exerciseId: 'а', kind: 'roundRest' });
    });
});

/*
 * Повтор под конец длинной паузы.
 *
 * Минута отдыха между кругами — минута, за которую сказанное вначале
 * успевает забыться. В десятисекундной паузе повторять нечего: второе
 * напоминание наложилось бы на первое.
 */
describe('Повтор названия в длинной паузе', () => {

    it('отдых между кругами напоминает', () => {
        const phases = interval.build({ work: 20, rest: 10, rounds: 2, roundRest: 60, lead: 0 }, УПР);
        const круг = phases.findIndex((p) => p.kind === 'roundRest');

        equal(interval.remindAt(phases, круг), { exerciseId: 'а', kind: 'roundRest' });
    });

    it('короткий отдых не напоминает', () => {
        const phases = interval.build({ work: 20, rest: 10, rounds: 2, roundRest: 60, lead: 0 }, УПР);
        const отдых = phases.findIndex((p) => p.kind === 'rest');

        equal(interval.remindAt(phases, отдых), null, 'десять секунд короче самого напоминания');
    });

    it('во время работы не напоминает, как бы длинной она ни была', () => {
        const phases = interval.build({ work: 120, rest: 10, rounds: 2, lead: 0 }, УПР);

        equal(interval.remindAt(phases, 0), null);
    });

    /*
     * Иначе программа из одного упражнения с длинным отдыхом повторяла бы
     * его название дважды за круг — ровно тот шум, от которого молчание и
     * защищает.
     */
    it('одно упражнение не напоминает о себе', () => {
        const phases = interval.build({ work: 20, rest: 40, rounds: 3, lead: 0 }, [{ exerciseId: 'а' }]);
        const отдых = phases.findIndex((p) => p.kind === 'rest');

        assert(отдых > 0, 'отдых должен быть');
        equal(interval.remindAt(phases, отдых), null);
    });

    it('длинная подготовка тоже напоминает', () => {
        const phases = interval.build({ work: 20, rest: 10, rounds: 1, lead: 30 }, УПР);

        equal(interval.remindAt(phases, 0), { exerciseId: 'а', kind: 'lead' });
    });
});
