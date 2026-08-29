/**
 * Содержание справки «Как пользоваться» (§51, §53).
 *
 * Здесь, в отличие от остального перевода, текст лежит не словарём, а
 * документом на каждом языке. Причина в жанре: справка это связная проза,
 * и переведённая по одной фразе она читается как переведённая. Абзац,
 * написанный сразу по-английски, короче и понятнее того же абзаца,
 * пересказанного с русского.
 *
 * Разметки в тексте нет — только виды блоков:
 *
 *   p       обычный абзац
 *   hint    приписка помельче
 *   example пример с полосой слева
 *   sub     подзаголовок внутри раздела
 *   steps   нумерованный порядок действий
 *   rows    «понятие — пояснение»
 *   sounds  таблица сигналов с кнопками прослушивания
 *
 * Выделение внутри строки — звёздочками: *Новая тренировка*. Так текст
 * остаётся текстом, и в нём нельзя случайно оставить незакрытый тег.
 */

const RU = {
    title: 'Как пользоваться',
    sub: 'Что здесь есть, в каком порядке этим пользоваться и что стоит включить сразу',

    sections: [
        {
            name: 'С чего начать',
            open: true,
            blocks: [
                { p: 'Приложение ведёт журнал: что ты сделал, сколько раз и с каким весом. План — это намерение, а не приказ: порядок можно нарушить, лишние подходы записать, обещанные пропустить. Ничего не потеряется.' },
                { steps: [
                    'На главной — *Новая тренировка*.',
                    'Выбери тип (*Силовая*, *Зарядка*, *Табата*…) и нажми *Добавить упражнение*. В окне выбора есть поиск и плашки групп — «Грудь», «Ноги», «Пресс»: по группе искать быстрее, чем вспоминать название.',
                    'У каждой строки задай подходы, повторы и вес. Если ты делал это упражнение раньше, подставится прошлый результат. Если нет, а вес тела отмечен — вес будет прикинут, и подпись об этом скажет: поправь под себя.',
                    '*Начать тренировку* — откроется экран выполнения.',
                    'Сделал подход — *Выполнено*. Числа уже подставлены, обычно менять нечего. После записи пойдёт отдых.',
                    'Когда всё — *Завершить*. Появятся итоги, а из них можно сохранить состав шаблоном, чтобы в следующий раз не собирать заново.'
                ] },
                { example: 'Пример. Силовая: жим лёжа 3×8 · тяга в наклоне 3×10 · подъём на бицепс 3×12. Девять подходов, минут сорок вместе с отдыхом.' }
            ]
        },
        {
            name: 'Четыре раздела: где что искать',
            blocks: [
                { rows: [
                    ['Тренировка', 'Начать новую или продолжить незавершённую. Здесь же ритм — когда была прошлая и когда ждать следующую, — последние семь дней и вес тела.'],
                    ['История', 'Все проведённые тренировки. Поиск, отбор по типу и по упражнению, отдельная плашка «Табата». Карточку можно открыть и поправить: числа подхода, заметки, удаление.'],
                    ['Статистика', 'Общие итоги за период, разбор по упражнениям, личные рекорды, динамика результата, дни недели и серии, карта года по дням.'],
                    ['Профиль', 'Настройки, справочник упражнений, синхронизация, резервная копия и эта справка.']
                ] },
                { hint: 'Внизу (на компьютере — слева) четыре раздела, между ними и переключается приложение. Кнопка «назад» в браузере работает как обычно.' }
            ]
        },
        {
            name: 'Быстрые способы начать',
            blocks: [
                { p: 'Собирать план с нуля каждый раз не нужно — есть три короткие дороги.' },
                { rows: [
                    ['Повторить прошлую', 'Верхняя карточка на главной. Берёт не план прошлой тренировки, а то, что в ней было фактически сделано.'],
                    ['Пора по периодичности', 'Появляется, когда какие-то упражнения не делались дольше обычного для них срока. Приложение предложит собрать тренировку именно из них.'],
                    ['Шаблоны', 'Сохранённый состав. Плашки под карточкой повтора — четыре последних, остальные по кнопке «Все шаблоны». Шаблон можно менять и дублировать; на уже проведённые тренировки правка не влияет.']
                ] }
            ]
        },
        {
            name: 'Во время тренировки',
            blocks: [
                { rows: [
                    ['Запись подхода', 'Поля уже заполнены прошлым результатом. Меняешь то, что отличается, и жмёшь «Выполнено». Рядом видно прошлый раз, рекорд и насколько этот подход отличается от такого же в прошлый раз.'],
                    ['Порядок упражнений', 'По умолчанию по кругу: подход первого, подход второго, снова первого. В настройках можно выбрать «по одному» — закрывать план упражнения целиком — или свободный порядок. Переключается и на ходу, на самом выполнении.'],
                    ['Отдых', 'Запускается сам после записи. Время можно и прибавить, и убавить кнопками. По окончании — сигнал и вибрация, если они включены.'],
                    ['«Ещё…»', 'Под этой кнопкой редкое: добавить упражнение вне плана, пропустить, вернуться к уже выполненному, заметка.'],
                    ['Заметки', 'Три уровня: к подходу, к упражнению в этой тренировке и ко всей тренировке. Видны потом в истории.'],
                    ['Незавершённая', 'Если закрыть приложение посреди тренировки, она останется на главной и её можно продолжить. Через 12 часов продолжать уже не предложат — только завершить прошедшей датой: иначе к длительности приписалась бы вся ночь.']
                ] }
            ]
        },
        {
            name: 'Табата и интервальные программы',
            blocks: [
                { p: 'Высокоинтенсивный интервальный тренинг: короткие отрезки работы на пределе, короткий отдых, много кругов. Классическая табата — 20 секунд работы, 10 отдыха, 8 кругов: четыре минуты, после которых говорить не хочется.' },
                { p: 'Считать подходы здесь нечем и некогда, поэтому приложение переключается: оно само отсчитывает время, само объявляет смены и само записывает сделанное. Трогать телефон во время программы не надо.' },
                { sub: 'Как собрать' },
                { steps: [
                    '*Новая тренировка* → тип *Табата*. Появится карточка *Отрезки*.',
                    'Выбери готовый набор или задай своё: работа, отдых, кругов, отдых между кругами.',
                    'Добавь упражнения. Подходы и вес у них не спрашиваются — длительность задана отрезками, одна на всю программу. Под карточкой видно, сколько всего получится подходов и минут.',
                    '*Начать* — откроется экран программы: крупный отсчёт, текущее упражнение и предупреждение о следующем.',
                    'Дальше только слушать. *Пауза*, *Пропустить отрезок* и *Закончить* есть, но нужны редко.'
                ] },
                { hint: 'Упражнения нужны такие, где вес не при чём: бёрпи, альпинист, прыжки, планка, скручивания, бег на месте. В справочнике они уже есть — ищи в группах «Всё тело» и «Кардио». Что делать руками и ногами, написано у каждого упражнения: нажми на его название в справочнике.' },
                { sub: 'Сигналы' },
                { p: 'Экран во время работы видно не всегда, поэтому программа проговаривается звуком. Послушай заранее — каждый сигнал значит своё.' },
                { sounds: [
                    ['count', 'Отсчёт три-два-один', 'Три сухих щелчка, как у метронома, — перед каждой сменой: и перед началом работы, и перед её концом.'],
                    ['go', 'Начало работы', 'Удар колокола, как гонг в зале. Работай.'],
                    ['pulse', 'Пульс во время работы', 'Низкий короткий толчок каждые три секунды: подтверждает, что идёт работа, а не пауза. Отмеряется от конца отрезка, поэтому последний толчок всегда за три секунды до отсчёта. Его скорее чувствуешь, чем слышишь, — на телефон смотреть не нужно.'],
                    ['rest', 'Конец работы', 'Два удара вниз. Правило простое: вверх — начинай, вниз — заканчивай.'],
                    ['round', 'Конец круга', 'Двойной удар в одну ноту, как гонг на ринге. Дальше длинный отдых между кругами.'],
                    ['done', 'Конец программы', 'Три коротких ноты вверх и долгая на вершине, с долгим звоном. Длится дольше всех — спутать не с чем.']
                ] },
                { hint: 'Громкость приложение не задаёт — она общая для устройства. Если тихо, проверь громкость мультимедиа, а не звонка. И включи «Звук по окончании» в настройках отдыха: этим же выключателем управляются сигналы табаты.' },
                { sub: 'Голос' },
                { p: 'Если упражнений несколько, приложение называет следующее вслух — один раз, в начале каждой паузы. Смена упражнений приходится ровно на тот момент, когда на экран не смотрят, а тон говорит только о том, что работа кончилась, но не о том, к чему готовиться.' },
                { p: 'Фраза заодно говорит, где ты в программе: в паузе — «дальше: альпинист», между кругами — «новый круг: бёрпи». В длинной паузе фраза полнее, а за десять секунд до работы название повторяется: «готовься: бёрпи» — за минуту отдыха сказанное вначале успевает забыться.' },
                { hint: 'В паузе короче семи секунд голос молчит: фраза туда не помещается и наползла бы на отсчёт «три-два-один». Два сигнала разом хуже одного.' },
                { hint: 'Когда упражнение одно на всю программу, голос молчит: восемь кругов «дальше бёрпи» это шум, а не подсказка. Выключается в профиле — «Проговаривать упражнения». Голос добавляется к сигналам, а не заменяет их: речь, в отличие от тонов, нельзя подготовить заранее, и в свёрнутом приложении её не будет.' },
                { sub: 'Что записывается' },
                { p: 'Каждый доведённый до конца отрезок работы становится подходом с длительностью. Программа из восьми кругов даст восемь подходов по 20 секунд — они попадут в историю и в статистику наравне с обычными.' },
                { hint: 'Первый раз лучше поставить четыре круга вместо восьми. Табата выглядит безобидно ровно до третьего.' }
            ]
        },
        {
            name: 'Что настроить сразу',
            blocks: [
                { p: 'Всё это в *Профиле*. Меняется в любой момент, на записанное не влияет.' },
                { rows: [
                    ['Язык', 'Русский, английский или немецкий. По умолчанию берётся у телефона. Названия упражнений и заметки остаются такими, какими записаны.'],
                    ['Порядок упражнений', 'По кругу, по одному или свободно. Влияет только на то, что приложение предлагает следующим, — записать можно что угодно и когда угодно.'],
                    ['Не гасить экран', 'На время тренировки. Без этого телефон гаснет посреди подхода.'],
                    ['Полноэкранный режим', 'Убирает системные полосы. На телефоне включён сразу, на компьютере — нет: там прятать нечего. Рядом с выключателем есть кнопка выхода, она же выключает и настройку.'],
                    ['Таймер отдыха', 'Включение и длительность по умолчанию: её можно вписать числом или подобрать ползунком. У отдельного упражнения может быть своя — задаётся в справочнике.'],
                    ['Звук и вибрация', 'По окончании отдыха. Этот же выключатель звука управляет сигналами табаты.'],
                    ['Проговаривать упражнения', 'Название следующего упражнения вслух в интервальной программе. Появляется, если на устройстве есть голос нужного языка.']
                ] }
            ]
        },
        {
            name: 'Данные, копия и установка',
            blocks: [
                { rows: [
                    ['Где лежат данные', 'На самом устройстве. Сети приложение не требует: тренироваться в подвале без интернета можно.'],
                    ['Синхронизация', 'Необязательна. Вход через Google связывает устройства: что записано на телефоне, появится на компьютере. Без входа всё работает, просто не переносится.'],
                    ['Резервная копия', 'Выгрузка в файл — копия, которая целиком в твоих руках и не зависит ни от облака, ни от учётной записи. Стоит делать иногда.'],
                    ['Установка', 'Приложение ставится на домашний экран и открывается без браузера. Кнопка в разделе «Установка», на iPhone — «Поделиться» → «На экран Домой».'],
                    ['Обновления', 'Приходят сами при возвращении к приложению. Если ждёшь прямо сейчас — «Проверить обновление» в разделе «О приложении».']
                ] }
            ]
        },
        {
            name: 'Частые вопросы',
            blocks: [
                { rows: [
                    ['Откуда день следующей тренировки', 'Из твоего же ритма: берётся серединный промежуток между прошлыми тренировками. Появляется с пятой — по четырём ритма не видно. Если промежутки рваные, приложение так и напишет, что день примерный.'],
                    ['Почему вес «прикинут»', 'Истории по этому упражнению нет, и вес взят от веса тела по обычной для упражнения доле. Это отправная точка, а не рекомендация: поправь первым же подходом, дальше приложение будет брать твой результат.'],
                    ['Как удалить упражнение', 'Оно уходит в архив, а не пропадает: на нём висит история подходов, и удаление разорвало бы её. Из архива упражнение возвращается.'],
                    ['Два одинаковых упражнения', 'Сводятся сами — по названию, при запуске и после обмена с облаком. Подходы переносятся, планы и шаблоны переписываются.'],
                    ['Ошибся в проведённой тренировке', 'История → карточка тренировки. Числа подхода правятся, поправку можно перенести на остальные подходы этого упражнения.']
                ] }
            ]
        }
    ]
};

