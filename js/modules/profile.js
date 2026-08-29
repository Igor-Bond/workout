/**
 * Профиль и настройки (§28 ТЗ).
 *
 * Единственный раздел, который на этапе 1 работает целиком: настройки живут
 * в localStorage и базы не требуют. Синхронизация и резервная копия появятся
 * на этапе 8.
 */

import { ui } from '../core/ui.js';
import { config, MODES } from '../config.js';
import { install } from '../core/install.js';
import { updater } from '../core/updater.js';
import { fullscreen } from '../core/fullscreen.js';
import { voice } from '../core/voice.js';
import { i18n, t } from '../core/i18n.js';
import { format } from '../core/format.js';
import { VERSION } from '../version.js';
import { dbService } from '../services/db.js';
import { auth } from '../services/auth.js';
import { sync } from '../services/sync.js';
import { backup } from '../services/backup.js';
import { dates } from '../core/dates.js';
import { restTimer } from '../core/timer.js';
import { app } from '../app.js';
import { actions } from '../core/actions.js';
import { dialog } from '../core/dialog.js';

/**
 * Докуда достаёт ползунок отдыха.
 *
 * Обычные десять минут — и дальше ровно настолько, насколько человек сам
 * вписал в поле. Растягивать ползунок до получаса «на всякий случай» нельзя:
 * шаг остался бы прежним, а полторы минуты пришлось бы ловить в первой
 * двадцатой его длины.
 */
const SLIDER_MAX = 600;

/**
 * Откуда начинается ползунок.
 *
 * Четверть минуты — разумное начало: короче отдыхают между разминочными
 * подходами, и подбирать такое ползунком незачем. Но если в поле вписали
 * меньше, начало опускается следом: ползунок, застрявший на пятнадцати там,
 * где настройка равна пяти, показывал бы неправду.
 */
const SLIDER_MIN = 15;

function restCeiling(seconds) {
    return Math.max(SLIDER_MAX, Math.ceil(seconds / 15) * 15);
}

/**
 * Показать длительность отдыха, не перерисовывая экран.
 *
 * Значение видно в трёх местах сразу — в поле, в подписи и положением
 * ползунка, — и разойтись им нельзя. Перерисовка же посреди набора отняла бы
 * фокус из поля на каждой цифре.
 */
function showRest(seconds) {
    const label = document.getElementById('rest-value');
    if (label) label.textContent = format.seconds(seconds);

    const field = document.getElementById('set-rest-exact');
    if (field && Number(field.value) !== seconds) field.value = String(seconds);

    const slider = document.getElementById('set-rest');
    if (slider && Number(slider.value) !== seconds) slider.value = String(seconds);
}

/** Переключатель настройки. */
function toggle(key, label, hint) {
    const value = config.get(key);
    return ui.html`
        <label class="setting">
            <span class="setting-text">
                <span class="setting-label">${label}</span>
                ${hint ? ui.raw(`<span class="setting-hint">${ui.esc(hint)}</span>`) : ''}
            </span>
            <input type="checkbox" data-change="setting" data-key="${key}" ${ui.raw(value ? 'checked' : '')}>
        </label>
    `;
}

/**
 * Синхронизация (§38, §39).
 *
 * Три состояния: не настроена, настроена но без входа, работает. Приложение
 * полностью работоспособно во всех трёх — вход включает обмен и не меняет
 * ничего другого.
 */
function syncBlock() {
    if (!auth.isConfigured()) {
        return ui.html`
            ${ui.empty(t('Не настроена. Приложение работает локально: тренировки, история и статистика на месте, просто не переносятся между устройствами.'))}
            <p class="hint">${t('Чтобы включить — заполнить')} <code>js/firebase.config.js</code>. ${t('Порядок в')} <code>docs/DEPLOY.md</code>.</p>
        `;
    }

    if (!auth.isSignedIn) {
        return ui.html`
            ${ui.empty(t('Вход не выполнен. Локальные данные при входе не стираются — они объединятся с облачными.'))}
            <button class="btn btn-accent" data-action="sync-in">${t('Войти через Google')}</button>
        `;
    }

    const last = sync.getLastSync();

    return ui.html`
        <div class="info-row"><span>${t('Учётная запись')}</span><strong>${auth.user?.email || t('вход выполнен')}</strong></div>
        <div class="info-row">
            <span>${t('Последний обмен')}</span>
            <strong>${last ? dates.formatDateTime(last) : t('ещё не было')}</strong>
        </div>

        <div id="sync-status" class="sync-status"></div>

        <button class="btn btn-accent" data-action="sync-now">${t('Синхронизировать')}</button>
        <button class="btn btn-ghost" data-action="sync-full">${t('Полный обмен заново')}</button>
        <button class="btn btn-ghost" data-action="sync-out">${t('Выйти')}</button>
        <p class="hint">${t('Выход не удаляет локальные данные. Незавершённая тренировка в облако не уезжает — она живёт только на этом устройстве.')}</p>
    `;
}

