/**
 * Знакомство при первом запуске (§61 ТЗ).
 *
 * Приложение молчаливое: оно считает подходы и не командует. Тому, кто уже
 * знает порядок, так удобнее — но открывший его впервые видит пустой экран с
 * кнопкой «Новая тренировка» и не знает ни про план, ни про профиль, ни про
 * тренера. Половина возможностей остаётся ненайденной, а вторая половина
 * работает вполсилы: приложение не знает про колено и предлагает выпады.
 *
 * Мастер, а не список ссылок (Р-99). Прежде каждый шаг уводил на свой экран —
 * профиль, справочник, тренер, — и человек не возвращался: знакомство
 * обрывалось на первом же шаге (Р-94). Теперь все вопросы задаются здесь, по
 * одному окну за раз, с «назад» и «далее», и ни один не уводит со страницы.
 *
 * Порядок: пять шагов о человеке → сводка ответов → короткая справка →
 * развилка «что делать дальше». План в шаги не входит намеренно: это не факт
 * о человеке, а результат разговора, и в первый день его неоткуда взять.
 * Тренеру же для плана нужны как раз ответы отсюда, поэтому план стоит в
 * конце — кнопкой, а не вопросом.
 *
 * Пропуск равноправен заполнению. Знакомство — не мастер, который ведёт за
 * руку и не выпускает: у каждого шага названо последствие отказа, и после
 * отказа приложение работает.
 *
 * Показывается один раз и только на пустой базе (см. main.js): человеку с
 * историей знакомиться не с чем, а вернуться сюда можно из профиля.
 */

import { ui } from '../core/ui.js';
import { actions } from '../core/actions.js';
import { dbService } from '../services/db.js';
import { athlete as ядро } from '../core/athlete.js';
import { ai, KEY_SETTING } from '../services/ai.js';
import { haptics } from '../core/haptics.js';
import { t } from '../core/i18n.js';
import { app } from '../app.js';
import { currentAthlete, ATHLETE_KEY } from './athlete.js';
import { ЦЕЛИ, ИНВЕНТАРЬ, ОГРАНИЧЕНИЯ } from '../core/presets.js';

/** Ключ настройки, под которым лежит состояние знакомства. */
export const INTRO_KEY = 'intro';

/**
 * Шаги по порядку. Первый — приветствие: спрашивать что-либо, не сказав, куда
 * человек попал, значит начать с допроса.
 */
const ШАГИ = ['hello', 'about', 'gear', 'body', 'coach'];

/** Что идёт после шагов: сводка ответов, короткая справка, развилка. */
const ПОСЛЕ = ['summary', 'help', 'done'];

const ВСЕ = [...ШАГИ, ...ПОСЛЕ];

/**
 * Ответы этого прохода.
 *
 * Живут в модуле, а не только в хранилище: между нажатиями «далее» человек
 * набирает в полях, и снимать набранное надо до любой перерисовки — иначе
 * нажатие на чип стирает то, что дописано в поле рядом.
 */
let ответы = null;

/** На каком шаге стоим. Переживает перезагрузку — лежит в настройке. */
let шаг = 0;

/**
 * Нужно ли знакомство.
 *
 * Условий два, и оба обязательны. Знакомство не пройдено — иначе оно лезло бы
 * при каждом запуске. И база пуста — иначе оно однажды встретило бы человека,
 * который пользуется приложением полгода, и объяснило бы ему, что такое
 * тренировка.
 */
export async function нужноЗнакомство() {
    const состояние = await dbService.getSetting(INTRO_KEY, null);
    if (состояние?.done) return false;

    // status пустой — любые, включая незаконченную: начатая тренировка это
    // тоже история, и знакомиться такому человеку уже поздно
    const тренировки = await dbService.listWorkouts({ limit: 1, status: '' });
    return тренировки.length === 0;
}

/** Отметить знакомство пройденным: больше оно само не появится. */
async function закрыть() {
    const состояние = await dbService.getSetting(INTRO_KEY, null);
    await dbService.setSetting(INTRO_KEY, { ...(состояние || {}), done: true, at: Date.now() });
}

/**
 * Полоса возврата к знакомству (Р-94).
 *
 * Осталась для тех случаев, когда человек всё же ушёл на другой экран — из
 * справки или из развилки в конце. Сами шаги никуда не уводят, и во время них
 * полосы не бывает.
 */
