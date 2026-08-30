/**
 * Ритм тренировок и прогноз следующей (§26.2 ТЗ).
 *
 * Никакого предсказания в смысле угадывания: считается медианный промежуток
 * между тренировочными днями и, если он устойчив, к последнему дню
 * прибавляется этот промежуток. Медиана, а не среднее, — одна пропущенная
 * неделя сдвинула бы среднее на несколько дней, а медиану не двигает.
 *
 * Модуль обязан честно говорить «данных мало». Прогноз по трём тренировкам —
 * это не прогноз, а совпадение, и подавать его как знание нельзя.
 */

const DAY = 86400000;

/** Минимум тренировок, ниже которого о ритме говорить нечего. */
const MIN_WORKOUTS = 5;

/** Сколько последних тренировок учитывать: ритм полугодовой давности не про сейчас. */
const WINDOW = 20;

/**
 * Что считается «сейчас» для очереди составов и для забытого.
 *
 * Восемь недель. Ненадолго было двенадцать — ради редких тренировок: чтобы
 * у состава был известен промежуток, нужно три занятия внутри окна, то есть
 * промежуток не больше половины окна, и восемь недель обрезали всё, что реже
 * раза в три недели.
 *
 * Оказалось, что лечили не ту болезнь. Редкое пряталось не из-за окна, а
 * потому, что очередь не смотрела на мышцы и считала зарядку тренировкой
 * (Р-33). Когда это починили, широкое окно осталось без работы — и стало
 * мешать: промежуток, посчитанный по трём месяцам, описывает позавчерашний
 * образ жизни и медленно отзывается на перемены. А человек меняется:
 * заводит утреннюю зарядку, уходит от одного упражнения к другому.
 *
 * Восемь недель — это две-три полных смены привычки. Достаточно, чтобы
 * повтор стал виден, и достаточно мало, чтобы прошлое не спорило с
 * настоящим.
 */
const RECENT_WEEKS = 8;

const startOfDay = (ts) => {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
};

