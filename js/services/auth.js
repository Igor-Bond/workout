/**
 * Вход через учётную запись Google (§38 ТЗ).
 *
 * SDK подключается динамическим import при первом обращении. Статические
 * импорты тянули бы почти мегабайт при каждом запуске — в том числе тем,
 * кто в облако не входит вообще и работает локально. А работать локально
 * приложение обязано: вход включает синхронизацию и не меняет ничего
 * другого.
 *
 * Всплывающее окно входа блокируется частью браузеров и не открывается в
 * установленном PWA, поэтому при неудаче используется вход переходом по
 * адресу.
 */

import { firebaseConfig } from '../firebase.config.js';

let sdk = null;
let firebaseApp = null;
let authInstance = null;
let firestoreInstance = null;

let currentUser = null;
let initialised = false;

const listeners = new Set();

function emit() {
    listeners.forEach((cb) => {
        try { cb(currentUser); } catch (e) { console.error('[Вход] Ошибка слушателя:', e); }
    });
}

export const auth = {

    /** Заполнен ли firebase.config.js. */
    isConfigured: () => !!firebaseConfig?.apiKey && !!firebaseConfig?.projectId,

    get user() { return currentUser; },
    get isSignedIn() { return !!currentUser; },

    /** Подписка на вход и выход. Возвращает функцию отписки. */
    onChange(callback) {
        listeners.add(callback);
        return () => listeners.delete(callback);
    },

    /**
     * Загрузка SDK и восстановление сессии.
     *
     * Вызывается лениво: при первом входе, при первой синхронизации и при
     * открытии профиля. Второй вызов ничего не делает.
     */
    async init() {
        if (initialised) return sdk;
        if (!auth.isConfigured()) throw new Error('Firebase не настроен: заполните js/firebase.config.js');

        const [app, authModule, firestore] = await Promise.all([
            import('../../vendor/firebase/firebase-app.js'),
            import('../../vendor/firebase/firebase-auth.js'),
            import('../../vendor/firebase/firebase-firestore.js')
        ]);

        sdk = { app, authModule, firestore };

        // Приложение могло быть поднято отправкой анкеты (§52), которой
        // вход не нужен: второй initializeApp с тем же именем — ошибка
        firebaseApp = app.getApps().length ? app.getApp() : app.initializeApp(firebaseConfig);
        authInstance = authModule.getAuth(firebaseApp);
        firestoreInstance = firestore.getFirestore(firebaseApp);

        // Сессия переживает перезапуск: заходить заново при каждом
        // открытии приложения на телефоне никто не станет
        await authModule.setPersistence(authInstance, authModule.browserLocalPersistence)
            .catch((e) => console.warn('[Вход] Не удалось включить постоянную сессию:', e));

        // Возврат после входа переходом по адресу
        await authModule.getRedirectResult(authInstance).catch(() => {});

        await new Promise((resolve) => {
            const stop = authModule.onAuthStateChanged(authInstance, (user) => {
                currentUser = user;
                emit();
                stop();
                resolve();
            });
        });

        authModule.onAuthStateChanged(authInstance, (user) => {
            currentUser = user;
            emit();
        });

        initialised = true;
        return sdk;
    },

    async signIn() {
        await auth.init();

        const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } = sdk.authModule;
        const provider = new GoogleAuthProvider();

        try {
            const result = await signInWithPopup(authInstance, provider);
            currentUser = result.user;
            emit();
            return currentUser;
        } catch (e) {
            // Всплывающее окно закрыл сам пользователь — это не ошибка
            if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') {
                return null;
            }

            console.warn('[Вход] Всплывающее окно не сработало, пробуем переходом:', e?.code);
            await signInWithRedirect(authInstance, provider);
            return null;
        }
    },

    /** Выход не удаляет локальные данные — только отключает обмен (§38). */
    async signOut() {
        if (!initialised) return;

        await sdk.authModule.signOut(authInstance);
        currentUser = null;
        emit();
    },

    /**
     * Контекст для синхронизации: функции Firestore и сама база.
     * Модуль обмена берёт их отсюда, а не импортирует сам, — иначе SDK
     * подтягивался бы при каждом запуске.
     */
    async context() {
        await auth.init();
        if (!currentUser) throw new Error('Не выполнен вход');

        return { fs: sdk.firestore, db: firestoreInstance, uid: currentUser.uid };
    }
};
