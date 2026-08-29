/**
 * Экран интервальной программы (§50 ТЗ).
 *
 * Здесь нет ни одного поля ввода — и это главное отличие от экрана
 * выполнения. Двадцать секунд работы не оставляют времени на телефон:
 * приложение отсчитывает само, а человек только смотрит и слушает.
 *
 * Ход программы хранится в самой тренировке, а не в модуле: свёрнутое
 * приложение, перезагрузка страницы и возврат с другого экрана не должны
 * сбивать отсчёт. Из тех же соображений время считается от отметки старта, а
 * не копится тиками.
 */

import { ui } from '../core/ui.js';
import { actions } from '../core/actions.js';
import { dialog } from '../core/dialog.js';
import { dbService } from '../services/db.js';
import { interval } from '../core/interval.js';
import { beeper } from '../core/beeper.js';
import { voice } from '../core/voice.js';
import { wakeLock } from '../core/wakelock.js';
import { fullscreen } from '../core/fullscreen.js';
import { config } from '../config.js';
import { format } from '../core/format.js';
import { app } from '../app.js';

let ticker = 0;

/** Данные последней отрисовки — чтобы обработчики не ходили в базу заново. */
let view = null;

/** Отрезок, на котором экран отрисован: сменился — пора перерисовать целиком. */
let shownIndex = -1;

/**
 * Отрезок, о котором уже сказано вслух.
 *
 * Ключом, а не флагом: отрисовка случается не только на смене отрезка, и без
 * такой отметки название повторялось бы при каждом возвращении на экран.
 * Живёт в модуле, а не в тренировке: сказанное вслух ничего не меняет в
 * записанном и хранить его между запусками незачем.
 */
let spokenKey = null;

const PHASE = {
    lead:      { label: 'Приготовься', tone: 'is-lead' },
    work:      { label: 'Работа',      tone: 'is-work' },
    rest:      { label: 'Отдых',       tone: 'is-rest' },
    roundRest: { label: 'Отдых между кругами', tone: 'is-round' }
};

/** Сколько секунд программы прошло. Считается от часов, а не от тиков. */
function elapsedOf(workout) {
    const run = workout.run || {};
    const base = run.elapsed || 0;

    if (run.state !== 'running' || !run.startedAt) return base;

    return base + (Date.now() - run.startedAt) / 1000;
}

async function load() {
    const workout = await dbService.getActiveWorkout();
    if (!workout || !workout.interval) return null;

    const [sets, list] = await Promise.all([
        dbService.listSets(workout.id),
        dbService.listExercises({ includeArchived: true })
    ]);

    const exercises = Object.fromEntries(list.map((e) => [e.id, e]));
    const phases = interval.build(workout.interval, workout.plan);

    return { workout, sets, exercises, phases, run: workout.run || { state: 'idle', elapsed: 0 } };
}

/**
 * Запись прошедших рабочих отрезков (§50).
 *
 * Пишется по факту прошедшего времени, а не по тику: программа могла
 * доотсчитаться в свёрнутом приложении, и записать надо всё, что успело
 * пройти. Повторения не записываются — считать их, не трогая телефон,
 * нельзя; проставить их можно потом, правкой подходов (§21.1).
 */
async function record({ workout, sets, phases }, elapsed) {
    const done = interval.completedWork(phases, elapsed);
    if (done.length <= sets.length) return false;

    const seconds = interval.normalize(workout.interval).work;
    let order = sets.length;

    for (const phase of done.slice(sets.length)) {
        const own = sets.filter((s) => s.exerciseId === phase.exerciseId).length;

        const set = await dbService.addSet({
            workoutId: workout.id,
            exerciseId: phase.exerciseId,
            order: order + 1,
            setNumber: own + 1,
            duration: seconds
        });

        sets.push(set);
        order += 1;
    }

    return true;
}

