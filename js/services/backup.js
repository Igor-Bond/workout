/**
 * Резервная копия, экспорт и импорт (§41 ТЗ).
 *
 * Работает независимо от облака: файл на диске не зависит от того, жив ли
 * проект Firebase, оплачен ли он и не сменил ли пользователь учётную
 * запись. Для личных данных за годы это единственная копия, которая целиком
 * во власти владельца.
 */

import { dbService } from './db.js';
import { migrations } from './migrations.js';
import { merge, SYNCED } from '../core/merge.js';

/** Версия формата файла. Растёт, когда меняется состав или смысл полей. */
const FORMAT = 1;

export const backup = {

    FORMAT,

    /** Всё содержимое базы одним объектом. */
    async collect() {
        const data = {};

        for (const name of SYNCED) {
            data[name] = await dbService.changedSince(name, -1);
        }

        return {
            format: FORMAT,
            app: 'workout',
            exportedAt: Date.now(),
            data
        };
    },

    /** Имя файла с датой: копии за разные дни не должны затирать друг друга. */
    fileName(at = Date.now()) {
        const d = new Date(at);
        const pad = (n) => String(n).padStart(2, '0');

        return `workout-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
    },

    /** Выгрузка файлом. */
    async download() {
        const payload = await backup.collect();
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = backup.fileName(payload.exportedAt);
        document.body.appendChild(link);
        link.click();
        link.remove();

        // Отпускаем память не сразу: часть браузеров ещё читает ссылку
        setTimeout(() => URL.revokeObjectURL(url), 10000);

        return payload;
    },

    /**
     * Разбор файла с проверками.
     *
     * Принимаются два вида файлов:
     *
     *   - копия этого приложения — { format, data: { ... } };
     *   - выгрузка версии 1 — массив истории из localStorage, как его
     *     достаёт tools/export-v1.html. Он нужен, чтобы забрать историю из
     *     другого браузера или профиля, где приложение открывалось раньше:
     *     localStorage привязан к источнику, и иначе те данные не достать.
     *
     * Файл более новой версии отклоняется: молча пропустить незнакомые поля
     * значит потерять их при следующей выгрузке.
     */
    parse(text) {
        let parsed;

        try {
            parsed = JSON.parse(text);
        } catch {
            throw new Error('Файл не разбирается: это не JSON');
        }

        // Выгрузка версии 1: голый массив либо обёртка с полем v1
        const v1 = Array.isArray(parsed) ? parsed
            : Array.isArray(parsed?.v1) ? parsed.v1
            : null;

        if (v1) {
            if (v1.length === 0) throw new Error('В файле нет ни одной тренировки');
            return { kind: 'v1', app: 'workout', v1 };
        }

        if (!parsed || typeof parsed !== 'object' || !parsed.data) {
            throw new Error('Не похоже на резервную копию трекера');
        }

        if (parsed.app && parsed.app !== 'workout') {
            throw new Error('Файл от другого приложения');
        }

        if (Number(parsed.format) > FORMAT) {
            throw new Error('Файл сделан более новой версией приложения — обновите его');
        }

        return { kind: 'full', ...parsed };
    },

    /** Что в файле, одной строкой — для окна подтверждения. */
    describe(payload) {
        if (payload.kind === 'v1') {
            return `${payload.v1.length} тренировок из прошлой версии`;
        }

        return Object.entries(payload.data)
            .map(([name, list]) => `${name}: ${Array.isArray(list) ? list.length : 0}`)
            .join(', ');
    },

    /**
     * Загрузка истории версии 1 (§37).
     *
     * Преобразование то же, что при обновлении с версии 1, и упражнения так
     * же склеиваются по названию с уже существующими.
     *
     * Тренировка с тем же временем начала считается уже загруженной:
     * повторный выбор того же файла не должен удваивать историю.
     */
    async restoreV1(records) {
        const known = await dbService.listExercises({ includeArchived: true });
        const existing = await dbService.listWorkouts({ status: null });
        const taken = new Set(existing.map((w) => w.startedAt));

        const result = migrations.convertV1(records, {
            newId: dbService.newId,
            knownExercises: known.map((e) => ({ id: e.id, nameKey: e.nameKey, kind: e.kind }))
        });

        const fresh = result.workouts.filter((w) => !taken.has(w.startedAt));
        const freshIds = new Set(fresh.map((w) => w.id));

        // Упражнения, созданные только ради пропущенных тренировок, тоже не нужны
        const usedExercises = new Set(
            result.sets.filter((s) => freshIds.has(s.workoutId)).map((s) => s.exerciseId)
        );

        await dbService.bulkImport({
            exercises: result.exercises.filter((e) => usedExercises.has(e.id)),
            workouts: fresh,
            sets: result.sets.filter((s) => freshIds.has(s.workoutId))
        });

        return {
            workouts: fresh.length,
            skipped: result.workouts.length - fresh.length,
            unreadable: result.skipped.length
        };
    },

    /**
     * Загрузка данных из файла.
     *
     * mode = 'merge' — по тому же правилу, что и облако: побеждает запись с
     * большим updatedAt. mode = 'replace' — прежние данные стираются.
     */
    async restore(payload, { mode = 'merge' } = {}) {
        if (payload.kind === 'v1') return backup.restoreV1(payload.v1);

        if (mode === 'replace') {
            await dbService.wipe();

            // Полная очистка стирает и отметку о переносе версии 1, и при
            // следующем запуске он пошёл бы заново — поверх только что
            // восстановленной копии. Повторно сводить их незачем.
            await dbService.setSetting('v1ImportedAt', Date.now());
        }

        const counts = {};

        for (const name of SYNCED) {
            const records = payload.data[name];
            if (!Array.isArray(records)) continue;

            const accepted = [];
            const workouts = [];

            for (const record of records) {
                if (!record?.id) continue;

                const local = mode === 'replace' ? null : await dbService.getRaw(name, record.id);
                if (merge.resolve(local, record) !== 'take-remote') continue;

                if (name === 'workouts') workouts.push(merge.unpackWorkout(record));
                else accepted.push(record);
            }

            if (accepted.length) await dbService.applyRemote(name, accepted);

            for (const { workout, sets } of workouts) {
                await dbService.applyRemoteWorkout(workout, sets);
            }

            counts[name] = accepted.length + workouts.length;
        }

        return counts;
    }
};