export async function знакомствоЖдёт() {
    const состояние = await dbService.getSetting(INTRO_KEY, null);
    if (!состояние?.pending || состояние.done) return null;

    const текущий = Math.min(Number(состояние.step) || 0, ШАГИ.length - 1);

    return { номер: текущий + 1, всего: ШАГИ.length };
}

/** Ответы из того, что уже есть в базе: знакомство можно и продолжить. */
async function собратьОтветы() {
    const [профиль, вес, ключ] = await Promise.all([
        currentAthlete(),
        dbService.lastBodyWeight(),
        dbService.getSetting(KEY_SETTING, '')
    ]);

    return {
        sex: профиль.sex || '',
        birthYear: профиль.birthYear ?? '',
        height: профиль.height ?? '',
        goal: профиль.goal || '',
        equipment: [...профиль.equipment],
        limits: ядро.active(профиль).map((l) => l.name),
        weight: вес?.weight ?? '',
        waist: вес?.waist ?? '',
        key: ключ || ''
    };
}

/**
 * Снять набранное с экрана в ответы.
 *
 * Вызывается перед каждым действием: нажатие на чип перерисовывает шаг, и без
 * этого дописанное в поле рядом пропадало бы. Поля, которых на шаге нет,
 * остаются как были.
 */
function снять() {
    if (!ответы) return;

    const поле = (id) => document.getElementById(id);
    const текст = (id) => поле(id)?.value.trim();

    for (const [id, ключ] of [['in-year', 'birthYear'], ['in-height', 'height'],
        ['in-goal', 'goal'], ['in-weight', 'weight'], ['in-waist', 'waist'], ['in-key', 'key']]) {
        const v = текст(id);
        if (v !== undefined) ответы[ключ] = v;
    }
}

/** Сохранить ответы туда, где они живут постоянно (§58, §26.3, §60). */
async function сохранить() {
    const профиль = await currentAthlete();
    const прежние = ядро.active(профиль).map((l) => l.name);

    профиль.sex = ответы.sex || '';
    профиль.birthYear = Number(ответы.birthYear) || null;
    профиль.height = Number(ответы.height) || null;
    профиль.goal = String(ответы.goal || '').trim();
    профиль.equipment = [...ответы.equipment];

    /*
     * Ограничения дописываются, а не переписываются: у названного здесь
     * «колена» на экране профиля могли уже быть выбраны исключённые
     * упражнения, и переписать список значило бы стереть эту работу.
     */
    for (const name of ответы.limits) {
        if (прежние.includes(name)) continue;

        профиль.limits.push({
            id: `lim-${Date.now().toString(36)}-${name.length}`,
            name,
            note: '',
            at: Date.now(),
            exclude: [],
            prefer: []
        });
    }

    // Убранное на шаге отмечается прошедшим, а не удаляется: история
    // ограничения — часть профиля (§58)
    for (const limit of ядро.active(профиль)) {
        if (!ответы.limits.includes(limit.name)) limit.healedAt = Date.now();
    }

    await dbService.setSetting(ATHLETE_KEY, профиль);

    const вес = Number(String(ответы.weight).replace(',', '.'));
    const талия = Number(String(ответы.waist).replace(',', '.'));

    if (Number.isFinite(вес) && вес > 0) {
        await dbService.setBodyWeight({ weight: вес, waist: талия > 0 ? талия : undefined });
    }

    const ключ = String(ответы.key || '').trim();
    if (ключ) await dbService.setSetting(KEY_SETTING, ключ);
}

/** Запомнить, где человек остановился: перезагрузка не должна начинать заново. */
async function отметитьШаг() {
    const состояние = await dbService.getSetting(INTRO_KEY, null);
    await dbService.setSetting(INTRO_KEY, { ...(состояние || {}), step: шаг, pending: null });
}

// ================== ШАГИ ==================

const чип = (подпись, активен, действие, значение) => ui.html`
    <button class="chip ${активен ? 'is-active' : ''}" data-action="${действие}" data-value="${значение}">
        ${подпись}
    </button>
`;

function приветствие() {
    return ui.html`
        <p>${t('Это журнал тренировок: подходы, повторения, вес — и то, что из них следует: рекорды, объём и подсказки, к чему пора вернуться.')}</p>
        <p class="hint">${t('Работает без сети и хранит всё на устройстве. Облако и тренер — по желанию.')}</p>
        <p class="hint">${t('Сейчас — пять коротких вопросов о вас. Каждый можно пропустить, приложение работает и без них.')}</p>
    `;
}

