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
import { ai, DEFAULT_MODEL } from '../services/ai.js';
import { prompt } from '../core/prompt.js';
import { plan as planCore } from '../core/plan.js';
import { report as build } from '../core/report.js';
import { athlete } from '../core/athlete.js';
import { estimate } from '../core/estimate.js';
import { isBackground } from '../core/rhythm.js';
import { haptics } from '../core/haptics.js';
import { t } from '../core/i18n.js';
import { app } from '../app.js';
import { currentPlan, putDraft } from './planner.js';
import { currentAthlete } from './athlete.js';

/**
 * Переписка живёт в модуле: [{ role, text }].
 *
 * Не в базе. Разговор — черновик вокруг одного ответа, и хранить его наравне
 * с историей тренировок значило бы копить шум. Уходит он с уходом с экрана,
 * и это честно: то, что стоило сохранить, переносится в план.
 */
let нить = [];

/** Идёт ли обращение прямо сейчас — вторую кнопку нажимать нельзя. */
let ждём = false;

/** Последняя ошибка: показывается вместо ответа и не мешает спросить снова. */
let ошибка = '';

/** Показывать ли дело целиком — по нажатию, а не всегда. */
let раскрыто = false;

const KEY_SETTING = 'aiKey';
const MODEL_SETTING = 'aiModel';

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

    return prompt.dossier({ summary, plan: план?.text || '' });
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

                <div class="card">
                    <div class="card-title">${t('Нужен ключ')}</div>
                    <p class="hint">
                        ${t('Приложение обращается к языковой модели Google от вашего имени и вашим ключом. Ключ бесплатный: заведите его в Google AI Studio и вставьте сюда.')}
                    </p>

                    <div class="field">
                        <label for="ai-key">${t('Ключ')}</label>
                        <input id="ai-key" type="password" autocomplete="off" spellcheck="false"
                               placeholder="AIza…" data-change="coach-key">
                    </div>

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
                          placeholder="${t('Например: колено стало лучше, можно усилить субботу?')}"></textarea>

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
    }
};

// ================== ДЕЙСТВИЯ ==================

actions.onChange('coach-key', async (el) => {
    const key = el.value.trim();
    if (!key) return;

    await dbService.setSetting(KEY_SETTING, key);
    haptics.tap();
    app.render();
});

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

actions.on('coach-preset', (el) => {
    const поле = document.getElementById('coach-text');
    if (!поле) return;

    поле.value = t(ЗАГОТОВКИ[el.dataset.preset] || '');
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

    const вопрос = document.getElementById('coach-text')?.value.trim();
    if (!вопрос) return;

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
