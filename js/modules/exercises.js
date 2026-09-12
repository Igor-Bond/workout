/**
 * Справочник упражнений (§5 ТЗ).
 *
 * Упражнение — сущность с постоянным идентификатором, а не строка внутри
 * записи истории. От этого зависят рекорды, статистика по упражнению и
 * целостность плана, который ссылается на упражнение по идентификатору.
 *
 * Поэтому удаление здесь почти всегда недоступно: упражнение, встречавшееся
 * в тренировках, отправляется в архив.
 */

import { ui } from '../core/ui.js';
import { actions } from '../core/actions.js';
import { dialog } from '../core/dialog.js';
import { dbService } from '../services/db.js';
import { t } from '../core/i18n.js';
import { app } from '../app.js';
import { format } from '../core/format.js';
import { KINDS, kindLabel } from '../core/kinds.js';
import { ai, DEFAULT_MODEL, KEY_SETTING, MODEL_SETTING } from '../services/ai.js';
import { prompt } from '../core/prompt.js';
import { migrations } from '../services/migrations.js';
import { plan as ядроПлана } from '../core/plan.js';
import { estimate } from '../core/estimate.js';
import { renameInPlan, planCalls } from './planner.js';

/** Строка списка. Счётчик подходов объясняет, почему нельзя удалить. */
function row(exercise, usage) {
    const used = usage.get(exercise.id) || 0;

    /*
     * Ключ поиска едет в самой строке (Р-93).
     *
     * Отбор делается на месте, без перерисовки экрана, и сравнивать ему надо с
     * чем-то, что уже есть в разметке. Считать ключ заново из показанного
     * текста нельзя: там и вид, и число подходов, и по «12 подходов» нашлось
     * бы полсправочника.
     */
    const искомое = `${ключ(exercise.name)} ${ключ(exercise.group || '')}`.trim();

    return ui.html`
        <div class="ex-row" data-id="${exercise.id}" data-search="${искомое}">
            <!--
                Нажимается вся левая часть строки, а не одна строчка названия
                (§5.2, Р-120).

                Название нажималось и раньше — описание техники нужнее всего в
                зале, и добираться до него через правку значит открыть окно,
                где всё остальное можно случайно испортить. Но целью была ровно
                высота текста, двадцать точек в строке высотой около пятидесяти:
                подстрочник «Силовое · Спина · 12 подходов» и свободное место
                рядом не нажимались ничем.

                Две трети строки выглядели нажимаемыми и молчали. Человек из
                двух молчаливых нажатий делает вывод, что описания просто нет, —
                и больше не пробует.
            -->
            <button class="ex-main" data-action="ex-info" data-id="${exercise.id}">
                <span class="ex-name">${exercise.name}</span>
                <span class="ex-meta">
                    ${kindLabel(exercise.kind)}
                    ${exercise.group ? ui.raw(` · ${ui.esc(exercise.group)}`) : ''}
                    ${used > 0 ? ui.raw(` · ${ui.esc(format.count(used, format.WORDS.set))}`) : ''}
                </span>
            </button>
            <!--
                Одна кнопка вместо четырёх значков (Р-111).

                Было ✎ ⇥ ⌫ × — и что делают два средних, узнать было неоткуда:
                подпись жила во всплывающей подсказке, а на телефоне наведения
                нет. Объединение дублей — то, ради чего справочник и задуман
                (§5.1), — так просто не существовало для человека с телефоном.

                Ряд из четырёх кнопок съедал вдобавок половину строки, и имена
                резались на полуслове; у упражнений с историей кнопок было три,
                поэтому ширина имени скакала между соседними строками, а самая
                правая кнопка значила то «в архив», то «удалить навсегда».
                Теперь место действий постоянное, а имени остаётся вся строка.
            -->
            <div class="ex-actions">
                <button class="icon-btn" data-action="ex-menu" data-id="${exercise.id}"
                        aria-label="${t('Что сделать с упражнением')}">⋯</button>
            </div>
        </div>
    `;
}

/**
 * Поиск по справочнику (§5.3).
 *
 * Список растёт вместе с программой: у владельца в нём два десятка
 * упражнений, и найти «Отжимания узким хватом» среди трёх видов отжиманий
 * прокруткой — это уже работа. Поиск живёт в модуле, а не в разметке:
 * перерисовка не должна его стирать.
 *
 * Ищем по названию и по группе мышц: «грудь» отвечает на вопрос не хуже
 * точного имени, а помнят люди чаще группу.
 */