function head({ workout, phases, run }, state) {
    const total = interval.total(phases);
    const работа = interval.workCount(phases);

    return ui.html`
        <div class="iv-head">
            <div>
                <h1>${workout.type}</h1>
                <div class="iv-meta">
                    ${format.count(работа, format.WORDS.set)} · всего ${format.seconds(total)}
                </div>
            </div>
            <button class="link-btn" data-action="iv-finish">Закончить</button>
        </div>
    `;
}

/** Крупный отсчёт — единственное, что нужно видеть с вытянутой руки. */
function clock({ exercises, phases }, state) {
    const phase = state.phase;
    const info = PHASE[phase.kind];

    const exercise = phase.exerciseId ? exercises[phase.exerciseId] : null;
    const next = state.next ? exercises[state.next.exerciseId] : null;

    return ui.html`
        <div class="iv-clock ${info.tone}">
            <div class="iv-phase">${info.label}</div>
            <div class="iv-time" id="iv-time">${format.seconds(state.remaining)}</div>

            <div class="iv-now">${exercise ? exercise.name : (next?.name || '')}</div>

            ${exercise?.howTo ? ui.html`<p class="iv-how">${exercise.howTo}</p>` : ''}

            <!--
                Строка «дальше» нужна только во время работы: в паузе то же
                упражнение уже стоит крупно над ней, и повторять его значило
                бы напечатать одно название дважды подряд.
            -->
            ${phase.kind === 'work' && next ? ui.html`
                <div class="iv-next">дальше — ${next.name}</div>
            ` : ''}

            ${phase.round ? ui.html`
                <div class="iv-where">
                    круг ${String(phase.round)} из ${String(interval.normalize(view.workout.interval).rounds)}
                </div>
            ` : ''}
        </div>
    `;
}

/** Список упражнений круга: где мы и что впереди. */
function ring({ workout, exercises }, state) {
    const items = workout.plan.filter((i) => i.exerciseId);
    if (items.length < 2) return '';

    const nowId = state.phase?.exerciseId || state.next?.exerciseId;

    return ui.html`
        <div class="card">
            <div class="card-title">Круг</div>
            ${items.map((item, i) => ui.html`
                <div class="iv-row ${item.exerciseId === nowId ? 'is-now' : ''}">
                    <span class="iv-num">${String(i + 1)}</span>
                    <span>${exercises[item.exerciseId]?.name || 'Упражнение'}</span>
                </div>
            `)}
        </div>
    `;
}

