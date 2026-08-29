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
import { beeper } from '../core/beeper.js';
import { format } from '../core/format.js';
import { VERSION } from '../version.js';
import { dbService } from '../services/db.js';
import { auth } from '../services/auth.js';
import { sync } from '../services/sync.js';
import { backup } from '../services/backup.js';
import { dates } from '../core/dates.js';
import { app } from '../app.js';
import { actions } from '../core/actions.js';
import { dialog } from '../core/dialog.js';

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
            ${ui.empty('Не настроена. Приложение работает локально: тренировки, история и статистика на месте, просто не переносятся между устройствами.')}
            <p class="hint">Чтобы включить — заполнить <code>js/firebase.config.js</code>. Порядок в <code>docs/DEPLOY.md</code>.</p>
        `;
    }

    if (!auth.isSignedIn) {
        return ui.html`
            ${ui.empty('Вход не выполнен. Локальные данные при входе не стираются — они объединятся с облачными.')}
            <button class="btn btn-accent" data-action="sync-in">Войти через Google</button>
        `;
    }

    const last = sync.getLastSync();

    return ui.html`
        <div class="info-row"><span>Учётная запись</span><strong>${auth.user?.email || 'вход выполнен'}</strong></div>
        <div class="info-row">
            <span>Последний обмен</span>
            <strong>${last ? dates.formatDateTime(last) : 'ещё не было'}</strong>
        </div>

        <div id="sync-status" class="sync-status"></div>

        <button class="btn btn-accent" data-action="sync-now">Синхронизировать</button>
        <button class="btn btn-ghost" data-action="sync-full">Полный обмен заново</button>
        <button class="btn btn-ghost" data-action="sync-out">Выйти</button>
        <p class="hint">Выход не удаляет локальные данные. Незавершённая тренировка в облако не уезжает — она живёт только на этом устройстве.</p>
    `;
}

function installBlock() {
    if (install.installed) {
        return ui.empty('Приложение уже установлено.');
    }
    if (install.available) {
        return ui.html`<button class="btn btn-accent" data-action="install">Установить приложение</button>`;
    }
    if (install.supported) {
        return ui.empty('Браузер пока не предложил установку. Она станет доступна после нескольких заходов.');
    }
    return ui.empty('Установка делается вручную: «Поделиться» → «На экран Домой».');
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
            ${ui.raw(ui.title('Профиль'))}

            <div class="card">
                <div class="card-title">Тренировка</div>

                <div class="field">
                    <label for="set-mode">Порядок упражнений</label>
                    <select id="set-mode" data-change="setting" data-key="mode">
                        ${MODES.map((m) => ui.html`
                            <option value="${m.value}" ${ui.raw(mode === m.value ? 'selected' : '')}>${m.label}</option>
                        `)}
                    </select>
                    <div class="hint">${MODES.find((m) => m.value === mode)?.hint || ''}</div>
                </div>

                ${ui.raw(toggle('keepAwake', 'Не гасить экран', 'Во время тренировки'))}

                ${fullscreen.supported ? ui.raw(toggle(
                    'fullscreen',
                    'Полноэкранный режим',
                    'Скрывает системные панели'
                )) : ''}
            </div>

            <div class="card">
                <div class="card-title">Отдых</div>

                ${ui.raw(toggle('restEnabled', 'Таймер отдыха', 'Запускается после записи подхода'))}

                <div class="field">
                    <label for="set-rest">Длительность отдыха: <strong id="rest-value">${format.seconds(rest)}</strong></label>
                    <input type="range" id="set-rest" min="15" max="300" step="15"
                           value="${rest}" data-change="setting" data-key="restSeconds">
                </div>

                ${ui.raw(toggle('restSound', 'Звук по окончании'))}
                ${ui.raw(toggle('restVibration', 'Вибрация по окончании'))}
            </div>

            <!--
                Сигналы интервальной программы слышны только во время
                программы, а узнать, что означает каждый, хочется заранее:
                посреди бёрпи разбираться поздно.
            -->
            <div class="card">
                <div class="card-title">Сигналы табаты</div>

                <div class="info-row"><span>Отсчёт три-два-один</span>
                    <button class="chip" data-action="try-sound" data-sound="count">Послушать</button></div>
                <div class="info-row"><span>Начало работы — взлёт</span>
                    <button class="chip" data-action="try-sound" data-sound="go">Послушать</button></div>
                <div class="info-row"><span>Конец работы — вниз</span>
                    <button class="chip" data-action="try-sound" data-sound="rest">Послушать</button></div>
                <div class="info-row"><span>Конец круга</span>
                    <button class="chip" data-action="try-sound" data-sound="round">Послушать</button></div>
                <div class="info-row"><span>Конец программы — четыре ноты</span>
                    <button class="chip" data-action="try-sound" data-sound="done">Послушать</button></div>

                <p class="hint">
                    Громкость приложение не задаёт — она общая для устройства.
                    Если тихо, проверь громкость мультимедиа, а не звонка.
                </p>
            </div>

            <div class="card">
                <div class="card-title">Данные</div>

                <div class="info-row"><span>Упражнений</span><strong>${counts.exercises}${counts.archived ? ` (${counts.archived} в архиве)` : ''}</strong></div>
                <div class="info-row"><span>Тренировок</span><strong>${counts.workouts}</strong></div>
                <div class="info-row"><span>Подходов</span><strong>${counts.sets}</strong></div>
                <div class="info-row"><span>Шаблонов</span><strong>${counts.templates}</strong></div>
                ${imported ? ui.html`
                    <div class="info-row">
                        <span>Перенесено из версии 1</span>
                        <strong>${imported.workouts} трен. / ${imported.sets} подх.</strong>
                    </div>
                ` : ''}

                <button class="btn btn-ghost" data-action="nav" data-screen="exercises">
                    Справочник упражнений
                </button>
            </div>

            <div class="card">
                <div class="card-title">Синхронизация</div>
                ${syncBlock()}
            </div>

            <div class="card">
                <div class="card-title">Резервная копия</div>
                <p class="hint">
                    Файл на диске не зависит от облака и учётной записи — это копия,
                    которая целиком в твоих руках.
                </p>
                <button class="btn btn-ghost" data-action="backup-save">Выгрузить в файл</button>
                <button class="btn btn-ghost" data-action="backup-load">Загрузить из файла</button>
                <input type="file" id="backup-file" accept="application/json,.json" hidden>
            </div>

            <div class="card">
                <div class="card-title">Установка</div>
                ${ui.raw(installBlock())}
            </div>

            <div class="card">
                <div class="card-title">О приложении</div>
                <div class="info-row"><span>Версия</span><strong>${VERSION}</strong></div>
                <div class="info-row"><span>Хранилище</span><strong>IndexedDB + localStorage</strong></div>
                <button class="btn btn-ghost" data-action="check-update">Проверить обновление</button>
                <button class="btn btn-danger" data-action="reset-settings">Сбросить настройки</button>
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

    // Ползунок отдыха подписан значением — обновляем на месте,
    // перерисовывать весь экран ради одной цифры незачем
    if (key === 'restSeconds') {
        const label = document.getElementById('rest-value');
        if (label) label.textContent = format.seconds(value);
    }

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
        status('Открывается окно входа…');
        const user = await auth.signIn();

        if (!user) return status('');

        // Признак «облако включено» — по нему приложение решает поднимать
        // SDK при следующих запусках и синхронизировать без напоминаний
        config.set('syncEnabled', true);

        status('Первый обмен…');
        await sync.run({ silent: true });
    } catch (e) {
        await dialog.alert({ title: 'Не удалось войти', text: e.message });
    }

    app.render();
});

actions.on('sync-now', async () => {
    const off = sync.onStatus((s) => status(s.message));
    const result = await sync.run();
    off();

    if (result.error) {
        await dialog.alert({ title: 'Обмен не прошёл', text: result.error });
    }

    app.render();
});

actions.on('sync-full', async () => {
    const ok = await dialog.confirm({
        title: 'Обменяться заново?',
        text: 'Приложение пройдёт по всей истории, а не по изменениям. Данные не потеряются — просто дольше и дороже по операциям.',
        confirmText: 'Обменяться'
    });

    if (!ok) return;

    sync.reset();
    await sync.run();
    app.render();
});

actions.on('sync-out', async () => {
    const ok = await dialog.confirm({
        title: 'Выйти из учётной записи?',
        text: 'Локальные данные останутся на месте — отключится только обмен с облаком.',
        confirmText: 'Выйти'
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
            title: 'Копия выгружена',
            text: `${backup.fileName(payload.exportedAt)} — тренировки, упражнения, шаблоны и вес тела.`
        });
    } catch (e) {
        await dialog.alert({ title: 'Не удалось выгрузить', text: e.message });
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
        return dialog.alert({ title: 'Файл не подходит', text: error.message });
    }

    // Выгрузка версии 1 всегда добавляется к текущим данным: заменять ими
    // всё бессмысленно, там нет ни шаблонов, ни веса тела
    if (payload.kind === 'v1') {
        const ok = await dialog.confirm({
            title: 'Загрузить историю прошлой версии?',
            text: `В файле — ${backup.describe(payload)}. Уже загруженные тренировки повторно не добавятся.`,
            confirmText: 'Загрузить'
        });

        if (!ok) return;

        try {
            const result = await backup.restoreV1(payload.v1);

            await dialog.alert({
                title: 'Готово',
                text: [
                    `Добавлено тренировок: ${result.workouts}.`,
                    result.skipped ? `Уже были: ${result.skipped}.` : '',
                    result.unreadable ? `Не разобрано: ${result.unreadable}.` : ''
                ].filter(Boolean).join(' ')
            });
        } catch (error) {
            await dialog.alert({ title: 'Не удалось загрузить', text: error.message });
        }

        return app.render();
    }

    const mode = await dialog.choose({
        title: 'Как загрузить?',
        text: `В файле — ${backup.describe(payload)}.`,
        options: [
            { value: 'merge', label: 'Объединить', hint: 'Побеждает более свежая запись' },
            { value: 'replace', label: 'Заменить всё', hint: 'Текущие данные будут стёрты', danger: true }
        ]
    });

    if (!mode) return;

    if (mode === 'replace') {
        const ok = await dialog.confirm({
            title: 'Стереть текущие данные?',
            text: 'Вся история в этом браузере будет заменена содержимым файла.',
            confirmText: 'Заменить',
            danger: true
        });

        if (!ok) return;
    }

    try {
        await backup.restore(payload, { mode });
        await dialog.alert({ title: 'Готово', text: 'Данные загружены.' });
    } catch (error) {
        await dialog.alert({ title: 'Не удалось загрузить', text: error.message });
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
actions.on('try-sound', (el) => {
    beeper.play(el.dataset.sound);
});

actions.on('check-update', async () => {
    if (!updater.available) {
        return dialog.alert({
            title: 'Проверить нечем',
            text: 'Приложение открыто без сервис-воркера. Обновление придёт при обычной перезагрузке страницы.'
        });
    }

    const found = await updater.check({ force: true });

    // Найденная версия ставится сама и перезагружает приложение, так что
    // это сообщение пользователь чаще всего увидеть не успеет
    await dialog.alert(found
        ? { title: 'Найдена новая версия', text: 'Она уже ставится — приложение перезагрузится само.' }
        : { title: 'Установлена последняя версия', text: `Версия ${VERSION}.` });
});

actions.on('reset-settings', async () => {
    const ok = await dialog.confirm({
        title: 'Сбросить настройки?',
        text: 'История тренировок останется на месте — сбросятся только настройки приложения.',
        confirmText: 'Сбросить',
        danger: true
    });

    if (!ok) return;

    config.reset();
    app.render();
});
