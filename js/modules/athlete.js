/**
 * Экран «О себе» (§58 ТЗ).
 *
 * Всё, что приложение знает о человеке помимо истории: рамки, инвентарь и
 * ограничения. История говорит, что он делал; профиль — что он может и чего
 * не станет.
 *
 * Экран отдельный, а не раздел настроек. В настройках лежит то, как
 * приложение себя ведёт: язык, звук, длительность отдыха. Здесь — то, что
 * приложение знает о человеке, и это разные вещи: настройки переживают смену
 * человека, профиль — нет.
 *
 * Ограничение здесь не заметка, а правило. Названное, оно исключает
 * упражнения отовсюду, где приложение что-то предлагает, и предупреждает,
 * если исключённое назвал план. Поэтому у каждого ограничения список
 * исключённого стоит на виду: человек должен видеть последствие своего
 * слова, а не верить, что оно куда-то учтено.
 */

import { ui } from '../core/ui.js';
import { actions } from '../core/actions.js';
import { dialog } from '../core/dialog.js';
import { dbService } from '../services/db.js';
import { athlete as ядро } from '../core/athlete.js';
import { ICU_STEPS_GOAL } from '../services/icu.js';
import { haptics } from '../core/haptics.js';
import { dates } from '../core/dates.js';
import { format } from '../core/format.js';
import { t } from '../core/i18n.js';
import { app } from '../app.js';

/** Ключ настройки, под которым лежит профиль. Синхронизируется (§39.1). */
export const ATHLETE_KEY = 'athlete';

/** Прочитать профиль. Всегда полный: хранимый мог быть частичным. */
export const currentAthlete = async () => ядро.normalize(await dbService.getSetting(ATHLETE_KEY, null));

/**
 * Ключ цифровых целей (§67).
 *
 * Отдельно от профиля, а не полем в нём: профиль — это то, что человек
 * рассказал о себе, и он меняется раз в полгода. Цель меняется тогда, когда
 * её достигли или передумали, и у каждой своя точка отсчёта со своим днём.
 */
export const GOALS_KEY = 'goals';

/** Цели: { вес: { target, from, since }, … }. Пустой объект, если их нет. */
export async function currentGoals() {
    const хранимое = await dbService.getSetting(GOALS_KEY, null);

    return хранимое && typeof хранимое === 'object' && !Array.isArray(хранимое) ? хранимое : {};
}

/**
 * Объявить цель или снять её.
 *
 * `from` — величина на сегодня: без неё потом не сказать, сколько пройдено, а
 * это и есть то, ради чего цель заводят (js/core/goal.js). Меняя число цели,
 * точку отсчёта не трогаем: человек передумал, куда идти, а не откуда вышел.
 */
export async function setGoal(metric, target, current) {
    const цели = await currentGoals();

    const к = Number(target);

    if (!Number.isFinite(к) || к <= 0) delete цели[metric];
    else {
        const прежняя = цели[metric]?.from;
        const откуда = Number.isFinite(прежняя) ? прежняя : Number(current);

        цели[metric] = {
            target: к,
            since: цели[metric]?.since || Date.now()
        };

        /*
         * Точки отсчёта может не быть вовсе, и тогда её не пишем.
         *
         * `Number(undefined)` — это NaN, а `Number(null)` — ноль (Р-156), и
         * записанный ноль читался бы дальше как «вышли от нуля»: пройденный
         * путь вышел бы длиной во всю цель. У дефицита точки отсчёта нет по
         * замыслу, а у веса её не бывает до первого взвешивания.
         */
        if (Number.isFinite(откуда)) цели[metric].from = откуда;
    }

    await dbService.setSetting(GOALS_KEY, цели);

    return цели;
}

/** Записать профиль целиком. */
async function сохранить(профиль) {
    await dbService.setSetting(ATHLETE_KEY, профиль);
    haptics.tap();
    await app.render();
}