function installBlock() {
    if (install.installed) {
        return ui.empty(t('Приложение уже установлено.'));
    }
    if (install.available) {
        return ui.html`<button class="btn btn-accent" data-action="install">${t('Установить приложение')}</button>`;
    }
    if (install.supported) {
        return ui.empty(t('Браузер пока не предложил установку. Она станет доступна после нескольких заходов.'));
    }
    return ui.empty(t('Установка делается вручную: «Поделиться» → «На экран Домой».'));
}

export const profile = {

    title: 'Профиль',
    nav: 'profile',

    async render() {
        const rest = config.get('restSeconds');
        const mode = config.mode();

        const counts = await dbService.stats();
        const imported = await dbService.getSetting('v1ImportSummary');

        // Состояние входа известно только после подъёма SDK, но поднимать
        // его ради тех, кто облаком не пользуется, незачем: раздел и без
        // него честно покажет «вход не выполнен»
        if (sync.available) await auth.init().catch(() => {});

        return ui.html`
            ${ui.raw(ui.title(t('Профиль')))}

            <!--
                Справка стоит первой и выделена цветом, хотя нажимают её
                реже всего остального в профиле.

                Ищут её именно здесь и именно тогда, когда не нашли ничего
                другого: раздел настроек — последнее место, куда заглядывает
                тот, кому непонятно. Бледной строкой среди настроек она
                читалась как ещё один переключатель, мимо которого скользит
                взгляд, — а тому, кто открыл приложение впервые, это самая
                нужная кнопка на экране.
            -->
            <button class="btn btn-accent" data-action="nav" data-screen="guide">
                ${t('Как пользоваться приложением')}
            </button>

            <!--
                Выбор языка появляется, только когда перевод полон (§53).
                Наполовину переведённый экран читается не как «часть ещё не
                готова», а как сломанный: половина слов чужая, половина
                своя, и непонятно, чему верить.
            -->
            ${i18n.ready ? ui.html`
            <div class="card">
                <div class="card-title">${t('Язык')}</div>

                <div class="field">
                    <!--
                        Своё окно выбора, а не системный список.

                        Родной <select> открывает список средствами телефона:
                        он выглядит чужим, живёт по своим правилам и на
                        Android рисуется поверх приложения белым по светлому.
                        Окно выбора в приложении одно и то же везде — тем же
                        оно должно быть и здесь.
                    -->
                    <button class="btn btn-ghost" data-action="lang-pick">
                        ${i18n.LANGS.find((l) => l.value === i18n.setting)?.label || t('Язык')}
                    </button>
                    <!--
                        «Как в телефоне» стоит первым и выбрано по умолчанию:
                        приложение, отданное за пределы русскоязычных стран,
                        должно оказываться английским само. Объяснять, где
                        переключатель, пришлось бы на языке, которого человек
                        и не знает.
                    -->
                    <div class="hint">
                        ${t('Язык интерфейса. Названия упражнений и заметки остаются такими, какими записаны.')}
                    </div>
                </div>
            </div>
            ` : ''}

            <div class="card">
                <div class="card-title">${t('Тренировка')}</div>

                <div class="field">
                    <label for="set-mode">${t('Порядок упражнений')}</label>
                    <select id="set-mode" data-change="setting" data-key="mode">
                        ${MODES.map((m) => ui.html`
                            <option value="${m.value}" ${ui.raw(mode === m.value ? 'selected' : '')}>${t(m.label)}</option>
                        `)}
                    </select>
                    <div class="hint">${t(MODES.find((m) => m.value === mode)?.hint || '')}</div>
                </div>

                ${ui.raw(toggle('keepAwake', t('Не гасить экран'), t('Во время тренировки')))}

                <!--
                    Выключателя нет, когда решает не он.

                    Развёрнутое окно приложению даёт система при установке, и
                    на месте это не переключить. Оставленный здесь выключатель
                    щёлкал бы, ничего не меняя, — а выключатель, который лжёт,
                    хуже отсутствующего.
                -->
                ${fullscreen.supported && !fullscreen.byManifest ? ui.raw(toggle(
                    'fullscreen',
                    t('Полноэкранный режим'),
                    t('Скрывает системные панели всё время работы')
                )) : ''}

                <!--
                    Состояние и кнопка вместо одного лишь выключателя.

                    Полный экран включается не когда его попросили, а когда
                    браузер разрешит: он требует касания, а установленному
                    приложению может отказать вовсе. Со стороны это выглядит
                    как «выключатель не работает», и без строки состояния
                    отличить «браузер отказал» от «настройка выключена»
                    нельзя — ни владельцу, ни мне по его рассказу.
                -->
                <div class="info-row">
                    <span>${t('Сейчас')}</span>
                    <strong>${fullscreen.byManifest ? t('во весь экран с запуска')
                        : !fullscreen.supported ? t('браузер не умеет')
                        : fullscreen.active ? t('включён') : t('выключен')}</strong>
                </div>

                ${fullscreen.lastError && !fullscreen.byManifest ? ui.html`
                    <div class="info-row"><span>${t('Отказ браузера')}</span><strong>${fullscreen.lastError}</strong></div>
                ` : ''}

                ${!fullscreen.byManifest && fullscreen.supported && !fullscreen.active ? ui.html`
                    <button class="btn btn-ghost btn-sm" data-action="fs-now">${t('Включить сейчас')}</button>
                ` : ''}

                <!--
                    Выход отдельной кнопкой, а не только выключателем выше.

                    Пока режим включён, любое касание возвращает его — иначе
                    он слетал бы от каждого системного окна. Значит, выйти
                    «на время» нельзя в принципе, и кнопка честно выключает
                    настройку. Без неё выход выглядел как «поищи, каким
                    переключателем это отменяется».
                -->
                ${!fullscreen.byManifest && fullscreen.active ? ui.html`
                    <button class="btn btn-ghost btn-sm" data-action="fs-off">${t('Выйти сейчас')}</button>
                    <p class="hint">${t('Выход выключает и саму настройку: пока она включена, режим возвращается от первого же касания.')}</p>
                ` : ''}

                <!--
                    Установленному приложению режим отображения достался в
                    момент установки, и поменять его на месте нечем: это
                    решение системы, а не страницы. Сказать об этом надо
                    прямо — иначе выключатель выше выглядит сломанным.
                -->
                ${!fullscreen.byManifest && install.installed ? ui.html`
                    <p class="hint">
                        ${t('Приложение установлено в оконном режиме — системная полоса снизу остаётся. Чтобы она пропала совсем, удали значок с домашнего экрана и добавь заново: во весь экран приложение разворачивается при установке.')}
                    </p>
                ` : ''}
            </div>

            <div class="card">
                <div class="card-title">${t('Отдых и сигналы')}</div>

                ${ui.raw(toggle('restEnabled', t('Таймер отдыха'), t('Запускается после записи подхода')))}

                <!--
                    Поле рядом с ползунком, а не вместо него.

                    Ползунком удобно подбирать на слух — подвинул и слышишь,
                    сколько получилось; полем удобно задать то, что уже
                    знаешь. Ползунок один этого не давал: он кончался на пяти
                    минутах, а тем, кто тянет тяжёлое, нужно больше, и
                    добирать пришлось бы кнопкой «+30 с» посреди отдыха.
                -->
                <div class="field">
                    <label for="set-rest-exact">${t('Длительность отдыха')}</label>

                    <div class="rest-set">
                        <input type="number" id="set-rest-exact" class="rest-exact"
                               min="${String(restTimer.SHORTEST)}" max="${String(restTimer.LONGEST)}" step="5"
                               inputmode="numeric" value="${String(rest)}" data-change="rest-exact">
                        <span class="rest-unit">${t('с')}</span>
                        <strong id="rest-value">${format.seconds(rest)}</strong>
                    </div>

                    <input type="range" id="set-rest"
                           min="${String(Math.min(SLIDER_MIN, rest))}" max="${String(restCeiling(rest))}" step="15"
                           value="${rest}" data-change="setting" data-key="restSeconds">
                </div>

                ${ui.raw(toggle('restSound', t('Звук по окончании'), t('Он же управляет сигналами интервальной программы')))}
                ${ui.raw(toggle('restVibration', t('Вибрация по окончании')))}

                <!--
                    Выключатель показывается только там, где есть чем
                    говорить: обещать голос браузеру без синтеза значит
                    предложить настройку, которая ничего не делает.
                -->
                ${voice.available ? ui.raw(toggle(
                    'voiceNames',
                    t('Проговаривать упражнения'),
                    t('В интервальной программе — название следующего вслух')
                )) : ''}
            </div>

            <div class="card">
                <div class="card-title">${t('Данные')}</div>

                <div class="info-row"><span>${t('Упражнений')}</span><strong>${counts.exercises}${counts.archived ? ` (${t('{сколько} в архиве', { сколько: counts.archived })})` : ''}</strong></div>
                <div class="info-row"><span>${t('Тренировок')}</span><strong>${counts.workouts}</strong></div>
                <div class="info-row"><span>${t('Подходов')}</span><strong>${counts.sets}</strong></div>
                <div class="info-row"><span>${t('Шаблонов')}</span><strong>${counts.templates}</strong></div>
                ${imported ? ui.html`
                    <div class="info-row">
                        <span>${t('Перенесено из версии 1')}</span>
                        <strong>${t('{т} трен. / {п} подх.', { т: imported.workouts, п: imported.sets })}</strong>
                    </div>
                ` : ''}

                <button class="btn btn-ghost" data-action="nav" data-screen="exercises">
                    ${t('Справочник упражнений')}
                </button>
            </div>

            <div class="card">
                <div class="card-title">${t('Синхронизация')}</div>
                ${syncBlock()}
            </div>

            <div class="card">
                <div class="card-title">${t('Резервная копия')}</div>
                <p class="hint">
                    ${t('Файл на диске не зависит от облака и учётной записи — это копия, которая целиком в твоих руках.')}
                </p>
                <button class="btn btn-ghost" data-action="backup-save">${t('Выгрузить в файл')}</button>
                <button class="btn btn-ghost" data-action="backup-load">${t('Загрузить из файла')}</button>
                <input type="file" id="backup-file" accept="application/json,.json" hidden>
            </div>

            <div class="card">
                <div class="card-title">${t('Установка')}</div>
                ${ui.raw(installBlock())}
            </div>

            <div class="card">
                <div class="card-title">${t('О приложении')}</div>
                <div class="info-row"><span>${t('Версия')}</span><strong>${VERSION}</strong></div>
                <div class="info-row"><span>${t('Хранилище')}</span><strong>IndexedDB + localStorage</strong></div>
                <button class="btn btn-ghost" data-action="nav" data-screen="survey">
                    ${t('Оставить отзыв')}
                </button>
                <button class="btn btn-ghost" data-action="check-update">${t('Проверить обновление')}</button>
                <button class="btn btn-danger" data-action="reset-settings">${t('Сбросить настройки')}</button>
            </div>
        `;
    }
};

