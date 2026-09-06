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
import { haptics } from '../core/haptics.js';
import { dates } from '../core/dates.js';
import { t } from '../core/i18n.js';
import { app } from '../app.js';

/** Ключ настройки, под которым лежит профиль. Синхронизируется (§39.1). */
export const ATHLETE_KEY = 'athlete';

/** Прочитать профиль. Всегда полный: хранимый мог быть частичным. */
export const currentAthlete = async () => ядро.normalize(await dbService.getSetting(ATHLETE_KEY, null));

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

        const действующие = ядро.active(профиль);
        const прошедшие = профиль.limits.filter((l) => l.healedAt);

        return ui.html`
            ${ui.raw(ui.title(t('О себе'),
                t('Что приложение знает о вас помимо истории. Это же уходит в сводку для тренера — объяснять одно и то же каждый раз не придётся')))}

            <div class="card">
                <div class="card-title">${t('Рамки')}</div>

                <div class="field">
                    <label for="a-goal">${t('Цель')}</label>
                    <input id="a-goal" type="text" value="${профиль.goal}" autocomplete="off"
                           placeholder="${t('например: выносливость, не терять форму')}"
                           data-change="athlete-field" data-key="goal">
                </div>

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
actions.onChange('athlete-field', async (el) => {
    const профиль = await currentAthlete();
    const key = el.dataset.key;
    const value = el.value.trim();

    профиль[key] = (key === 'days' || key === 'minutes')
        ? (value === '' ? null : Number(value))
        : value;

    await dbService.setSetting(ATHLETE_KEY, профиль);
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