/** Названия упражнений: профиль хранит ссылки, а показывать надо имена. */
async function имена() {
    const list = await dbService.listExercises({ includeArchived: true });
    return new Map(list.map((e) => [e.id, e.name]));
}

/**
 * Выбор упражнения из справочника.
 *
 * Тем же окном, что и везде: поиск, группы, длинный список. Заводить здесь
 * свой выбор значило бы завести второй способ искать упражнение — и первый
 * же расход внимания на то, чтобы понять, чем они отличаются.
 */
async function выбрать(title, кроме = []) {
    const list = await dbService.listExercises();
    const свободные = list.filter((e) => !кроме.includes(e.id));

    if (свободные.length === 0) return null;

    return dialog.pick({
        title,
        items: свободные.map((e) => ({ value: e.id, label: e.name, hint: e.group || '', group: e.group || '' })),
        groups: [...new Set(свободные.map((e) => e.group).filter(Boolean))].sort()
    });
}

function строкаСписка(ids, names, { limitId, key, label, empty }) {
    return ui.html`
        <div class="limit-row">
            <span class="limit-row-label">${label}</span>
            <span class="limit-row-body">
                ${ids?.length
                    ? ids.map((id) => ui.html`
                        <button class="chip is-removable" data-action="athlete-unlink"
                                data-limit="${limitId}" data-key="${key}" data-id="${id}">
                            ${names.get(id) || t('упражнение удалено')} ×
                        </button>
                    `)
                    : ui.html`<span class="hint">${empty}</span>`}
                <button class="chip" data-action="athlete-link" data-limit="${limitId}" data-key="${key}">＋</button>
            </span>
        </div>
    `;
}

