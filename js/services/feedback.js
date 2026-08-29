/**
 * Отправка анкеты тестировщика (§52 ТЗ).
 *
 * Ящик без обратной стороны: ответ можно положить, достать нельзя.
 * Правила Firestore разрешают здесь только создание — ни чтения, ни правки,
 * ни удаления. Поэтому анкета открыта любому, кому дали ссылку, и при этом
 * ответ одного тестировщика не виден другому. Хранить их в самой странице
 * было бы проще, но там их прочёл бы каждый.
 *
 * Вход не нужен и не предлагается. Человек, которого позвали посмотреть
 * приложение, не должен ради отзыва заводить отношения с учётной записью.
 *
 * SDK подтягивается динамическим import и только в момент отправки:
 * восемьсот килобайт ради анкеты, которую большинство даже не откроет,
 * грузить при запуске нельзя.
 */

import { firebaseConfig } from '../firebase.config.js';
import { VERSION } from '../version.js';
import { config } from '../config.js';
import { dbService } from './db.js';

/** Куда складывать. Отдельная коллекция верхнего уровня, вне /users. */
const COLLECTION = 'feedback';

export const feedback = {

    /** Есть ли куда отправлять. Без настроек Firebase остаётся запасной путь. */
    get available() {
        return !!firebaseConfig?.apiKey && !!firebaseConfig?.projectId;
    },

    /**
     * Сведения, которые приложение знает о себе само.
     *
     * Раньше они были вопросами анкеты — «модель телефона и браузер», — и
     * отвечали на них с ошибками чаще, чем без. Заодно видно, сколько
     * человек успел наработать: оценка от того, кто провёл одну тренировку,
     * и от того, кто провёл двадцать, весит по-разному.
     *
     * Показывается в анкете целиком, до отправки: собирать о человеке
     * молча то, чего он не видел, нельзя.
     */
    async about() {
        const out = {
            'Версия приложения': VERSION,
            'Браузер': (navigator.userAgent || '').slice(0, 300),
            'Язык': navigator.language || '—',
            'Экран': `${window.screen?.width || 0}×${window.screen?.height || 0}`,
            'Установлено на экран': matchMedia('(display-mode: standalone)').matches ? 'да' : 'нет',
            'Синхронизация': config.get('syncEnabled') ? 'включена' : 'выключена'
        };

        try {
            const counts = await dbService.stats();

            out['Проведено тренировок'] = String(counts.workouts);
            out['Записано подходов'] = String(counts.sets);

            const entries = await dbService.listWorkoutSummaries();
            const табат = entries.filter((e) => e.workout && e.workout.interval).length;

            out['Из них интервальных'] = String(табат);
        } catch (e) {
            // База может быть недоступна — анкету это отменять не должно
            out['Проведено тренировок'] = '—';
        }

        return out;
    },

    /**
     * Отправка. Бросает, если не вышло: разобраться с этим должен экран —
     * он покажет ответ текстом, чтобы человек отправил его сам.
     */
    async send(entry) {
        if (!feedback.available) throw new Error('Firebase не настроен');

        const [app, firestore] = await Promise.all([
            import('../../vendor/firebase/firebase-app.js'),
            import('../../vendor/firebase/firebase-firestore.js')
        ]);

        // Приложение Firebase может быть уже поднято входом в учётную
        // запись: второй initializeApp с тем же именем — ошибка
        const instance = app.getApps().length ? app.getApp() : app.initializeApp(firebaseConfig);
        const db = firestore.getFirestore(instance);

        const doc = await firestore.addDoc(firestore.collection(db, COLLECTION), {
            at: entry.at,
            answers: entry.answers,
            about: entry.about
        });

        return doc.id;
    }
};
