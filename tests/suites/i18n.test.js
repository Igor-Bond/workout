/**
 * Второй язык (§53 ТЗ).
 *
 * Проверяется не перевод — он меняется каждый день, — а то, из-за чего
 * приложение врёт молча: выбор языка, откат к русскому при недостающем
 * переводе, склонение и числа. Ошибка здесь не падает, а показывает
 * неправильное, и заметить её можно только глазами.
 */

import { describe, it, equal, assert } from '../runner.js';
import { screen } from '../helpers/dom.js';
import { profile } from '../../js/modules/profile.js';
import { i18n, t } from '../../js/core/i18n.js';
import { format } from '../../js/core/format.js';
import { dates } from '../../js/core/dates.js';
import { config } from '../../js/config.js';

/** Переключить язык на время проверки и вернуть как было. */
function withLang(lang, body) {
    const было = config.get('lang');

    try {
        i18n.set(lang);
        return body();
    } finally {
        i18n.set(было);
    }
}

describe('Выбор языка', () => {

    it('настройка переключает язык', () => {
        withLang('en', () => equal(i18n.lang, 'en'));
        withLang('ru', () => equal(i18n.lang, 'ru'));
    });

    /*
     * «Как в телефоне» — значение по умолчанию: приложение, отданное за
     * пределы русскоязычных стран, должно оказываться английским само.
     *
     * Пока перевод не полон (i18n.ready), это правило выключено: отдать
     * человеку половину языка хуже, чем не отдать вовсе. Проверка написана
     * так, чтобы остаться верной по обе стороны от этого переключателя, —
     * иначе её пришлось бы переписывать в тот самый момент, когда она
     * нужнее всего.
     */
    it('«как в телефоне» смотрит на язык браузера, когда перевод готов', () => {
        const было = config.get('lang');
        const real = Object.getOwnPropertyDescriptor(Navigator.prototype, 'language');

        const язык = (value) => Object.defineProperty(navigator, 'language', {
            configurable: true, get: () => value
        });

        try {
            i18n.set('auto');

            язык('ru-RU'); equal(i18n.apply(), 'ru');
            язык('uk-UA'); equal(i18n.apply(), 'ru', 'украинский ближе к русскому, чем к английскому');

            язык('en-GB');
            equal(i18n.apply(), i18n.ready ? 'en' : 'ru');

            язык('fa-AF');
            equal(i18n.apply(), i18n.ready ? 'en' : 'ru', 'дари пока нет — английский ближе, чем русский');
        } finally {
            delete navigator.language;
            if (real) Object.defineProperty(Navigator.prototype, 'language', real);

            config.set('lang', было);
            i18n.apply();
        }
    });

    /*
     * Незаконченный перевод не должен доставаться людям случайно: пока
     * i18n.ready ложно, выбор языка в профиле не показывается вовсе.
     */
    it('недоделанный перевод не предлагается', async () => {
        const view = await screen(profile);
        const выбор = view.querySelector('[data-action="lang-pick"]');

        if (i18n.ready) {
            assert(!!выбор, 'готовый перевод обязан быть доступен');
        } else {
            assert(!выбор, 'половина языка хуже, чем его отсутствие');
        }
    });

    /*
     * Список языков открывается своим окном, а не системным <select>: тот
     * выглядит чужим и на Android рисуется поверх приложения белым по
     * светлому. Окно выбора в приложении одно и то же везде.
     */
    it('языки предлагаются окном приложения, а не списком браузера', async () => {
        const view = await screen(profile);

        assert(!view.querySelector('select#set-lang'), 'системный список здесь не к месту');
        assert(!!view.querySelector('[data-action="lang-pick"]'));
    });

    it('русский обходится без словаря', () => {
        withLang('ru', () => equal(t('Новая тренировка'), 'Новая тренировка'));
    });

    it('английский берётся из словаря', () => {
        withLang('en', () => equal(t('Новая тренировка'), 'New workout'));
    });

    /*
     * Недостающий перевод показывает русскую строку. Показать человеку
     * чужой язык плохо, но показать имя ключа — хуже всего: это уже не
     * текст, а внутренность приложения.
     */
    it('непереведённое остаётся русским, а не превращается в ключ', () => {
        withLang('en', () => {
            const выдумка = 'Такой строки в словаре заведомо нет';
            equal(t(выдумка), выдумка);
        });
    });

    it('подстановки работают в обоих языках', () => {
        withLang('ru', () => equal(t('Проведено {n}', { n: '3 тренировки' }), 'Проведено 3 тренировки'));
        withLang('en', () => equal(t('Проведено {n}', { n: '3 workouts' }), 'Done: 3 workouts'));
    });
});