export const athleteScreen = {

    title: 'О себе',
    nav: 'profile',

    async render() {
        const профиль = await currentAthlete();
        const names = await имена();
        const возраст = ядро.age(профиль);

        const цели = await currentGoals();
        const замеры = await dbService.listBodyWeight();
        const последний = замеры[замеры.length - 1] || null;

        /*
         * Цель по шагам лежит своим ключом, а не в целях (Р-185).
         *
         * Её читают часы, главный экран и статистика, и она давно уходит в
         * облако под своим именем. Переселить её в `goals` ради стройности
         * значило бы сломать обмен у того, кто её уже поставил, — ровно то,
         * чего делать нельзя (§35). Показывается она здесь, а хранится где
         * лежала.
         */
        const шаги = await dbService.getSetting(ICU_STEPS_GOAL, 0);

        const действующие = ядро.active(профиль);
        const прошедшие = профиль.limits.filter((l) => l.healedAt);

        return ui.html`
            ${ui.raw(ui.title(t('О себе'),
                t('Что приложение знает о вас помимо истории. Это же уходит в сводку для тренера — объяснять одно и то же каждый раз не придётся')))}

            <!--
                Веса тела здесь нет намеренно (§58): приложение ведёт его
                отдельно и по датам, и он уже уходит в сводку. Второе поле для
                того же числа разошлось бы с первым при первом взвешивании.
            -->
            <div class="card">
                <div class="card-title">${t('Кто вы')}</div>

                <div class="plan-row-fields">
                    <div class="field">
                        <label for="a-sex">${t('Пол')}</label>
                        <select id="a-sex" data-change="athlete-field" data-key="sex">
                            <option value="" ${ui.raw(профиль.sex ? '' : 'selected')}>${t('не указан')}</option>
                            <option value="male" ${ui.raw(профиль.sex === 'male' ? 'selected' : '')}>${t('мужской')}</option>
                            <option value="female" ${ui.raw(профиль.sex === 'female' ? 'selected' : '')}>${t('женский')}</option>
                        </select>
                    </div>

                    <div class="field">
                        <label for="a-year">${t('Год рождения')}</label>
                        <input id="a-year" type="number" min="1900" max="2100" inputmode="numeric"
                               placeholder="—" value="${профиль.birthYear ?? ''}"
                               data-change="athlete-field" data-key="birthYear">
                    </div>

                    <div class="field">
                        <label for="a-height">${t('Рост, см')}</label>
                        <input id="a-height" type="number" min="100" max="250" inputmode="numeric"
                               placeholder="—" value="${профиль.height ?? ''}"
                               data-change="athlete-field" data-key="height">
                    </div>
                </div>

                <p class="hint">
                    ${возраст ? t('Это {n} — приложение считает его от года, чтобы он не устаревал.', { n: format.count(возраст, format.WORDS.year) }) : ''}
                    ${t('Вес тела приложение ведёт само, по датам взвешиваний, — здесь его нет.')}
                </p>
            </div>

            <div class="card">
                <div class="card-title">${t('Рамки')}</div>

                <div class="field">
                    <label for="a-goal">${t('Цель')}</label>
                    <input id="a-goal" type="text" value="${профиль.goal}" autocomplete="off"
                           placeholder="${t('например: выносливость, не терять форму')}"
                           data-change="athlete-field" data-key="goal">
                </div>

                <!--
                    Цифровая цель рядом со словесной, а не вместо неё (§67).

                    Слова читает тренер — им он объясняет, зачем всё это. Число
                    читает приложение: из него оно знает, куда хорошо, сколько
                    пройдено и когда придёте. Одно другого не заменяет.
                -->
                <!--
                    Цели сгруппированы по своей природе, а не по счёту в ряду
                    (Р-185). Первый ряд — путь: откуда вышли, куда идём, и у
                    каждого числа есть точка отсчёта со своим днём. Второй —
                    то, что не проходят, а держат каждый день: ни срока, ни
                    начала у них нет, есть только названное число в сутки.
                -->
                <div class="plan-row-fields">
                    <div class="field">
                        <label for="a-goal-weight">${t('Вес, кг')}</label>
                        <input id="a-goal-weight" type="number" min="30" max="300" step="0.1" inputmode="decimal"
                               placeholder="${последний?.weight ? format.weight(последний.weight) : '—'}"
                               value="${цели.weight?.target ?? ''}"
                               data-change="goal-field" data-key="weight">
                    </div>
                    <div class="field">
                        <label for="a-goal-waist">${t('Талия, см')}</label>
                        <input id="a-goal-waist" type="number" min="40" max="200" step="0.5" inputmode="decimal"
                               placeholder="${последний?.waist ? format.weight(последний.waist) : '—'}"
                               value="${цели.waist?.target ?? ''}"
                               data-change="goal-field" data-key="waist">
                    </div>
                    <div class="field">
                        <label for="a-goal-fat">${t('Доля жира, %')}</label>
                        <input id="a-goal-fat" type="number" min="3" max="60" step="0.1" inputmode="decimal"
                               placeholder="${последний?.body?.fat ? format.decimal(последний.body.fat, 1) : '—'}"
                               value="${цели.fat?.target ?? ''}"
                               data-change="goal-field" data-key="fat">
                    </div>
                </div>

                <div class="plan-row-fields">
                    <div class="field">
                        <label for="a-goal-deficit">${t('Дефицит, ккал в день')}</label>
                        <input id="a-goal-deficit" type="number" min="50" max="2000" step="50" inputmode="numeric"
                               placeholder="—" value="${цели.deficit?.target ?? ''}"
                               data-change="goal-field" data-key="deficit">
                    </div>

                    <!--
                        Шаги стоят тут же, хотя хранятся отдельным ключом
                        (Р-185). Место цели — среди целей: до сих пор её
                        ставили окошком с главного экрана и с «Часов», и
                        человек, пришедший расставить цели, её здесь не
                        находил. Окошки остались — короткая дорога с того
                        экрана, где число и видно, — но пишут они то же самое.
                    -->
                    <div class="field">
                        <label for="a-goal-steps">${t('Шагов в день')}</label>
                        <input id="a-goal-steps" type="number" min="0" max="100000" step="500" inputmode="numeric"
                               placeholder="—" value="${шаги || ''}"
                               data-change="steps-goal-field">
                    </div>
                </div>

                <p class="hint">
                    ${t('Числа необязательны. Названное число говорит приложению то, чего не скажут слова: куда хорошо, сколько уже пройдено и когда придёте своим ходом. Видно это в «Кондициях», по нажатию на плитку. Дефицит и шаги стоят особняком: их не проходят, а держат каждый день. По дефициту приложение считает, сколько вам ещё можно съесть сегодня, а шаги сверяет с тем, что пришло с часов.')}
                    ${последний ? '' : t('Пока не было ни одного замера, отсчитывать не от чего — взвесьтесь в статистике.')}
                </p>

                <div class="plan-row-fields">
                    <div class="field">
                        <label for="a-days">${t('Дней в неделю')}</label>
                        <input id="a-days" type="number" min="1" max="7" inputmode="numeric"
                               placeholder="—" value="${профиль.days ?? ''}"
                               data-change="athlete-field" data-key="days">
                    </div>
                    <div class="field">
                        <label for="a-min">${t('Минут на тренировку')}</label>
                        <input id="a-min" type="number" min="5" max="300" inputmode="numeric"
                               placeholder="—" value="${профиль.minutes ?? ''}"
                               data-change="athlete-field" data-key="minutes">
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-title">${t('Инвентарь')}</div>
                <p class="hint">${t('Чем вы располагаете. Собеседник, составляющий программу, не предложит того, чего у вас нет.')}</p>

                <div class="row-links">
                    ${профиль.equipment.map((item) => ui.html`
                        <button class="chip is-removable" data-action="athlete-gear-drop" data-item="${item}">${item} ×</button>
                    `)}
                    <button class="chip" data-action="athlete-gear-add">＋ ${t('Добавить')}</button>
                </div>
            </div>

            <!--
                Ограничение показывается вместе со своим последствием (§58).
                Список исключённого стоит рядом с названием намеренно: человек
                обязан видеть, что именно его слово убрало из подсказок, а не
                верить, что оно куда-то учтено.
            -->
            <div class="card">
                <div class="card-title">${t('Ограничения')}</div>
                <p class="hint">
                    ${t('Травма, отсутствие снаряда, что угодно ещё. Исключённое пропадёт из подсказок, а план, назвавший его, скажет об этом при разборе.')}
                </p>

                ${действующие.length ? действующие.map((limit) => ui.html`
                    <div class="limit">
                        <div class="limit-head">
                            <strong>${limit.name}</strong>
                            <span class="hint">${t('с {дата}', { дата: dates.formatDate(limit.at) })}</span>
                        </div>

                        ${limit.note ? ui.html`<p class="hint">${limit.note}</p>` : ''}

                        ${строкаСписка(limit.exclude, names, {
                            limitId: limit.id, key: 'exclude',
                            label: t('Исключено'), empty: t('пока ничего')
                        })}

                        ${строкаСписка(limit.prefer, names, {
                            limitId: limit.id, key: 'prefer',
                            label: t('Взамен'), empty: t('не указано')
                        })}

                        <div class="row-links">
                            <button class="link-btn" data-action="athlete-limit-heal" data-limit="${limit.id}">${t('Прошло')}</button>
                            <button class="link-btn is-danger" data-action="athlete-limit-drop" data-limit="${limit.id}">${t('Удалить')}</button>
                        </div>
                    </div>
                `) : ui.html`<p class="hint">${t('Ограничений нет.')}</p>`}

                <button class="btn btn-accent" data-action="athlete-limit-add">${t('＋ Ограничение')}</button>
            </div>

            <!--
                Прошедшие не удаляются: перечень того, что когда-то мешало, —
                тоже история, и она пригодится, когда старое напомнит о себе.
            -->
            ${прошедшие.length ? ui.html`
                <div class="card">
                    <div class="card-title">${t('Прошедшие')}</div>
                    <p class="hint">${t('Больше ничего не исключают. Вернуть можно одним нажатием.')}</p>

                    ${прошедшие.map((limit) => ui.html`
                        <div class="limit-head">
                            <span>${limit.name}</span>
                            <button class="link-btn" data-action="athlete-limit-return" data-limit="${limit.id}">${t('Вернуть')}</button>
                        </div>
                    `)}
                </div>
            ` : ''}

            <div class="card">
                <div class="card-title">${t('Ещё о себе')}</div>
                <p class="hint">${t('Что важно знать тому, кто составляет программу, и чего не видно ни в истории, ни в ограничениях.')}</p>

                <textarea id="a-notes" class="report-text" rows="4"
                          aria-label="${t('Ещё о себе')}"
                          placeholder="${t('например: тренируюсь вечером дома, утром зарядка')}"
                          data-change="athlete-field" data-key="notes">${профиль.notes}</textarea>
            </div>

            <button class="btn btn-ghost" data-action="nav" data-screen="report">${t('Сводка для тренера')}</button>
        `;
    }
};