function оСебе() {
    return ui.html`
        <p class="hint">${t('Пол, возраст и рост нужны тренеру и расчёту нагрузки. Без них программа получится для кого-то другого.')}</p>

        <div class="row-links">
            ${чип(t('мужской'), ответы.sex === 'male', 'intro-sex', 'male')}
            ${чип(t('женский'), ответы.sex === 'female', 'intro-sex', 'female')}
        </div>

        <div class="plan-row-fields">
            <div class="field">
                <label for="in-year">${t('Год рождения')}</label>
                <input id="in-year" type="number" min="1900" max="2100" inputmode="numeric"
                       placeholder="1985" value="${ответы.birthYear}">
            </div>
            <div class="field">
                <label for="in-height">${t('Рост, см')}</label>
                <input id="in-height" type="number" min="100" max="250" inputmode="numeric"
                       placeholder="180" value="${ответы.height}">
            </div>
        </div>

        <div class="field">
            <label for="in-goal">${t('Цель')}</label>
            <div class="row-links">
                ${ЦЕЛИ.map((ц) => чип(t(ц), ответы.goal === ц, 'intro-goal', ц))}
            </div>
            <input id="in-goal" type="text" value="${ответы.goal}" autocomplete="off"
                   placeholder="${t('или своими словами')}">
        </div>
    `;
}

function инвентарь() {
    return ui.html`
        <p class="hint">${t('Чем вы располагаете. Тренер не предложит того, чего у вас нет, а приложение не позовёт делать это в подсказках.')}</p>

        <div class="row-links">
            ${ИНВЕНТАРЬ.map((и) => чип(t(и), ответы.equipment.includes(и), 'intro-gear', и))}
        </div>

        <p class="hint">${t('Что мешает: травма, больной сустав, что угодно ещё. Названное здесь потом можно связать с конкретными упражнениями в профиле.')}</p>

        <div class="row-links">
            ${ОГРАНИЧЕНИЯ.map((о) => чип(t(о), ответы.limits.includes(о), 'intro-limit', о))}
        </div>
    `;
}

function тело() {
    return ui.html`
        <p class="hint">${t('Без веса нагрузка отжиманий, планки и складки считается нулём: приложение берёт её долей от веса тела. Половина работы просто не попадёт в счёт.')}</p>

        <div class="plan-row-fields">
            <div class="field">
                <label for="in-weight">${t('Вес, кг')}</label>
                <input id="in-weight" type="number" inputmode="decimal" placeholder="80" value="${ответы.weight}">
            </div>
            <div class="field">
                <label for="in-waist">${t('Талия, см')}</label>
                <input id="in-waist" type="number" inputmode="decimal" placeholder="—" value="${ответы.waist}">
            </div>
        </div>

        <p class="hint">${t('Талия — если следите за объёмом: весы стоят месяцами, пока мышцы приходят на место жира, а сантиметры уходят.')}</p>
    `;
}

function тренер() {
    return ui.html`
        <p class="hint">${t('Разговор с языковой моделью прямо в приложении: она видит вашу историю и составляет программу. Нужен ключ Google — он бесплатный, карта не нужна, занимает минуту.')}</p>

        <div class="field">
            <label for="in-key">${t('Ключ Google')}</label>
            <input id="in-key" type="password" autocomplete="off" spellcheck="false"
                   placeholder="AIza…" value="${ответы.key}">
        </div>

        <div class="row-links">
            <button class="btn btn-ghost btn-sm" data-action="intro-key-site">${t('Открыть страницу ключей')}</button>
        </div>

        <p class="hint">${t('На странице: «Create API key», выбрать любой проект, скопировать строку на AIza — и вставить сюда.')}</p>
        <p class="hint">${t('Без ключа работает всё остальное. Не будет только разговора и заполнения карточек упражнений.')}</p>
    `;
}

