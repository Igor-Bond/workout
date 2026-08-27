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

    /**
     * Стоит ли вообще пытаться обмениваться.
     *
     * Проверяется признак из настроек, а не auth.isSignedIn: до подъёма SDK
     * приложение не знает, выполнен ли вход, и по isSignedIn обмен молча не
     * запускался бы никогда, пока не откроешь профиль.
     */
    get available() {
        return auth.isConfigured() && config.get('syncEnabled');
    },

    _collection: (ctx, name) => ctx.fs.collection(ctx.db, 'users', ctx.uid, name),

    // ================== ЗАБРАТЬ ЧУЖОЕ ==================

    /**
     * Возвращает применённые записи: идентификатор → пришедший updatedAt.
     * Отправлять их обратно тем же обменом не нужно — но только пока мы их
     * не тронули, а сведение двойников трогает (§5.1), поэтому запоминается
     * не сам факт, а значение, с которым запись легла в базу.
     */
    async pull(ctx, since) {
        const applied = new Map();
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

                applied.set(remote.id, remote.updatedAt || 0);
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

        /*
         * Документ профиля нужен, чтобы у пользователя вообще была запись в
         * users и было видно, когда устройство выходило на связь.
         *
         * Но писать его при каждом обмене незачем: приложение
         * синхронизируется при каждом запуске и при каждом сворачивании, и
         * без этой проверки каждый такой раз стоил бы записи в Firestore,
         * даже когда отправлять было нечего.
         */
        if (sent > 0 || since === 0) {
            await setDoc(
                doc(ctx.db, 'users', ctx.uid),
                { lastSyncAt: Date.now(), app: 'workout' },
                { merge: true }
            );
        }

        return sent;
    },

    // ================== ПОЛНЫЙ ПРОХОД ==================

    async run({ silent = false } = {}) {
        if (!auth.isConfigured()) return { skipped: 'not-configured' };
        if (!sync.available) return { skipped: 'not-signed-in' };
        if (sync.inProgress) return { skipped: 'already-running' };

        sync.inProgress = true;
        if (!silent) emit('running', 'Синхронизация…');

        const startedAt = Date.now();
        const since = sync.getLastSync();

        try {
            // Поднимает SDK и восстанавливает сессию, если её ещё не поднимали
            await auth.init();

            // Сессия могла истечь или быть отозвана на стороне Google
            if (!auth.isSignedIn) {
                config.set('syncEnabled', false);
                if (!silent) emit('error', 'Вход больше не действует — войдите заново');
                return { skipped: 'signed-out' };
            }

            const ctx = await auth.context();

            const { applied, appliedRecords } = await sync.pull(ctx, since);

            // Между приёмом и отправкой: двойники приезжают именно с обменом
            // (§5.1), а сведение их переписывает тренировки и шаблоны — и это
            // должно уехать тем же разом, а не остаться до следующего
            const merged = await dbService.dedupeExercises();

            const sent = await sync.push(ctx, since, applied);

            sync.setLastSync(merge.nextSince(startedAt, appliedRecords));

            const result = { received: applied.size, sent, merged: merged.length, at: Date.now() };

            if (!silent) {
                // Про сведённые двойники сказать обязательно: обмен переписал
                // историю, и молчать об этом нельзя
                emit('done', [
                    result.received || result.sent
                        ? `Получено ${result.received}, отправлено ${result.sent}`
                        : 'Изменений нет',
                    result.merged ? `объединено двойников: ${result.merged}` : ''
                ].filter(Boolean).join(', '));
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