let поиск = '';

/*
 * Ключ поиска — тот же, которым упражнение ищется по имени в базе.
 *
 * Своей нормализации здесь заводить незачем: «Жим лёжа» и «жим лежа» должны
 * находиться одинаково и в поиске, и в справочнике, а два написания одного
 * правила однажды разойдутся.
 */
const ключ = (s) => migrations.normalizeName(s);

export const exercises = {

    title: 'Справочник',
    nav: 'profile',

    async render() {
        const all = await dbService.listExercises({ includeArchived: true });

        // Сколько раз упражнение встречается в истории — считаем один раз
        // на весь список, а не в каждой строке отдельно
        const usage = new Map();
        await Promise.all(all.map(async (e) => {
            usage.set(e.id, await dbService.countSetsOfExercise(e.id));
        }));

        // Списки полные: отбор идёт по разметке, а не по данным (Р-93)
        const active = all.filter((e) => !e.archived);
        const archived = all.filter((e) => e.archived);
        const foreign = await dbService.countForeignBaseExercises();

        return ui.html`
            ${ui.raw(ui.title(t('Справочник упражнений'),
                t('История упражнения держится на его записи здесь, поэтому используемое упражнение можно только архивировать')))}

            <button class="btn btn-accent" data-action="ex-add">${t('Добавить упражнение')}</button>

            <!--
                Поиск стоит над списком и появляется, только когда список
                правда длинный (§5.3): над пятью строками он занимал бы место
                и ничего не решал.
            -->
            ${all.length >= 12 ? ui.html`
                <div class="field">
                    <input id="ex-search" type="text" autocomplete="off" spellcheck="false"
                           value="${поиск}" placeholder="${t('Поиск по названию или группе')}">
                </div>
            ` : ''}


            <!--
                Доли своего веса — отдельным экраном, а не полем в правке
                упражнения: смотреть их имеет смысл списком, сравнивая одно с
                другим, а поправить обычно нужно то, которое выбивается (§15.2).
            -->
            <button class="btn btn-ghost" data-action="nav" data-screen="shares">
                ${t('Доли своего веса')}
            </button>

            <!--
                Предложение перевести справочник появляется, только когда
                есть что переводить (§53).

                Само приложение названия не переименовывает: они записаны
                человеком, а переименовывать записанное оно не вправе. Но у
                того, кто сменил язык на давно заведённой базе, остаётся
                чужой список посреди своего экрана — и это тоже неправильно.
                Разрешает спор он сам, одним нажатием.
            -->
            ${foreign > 0 ? ui.html`
                <div class="card">
                    <p class="hint" style="margin:0 0 10px">
                        ${t('{n} из базового списка стоят на другом языке. Свои названия и те, что правили вы, останутся как есть.',
                            { n: format.count(foreign, format.WORDS.exercise) })}
                    </p>
                    <button class="btn btn-ghost" data-action="ex-relocalize">
                        ${t('Перевести базовые упражнения')}
                    </button>
                </div>
            ` : ''}

            <!--
                Списки рисуются целиком, а отбор идёт на месте (Р-93): экран
                при вводе не перерисовывается, поле не подменяется, и
                клавиатура на телефоне не закрывается после каждой буквы.
            -->
            <div class="card" id="ex-active-card">
                <div class="card-title" id="ex-active-title">${t('В работе — {n}', { n: active.length })}</div>
                ${active.length
                    ? active.map((e) => row(e, usage))
                    : ui.raw(ui.empty(t('Все упражнения в архиве.')))}

                <p class="hint" id="ex-nothing" hidden>${t('Ничего не нашлось.')}</p>
            </div>

            ${archived.length ? ui.html`
                <div class="card" id="ex-archive-card">
                    <div class="card-title" id="ex-archive-title">${t('Архив — {n}', { n: archived.length })}</div>
                    ${archived.map((e) => row(e, usage))}
                </div>
            ` : ''}

            <button class="btn btn-ghost" data-action="nav" data-screen="profile">${t('← В профиль')}</button>
        `;
    },

    /**
     * Отбор восстанавливается после перерисовки (Р-93).
     *
     * Экран рисуется целиком по любому другому поводу — упражнение
     * заархивировали, переименовали, перевели, — и разметка возвращается
     * полной. Строка поиска при этом остаётся набранной, и список обязан
     * остаться отобранным: иначе после архивации из поиска перед человеком
     * молча разворачивается весь справочник.
     */
    mount() {
        if (поиск) отобрать();
    }
};

