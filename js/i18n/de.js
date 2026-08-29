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

    // ================== СТАТИСТИКА И РЕКОРДЫ ==================

    'Месяц': 'Monat',
    '3 месяца': '3 Monate',
    'Год': 'Jahr',
    'Всё время': 'Gesamt',
    'Общее время': 'Gesamtzeit',
    'Подх. / трен.': 'Sätze / Training',
    'Повт. / подх.': 'Wdh. / Satz',
    'Средняя длит.': 'Ø Dauer',
    'Изменение — к предыдущему такому же периоду.': 'Veränderung gegenüber dem gleich langen Zeitraum davor.',
    'Подходы по тренировкам': 'Sätze pro Training',
    'Вес тела не отмечался. Он нужен, чтобы подтягивания и отжимания перестали считаться нулевой нагрузкой.':
        'Kein Körpergewicht erfasst. Ohne es zählen Klimmzüge und Liegestütze als Null-Belastung.',
    'Отметить вес сегодня': 'Gewicht heute eintragen',
    'Постоянство': 'Beständigkeit',
    'Недель подряд': 'Wochen in Folge',
    'Рекорд недель': 'Beste Wochenserie',
    'Дней подряд': 'Tage in Folge',
    'Дней с тренировкой': 'Tage mit Training',
    'По дням недели': 'Nach Wochentagen',
    'По дням': 'Nach Tagen',
    'Насыщенность — по количеству подходов за день. Карта листается вбок.':
        'Die Färbung zeigt die Sätze pro Tag. Die Karte lässt sich seitlich scrollen.',
    'без тренировки': 'kein Training',
    'Объём по группам мышц': 'Volumen nach Muskelgruppen',
    'Личные рекорды': 'Persönliche Rekorde',
    'Упражнение, где рекорд давно не двигался, видно сразу — с этого и начинается список':
        'Eine Übung, deren Rekord lange stillsteht, steht ganz oben',
    'Давние сверху': 'Älteste zuerst',
    'Свежие сверху': 'Neueste zuerst',
    'По названию': 'Nach Name',
    'По группе': 'Nach Gruppe',
    'Обновлено за месяц': 'Diesen Monat verbessert',
    'держится {n}': 'hält seit {n}',
    '← К статистике': '← Zur Statistik',
    'повт.': 'Wdh.',
    'с': 's',
    'Динамика': 'Verlauf',
    'Лучший результат': 'Bestes Ergebnis',
    'Тренировок': 'Trainings',
    'С весом тела, кг': 'Mit Körpergewicht, kg',
    'К своему весу': 'Im Verhältnis zum Körpergewicht',
    'Последний раз': 'Zuletzt',
    'Отметить в статистике': 'In der Statistik eintragen',
    'рабочий результат': 'Arbeitsergebnis',
    'объём': 'Volumen',
    'тренд': 'Trend',
    'Упражнение не найдено.': 'Übung nicht gefunden.',
    'Это упражнение ещё ни разу не выполнялось.': 'Diese Übung wurde noch nie gemacht.',
    '← К рекордам': '← Zu den Rekorden',
    'в архиве': 'archiviert',
    'Силовое с весом': 'Mit Gewicht',
    'Собственный вес': 'Körpergewicht',
    'На время': 'Auf Zeit',

    // ================== СПРАВОЧНИК ==================

    'Справочник упражнений': 'Übungskatalog',
    'История упражнения держится на его записи здесь, поэтому используемое упражнение можно только архивировать':
        'Der Verlauf einer Übung hängt an ihrem Eintrag hier — eine benutzte Übung lässt sich nur archivieren',
    'В работе — {n}': 'In Benutzung — {n}',
    'Архив — {n}': 'Archiv — {n}',
    'Все упражнения в архиве.': 'Alle Übungen sind archiviert.',
    '← В профиль': '← Zum Profil',
    'Объединить с другим': 'Mit einer anderen zusammenführen',
    'В архив': 'Archivieren',
    'Вернуть из архива': 'Aus dem Archiv holen',
    'отдых {время}': 'Pause {время}',
    'Новое упражнение': 'Neue Übung',
    'Жим лёжа': 'Bankdrücken',
    'Вид': 'Art',
    'Группа мышц (необязательно)': 'Muskelgruppe (optional)',
    'Группа мышц': 'Muskelgruppe',
    'Грудь': 'Brust',
    'Добавить': 'Hinzufügen',
    'Такое упражнение уже есть': 'Diese Übung gibt es schon',
    '«{имя}» уже в справочнике{архив}.': '„{имя}“ ist bereits im Katalog{архив}.',
    ', сейчас в архиве': ', derzeit archiviert',

    // ================== ПРОФИЛЬ ==================

    'Как пользоваться приложением': 'So benutzt du die App',
    'Язык': 'Sprache',
    'Язык интерфейса. Названия упражнений и заметки остаются такими, какими записаны.':
        'Sprache der Oberfläche. Übungsnamen und Notizen bleiben so, wie du sie eingetragen hast.',
    'Порядок упражнений': 'Reihenfolge der Übungen',
    'По кругу': 'Im Kreis',
    'По одному': 'Nacheinander',
    'Свободный': 'Frei',
    'После подхода — следующее упражнение плана': 'Nach einem Satz die nächste Übung im Plan',
    'Пока не закрыт план упражнения': 'Bis die geplanten Sätze der Übung erledigt sind',
    'Упражнение выбираешь сам': 'Du wählst die Übung selbst',
    'Не гасить экран': 'Bildschirm anlassen',
    'Во время тренировки': 'Während des Trainings',
    'Полноэкранный режим': 'Vollbild',
    'Скрывает системные панели всё время работы': 'Blendet die Systemleisten dauerhaft aus',
    'Сейчас': 'Jetzt',
    'включён': 'an',
    'выключен': 'aus',
    'браузер не умеет': 'Browser kann es nicht',
    'во весь экран с запуска': 'Vollbild ab dem Start',
    'Отказ браузера': 'Browser hat abgelehnt',
    'Включить сейчас': 'Jetzt einschalten',
    'Браузер отказал': 'Der Browser hat abgelehnt',
    'Отдых и сигналы': 'Pause und Signale',
    'Таймер отдыха': 'Pausentimer',
    'Запускается после записи подхода': 'Startet, sobald ein Satz erfasst ist',
    'Длительность отдыха:': 'Pausenlänge:',
    'Звук по окончании': 'Ton am Ende',
    'Он же управляет сигналами интервальной программы': 'Er steuert auch die Signale des Intervallprogramms',
    'Вибрация по окончании': 'Vibration am Ende',
    'Проговаривать упражнения': 'Übungen ansagen',
    'В интервальной программе — название следующего вслух': 'Im Intervallprogramm wird die nächste Übung angesagt',
    'Данные': 'Daten',
    'Шаблонов': 'Vorlagen',
    'Синхронизация': 'Synchronisierung',
    'Не настроена. Приложение работает локально: тренировки, история и статистика на месте, просто не переносятся между устройствами.':
        'Nicht eingerichtet. Die App läuft lokal: Trainings, Verlauf und Statistik sind da, sie wandern nur nicht zwischen Geräten.',
    'Вход не выполнен. Локальные данные при входе не стираются — они объединятся с облачными.':
        'Nicht angemeldet. Beim Anmelden gehen lokale Daten nicht verloren — sie werden mit der Cloud zusammengeführt.',
    'Войти через Google': 'Mit Google anmelden',
    'Учётная запись': 'Konto',
    'Последний обмен': 'Letzte Synchronisierung',
    'ещё не было': 'noch keine',
    'вход выполнен': 'angemeldet',
    'Синхронизировать': 'Jetzt synchronisieren',
    'Полный обмен заново': 'Vollständig neu synchronisieren',
    'Выйти': 'Abmelden',
    'Выход не удаляет локальные данные. Незавершённая тренировка в облако не уезжает — она живёт только на этом устройстве.':
        'Abmelden löscht keine lokalen Daten. Ein nicht beendetes Training verlässt dieses Gerät nie.',
    'Резервная копия': 'Sicherungskopie',
    'Файл на диске не зависит от облака и учётной записи — это копия, которая целиком в твоих руках.':
        'Eine Datei hängt weder an der Cloud noch an einem Konto — diese Kopie gehört ganz dir.',
    'Выгрузить в файл': 'In eine Datei sichern',
    'Загрузить из файла': 'Aus einer Datei laden',
    'Установка': 'Installation',
    'Приложение уже установлено.': 'Die App ist bereits installiert.',
    'Установить приложение': 'App installieren',
    'Браузер пока не предложил установку. Она станет доступна после нескольких заходов.':
        'Der Browser hat die Installation noch nicht angeboten. Sie erscheint nach ein paar Besuchen.',
    'Установка делается вручную: «Поделиться» → «На экран Домой».':
        'Von Hand installieren: Teilen → Zum Home-Bildschirm.',
    'О приложении': 'Über die App',
    'Версия': 'Version',
    'Хранилище': 'Speicher',
    'Оставить отзыв': 'Feedback geben',
    'Проверить обновление': 'Nach Update suchen',
    'Сбросить настройки': 'Einstellungen zurücksetzen',
    'Перенесено из версии 1': 'Aus Version 1 übernommen',
    'Чтобы включить — заполнить': 'Zum Einschalten ausfüllen:',
    'Порядок в': 'Anleitung in',
    'Отметить вес': 'Gewicht eintragen',
    '{т} трен. / {п} подх.': '{т} Trainings / {п} Sätze',

    // ================== ДАТЫ ==================

    'Сегодня': 'Heute',
    'Вчера': 'Gestern',
    'сегодня': 'heute',
    'вчера': 'gestern'
};
