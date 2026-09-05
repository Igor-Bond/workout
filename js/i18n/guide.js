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
                    'Выбери тип (*Силовая*, *Зарядка*, *Табата*…) и нажми *Добавить упражнение*. В окне выбора есть поиск и плашки групп — «Грудь», «Ноги», «Пресс»: по группе искать быстрее, чем вспоминать название. Нужного нет — заводится прямо отсюда, кнопкой *Создать*: спросят название, вид и группу мышц.',
                    'У каждой строки задай подходы и повторы, а у силовых — вес. У упражнений со своим весом поля веса здесь нет: нагрузку приложение считает само. Если ты делал упражнение раньше, подставится прошлый результат; если нет, а вес тела отмечен — вес будет прикинут, и подпись об этом скажет.',
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
                    ['Тренировка', 'Начать новую или продолжить незавершённую. Здесь же очередь составов, забытые упражнения, последние семь дней и вес тела.'],
                    ['История', 'Все проведённые тренировки. Поиск, отбор по типу и по упражнению, отдельная плашка «Табата». Карточку можно открыть и поправить: числа подхода, заметки, удаление. Оттуда же тренировка повторяется.'],
                    ['Статистика', 'Общие итоги за период, разбор по упражнениям, личные рекорды, динамика результата, дни недели и серии, прогноз следующей тренировки, карта года по дням.'],
                    ['Профиль', 'Настройки, справочник упражнений, синхронизация, резервная копия и эта справка.']
                ] },
                { hint: 'Внизу (на компьютере — слева) четыре раздела, между ними и переключается приложение. Кнопка «назад» в браузере работает как обычно.' }
            ]
        },
        {
            name: 'Быстрые способы начать',
            blocks: [
                { p: 'Собирать план с нуля каждый раз не нужно — приложение само предлагает, с чего начать.' },
                { rows: [
                    ['На очереди', 'Верхняя карточка на главной, обведённая цветом. Состав, который вы повторяете и до которого дольше всего не доходили. Берёт не план той тренировки, а то, что в ней было фактически сделано.'],
                    ['Следом', 'Плашки под карточкой — остальная очередь. Подпись говорит, сколько дней прошло с прошлого раза, и по ней же выстроен ряд. Промежуток берётся из вашей же истории за последние восемь недель и пересчитывается сам: станете делать реже — порог поднимется. Но прежде срока смотрятся мышцы: состав, чья группа работала недавно, уходит вниз, как бы давно его ни было.'],
                    ['Чаще всего', 'Тренировки типа «Зарядка» стоят отдельно и в очереди не участвуют: их делают каждое утро и без напоминания, а считать их наравне значило бы объявить мышцы вечно уставшими. Плашка здесь не исчезает после выполнения, а метится цветом: зелёная рамка — сегодня уже сделано, тёплая — ещё нет.'],
                    ['Забытое', 'Плашка пунктиром, своим разделом. Упражнение, которое не делалось дольше обычного для него срока и не входит ни в один повторяющийся состав. Стрелки по краям листают такие упражнения, подпись говорит, сколько дней прошло с прошлого раза, а нажатие на название собирает из них тренировку. Порядок — от давнего к недавнему; то, чего не было дольше восьми недель, из списка выпадает: это уже не забытое, а оставленное.'],
                    ['Что повторяете', 'Появляется вместо очереди, пока ритма ещё нет: состав повторялся, но реже трёх раз, и промежутка по нему не вывести. А совсем без истории на этом месте стоят шаблоны.'],
                    ['Шаблоны', 'Сохранённый состав. Открываются кнопкой «Все шаблоны». Шаблон можно менять и дублировать; на уже проведённые тренировки правка не влияет.'],
                    ['Повторить эту тренировку', 'В итогах любой тренировки из истории. На главной такой кнопки нет: повтор вчерашнего нужен изредка, а место там занято очередью.']
                ] }
            ]
        },
        {
            name: 'Во время тренировки',
            blocks: [
                { rows: [
                    ['Запись подхода', 'Поля уже заполнены прошлым результатом. Меняешь то, что отличается, и жмёшь «Выполнено». Рядом видно прошлый раз, рекорд и насколько этот подход отличается от такого же в прошлый раз.'],
                    ['Упражнения со своим весом', 'У отжиманий и подтягиваний нагрузку приложение считает само: строка «Своим весом» — это доля твоего веса, приходящаяся на упражнение, и она же уходит в статистику. Вписывать туда ничего не надо. Ссылка «＋ дополнительный вес» нужна, только если ты правда надел пояс или зажал гантель: оно прибавляется к нагрузке и показывается второй строкой. Тоннаж в статистике и в истории — это вся нагрузка вместе: и собственный вес, и отягощение; вес тела берётся на дату подхода, поэтому новое взвешивание прошлые тренировки не переписывает. Долю можно поправить под себя — «Профиль → Справочник → Доли своего веса»; правка пересчитает всю историю сразу.'],
                    ['Порядок упражнений', 'По умолчанию по кругу: подход первого, подход второго, снова первого. В настройках можно выбрать «по одному» — закрывать план упражнения целиком — или свободный порядок. Переключается и на ходу, на самом выполнении.'],
                    ['Отдых', 'Запускается сам после записи. Кнопками «±5 с» время прибавляют и убавляют, а если кнопку задержать — шаг разгоняется, и до трёх минут доходишь одним движением. Изменённое запоминается за этим упражнением: после приседа своё время, после планки своё. Настройка в профиле остаётся началом отсчёта для тех упражнений, про которые вы ещё ничего не сказали. Когда у упражнения своё время, полоса так и подписана. По окончании — сигнал и вибрация, если они включены.'],
                    ['«Ещё…»', 'Под этой кнопкой редкое: добавить упражнение вне плана, пропустить, вернуться к уже выполненному, заметка.'],
                    ['Заметки', 'Три уровня: к подходу, к упражнению в этой тренировке и ко всей тренировке. Видны потом в истории.'],
                    ['Упражнение на время', 'Под полем секунд — кнопка *Отсчёт*. Пять секунд на приготовиться, дальше приложение считает вслух теми же сигналами, что в табате, и само записывает подход, когда время вышло. Остановишь раньше — запишется то, что правда прошло, а не обещанное. Оставишь поле пустым — пойдёт секундомер: для планки «до отказа» цели и не бывает.'],
                    ['Незавершённая', 'Если закрыть приложение посреди тренировки, она останется на главной и её можно продолжить. Через 12 часов продолжать уже не предложат — только завершить прошедшей датой: иначе к длительности приписалась бы вся ночь.']
                ] }
            ]
        },
        {
            name: 'План тренировок',
            blocks: [
                { p: 'Очередь на главной отвечает на вопрос «до чего дольше всего не доходили» и расписанием не является: у плавающего круга промежутки неравные, и порядок неизбежно расходится с задуманным. План — объявленная недельная сетка: какой день недели чему отдан. Пока плана нет, всё работает как прежде.' },
                { sub: 'Как завести' },
                { steps: [
                    '*Тренировка* → *План тренировок*.',
                    'Попроси план у тренера или у языковой модели: в *Сводке для тренера* уже лежит готовый запрос с образцом ответа.',
                    'Вставь ответ в поле и нажми *Разобрать*. Появится развёртка на две недели и список «Не понято» — он должен остаться пустым.',
                    '*Утвердить план*. На главном встанет карточка «Сегодня по плану», и она отменяет очередь.'
                ] },
                { rows: [
                    ['Как пишется день', '«Пн Бицепс резинка 6 × 50». Несколько упражнений в одном дне соединяются знаком «+». День без тренировки — «Вс отдых». У упражнения на время второе число значит секунды: «Планка 2 × 45».'],
                    ['Пропуск', 'Пропущенный день пропущен: он не переносится и долгом не копится, а вернётся через неделю на своём месте. Сетка держится — баскетбол остаётся в среду, а воскресенье отдыхом. Гнаться не за чем.'],
                    ['Правка', 'Тот же экран: в поле уже лежит действующий план. Поправь строку, нажми *Разобрать*, посмотри, что изменилось в развёртке, и утверди заново.'],
                    ['Границы', 'Пока план не начался, на главном стоит дата начала и первое занятие. За неделю до конца приложение предупредит и предложит попросить следующий. Кончился — скажет об этом и вернётся к подсказкам по истории.'],
                    ['Незнакомое упражнение', 'План составляет не приложение, и названия в нём свои. Чего нет в справочнике, оно предложит завести прямо с карточки — по каждому имени отдельно.'],
                    ['Прогноз', 'Пока план объявлен, «Постоянство» на статистике не гадает по истории, а называет день из сетки: гадать там, где сказано, незачем.']
                ] },
                { hint: 'План хранит одну недельную сетку и срок. Если недели различаются — скажем, объём чередуется через неделю, — попроси их отдельными блоками, каждый со своей датой начала, и утверждай по понедельникам. План уезжает в облако вместе с историей: объявленный на компьютере, он появится на телефоне.' }
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
                { hint: 'На iPhone есть оговорка: там звук идёт, только пока экран включён. Убранный в карман телефон программу не озвучит — положи его рядом экраном вверх. Приложение об этом напоминает на самом экране программы.' },
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
                    ['Таймер отдыха', 'Включение и длительность: её можно вписать числом или подобрать ползунком. Это начало отсчёта для упражнений, про которые вы ещё ничего не сказали: у знакомых своё время, запомненное с прошлого раза, и правится оно на выполнении.'],
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
                    'Pick a type (*Strength*, *Morning routine*, *Tabata*…) and tap *Add exercise*. The picker has a search box and group chips — Chest, Legs, Abs: picking a group is faster than recalling a name. Not there? Create it right here with *Create*: you will be asked for the name, the kind and the muscle group.',
                    'For each row set the sets and reps, and for barbell work the weight. Body-weight exercises have no weight field here: the app works the load out itself. If you have done the exercise before, your last result appears; if not, and your body weight is recorded, a weight is estimated — the caption says so.',
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
                    ['Workout', 'Start a new one or continue an unfinished one. Also here: the queue of line-ups, forgotten exercises, the last seven days, and body weight.'],
                    ['History', 'Every finished workout. Search, filter by type and by exercise, a separate Tabata chip. Open a card to fix it: set numbers, notes, deletion. A workout is repeated from there too.'],
                    ['Stats', 'Totals for a period, a breakdown per exercise, personal records, how results move, weekdays and streaks, a forecast for the next workout, a year-long map by day.'],
                    ['Profile', 'Settings, the exercise catalogue, sync, backup, and this guide.']
                ] },
                { hint: 'Four sections at the bottom (on a desktop, on the left) are what the app switches between. The browser’s back button works as usual.' }
            ]
        },
        {
            name: 'Quick ways to start',
            blocks: [
                { p: 'You do not have to build a plan from scratch every time — the app suggests where to start.' },
                { rows: [
                    ['Up next', 'The top card on the main screen, outlined in colour. The line-up you keep coming back to that you have gone longest without. It takes not the plan of that workout but what you actually did in it.'],
                    ['Then', 'The chips under the card are the rest of the queue. The label says how many days have passed since last time, and the row is ordered by it. The gap comes from your own history over the last eight weeks and recomputes itself: do something less often and the threshold rises. But muscles come before the schedule: a line-up whose group worked recently drops down the queue however long it has been.'],
                    ['Most often', 'Workouts of the “Morning routine” type stand apart and stay out of the queue: you do them every morning without being reminded, and counting them equally would declare your muscles permanently tired. Here the chip does not vanish once done — it is marked by colour instead: a green border means done today, a warm one means not yet.'],
                    ['Forgotten', 'A dashed chip in a section of its own. An exercise that has gone longer than its usual gap and belongs to no repeating line-up. The arrows on either side flip through them, the label says how many days have passed since last time, and a tap on the name builds a workout out of them. Order runs from the longest gone to the most recent; anything missing for over eight weeks drops off the list — that is no longer forgotten but given up.'],
                    ['What you repeat', 'Shows up instead of the queue while there is no rhythm yet: the line-up has repeated, but fewer than three times, so no gap can be derived. With no history at all, templates stand here instead.'],
                    ['Templates', 'A saved line-up. Open them with “All templates”. A template can be edited and duplicated; editing does not touch workouts already done.'],
                    ['Repeat this workout', 'In the summary of any workout from history. There is no such button on the main screen: repeating yesterday is needed rarely, and the place there is taken by the queue.']
                ] }
            ]
        },
        {
            name: 'During a workout',
            blocks: [
                { rows: [
                    ['Recording a set', 'The fields already hold your last result. Change what differs and tap Done. Next to it you see last time, your record, and how this set compares with the same set last time.'],
                    ['Body-weight exercises', 'For push-ups and pull-ups the app works out the load itself: the “Own weight” line is the share of your body weight this exercise lifts, and that is what goes into the stats. Nothing to type in. The “＋ added weight” link is only for when you really put on a belt or hold a dumbbell: it is added to the load and shows on a second line. Tonnage in the stats and in history is the whole load together — your own weight and any added weight; body weight is taken as of the date of the set, so a new weigh-in does not rewrite past workouts. The share can be tuned — Profile → Catalogue → Body-weight shares; editing it recalculates the whole history at once.'],
                    ['Exercise order', 'Round robin by default: a set of the first, a set of the second, the first again. In settings you can choose one at a time — finish an exercise’s planned sets — or free order. It also switches mid-workout.'],
                    ['Rest', 'Starts by itself after a set. The “±5 s” buttons add and take away time; hold one down and the step speeds up, so three minutes are one movement away. What you change is remembered for that exercise: one length after squats, another after a plank. The setting in the profile stays the starting point for exercises you have not said anything about yet. When an exercise has its own length, the bar says so. When it ends: a sound and vibration, if they are on.'],
                    ['“More…”', 'The rare things live there: add an exercise outside the plan, skip one, go back to a finished one, write a note.'],
                    ['Notes', 'Three levels: for a set, for an exercise in this workout, and for the whole workout. They show up later in history.'],
                    ['Timed exercise', 'Under the seconds field there is a *Countdown* button. Five seconds to get ready, then the app counts aloud with the same signals as tabata and records the set itself when the time is up. Stop earlier and it records what actually passed, not what was promised. Leave the field empty and it runs as a stopwatch: a plank to failure has no target at all.'],
                    ['Unfinished', 'If you close the app mid-workout it stays on the main screen and can be continued. After 12 hours continuing is no longer offered — only finishing with its own date: otherwise the whole night would be added to its length.']
                ] }
            ]
        },
        {
            name: 'Training plan',
            blocks: [
                { p: 'The queue on the main screen answers “what have I gone longest without” and is not a schedule: a floating circle has uneven gaps, and the order inevitably drifts from what you intended. A plan is a declared weekly grid: which weekday is given to what. With no plan everything works as before.' },
                { sub: 'How to set one up' },
                { steps: [
                    '*Workout* → *Training plan*.',
                    'Ask a coach or a language model for a plan: the *Coach summary* already holds a ready request with a response template.',
                    'Paste the answer into the field and press *Parse*. You get a two-week expansion and a “Not understood” list — it should stay empty.',
                    '*Approve the plan*. The main screen gets a “Today by the plan” card, and it overrides the queue.'
                ] },
                { rows: [
                    ['How a day is written', '“Mon Biceps band 6 × 50”. Several exercises in one day are joined with a “+”. A day off is “Sun rest”. For a timed exercise the second number means seconds: “Plank 2 × 45”.'],
                    ['A missed day', 'A missed day is simply missed: it is not carried over and does not pile up as debt — it comes back a week later in its own place. The grid holds: basketball stays on Wednesday and Sunday stays a rest day. Nothing to chase.'],
                    ['Editing', 'Same screen: the field already holds the plan in force. Fix a line, press *Parse*, look at what changed in the expansion, and approve it again.'],
                    ['Boundaries', 'Before the plan starts, the main screen shows its start date and first session. A week before the end the app warns you and offers to ask for the next one. Once it is over the app says so and goes back to history-based suggestions.'],
                    ['An unknown exercise', 'The plan is not written by the app, and the names in it are its own. Anything missing from the catalogue can be added right from the card — one name at a time.'],
                    ['Forecast', 'While a plan is declared, “Consistency” in statistics stops guessing from history and names the day from the grid: guessing where it has been stated is pointless.']
                ] },
                { hint: 'A plan holds one weekly grid and a length. If the weeks differ — say the volume alternates every other week — ask for them as separate blocks, each with its own start date, and approve one every Monday. The plan syncs to the cloud along with your history: declared on the computer, it shows up on the phone.' }
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
                { hint: 'On iPhone there is a caveat: the sound plays only while the screen is on. A phone in your pocket will not voice the program — put it next to you face up. The app reminds you of this on the program screen itself.' },
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
                    ['Rest timer', 'Whether it runs and how long it is: type the number or find it with the slider. This is the starting point for exercises you have not said anything about yet: familiar ones keep their own length, remembered from last time, and it is changed during the workout.'],
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
                    'Wähle eine Art (*Kraft*, *Morgengymnastik*, *Tabata*…) und tippe auf *Übung hinzufügen*. Im Auswahlfenster gibt es eine Suche und Gruppen-Chips — Brust, Beine, Bauch: nach Gruppe zu suchen geht schneller, als sich den Namen zu merken. Nicht dabei? Leg sie gleich hier mit *Erstellen* an: gefragt werden Name, Art und Muskelgruppe.',
                    'Trage für jede Zeile Sätze und Wiederholungen ein, bei Hantelübungen auch das Gewicht. Übungen mit Eigengewicht haben hier kein Gewichtsfeld: Die App berechnet die Last selbst. Hast du die Übung schon gemacht, erscheint dein letztes Ergebnis; wenn nicht und dein Körpergewicht ist erfasst, wird das Gewicht geschätzt — die Zeile sagt es dir.',
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
                    ['Training', 'Ein neues starten oder ein offenes fortsetzen. Hier stehen auch die Warteschlange der Zusammenstellungen, vergessene Übungen, die letzten sieben Tage und dein Körpergewicht.'],
                    ['Verlauf', 'Alle abgeschlossenen Trainings. Suche, Filter nach Art und Übung, ein eigener Tabata-Chip. Eine Karte lässt sich öffnen und korrigieren: Zahlen eines Satzes, Notizen, Löschen. Von dort wird ein Training auch wiederholt.'],
                    ['Statistik', 'Summen für einen Zeitraum, Auswertung je Übung, persönliche Rekorde, Verlauf der Ergebnisse, Wochentage und Serien, eine Vorhersage für das nächste Training, eine Jahreskarte nach Tagen.'],
                    ['Profil', 'Einstellungen, Übungskatalog, Synchronisierung, Sicherungskopie und diese Anleitung.']
                ] },
                { hint: 'Unten (am Rechner links) stehen vier Bereiche, zwischen denen die App wechselt. Der Zurück-Knopf des Browsers funktioniert wie gewohnt.' }
            ]
        },
        {
            name: 'Schnelle Wege anzufangen',
            blocks: [
                { p: 'Du musst nicht jedes Mal einen Plan von Null bauen — die App schlägt selbst vor, womit du anfängst.' },
                { rows: [
                    ['An der Reihe', 'Die oberste Karte auf der Startseite, farbig umrandet. Die Zusammenstellung, zu der du zurückkehrst und die am längsten nicht dran war. Sie nimmt nicht den Plan jenes Trainings, sondern das, was du tatsächlich gemacht hast.'],
                    ['Danach', 'Die Chips unter der Karte sind der Rest der Warteschlange. Die Beschriftung sagt, wie viele Tage seit dem letzten Mal vergangen sind, und danach ist die Reihe geordnet. Der Abstand stammt aus deinem eigenen Verlauf der letzten acht Wochen und rechnet sich selbst neu: Machst du etwas seltener, steigt die Schwelle. Doch vor dem Termin zählen die Muskeln: Eine Zusammenstellung, deren Gruppe kürzlich gearbeitet hat, rutscht nach unten, wie lange sie auch her ist.'],
                    ['Am häufigsten', 'Trainings vom Typ „Morgengymnastik“ stehen für sich und nicht in der Warteschlange: Die machst du jeden Morgen ohne Erinnerung, und sie gleichrangig zu zählen hieße, die Muskeln für dauerhaft müde zu erklären. Der Chip verschwindet hier nach dem Training nicht, sondern wird farbig markiert: grüner Rahmen heißt heute schon erledigt, ein warmer heißt noch nicht.'],
                    ['Vergessen', 'Ein gestrichelter Chip in einem eigenen Abschnitt. Eine Übung, die länger als sonst nicht dran war und zu keiner wiederkehrenden Zusammenstellung gehört. Die Pfeile an den Seiten blättern durch sie, die Beschriftung sagt, wie viele Tage seit dem letzten Mal vergangen sind, und ein Tippen auf den Namen baut daraus ein Training. Sortiert wird vom Längsten zum Kürzesten; was länger als acht Wochen fehlt, fällt heraus — das ist nicht mehr vergessen, sondern aufgegeben.'],
                    ['Was du wiederholst', 'Erscheint statt der Warteschlange, solange es noch keinen Rhythmus gibt: Die Zusammenstellung kam vor, aber seltener als dreimal, und ein Abstand lässt sich daraus nicht ableiten. Ganz ohne Verlauf stehen hier stattdessen die Vorlagen.'],
                    ['Vorlagen', 'Eine gespeicherte Zusammenstellung. Sie stehen hinter „Alle Vorlagen“. Eine Vorlage lässt sich ändern und duplizieren; bereits absolvierte Trainings bleiben davon unberührt.'],
                    ['Dieses Training wiederholen', 'In der Zusammenfassung jedes Trainings aus dem Verlauf. Auf der Startseite gibt es diesen Knopf nicht: Das Wiederholen von gestern braucht man selten, und der Platz dort gehört der Warteschlange.']
                ] }
            ]
        },
        {
            name: 'Während des Trainings',
            blocks: [
                { rows: [
                    ['Einen Satz erfassen', 'In den Feldern steht bereits dein letztes Ergebnis. Ändere, was abweicht, und tippe auf Erledigt. Daneben siehst du das letzte Mal, deinen Rekord und wie dieser Satz im Vergleich zum gleichen Satz beim letzten Mal ausfällt.'],
                    ['Übungen mit Eigengewicht', 'Bei Liegestützen und Klimmzügen berechnet die App die Last selbst: Die Zeile „Eigengewicht“ ist der Anteil deines Körpergewichts, der auf die Übung entfällt, und genau der geht in die Statistik. Dort ist nichts einzutragen. Der Link „＋ Zusatzgewicht“ ist nur dafür da, wenn du wirklich einen Gürtel angelegt oder eine Hantel eingeklemmt hast: Es wird zur Last addiert und erscheint in einer zweiten Zeile. Die Tonnage in Statistik und Historie ist die gesamte Last zusammen — Eigengewicht und Zusatzgewicht; das Körpergewicht wird zum Datum des Satzes genommen, ein neues Wiegen schreibt vergangene Trainings also nicht um. Den Anteil kannst du anpassen — Profil → Katalog → Anteile des Eigengewichts; eine Änderung rechnet die gesamte Historie sofort neu.'],
                    ['Reihenfolge der Übungen', 'Standardmäßig im Kreis: ein Satz der ersten, ein Satz der zweiten, wieder die erste. In den Einstellungen kannst du „nacheinander“ wählen — eine Übung ganz abschließen — oder freie Reihenfolge. Das lässt sich auch mitten im Training umstellen.'],
                    ['Pause', 'Startet nach dem Erfassen von selbst. Mit den Knöpfen „±5 s“ wird die Zeit verlängert und verkürzt; hältst du einen gedrückt, beschleunigt sich der Schritt, und drei Minuten sind eine Bewegung entfernt. Das Geänderte merkt sich die Übung: nach Kniebeugen die eine Zeit, nach der Planke die andere. Die Einstellung im Profil bleibt der Ausgangspunkt für Übungen, zu denen du noch nichts gesagt hast. Hat eine Übung ihre eigene Zeit, steht das auf der Leiste. Am Ende: Ton und Vibration, sofern eingeschaltet.'],
                    ['„Mehr…“', 'Dahinter liegt das Seltene: eine Übung außerhalb des Plans, überspringen, zu einer erledigten zurück, eine Notiz.'],
                    ['Notizen', 'Drei Ebenen: zum Satz, zur Übung in diesem Training und zum ganzen Training. Sie tauchen später im Verlauf auf.'],
                    ['Übung auf Zeit', 'Unter dem Sekundenfeld steht die Taste *Countdown*. Fünf Sekunden zum Bereitmachen, dann zählt die App laut mit denselben Signalen wie bei Tabata und trägt den Satz selbst ein, wenn die Zeit um ist. Hörst du früher auf, wird eingetragen, was wirklich vergangen ist, nicht das Versprochene. Lässt du das Feld leer, läuft eine Stoppuhr: Für eine Planke bis zum Versagen gibt es gar kein Ziel.'],
                    ['Nicht beendet', 'Schließt du die App mitten im Training, bleibt es auf der Startseite und lässt sich fortsetzen. Nach 12 Stunden wird Fortsetzen nicht mehr angeboten — nur noch Beenden mit eigenem Datum: sonst käme die ganze Nacht zur Dauer dazu.']
                ] }
            ]
        },
        {
            name: 'Trainingsplan',
            blocks: [
                { p: 'Die Warteschlange auf der Startseite beantwortet die Frage „wozu bin ich am längsten nicht gekommen“ und ist kein Stundenplan: Ein wandernder Zirkel hat ungleiche Abstände, und die Reihenfolge weicht zwangsläufig vom Gedachten ab. Ein Plan ist ein erklärtes Wochenraster: welcher Wochentag wem gehört. Ohne Plan bleibt alles wie zuvor.' },
                { sub: 'So legst du ihn an' },
                { steps: [
                    '*Training* → *Trainingsplan*.',
                    'Frag einen Trainer oder ein Sprachmodell nach einem Plan: In der *Trainer-Zusammenfassung* liegt bereits eine fertige Anfrage samt Antwortvorlage.',
                    'Füge die Antwort ins Feld ein und drücke *Auswerten*. Du bekommst eine Zwei-Wochen-Ansicht und eine Liste „Nicht verstanden“ — die sollte leer bleiben.',
                    '*Plan bestätigen*. Auf der Startseite erscheint die Karte „Heute laut Plan“, und sie ersetzt die Warteschlange.'
                ] },
                { rows: [
                    ['Wie ein Tag geschrieben wird', '„Mo Bizeps Band 6 × 50“. Mehrere Übungen an einem Tag werden mit „+“ verbunden. Ein freier Tag ist „So Ruhe“. Bei einer Übung auf Zeit bedeutet die zweite Zahl Sekunden: „Planke 2 × 45“.'],
                    ['Verpasster Tag', 'Ein verpasster Tag ist einfach verpasst: Er wird nicht nachgeholt und sammelt sich nicht als Schuld an — er kommt eine Woche später an seinem Platz zurück. Das Raster bleibt: Basketball bleibt am Mittwoch, Sonntag bleibt Ruhetag. Da ist nichts aufzuholen.'],
                    ['Ändern', 'Derselbe Bildschirm: Im Feld liegt bereits der geltende Plan. Ändere eine Zeile, drücke *Auswerten*, sieh dir an, was sich in der Ansicht ändert, und bestätige erneut.'],
                    ['Ränder', 'Bevor der Plan beginnt, zeigt die Startseite sein Startdatum und die erste Einheit. Eine Woche vor Ende warnt die App und bietet an, den nächsten anzufragen. Ist er vorbei, sagt sie es und kehrt zu Vorschlägen nach Verlauf zurück.'],
                    ['Unbekannte Übung', 'Den Plan schreibt nicht die App, und die Namen darin sind seine eigenen. Was im Katalog fehlt, lässt sich direkt von der Karte anlegen — jeder Name einzeln.'],
                    ['Prognose', 'Solange ein Plan erklärt ist, rät „Beständigkeit“ in der Statistik nicht mehr nach Verlauf, sondern nennt den Tag aus dem Raster: Raten, wo es gesagt wurde, ist sinnlos.']
                ] },
                { hint: 'Ein Plan hält ein Wochenraster und eine Dauer. Unterscheiden sich die Wochen — etwa wenn der Umfang jede zweite Woche wechselt —, frag sie als eigene Blöcke an, jeden mit eigenem Startdatum, und bestätige montags einen. Der Plan geht mit dem Verlauf in die Cloud: am Computer erklärt, erscheint er auf dem Telefon.' }
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
                { hint: 'Auf dem iPhone gibt es einen Vorbehalt: Der Ton läuft nur bei eingeschaltetem Bildschirm. Ein Handy in der Tasche vertont das Programm nicht — leg es mit dem Display nach oben neben dich. Die App erinnert daran auf dem Programmbildschirm selbst.' },
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
                    ['Pausentimer', 'Ob er läuft und wie lang er ist: Zahl eintippen oder mit dem Regler einstellen. Das ist der Ausgangspunkt für Übungen, zu denen du noch nichts gesagt hast: Bekannte behalten ihre eigene Zeit vom letzten Mal, geändert wird sie im Training.'],
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