/**
 * Оставить видимыми подходящие строки (§5.3, Р-93).
 *
 * Прямо в разметке, без перерисовки экрана: перерисовка подменяет поле ввода
 * новым узлом, и телефон на это закрывает и открывает клавиатуру заново —
 * после каждой буквы. Фокус вернуть можно, мигание клавиатуры — нет.
 */
function отобрать() {
    const что = ключ(поиск);

    const счёт = { active: 0, archive: 0 };

    for (const строка of document.querySelectorAll('.ex-row')) {
        const подходит = !что || (строка.dataset.search || '').includes(что);

        строка.hidden = !подходит;

        if (!подходит) continue;
        if (строка.closest('#ex-archive-card')) счёт.archive += 1;
        else счёт.active += 1;
    }

    const заголовок = (id, текст) => {
        const el = document.getElementById(id);
        if (el && el.textContent.trim() !== текст) el.textContent = текст;
    };

    заголовок('ex-active-title', t('В работе — {n}', { n: счёт.active }));
    заголовок('ex-archive-title', t('Архив — {n}', { n: счёт.archive }));

    // Пустой архив при поиске прячется целиком: карточка с одним заголовком
    // «Архив — 0» отвечает на вопрос, которого не задавали
    const архив = document.getElementById('ex-archive-card');
    if (архив) архив.hidden = счёт.archive === 0;

    /*
     * «Ничего не нашлось» — только когда правда ничего (§5, Р-122).
     *
     * Подсказка пряталась по счёту работающих и про архив не спрашивала. Если
     * запрос совпал только с архивным упражнением, человек видел разом три
     * строки: «В работе — 0», «Ничего не нашлось» и сразу под этим «Архив —
     * 1» с нужной строкой. Приложение говорило неправду прямо над
     * опровержением.
     *
     * А ищут в справочнике чаще всего как раз затерявшееся — то, что когда-то
     * убрали. Прочитав «нет такого», человек закроет экран и заведёт
     * упражнение заново, разрезав историю надвое: ровно то, ради чего
     * справочник и существует.
     *
     * Когда прятать нечего, строка говорит по существу: в работе ничего, но в
     * архиве столько-то — и дальше видно, где именно.
     */
    const пусто = document.getElementById('ex-nothing');

    if (пусто) {
        пусто.hidden = счёт.active > 0;

        пусто.textContent = счёт.archive > 0
            ? t('В работе ничего. В архиве — {n}', { n: счёт.archive })
            : t('Ничего не нашлось.');
    }
}

// ================== ДЕЙСТВИЯ ==================

const kindOptions = () => KINDS.map((k) => ({ value: k.value, label: `${t(k.label)} — ${t(k.hint)}` }));

/**
 * Заполнить карточку упражнения силами тренера (§60.1).
 *
 * Тот же путь, что у незнакомых упражнений плана (§56.3), только для одного
 * названия. Смысл тот же: вид, группу и описание человек всё равно
 * дописывает руками — тем самым знанием, которое у собеседника есть, — а
 * приложение по названию их не угадает.
 *
 * Возвращает карточку или null. Осечка не молчит: спросили — надо ответить,
 * почему не вышло, иначе выглядит как сломанная кнопка.
 */
async function спроситьКарточку(имя) {
    const key = await dbService.getSetting(KEY_SETTING, '');
    if (!ai.ready(key)) return null;

    const список = await dbService.listExercises();
    const такое_же = (a, b) => migrations.normalizeName(a) === migrations.normalizeName(b);

    try {
        const ответ = await ai.ask({
            key,
            model: await dbService.getSetting(MODEL_SETTING, DEFAULT_MODEL),
            messages: [{ text: prompt.cards({ names: [имя], known: список }) }]
        });

        const [карточка] = prompt.readCards(ответ, { names: [имя], same: такое_же });

        // Узнавание («это то же, что X») здесь ни к чему: человек заводит
        // упражнение сам и на совпадение ему укажет проверка имени
        return карточка && !карточка.same ? карточка : null;
    } catch (e) {
        await dialog.alert({ title: t('Тренер не ответил'), text: e.message });
        return null;
    }
}