export const rhythm = {

    MIN_WORKOUTS,
    WINDOW,
    RECENT_WEEKS,

    median(values) {
        if (values.length === 0) return 0;

        const sorted = [...values].sort((a, b) => a - b);
        const middle = Math.floor(sorted.length / 2);

        return sorted.length % 2
            ? sorted[middle]
            : (sorted[middle - 1] + sorted[middle]) / 2;
    },

    /**
     * Уникальные тренировочные дни по возрастанию.
     *
     * Две тренировки в один день — это один день ритма, а не промежуток в
     * ноль дней: иначе медиана обнулилась бы и прогноз показывал «сегодня»
     * каждый раз.
     */
    workoutDays(workouts = []) {
        const days = new Set(workouts.map((w) => startOfDay(w.startedAt)));
        return [...days].sort((a, b) => a - b);
    },

    /** Промежутки между соседними тренировочными днями, в днях. */
    intervals(days = []) {
        const result = [];
        for (let i = 1; i < days.length; i++) {
            result.push(Math.round((days[i] - days[i - 1]) / DAY));
        }
        return result;
    },

    /**
     * Насколько промежутки одинаковы: медиана отклонения от медианы,
     * делённая на саму медиану. Ноль — идеальный ритм.
     */
    spread(intervals, medianValue) {
        if (!medianValue || intervals.length === 0) return 1;

        const deviations = intervals.map((v) => Math.abs(v - medianValue));
        return rhythm.median(deviations) / medianValue;
    },

    /** Дни недели, на которые приходится большинство тренировок. Понедельник — 0. */
    typicalWeekdays(days = []) {
        const counts = new Array(7).fill(0);
        for (const day of days) counts[(new Date(day).getDay() + 6) % 7] += 1;

        // Порог — две седьмых: при трёх тренировках в неделю привычный день
        // набирает больше, а случайные выходные отсеиваются
        const threshold = days.length / 7 * 2;

        return counts
            .map((count, index) => ({ index, count }))
            .filter((d) => d.count >= Math.max(2, threshold))
            .sort((a, b) => b.count - a.count)
            .map((d) => d.index);
    },

    /**
     * Разбор ритма. workouts — завершённые тренировки, порядок любой.
     *
     * Возвращает { enough, ... }. При enough: false остальные поля тоже
     * заполнены, но показывать их как прогноз нельзя.
     */
    analyze(workouts = [], now = Date.now()) {
        const all = rhythm.workoutDays(workouts);
        const days = all.slice(-WINDOW);

        const lastAt = days[days.length - 1] ?? null;
        const daysSince = lastAt === null ? null : Math.round((startOfDay(now) - lastAt) / DAY);

        if (days.length < MIN_WORKOUTS) {
            return {
                enough: false,
                need: MIN_WORKOUTS - days.length,
                count: days.length,
                lastAt, daysSince,
                medianInterval: null, nextAt: null, state: null, confidence: null,
                weekdays: []
            };
        }

        const gaps = rhythm.intervals(days);
        const medianInterval = Math.max(1, Math.round(rhythm.median(gaps)));
        const spread = rhythm.spread(gaps, medianInterval);

        let nextAt = lastAt + medianInterval * DAY;

        // Если тренировки явно привязаны к дням недели, прогноз подтягивается
        // к ближайшему такому дню: «раз в 2,5 дня» на календаре не бывает
        const weekdays = rhythm.typicalWeekdays(days);
        if (weekdays.length >= 2 && weekdays.length <= 5) {
            nextAt = rhythm.snapToWeekday(nextAt, weekdays, now);
        }

        return {
            enough: true,
            count: days.length,
            medianInterval,
            spread,
            weekdays,
            lastAt,
            daysSince,
            nextAt,
            state: daysSince >= medianInterval * 2 ? 'overdue'
                : daysSince >= medianInterval ? 'due'
                : 'rest',
            confidence: spread <= 0.25 ? 'high' : spread <= 0.6 ? 'medium' : 'low'
        };
    },

    /**
     * Ближайший день (в пределах ±3 суток), попадающий на привычный день
     * недели.
     *
     * Назад — только пока не вышли за сегодня. Подтягивать разрешено в обе
     * стороны: привычный день может оказаться и раньше расчётного. Но
     * притянутый в прошлое прогноз — это уже не прогноз: на экране
     * появлялось «Следующая — 2 июля», когда на дворе третье.
     */
    snapToWeekday(ts, weekdays, now = Date.now()) {
        const target = new Set(weekdays);
        const floor = startOfDay(now);

        for (let shift = 0; shift <= 3; shift++) {
            for (const direction of shift === 0 ? [0] : [1, -1]) {
                const candidate = ts + direction * shift * DAY;

                if (candidate < floor) continue;
                if (target.has((new Date(candidate).getDay() + 6) % 7)) return candidate;
            }
        }

        return ts;
    },

    /**
     * Периодичность каждого упражнения (§26.2.3).
     *
     * Подсказка по типу тренировки часто молчит: у всех тренировок тип
     * может быть один — «Силовая», — а различаются они названиями шаблонов.
     * Цикла в одинаковых значениях нет, и предлагать нечего.
     *
     * Упражнения же различаются всегда. У каждого свой промежуток: жим раз
     * в четыре дня, пресс через день. Отсюда и берётся, чему пора.
     *
     * Считается по сводке внутри тренировки (§34.1) — списку упражнений,
     * который лежит в самой записи. Подходы для этого не читаются.
     */
    exerciseRhythm(entries = [], now = Date.now()) {
        const days = new Map();

        for (const entry of entries) {
            const day = startOfDay(entry.workout.startedAt);

            for (const id of entry.exerciseIds || []) {
                if (!days.has(id)) days.set(id, new Set());
                days.get(id).add(day);
            }
        }

        const today = startOfDay(now);

        return [...days.entries()].map(([exerciseId, set]) => {
            const list = [...set].sort((a, b) => a - b).slice(-WINDOW);

            const lastAt = list[list.length - 1];
            const daysSince = Math.round((today - lastAt) / DAY);

            // Один промежуток — это ещё не периодичность, а совпадение
            const gaps = rhythm.intervals(list);
            const enough = gaps.length >= 2;

            const medianInterval = enough
                ? Math.max(1, Math.round(rhythm.median(gaps)))
                : null;

            return {
                exerciseId,
                sessions: list.length,
                lastAt,
                daysSince,
                medianInterval,
                enough,

                // Насколько просрочено: 1 — ровно пора, 2 — вдвое дольше
                // обычного. По этой мере и сравниваются упражнения между
                // собой, иначе редкое всегда проигрывало бы частому
                overdue: enough ? daysSince / medianInterval : 0
            };
        });
    },

    /**
     * Составы, которые повторяются чаще всего (§29.1).
     *
     * Состав — это набор упражнений, без оглядки на порядок и на тип
     * тренировки: «пресс, приседания, отжимания» остаются той же
     * тренировкой, в каком бы порядке их ни делали и как бы ни назвали.
     *
     * Считается по последним неделям, а не по всей истории: то, что человек
     * делал прошлой зимой, к сегодняшнему быстрому старту отношения не
     * имеет. Одного раза мало — это ещё не «часто», а просто был такой день.
     *
     * Порядок — от редкого к частому, и это не описка. Самое частое и так
     * стоит выше отдельной кнопкой «Повторить прошлую»: то, что делаешь
     * каждый день, вчера и делал. Место в плашках дороже отдать тому, что
     * делаешь через раз и потому забываешь. По той же причине при нехватке
     * места отваливается самое частое, а не самое редкое.
     *
     * Из-за этого «часто» в названии описывает отбор, а не порядок: в
     * плашки попадает только то, что повторялось, но вперёд идёт редкое.
     */
    frequentWorkouts(entries = [], now = Date.now(), { weeks = RECENT_WEEKS, min = 2, limit = 3 } = {}) {
        const since = startOfDay(now) - weeks * 7 * DAY;
        const groups = new Map();

        for (const entry of entries) {
            if (entry.workout.startedAt < since) continue;

            const ids = [...new Set(entry.exerciseIds || [])].sort();
            if (ids.length === 0) continue;

            const key = ids.join('|');
            const group = groups.get(key) || { key, exerciseIds: ids, count: 0, lastAt: 0, workoutId: null };

            group.count += 1;

            // Запоминается самая свежая: по ней и собирается план, а веса в
            // ней ближе к нынешним, чем в первой такой тренировке
            if (entry.workout.startedAt > group.lastAt) {
                group.lastAt = entry.workout.startedAt;
                group.workoutId = entry.workout.id;
            }

            groups.set(key, group);
        }

        return [...groups.values()]
            .filter((g) => g.count >= min)

            // Реже — вперёд; при равной редкости вперёд то, что делали
            // недавно: оно ещё в голове, и вернуться к нему проще
            .sort((a, b) => a.count - b.count || b.lastAt - a.lastAt)
            .slice(0, limit);
    },

    /**
     * Составы, до которых пора вернуться (§29.1).
     *
     * То же, что периодичность упражнения, но для целой тренировки: у
     * каждого повторяющегося состава свой промежуток, и если с прошлого раза
     * прошло больше обычного — это дефицит, который закрывается одним
     * нажатием.
     *
     * Это очередь, а не список просроченного. Порога «пора» здесь нет: у
     * того, кто тренируется по своему кругу, просроченного почти никогда и
     * нет — очередь просто доходит до каждого по разу. Строгий порог оставлял
     * от трёх привычных тренировок одну, а остальные прятал именно потому,
     * что человек их вовремя делал. Поэтому показываем ближайших к своему
     * сроку, а насколько срок близок — говорит подпись.
     *
     * Один промежуток — это ещё не периодичность, а совпадение, и место
     * такому составу в хвосте очереди: сначала те, чей срок известен точно.
     * Совсем выбрасывать его нельзя — редкую тренировку человек делает по
     * два раза, и она никогда бы сюда не попала, хотя именно её и забывают.
     *
     * Сделанное сегодня не показывается никогда: только что закрытое обязано
     * уйти с глаз, а не стоять в очереди до завтра.
     *
     * Заброшенное — не очередь. Состав, который человек пропускал втрое
     * дольше обычного, он не «задолжал», а перестал делать: упражнения
     * уходят за ненадобностью, и вечно держать их первыми значит звать
     * обратно туда, откуда ушли.
     *
     * Но пропускал — это пока тренировался. Общий простой из счёта
     * вычитается: после отпуска просрочено всё сразу, и без этой поправки
     * заброшенным считалось бы всё, чем человек занимался. Вернувшись, он
     * увидел бы пустое место вместо своих же тренировок.
     */
    dueWorkouts(entries = [], now = Date.now(), { weeks = RECENT_WEEKS, limit = 4, cap = 3, groupOf = null, background = null, includeToday = false } = {}) {
        const since = startOfDay(now) - weeks * 7 * DAY;
        const today = startOfDay(now);

        /*
         * Фон в очереди не участвует (§29.1).
         *
         * Зарядка делается каждое утро и решения не требует: человек делает
         * её не потому, что приложение предложило. Место в очереди ей ни к
         * чему.
         *
         * Но главное не это. Зарядка нагружает те же мышцы, что и целевые
         * тренировки: в ней и отжимания, и бицепс. Считая её наравне, мы
         * получаем группы с промежутком в один день — а такая группа никогда
         * не проходит порог отдыха, и все составы с этими мышцами навсегда
         * уезжают в конец очереди. Круг из четырёх позиций разваливается на
         * две не из-за ритма человека, а из-за утренней разминки.
         *
         * Признак фона задаёт вызывающий: тип тренировки хранится подписью,
         * а подпись переводится, и ядру про «Зарядку» знать неоткуда.
         */
        const рабочие = background ? entries.filter((e) => !background(e.workout)) : entries;

        const groups = new Map();

        for (const entry of рабочие) {
            if (entry.workout.startedAt < since) continue;

            const ids = [...new Set(entry.exerciseIds || [])].sort();
            if (ids.length === 0) continue;

            const key = ids.join('|');
            const group = groups.get(key) || { key, exerciseIds: ids, days: new Set(), lastAt: 0, workoutId: null };

            group.days.add(startOfDay(entry.workout.startedAt));

            if (entry.workout.startedAt > group.lastAt) {
                group.lastAt = entry.workout.startedAt;
                group.workoutId = entry.workout.id;
            }

            groups.set(key, group);
        }

        // Простой: сколько дней человек не тренировался вовсе. На эту величину
        // просрочены сразу все составы, и в счёт заброшенности она не идёт
        const последняя = Math.max(0, ...[...groups.values()].map((g) => g.lastAt));
        const простой = последняя ? Math.round((today - startOfDay(последняя)) / DAY) : 0;

        // Отдых групп мышц: состав со свежей нагрузкой уходит вниз, каким бы
        // просроченным он ни был. Без карты групп правило молчит
        const отдых = groupOf ? rhythm.groupRest(рабочие, groupOf, now) : null;

        const отдохнул = (ids) => {
            if (!отдых) return true;

            return ids.every((id) => {
                const group = groupOf.get(id);
                return !group || (отдых.get(group)?.rested ?? true);
            });
        };

        return [...groups.values()]
            .map((group) => {
                const days = [...group.days].sort((a, b) => a - b);
                const gaps = rhythm.intervals(days);

                const interval = gaps.length >= 1
                    ? Math.max(1, Math.round(rhythm.median(gaps)))
                    : null;

                const daysSince = Math.round((today - startOfDay(group.lastAt)) / DAY);

                return {
                    key: group.key,
                    exerciseIds: group.exerciseIds,
                    workoutId: group.workoutId,
                    sessions: days.length,
                    lastAt: group.lastAt,
                    daysSince,
                    interval,

                    // Один промежуток — совпадение, два — уже периодичность
                    enough: gaps.length >= 2,

                    // Насколько близок срок: 1 — ровно пора, 2 — вдвое дольше
                    // обычного. Меньше единицы тоже показываем: это очередь
                    overdue: interval ? daysSince / interval : 0,

                    // На сколько дней опоздали. Этим и сортируем: множитель
                    // точнее, но подпись на плашке говорит в днях, и порядок,
                    // который ей противоречит, читается как ошибка. «5 дней»
                    // выше «12 дней» — верно по множителю и дико на вид
                    late: interval ? daysSince - interval : 0,

                    // Пропущено, пока человек был в строю, — мера заброшенности
                    skipped: interval ? Math.max(0, daysSince - простой) / interval : 0,

                    // Отдохнули ли мышцы, которые этот состав нагружает
                    rested: отдохнул(group.exerciseIds)
                };
            })
            .filter((g) => g.interval && (includeToday || g.daysSince >= 1) && g.skipped <= cap)
            /*
             * Отдых мышц — первый ключ, и он сильнее всего остального.
             * «Отжимания Тайсона» просрочены на восемнадцать дней, но трицепс
             * работал вчера: звать к нему сегодня незачем — просрочка никуда
             * не денется, а мышца за день не восстановится.
             *
             * Дальше — дни с прошлого раза, от большего к меньшему. Не
             * опоздание, хотя оно точнее: подпись на плашке называет дни, и
             * ряд, выстроенный по другой величине, читается как поломка.
             * Владелец споткнулся об это трижды, всякий раз по-новому, и
             * трижды был прав. Простое правило, совпадающее с тем, что видно
             * на экране, лучше точного, которое приходится объяснять.
             *
             * Цена известна: состав, который делают раз в две недели, встанет
             * выше того, что делают через день, даже если второму уже пора.
             * Гасит это отдых мышц — частое обычно ещё не восстановилось.
             */
            .sort((a, b) => (b.rested - a.rested)
                || (b.enough - a.enough)
                || (b.daysSince - a.daysSince)
                || (b.late - a.late))
            .slice(0, limit);
    },

    /**
     * Отдохнули ли группы мышц (§29.1).
     *
     * Периодичность состава говорит, когда к нему пора вернуться. Но она
     * ничего не знает про то, что вчера уже поработали теми же мышцами:
     * «Отжимания» и «Отжимания Тайсона» — разные составы и одна группа, и
     * очередь звала ко второму на следующий день после первого.
     *
     * Считается так же, как периодичность состава, только по группам: дни,
     * когда группа была нагружена, медиана промежутков между ними, и
     * сравнение с тем, сколько прошло. Никакой физиологии — те же сорок
     * восемь часов из учебника приложению взять неоткуда, да и у каждого
     * они свои. Мера одна: как человек сам обычно распределяет нагрузку.
     *
     * groupOf — Map «упражнение → группа». Упражнение без группы в счёт не
     * идёт: молчание не повод объявлять мышцы уставшими.
     */
    groupRest(entries = [], groupOf = new Map(), now = Date.now()) {
        const days = new Map();

        for (const entry of entries) {
            const day = startOfDay(entry.workout.startedAt);

            for (const id of entry.exerciseIds || []) {
                const group = groupOf.get(id);
                if (!group) continue;

                if (!days.has(group)) days.set(group, new Set());
                days.get(group).add(day);
            }
        }

        const today = startOfDay(now);
        const result = new Map();

        for (const [group, set] of days) {
            const list = [...set].sort((a, b) => a - b).slice(-WINDOW);
            const gaps = rhythm.intervals(list);

            const medianInterval = gaps.length >= 1
                ? Math.max(1, Math.round(rhythm.median(gaps)))
                : null;

            const daysSince = Math.round((today - list[list.length - 1]) / DAY);

            result.set(group, {
                group,
                daysSince,
                medianInterval,

                /*
                 * Половина обычного промежутка, а не весь.
                 *
                 * Весь промежуток — это «пора грузить», а вопрос здесь
                 * другой: успела ли мышца восстановиться. Порог в целый
                 * промежуток объявлял уставшими сразу все группы, и правило
                 * не отличало ничего от ничего.
                 *
                 * Половина берётся из его же ритма и потому масштабируется:
                 * группе, которую грузят через день, хватает суток, а той,
                 * до которой доходят раз в десять дней, нужно пять.
                 *
                 * Без промежутка судить не о чем — считаем, что отдохнула.
                 */
                rested: medianInterval === null || daysSince * 2 >= medianInterval
            });
        }

        return result;
    },

    /** Сколько упражнений обычно бывает в тренировке. */
    typicalSize(entries = []) {
        const sizes = entries.slice(0, WINDOW)
            .map((e) => (e.exerciseIds || []).length)
            .filter((n) => n > 0);

        return sizes.length ? Math.max(1, Math.round(rhythm.median(sizes))) : 1;
    },

    /**
     * Каким упражнениям пора — ровно на одну тренировку (§26.2.3).
     *
     * Порог — единица: прошло не меньше обычного промежутка. Предлагать
     * раньше значит звать делать то, что и так в графике.
     *
     * Но просроченного к любому дню накапливается больше, чем делают за
     * раз, и список из всего залежавшегося — это не тренировка, а перечень
     * долгов. Поэтому берётся столько, сколько обычно бывает в тренировке.
     *
     * И не любые: самое просроченное задаёт направление, а добираются к
     * нему те, с которыми оно чаще всего делалось вместе. Иначе в один день
     * попали бы спина, ноги и пресс только потому, что все трое залежались.
     */
    dueExercises(entries = [], now = Date.now(), { limit = null, skip = null, weeks = RECENT_WEEKS } = {}) {
        /*
         * skip — то, что предлагать нельзя: архив.
         *
         * Архив и есть способ сказать «я это больше не делаю», а
         * заброшенное упражнение просрочено сильнее всего и лезло в
         * предложение первым. Приложение звало обратно ровно к тому, от
         * чего человек только что отказался.
         */
        const убрано = skip instanceof Set ? skip : new Set(skip || []);

        /*
         * Дальше расчётного окна — уже не забытое (§29.1).
         *
         * Забыть можно то, что ещё помнишь: упражнение, которого не было
         * дольше двенадцати недель, из жизни ушло, а не выпало из виду. За
         * этой границей приложение звало бы обратно к прошлогоднему
         * увлечению — и звало бы тем настойчивее, чем дольше человек к нему
         * не возвращался.
         */
        const предел = weeks * 7;

        /*
         * Порядок — по дням с прошлого раза, от большего к меньшему.
         *
         * Не по просрочке в разах: здесь, в отличие от очереди составов,
         * сравнивать нечего — плашка показывает по одному, и подпись
         * называет дни. Дни и должны решать, кто первым.
         */
        const overdue = rhythm.exerciseRhythm(entries, now)
            .filter((e) => e.enough && e.overdue >= 1 && e.daysSince <= предел && !убрано.has(e.exerciseId))
            .sort((a, b) => b.daysSince - a.daysSince);

        if (overdue.length === 0) return [];

        const cap = limit || rhythm.typicalSize(entries);
        const [anchor, ...rest] = overdue;

        // Сколько раз каждое упражнение встречалось в одной тренировке с
        // самым просроченным
        const together = new Map();

        for (const entry of entries) {
            const ids = entry.exerciseIds || [];
            if (!ids.includes(anchor.exerciseId)) continue;

            for (const id of ids) together.set(id, (together.get(id) || 0) + 1);
        }

        rest.sort((a, b) => {
            const pair = (together.get(b.exerciseId) || 0) - (together.get(a.exerciseId) || 0);
            return pair !== 0 ? pair : b.overdue - a.overdue;
        });

        return [anchor, ...rest].slice(0, cap);
    },

    /**
     * Какой тип тренировки логично провести следующим.
     *
     * Сначала ищется повторяющийся цикл: «грудь — спина — ноги» по кругу.
     * Если цикла нет, предлагается тип, который дольше всех не делали, —
     * это тоже подсказка, просто более слабая.
     */
    suggestType(workouts = []) {
        const sequence = [...workouts]
            .sort((a, b) => b.startedAt - a.startedAt)
            .slice(0, WINDOW)
            .map((w) => w.type);

        if (sequence.length < 3) return null;

        for (let period = 2; period <= 4; period++) {
            if (sequence.length < period * 2) break;

            let matches = true;
            for (let i = 0; i + period < sequence.length && i < period * 2; i++) {
                if (sequence[i] !== sequence[i + period]) { matches = false; break; }
            }

            // Цикл из одинаковых значений циклом не является
            const unique = new Set(sequence.slice(0, period));
            if (matches && unique.size === period) {
                return { type: sequence[period - 1], reason: 'cycle', period };
            }
        }

        const seen = new Map();
        sequence.forEach((type, index) => {
            if (!seen.has(type)) seen.set(type, index);
        });

        if (seen.size < 2) return null;

        const [type] = [...seen.entries()].sort((a, b) => b[1] - a[1])[0];
        return { type, reason: 'stale' };
    }
};
