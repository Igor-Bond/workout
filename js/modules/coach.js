/**
 * Разговор с тренером (§60 ТЗ).
 *
 * То же, что переписка в чужом окне, минус копипаста и минус объяснения. Дело
 * — кондиции, ограничения и действующая программа — приложение подкладывает
 * само, а пришедший план переносится в приложение одной кнопкой.
 *
 * Данные не уходят сами. Ни одного обращения без нажатия, и до нажатия видно,
 * что именно уйдёт: то же правило, что у сводки (§55), только здесь его надо
 * держать строже — там человек копировал текст своими руками и видел его
 * весь, а тут отправляет приложение.
 *
 * Разговор живёт на этом устройстве и в облако не уезжает. Уезжает то, ради
 * чего он затевался, — план (§56) и профиль (§58). Переписка же это черновик:
 * хранить её на всех устройствах значило бы возить с собой шум ради того
 * единственного ответа, который и так сохранён планом.
 */

import { ui } from '../core/ui.js';
import { actions } from '../core/actions.js';
import { dialog } from '../core/dialog.js';
import { dbService } from '../services/db.js';
import { ai, DEFAULT_MODEL, KEY_SETTING, MODEL_SETTING } from '../services/ai.js';
import { prompt } from '../core/prompt.js';
import { plan as planCore } from '../core/plan.js';
import { report as build } from '../core/report.js';
import { athlete } from '../core/athlete.js';
import { estimate } from '../core/estimate.js';
import { isBackground } from '../core/rhythm.js';
import { haptics } from '../core/haptics.js';
import { t } from '../core/i18n.js';
import { app } from '../app.js';
import { currentPlan, currentJournal, putDraft } from './planner.js';
import { planJournal } from '../core/journal-plan.js';
import { dates } from '../core/dates.js';
import { currentAthlete } from './athlete.js';
import { recoveryLines } from './watch.js';
import { observations } from '../services/howgoing.js';

/**
 * Переписка живёт в модуле: [{ role, text }].
 *
 * Не в базе. Разговор — черновик вокруг одного ответа, и хранить его наравне
 * с историей тренировок значило бы копить шум. Уходит он с уходом с экрана,
 * и это честно: то, что стоило сохранить, переносится в план.
 */
let нить = [];

/**
 * Вопрос, положенный сюда с другого экрана (§63.1).
 *
 * Кладётся, а не отправляется: человек должен увидеть, о чём спрашивает, и
 * дописать своё — «колено уже не болит», «на этой неделе была командировка».
 * Отправить за него значило бы задать вопрос, которого он не задавал.
 *
 * Прямым вызовом, а не через хранилище: оба экрана живут на одной странице.
 */
let заготовлено = '';

export function putQuestion(text) {
    заготовлено = String(text || '').trim();
}

/** Идёт ли обращение прямо сейчас — вторую кнопку нажимать нельзя. */
let ждём = false;

/** Последняя ошибка: показывается вместо ответа и не мешает спросить снова. */
let ошибка = '';

/** Показывать ли дело целиком — по нажатию, а не всегда. */
let раскрыто = false;

/** Собрать дело: сводка без задания плюс действующая программа. */
async function дело() {
    const [entries, sets, exerciseList, weights, профиль, план] = await Promise.all([
        dbService.listWorkoutSummaries(),
        dbService.allSets(),
        dbService.listExercises({ includeArchived: true }),
        dbService.listBodyWeight(),
        currentAthlete(),
        currentPlan()
    ]);

    const summary = build.build({
        entries,
        sets,
        exercises: Object.fromEntries(exerciseList.map((e) => [e.id, e])),
        weights,
        shareOf: (exercise) => estimate.shareOf(exercise),
        background: isBackground,
        withRequest: false,

        // Справочник целиком, а не только сделанное за период (§55): иначе
        // подзабытое упражнение в план не попадёт никогда, а на его место
        // придут выдуманные названия
        catalogue: exerciseList.filter((e) => !e.archived && !athlete.excluded(профиль).has(e.id)),

        // Сон и пульс покоя с часов, если они привязаны (§62)
        recovery: await recoveryLines(),

        // Что и почему меняли в программе (§64): единственное, чего нет в числах
        journal: planJournal.describe(await currentJournal(), { format: (at) => dates.formatDate(at) }),
        profile: athlete.describe(
            профиль,
            new Map(exerciseList.map((e) => [e.id, e.name])),
            {
                male: t('мужчина'),
                female: t('женщина'),
                years: t('лет'),
                cm: t('см'),
                goal: t('Цель'),
                days: t('дней в неделю'),
                minutes: t('минут на тренировку'),
                equipment: t('Инвентарь'),
                limit: t('Ограничение'),
                exclude: t('нельзя'),
                prefer: t('взамен')
            }
        )
    });

    /*
     * Где человек в программе (§56.4).
     *
     * Текст плана этого не говорит: он один на все двенадцать недель. Без
     * строки собеседник правит начало программы, когда человек живёт уже в
     * её середине, — и делает это уверенно, потому что ошибиться ему нечем.
     */
    const где = план && planCore.active(план)
        ? [
            t('Сейчас неделя {n} из {всего}', { n: planCore.weekOf(план), всего: план.weeks }),
            planCore.stageAt(план)?.label || ''
        ].filter(Boolean).join('. ')
        : '';

    return prompt.dossier({ summary, plan: план?.text || '', now: где });
}