const EN = {
    title: 'How to use the app',
    sub: 'What is here, in what order to use it, and what to turn on right away',

    sections: [
        {
            name: 'Getting started',
            open: true,
            blocks: [
                { p: 'The app keeps a log: what you did, how many times, with what weight. A plan is an intention, not an order — you can change the sequence, record extra sets, skip promised ones. Nothing gets lost.' },
                { steps: [
                    'On the main screen, tap *New workout*.',
                    'Pick a type (*Strength*, *Morning routine*, *Tabata*…) and tap *Add exercise*. The picker has a search box and group chips — Chest, Legs, Abs: picking a group is faster than recalling a name.',
                    'For each row set the sets, reps and weight. If you have done the exercise before, your last result appears. If not, and your body weight is recorded, a weight is estimated — the caption says so, adjust it.',
                    '*Start workout* opens the workout screen.',
                    'Finished a set? Tap *Done*. The numbers are already filled in, usually nothing to change. Rest starts right after.',
                    'When you are finished, tap *Finish*. The summary appears, and from it you can save the line-up as a template so you do not build it again.'
                ] },
                { example: 'For example. Strength: bench press 3×8 · bent-over row 3×10 · biceps curl 3×12. Nine sets, about forty minutes including rest.' }
            ]
        },
        {
            name: 'Four sections: where to find things',
            blocks: [
                { rows: [
                    ['Workout', 'Start a new one or continue an unfinished one. Also here: your rhythm — when the last one was and when to expect the next — the last seven days, and body weight.'],
                    ['History', 'Every finished workout. Search, filter by type and by exercise, a separate Tabata chip. Open a card to fix it: set numbers, notes, deletion.'],
                    ['Stats', 'Totals for a period, a breakdown per exercise, personal records, how results move, weekdays and streaks, a year-long map by day.'],
                    ['Profile', 'Settings, the exercise catalogue, sync, backup, and this guide.']
                ] },
                { hint: 'Four sections at the bottom (on a desktop, on the left) are what the app switches between. The browser’s back button works as usual.' }
            ]
        },
        {
            name: 'Quick ways to start',
            blocks: [
                { p: 'You do not have to build a plan from scratch every time — there are three short routes.' },
                { rows: [
                    ['Repeat last', 'The top card on the main screen. It takes not the plan of the last workout but what you actually did in it.'],
                    ['Due by their own schedule', 'Appears when some exercises have gone longer than their usual gap. The app offers to build a workout out of exactly those.'],
                    ['Templates', 'A saved line-up. The chips under the repeat card are the four most recent; the rest are behind “All templates”. A template can be edited and duplicated; editing does not touch workouts already done.']
                ] }
            ]
        },
        {
            name: 'During a workout',
            blocks: [
                { rows: [
                    ['Recording a set', 'The fields already hold your last result. Change what differs and tap Done. Next to it you see last time, your record, and how this set compares with the same set last time.'],
                    ['Exercise order', 'Round robin by default: a set of the first, a set of the second, the first again. In settings you can choose one at a time — finish an exercise’s planned sets — or free order. It also switches mid-workout.'],
                    ['Rest', 'Starts by itself after a set. You can add or take away time with the buttons. When it ends: a sound and vibration, if they are on.'],
                    ['“More…”', 'The rare things live there: add an exercise outside the plan, skip one, go back to a finished one, write a note.'],
                    ['Notes', 'Three levels: for a set, for an exercise in this workout, and for the whole workout. They show up later in history.'],
                    ['Unfinished', 'If you close the app mid-workout it stays on the main screen and can be continued. After 12 hours continuing is no longer offered — only finishing with its own date: otherwise the whole night would be added to its length.']
                ] }
            ]
        },
        {
            name: 'Tabata and interval programs',
            blocks: [
                { p: 'High-intensity interval training: short bursts of all-out work, short rest, many rounds. Classic Tabata is 20 seconds of work, 10 of rest, 8 rounds — four minutes after which you do not feel like talking.' },
                { p: 'There is nothing to count here and no time to count it, so the app switches roles: it times everything, announces every change and records what you did. You do not touch the phone during the program.' },
                { sub: 'Setting it up' },
                { steps: [
                    '*New workout* → type *Tabata*. An *Intervals* card appears.',
                    'Pick a ready-made set or enter your own: work, rest, rounds, rest between rounds.',
                    'Add exercises. They are not asked for sets or weight — the length comes from the intervals, one for the whole program. Under the card you see how many sets and minutes it adds up to.',
                    '*Start* opens the program screen: a large countdown, the current exercise and a warning about the next one.',
                    'From there, just listen. *Pause*, *Skip interval* and *Finish* exist but are rarely needed.'
                ] },
                { hint: 'You want exercises where weight is beside the point: burpees, mountain climbers, jumps, planks, crunches, running in place. They are already in the catalogue — look in the “Full body” and “Cardio” groups. What to do with your arms and legs is written on each exercise: tap its name in the catalogue.' },
                { sub: 'Sounds' },
                { p: 'You cannot always see the screen while working, so the program speaks in sound. Listen to them in advance — each one means something different.' },
                { sounds: [
                    ['count', 'Three-two-one countdown', 'Three dry clicks, like a metronome, before every change — both before work starts and before it ends.'],
                    ['go', 'Work starts', 'A bell, like a gong in a gym. Go.'],
                    ['pulse', 'Pulse during work', 'A low short thump every three seconds: it confirms that work is running, not rest. It is measured from the end of the interval, so the last thump always lands three seconds before the countdown. You feel it more than hear it — no need to look at the phone.'],
                    ['rest', 'Work ends', 'Two strikes down. The rule is simple: up means begin, down means stop.'],
                    ['round', 'Round ends', 'A double strike on one note, like a boxing bell. A long rest between rounds follows.'],
                    ['done', 'Program ends', 'Three short notes up and a long one at the top, ringing out. It lasts longer than any other — impossible to confuse.']
                ] },
                { hint: 'The app does not set the volume — that belongs to the device. If it is quiet, check the media volume, not the ringer. And turn on “Sound when it ends” in the rest settings: the same switch controls the Tabata sounds.' },
                { sub: 'Voice' },
                { p: 'If there is more than one exercise, the app says the next one out loud — once, at the start of every pause. Changing exercises falls exactly on the moment when nobody is looking at the screen, and a tone only says that work ended, not what to get ready for.' },
                { p: 'The phrase also tells you where you are: in a pause, “next: mountain climbers”; between rounds, “new round: burpees”. In a long pause the phrase is fuller, and ten seconds before work the name is repeated — “get ready: burpees” — because a minute of rest is long enough to forget.' },
                { hint: 'In a pause shorter than seven seconds the voice stays silent: the phrase does not fit and would run into the three-two-one countdown. Two signals at once are worse than one.' },
                { hint: 'When one exercise runs the whole program the voice stays silent: eight rounds of “next: burpees” is noise, not help. It can be turned off in the profile — “Announce exercises”. The voice adds to the sounds rather than replacing them: speech, unlike tones, cannot be prepared in advance, and a backgrounded app will not produce it.' },
                { sub: 'What gets recorded' },
                { p: 'Every work interval you see through becomes a set with a duration. A program of eight rounds gives eight sets of 20 seconds — they land in your history and stats like any other.' },
                { hint: 'The first time, set four rounds instead of eight. Tabata looks harmless right up to the third.' }
            ]
        },
        {
            name: 'What to set up right away',
            blocks: [
                { p: 'All of this is in the *Profile*. It can be changed any time and does not affect what is already recorded.' },
                { rows: [
                    ['Language', 'Russian, English or German. By default it follows your phone. Exercise names and notes stay exactly as you typed them.'],
                    ['Exercise order', 'Round robin, one at a time, or free. It only affects what the app offers next — you can record anything at any time.'],
                    ['Keep the screen on', 'For the duration of a workout. Without it the phone goes dark mid-set.'],
                    ['Full screen', 'Hides the system bars. On a phone it is on from the start; on a computer it is not — there is nothing to hide there. Next to the switch there is an exit button, which also turns the setting off.'],
                    ['Rest timer', 'Whether it runs and its default length: type the number or find it with the slider. An individual exercise can have its own — set in the catalogue.'],
                    ['Sound and vibration', 'When rest ends. That same sound switch also controls the Tabata signals.'],
                    ['Announce exercises', 'The next exercise said out loud in an interval program. It appears if your device has a voice for your language.']
                ] }
            ]
        },
        {
            name: 'Data, backup and installing',
            blocks: [
                { rows: [
                    ['Where the data lives', 'On the device itself. The app needs no network: training in a basement with no internet works fine.'],
                    ['Sync', 'Optional. Signing in with Google links your devices: what you record on the phone shows up on the computer. Without signing in everything works, it just does not travel.'],
                    ['Backup', 'Saving to a file gives you a copy that is entirely yours and depends on no cloud and no account. Worth doing now and then.'],
                    ['Installing', 'The app goes onto your home screen and opens without a browser. There is a button in the “Installing” section; on iPhone use Share → Add to Home Screen.'],
                    ['Updates', 'They arrive by themselves when you come back to the app. If you are waiting right now, use “Check for an update” in the About section.']
                ] }
            ]
        },
        {
            name: 'Common questions',
            blocks: [
                { rows: [
                    ['Where the next workout day comes from', 'From your own rhythm: the middle gap between your past workouts. It appears from the fifth workout on — four is not enough to see a rhythm. If the gaps are uneven, the app says the day is a guess.'],
                    ['Why the weight is “estimated”', 'There is no history for that exercise, so the weight is taken from your body weight by the share usual for it. It is a starting point, not a recommendation: correct it with your first set and the app will use your own result from then on.'],
                    ['How to delete an exercise', 'It goes to the archive rather than disappearing: a history of sets hangs on it, and deleting would tear that history apart. An exercise can be brought back from the archive.'],
                    ['Two identical exercises', 'They merge by themselves — by name, at startup and after a sync. Sets move over, plans and templates are rewritten.'],
                    ['I made a mistake in a finished workout', 'History → the workout card. Set numbers can be corrected, and the correction can be carried over to the other sets of that exercise.']
                ] }
            ]
        }
    ]
};

