/**
 * Английский словарь (§53 ТЗ).
 *
 * Ключ — русский текст с экрана, значение — английский. Порядок разделов
 * повторяет порядок экранов, а не алфавит: искать строку удобнее там же,
 * где она стоит в приложении.
 *
 * Перевод не дословный. «Тренировка» в заголовке раздела — это Workout, а
 * в строке «3 тренировки» — тоже workout, но склоняется иначе; такие места
 * разведены по разным ключам самой формулировкой. Где по-английски короче
 * сказать иначе — говорим иначе: место на кнопке одинаковое, а слова разной
 * длины.
 */

export const EN = {

    // ================== ОБЩЕЕ ==================

    'Трекер': 'Tracker',
    'Трекер тренировок': 'Workout Tracker',
    'Загрузка…': 'Loading…',
    'Отмена': 'Cancel',
    'Да': 'Yes',
    'Понятно': 'OK',
    'Сохранить': 'Save',
    'Изменить': 'Edit',
    'Удалить': 'Delete',
    'Готово': 'Done',
    'Пусто': 'Empty',
    'Ничего не найдено': 'Nothing found',
    'Поиск': 'Search',
    'Не удалось открыть раздел. Подробности в консоли.':
        'Could not open this section. Details are in the console.',

    // Единицы и подписи величин
    'кг': 'kg',
    'м': 'm',
    'км': 'km',
    'Вес, кг': 'Weight, kg',
    'Подходы': 'Sets',
    'Повторения': 'Reps',
    'Повторений': 'Reps',
    'Подходов': 'Sets',
    'Упражнений': 'Exercises',
    'Время': 'Time',
    'Тоннаж, кг': 'Volume, kg',
    'Повт. на подход': 'Reps per set',

    // ================== МЕНЮ ==================

    'Тренировка': 'Workout',
    'История': 'History',
    'Статистика': 'Stats',
    'Профиль': 'Profile',

    // ================== ГЛАВНАЯ ==================

    'Незавершённая тренировка': 'Unfinished workout',
    'Продолжить': 'Continue',
    'Завершить как есть': 'Finish as is',
    'Завершить прошедшей датой': 'Finish with its own date',
    'Прошло больше 12 часов. Продолжать её не стоит — время тренировки считается от старта.':
        'More than 12 hours have passed. Continuing is a bad idea — a workout is timed from its start.',
    'Начать': 'Start',
    'Повторить прошлую': 'Repeat last',
    'Пора по периодичности': 'Due by their own schedule',
    'собрать тренировку из них': 'build a workout from these',
    'Все шаблоны': 'All templates',
    'Создать шаблон': 'Create a template',
    'Новая тренировка': 'New workout',
    'Последние семь дней': 'Last seven days',
    'Тренировок': 'Workouts',
    'Вес тела': 'Body weight',
    'Пора тренироваться': 'Time to train',
    'Проведено {n}': 'Done: {n}',
    'Следующая — {день}': 'Next — {день}',
    '{n} без тренировки': '{n} without a workout',
    'Обычно раз в {n}': 'Usually every {n}',
    'Ещё {n} — и появится прогноз ритма': '{n} more and a rhythm forecast appears',
    'кг за месяц': 'kg this month',
    ', ритм рваный — день примерный': ', the rhythm is uneven — the day is a guess',
    'По чередованию дальше — «{тип}»': 'Next in the rotation — “{тип}”',
    'Дольше всего не было «{тип}»': '“{тип}” has been missing the longest',
    'Завершить тренировку?': 'Finish this workout?',
    'Записанные подходы сохранятся, остальное останется невыполненным.':
        'Recorded sets are kept; the rest stays undone.',
    'Завершить': 'Finish',
    'Удалить тренировку?': 'Delete this workout?',
    'Всё записанное в ней пропадёт.': 'Everything recorded in it will be lost.',
    'начата {день} в {время}': 'started {день} at {время}',
    '{done} из {planned} подходов': '{done} of {planned} sets',
    'и ещё {n}': 'and {n} more',

    // ================== ПЛАН ==================

    'План тренировки': 'Workout plan',
    'Порядок можно будет нарушить: приложение считает подходы, а не командует':
        'You can break the order: the app counts sets, it does not give orders',
    'Тип тренировки': 'Workout type',
    'Силовая': 'Strength',
    'Зарядка': 'Morning routine',
    'Табата': 'Tabata',
    'Кардио': 'Cardio',
    'Растяжка': 'Stretching',
    'Дома без инвентаря': 'Bodyweight at home',
    'Своё': 'Custom',
    'Упражнения': 'Exercises',
    'Упражнения — {n}': 'Exercises — {n}',
    '+ Добавить упражнение': '+ Add exercise',
    'Добавить упражнение': 'Add exercise',
    'Название упражнения': 'Exercise name',
    'Создать': 'Create',
    'Начать тренировку': 'Start workout',
    'Сохранить как шаблон': 'Save as template',
    '← На главную': '← Home',
    'Выше': 'Move up',
    'Ниже': 'Move down',
    'Убрать': 'Remove',
    'Последний раз: {что}': 'Last time: {что}',
    'Вес прикинут от веса тела — поправь под себя':
        'Weight estimated from your body weight — adjust it',
    'Отрезки': 'Intervals',
    'Работа, с': 'Work, s',
    'Отдых, с': 'Rest, s',
    'Кругов': 'Rounds',
    'Между кругами, с': 'Between rounds, s',
    'Добавь упражнения — и здесь появится длительность программы.':
        'Add exercises and the total time will appear here.',
    'всего {время}': '{время} total',
    'Тип тренировки:': 'Workout type:',
    'Название': 'Name',
    'Шаблон': 'Template',
    'Изменения не тронут уже проведённые тренировки — их план сохранён внутри них':
        'Changes will not touch finished workouts — their plan is stored inside them',
    'Название шаблона': 'Template name',
    'Название типа': 'Type name',
    'Грудь + трицепс': 'Chest + triceps',
    'Например: йога': 'For example: yoga',
    'Пока пусто. Добавь хотя бы одно упражнение.': 'Nothing here yet. Add at least one exercise.',
    'Сохранить шаблон': 'Save template',
    '← К шаблонам': '← To templates',
    'Упражнение': 'Exercise',

    // Виды упражнений: подсказка под названием в окне выбора
    'повторения и вес': 'reps and weight',
    'повторения': 'reps',
    'длительность': 'duration',
    'время и дистанция': 'time and distance',

    // ================== ВЫПОЛНЕНИЕ ==================

    'Выполнено': 'Done',
    'Ещё…': 'More…',
    'Свернуть': 'Collapse',
    '＋ заметка к подходу': '＋ note for this set',
    '− заметка к подходу': '− note for this set',
    'Пропустить упражнение': 'Skip exercise',
    'Добавить упражнение вне плана': 'Add an exercise outside the plan',
    'Заметка к тренировке': 'Workout note',
    'Заметка к упражнению': 'Exercise note',
    'Добавить заметку': 'Add a note',
    'Не заполнена.': 'Not filled in.',
    'Отдых': 'Rest',
    'Пропустить отдых': 'Skip rest',
    'Прошлый раз': 'Last time',
    'Рекорд': 'Record',
    'Новый рекорд': 'New record',
    'Подход': 'Set',
    'Прогресс': 'Progress',
    'Круг': 'Round',

    // ================== ИТОГИ ==================

    'Итоги тренировки': 'Workout summary',
    'Тренировка записана. Всё сохранено — можно закрывать.':
        'Workout recorded. Everything is saved — you can close this.',
    'Ни одного подхода не записано.': 'No sets were recorded.',
    'В историю': 'To history',
    '← В историю': '← To history',
    'Тренировка не найдена — возможно, она была удалена.':
        'Workout not found — it may have been deleted.',
    'Новый шаблон': 'New template',

    // ================== ДАТЫ И РИТМ ==================

    'Сегодня': 'Today',
    'Вчера': 'Yesterday',
    'сегодня': 'today',
    'вчера': 'yesterday'
};