function сообщение(m, index) {
    const свой = m.role === 'user';

    const план = !свой && prompt.hasPlan(m.text, { parse: planCore.parse, usable: planCore.usable });

    return ui.html`
        <div class="msg ${свой ? 'is-mine' : ''}">
            <div class="msg-body">${m.text}</div>

            ${план ? ui.html`
                <!--
                    Кнопка появляется, только когда в ответе правда есть план
                    (§60). Обещать перенос там, где переносить нечего, значит
                    отправить человека на экран плана за разочарованием.
                -->
                <button class="btn btn-accent btn-sm" data-action="coach-to-plan" data-index="${index}">
                    ${t('Перенести в план')}
                </button>
            ` : ''}
        </div>
    `;
}

export const coach = {

    title: 'Тренер',
    nav: 'profile',

    async render() {
        const key = await dbService.getSetting(KEY_SETTING, '');
        const model = await dbService.getSetting(MODEL_SETTING, DEFAULT_MODEL);

        if (!ai.ready(key)) {
            return ui.html`
                ${ui.raw(ui.title(t('Тренер'),
                    t('Разговор о программе прямо здесь: дело приложение подложит само, а пришедший план перенесётся одной кнопкой')))}

                ${ошибка ? ui.html`<div class="banner is-danger"><span>${ошибка}</span></div>` : ''}

                <!--
                    Где брать ключ — по шагам и со ссылкой (§60.2).
                    «Заведите ключ в Google AI Studio» — это отсылка, а не
                    объяснение: человек, не знающий, что такое AI Studio, на
                    ней и остановится.
                -->
                <div class="card">
                    <div class="card-title">${t('Где взять ключ')}</div>
                    <p class="hint">
                        ${t('Приложение обращается к языковой модели Google от вашего имени и вашим ключом. Ключ бесплатный, карта не нужна, занимает минуту.')}
                    </p>

                    <div class="plan-rule">${t('1. Откройте страницу ключей Google AI Studio и войдите обычным аккаунтом Google.')}</div>
                    <div class="plan-rule">${t('2. Нажмите «Create API key» — и выберите проект, если спросят. Годится любой.')}</div>
                    <div class="plan-rule">${t('3. Скопируйте строку, которая начинается на AIza, и вставьте её ниже.')}</div>

                    <button class="btn btn-ghost btn-sm" data-action="coach-key-site">
                        ${t('Открыть страницу ключей')}
                    </button>
                </div>

                <div class="card">
                    <div class="card-title">${t('Нужен ключ')}</div>

                    <div class="field">
                        <label for="ai-key">${t('Ключ')}</label>
                        <input id="ai-key" type="password" autocomplete="off" spellcheck="false"
                               placeholder="AIza…" data-change="coach-key">
                    </div>

                    <!--
                        Кнопка рядом с полем, а не только событие смены
                        (§60.2). На телефоне вставка из буфера события change
                        не даёт, пока поле не потеряет фокус, — человек
                        вставлял ключ, ничего не происходило, и он уходил.
                    -->
                    <button class="btn btn-accent" data-action="coach-key-save" ${ui.raw(ждём ? 'disabled' : '')}>
                        ${ждём ? t('Проверяю…') : t('Сохранить и проверить')}
                    </button>

                    <p class="hint">
                        ${t('Ключ остаётся на этом устройстве и в облако не уезжает — на втором заведите свой. В приложении он лежит открыто: тот, кто дойдёт до хранилища браузера, его увидит. Защита не в тайне, а в ограничении ключа по адресу сайта в консоли Google.')}
                    </p>
                </div>

                <button class="btn btn-ghost" data-action="nav" data-screen="report">${t('Сводка для тренера')}</button>
            `;
        }


        const текст = раскрыто ? await дело() : '';

        return ui.html`
            ${ui.raw(ui.title(t('Тренер'),
                t('Дело приложение подкладывает само: кондиции, ограничения и действующая программа')))}

            ${нить.length === 0 ? ui.html`
                <div class="card">
                    <div class="card-title">${t('С чего начать')}</div>
                    <p class="hint">${t('Спросите своими словами или возьмите готовое.')}</p>

                    <div class="row-links">
                        <button class="btn btn-ghost btn-sm" data-action="coach-preset" data-preset="plan">
                            ${t('Составить программу')}
                        </button>
                        <button class="btn btn-ghost btn-sm" data-action="coach-preset" data-preset="review">
                            ${t('Что поправить')}
                        </button>
                        <button class="btn btn-ghost btn-sm" data-action="coach-preset" data-preset="next">
                            ${t('Следующий этап')}
                        </button>
                    </div>
                </div>
            ` : ''}

            ${нить.length ? ui.html`
                <div class="card thread">${нить.map(сообщение)}</div>
            ` : ''}

            ${ждём ? ui.html`<p class="hint">${t('Спрашиваю…')}</p>` : ''}
            ${ошибка ? ui.html`<div class="banner is-danger"><span>${ошибка}</span></div>` : ''}

            <div class="card">
                <textarea id="coach-text" class="report-text" rows="3"
                          placeholder="${t('Например: колено стало лучше, можно усилить субботу?')}">${заготовлено}</textarea>

                <div class="row-links">
                    <button class="btn btn-accent" data-action="coach-ask" ${ui.raw(ждём ? 'disabled' : '')}>
                        ${t('Спросить')}
                    </button>
                    ${нить.length ? ui.html`
                        <button class="link-btn" data-action="coach-clear">${t('Начать заново')}</button>
                    ` : ''}
                </div>
            </div>

            <!--
                Что уходит — по нажатию и целиком, тем же текстом, каким
                уйдёт (§60). Пересказ здесь был бы обещанием, а не показом.
            -->
            <div class="card">
                <div class="card-title">${t('Что уходит')}</div>
                <p class="hint">
                    ${t('При каждом обращении к Google уходит это дело и вся переписка. Ничего сверх — и ничего без нажатия.')}
                </p>

                <button class="link-btn" data-action="coach-reveal">
                    ${раскрыто ? t('Свернуть') : t('Показать целиком')}
                </button>

                ${раскрыто ? ui.html`<textarea class="report-text" rows="14" readonly>${текст}</textarea>` : ''}
            </div>

            <div class="card">
                <div class="card-title">${t('Настройки разговора')}</div>

                <div class="field">
                    <label for="ai-model">${t('Модель')}</label>
                    <input id="ai-model" type="text" autocomplete="off" spellcheck="false"
                           value="${model}" data-change="coach-model">
                </div>

                <p class="hint">${t('Состав моделей у Google меняется чаще, чем выходят версии приложения. Перестала отвечать — впишите другую.')}</p>

                <button class="link-btn is-danger" data-action="coach-forget">${t('Забыть ключ')}</button>
            </div>
        `;
    },

    /** Переписка уходит вместе с экраном: это черновик, а не история (§60). */
    leave() {
        нить = [];
        ошибка = '';
        раскрыто = false;
        заготовлено = '';
    },

    /**
     * Заготовка живёт до первой отрисовки, а дальше — в самом поле.
     *
     * Иначе она возвращалась бы при каждой перерисовке и затирала бы то,
     * что человек дописал: он пришёл спросить о наблюдении своими словами,
     * а не прочесть его ещё раз.
     */
    mount() {
        заготовлено = '';
    }
};