// ================== ДЕЙСТВИЯ ==================

actions.onChange('setting', (el) => {
    const key = el.dataset.key;
    const value = el.type === 'checkbox'
        ? el.checked
        : el.type === 'range' || el.type === 'number'
            ? Number(el.value)
            : el.value;

    config.set(key, value);

    // Ползунок отдыха подписан значением и продублирован полем — обновляем
    // на месте, перерисовывать весь экран ради одной цифры незачем
    if (key === 'restSeconds') showRest(value);

    // Полный экран применяется сразу: иначе проверить, помогло ли, можно
    // только начав тренировку, а нажатие на переключатель — как раз то
    // действие пользователя, без которого браузер в полный экран не пустит
    if (key === 'fullscreen') {
        if (value) fullscreen.enter();
        else fullscreen.exit();
    }
});

// ================== СИНХРОНИЗАЦИЯ ==================

/** Ход обмена показывается на месте, без перерисовки всего экрана. */
function status(text) {
    const el = document.getElementById('sync-status');
    if (el) el.textContent = text;
}

actions.on('sync-in', async () => {
    try {
        status(t('Открывается окно входа…'));
        const user = await auth.signIn();

        if (!user) return status('');

        // Признак «облако включено» — по нему приложение решает поднимать
        // SDK при следующих запусках и синхронизировать без напоминаний
        config.set('syncEnabled', true);

        status(t('Первый обмен…'));
        await sync.run({ silent: true });
    } catch (e) {
        await dialog.alert({ title: t('Не удалось войти'), text: e.message });
    }

    app.render();
});

