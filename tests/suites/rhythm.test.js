/**
 * Ритм тренировок и прогноз следующей (§26.2 ТЗ).
 *
 * Главное, что проверяется: приложение молчит, пока данных мало, и не
 * выдаёт совпадение за закономерность.
 */

import { describe, it, equal, assert } from '../runner.js';
import { rhythm } from '../../js/core/rhythm.js';

const DAY = 86400000;

/** Понедельник, 3 августа 2026, полдень. */
const MONDAY = new Date(2026, 7, 3, 12, 0, 0).getTime();

/** Тренировки через заданные промежутки, начиная с MONDAY. */
function every(gaps, type = 'Силовая') {
    let at = MONDAY;
    const out = [{ startedAt: at, type }];

    for (const gap of gaps) {
        at += gap * DAY;
        out.push({ startedAt: at, type });
    }

    return out;
}

describe('Медиана', () => {

    it('нечётное количество берёт середину', () => {
        equal(rhythm.median([5, 1, 3]), 3);
    });

    it('чётное усредняет две средние', () => {
        equal(rhythm.median([1, 2, 4, 5]), 3);
    });

    it('одиночный выброс её не сдвигает', () => {
        equal(rhythm.median([2, 2, 2, 2, 40]), 2, 'ради этого медиана, а не среднее');
    });

    it('пустой список даёт ноль', () => {
        equal(rhythm.median([]), 0);
    });
});

describe('Тренировочные дни и промежутки', () => {

    it('две тренировки в один день считаются одним днём', () => {
        const days = rhythm.workoutDays([
            { startedAt: MONDAY },
            { startedAt: MONDAY + 3600000 * 6 }
        ]);

        equal(days.length, 1, 'иначе появился бы промежуток в ноль дней');
    });

    it('промежутки считаются в днях по возрастанию', () => {
        const days = rhythm.workoutDays(every([2, 3, 2]));

        equal(rhythm.intervals(days), [2, 3, 2]);
    });
});

describe('Достаточность данных', () => {

    it('меньше пяти тренировок — прогноза нет', () => {
        const result = rhythm.analyze(every([2, 2, 2]));

        equal(result.enough, false);
        equal(result.count, 4);
        equal(result.need, 1);
        equal(result.nextAt, null, 'прогноз по четырём тренировкам — это совпадение');
    });

    it('пустая история не роняет разбор', () => {
        const result = rhythm.analyze([]);

        equal(result.enough, false);
        equal(result.lastAt, null);
        equal(result.daysSince, null);
    });

    it('пяти тренировок уже достаточно', () => {
        equal(rhythm.analyze(every([2, 2, 2, 2])).enough, true);
    });
});

describe('Прогноз следующей тренировки', () => {

    it('ровный ритм даёт прогноз через тот же промежуток', () => {
        const workouts = every([2, 2, 2, 2, 2]);
        const last = workouts[workouts.length - 1].startedAt;
        const result = rhythm.analyze(workouts, last + DAY);

        equal(result.medianInterval, 2);
        equal(Math.round((result.nextAt - rhythm.workoutDays(workouts).pop()) / DAY), 2);
        equal(result.confidence, 'high');
    });

    it('пропущенная неделя не сдвигает прогноз', () => {
        const result = rhythm.analyze(every([2, 2, 9, 2, 2, 2]));

        equal(result.medianInterval, 2, 'медиана устойчива к одному провалу');
    });

    it('рваный ритм честно помечается низкой уверенностью', () => {
        const result = rhythm.analyze(every([1, 7, 2, 14, 3, 9]));

        equal(result.enough, true);
        equal(result.confidence, 'low');
    });
});

describe('Состояние: отдых, пора, пропуск', () => {

    const workouts = every([3, 3, 3, 3]);
    const last = rhythm.workoutDays(workouts).pop();

    it('внутри привычного промежутка — отдых', () => {
        equal(rhythm.analyze(workouts, last + DAY).state, 'rest');
    });

    it('промежуток вышел — пора', () => {
        equal(rhythm.analyze(workouts, last + 3 * DAY).state, 'due');
    });

    it('вдвое дольше обычного — пропуск', () => {
        equal(rhythm.analyze(workouts, last + 7 * DAY).state, 'overdue');
    });

    it('считаются дни с последней тренировки', () => {
        equal(rhythm.analyze(workouts, last + 4 * DAY).daysSince, 4);
    });
});

describe('Привычные дни недели', () => {

    it('понедельник, среда, пятница распознаются', () => {
        // 2, 2, 3 — это пн, ср, пт и снова понедельник
        const result = rhythm.analyze(every([2, 2, 3, 2, 2, 3, 2, 2, 3]));

        equal(result.weekdays.sort(), [0, 2, 4], 'понедельник — 0');
    });

    it('прогноз подтягивается к привычному дню недели', () => {
        const result = rhythm.analyze(every([2, 2, 3, 2, 2, 3, 2, 2, 3]));
        const weekday = (new Date(result.nextAt).getDay() + 6) % 7;

        assert(result.weekdays.includes(weekday), 'прогноз не должен падать на нетренировочный день');
    });
});

