/**
 * План в календарь телефона (§62.5 ТЗ).
 *
 * Формат придирчив: незаэкранированная запятая разваливает поле надвое, и
 * календарь покажет половину названия — а человек об этом узнает, когда
 * придёт напоминание «Бицепс резинка 6 × 50» без второй половины.
 */

import { describe, it, equal, assert } from '../runner.js';
import { ical } from '../../js/core/ical.js';
import { schedule } from '../../js/core/schedule.js';
import { plan } from '../../js/core/plan.js';

const ПЛАН = plan.parse([
    'С 07.09.2026, 8 недель',
    'Пн Бицепс резинка 6 × 50, пауза 10 мин',
    'Ср Отжимания 6 × 20'
].join('\n'));

const ПН = new Date(2026, 8, 7, 12).getTime();
const ЗАНЯТИЯ = schedule.build(ПЛАН, { from: ПН, days: 7, rules: ['RIR 2'] });

describe('Файл календаря', () => {

    const текст = ical.build(ЗАНЯТИЯ, { now: ПН });

    it('это настоящий iCalendar', () => {
        assert(текст.startsWith('BEGIN:VCALENDAR'), 'начало обязательно');
        assert(текст.trim().endsWith('END:VCALENDAR'), 'конец тоже');
        assert(текст.includes('\r\n'), 'формат требует переводов строки в два знака');
    });

    it('по событию на занятие, на весь день', () => {
        equal((текст.match(/BEGIN:VEVENT/g) || []).length, 2);
        assert(текст.includes('DTSTART;VALUE=DATE:20260907'), `дата начала: ${текст.slice(0, 400)}`);
        assert(текст.includes('DTEND;VALUE=DATE:20260908'), 'событие на весь день кончается следующим днём');
    });

    it('у события напоминание', () => {
        assert(текст.includes('BEGIN:VALARM'));
        assert(текст.includes('TRIGGER;RELATED=START:PT8H'), 'полночь — не время для уведомления');
    });

    it('запятая в названии не разваливает поле', () => {
        const событие = ical.build([{
            date: ПН, externalId: 'x', name: 'Бицепс 6 × 50, пресс 6 × 25', description: ''
        }], { now: ПН });

        assert(событие.includes('SUMMARY:Бицепс 6 × 50\\, пресс 6 × 25'),
            `иначе календарь покажет половину названия: ${событие}`);
    });

    it('перевод строки в описании пишется двумя знаками', () => {
        const описание = текст.split('\r\n').find((l) => l.startsWith('DESCRIPTION:Пауза'));

        assert(описание?.includes('\\n'), `пауза и правила в одном поле: ${описание}`);
    });

    it('опознаватель события берётся из плана и не меняется', () => {
        assert(текст.includes('UID:tracker-plan-2026-09-07@workout-tracker'),
            'по нему календарь узнаёт уже добавленное и не заводит второе такое же');
    });

    it('пустой список даёт пустой, но верный файл', () => {
        const пусто = ical.build([], { now: ПН });

        assert(пусто.includes('BEGIN:VCALENDAR') && !пусто.includes('BEGIN:VEVENT'));
    });

    it('имя файла несёт дату', () => {
        equal(ical.filename(ПН), 'plan-20260907.ics');
    });

});