/** Сводка ответов: всё, что человек сказал, — с правкой каждой строки. */
function сводка() {
    const строка = (подпись, значение, куда) => ui.html`
        <div class="ex-row">
            <div class="ex-main">
                <span class="ex-name">${значение || t('не сказано')}</span>
                <div class="ex-meta">${подпись}</div>
            </div>
            <div class="ex-actions">
                <button class="icon-btn" data-action="intro-goto" data-step="${куда}"
                        title="${t('Изменить')}">✎</button>
            </div>
        </div>
    `;

    const пол = ответы.sex === 'male' ? t('мужской') : ответы.sex === 'female' ? t('женский') : '';
    const рост = ответы.height ? `${ответы.height} ${t('см')}` : '';
    const вес = ответы.weight ? `${ответы.weight} ${t('кг')}` : '';
    const талия = ответы.waist ? `${ответы.waist} ${t('см')}` : '';

    return ui.html`
        <p class="hint">${t('Проверьте, всё ли верно. Любую строку можно поправить — вернётесь на её шаг.')}</p>

        ${строка(t('Пол'), пол, 'about')}
        ${строка(t('Год рождения'), ответы.birthYear, 'about')}
        ${строка(t('Рост'), рост, 'about')}
        ${строка(t('Цель'), ответы.goal, 'about')}
        ${строка(t('Инвентарь'), ответы.equipment.join(', '), 'gear')}
        ${строка(t('Ограничения'), ответы.limits.join(', '), 'gear')}
        ${строка(t('Вес тела'), вес, 'body')}
        ${строка(t('Талия'), талия, 'body')}
        ${строка(t('Тренер'), ответы.key ? t('ключ введён') : '', 'coach')}
    `;
}

/** Короткая справка: четыре вещи, без которых экран выполнения непонятен. */
function справка() {
    const карточка = (заголовок, текст) => ui.html`
        <div class="plan-rule">
            <strong>${заголовок}</strong>
            <span class="plan-day-rest">${текст}</span>
        </div>
    `;

    return ui.html`
        <p class="hint">${t('Четыре вещи, и дальше приложение понятно само.')}</p>

        ${карточка(t('Тренировка — это список подходов'),
            t('Выбираете упражнение, вписываете повторения и вес, нажимаете «Выполнено». Каждый подход пишется сразу, и незаконченная тренировка переживает закрытие приложения.'))}

        ${карточка(t('Отдых считается сам'),
            t('После подхода идёт отсчёт паузы со звуком. Длительность помнится за упражнением, а поправить её можно прямо во время отсчёта.'))}

        ${карточка(t('План — необязателен'),
            t('Есть план — приложение ведёт по нему. Нет — оно смотрит на историю и само предлагает, к чему пора вернуться.'))}

        ${карточка(t('Итоги считаются без вас'),
            t('Рекорды, объём, тоннаж, вес тела и постоянство — всё в «Статистике». Ничего отмечать вручную не нужно.'))}
    `;
}

/** Развилка в конце: несколько дорог, а не одна кнопка «готово». */
function развилка() {
    const естьКлюч = ai.ready(ответы.key);

    return ui.html`
        <p>${t('Всё готово. С чего начнёте?')}</p>

        ${естьКлюч ? ui.html`
            <button class="btn btn-accent btn-lg" data-action="intro-finish" data-screen="coach">
                ${t('Составить план с тренером')}
            </button>
            <p class="hint">${t('Тренер увидит ваши ответы и предложит программу. Её ответ переносится в план одним нажатием и разбирается сам — останется утвердить.')}</p>
        ` : ui.html`
            <button class="btn btn-accent btn-lg" data-action="intro-finish" data-screen="coach">
                ${t('Настроить тренера и составить план')}
            </button>
            <p class="hint">${t('Ключ бесплатный и занимает минуту. Тренер составит программу под ваши ответы, а приложение разберёт её и предложит утвердить.')}</p>
        `}

        <button class="btn btn-ghost" data-action="intro-finish" data-screen="planner">
            ${t('У меня уже есть план — вставить текстом')}
        </button>

        <button class="btn btn-ghost" data-action="intro-finish" data-screen="plan">
            ${t('Первая тренировка')}
        </button>

        <button class="btn btn-ghost" data-action="intro-finish" data-screen="exercises">
            ${t('Посмотреть справочник упражнений')}
        </button>

        <button class="btn btn-ghost" data-action="intro-finish" data-screen="home">
            ${t('Позже, на главный экран')}
        </button>
    `;
}

const ЗАГОЛОВКИ = {
    hello: 'Знакомство',
    about: 'О себе',
    gear: 'Инвентарь и ограничения',
    body: 'Вес тела',
    coach: 'Тренер',
    summary: 'Проверьте ответы',
    help: 'Как это работает',
    done: 'Готово'
};

const ТЕЛА = {
    hello: приветствие,
    about: оСебе,
    gear: инвентарь,
    body: тело,
    coach: тренер,
    summary: сводка,
    help: справка,
    done: развилка
};

