/**
 * Проверка обновлений (§42 ТЗ).
 *
 * Дефект, ради которого это написано: установленное на телефон приложение
 * страницу не перезагружает, поэтому браузер не сверяет сервис-воркер и новая
 * версия не приходит неделями. Проверка при возвращении к приложению это
 * закрывает — но только если действительно вызывается и не дёргает сеть на
 * каждое переключение вкладки.
 *
 * Настоящей регистрации здесь нет: подменяем её объектом с тем же обликом.
 */

import { describe, it, equal, assert } from '../runner.js';
import { updater } from '../../js/core/updater.js';

/** Подделка ServiceWorkerRegistration: считает вызовы и умеет «находить» новую версию. */
function fakeRegistration({ found = false } = {}) {
    return {
        calls: 0,
        installing: null,
        waiting: null,
        async update() {
            this.calls += 1;
            if (found) this.installing = { state: 'installing' };
        }
    };
}

describe('Проверка обновлений', () => {

    it('без воркера проверять нечего', async () => {
        updater.use(null);

        equal(updater.available, false);
        equal(await updater.check({ force: true }), null);
    });

    it('новая версия находится', async () => {
        const reg = fakeRegistration({ found: true });
        updater.use(reg);

        equal(await updater.check({ force: true }), true);
        equal(reg.calls, 1);
    });

    it('без новой версии отвечает «последняя», а не молчит', async () => {
        const reg = fakeRegistration();
        updater.use(reg);

        equal(await updater.check({ force: true }), false, 'ложь тут хуже молчания: кнопка обязана ответить');
    });

    it('уже установленная новая версия тоже считается найденной', async () => {
        const reg = fakeRegistration();
        reg.waiting = { state: 'installed' };
        updater.use(reg);

        equal(await updater.check({ force: true }), true);
    });

    /*
     * Переключение между приложениями на телефоне происходит десятки раз за
     * тренировку. Проверять сеть на каждое — заметный расход на мобильной
     * связи, и ради ничего: чаще раза в четверть часа выпусков не бывает.
     */
    it('частые возвращения не дёргают сеть', async () => {
        const reg = fakeRegistration();
        updater.use(reg);

        await updater.check({ force: true });
        const после = await updater.check();

        equal(после, null, 'вторая проверка подряд не делается');
        equal(reg.calls, 1, 'запрос ушёл один раз');
    });

    it('принудительная проверка промежуток не соблюдает', async () => {
        const reg = fakeRegistration();
        updater.use(reg);

        await updater.check({ force: true });
        await updater.check({ force: true });

        equal(reg.calls, 2, 'кнопку нажали — значит ответ нужен сейчас');
    });

    it('промежуток между самостоятельными проверками — четверть часа', () => {
        assert(updater.INTERVAL >= 5 * 60 * 1000, 'слишком часто — это расход трафика впустую');
        assert(updater.INTERVAL <= 60 * 60 * 1000, 'слишком редко — обновление снова будет приходить с опозданием');
    });
});