describe('Подсказка типа тренировки', () => {

    const cycle = (types) => types.map((type, i) => ({ startedAt: MONDAY + i * 2 * DAY, type }));

    it('распознаёт повторяющийся цикл', () => {
        const workouts = cycle(['Грудь', 'Спина', 'Ноги', 'Грудь', 'Спина', 'Ноги']);
        const suggestion = rhythm.suggestType(workouts);

        equal(suggestion.reason, 'cycle');
        equal(suggestion.period, 3);
        equal(suggestion.type, 'Грудь', 'после ног цикл возвращается к груди');
    });

    it('цикл из двух чередующихся типов', () => {
        const suggestion = rhythm.suggestType(cycle(['Верх', 'Низ', 'Верх', 'Низ', 'Верх', 'Низ']));

        equal(suggestion.type, 'Верх');
        equal(suggestion.period, 2);
    });

    it('одинаковые тренировки циклом не считаются', () => {
        equal(rhythm.suggestType(cycle(['Силовая', 'Силовая', 'Силовая', 'Силовая'])), null);
    });

    it('без цикла предлагается давно забытый тип', () => {
        const suggestion = rhythm.suggestType(cycle(['Ноги', 'Кардио', 'Грудь', 'Грудь', 'Кардио']));

        equal(suggestion.reason, 'stale');
        equal(suggestion.type, 'Ноги', 'ноги делали раньше всех прочих');
    });

    it('короткой истории не хватает для подсказки', () => {
        equal(rhythm.suggestType(cycle(['Грудь', 'Спина'])), null);
    });
});

describe('Периодичность упражнений', () => {

    const DAY = 86400000;
    const сегодня = new Date('2026-08-28T12:00:00').getTime();

    /** Тренировка из сводки: день назад и какие упражнения в ней были. */
    const было = (daysAgo, ...exerciseIds) => ({
        workout: { startedAt: сегодня - daysAgo * DAY },
        exerciseIds
    });

    it('у каждого упражнения свой промежуток', () => {
        const записи = [
            было(0, 'пресс'), было(2, 'пресс', 'жим'), было(4, 'пресс'),
            было(6, 'пресс', 'жим'), было(10, 'жим')
        ];

        const по = Object.fromEntries(
            rhythm.exerciseRhythm(записи, сегодня).map((e) => [e.exerciseId, e])
        );

        equal(по.пресс.medianInterval, 2);
        equal(по.жим.medianInterval, 4);
    });

    it('одного промежутка для вывода мало', () => {
        const [единственное] = rhythm.exerciseRhythm([было(0, 'жим'), было(4, 'жим')], сегодня);

        equal(единственное.enough, false, 'два раза — это ещё не периодичность');
        equal(единственное.medianInterval, null);
    });

    it('пора тому, что просрочено больше всех', () => {
        const записи = [
            // Пресс делали вчера, промежуток два дня — ещё рано
            было(1, 'пресс'), было(3, 'пресс'), было(5, 'пресс'),
            // Жим раз в три дня, а не было девять — просрочен втрое
            было(9, 'жим'), было(12, 'жим'), было(15, 'жим'),
            // Тяга раз в четыре дня, не было пять — просрочена слегка
            было(5, 'тяга'), было(9, 'тяга'), было(13, 'тяга')
        ];

        const пора = rhythm.dueExercises(записи, сегодня);

        equal(пора.map((e) => e.exerciseId), ['жим', 'тяга'],
            'пресс в графике, и звать к нему незачем');
    });

    it('без данных не предлагает ничего', () => {
        equal(rhythm.dueExercises([], сегодня), []);
        equal(rhythm.dueExercises([было(0, 'жим')], сегодня), []);
    });

    it('две тренировки в один день считаются одним днём', () => {
        const записи = [
            было(0, 'жим'), было(0, 'жим'), было(3, 'жим'), было(6, 'жим')
        ];

        const [жим] = rhythm.exerciseRhythm(записи, сегодня);

        equal(жим.sessions, 3, 'иначе появился бы промежуток в ноль дней');
        equal(жим.medianInterval, 3);
    });

    it('список ограничивается по просьбе', () => {
        const записи = ['а', 'б', 'в', 'г', 'д', 'е'].flatMap((id) => [
            было(20, id), было(30, id), было(40, id)
        ]);

        equal(rhythm.dueExercises(записи, сегодня, { limit: 3 }).length, 3);
    });
});