actions.on('ex-add', async () => {
    const values = await dialog.form({
        title: t('Новое упражнение'),
        fields: [
            { name: 'name', label: t('Название'), required: true, placeholder: t('Жим лёжа') },
            { name: 'kind', label: t('Вид'), type: 'select', value: 'weight', options: kindOptions() },
            { name: 'group', label: t('Группа мышц (необязательно)'), placeholder: t('Грудь') },

            // Те же поля, что при правке: заводить упражнение и тут же идти
            // дописывать к нему описание — лишний путь на ровном месте
            { name: 'howTo', label: t('Как выполнять (необязательно)'), type: 'textarea' }
        ],
        confirmText: t('Добавить')
    });

    if (!values) return;

    const existing = await dbService.findExerciseByName(values.name);
    if (existing) {
        await dialog.alert({
            title: t('Такое упражнение уже есть'),
            text: t('«{имя}» уже в справочнике{архив}.', { имя: existing.name, архив: existing.archived ? t(', сейчас в архиве') : '' })
        });
        return;
    }

    /*
     * Пустую карточку предлагаем заполнить тренеру (§60.1).
     *
     * Только пустую и только с согласия: человек, который вписал группу и
     * описание сам, ничего у собеседника не просил, а обращение — это его
     * ключ и его квота. Спрашиваем один раз, отказ ничего не ломает.
     */
    const пусто = !values.group?.trim() && !values.howTo?.trim();

    if (пусто && ai.ready(await dbService.getSetting(KEY_SETTING, ''))) {
        const согласен = await dialog.confirm({
            title: t('Заполнить карточку?'),
            text: t('Тренер подберёт группу и описание по образцу справочника. Вид вы уже выбрали — его он не тронет.'),
            confirmText: t('Заполнить'),
            cancelText: t('Не нужно')
        });

        if (согласен) {
            const карточка = await спроситьКарточку(values.name);

            if (карточка) {
                values.group = карточка.group || '';
                values.howTo = карточка.howTo || '';
            }
        }
    }

    await dbService.createExercise(values);
    app.render();
});


/**
 * Как выполнять (§5.2).
 *
 * Текстом, а не ссылкой: приложение работает без сети, а ссылка требует её и
 * живёт ровно до тех пор, пока ролик не удалят. Кнопка поиска рядом — для
 * тех случаев, когда текста мало и связь всё-таки есть; она ведёт в поиск, а
 * не на конкретное видео, потому что конкретное однажды пропадёт.
 */
actions.on('ex-info', async (el) => {
    const exercise = await dbService.getExercise(el.dataset.id);
    if (exercise) await показать(exercise);
});

/**
 * Как выполнять — описание техники и дорога к видео (§5.2).
 */
async function показать(exercise) {

    const где = [kindLabel(exercise.kind), exercise.group].filter(Boolean).join(' · ');

    const ключ = await dbService.getSetting(KEY_SETTING, '');

    const choice = await dialog.choose({
        title: exercise.name,
        text: exercise.howTo
            ? `${где}\n\n${exercise.howTo}`
            : `${где}\n\n${t('Описания нет. Его можно вписать своими словами — оно будет видно и во время интервальной программы.')}`,
        options: [
            // Тренер предлагается там, где описания нет: дописывать чужими
            // словами уже написанное своими — работа наоборот (§60.1)
            ...(!exercise.howTo && ai.ready(ключ)
                ? [{ value: 'ask', label: t('Пусть опишет тренер'), hint: t('Подберёт описание по образцу справочника') }]
                : []),
            { value: 'video', label: t('Найти видео'), hint: t('Откроется поиск в новой вкладке') },
            { value: 'edit', label: exercise.howTo ? t('Изменить описание') : t('Добавить описание') }
        ]
    });

    if (choice === 'edit') return editExercise(exercise);

    if (choice === 'ask') {
        const карточка = await спроситьКарточку(exercise.name);
        if (!карточка) return;

        await dbService.updateExercise(exercise.id, {
            howTo: карточка.howTo || '',

            // Группу не перебиваем: свою человек ставил осознанно
            group: exercise.group || карточка.group || ''
        });

        await app.render();

        return dialog.alert({ title: exercise.name, text: карточка.howTo || t('Описание не пришло.') });
    }

    if (choice === 'video') {
        const query = encodeURIComponent(t('{название} упражнение техника выполнения', { название: exercise.name }));
        window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank', 'noopener');
    }
}

