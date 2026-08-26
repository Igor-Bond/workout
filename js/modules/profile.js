/**
 * Профиль и настройки (§28 ТЗ).
 *
 * Единственный раздел, который на этапе 1 работает целиком: настройки живут
 * в localStorage и базы не требуют. Синхронизация и резервная копия появятся
 * на этапе 8.
 */

import { ui } from '../core/ui.js';
import { config } from '../config.js';
import { install } from '../core/install.js';
import { format } from '../core/format.js';
import { VERSION } from '../version.js';
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
    return ui.empty('В Safari установка делается вручную: «Поделиться» → «На экран Домой».');
}

export const profile = {

    title: 'Профиль',
    nav: 'profile',

    render() {
        const rest = config.get('restSeconds');
        const mode = config.get('mode');

        return ui.html`
            ${ui.raw(ui.title('Профиль'))}

            <div class="card">
                <div class="card-title">Тренировка</div>

                <div class="field">
                    <label for="set-mode">Режим по умолчанию</label>
                    <select id="set-mode" data-change="setting" data-key="mode">
                        <option value="plan" ${ui.raw(mode === 'plan' ? 'selected' : '')}>По плану</option>
                        <option value="free" ${ui.raw(mode === 'free' ? 'selected' : '')}>Свободный</option>
                    </select>
                    <div class="hint">По плану приложение само предлагает следующий подход. В свободном упражнение выбираешь сам.</div>
                </div>

                ${ui.raw(toggle('keepAwake', 'Не гасить экран', 'Во время тренировки. На iPhone работает не всегда.'))}
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

            <div class="card">
                <div class="card-title">Данные</div>
                ${ui.raw(ui.stub(
                    'Синхронизация и резервная копия',
                    8,
                    'Вход через Google, обмен с Firestore и выгрузка всех данных одним файлом.'
                ))}
            </div>

            <div class="card">
                <div class="card-title">Установка</div>
                ${ui.raw(installBlock())}
            </div>

            <div class="card">
                <div class="card-title">О приложении</div>
                <div class="info-row"><span>Версия</span><strong>${VERSION}</strong></div>
                <div class="info-row"><span>Хранилище</span><strong>localStorage</strong></div>
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