export const intervalScreen = {

    title: 'Программа',
    nav: 'workout',

    /*
     * mount и unmount вызываются при каждой перерисовке, а не только при
     * входе на экран и уходе с него: приложение заменяет разметку целиком.
     *
     * Из-за этого здесь стоял release(), и звуковой движок закрывался сразу
     * после запуска — в том же обработчике, который только что выложил всю
     * очередь сигналов. Программа шла молча от начала до конца.
     *
     * Поэтому: снимаем выложенное, но движок не закрываем, а после отрисовки
     * выкладываем очередь заново от текущего момента. Закрывается он только
     * при завершении тренировки.
     */
    mount() {
        clearInterval(ticker);
        ticker = setInterval(tick, 250);

        wakeLock.enable();
        fullscreen.enterIfWanted();

        resyncSound();
        resyncVoice();
    },

    unmount() {
        clearInterval(ticker);
        ticker = 0;

        wakeLock.disable();
        shownIndex = -1;

        /*
         * Уход это или перерисовка — видно по адресу: при уходе он уже
         * сменился, перерисовка оставляет прежний.
         *
         * Различать обязательно. Раньше очередь снималась при любой
         * перерисовке, а перерисовка случается ровно на смене отрезка —
         * то есть сигнал начала упражнения глушился через доли секунды
         * после того, как зазвучал. Именно тот сигнал, ради которого всё и
         * затевалось.
         */
        if (!location.hash.startsWith('#/interval')) {
            beeper.release();
            voice.stop();
        }
    },

    async render() {
        view = await load();

        if (!view) {
            return ui.html`
                ${ui.title('Программа')}
                ${ui.empty('Интервальной тренировки нет.')}
                <button class="btn btn-accent" data-action="nav" data-screen="plan">Новая тренировка</button>
                <button class="btn btn-ghost" data-action="nav" data-screen="home">← На главную</button>
            `;
        }

        const elapsed = elapsedOf(view.workout);
        const state = interval.at(view.phases, elapsed);

        shownIndex = state.index;

        if (state.done) {
            return ui.html`
                ${head(view, state)}
                <div class="iv-clock is-done">
                    <div class="iv-phase">Программа пройдена</div>
                    <div class="iv-time">${format.seconds(interval.total(view.phases))}</div>
                    <div class="iv-now">${format.count(view.sets.length, format.WORDS.set)} записано</div>
                </div>
                <button class="btn btn-accent btn-lg" data-action="iv-finish">Завершить тренировку</button>
            `;
        }

        const running = view.run.state === 'running';

        return ui.html`
            ${head(view, state)}
            ${clock(view, state)}

            <div class="iv-tools">
                ${running
                    ? ui.html`<button class="btn btn-ghost" data-action="iv-pause">Пауза</button>`
                    : ui.html`<button class="btn btn-accent btn-lg" data-action="iv-start">
                          ${view.run.elapsed > 0 ? 'Продолжить' : 'Начать'}
                      </button>`}

                ${running ? ui.html`
                    <button class="btn btn-ghost" data-action="iv-skip">Пропустить отрезок</button>
                ` : ''}
            </div>

            <!--
                Молчащая программа выглядит поломкой, а не выключенным
                звуком: сигналы здесь — половина смысла, и человек не станет
                искать причину в профиле, если ему о ней не сказать.
            -->
            ${config.get('restSound') ? '' : ui.html`
                <p class="hint">Звук выключен в профиле — переходы будут беззвучными.</p>
            `}

            ${ring(view, state)}
        `;
    }
};

/**
 * Выкладка сигналов, если она ещё не сделана для этого хода программы.
 *
 * Ключ описывает отсчёт целиком: пока он тот же, очередь верна и трогать её
 * нельзя. Перевыкладка на каждой перерисовке обрывала звучащий сигнал —
 * а перерисовка случается как раз на смене отрезка, то есть ровно в тот
 * момент, когда сигнал и должен звучать.
 */
function soundKey(workout) {
    const run = workout.run || {};
    return `${workout.id}:${run.state}:${run.startedAt || 0}:${run.elapsed || 0}`;
}

function resyncSound() {
    if (!view || view.run.state !== 'running') return;

    beeper.schedule(interval.cues(view.phases), elapsedOf(view.workout), {
        key: soundKey(view.workout)
    });
}

/**
 * Что говорится в каждой паузе.
 *
 * Фраза называет не только упражнение, но и место в программе: в подготовке
 * важно, что сейчас начнётся, а в паузе между кругами — что кончился круг,
 * а не очередной подход. Без этого обе паузы звучали одинаково, и на слух
 * они не различались.
 *
 * Название стоит после двоеточия и потому остаётся в именительном падеже:
 * склонять его пришлось бы по-разному для каждого упражнения, а «начнём с
 * приседания» звучит хуже, чем пауза перед словом.
 */
const PHRASE = {
    lead:      (name) => `Начнём с упражнения: ${name}`,
    roundRest: (name) => `Новый круг. Начнём с упражнения: ${name}`,
    rest:      (name) => `Дальше: ${name}`
};

/**
 * Название следующего упражнения вслух — один раз на паузу.
 *
 * Говорится в начале паузы, а не перед самой работой: за десять секунд
 * отдыха фраза успевает прозвучать и осесть, а перед стартом ей пришлось бы
 * тесниться с отсчётом.
 */
