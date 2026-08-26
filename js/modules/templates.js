/**
 * Шаблоны тренировок (§8 ТЗ).
 *
 * Шаблон — сохранённый план, который запускается повторно. Своего редактора
 * у него нет: правится он тем же экраном, что и обычный план (#/plan/template/<id>),
 * потому что это одно и то же — список упражнений с подходами.
 *
 * При запуске план копируется внутрь тренировки (§4), поэтому изменение
 * шаблона задним числом не трогает уже проведённые тренировки.
 */

import { ui } from '../core/ui.js';
import { actions } from '../core/actions.js';
import { dialog } from '../core/dialog.js';
import { dbService } from '../services/db.js';
import { format } from '../core/format.js';
import { app } from '../app.js';

function card(template, names) {
    const list = template.items
        .map((item) => names[item.exerciseId] || 'упражнение')
        .join(', ');

    const totalSets = template.items.reduce((sum, i) => sum + (i.plannedSets || 0), 0);

    return ui.html`
        <div class="card">
            <div class="tpl-head">
                <div>
                    <div class="tpl-name">${template.name}</div>
                    <div class="tpl-meta">
                        ${template.type} · ${format.count(template.items.length, format.WORDS.exercise)}
                        · ${format.count(totalSets, format.WORDS.set)}
                    </div>
                </div>
            </div>

            <p class="tpl-list">${list || 'Пусто'}</p>

            <button class="btn btn-accent" data-action="tpl-start" data-id="${template.id}">Начать</button>

            <div class="sess-tools">
                <button class="btn btn-ghost btn-sm" data-action="tpl-edit" data-id="${template.id}">Изменить</button>
                <button class="btn btn-ghost btn-sm" data-action="tpl-copy" data-id="${template.id}">Дублировать</button>
                <button class="btn btn-danger btn-sm" data-action="tpl-delete" data-id="${template.id}">Удалить</button>
            </div>
        </div>
    `;
}

export const templates = {

    title: 'Шаблоны',
    nav: 'workout',

    async render() {
        const [list, exercises] = await Promise.all([
            dbService.listTemplates(),
            dbService.listExercises({ includeArchived: true })
        ]);

        const names = Object.fromEntries(exercises.map((e) => [e.id, e.name]));

        return ui.html`
            ${ui.title('Шаблоны', 'Сохранённая тренировка, которую можно запускать сколько угодно раз')}

            ${list.length
                ? list.map((t) => card(t, names))
                : ui.empty('Шаблонов пока нет. Их можно создать здесь или сохранить из проведённой тренировки в её итогах.')}

            <button class="btn btn-ghost" data-action="tpl-new">+ Создать шаблон</button>
            <button class="btn btn-ghost" data-action="nav" data-screen="home">← На главную</button>
        `;
    }
};

// ================== ДЕЙСТВИЯ ==================

actions.on('tpl-new', async () => {
    const values = await dialog.form({
        title: 'Новый шаблон',
        fields: [{ name: 'name', label: 'Название', required: true, placeholder: 'Грудь + трицепс' }],
        confirmText: 'Создать'
    });

    if (!values) return;

    const template = await dbService.saveTemplate({ name: values.name, items: [] });
    app.go('plan', 'template', template.id);
});

actions.on('tpl-edit', (el) => app.go('plan', 'template', el.dataset.id));
actions.on('tpl-start', (el) => app.go('plan', 'from', el.dataset.id));

actions.on('tpl-copy', async (el) => {
    const source = await dbService.getTemplate(el.dataset.id);
    if (!source) return;

    await dbService.saveTemplate({
        name: `${source.name} (копия)`,
        type: source.type,
        items: source.items
    });

    app.render();
});

actions.on('tpl-delete', async (el) => {
    const template = await dbService.getTemplate(el.dataset.id);
    if (!template) return;

    const ok = await dialog.confirm({
        title: `Удалить «${template.name}»?`,
        text: 'Проведённые по нему тренировки останутся в истории — план хранится внутри каждой из них.',
        confirmText: 'Удалить',
        danger: true
    });

    if (!ok) return;

    await dbService.deleteTemplate(template.id);
    app.render();
});
