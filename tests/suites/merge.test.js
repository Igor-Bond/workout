/**
 * Правила слияния при синхронизации (§39, §41 ТЗ).
 *
 * Здесь ошибка не падает и не видна на экране — она молча теряет данные
 * пользователя. Поэтому проверяется каждое правило, включая те, что
 * кажутся очевидными.
 */

import { describe, it, equal, assert } from '../runner.js';
import { merge } from '../../js/core/merge.js';
import { backup } from '../../js/services/backup.js';
import { config } from '../../js/config.js';

const rec = (over = {}) => ({ id: 'a', updatedAt: 100, ...over });

describe('Разрешение конфликта', () => {

    it('более свежая запись побеждает', () => {
        equal(merge.resolve(rec({ updatedAt: 100 }), rec({ updatedAt: 200 })), 'take-remote');
        equal(merge.resolve(rec({ updatedAt: 300 }), rec({ updatedAt: 200 })), 'keep-local');
    });

    it('при равных метках побеждает локальная', () => {
        equal(merge.resolve(rec({ updatedAt: 100 }), rec({ updatedAt: 100 })), 'keep-local',
            'переписывать тем же самым — лишняя операция');
    });

    it('незнакомая запись принимается', () => {
        equal(merge.resolve(null, rec()), 'take-remote');
    });

    it('удаление доезжает как обычное изменение', () => {
        const local = rec({ updatedAt: 100 });
        const remote = rec({ updatedAt: 200, deletedAt: 200 });

        equal(merge.resolve(local, remote), 'take-remote', 'иначе удаление не дошло бы до второго устройства');
    });

    it('устаревшее удаление не воскрешает правку', () => {
        const local = rec({ updatedAt: 300 });
        const remote = rec({ updatedAt: 200, deletedAt: 200 });

        equal(merge.resolve(local, remote), 'keep-local');
    });
});

describe('Отбор на отправку', () => {

    const records = [
        rec({ id: 'старая', updatedAt: 50 }),
        rec({ id: 'новая', updatedAt: 150 }),
        rec({ id: 'пришедшая', updatedAt: 200 })
    ];

    it('уезжает только изменившееся с прошлого обмена', () => {
        const out = merge.outgoing(records, 100);

        equal(out.map((r) => r.id), ['новая', 'пришедшая']);
    });

    it('только что полученное обратно не отправляется', () => {
        const out = merge.outgoing(records, 100, new Set(['пришедшая']));

        equal(out.map((r) => r.id), ['новая'], 'иначе расход операций удваивался бы каждый раз');
    });

    /*
     * Сведение двойников (§5.1) правит записи сразу после приёма. Если
     * считать «пришедшее» неприкосновенным, удаление двойника не уехало бы
     * никогда: второе устройство присылало бы его обратно на каждом обмене.
     */
    it('изменённое после приёма всё же отправляется', () => {
        const пришло = new Map([['пришедшая', 200]]);

        equal(merge.outgoing(records, 100, пришло).map((r) => r.id), ['новая'],
            'нетронутое остаётся дома');

        const тронутая = records.map((r) => (r.id === 'пришедшая' ? { ...r, updatedAt: 900 } : r));

        equal(merge.outgoing(тронутая, 100, пришло).map((r) => r.id), ['новая', 'пришедшая']);
    });

    it('первый обмен отправляет всё', () => {
        equal(merge.outgoing(records, 0).length, 3);
    });
});

describe('Активная тренировка', () => {

    const workouts = [
        { id: 'w1', status: 'done', updatedAt: 100 },
        { id: 'w2', status: 'active', updatedAt: 200 }
    ];

    it('в облако не уезжает', () => {
        equal(merge.syncable('workouts', workouts).map((w) => w.id), ['w1'],
            'её подходы ещё меняются, а конфликт решается целым документом');
    });

    it('остальные таблицы фильтр не трогает', () => {
        equal(merge.syncable('exercises', workouts).length, 2);
    });
});