actions.on('sync-now', async () => {
    const off = sync.onStatus((s) => status(s.message));
    const result = await sync.run();
    off();

    if (result.error) {
        await dialog.alert({ title: t('Обмен не прошёл'), text: result.error });
    }

    app.render();
});

actions.on('sync-full', async () => {
    const ok = await dialog.confirm({
        title: t('Обменяться заново?'),
        text: t('Приложение пройдёт по всей истории, а не по изменениям. Данные не потеряются — просто дольше и дороже по операциям.'),
        confirmText: t('Обменяться')
    });

    if (!ok) return;

    sync.reset();
    await sync.run();
    app.render();
});

actions.on('sync-out', async () => {
    const ok = await dialog.confirm({
        title: t('Выйти из учётной записи?'),
        text: t('Локальные данные останутся на месте — отключится только обмен с облаком.'),
        confirmText: t('Выйти')
    });

    if (!ok) return;

    await auth.signOut();
    config.set('syncEnabled', false);
    app.render();
});

// ================== РЕЗЕРВНАЯ КОПИЯ ==================

actions.on('backup-save', async () => {
    try {
        const payload = await backup.download();

        await dialog.alert({
            title: t('Копия выгружена'),
            text: t('{файл} — тренировки, упражнения, шаблоны и вес тела.', { файл: backup.fileName(payload.exportedAt) })
        });
    } catch (e) {
        await dialog.alert({ title: t('Не удалось выгрузить'), text: e.message });
    }
});