// ================== ДЕЙСТВИЯ ==================

/**
 * Поля пишутся по change, а не по каждой букве.
 *
 * Каждая буква означала бы запись в базу на нажатие клавиши и отправку в
 * облако следом. Профиль правят раз в месяц — ждать ухода из поля не жалко.
 */
/**
 * Объявить цифровую цель (§67, Р-155).
 *
 * Точка отсчёта берётся из последнего замера в тот момент, когда цель
 * называют: иначе потом не сказать, сколько пройдено. Пустое поле снимает
 * цель — отдельной кнопки «убрать» не нужно, стёртое число и значит «больше
 * не цель».
 */
actions.onChange('goal-field', async (el) => {
    const замеры = await dbService.listBodyWeight();
    const последний = замеры[замеры.length - 1] || null;

    /*
     * Точка отсчёта есть не у всякой цели.
     *
     * Вес, талия и доля жира — это путь: откуда вышли, куда идём, где сейчас.
     * Дефицит никуда не идёт, его держат; отсчитывать его не от чего, и
     * выдумывать точку ради единообразия значило бы завести число, которое
     * ничего не значит, а потом считать от него проценты.
     */
    const откуда = {
        weight: последний?.weight,
        waist: последний?.waist,
        fat: последний?.body?.fat
    };

    await setGoal(el.dataset.key, el.value, откуда[el.dataset.key]);

    haptics.tap();
});