/** Правка упражнения. Вызывается и карандашом, и из окна с описанием. */
async function editExercise(exercise) {

    /*
     * Довес — свойство снаряда, и ставится он здесь, а не только на
     * выполнении (§15.2, Р-117).
     *
     * У резинки доля собственного веса ноль (Р-85): её тянут руками, а не
     * поднимают себя, и нагрузка у неё внешняя. Пока сопротивление не
     * названо, тоннажа у такой работы нет вовсе — тридцать подходов на плечи
     * дают в статистике ноль килограммов.
     *
     * Сказать его можно было только вписав в поле посреди тренировки, где
     * человек занят другим. Здесь — спокойно и один раз на снаряд.
     *
     * Показывается только там, где своего веса нет: у отжиманий довес это
     * блин на спине, и «по умолчанию» ему взяться неоткуда.
     */
    const внешняя = estimate.shareOf({ ...exercise, kind: exercise.kind || 'weight' }) === 0
        && (exercise.kind || 'weight') === 'reps';

    const values = await dialog.form({
        title: t('Изменить упражнение'),
        text: t('Переименование не разрывает историю: она привязана к записи, а не к названию.'),
        fields: [
            { name: 'name', label: t('Название'), value: exercise.name, required: true },
            { name: 'kind', label: t('Вид'), type: 'select', value: exercise.kind, options: kindOptions() },
            { name: 'group', label: t('Группа мышц'), value: exercise.group || '' },

            ...(внешняя ? [{
                name: 'defaultWeight',
                label: t('Сопротивление, кг (необязательно)'),
                type: 'number',
                value: exercise.defaultWeight ?? ''
            }] : []),

            /*
             * Как выполнять (§50). Показывается там, где вспоминать некогда:
             * на экране интервальной программы под названием упражнения.
             * Своими словами — чужое описание всё равно пришлось бы
             * переписывать под себя.
             */
            {
                name: 'howTo',
                label: t('Как выполнять (необязательно)'),
                type: 'textarea',
                value: exercise.howTo || ''
            }
        ]
    });

    if (!values) return;

    // Чужое имя занимать нельзя: две записи с одним ключом снова расщепят
    // историю, ради чего справочник и заводился
    const clash = await dbService.findExerciseByName(values.name);
    if (clash && clash.id !== exercise.id) {
        await dialog.alert({ title: t('Название занято'), text: t('«{название}» уже есть в справочнике.', { название: clash.name }) });
        return;
    }

    // Смена вида у упражнения с историей: записанные подходы не меняются, и
    // новые поля им взяться неоткуда. Показывать историю приложение всё
    // равно будет по тому, что в подходах записано, но при вводе следующих
    // подходов появятся другие поля — и в истории окажется вперемешку
    if (values.kind !== exercise.kind) {
        const used = await dbService.countSetsOfExercise(exercise.id);

        if (used > 0) {
            const ok = await dialog.confirm({
                title: t('Изменить вид упражнения?'),
                text: t('В истории {подходы}. Они останутся как есть, но следующие подходы будут записываться другими величинами, и в истории окажется два вида сразу.', { подходы: format.count(used, format.WORDS.set) }),
                confirmText: t('Изменить')
            });

            if (!ok) return;
        }
    }

    /*
     * Пустое поле сопротивления значит «не названо», а не «ноль».
     *
     * Ноль записался бы как измеренная нулевая нагрузка, и подход с резинкой
     * стал бы подходом без сопротивления — то есть приложение выдало бы
     * догадку за замер.
     */
    if ('defaultWeight' in values) {
        values.defaultWeight = Number(values.defaultWeight) > 0
            ? Number(values.defaultWeight)
            : undefined;
    }

    await dbService.updateExercise(exercise.id, values);

    /*
     * План связан со справочником строкой, и переименование её рвало (§56.6).
     *
     * Молча: план продолжал звать прежнее имя, приложение предлагало завести
     * его заново, и выходили две записи об одном движении с разделённой
     * историей. Теперь имя правится и в плане — и об этом говорится, потому
     * что приложение поправило текст, который писал не оно.
     */
    if (!ядроПлана.same(exercise.name, values.name) && await renameInPlan(exercise.name, values.name)) {
        await dialog.alert({
            title: t('Название изменено и в плане'),
            text: t('План звал «{было}» — теперь зовёт «{стало}». Иначе он перестал бы узнавать это упражнение.', {
                было: exercise.name, стало: values.name
            })
        });
    }

    app.render();
}


