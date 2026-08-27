/**
 * Настройки проекта Firebase (§38, §39 ТЗ).
 *
 * Эти значения не секретны. Google по замыслу встраивает их в клиентский
 * код, и любой посетитель сайта их видит. Данные защищают правила доступа
 * из docs/firestore.rules — и ничто больше. Поэтому правила обязательно
 * должны быть загружены в консоль: без них база открыта всем.
 *
 * Сервисный ключ проекта (файл JSON с private_key) — совсем другое дело:
 * он даёт полный доступ в обход правил, приложению не нужен и в
 * репозитории ему не место.
 *
 * Пока поля пустые, приложение работает полностью, просто без облака.
 * Порядок настройки — в docs/DEPLOY.md.
 */

export const firebaseConfig = {
    apiKey: 'AIzaSyCrJQ6IvI7b9dbW3PM0nsJSxYnMQj63An0',
    authDomain: 'workout-tracker-456fc.firebaseapp.com',
    projectId: 'workout-tracker-456fc',
    storageBucket: 'workout-tracker-456fc.firebasestorage.app',
    messagingSenderId: '517434245111',
    appId: '1:517434245111:web:72e1d6523f8b6e177578f2'
};
