/**
 * Немецкий словарь (§53 ТЗ).
 *
 * Ключ — русский текст с экрана, значение — немецкий. Порядок разделов
 * повторяет порядок экранов, а не алфавит.
 *
 * Немецкий длиннее русского и заметно длиннее английского: «Trainingsplan»
 * против «плана», «Wiederholungen» против «повторений». Там, где строка
 * стоит на кнопке или в узкой колонке, взято короткое слово, даже если
 * длинное точнее: «Wdh.» вместо «Wiederholungen» в заголовке столбца — это
 * обычное сокращение, понятное любому, кто был в спортзале.
 */

export const DE = {

    // ================== ОБЩЕЕ ==================

    'Трекер': 'Tracker',
    'Трекер тренировок': 'Trainingstracker',
    'Загрузка…': 'Lädt…',
    'Отмена': 'Abbrechen',
    'Да': 'Ja',
    'Понятно': 'Verstanden',
    'Сохранить': 'Speichern',
    'Изменить': 'Ändern',
    'Удалить': 'Löschen',
    'Готово': 'Fertig',
    'Пусто': 'Leer',
    'Ничего не найдено': 'Nichts gefunden',
    'Поиск': 'Suche',
    'Не удалось открыть раздел. Подробности в консоли.':
        'Dieser Bereich konnte nicht geöffnet werden. Details in der Konsole.',

    // Единицы и подписи величин
    'кг': 'kg',
    'м': 'm',
    'км': 'km',
    'Вес, кг': 'Gewicht, kg',
    'Подходы': 'Sätze',
    'Повторения': 'Wdh.',
    'Повторений': 'Wdh.',
    'Подходов': 'Sätze',
    'Упражнений': 'Übungen',
    'Время': 'Zeit',
    'Тоннаж, кг': 'Volumen, kg',
    'Повт. на подход': 'Wdh. pro Satz',

    // ================== МЕНЮ ==================

    'Тренировка': 'Training',
    'История': 'Verlauf',
    'Статистика': 'Statistik',
    'Профиль': 'Profil',

    // ================== ГЛАВНАЯ ==================

    'Незавершённая тренировка': 'Nicht beendetes Training',
    'Продолжить': 'Fortsetzen',
    'Завершить как есть': 'So beenden',
    'Завершить прошедшей датой': 'Mit eigenem Datum beenden',
    'Прошло больше 12 часов. Продолжать её не стоит — время тренировки считается от старта.':
        'Es sind mehr als 12 Stunden vergangen. Fortsetzen lohnt nicht — ein Training wird ab dem Start gezählt.',
    'Начать': 'Starten',
    'Повторить прошлую': 'Letztes wiederholen',
    'Пора по периодичности': 'Nach eigenem Rhythmus fällig',
    'собрать тренировку из них': 'daraus ein Training bauen',
    'Все шаблоны': 'Alle Vorlagen',
    'Создать шаблон': 'Vorlage erstellen',
    'Новая тренировка': 'Neues Training',
    'Последние семь дней': 'Letzte sieben Tage',
    'Тренировок': 'Trainings',
    'Вес тела': 'Körpergewicht',
    'Пора тренироваться': 'Zeit zu trainieren',
    'Проведено {n}': 'Absolviert: {n}',
    'Следующая — {день}': 'Nächstes — {день}',
    '{n} без тренировки': '{n} ohne Training',
    'Обычно раз в {n}': 'Normalerweise alle {n}',
    'Ещё {n} — и появится прогноз ритма': 'Noch {n} — dann erscheint die Rhythmusprognose',
    'кг за месяц': 'kg diesen Monat',
    ', ритм рваный — день примерный': ', der Rhythmus ist unregelmäßig — das Datum ist geschätzt',
    'По чередованию дальше — «{тип}»': 'Als Nächstes im Wechsel — „{тип}“',
    'Дольше всего не было «{тип}»': '„{тип}“ fehlt am längsten',
    'Завершить тренировку?': 'Training beenden?',
    'Записанные подходы сохранятся, остальное останется невыполненным.':
        'Erfasste Sätze bleiben gespeichert, der Rest bleibt offen.',
    'Завершить': 'Beenden',
    'Удалить тренировку?': 'Training löschen?',
    'Всё записанное в ней пропадёт.': 'Alles darin Erfasste geht verloren.',
    'начата {день} в {время}': 'begonnen {день} um {время}',
    '{done} из {planned} подходов': '{done} von {planned} Sätzen',
    'и ещё {n}': 'und {n} weitere',

    // ================== ПЛАН ==================

    'План тренировки': 'Trainingsplan',
    'Порядок можно будет нарушить: приложение считает подходы, а не командует':
        'Die Reihenfolge darfst du ändern: die App zählt Sätze, sie befiehlt nicht',
    'Тип тренировки': 'Trainingsart',
    'Силовая': 'Kraft',
    'Зарядка': 'Morgengymnastik',
    'Табата': 'Tabata',
    'Кардио': 'Cardio',
    'Растяжка': 'Dehnen',
    'Дома без инвентаря': 'Zuhause ohne Geräte',
    'Своё': 'Eigene',
    'Упражнения': 'Übungen',
    'Упражнения — {n}': 'Übungen — {n}',
    '+ Добавить упражнение': '+ Übung hinzufügen',
    'Добавить упражнение': 'Übung hinzufügen',
    'Название упражнения': 'Name der Übung',
    'Создать': 'Erstellen',
    'Начать тренировку': 'Training starten',
    'Сохранить как шаблон': 'Als Vorlage speichern',
    '← На главную': '← Zur Startseite',
    'Выше': 'Nach oben',
    'Ниже': 'Nach unten',
    'Убрать': 'Entfernen',
    'Последний раз: {что}': 'Letztes Mal: {что}',
    'Вес прикинут от веса тела — поправь под себя':
        'Gewicht aus deinem Körpergewicht geschätzt — passe es an',
    'Отрезки': 'Intervalle',
    'Работа, с': 'Arbeit, s',
    'Отдых, с': 'Pause, s',
    'Кругов': 'Runden',
    'Между кругами, с': 'Zwischen den Runden, s',
    'Добавь упражнения — и здесь появится длительность программы.':
        'Füge Übungen hinzu — dann erscheint hier die Gesamtdauer.',
    'всего {время}': '{время} gesamt',
    'Название': 'Name',
    'Шаблон': 'Vorlage',
    'Изменения не тронут уже проведённые тренировки — их план сохранён внутри них':
        'Änderungen betreffen bereits absolvierte Trainings nicht — deren Plan ist in ihnen gespeichert',
    'Название шаблона': 'Name der Vorlage',
    'Название типа': 'Name der Art',
    'Грудь + трицепс': 'Brust + Trizeps',
    'Например: йога': 'Zum Beispiel: Yoga',
    'Пока пусто. Добавь хотя бы одно упражнение.': 'Noch leer. Füge mindestens eine Übung hinzu.',
    'Сохранить шаблон': 'Vorlage speichern',
    '← К шаблонам': '← Zu den Vorlagen',
    'Упражнение': 'Übung',

    // Виды упражнений: подсказка под названием в окне выбора
    'повторения и вес': 'Wiederholungen und Gewicht',
    'повторения': 'Wiederholungen',
    'длительность': 'Dauer',
    'время и дистанция': 'Zeit und Distanz',

    // ================== ВЫПОЛНЕНИЕ ==================

    'Выполнено': 'Erledigt',
    'Ещё…': 'Mehr…',
    'Свернуть': 'Einklappen',
    '＋ заметка к подходу': '＋ Notiz zum Satz',
    '− заметка к подходу': '− Notiz zum Satz',
    'Пропустить упражнение': 'Übung überspringen',
    'Добавить упражнение вне плана': 'Übung außerhalb des Plans',
    'Заметка к тренировке': 'Notiz zum Training',
    'Заметка к упражнению': 'Notiz zur Übung',
    'Добавить заметку': 'Notiz hinzufügen',
    'Не заполнена.': 'Nicht ausgefüllt.',
    'Отдых': 'Pause',
    'Пропустить отдых': 'Pause überspringen',
    'Прошлый раз': 'Letztes Mal',
    'Рекорд': 'Rekord',
    'Новый рекорд': 'Neuer Rekord',
    'Подход': 'Satz',
    'Прогресс': 'Fortschritt',
    'Круг': 'Runde',

    // ================== ИСТОРИЯ, КАЛЕНДАРЬ, ШАБЛОНЫ ==================

    'Всё проведённое: поиск, отбор по типу и по упражнению':
        'Alles Absolvierte: Suche, Filter nach Art und nach Übung',
    'Список': 'Liste',
    'Календарь': 'Kalender',
    'Поиск по упражнению, типу или заметке': 'Suche nach Übung, Art oder Notiz',
    'Все': 'Alle',
    'Фильтр по упражнению': 'Nach Übung filtern',
    'Упражнение: {что}': 'Übung: {что}',
    'Сбросить': 'Zurücksetzen',
    'Проведённых тренировок пока нет.': 'Noch keine abgeschlossenen Trainings.',
    'Под фильтры ничего не подходит.': 'Nichts passt zu den Filtern.',
    'Показать ещё {n} из {всего}': 'Weitere {n} von {всего} anzeigen',
    'Без упражнений': 'Ohne Übungen',
    'упражнение': 'Übung',
    'Месяц целиком: насыщенность дня — по объёму':
        'Ein ganzer Monat: je dunkler der Tag, desto mehr Volumen',
    'Предыдущий месяц': 'Voriger Monat',
    'Следующий месяц': 'Nächster Monat',
    'Без тренировки': 'Kein Training',
    'В этом месяце тренировок не было': 'In diesem Monat gab es keine Trainings',
    'В этот день тренировок не было.': 'An diesem Tag gab es keine Trainings.',
    'Шаблоны': 'Vorlagen',
    'Сохранённая тренировка, которую можно запускать сколько угодно раз':
        'Ein gespeichertes Training, das du beliebig oft starten kannst',
    'Шаблонов пока нет. Их можно создать здесь или сохранить из проведённой тренировки в её итогах.':
        'Noch keine Vorlagen. Erstelle eine hier oder speichere sie aus einem abgeschlossenen Training im Ergebnis.',
    '+ Создать шаблон': '+ Vorlage erstellen',
    'Дублировать': 'Duplizieren',
    'Удалить «{имя}»?': '„{имя}“ löschen?',
    'Проведённые по нему тренировки останутся в истории — план хранится внутри каждой из них.':
        'Damit absolvierte Trainings bleiben im Verlauf — jedes hat seine eigene Kopie des Plans.',

    // ================== ИТОГИ ==================

    'Итоги тренировки': 'Trainingsergebnis',
    'Тренировка записана. Всё сохранено — можно закрывать.':
        'Training erfasst. Alles ist gespeichert — du kannst schließen.',
    'Ни одного подхода не записано.': 'Kein einziger Satz erfasst.',
    'В историю': 'Zum Verlauf',
    '← В историю': '← Zum Verlauf',
    'Тренировка не найдена — возможно, она была удалена.':
        'Training nicht gefunden — vielleicht wurde es gelöscht.',
    'Новый шаблон': 'Neue Vorlage',

    // ================== ДАТЫ ==================

    'Сегодня': 'Heute',
    'Вчера': 'Gestern',
    'сегодня': 'heute',
    'вчера': 'gestern'
};