const DE = {
    title: 'So benutzt du die App',
    sub: 'Was es hier gibt, in welcher Reihenfolge du es benutzt und was du gleich einschalten solltest',

    sections: [
        {
            name: 'Wie du anfängst',
            open: true,
            blocks: [
                { p: 'Die App führt ein Tagebuch: was du gemacht hast, wie oft und mit welchem Gewicht. Ein Plan ist eine Absicht, kein Befehl — du darfst die Reihenfolge ändern, zusätzliche Sätze erfassen und versprochene auslassen. Nichts geht verloren.' },
                { steps: [
                    'Auf der Startseite auf *Neues Training* tippen.',
                    'Wähle eine Art (*Kraft*, *Morgengymnastik*, *Tabata*…) und tippe auf *Übung hinzufügen*. Im Auswahlfenster gibt es eine Suche und Gruppen-Chips — Brust, Beine, Bauch: nach Gruppe zu suchen geht schneller, als sich den Namen zu merken.',
                    'Trage für jede Zeile Sätze, Wiederholungen und Gewicht ein. Hast du die Übung schon gemacht, erscheint dein letztes Ergebnis. Wenn nicht und dein Körpergewicht ist erfasst, wird das Gewicht geschätzt — die Zeile sagt es dir, pass es an.',
                    '*Training starten* öffnet den Trainingsbildschirm.',
                    'Satz fertig? Tippe auf *Erledigt*. Die Zahlen stehen schon da, meist gibt es nichts zu ändern. Danach läuft die Pause.',
                    'Wenn du fertig bist, tippe auf *Beenden*. Das Ergebnis erscheint, und daraus kannst du die Zusammenstellung als Vorlage speichern, damit du sie nicht neu bauen musst.'
                ] },
                { example: 'Ein Beispiel. Kraft: Bankdrücken 3×8 · vorgebeugtes Rudern 3×10 · Bizepscurls 3×12. Neun Sätze, etwa vierzig Minuten mit Pausen.' }
            ]
        },
        {
            name: 'Vier Bereiche: wo was zu finden ist',
            blocks: [
                { rows: [
                    ['Training', 'Ein neues starten oder ein offenes fortsetzen. Hier steht auch dein Rhythmus — wann das letzte war und wann das nächste ansteht —, die letzten sieben Tage und dein Körpergewicht.'],
                    ['Verlauf', 'Alle abgeschlossenen Trainings. Suche, Filter nach Art und Übung, ein eigener Tabata-Chip. Eine Karte lässt sich öffnen und korrigieren: Zahlen eines Satzes, Notizen, Löschen.'],
                    ['Statistik', 'Summen für einen Zeitraum, Auswertung je Übung, persönliche Rekorde, Verlauf der Ergebnisse, Wochentage und Serien, eine Jahreskarte nach Tagen.'],
                    ['Profil', 'Einstellungen, Übungskatalog, Synchronisierung, Sicherungskopie und diese Anleitung.']
                ] },
                { hint: 'Unten (am Rechner links) stehen vier Bereiche, zwischen denen die App wechselt. Der Zurück-Knopf des Browsers funktioniert wie gewohnt.' }
            ]
        },
        {
            name: 'Schnelle Wege anzufangen',
            blocks: [
                { p: 'Du musst nicht jedes Mal einen Plan von Null bauen — es gibt drei kurze Wege.' },
                { rows: [
                    ['Letztes wiederholen', 'Die oberste Karte auf der Startseite. Sie nimmt nicht den Plan des letzten Trainings, sondern das, was du tatsächlich gemacht hast.'],
                    ['Nach eigenem Rhythmus fällig', 'Erscheint, wenn einzelne Übungen länger als sonst nicht drankamen. Die App schlägt vor, genau daraus ein Training zu bauen.'],
                    ['Vorlagen', 'Eine gespeicherte Zusammenstellung. Die Chips unter der Wiederholen-Karte sind die vier letzten, der Rest steht hinter „Alle Vorlagen“. Eine Vorlage lässt sich ändern und duplizieren; bereits absolvierte Trainings bleiben davon unberührt.']
                ] }
            ]
        },
        {
            name: 'Während des Trainings',
            blocks: [
                { rows: [
                    ['Einen Satz erfassen', 'In den Feldern steht bereits dein letztes Ergebnis. Ändere, was abweicht, und tippe auf Erledigt. Daneben siehst du das letzte Mal, deinen Rekord und wie dieser Satz im Vergleich zum gleichen Satz beim letzten Mal ausfällt.'],
                    ['Reihenfolge der Übungen', 'Standardmäßig im Kreis: ein Satz der ersten, ein Satz der zweiten, wieder die erste. In den Einstellungen kannst du „nacheinander“ wählen — eine Übung ganz abschließen — oder freie Reihenfolge. Das lässt sich auch mitten im Training umstellen.'],
                    ['Pause', 'Startet nach dem Erfassen von selbst. Die Zeit lässt sich mit den Knöpfen verlängern und verkürzen. Am Ende: Ton und Vibration, sofern eingeschaltet.'],
                    ['„Mehr…“', 'Dahinter liegt das Seltene: eine Übung außerhalb des Plans, überspringen, zu einer erledigten zurück, eine Notiz.'],
                    ['Notizen', 'Drei Ebenen: zum Satz, zur Übung in diesem Training und zum ganzen Training. Sie tauchen später im Verlauf auf.'],
                    ['Nicht beendet', 'Schließt du die App mitten im Training, bleibt es auf der Startseite und lässt sich fortsetzen. Nach 12 Stunden wird Fortsetzen nicht mehr angeboten — nur noch Beenden mit eigenem Datum: sonst käme die ganze Nacht zur Dauer dazu.']
                ] }
            ]
        },
        {
            name: 'Tabata und Intervallprogramme',
            blocks: [
                { p: 'Hochintensives Intervalltraining: kurze Abschnitte am Limit, kurze Pause, viele Runden. Klassisches Tabata sind 20 Sekunden Arbeit, 10 Sekunden Pause, 8 Runden — vier Minuten, nach denen einem das Reden vergeht.' },
                { p: 'Hier gibt es nichts zu zählen und keine Zeit dafür, also wechselt die App die Rolle: sie misst die Zeit, sagt jeden Wechsel an und erfasst, was du gemacht hast. Das Handy musst du während des Programms nicht anfassen.' },
                { sub: 'So stellst du es zusammen' },
                { steps: [
                    '*Neues Training* → Art *Tabata*. Es erscheint die Karte *Intervalle*.',
                    'Wähle einen fertigen Satz oder trage eigene Werte ein: Arbeit, Pause, Runden, Pause zwischen den Runden.',
                    'Füge Übungen hinzu. Nach Sätzen und Gewicht wird nicht gefragt — die Dauer kommt aus den Intervallen und gilt für das ganze Programm. Unter der Karte siehst du, wie viele Sätze und Minuten zusammenkommen.',
                    '*Starten* öffnet den Programmbildschirm: großer Countdown, aktuelle Übung und Hinweis auf die nächste.',
                    'Danach nur noch zuhören. *Pause*, *Intervall überspringen* und *Beenden* gibt es, sie werden aber selten gebraucht.'
                ] },
                { hint: 'Du brauchst Übungen, bei denen Gewicht keine Rolle spielt: Burpees, Bergsteiger, Sprünge, Planke, Crunches, Laufen auf der Stelle. Im Katalog sind sie schon da — schau in den Gruppen „Ganzkörper“ und „Cardio“. Was Arme und Beine tun sollen, steht bei jeder Übung: tippe im Katalog auf ihren Namen.' },
                { sub: 'Signale' },
                { p: 'Den Bildschirm siehst du während der Arbeit nicht immer, deshalb spricht das Programm über Töne. Hör sie dir vorher an — jedes Signal bedeutet etwas anderes.' },
                { sounds: [
                    ['count', 'Countdown drei-zwei-eins', 'Drei trockene Klicks wie bei einem Metronom, vor jedem Wechsel — vor dem Beginn der Arbeit wie vor ihrem Ende.'],
                    ['go', 'Arbeit beginnt', 'Ein Glockenschlag, wie ein Gong im Studio. Los.'],
                    ['pulse', 'Puls während der Arbeit', 'Ein tiefer kurzer Stoß alle drei Sekunden: er bestätigt, dass Arbeit läuft und keine Pause. Er wird vom Ende des Intervalls gezählt, der letzte Stoß liegt also immer drei Sekunden vor dem Countdown. Du spürst ihn eher, als dass du ihn hörst — aufs Handy schauen musst du nicht.'],
                    ['rest', 'Arbeit endet', 'Zwei Schläge abwärts. Die Regel ist einfach: aufwärts heißt anfangen, abwärts heißt aufhören.'],
                    ['round', 'Runde endet', 'Ein Doppelschlag auf einem Ton, wie die Ringglocke. Danach kommt die lange Pause zwischen den Runden.'],
                    ['done', 'Programm endet', 'Drei kurze Töne aufwärts und ein langer oben, lange nachklingend. Es dauert länger als alle anderen — verwechseln kann man es nicht.']
                ] },
                { hint: 'Die Lautstärke bestimmt nicht die App, sondern das Gerät. Ist es zu leise, prüfe die Medienlautstärke, nicht die des Klingeltons. Und schalte „Ton am Ende“ in den Pauseneinstellungen ein: derselbe Schalter steuert die Tabata-Signale.' },
                { sub: 'Stimme' },
                { p: 'Sind mehrere Übungen im Spiel, sagt die App die nächste laut an — einmal, zu Beginn jeder Pause. Der Wechsel der Übungen fällt genau auf den Moment, in dem niemand auf den Bildschirm schaut, und ein Ton sagt nur, dass die Arbeit vorbei ist, nicht worauf du dich einstellen sollst.' },
                { p: 'Die Ansage sagt dir zugleich, wo du bist: in der Pause „weiter: Bergsteiger“, zwischen den Runden „neue Runde: Burpees“. In einer langen Pause ist der Satz ausführlicher, und zehn Sekunden vor der Arbeit wird der Name wiederholt — „mach dich bereit: Burpees“ —, denn eine Minute Pause reicht zum Vergessen.' },
                { hint: 'In einer Pause unter sieben Sekunden schweigt die Stimme: der Satz passt nicht hinein und liefe in den Countdown drei-zwei-eins hinein. Zwei Signale gleichzeitig sind schlechter als eines.' },
                { hint: 'Läuft eine einzige Übung durch das ganze Programm, schweigt die Stimme: acht Runden „weiter: Burpees“ sind Lärm und keine Hilfe. Abschalten kannst du sie im Profil unter „Übungen ansagen“. Die Stimme kommt zu den Tönen dazu, sie ersetzt sie nicht: Sprache lässt sich, anders als Töne, nicht im Voraus vorbereiten, und in einer im Hintergrund liegenden App gibt es sie nicht.' },
                { sub: 'Was erfasst wird' },
                { p: 'Jeder Arbeitsabschnitt, den du zu Ende bringst, wird zu einem Satz mit Dauer. Ein Programm aus acht Runden ergibt acht Sätze zu 20 Sekunden — sie landen im Verlauf und in der Statistik wie alle anderen.' },
                { hint: 'Nimm beim ersten Mal vier Runden statt acht. Tabata sieht bis zur dritten harmlos aus.' }
            ]
        },
        {
            name: 'Was du gleich einstellen solltest',
            blocks: [
                { p: 'Das alles steht im *Profil*. Es lässt sich jederzeit ändern und betrifft bereits Erfasstes nicht.' },
                { rows: [
                    ['Sprache', 'Russisch, Englisch oder Deutsch. Standardmäßig richtet sie sich nach deinem Handy. Übungsnamen und Notizen bleiben so, wie du sie eingetragen hast.'],
                    ['Reihenfolge der Übungen', 'Im Kreis, nacheinander oder frei. Es beeinflusst nur, was die App als Nächstes vorschlägt — erfassen kannst du jederzeit alles.'],
                    ['Bildschirm anlassen', 'Für die Dauer des Trainings. Ohne das geht das Handy mitten im Satz aus.'],
                    ['Vollbild', 'Blendet die Systemleisten aus. Auf dem Handy ist es von Anfang an an, auf dem Computer nicht — dort gibt es nichts zu verbergen. Neben dem Schalter steht eine Schaltfläche zum Beenden, die auch die Einstellung ausschaltet.'],
                    ['Pausentimer', 'Ob er läuft und wie lang er standardmäßig ist: Zahl eintippen oder mit dem Regler einstellen. Eine einzelne Übung kann eine eigene Länge haben — im Katalog einstellbar.'],
                    ['Ton und Vibration', 'Am Ende der Pause. Derselbe Tonschalter steuert auch die Tabata-Signale.'],
                    ['Übungen ansagen', 'Die nächste Übung wird im Intervallprogramm laut angesagt. Erscheint, wenn dein Gerät eine Stimme für deine Sprache hat.']
                ] }
            ]
        },
        {
            name: 'Daten, Sicherung und Installation',
            blocks: [
                { rows: [
                    ['Wo die Daten liegen', 'Auf dem Gerät selbst. Die App braucht kein Netz: im Keller ohne Internet zu trainieren geht problemlos.'],
                    ['Synchronisierung', 'Freiwillig. Die Anmeldung mit Google verbindet deine Geräte: was du am Handy erfasst, erscheint am Rechner. Ohne Anmeldung funktioniert alles, es wandert nur nicht.'],
                    ['Sicherungskopie', 'Das Sichern in eine Datei gibt dir eine Kopie, die ganz dir gehört und weder an einer Cloud noch an einem Konto hängt. Ab und zu lohnt es sich.'],
                    ['Installation', 'Die App legt sich auf den Home-Bildschirm und öffnet ohne Browser. Im Bereich „Installation“ gibt es einen Knopf; auf dem iPhone über Teilen → Zum Home-Bildschirm.'],
                    ['Updates', 'Sie kommen von selbst, wenn du zur App zurückkehrst. Wenn du gerade darauf wartest: „Nach Update suchen“ im Bereich Über die App.']
                ] }
            ]
        },
        {
            name: 'Häufige Fragen',
            blocks: [
                { rows: [
                    ['Woher der Tag des nächsten Trainings kommt', 'Aus deinem eigenen Rhythmus: dem mittleren Abstand zwischen deinen bisherigen Trainings. Er erscheint ab dem fünften — bei vieren ist noch kein Rhythmus zu sehen. Sind die Abstände unregelmäßig, schreibt die App, dass das Datum geschätzt ist.'],
                    ['Warum das Gewicht „geschätzt“ ist', 'Für diese Übung gibt es keinen Verlauf, also wird das Gewicht aus deinem Körpergewicht nach dem für sie üblichen Anteil berechnet. Das ist ein Ausgangspunkt, keine Empfehlung: korrigiere es mit dem ersten Satz, danach nimmt die App dein eigenes Ergebnis.'],
                    ['Wie man eine Übung löscht', 'Sie wandert ins Archiv statt zu verschwinden: an ihr hängt der Verlauf der Sätze, und Löschen würde ihn zerreißen. Aus dem Archiv lässt sie sich zurückholen.'],
                    ['Zwei gleiche Übungen', 'Sie werden von selbst zusammengeführt — über den Namen, beim Start und nach dem Abgleich mit der Cloud. Sätze wandern mit, Pläne und Vorlagen werden umgeschrieben.'],
                    ['Ich habe mich in einem fertigen Training vertan', 'Verlauf → die Trainingskarte. Die Zahlen eines Satzes lassen sich korrigieren, und die Korrektur kann auf die übrigen Sätze dieser Übung übertragen werden.']
                ] }
            ]
        }
    ]
};

const ALL = { ru: RU, en: EN, de: DE };

/** Содержание справки на текущем языке. Русский — запасной вариант. */
export const guideContent = (lang) => ALL[lang] || RU;
