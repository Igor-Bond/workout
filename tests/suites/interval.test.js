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
    it('начало и конец работы звучат зеркально', () => {
        const го = beeper.VOICES.go.map((p) => p.freq);
        const стоп = beeper.VOICES.rest.map((p) => p.freq);


        assert(го[1] > го[0], 'начало работы — вверх');
        assert(стоп[1] < стоп[0], 'конец работы — вниз');
    });

    it('сигналы слышны: громкость не ниже половины', () => {
        for (const [name, parts] of Object.entries(beeper.VOICES)) {
            // Пульс — единственный, кому громким быть нельзя: он отвечает на
            // вопрос, а не зовёт что-то делать
            if (name === 'pulse') continue;

            for (const part of parts) {
                assert(part.gain >= 0.4, `${name}: ${part.gain} — в зале такое тонет`);
                assert(part.gain <= 1, `${name}: ${part.gain} — выше единицы звук захрипит`);
            }
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