// ================== ДЕЙСТВИЯ ==================

/** Страница ключей Google AI Studio. */
const KEY_PAGE = 'https://aistudio.google.com/apikey';

actions.on('coach-key-site', () => {
    window.open(KEY_PAGE, '_blank', 'noopener');
});

/**
 * Сохранить ключ и сразу проверить его (§60.2).
 *
 * Проверяем, а не просто сохраняем. Ключ — строка из шестидесяти знаков,
 * скопированная наполовину или с чужого проекта, выглядит точно так же, как
 * рабочий; человек узнавал об этом при первом вопросе, через минуту ожидания
 * и с сообщением, которое относил к вопросу, а не к ключу.
 *
 * Проверка — самый дешёвый настоящий запрос: одно слово, короткий ответ.
 * Поддельной проверки «на глаз» тут быть не может: строка правильного вида
 * ничем не отличается от строки, которую Google не примет.
 */
actions.on('coach-key-save', async () => {
    if (ждём) return;

    const поле = document.getElementById('ai-key');
    const key = поле?.value.trim();

    if (!key) {
        ошибка = t('Поле пустое: вставьте ключ целиком, он начинается на AIza.');
        return app.render();
    }

    ждём = true;
    ошибка = '';
    await app.render();

    try {
        await ai.ask({
            key,
            model: await dbService.getSetting(MODEL_SETTING, DEFAULT_MODEL),
            messages: [{ text: 'ok' }]
        });

        await dbService.setSetting(KEY_SETTING, key);
        haptics.tap();
    } catch (e) {
        ошибка = e.message;
    } finally {
        ждём = false;
        await app.render();
    }
});

