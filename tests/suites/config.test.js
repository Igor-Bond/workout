/**
 * Настройки при запрещённом хранилище (§31, Р-95).
 *
 * `localStorage` доступен не всегда: браузер с запретом на данные сайтов
 * бросает исключение на первое же обращение, а не возвращает пусто. У Firefox
 * это обычная строгая защита от слежения, и включают её люди, не подозревая о
 * последствиях.
 *
 * Настройки читаются при самой первой отрисовке, поэтому необёрнутое
 * обращение роняло не настройку, а всё приложение: экран оставался на
 * «Загрузка…». Проверяется здесь именно это — что приложение работает и
 * тогда, когда писать некуда.
 */

import { describe, it, equal, assert } from '../runner.js';
import { config } from '../../js/config.js';

/** Хранилище, которое запрещает всё, — как в браузере с блокировкой данных. */
function запретить() {
    const было = Object.getOwnPropertyDescriptor(window, 'localStorage');

    const кидать = () => { throw new DOMException('The operation is insecure.', 'SecurityError'); };

    Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get: () => ({ getItem: кидать, setItem: кидать, removeItem: кидать })
    });

    return () => {
        if (было) Object.defineProperty(window, 'localStorage', было);
        else delete window.localStorage;
    };
}

describe('Настройки без хранилища', () => {

    it('чтение возвращает умолчание, а не падает', () => {
        const вернуть = запретить();

        try {
            equal(config.get('restSeconds'), config.DEFAULTS.restSeconds);
        } finally {
            вернуть();
        }
    });

    it('записанное держится в памяти до перезагрузки', () => {
        const вернуть = запретить();

        try {
            config.set('restSeconds', 137);
            equal(config.get('restSeconds'), 137, 'настройка обязана работать и без диска');
        } finally {
            вернуть();
        }
    });

    it('сброс не падает и убирает запомненное', () => {
        const вернуть = запретить();

        try {
            config.set('restSeconds', 222);
            config.reset();

            equal(config.get('restSeconds'), config.DEFAULTS.restSeconds);
        } finally {
            вернуть();
        }
    });

    /*
     * Главное следствие: экран должен собираться. Разметка тянет настройки
     * десятками — режим обхода, звук, вибрацию, — и одно исключение посреди
     * этого оставляет человека с «Загрузка…» навсегда.
     */
    it('все настройки читаются подряд без исключений', () => {
        const вернуть = запретить();

        try {
            const всё = config.getAll();

            assert(Object.keys(всё).length > 5, 'настроек должно быть много');
            assert(Object.keys(всё).every((k) => всё[k] !== undefined), 'ни одна не должна пропасть');
        } finally {
            вернуть();
        }
    });
});