actions.on('backup-load', () => document.getElementById('backup-file')?.click());

document.addEventListener('change', async (e) => {
    if (e.target.id !== 'backup-file') return;

    const file = e.target.files?.[0];
    e.target.value = '';           // тот же файл можно выбрать повторно
    if (!file) return;

    let payload;

    try {
        payload = backup.parse(await file.text());
    } catch (error) {
        return dialog.alert({ title: t('Файл не подходит'), text: error.message });
    }

    // Выгрузка версии 1 всегда добавляется к текущим данным: заменять ими
    // всё бессмысленно, там нет ни шаблонов, ни веса тела
    if (payload.kind === 'v1') {
        const ok = await dialog.confirm({
            title: t('Загрузить историю прошлой версии?'),
            text: t('В файле — {состав}. Уже загруженные тренировки повторно не добавятся.', { состав: backup.describe(payload) }),
            confirmText: t('Загрузить')
        });

        if (!ok) return;

        try {
            const result = await backup.restoreV1(payload.v1);

            await dialog.alert({
                title: t('Готово'),
                text: [
                    t('Добавлено тренировок: {сколько}.', { сколько: result.workouts }),
                    result.skipped ? t('Уже были: {сколько}.', { сколько: result.skipped }) : '',
                    result.unreadable ? t('Не разобрано: {сколько}.', { сколько: result.unreadable }) : ''
                ].filter(Boolean).join(' ')
            });
        } catch (error) {
            await dialog.alert({ title: t('Не удалось загрузить'), text: error.message });
        }

        return app.render();
    }

    const mode = await dialog.choose({
        title: t('Как загрузить?'),
        text: t('В файле — {состав}.', { состав: backup.describe(payload) }),
        options: [
            { value: 'merge', label: t('Объединить'), hint: t('Побеждает более свежая запись') },
            { value: 'replace', label: t('Заменить всё'), hint: t('Текущие данные будут стёрты'), danger: true }
        ]
    });

    if (!mode) return;

    if (mode === 'replace') {
        const ok = await dialog.confirm({
            title: t('Стереть текущие данные?'),
            text: t('Вся история в этом браузере будет заменена содержимым файла.'),
            confirmText: t('Заменить'),
            danger: true
        });

        if (!ok) return;
    }

    try {
        await backup.restore(payload, { mode });
        await dialog.alert({ title: t('Готово'), text: t('Данные загружены.') });
    } catch (error) {
        await dialog.alert({ title: t('Не удалось загрузить'), text: error.message });
    }

    app.render();
});

