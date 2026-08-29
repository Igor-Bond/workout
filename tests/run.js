/**
 * Запуск всех наборов проверок.
 *
 * Вынесено из index.html отдельным модулем не для красоты: страница обязана
 * снять сервис-воркер прежде, чем начнёт грузить хоть один модуль (см.
 * комментарий в index.html), а статический тег `<script type="module">`
 * начинает грузиться при разборе страницы, до того как успеет отработать
 * что бы то ни было. Отсюда динамический импорт этого файла.
 */

import { run } from './runner.js';
import { actions } from '../js/core/actions.js';

// Делегирование событий нужно поднять: проверки на него нажимают
// настоящие кнопки, а слушатели вешает именно init()
actions.init();

// Наборы регистрируют проверки самим фактом импорта
await import('./suites/i18n.test.js');
await import('./suites/actions.test.js');
await import('./suites/wakelock.test.js');
await import('./suites/updater.test.js');
await import('./suites/timer.test.js');
await import('./suites/interval.test.js');
await import('./suites/fullscreen.test.js');
await import('./suites/engine.test.js');
await import('./suites/records.test.js');
await import('./suites/rhythm.test.js');
await import('./suites/estimate.test.js');
await import('./suites/stats.test.js');
await import('./suites/merge.test.js');
await import('./suites/migrations.test.js');
await import('./suites/db.test.js');
await import('./suites/screens.test.js');
await import('./suites/kinds.test.js');
await import('./suites/docs.test.js');
await import('./suites/journal.test.js');
await import('./suites/guide.test.js');
await import('./suites/lang-coverage.test.js');
await import('./suites/lang-source.test.js');
await import('./suites/lang-dialogs.test.js');
await import('./suites/e2e.test.js');

/*
 * Проверки идут по-русски, каким бы ни был выбранный язык.
 *
 * Ожидаемые строки в них написаны по-русски, и после переключения
 * приложения на немецкий проваливалось разом полсотни проверок — не
 * потому, что что-то сломалось, а потому, что ответ пришёл на другом
 * языке. Настройка общая с приложением, поэтому её возвращаем на место.
 */
const { i18n } = await import('../js/core/i18n.js');
const выбранный = i18n.setting;
i18n.set('ru');

try {
    const summary = await run(document.getElementById('results'));

    /*
     * Итог кладётся в globalThis, а не только в консоль: снаружи браузера
     * проверки запускает CI, и ему нужно значение, а не строка в журнале.
     */
    globalThis.__RESULT__ = summary;
    console.log('[Проверки]', summary);
} finally {
    i18n.set(выбранный);
}
