/**
 * Анкета тестировщика (§52 ТЗ) — вопросы и разбор ответов.
 *
 * Вынесено из экрана, потому что состав вопросов это содержание, а не
 * оформление: он меняется чаще разметки, читается отдельно от неё и
 * проверяется без браузера.
 *
 * Обязательный вопрос ровно один. Анкета, в которой обязательно всё,
 * собирает выдуманные ответы вместо пустых: человек дописывает что попало,
 * лишь бы форма отпустила. Модель телефона и версию приложение знает само
 * и спрашивать их не должно — эти сведения и раньше чаще всего вводили с
 * ошибкой.
 */

export const SECTIONS = [
    {
        title: 'О тебе',
        items: [
            { id: 'freq', type: 'one', required: true, label: 'Как часто тренируешься?',
              opts: ['Реже раза в неделю', '1–2 раза в неделю', '3–4 раза', '5 и больше'] },
            { id: 'where', type: 'one', label: 'Где тренируешься?',
              opts: ['Зал', 'Дома', 'Улица', 'По-разному'] },
            { id: 'before', type: 'one', label: 'Чем вёл записи раньше?',
              opts: ['Ничем', 'Бумага, блокнот', 'Заметки в телефоне', 'Другое приложение'] }
        ]
    },
    {
        title: 'Первые шаги',
        items: [
            { id: 'install', type: 'one', label: 'Поставил на домашний экран?',
              opts: ['Да', 'Нет, пользуюсь в браузере', 'Не нашёл как'] },
            { id: 'first', type: 'one', label: 'Сколько заняло провести первую тренировку?',
              opts: ['Меньше 5 минут', '5–15 минут', 'Больше 15 минут', 'Так и не дошёл'] },
            { id: 'guide', type: 'one', label: 'Раздел «Как пользоваться» в профиле',
              opts: ['Нашёл, помог', 'Нашёл, не помог', 'Не нашёл', 'Не открывал'] },
            { id: 'unclear', type: 'area', label: 'Что было непонятно с первого взгляда?',
              hint: 'Самое ценное во всей анкете. Непонятное — это мой недосмотр, а не твоя невнимательность.',
              placeholder: 'Например: не понял, чем шаблон отличается от повтора прошлой' }
        ]
    },
    {
        title: 'Что успел попробовать',
        items: [
            { id: 'used', type: 'many', label: 'Отметь всё, до чего добрался',
              opts: ['План с нуля', 'Шаблон', 'Повтор прошлой', 'Таймер отдыха', 'Табата',
                     'История', 'Статистика', 'Личные рекорды', 'Календарь', 'Вес тела',
                     'Справочник упражнений', 'Синхронизация с Google', 'Резервная копия'] }
        ]
    },
    {
        title: 'Оценки',
        hint: '1 — плохо, 5 — отлично. Раздел, которым не пользовался, лучше пропустить.',
        items: [
            { id: 'r_clear', type: 'scale', label: 'Понятность: ясно ли, что нажимать' },
            { id: 'r_speed', type: 'scale', label: 'Скорость работы' },
            { id: 'r_look', type: 'scale', label: 'Внешний вид' },
            { id: 'r_during', type: 'scale', label: 'Удобство прямо во время тренировки' },
            { id: 'r_stats', type: 'scale', label: 'Полезность истории и статистики' }
        ]
    },
    {
        title: 'Табата',
        hint: 'Интервальный режим: 20 секунд работы, 10 отдыха, восемь кругов. Пропусти раздел, если не пробовал.',
        items: [
            { id: 't_sound', type: 'one', label: 'Сигналы во время программы',
              opts: ['Хорошо слышно', 'Слишком тихо', 'Не слышал вообще', 'Не пробовал табату'] },
            { id: 't_clear', type: 'one', label: 'Понятно по звуку, где работа, а где пауза?',
              opts: ['Да, сразу', 'Не всегда', 'Нет', 'Не пробовал'] },
            { id: 't_voice', type: 'one', label: 'Голос называет следующее упражнение',
              opts: ['Вовремя и к месту', 'Опаздывает', 'Мешает, выключил', 'Не слышал голоса', 'Не пробовал'] },
            { id: 't_wish', type: 'area', label: 'Что бы поменял в табате?',
              placeholder: 'Длительности, сигналы, что показано на экране' }
        ]
    },
    {
        title: 'Что сломалось',
        items: [
            { id: 'bug', type: 'area', label: 'Что повело себя не так?',
              hint: 'По порядку: на каком экране, что нажал, что ожидал, что вышло.',
              placeholder: 'Можно несколько случаев подряд' }
        ]
    },
    {
        title: 'Дальше',
        items: [
            { id: 'missing', type: 'area', label: 'Чего не хватает больше всего?',
              placeholder: 'Одна вещь, которую стоит сделать в первую очередь' },
            { id: 'back', type: 'one', label: 'Будешь пользоваться дальше?',
              opts: ['Да', 'Возможно', 'Нет'] },
            { id: 'why', type: 'area', label: 'Почему?', placeholder: 'Коротко' }
        ]
    },
    {
        title: 'Связь',
        hint: 'Необязательно. Нужно только чтобы уточнить детали по твоему ответу.',
        items: [
            { id: 'name', type: 'text', label: 'Как обращаться', placeholder: 'Имя' },
            { id: 'tg', type: 'text', label: 'Telegram', placeholder: '@ник' }
        ]
    }
];

/** Все вопросы подряд — по ним собирается и проверяется ответ. */
export const QUESTIONS = SECTIONS.reduce((list, s) => list.concat(s.items), []);

export const survey = {

    SECTIONS,
    QUESTIONS,

    find: (id) => QUESTIONS.find((q) => q.id === id) || null,

    /**
     * Ответ к отправке: только заполненное.
     *
     * Пустые поля не отправляются вовсе. Ключ со значением «» в разборе
     * неотличим от ответа «ничего», а разница между ними существенная:
     * пропущенный вопрос это не мнение.
     */
    compose(values = {}) {
        const answers = {};

        for (const q of QUESTIONS) {
            const raw = values[q.id];

            if (raw === null || raw === undefined) continue;

            if (q.type === 'many') {
                if (Array.isArray(raw) && raw.length) answers[q.id] = raw.slice();
                continue;
            }

            if (q.type === 'scale') {
                if (Number.isFinite(raw)) answers[q.id] = raw;
                continue;
            }

            const text = String(raw).trim();
            if (text) answers[q.id] = text;
        }

        return answers;
    },

    /** Незаполненные обязательные вопросы. */
    missing(answers = {}) {
        return QUESTIONS.filter((q) => q.required && answers[q.id] === undefined);
    },

    /**
     * Ответ обычным текстом — на случай, когда отправить не вышло.
     *
     * Потерянный ответ хуже неудобного: человек уже потратил пять минут, и
     * предложить ему набрать всё заново вместо готового текста нельзя.
     */
    asText(entry = {}) {
        const answers = entry.answers || {};
        const lines = ['Отзыв о приложении «Трекер»', ''];

        for (const section of SECTIONS) {
            const filled = section.items.filter((q) => answers[q.id] !== undefined);
            if (filled.length === 0) continue;

            lines.push(`— ${section.title} —`);

            for (const q of filled) {
                const value = answers[q.id];
                lines.push(`${q.label}: ${Array.isArray(value) ? value.join(', ') : value}`);
            }

            lines.push('');
        }

        const about = entry.about || {};
        const keys = Object.keys(about);

        if (keys.length) {
            lines.push('— Об устройстве —');
            for (const key of keys) lines.push(`${key}: ${about[key]}`);
        }

        return lines.join('\n').trim();
    }
};