/**
 * Проверка обновления вручную (§42).
 *
 * Установленное приложение страницу не перезагружает и потому само сверяет
 * версию только при возвращении к нему. Кнопка нужна для случая, когда
 * обновление ждут прямо сейчас и хотят знать наверняка.
 */
/**
 * Включить полный экран прямо сейчас.
 *
 * Нажатие — бесспорное действие пользователя, а значит и самый честный
 * способ узнать, отказывает ли браузер вообще. Если отказал, показываем
 * его собственные слова: «не работает» без причины чинить нельзя.
 */
/**
 * Смена языка (§53).
 *
 * Перерисовкой всего экрана, а не одной подписи: язык меняет всё сразу —
 * меню, заголовки, разделитель дробной части, названия месяцев.
 */
actions.on('lang-pick', async () => {
    const chosen = await dialog.choose({
        title: t('Язык'),
        options: i18n.LANGS.map((l) => ({
            value: l.value,

            /*
             * Название языка — на нём самом, и без перевода.
             *
             * Тот, кто ищет свой язык, ищет знакомое слово: «Deutsch», а не
             * «немецкий». Исключение — «как в телефоне»: это не язык, а
             * правило, и его надо понимать на том языке, который сейчас
             * перед глазами.
             */
            label: l.value === 'auto' ? t(l.label) : l.label,
            hint: l.value === i18n.setting ? t('выбран сейчас') : null
        }))
    });

    if (!chosen) return;

    i18n.set(chosen);
    app.render();
});

actions.on('fs-now', async () => {
    if (!config.get('fullscreen')) config.set('fullscreen', true);

    const ok = await fullscreen.enter();

    if (!ok) {
        await dialog.alert({
            title: t('Браузер отказал'),
            text: `${fullscreen.lastError || t('Причина неизвестна.')}\n\n${t('Полноэкранный режим есть не везде: в установленном приложении его может запрещать система, а на iPhone его нет вовсе.')}`
        });
    }

    app.render();
});

/**
 * Отдых, вписанный руками.
 *
 * Экран перерисовывается, потому что от значения зависит длина ползунка:
 * вписанное больше десяти минут он должен доставать. Перерисовка здесь
 * безопасна — событие change приходит по уходу из поля, а не на каждой цифре.
 */
actions.onChange('rest-exact', (el) => {
    const seconds = restTimer.clamp(el.value);

    // Пустое поле и мусор возвращают то, что было: молча поставить ноль
    // значит выключить отдых, о чём никто не просил
    if (seconds === null) {
        showRest(config.get('restSeconds'));
        return;
    }

    config.set('restSeconds', seconds);
    app.render();
});

actions.on('fs-off', async () => {
    config.set('fullscreen', false);
    await fullscreen.exit();

    app.render();
});

actions.on('check-update', async () => {
    if (!updater.available) {
        return dialog.alert({
            title: t('Проверить нечем'),
            text: t('Приложение открыто без сервис-воркера. Обновление придёт при обычной перезагрузке страницы.')
        });
    }

    const found = await updater.check({ force: true });

    // Найденная версия ставится сама и перезагружает приложение, так что
    // это сообщение пользователь чаще всего увидеть не успеет
    await dialog.alert(found
        ? { title: t('Найдена новая версия'), text: t('Она уже ставится — приложение перезагрузится само.') }
        : { title: t('Установлена последняя версия'), text: t('Версия {номер}.', { номер: VERSION }) });
});

actions.on('reset-settings', async () => {
    const ok = await dialog.confirm({
        title: t('Сбросить настройки?'),
        text: t('История тренировок останется на месте — сбросятся только настройки приложения.'),
        confirmText: t('Сбросить'),
        danger: true
    });

    if (!ok) return;

    config.reset();
    app.render();
});