/**
 * Смена поля ключа больше ничего не сохраняет (§60.2).
 *
 * Раньше сохраняла — и это выглядело как молчание: человек вставлял ключ, а
 * приложение не отвечало ничем. Хуже, на телефоне событие смены при вставке
 * из буфера не приходит вовсе, пока поле не потеряет фокус. Теперь сохраняет
 * кнопка, и она же говорит, принят ключ или нет.
 */

actions.onChange('coach-model', async (el) => {
    await dbService.setSetting(MODEL_SETTING, el.value.trim() || DEFAULT_MODEL);
});

actions.on('coach-forget', async () => {
    const ok = await dialog.confirm({
        title: t('Забыть ключ?'),
        text: t('Разговор перестанет работать, пока не вставите ключ снова. Сам ключ в Google останется.'),
        confirmText: t('Забыть'),
        danger: true
    });

    if (!ok) return;

    await dbService.setSetting(KEY_SETTING, '');
    нить = [];
    app.render();
});

actions.on('coach-reveal', () => {
    раскрыто = !раскрыто;
    app.render();
});

actions.on('coach-clear', () => {
    нить = [];
    ошибка = '';
    app.render();
});

const ЗАГОТОВКИ = {
    plan: 'Составь программу на восемь недель.',
    review: 'Что бы ты поправил в моей нынешней программе и почему?',
    next: 'Программа скоро кончится. Что делать дальше — что оставить, что менять?'
};

/**
 * Заготовка про следующий этап собирается из того, как прошёл предыдущий
 * (§63.1).
 *
 * Общий вопрос «что дальше» получает общий ответ: собеседник видит числа за
 * восемь недель и не знает, что из задуманного вышло. А вышло ли — приложение
 * как раз знает: сколько дней плана сделано, где запас рос, какие недели были
 * плохими по сну. Это и есть разница между «составь следующий этап» и
 * «составь ещё одну программу».
 */
async function следующийЭтап() {
    const наблюдения = await observations();

    if (!наблюдения.length) return t(ЗАГОТОВКИ.next);

    return [
        t(ЗАГОТОВКИ.next),
        '',
        t('Вот что приложение видит по прошедшему этапу:'),
        ...наблюдения.map((н) => `— ${н.text}`)
    ].join('\n');
}

actions.on('coach-preset', async (el) => {
    const поле = document.getElementById('coach-text');
    if (!поле) return;

    поле.value = el.dataset.preset === 'next'
        ? await следующийЭтап()
        : t(ЗАГОТОВКИ[el.dataset.preset] || '');

    поле.focus();
});


/**
 * Спросить (§60).
 *
 * Дело подкладывается только к первому вопросу разговора: собеседник видит
 * всю переписку целиком, и повторять дело значит платить за него столько раз,
 * сколько задано вопросов.
 */
actions.on('coach-ask', async () => {
    if (ждём) return;

    const поле = document.getElementById('coach-text');
    const вопрос = поле?.value.trim();
    if (!вопрос) return;

    /*
     * Клавиатуру убираем сами, до перерисовки.
     *
     * На айфоне поле остаётся в фокусе и после нажатия кнопки, а перерисовка
     * подменяет его новым узлом — фокус слетает, клавиатура уезжает, окно
     * меняет высоту, и экран будто плывёт. Снять фокус заранее дешевле, чем
     * потом объяснять пляску разметки.
     */
    поле.blur();

    const key = await dbService.getSetting(KEY_SETTING, '');
    const model = await dbService.getSetting(MODEL_SETTING, DEFAULT_MODEL);

    const первый = нить.length === 0;
    const текст = первый ? prompt.first({ summary: await дело(), question: вопрос }) : вопрос;

    нить.push({ role: 'user', text: первый ? вопрос : вопрос, sent: текст });

    ждём = true;
    ошибка = '';
    await app.render();

    try {
        const ответ = await ai.ask({
            key,
            model,
            system: prompt.INSTRUCTION,
            messages: нить.map((m) => ({ role: m.role, text: m.sent || m.text }))
        });

        нить.push({ role: 'model', text: ответ });
        haptics.tap();
    } catch (e) {
        ошибка = e.message;

        // Неотправленный вопрос из нити убираем: иначе он уедет вторым
        // обращением как ни на что не ответивший
        нить.pop();
    } finally {
        ждём = false;
        await app.render();
    }
});

/**
 * Перенести пришедший план (§60).
 *
 * В поле экрана плана, а не сразу в действующий: план утверждает человек, и
 * подменять утверждение переносом значило бы принять за него решение на
 * восемь недель. Он увидит развёртку, список непонятого и спор с
 * ограничениями — и только потом нажмёт.
 */
actions.on('coach-to-plan', (el) => {
    const m = нить[Number(el.dataset.index)];
    if (!m) return;

    putDraft(m.text);
    app.go('planner');
});