describe('Упаковка тренировки', () => {

    const workout = { id: 'w1', type: 'Силовая', startedAt: 1000, updatedAt: 2000, note: undefined };

    const sets = [
        { id: 's2', order: 2, exerciseId: 'e1', reps: 8, weight: 60, workoutId: 'w1' },
        { id: 's1', order: 1, exerciseId: 'e1', reps: 10, weight: 60, workoutId: 'w1', note: undefined }
    ];

    it('подходы уезжают внутри документа тренировки', () => {
        const doc = merge.packWorkout(workout, sets);

        equal(doc.sets.length, 2);
        equal(doc.id, 'w1');
    });

    it('подходы упорядочены по фактическому выполнению', () => {
        equal(merge.packWorkout(workout, sets).doc, undefined);
        equal(merge.packWorkout(workout, sets).sets.map((s) => s.order), [1, 2]);
    });

    it('undefined убирается: Firestore его не принимает', () => {
        const doc = merge.packWorkout(workout, sets);

        equal('note' in doc, false);
        equal('note' in doc.sets[0], false);
    });

    it('распаковка возвращает тренировку и подходы', () => {
        const doc = merge.packWorkout(workout, sets);
        const { workout: back, sets: backSets } = merge.unpackWorkout(doc);

        equal('sets' in back, false, 'в локальной таблице подходов внутри тренировки быть не должно');
        equal(backSets.length, 2);
        equal(backSets.every((s) => s.workoutId === 'w1'), true);
    });

    it('упаковка и распаковка не теряют данные', () => {
        const { workout: back, sets: backSets } = merge.unpackWorkout(merge.packWorkout(workout, sets));

        equal(back.type, 'Силовая');
        equal(back.startedAt, 1000);
        equal(backSets.find((s) => s.id === 's1').reps, 10);
    });

    it('тренировка без подходов распаковывается в пустой список', () => {
        equal(merge.unpackWorkout({ id: 'w9', updatedAt: 1 }).sets, []);
    });
});

describe('Очистка записи', () => {

    it('пустые значения сохраняются, а undefined выбрасывается', () => {
        const clean = merge.clean({ a: 0, b: '', c: null, d: false, e: undefined });

        equal(Object.keys(clean).sort(), ['a', 'b', 'c', 'd'], 'ноль и пустая строка — это значения');
    });
});

describe('Отметка последнего обмена', () => {

    it('берётся момент начала обмена', () => {
        equal(merge.nextSince(1000, []), 1000,
            'запись, сделанная во время обмена, иначе никогда бы не уехала');
    });

    it('не отстаёт от самой свежей полученной записи', () => {
        const applied = [rec({ updatedAt: 1500 }), rec({ updatedAt: 900 })];

        equal(merge.nextSince(1000, applied), 1500);
    });
});

describe('Граница приёма', () => {

    /*
     * Своими часами здесь не измеряется ничего. updatedAt у записи — это
     * когда её изменили, а не когда выложили: устройство могло завести
     * упражнение утром, а выйти на связь вечером. Граница, поставленная по
     * своим часам, к вечеру давно перешагнула утро — и такая запись не
     * пришла бы уже никогда.
     */
    it('двигается только по полученному, а не по своим часам', () => {
        const получено = [{ syncedAt: 4000 }, { syncedAt: 9000 }, { syncedAt: 2000 }];

        equal(merge.nextCursor(1000, получено), 9000);
    });

    it('без полученного остаётся на месте', () => {
        equal(merge.nextCursor(5000, []), 5000);
        equal(merge.nextCursor(0, []), 0);
    });

    it('назад не отступает', () => {
        equal(merge.nextCursor(9000, [{ syncedAt: 100 }]), 9000,
            'иначе уже принятое приезжало бы снова и снова');
    });

    it('запись без отметки сервера границу не двигает', () => {
        equal(merge.nextCursor(1000, [{ syncedAt: undefined }, {}]), 1000);
    });

    it('отметка понимается в любом виде, каким её отдаёт Firestore', () => {
        equal(merge.toMillis(1500), 1500);
        equal(merge.toMillis({ toMillis: () => 1500 }), 1500);
        equal(merge.toMillis({ seconds: 2, nanoseconds: 0 }), 2000);
        equal(merge.toMillis(new Date(1500)), 1500);
        equal(merge.toMillis(null), 0);
    });
});