export const intro = {

    title: 'Знакомство',
    nav: 'workout',

    async render() {
        const состояние = await dbService.getSetting(INTRO_KEY, null);

        // Ответы собираются один раз за проход: дальше их ведёт сам мастер, и
        // перечитывать базу на каждой перерисовке значило бы затирать
        // набранное тем, что успело сохраниться
        if (!ответы) {
            ответы = await собратьОтветы();
            шаг = Math.min(Math.max(Number(состояние?.step) || 0, 0), ВСЕ.length - 1);
        }

        const имя = ВСЕ[шаг];
        const номер = шаг + 1;
        const вопрос = шаг < ШАГИ.length;

        return ui.html`
            ${ui.raw(ui.title(t(ЗАГОЛОВКИ[имя]),
                вопрос
                    ? t('шаг {n} из {всего}', { n: номер, всего: ШАГИ.length })
                    : t('Пять шагов позади')))}

            <!--
                Полоса хода: на пяти шагах человек должен видеть, сколько
                осталось. Без неё «ещё вопрос» читается как «это надолго».
            -->
            ${вопрос ? ui.html`
                <div class="intro-bar">
                    ${ШАГИ.map((_, i) => ui.html`<span class="${i <= шаг ? 'is-done' : ''}"></span>`)}
                </div>
            ` : ''}

            <div class="card">
                ${ТЕЛА[имя]()}
            </div>

            ${имя === 'done' ? '' : ui.html`
                <div class="row-links">
                    ${шаг > 0 ? ui.html`
                        <button class="btn btn-ghost" data-action="intro-back">${t('Назад')}</button>
                    ` : ''}

                    <button class="btn btn-accent" data-action="intro-next">
                        ${имя === 'hello' ? t('Начать')
                            : имя === 'summary' ? t('Принять и продолжить')
                            : имя === 'help' ? t('Дальше')
                            : t('Далее')}
                    </button>
                </div>

                ${вопрос ? ui.html`
                    <button class="btn btn-ghost btn-sm" data-action="intro-skip">
                        ${имя === 'hello' ? t('Пропустить настройку') : t('Пропустить шаг')}
                    </button>
                ` : ''}
            `}
        `;
    },

    /** Уход с экрана забывает ответы: следующий заход начнёт с того, что в базе. */
    leave() {
        ответы = null;
    }
};

// ================== ДЕЙСТВИЯ ==================

/** Переход между шагами: набранное снимается, ответы сохраняются. */
async function перейти(куда) {
    снять();

    шаг = Math.min(Math.max(куда, 0), ВСЕ.length - 1);

    await сохранить();
    await отметитьШаг();

    haptics.tap();
    await app.render();
}

actions.on('intro-next', () => перейти(шаг + 1));
actions.on('intro-back', () => перейти(шаг - 1));

/** Пропуск шага: то же «далее», просто без ожидания ответа. */
actions.on('intro-skip', async () => {
    if (ВСЕ[шаг] === 'hello') {
        снять();
        await сохранить();
        await закрыть();
        haptics.tap();
        return app.go('home');
    }

    return перейти(шаг + 1);
});

/** Правка из сводки: возврат на нужный шаг. */
actions.on('intro-goto', (el) => перейти(ВСЕ.indexOf(el.dataset.step)));

actions.on('intro-sex', async (el) => {
    снять();
    ответы.sex = ответы.sex === el.dataset.value ? '' : el.dataset.value;
    await app.render();
});

actions.on('intro-goal', async (el) => {
    снять();
    ответы.goal = ответы.goal === el.dataset.value ? '' : el.dataset.value;
    await app.render();
});

/** Чипы инвентаря и ограничений переключаются: нажал — есть, нажал ещё — нет. */
const переключить = (список, значение) => (список.includes(значение)
    ? список.filter((v) => v !== значение)
    : [...список, значение]);

actions.on('intro-gear', async (el) => {
    снять();
    ответы.equipment = переключить(ответы.equipment, el.dataset.value);
    await app.render();
});

actions.on('intro-limit', async (el) => {
    снять();
    ответы.limits = переключить(ответы.limits, el.dataset.value);
    await app.render();
});

actions.on('intro-key-site', () => {
    window.open('https://aistudio.google.com/apikey', '_blank', 'noopener');
});

/**
 * Развилка в конце (§61).
 *
 * Знакомство закрывается здесь, а не раньше: до последнего нажатия человек
 * может вернуться назад и поправить ответ. Уходит он не «в приложение
 * вообще», а туда, что выбрал, — с этого места первый день и начинается.
 */
actions.on('intro-finish', async (el) => {
    снять();
    await сохранить();
    await закрыть();

    ответы = null;
    haptics.tap();

    app.go(el.dataset.screen || 'home');
});