/**
 * Цель по шагам — своим ключом (§62.5, Р-185).
 *
 * Отдельным обработчиком, а не через `setGoal`: у остальных целей есть точка
 * отсчёта и день, с которого её считают, а у шагов нет ни того ни другого —
 * это просто число, с которым сверяют вчерашний день. И хранится она там же,
 * где лежала: её читают часы, главный экран и статистика, и она уже уходит в
 * облако под своим именем.
 *
 * Пусто и ноль значат одно — цели нет. Убрать её человек должен уметь так же
 * легко, как поставить.
 */
actions.onChange('steps-goal-field', async (el) => {
    const цель = Math.max(0, Math.round(Number(el.value) || 0));

    await dbService.setSetting(ICU_STEPS_GOAL, цель);

    haptics.tap();
});

actions.onChange('athlete-field', async (el) => {
    const профиль = await currentAthlete();
    const key = el.dataset.key;
    const value = el.value.trim();

    const числовые = ['days', 'minutes', 'birthYear', 'height'];

    профиль[key] = числовые.includes(key)
        ? (value === '' ? null : Number(value))
        : value;

    await dbService.setSetting(ATHLETE_KEY, профиль);

    // Возраст показан подписью под полем и обязан ответить на новый год
    if (key === 'birthYear') await app.render();
});

