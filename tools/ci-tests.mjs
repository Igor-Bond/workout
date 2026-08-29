/**
 * Запуск браузерных проверок снаружи браузера — для CI.
 *
 * Проверки живут на странице и по-другому жить не могут: половина из них
 * рисует настоящие экраны, ходит в IndexedDB и меряет то, что выходит из
 * звукового движка. Ни node, ни какой угодно заменитель DOM этого не даст.
 * Поэтому CI открывает ту же самую страницу настоящим браузером и читает
 * итог, который она кладёт в globalThis.
 *
 * Зависимость здесь только у CI, не у приложения: playwright ставится в
 * рабочем каталоге сборки и в репозиторий не попадает. Приложение остаётся
 * без сборки и без пакетов — тем и ценно.
 *
 * Запуск:  node tools/ci-tests.mjs [адрес]
 * Ответ:   0 — всё прошло, 1 — есть провалы или страница не ответила.
 */

import { chromium } from 'playwright';

const АДРЕС = process.argv[2] || 'http://127.0.0.1:4173/tests/index.html';

/** Сколько ждать итога. Полный прогон на слабом бегунке — около минуты. */
const СРОК = 300000;

const browser = await chromium.launch();

const page = await browser.newPage();
const ошибки = [];

page.on('pageerror', (e) => ошибки.push(`[страница] ${e.message}`));
page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().startsWith('[')) ошибки.push(`[консоль] ${m.text()}`);
});

let итог = null;

try {
    await page.goto(АДРЕС, { waitUntil: 'domcontentloaded' });

    // Страница может перезагрузиться один раз — она снимает сервис-воркер,
    // если тот управлял загрузкой. Ждём именно итога, а не события загрузки
    await page.waitForFunction(() => globalThis.__RESULT__, null, { timeout: СРОК });

    итог = await page.evaluate(() => globalThis.__RESULT__);

    if (итог.failed > 0) {
        const провалы = await page.evaluate(() => [...document.querySelectorAll('.test.fail')]
            .map((el) => el.textContent.replace(/\s+/g, ' ').trim()));

        console.error(`\nПровалено ${итог.failed} из ${итог.total}:\n`);
        for (const строка of провалы) console.error(`  ✗ ${строка}`);
    } else {
        console.log(`Прошло ${итог.passed} проверок.`);
    }
} catch (e) {
    console.error(`Проверки не дали ответа за ${СРОК / 1000} с: ${e.message}`);
} finally {
    await browser.close();
}

/*
 * Ошибки в консоли не валят сборку сами по себе: часть проверок нарочно
 * роняет обработчики и смотрит, что из этого выйдет. Но показать их надо —
 * по ним видно упавшее там, где проверки ничего не заметили.
 */
if (ошибки.length) {
    console.error(`\nОшибки на странице (${ошибки.length}), проверки их не считают:`);
    for (const строка of [...new Set(ошибки)].slice(0, 20)) console.error(`  ${строка}`);
}

process.exit(итог && итог.failed === 0 ? 0 : 1);