function resyncVoice() {
    if (!view || view.run.state !== 'running' || shownIndex < 0) return;

    const key = `${view.workout.id}:${shownIndex}`;
    if (key === spokenKey) return;

    spokenKey = key;

    const what = interval.announceAt(view.phases, shownIndex);
    if (!what) return;

    const name = view.exercises[what.exerciseId]?.name;
    if (!name) return;

    const фраза = PHRASE[what.kind] || PHRASE.rest;
    voice.say(фраза(name));
}

/**
 * Такт отсчёта.
 *
 * Экран целиком перерисовывается только на смене отрезка: перерисовывать его
 * четыре раза в секунду значило бы четыре раза в секунду собирать разметку
 * ради одной изменившейся цифры.
 */
async function tick() {
    if (!view || view.run.state !== 'running') return;

    const elapsed = elapsedOf(view.workout);
    const state = interval.at(view.phases, elapsed);

    const written = await record(view, elapsed);

    if (state.index !== shownIndex || state.done || written) {
        if (state.done) await finishRun();
        return app.render();
    }

    const el = document.getElementById('iv-time');
    if (el) el.textContent = format.seconds(state.remaining);
}

/** Программа доотсчиталась: отсчёт останавливается, тренировка ещё нет. */
async function finishRun() {
    const elapsed = interval.total(view.phases);

    await dbService.updateWorkout(view.workout.id, {
        run: { state: 'done', elapsed, startedAt: null }
    });

    beeper.stop();
}

// ================== ДЕЙСТВИЯ ==================

/**
 * Запуск и продолжение.
 *
 * Сигналы выкладываются здесь, а не в отрисовке: браузер разрешает звук
 * только из обработчика нажатия, и очередь, выложенная где-то ещё, оказалась
 * бы беззвучной.
 */
actions.on('iv-start', async () => {
    if (!view) return;

    // Разрешение на речь берётся здесь же, до первого await: Safari
    // разрешает синтез только начатый с нажатия, и фраза, сказанная позже
    // по таймеру, оказалась бы беззвучной
    voice.prime();

    const run = { state: 'running', elapsed: view.run.elapsed || 0, startedAt: Date.now() };

    await dbService.updateWorkout(view.workout.id, { run });

    beeper.schedule(interval.cues(view.phases), run.elapsed);
    fullscreen.enterIfWanted();

    app.render();
});

actions.on('iv-pause', async () => {
    if (!view) return;

    await dbService.updateWorkout(view.workout.id, {
        run: { state: 'paused', elapsed: elapsedOf(view.workout), startedAt: null }
    });

    beeper.stop();
    voice.stop();
    app.render();
});

/** Пропуск: перескакиваем к концу текущего отрезка и перевыкладываем сигналы. */
actions.on('iv-skip', async () => {
    if (!view) return;

    const state = interval.at(view.phases, elapsedOf(view.workout));
    if (state.done) return;

    const elapsed = interval.endOf(view.phases, state.index);
    const run = { state: 'running', elapsed, startedAt: Date.now() };

    await dbService.updateWorkout(view.workout.id, { run });

    beeper.schedule(interval.cues(view.phases), elapsed);
    app.render();
});

actions.on('iv-finish', async () => {
    if (!view) return;

    const { workout, sets } = view;

    if (sets.length === 0) {
        const choice = await dialog.choose({
            title: 'Ни одного отрезка не пройдено',
            text: 'Завершать нечего.',
            options: [
                { value: 'delete', label: 'Удалить тренировку', danger: true },
                { value: 'stay', label: 'Вернуться к программе' }
            ]
        });

        if (choice !== 'delete') return;

        await dbService.deleteWorkout(workout.id);
        return app.go('home');
    }

    const ok = await dialog.confirm({
        title: 'Завершить тренировку?',
        text: `Записано ${format.count(sets.length, format.WORDS.set)}. Повторения можно проставить на итогах.`,
        confirmText: 'Завершить'
    });

    if (!ok) return;

    beeper.release();
    voice.stop();
    await dbService.finishWorkout(workout.id);

    app.go('summary', workout.id);
});
