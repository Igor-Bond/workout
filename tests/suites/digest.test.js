/**
 * Что изменилось — итог кондиций (§66, Р-167).
 *
 * Главное, что здесь проверяется, — граница с «Как идёт программа». Два
 * экрана, говорящих об одном разными словами, хуже одного неверного: после
 * такого не верят обоим (Р-159, Р-162). Поэтому сон и пульс покоя сюда не
 * берутся вовсе, и проверка следит именно за этим.
 *
 * Второе — правило экрана: говорим только о том, у чего есть основание, и
 * называем его в той же строке.
 */

import { describe, it, equal, assert } from '../runner.js';
import { digest } from '../../js/core/digest.js';
import { health } from '../../js/core/health.js';

const текст = (строки) => строки.map((с) => `${с.kind}: ${с.text}`).join('\n');

describe('Итог кондиций', () => {

    it('без данных не говорит ничего', () => {
        equal(digest.condition({}).length, 0,
            '«всё в порядке» от приложения, смотрящего на десяток величин, читается как поломка');
    });

    it('ход тела называет обе величины и направление', () => {
        const строки = digest.condition({
            body: {
                weight: { delta: -1.5, state: health.ХОРОШО },
                waist: { delta: -1.5, state: health.ХОРОШО }
            }
        });

        equal(строки.length, 1);
        equal(строки[0].kind, 'ok');

        assert(строки[0].text.includes('вес −1,5'), текст(строки));
        assert(строки[0].text.includes('талия −1,5'), текст(строки));
        assert(строки[0].text.includes('Идёте'), текст(строки));
    });

    /*
     * Вес неделями стоит, пока жир уходит, а мышцы приходят. Назвать при этом
     * «вес» и показать сантиметры значило бы соврать в одном слове.
     */
    it('сдвинулась одна величина — названа она, а не обе', () => {
        const строки = digest.condition({
            body: { weight: { delta: 0, state: health.СПРАВКА }, waist: { delta: -2, state: health.ХОРОШО } }
        });

        assert(строки[0].text.includes('талия −2'), текст(строки));
        assert(!строки[0].text.includes('вес'), `вес не двигался — и не назван: ${текст(строки)}`);
    });

    it('ход в другую сторону от цели — это наблюдение', () => {
        const строки = digest.condition({
            body: { weight: { delta: 1.2, state: health.СМОТРЕТЬ } }
        });

        equal(строки[0].kind, 'watch');
        assert(строки[0].text.includes('+1,2'), текст(строки));
        assert(строки[0].text.includes('в другую сторону'), текст(строки));
    });

    it('без цели ход называется, но не оценивается', () => {
        const строки = digest.condition({
            body: { weight: { delta: -1.5, state: health.СПРАВКА } }
        });

        equal(строки[0].kind, 'plain', 'куда хорошо — не приложению решать');
    });
});

describe('Забытая группа', () => {

    it('две недели молчания — уже новость', () => {
        const строки = digest.condition({ forgotten: { name: 'Ноги', weeks: 3 } });

        equal(строки[0].kind, 'watch');
        assert(строки[0].text.includes('Ноги'), текст(строки));
        assert(строки[0].text.includes('3 недели'), текст(строки));
    });

    /*
     * Одна пропущенная неделя — это командировка или спина, и объявлять по ней
     * «вы забыли спину» значило бы дёргать человека по любому поводу.
     */
    it('одна неделя — ещё не новость', () => {
        equal(digest.condition({ forgotten: { name: 'Ноги', weeks: 1 } }).length, 0);
    });
});

describe('Разгон и питание в итоге', () => {

    it('резкая прибавка названа своим ориентиром', () => {
        const строки = digest.condition({
            ramp: { value: 1.6, state: health.СМОТРЕТЬ }
        });

        equal(строки[0].kind, 'watch');
        assert(строки[0].text.includes('1,6'), текст(строки));
        assert(строки[0].text.includes('1,3'), `ориентир назван рядом: ${текст(строки)}`);
    });

    it('разгон в пределах ориентира молчит', () => {
        equal(digest.condition({ ramp: { value: 1.1, state: health.ХОРОШО } }).length, 0);
    });

    it('среднее за неделю сравнивается с названным потолком', () => {
        const внутри = digest.condition({ intake: { average: 2100, ceiling: 2394 } });
        const сверх = digest.condition({ intake: { average: 2600, ceiling: 2394 } });

        equal(внутри[0].kind, 'ok');
        equal(сверх[0].kind, 'watch');

        assert(сверх[0].text.includes('2600') && сверх[0].text.includes('2394'),
            `оба числа названы: ${текст(сверх)}`);
    });
});

describe('Порядок и предел', () => {

    /*
     * Первое меняет ближайшие дни, последнее объясняет месяц — тот же приём,
     * что и у «Как идёт программа».
     */
    it('тревожное идёт впереди спокойного', () => {
        const строки = digest.condition({
            body: { weight: { delta: -1.5, state: health.ХОРОШО } },
            forgotten: { name: 'Спина', weeks: 4 }
        });

        equal(строки[0].kind, 'watch');
        assert(строки[0].text.includes('Спина'), текст(строки));
        equal(строки[1].kind, 'ok');
    });

    it('строк не больше трёх', () => {
        const строки = digest.condition({
            body: { weight: { delta: 1.2, state: health.СМОТРЕТЬ } },
            forgotten: { name: 'Ноги', weeks: 4 },
            ramp: { value: 1.6, state: health.СМОТРЕТЬ },
            intake: { average: 2600, ceiling: 2394 }
        });

        equal(строки.length, 3, 'больше трёх — это уже не итог, а вторая карточка');
    });
});