describe('Разбор файла копии', () => {

    it('копия приложения принимается', () => {
        const parsed = backup.parse('{"app":"workout","format":1,"data":{"exercises":[]}}');

        equal(parsed.kind, 'full');
    });

    it('выгрузка версии 1 узнаётся по обёртке', () => {
        const parsed = backup.parse('{"app":"workout","v1":[{"date":"2026-08-01T10:00:00.000Z"}]}');

        equal(parsed.kind, 'v1');
        equal(parsed.v1.length, 1);
    });

    it('голый массив тоже считается выгрузкой версии 1', () => {
        equal(backup.parse('[{"date":"2026-08-01T10:00:00.000Z"}]').kind, 'v1');
    });

    it('пустая выгрузка отклоняется', () => {
        let message = '';
        try { backup.parse('[]'); } catch (e) { message = e.message; }

        assert(message.includes('нет ни одной'), 'молча принять пустой файл — обмануть ожидание');
    });

    it('файл другого приложения отклоняется', () => {
        let message = '';
        try { backup.parse('{"app":"wortschatz","data":{}}'); } catch (e) { message = e.message; }

        assert(message.includes('другого приложения'));
    });

    it('файл более новой версии отклоняется', () => {
        let message = '';
        try { backup.parse('{"app":"workout","format":99,"data":{}}'); } catch (e) { message = e.message; }

        assert(message.includes('новой версией'));
    });

    it('не-JSON отклоняется понятным сообщением', () => {
        let message = '';
        try { backup.parse('<html>'); } catch (e) { message = e.message; }

        assert(message.includes('не JSON'));
    });
});

describe('Настройки в резервной копии', () => {

    it('переносимые настройки попадают в копию', () => {
        const portable = config.getPortable();

        equal(Object.keys(portable).sort(), [...config.PORTABLE].sort());
    });

    it('привязанное к устройству не переносится', () => {
        const portable = config.getPortable();

        assert(!('syncEnabled' in portable), 'иначе новое устройство решит, что вход выполнен');
        assert(!('lastSync' in portable), 'у нового устройства своя история обменов');
    });

    it('применяются только знакомые ключи', () => {
        const было = config.get('restSeconds');

        const applied = config.setPortable({ restSeconds: 120, чужойКлюч: 'мусор' });

        equal(applied, 1);
        equal(config.get('restSeconds'), 120);

        config.set('restSeconds', было);
    });

    it('значение не того типа отбрасывается', () => {
        const было = config.get('restEnabled');

        config.setPortable({ restEnabled: 'да' });

        equal(config.get('restEnabled'), было, 'файл могли поправить руками');
    });

    it('отсутствующие ключи не сбрасывают текущие', () => {
        config.set('mode', 'free');
        config.setPortable({ restSeconds: 90 });

        equal(config.get('mode'), 'free');
        config.set('mode', 'plan');
    });
});

describe('Состав синхронизируемого', () => {

    it('настройки в облако не уезжают', () => {
        assert(!merge.SYNCED.includes('settings'), 'часть настроек привязана к устройству');
    });

    it('подходы отдельной таблицей не синхронизируются', () => {
        assert(!merge.SYNCED.includes('sets'), 'они уезжают внутри тренировки');
    });

    it('вес тела синхронизируется', () => {
        assert(merge.SYNCED.includes('bodyWeight'));
    });
});