/**
 * Что сделать с упражнением — списком со словами (§5, Р-111).
 *
 * Раньше это были четыре значка в строке. Слова вместо значков стоят одного
 * лишнего нажатия, но снимают три беды разом: непонятные ⇥ и ⌫, обрезанное
 * имя и разное значение у крайней правой кнопки в соседних строках.
 *
 * Удаление показывается всегда: у упражнения с историей оно не пропадает, а
 * объясняет, почему его нет, — «сначала объединить или заархивировать».
 * Исчезающая кнопка ничего не объясняет.
 */
actions.on('ex-menu', async (el) => {
    const exercise = await dbService.getExercise(el.dataset.id);
    if (!exercise) return;

    const подходы = await dbService.countSetsOfExercise(exercise.id);

    const выбор = await dialog.choose({
        title: exercise.name,
        options: [
            { value: 'info', label: t('Как выполнять'), hint: t('Описание техники и поиск видео') },
            { value: 'edit', label: t('Изменить'), hint: t('Название, вид, группа мышц') },
            {
                value: 'merge',
                label: t('Объединить с другим'),
                hint: t('Если это то же упражнение под другим именем — история сложится')
            },
            exercise.archived
                ? { value: 'restore', label: t('Вернуть из архива') }
                : {
                    value: 'archive',
                    label: t('Убрать в архив'),
                    hint: t('Пропадёт из списков, история останется')
                },
            подходы > 0
                ? { value: '', label: t('Удалить нельзя'), hint: t('На нём висит история: {n}. Объедините с другим или уберите в архив.', { n: format.count(подходы, format.WORDS.set) }) }
                : { value: 'delete', label: t('Удалить навсегда'), danger: true }
        ]
    });

    if (!выбор) return;

    if (выбор === 'info') return показать(exercise);
    if (выбор === 'edit') return editExercise(exercise);
    if (выбор === 'merge') return объединить(exercise);

    if (выбор === 'restore') {
        await dbService.setExerciseArchived(exercise.id, false);
        return app.render();
    }

    if (выбор === 'archive') return заархивировать(exercise);
    if (выбор === 'delete') return удалить(exercise);
});

actions.on('ex-edit', async (el) => {
    const exercise = await dbService.getExercise(el.dataset.id);
    if (exercise) await editExercise(exercise);
});

/**
 * Объединение дублей (§5.1).
 *
 * Опечатка в названии заводит второе упражнение и разрезает историю надвое.
 * Переименовать не выйдет — занять чужое имя нельзя, — поэтому нужно
 * отдельное действие: перенести всё в правильную запись и убрать лишнюю.
 */
async function объединить(source) {
    if (!source) return;

    const others = (await dbService.listExercises({ includeArchived: true }))
        .filter((e) => e.id !== source.id);

    if (others.length === 0) {
        return dialog.alert({ title: t('Объединять не с чем'), text: t('В справочнике только одно упражнение.') });
    }

    const usage = await dbService.countSetsOfExercise(source.id);

    const chosen = await dialog.pick({
        title: t('Объединить «{название}» с…', { название: source.name }),
        text: t('Выбранное упражнение останется, текущее исчезнет вместе со своим названием.'),
        items: others.map((e) => ({
            value: e.id,
            label: e.name,
            hint: [kindLabel(e.kind), e.group, e.archived ? t('в архиве') : null].filter(Boolean).join(' · ')
        })),
        placeholder: t('Название упражнения')
    });

    if (!chosen || chosen.create) return;

    const target = others.find((e) => e.id === chosen);
    if (!target) return;

    const ok = await dialog.confirm({
        title: `«${source.name}» → «${target.name}»?`,
        // Числительное ставится после слова, чтобы не согласовывать глагол:
        // «1 подход перейдут» и «5 подходов перейдёт» одинаково неверны
        text: usage > 0
            ? t('К «{цель}» перейдёт подходов: {сколько}. «{источник}» исчезнет из справочника, и отменить это будет нечем.', { цель: target.name, сколько: usage, источник: source.name })
            : t('«{название}» исчезнет из справочника. Подходов у него нет, так что переносить нечего.', { название: source.name }),
        confirmText: t('Объединить')
    });

    if (!ok) return;

    const result = await dbService.mergeExercises(source.id, target.id);

    await dialog.alert({
        title: t('Объединено'),
        text: [
            `«${result.from}» → «${result.to}».`,
            result.sets ? t('Перенесено подходов: {сколько}.', { сколько: result.sets }) : '',
            result.workouts ? t('Затронуто тренировок: {сколько}.', { сколько: result.workouts }) : '',
            result.templates ? t('Шаблонов: {сколько}.', { сколько: result.templates }) : ''
        ].filter(Boolean).join(' ')
    });

    app.render();
}

