/**
 * Обмен с Firestore (§39 ТЗ).
 *
 * Firestore — средство синхронизации и резервного хранения, а не основное
 * хранилище: приложение работает с локальной базой даже без сети, а обмен
 * лишь догоняет её содержимое.
 *
 * Ключевое решение — обмен только изменившимся, по метке updatedAt.
 * Firestore тарифицирует каждый прочитанный документ; если тянуть всю
 * историю при каждом запуске, год занятий съедал бы по двести операций за
 * раз без всякой пользы.
 *
 * Порядок прохода: сначала забрать чужое, потом отдать своё. Иначе
 * локальная запись, сделанная до обмена, затёрлась бы более старой версией
 * из облака.
 */

import { auth } from './auth.js';
import { dbService } from './db.js';
import { merge, SYNCED } from '../core/merge.js';
import { config } from '../config.js';

const LAST_SYNC_KEY = 'lastSync';

const listeners = new Set();

function emit(state, message = '') {
    const payload = { state, message, at: Date.now() };
    listeners.forEach((cb) => {
        try { cb(payload); } catch (e) { console.error('[Обмен] Ошибка слушателя:', e); }
    });
}

export const sync = {

    /** Идёт ли обмен прямо сейчас — чтобы не запускать второй. */
    inProgress: false,

    /** Подписка на состояние: { state, message, at }. */
    onStatus(callback) {
        listeners.add(callback);
        return () => listeners.delete(callback);
    },

    getLastSync: () => Number(config.get(LAST_SYNC_KEY) || 0),
    setLastSync: (value) => config.set(LAST_SYNC_KEY, value),

    /** Можно ли обмениваться: настроено и выполнен вход. */
    get available() {
        return auth.isConfigured() && auth.isSignedIn;
    },

    _collection: (ctx, name) => ctx.fs.collection(ctx.db, 'users', ctx.uid, name),

    // ================== ЗАБРАТЬ ЧУЖОЕ ==================

    /**
     * Возвращает идентификаторы применённых записей: их нельзя отправлять
     * обратно тем же обменом.
     */
    async pull(ctx, since) {
        const applied = new Set();
        const appliedRecords = [];

        for (const name of SYNCED) {
            const { query, where, getDocs } = ctx.fs;

            const snapshot = await getDocs(
                query(sync._collection(ctx, name), where('updatedAt', '>', since))
            );

            const incoming = [];
            const workouts = [];

            for (const doc of snapshot.docs) {
                const remote = doc.data();
                const local = await dbService.getRaw(name, remote.id);

                if (merge.resolve(local, remote) !== 'take-remote') continue;

                applied.add(remote.id);
                appliedRecords.push(remote);

                if (name === 'workouts') workouts.push(merge.unpackWorkout(remote));
                else incoming.push(remote);
            }

            if (incoming.length) await dbService.applyRemote(name, incoming);

            for (const { workout, sets } of workouts) {
                await dbService.applyRemoteWorkout(workout, sets);
            }
        }

        return { applied, appliedRecords };
    },

    // ================== ОТДАТЬ СВОЁ ==================

    async push(ctx, since, applied) {
        const { doc, setDoc, writeBatch } = ctx.fs;
        let sent = 0;

        for (const name of SYNCED) {
            const changed = merge.syncable(name, await dbService.changedSince(name, since));
            const outgoing = merge.outgoing(changed, since, applied);

            if (outgoing.length === 0) continue;

            // Пакетами: Firestore берёт до пятисот операций за раз, а
            // поштучная отправка сотни тренировок — сотня круговых задержек
            for (let i = 0; i < outgoing.length; i += 400) {
                const batch = writeBatch(ctx.db);

                for (const record of outgoing.slice(i, i + 400)) {
                    const payload = name === 'workouts'
                        ? merge.packWorkout(record, record.sets)
                        : merge.clean(record);

                    batch.set(doc(sync._collection(ctx, name), record.id), payload);
                }

                await batch.commit();
            }

            sent += outgoing.length;
        }

        // Профиль пользователя: нужен, чтобы документ существовал и было
        // видно, когда устройство последний раз выходило на связь
        await setDoc(
            doc(ctx.db, 'users', ctx.uid),
            { lastSyncAt: Date.now(), app: 'workout' },
            { merge: true }
        );

        return sent;
    },

    // ================== ПОЛНЫЙ ПРОХОД ==================

    async run({ silent = false } = {}) {
        if (!auth.isConfigured()) return { skipped: 'not-configured' };
        if (!auth.isSignedIn) return { skipped: 'not-signed-in' };
        if (sync.inProgress) return { skipped: 'already-running' };

        sync.inProgress = true;
        if (!silent) emit('running', 'Синхронизация…');

        const startedAt = Date.now();
        const since = sync.getLastSync();

        try {
            const ctx = await auth.context();

            const { applied, appliedRecords } = await sync.pull(ctx, since);
            const sent = await sync.push(ctx, since, applied);

            sync.setLastSync(merge.nextSince(startedAt, appliedRecords));

            const result = { received: applied.size, sent, at: Date.now() };

            if (!silent) {
                emit('done', result.received || result.sent
                    ? `Получено ${result.received}, отправлено ${result.sent}`
                    : 'Изменений нет');
            }

            return result;
        } catch (e) {
            console.error('[Обмен] Ошибка:', e);

            // Метка последней синхронизации не сдвигается: неотправленное
            // должно уехать при следующей попытке, а не пропасть
            emit('error', e?.message || 'Не удалось синхронизировать');

            return { error: e?.message || String(e) };
        } finally {
            sync.inProgress = false;
        }
    },

    /**
     * Сброс отметки: следующий обмен пройдёт по всей истории.
     * Нужен, когда данные разошлись и надо свести их заново.
     */
    reset() {
        sync.setLastSync(0);
    }
};