actions.on('athlete-gear-add', async () => {
    const ответ = await dialog.form({
        title: t('Инвентарь'),
        fields: [{ name: 'item', label: t('Что добавить'), placeholder: t('например: резинки, турник, гантели') }]
    });

    const item = ответ?.item?.trim();
    if (!item) return;

    const профиль = await currentAthlete();
    if (профиль.equipment.includes(item)) return;

    профиль.equipment.push(item);
    await сохранить(профиль);
});

actions.on('athlete-gear-drop', async (el) => {
    const профиль = await currentAthlete();

    профиль.equipment = профиль.equipment.filter((i) => i !== el.dataset.item);
    await сохранить(профиль);
});

actions.on('athlete-limit-add', async () => {
    const ответ = await dialog.form({
        title: t('Ограничение'),
        text: t('Назовите его так, как сказали бы тренеру.'),
        fields: [
            { name: 'name', label: t('Что мешает'), placeholder: t('например: колено, нет турника') },
            { name: 'note', label: t('Подробнее, если нужно'), type: 'textarea', rows: 2,
              placeholder: t('например: неполная амплитуда, глубже не иду') }
        ]
    });

    const name = ответ?.name?.trim();
    if (!name) return;

    const профиль = await currentAthlete();

    профиль.limits.push({
        id: `lim-${Date.now().toString(36)}`,
        name,
        note: ответ.note?.trim() || '',
        at: Date.now(),
        exclude: [],
        prefer: []
    });

    await сохранить(профиль);
});

actions.on('athlete-link', async (el) => {
    const профиль = await currentAthlete();
    const limit = профиль.limits.find((l) => l.id === el.dataset.limit);
    if (!limit) return;

    const key = el.dataset.key;
    const id = await выбрать(key === 'exclude' ? t('Что исключить') : t('Что предложить взамен'), limit[key] || []);
    if (!id) return;

    limit[key] = [...(limit[key] || []), id];
    await сохранить(профиль);
});

actions.on('athlete-unlink', async (el) => {
    const профиль = await currentAthlete();
    const limit = профиль.limits.find((l) => l.id === el.dataset.limit);
    if (!limit) return;

    const key = el.dataset.key;
    limit[key] = (limit[key] || []).filter((id) => id !== el.dataset.id);

    await сохранить(профиль);
});

/**
 * «Прошло» гасит ограничение, но не стирает его.
 *
 * Без вопроса: отметка обратима одним нажатием, и спрашивать «точно?» о том,
 * что возвращается тем же движением, — пустой разговор.
 */
actions.on('athlete-limit-heal', async (el) => {
    const профиль = await currentAthlete();
    const limit = профиль.limits.find((l) => l.id === el.dataset.limit);
    if (!limit) return;

    limit.healedAt = Date.now();
    await сохранить(профиль);
});

actions.on('athlete-limit-return', async (el) => {
    const профиль = await currentAthlete();
    const limit = профиль.limits.find((l) => l.id === el.dataset.limit);
    if (!limit) return;

    delete limit.healedAt;
    await сохранить(профиль);
});

/** А удаление — с вопросом: оно необратимо, и вместе с ним уходят все ссылки. */
actions.on('athlete-limit-drop', async (el) => {
    const профиль = await currentAthlete();
    const limit = профиль.limits.find((l) => l.id === el.dataset.limit);
    if (!limit) return;

    const ok = await dialog.confirm({
        title: t('Удалить «{название}»?', { название: limit.name }),
        text: t('Исключённые им упражнения вернутся в подсказки. Если ограничение просто прошло, лучше отметить «Прошло» — так оно останется в истории.'),
        confirmText: t('Удалить'),
        danger: true
    });

    if (!ok) return;

    профиль.limits = профиль.limits.filter((l) => l.id !== limit.id);
    await сохранить(профиль);
});