describe('Числа и склонение по языкам', () => {

    it('русских форм три, английских две', () => {
        withLang('ru', () => {
            equal(format.count(1, format.WORDS.set), '1 подход');
            equal(format.count(3, format.WORDS.set), '3 подхода');
            equal(format.count(5, format.WORDS.set), '5 подходов');
            equal(format.count(11, format.WORDS.set), '11 подходов');
        });

        withLang('en', () => {
            equal(format.count(1, format.WORDS.set), '1 set');
            equal(format.count(3, format.WORDS.set), '3 sets');
            equal(format.count(0, format.WORDS.set), '0 sets', 'ноль по-английски множественный');
        });
    });

    /*
     * «62,5» англоязычный читает как два числа через запятую, а «62.5»
     * русскоязычный — как чужую запись. Разделитель обязан следовать языку.
     */
    it('разделитель дробной части следует языку', () => {
        withLang('ru', () => {
            equal(format.weight(62.5), '62,5');
            equal(format.decimal(13.25), '13,3');
        });

        withLang('en', () => {
            equal(format.weight(62.5), '62.5');
            equal(format.decimal(13.25), '13.3');
        });
    });

    it('единицы дистанции переводятся', () => {
        withLang('ru', () => equal(format.distance(1200), '1,2 км'));
        withLang('en', () => equal(format.distance(1200), '1.2 km'));
    });

    it('время от языка не зависит', () => {
        withLang('ru', () => equal(format.duration(75000), '01:15'));
        withLang('en', () => equal(format.duration(75000), '01:15'));
    });
});

describe('Даты по языкам', () => {

    const день = new Date(2026, 7, 27, 19, 40).getTime();

    it('месяцы и дни недели переводятся', () => {
        withLang('ru', () => {
            equal(dates.MONTHS_GEN[7], 'августа');
            equal(dates.WEEKDAYS_SHORT[0], 'Пн');
        });

        withLang('en', () => {
            equal(dates.MONTHS_GEN[7], 'August');
            equal(dates.WEEKDAYS_SHORT[0], 'Mon');
        });
    });

    /*
     * По-английски день и месяц пишут наоборот: «27 August» читается как
     * ошибка, «August 27» — как дата.
     */
    it('день и месяц идут в своём порядке', () => {
        const сейчас = new Date(2026, 7, 29).getTime();

        withLang('ru', () => equal(dates.formatDayLabel(день, сейчас), '27 августа'));
        withLang('en', () => equal(dates.formatDayLabel(день, сейчас), 'August 27'));
    });

    it('сегодня и вчера переводятся', () => {
        const сейчас = Date.now();

        withLang('ru', () => equal(dates.formatDayLabel(сейчас, сейчас), 'Сегодня'));
        withLang('en', () => equal(dates.formatDayLabel(сейчас, сейчас), 'Today'));
    });

    /*
     * Порядок «день, месяц, год» цифрами верен для русского и немецкого, а
     * для английского — ловушка: «01.09.2025» читается и как первое
     * сентября, и как девятое января, и переставить числа местами нельзя —
     * получилось бы то же самое наоборот. Спасает только слово.
     */
    it('дата цифрами остаётся у русского и немецкого', () => {
        withLang('ru', () => equal(dates.formatDate(день), '27.08.2026'));
        withLang('de', () => equal(dates.formatDate(день), '27.08.2026'));
    });

    it('по-английски месяц назван словом', () => {
        withLang('en', () => equal(dates.formatDate(день), 'August 27, 2026'));
    });

    /*
     * Подпись под столбцом графика — исключение: место там на пять знаков,
     * название месяца не входит даже сокращённым.
     */
    it('подпись графика везде цифрами', () => {
        for (const lang of ['ru', 'en', 'de']) {
            withLang(lang, () => equal(dates.formatShort(день), '27.08'));
        }
    });
});