/**
 * Упражнение, которое зовёт план, убирать молча нельзя (§56.6).
 *
 * Связь плана со справочником — строка, и убранное упражнение план продолжит
 * звать. Приложение предложит завести его заново, и вместо одной записи с
 * историей появится вторая без неё. Спрашиваем один раз и говорим, чем это
 * кончится.
 */
async function убратьМожно(exercise, { archive = true } = {}) {
    if (!await planCalls(exercise.name)) return true;

    return dialog.confirm({
        title: t('План зовёт это упражнение'),
        text: t('«{название}» стоит в действующем плане. Уберёте — план продолжит его звать, и приложение предложит завести его заново, уже без истории.', {
            название: exercise.name
        }),
        confirmText: archive ? t('В архив') : t('Удалить'),
        danger: !archive
    });
}

async function заархивировать(exercise) {
    if (!exercise) return;

    if (!await убратьМожно(exercise)) return;

    await dbService.setExerciseArchived(exercise.id, true);
    await app.render();

    /*
     * Говорим, куда делось (Р-114).
     *
     * Раньше строка просто пропадала из списка и появлялась в «Архиве» в самом
     * низу, под семью десятками строк. Человек видел, что упражнение исчезло, и
     * был уверен, что удалил его вместе с историей; чтобы убедиться в обратном,
     * надо было доскроллить до конца.
     */
    await dialog.alert({
        title: t('В архиве'),
        text: t('«{название}» ушло в архив — он внизу списка, оттуда упражнение возвращается. История цела.',
            { название: exercise.name })
    });
}


actions.on('ex-restore', async (el) => {
    await dbService.setExerciseArchived(el.dataset.id, false);
    app.render();
});

async function удалить(exercise) {
    if (!exercise) return;

    if (!await убратьМожно(exercise, { archive: false })) return;

    const ok = await dialog.confirm({
        title: t('Удалить «{название}»?', { название: exercise.name }),
        text: t('Упражнение ни разу не выполнялось, поэтому удаление ничего не разорвёт.'),
        confirmText: t('Удалить'),
        danger: true
    });

    if (!ok) return;

    try {
        await dbService.deleteExercise(exercise.id);
    } catch (e) {
        await dialog.alert({ title: t('Не удалось удалить'), text: e.message });
    }

    app.render();
}

/**
 * Перевод базовых упражнений на текущий язык (§53).
 *
 * По явной просьбе и с предупреждением: действие меняет названия в
 * справочнике, а через них — то, как выглядит вся история. История при этом
 * цела: упражнение остаётся тем же, у него меняется только имя.
 */
actions.on('ex-relocalize', async () => {
    const ok = await dialog.confirm({
        title: t('Перевести базовые упражнения?'),
        text: t('Названия и группы из базового списка станут на текущем языке. Упражнения, которые вы завели или переименовали сами, останутся как есть. История не пострадает: меняется имя, а не запись.'),
        confirmText: t('Перевести')
    });

    if (!ok) return;

    const renamed = await dbService.relocalizeBaseExercises();

    await dialog.alert({
        title: t('Готово'),
        text: renamed.length
            ? t('Переведено: {n}.', { n: format.count(renamed.length, format.WORDS.exercise) })
            : t('Переводить оказалось нечего.')
    });

    app.render();
});

/*
 * Поиск отбирает по вводу, а не по потере фокуса (§5.3).
 *
 * change приходит слишком поздно: человек ищет, глядя в список, а список до
 * ухода из поля не меняется.
 *
 * Отбор идёт на месте и сразу, без задержки и без перерисовки (Р-93). Прежде
 * здесь была четверть секунды и app.render(): перерисовка подменяла поле
 * новым узлом, фокус возвращался — а телефон успевал закрыть и открыть
 * клавиатуру, и так после каждой буквы.
 */
document.addEventListener('input', (e) => {
    if (e.target.id !== 'ex-search') return;

    поиск = e.target.value;
    отобрать();
});

