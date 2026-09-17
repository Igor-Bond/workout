/**
 * План в календарь (§62.5 ТЗ).
 *
 * Здесь проверяется то, что попадёт в напоминание: ошибка в сборке видна не
 * сразу — в календаре она выглядит обычным занятием, только не тем.
 */

import { describe, it, equal, assert } from '../runner.js';
import { schedule, PREFIX } from '../../js/core/schedule.js';
import { plan } from '../../js/core/plan.js';

const ПЛАН = plan.parse([
    'С 07.09.2026, 8 недель',
    'Пн Бицепс резинка 6 × 50, пауза 10 мин',
    'Ср Отжимания 6 × 20',
    'Вс отдых'
].join('\n'));

const ПН = new Date(2026, 8, 7, 12).getTime();

describe('Что попадёт в календарь', () => {

    it('по занятию на тренировочный день', () => {
        const занятия = schedule.build(ПЛАН, { from: ПН, days: 7 });

        equal(занятия.length, 2, 'понедельник и среда');
        equal(занятия[0].day, '2026-09-07');
        assert(занятия[0].name.includes('Бицепс резинка'), `название: ${занятия[0].name}`);
    });

    it('дни отдыха не отправляются', () => {
        const дни = schedule.build(ПЛАН, { from: ПН, days: 14 }).map((з) => з.day);

        equal(дни.includes('2026-09-13'), false, 'запись «отдых» на часах — лишнее уведомление');
    });

    it('пауза дня и правила уходят в описание', () => {
        const [первое] = schedule.build(ПЛАН, { from: ПН, days: 7, rules: ['RIR 2'] });

        assert(первое.description.includes('10 мин'), `пауза: ${первое.description}`);
        assert(первое.description.includes('RIR 2'), `правила: ${первое.description}`);
    });

    it('у каждого дня свой опознаватель с приставкой приложения', () => {
        const занятия = schedule.build(ПЛАН, { from: ПН, days: 14 });
        const свои = new Set(занятия.map((з) => з.externalId));

        equal(свои.size, занятия.length, 'два занятия с одним опознавателем затрут друг друга');
        assert([...свои].every((id) => id.startsWith(PREFIX)));
    });

    it('без плана не уезжает ничего', () => {
        equal(schedule.build(null).length, 0);
        equal(schedule.build({ weeks: 8 }).length, 0);
    });

    it('этапы уезжают своими сетками', () => {
        const этапный = plan.parse([
            'С 07.09.2026, 8 недель',
            'Этап 1 (недели 1–2): втягивание',
            'Пн Бицепс резинка 6 × 50',
            'Этап 2 (недели 3–8): объём',
            'Пн Бицепс резинка 12 × 35'
        ].join('\n'));

        const занятия = schedule.build(этапный, { from: ПН + 14 * 86400000, days: 7 });

        assert(занятия[0].name.includes('12'), `третья неделя — второй этап: ${занятия[0].name}`);
        assert(занятия[0].description.includes('Этап 2'), `этап назван в описании: ${занятия[0].description}`);
    });

});
