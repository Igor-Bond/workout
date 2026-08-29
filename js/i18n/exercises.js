/**
 * Базовый справочник на других языках (§5, §53).
 *
 * Названия упражнений — данные, а не интерфейс: на них ссылается история, их
 * правит и придумывает человек. Поэтому они не переводятся на лету, а
 * ставятся один раз, при первом запуске, на языке этого запуска. Тот, кто
 * завёл «Bench press», так его и видит; переименовать его задним числом
 * из-за смены языка приложение не вправе.
 *
 * Ключ здесь — русское название из базового списка. Оно же остаётся
 * каноническим именем упражнения внутри кода; наружу выходит перевод.
 *
 * Описания техники (§5.2) лежат рядом с названиями, а не отдельным файлом:
 * это свойство того же упражнения, и разъехавшись по файлам, они разъедутся
 * и по составу — одно добавят, другое забудут.
 */

const EN = {
    groups: {
        'Грудь': 'Chest',
        'Спина': 'Back',
        'Ноги': 'Legs',
        'Плечи': 'Shoulders',
        'Руки': 'Arms',
        'Пресс': 'Abs',
        'Кардио': 'Cardio',
        'Всё тело': 'Full body'
    },

    names: {
        'Жим лёжа': 'Bench press',
        'Жим гантелей лёжа': 'Dumbbell bench press',
        'Разведение гантелей': 'Dumbbell fly',
        'Отжимания': 'Push-ups',
        'Брусья': 'Dips',
        'Подтягивания': 'Pull-ups',
        'Тяга верхнего блока': 'Lat pulldown',
        'Тяга штанги в наклоне': 'Bent-over row',
        'Тяга горизонтального блока': 'Seated cable row',
        'Становая тяга': 'Deadlift',
        'Приседания со штангой': 'Barbell squat',
        'Приседания': 'Squats',
        'Жим ногами': 'Leg press',
        'Выпады': 'Lunges',
        'Разгибание ног': 'Leg extension',
        'Сгибание ног': 'Leg curl',
        'Подъём на носки': 'Calf raise',
        'Жим стоя': 'Overhead press',
        'Махи гантелями в стороны': 'Lateral raise',
        'Подъём штанги на бицепс': 'Barbell curl',
        'Подъём гантелей на бицепс': 'Dumbbell curl',
        'Французский жим': 'Skull crusher',
        'Пресс': 'Sit-ups',
        'Скручивания': 'Crunches',
        'Подъём ног в висе': 'Hanging leg raise',
        'Планка': 'Plank',
        'Бег': 'Running',
        'Ходьба': 'Walking',
        'Велотренажёр': 'Stationary bike',
        'Скакалка': 'Jump rope',
        'Берпи': 'Burpees',
        'Прыжки «звёздочка»': 'Jumping jacks',
        'Альпинист': 'Mountain climbers',
        'Бег на месте': 'Running in place',
        'Высокое поднимание колен': 'High knees',
        'Выпрыгивания из приседа': 'Squat jumps',
        'Прыжки в выпадах': 'Jumping lunges',
        'Ягодичный мостик': 'Glute bridge',
        'Планка с касанием плеч': 'Plank shoulder taps',
        'Боковая планка': 'Side plank',
        'Русский твист': 'Russian twist',
        'Велосипед': 'Bicycle crunches',
        'Складка': 'V-ups',
        'Медвежья походка': 'Bear crawl',
        'Приседания «сумо»': 'Sumo squats'
    },

    howTo: {
        'Жим лёжа': 'Shoulder blades pulled together, feet flat on the floor. Lower the bar to the base of the chest, elbows angled to the body rather than flared out.',
        'Жим гантелей лёжа': 'Lower the dumbbells to chest level without clashing them at the top. Keep a slight bend in the elbows at the top.',
        'Разведение гантелей': 'Elbows slightly bent and holding that angle. Only the shoulder joint works, so the weight stays light.',
        'Отжимания': 'Body straight from heels to head, elbows close to the body. Chest almost touches the floor, hips do not sag.',
        'Брусья': 'Lower until the elbow is about 90°. Leaning forward works the chest, staying upright works the triceps.',
        'Подтягивания': 'Grip slightly wider than the shoulders, pull until the chin clears the bar. No swinging, and lower under control.',
        'Тяга верхнего блока': 'Pull to the upper chest, elbows down. Torso nearly vertical — no need to lean back.',
        'Тяга штанги в наклоне': 'Back straight, torso at about 45°. Pull to the stomach with the elbows along the body.',
        'Тяга горизонтального блока': 'Back straight, pull to the stomach. Squeeze the shoulder blades at the end, do not help with the torso.',
        'Становая тяга': 'Back straight, the bar travels right against the legs. The lift comes from pushing with the legs, not from yanking with the back.',
        'Приседания со штангой': 'Feet shoulder-width, knees tracking the toes. Go down to thighs parallel with the floor, back straight.',
        'Приседания': 'Feet shoulder-width, weight on the heels, knees do not cave in. Go down to thighs parallel with the floor.',
        'Жим ногами': 'Feet shoulder-width. Do not lock the knees out and do not let the hips leave the backrest.',
        'Выпады': 'Step forward, both knees at right angles. The front knee stays behind the toes.',
        'Разгибание ног': 'Extend smoothly and hold at the top. Do not drop the weight back.',
        'Сгибание ног': 'Hips pressed down, movement only at the knee. Lower under control.',
        'Подъём на носки': 'Full range: stretch at the bottom, all the way up at the top. No bouncing.',
        'Жим стоя': 'Press overhead without leaning back. The core is tight, the ribs stay down.',
        'Махи гантелями в стороны': 'Raise to shoulder height, elbows slightly bent. Light weight — swinging turns it into something else.',
        'Подъём штанги на бицепс': 'Elbows stay at the body and do not travel forward. Lower slowly rather than dropping.',
        'Подъём гантелей на бицепс': 'Elbows at the body, turn the palm up at the top. Lower under control.',
        'Французский жим': 'Only the forearm moves; the elbows stay in place and point up. Lower to the forehead, not to the nose.',
        'Пресс': 'Lower back stays on the floor, hands do not pull the head. Lift with the abs, not with the neck.',
        'Скручивания': 'Lift the shoulder blades off the floor, the lower back stays down. Short range, no jerking.',
        'Подъём ног в висе': 'Raise the legs without swinging. Even to a right angle is enough if the body stays still.',
        'Планка': 'A straight line from heels to head. Hips neither sag nor stick up, the abs are tight.',
        'Бег': 'Land under the body, not out in front. Cadence matters more than stride length.',
        'Ходьба': 'A brisk pace you can hold. Posture upright, arms working freely.',
        'Велотренажёр': 'The knee stays slightly bent at the bottom. Set the saddle so the hips do not rock.',
        'Скакалка': 'Small jumps on the balls of the feet, the rope is turned by the wrists. Elbows stay at the body.',
        'Берпи': 'Squat, plank, push-up, jump. Under fatigue watch the back in the plank — that is where it sags.',
        'Прыжки «звёздочка»': 'Jump the legs apart with the arms overhead, then back. Land softly on bent knees.',
        'Альпинист': 'Plank position, knees driving to the chest in turn. The hips stay level and do not bounce up.',
        'Бег на месте': 'Knees to hip height, land on the balls of the feet. Body upright.',
        'Высокое поднимание колен': 'Knees above the hips, arms working. The pace is high, the body does not lean back.',
        'Выпрыгивания из приседа': 'Squat down, jump up, land back into the squat. Land softly, absorbing with the legs.',
        'Прыжки в выпадах': 'From a lunge jump up and swap legs in the air. The front knee stays behind the toes.',
        'Ягодичный мостик': 'Push the hips up until the body is a straight line from knees to shoulders. Squeeze the glutes at the top.',
        'Планка с касанием плеч': 'From a plank touch the opposite shoulder in turn. Hips do not rotate — that is the whole point.',
        'Боковая планка': 'Body in one line, hips lifted. Elbow under the shoulder, hips do not drop.',
        'Русский твист': 'Sit leaning back, rotate the torso side to side. Turn from the ribs, not from the arms.',
        'Велосипед': 'Elbow to the opposite knee, the other leg extended. Slowly — speed here replaces the abs with momentum.',
        'Складка': 'Lift the arms and legs at the same time, meeting above the stomach. Lower without touching the floor.',
        'Медвежья походка': 'On hands and toes, knees just off the floor. Move opposite hand and foot together.',
        'Приседания «сумо»': 'Feet wider than the shoulders, toes turned out. Knees track the toes, back straight.'
    }
};

const DE = {
    groups: {
        'Грудь': 'Brust',
        'Спина': 'Rücken',
        'Ноги': 'Beine',
        'Плечи': 'Schultern',
        'Руки': 'Arme',
        'Пресс': 'Bauch',
        'Кардио': 'Cardio',
        'Всё тело': 'Ganzkörper'
    },

    names: {
        'Жим лёжа': 'Bankdrücken',
        'Жим гантелей лёжа': 'Kurzhantel-Bankdrücken',
        'Разведение гантелей': 'Fliegende',
        'Отжимания': 'Liegestütze',
        'Брусья': 'Dips',
        'Подтягивания': 'Klimmzüge',
        'Тяга верхнего блока': 'Latzug',
        'Тяга штанги в наклоне': 'Vorgebeugtes Rudern',
        'Тяга горизонтального блока': 'Rudern am Kabelzug',
        'Становая тяга': 'Kreuzheben',
        'Приседания со штангой': 'Kniebeugen mit Langhantel',
        'Приседания': 'Kniebeugen',
        'Жим ногами': 'Beinpresse',
        'Выпады': 'Ausfallschritte',
        'Разгибание ног': 'Beinstrecker',
        'Сгибание ног': 'Beinbeuger',
        'Подъём на носки': 'Wadenheben',
        'Жим стоя': 'Schulterdrücken',
        'Махи гантелями в стороны': 'Seitheben',
        'Подъём штанги на бицепс': 'Langhantel-Curls',
        'Подъём гантелей на бицепс': 'Kurzhantel-Curls',
        'Французский жим': 'Stirndrücken',
        'Пресс': 'Sit-ups',
        'Скручивания': 'Crunches',
        'Подъём ног в висе': 'Hängendes Beinheben',
        'Планка': 'Planke',
        'Бег': 'Laufen',
        'Ходьба': 'Gehen',
        'Велотренажёр': 'Heimtrainer',
        'Скакалка': 'Seilspringen',
        'Берпи': 'Burpees',
        'Прыжки «звёздочка»': 'Hampelmänner',
        'Альпинист': 'Bergsteiger',
        'Бег на месте': 'Laufen auf der Stelle',
        'Высокое поднимание колен': 'Kniehebelauf',
        'Выпрыгивания из приседа': 'Strecksprünge',
        'Прыжки в выпадах': 'Sprung-Ausfallschritte',
        'Ягодичный мостик': 'Beckenheben',
        'Планка с касанием плеч': 'Planke mit Schultertippen',
        'Боковая планка': 'Seitliche Planke',
        'Русский твист': 'Russian Twist',
        'Велосипед': 'Fahrrad-Crunches',
        'Складка': 'Klappmesser',
        'Медвежья походка': 'Bärengang',
        'Приседания «сумо»': 'Sumo-Kniebeugen'
    },

    howTo: {
        'Жим лёжа': 'Schulterblätter zusammen, Füße fest am Boden. Die Stange zum unteren Brustbereich senken, Ellbogen schräg am Körper statt weit abgespreizt.',
        'Жим гантелей лёжа': 'Die Hanteln bis auf Brusthöhe senken, oben nicht zusammenschlagen. Ellbogen oben leicht gebeugt lassen.',
        'Разведение гантелей': 'Ellbogen leicht gebeugt und im gleichen Winkel halten. Nur das Schultergelenk arbeitet, das Gewicht bleibt klein.',
        'Отжимания': 'Körper gerade von den Fersen bis zum Kopf, Ellbogen am Körper. Brust fast bis zum Boden, das Becken hängt nicht durch.',
        'Брусья': 'Bis etwa 90° im Ellbogen absenken. Vorlehnen belastet die Brust, aufrecht bleiben den Trizeps.',
        'Подтягивания': 'Griff etwas breiter als die Schultern, hoch bis das Kinn über der Stange ist. Nicht schwingen und kontrolliert ablassen.',
        'Тяга верхнего блока': 'Zur oberen Brust ziehen, Ellbogen nach unten. Oberkörper fast senkrecht — Zurücklehnen ist nicht nötig.',
        'Тяга штанги в наклоне': 'Rücken gerade, Oberkörper etwa 45°. Zum Bauch ziehen, Ellbogen am Körper entlang.',
        'Тяга горизонтального блока': 'Rücken gerade, zum Bauch ziehen. Am Ende die Schulterblätter zusammenziehen, nicht mit dem Oberkörper nachhelfen.',
        'Становая тяга': 'Rücken gerade, die Stange läuft dicht an den Beinen. Der Zug kommt aus den Beinen, nicht aus einem Ruck im Rücken.',
        'Приседания со штангой': 'Füße schulterbreit, Knie in Richtung der Zehen. Bis die Oberschenkel parallel zum Boden sind, Rücken gerade.',
        'Приседания': 'Füße schulterbreit, Gewicht auf den Fersen, Knie fallen nicht nach innen. Bis die Oberschenkel parallel sind.',
        'Жим ногами': 'Füße schulterbreit. Knie nicht durchstrecken und das Becken nicht von der Lehne lösen.',
        'Выпады': 'Schritt nach vorn, beide Knie im rechten Winkel. Das vordere Knie bleibt hinter den Zehen.',
        'Разгибание ног': 'Gleichmäßig strecken, oben kurz halten. Das Gewicht nicht zurückfallen lassen.',
        'Сгибание ног': 'Becken bleibt aufgelegt, Bewegung nur im Knie. Kontrolliert ablassen.',
        'Подъём на носки': 'Volle Bewegung: unten dehnen, oben ganz durchdrücken. Ohne Schwung.',
        'Жим стоя': 'Über den Kopf drücken, ohne sich zurückzulehnen. Rumpf fest, Rippen bleiben unten.',
        'Махи гантелями в стороны': 'Bis auf Schulterhöhe heben, Ellbogen leicht gebeugt. Leichtes Gewicht — mit Schwung wird es eine andere Übung.',
        'Подъём штанги на бицепс': 'Ellbogen bleiben am Körper und wandern nicht nach vorn. Langsam ablassen statt fallen lassen.',
        'Подъём гантелей на бицепс': 'Ellbogen am Körper, oben die Handfläche nach oben drehen. Kontrolliert ablassen.',
        'Французский жим': 'Nur der Unterarm bewegt sich, die Ellbogen bleiben an ihrem Platz und zeigen nach oben. Zur Stirn senken, nicht zur Nase.',
        'Пресс': 'Der untere Rücken bleibt am Boden, die Hände ziehen nicht am Kopf. Aus dem Bauch heben, nicht aus dem Nacken.',
        'Скручивания': 'Schulterblätter vom Boden lösen, der untere Rücken bleibt liegen. Kurze Bewegung, kein Reißen.',
        'Подъём ног в висе': 'Die Beine ohne Schwung heben. Auch bis zum rechten Winkel reicht, solange der Körper ruhig bleibt.',
        'Планка': 'Eine gerade Linie von den Fersen bis zum Kopf. Das Becken hängt weder durch noch steht es hoch, der Bauch ist fest.',
        'Бег': 'Unter dem Körper aufsetzen, nicht davor. Die Schrittfrequenz zählt mehr als die Schrittlänge.',
        'Ходьба': 'Ein zügiges Tempo, das du halten kannst. Aufrechte Haltung, die Arme schwingen frei.',
        'Велотренажёр': 'Das Knie bleibt unten leicht gebeugt. Den Sattel so einstellen, dass das Becken nicht wackelt.',
        'Скакалка': 'Kleine Sprünge auf den Fußballen, das Seil kommt aus den Handgelenken. Ellbogen bleiben am Körper.',
        'Берпи': 'Hocke, Planke, Liegestütz, Sprung. Bei Ermüdung auf den Rücken in der Planke achten — dort hängt er durch.',
        'Прыжки «звёздочка»': 'Die Beine auseinanderspringen, die Arme über den Kopf, und zurück. Weich auf gebeugten Knien landen.',
        'Альпинист': 'Position der Planke, die Knie abwechselnd zur Brust ziehen. Das Becken bleibt ruhig und federt nicht hoch.',
        'Бег на месте': 'Knie auf Hüfthöhe, auf den Fußballen landen. Der Körper bleibt aufrecht.',
        'Высокое поднимание колен': 'Knie über die Hüfte, die Arme arbeiten mit. Hohes Tempo, der Körper lehnt sich nicht zurück.',
        'Выпрыгивания из приседа': 'In die Hocke, hochspringen, zurück in die Hocke landen. Weich landen und mit den Beinen abfedern.',
        'Прыжки в выпадах': 'Aus dem Ausfallschritt hochspringen und in der Luft die Beine wechseln. Das vordere Knie bleibt hinter den Zehen.',
        'Ягодичный мостик': 'Das Becken hochdrücken, bis der Körper von den Knien bis zu den Schultern eine Linie bildet. Oben das Gesäß anspannen.',
        'Планка с касанием плеч': 'Aus der Planke abwechselnd die gegenüberliegende Schulter antippen. Das Becken dreht sich nicht — genau darum geht es.',
        'Боковая планка': 'Körper in einer Linie, Becken angehoben. Ellbogen unter der Schulter, das Becken sinkt nicht ab.',
        'Русский твист': 'Sitzend zurücklehnen und den Oberkörper hin und her drehen. Aus den Rippen drehen, nicht aus den Armen.',
        'Велосипед': 'Ellbogen zum gegenüberliegenden Knie, das andere Bein gestreckt. Langsam — Tempo ersetzt hier den Bauch durch Schwung.',
        'Складка': 'Arme und Beine gleichzeitig heben und über dem Bauch treffen lassen. Ablassen, ohne den Boden zu berühren.',
        'Медвежья походка': 'Auf Händen und Zehen, die Knie knapp über dem Boden. Gegenüberliegende Hand und Fuß bewegen sich zusammen.',
        'Приседания «сумо»': 'Füße breiter als die Schultern, Zehen nach außen. Die Knie folgen den Zehen, der Rücken bleibt gerade.'
    }
};

const ALL = { en: EN, de: DE };

/**
 * Название, группа и описание базового упражнения на нужном языке.
 *
 * Русский возвращается как есть: он и есть исходник, словаря ему не надо.
 * Отсутствующий перевод тоже отдаёт русское — лучше чужое слово в
 * справочнике, чем пустая строка вместо названия.
 */
/**
 * Русское имя базового упражнения по названию на любом языке.
 *
 * Нужно, чтобы узнать своё же упражнение, поставленное на другом языке.
 * Возвращает null, если названия нет ни в одном словаре, — а значит, его
 * придумал или поправил человек, и трогать его нельзя.
 */
export function canonicalName(name) {
    if (!name) return null;
    if (EN.names[name] !== undefined) return name;

    for (const dict of Object.values(ALL)) {
        for (const [ru, translated] of Object.entries(dict.names)) {
            if (translated === name) return ru;
        }
    }

    return null;
}

/** То же для группы мышц. */
export function canonicalGroup(group) {
    if (!group) return '';
    if (EN.groups[group] !== undefined) return group;

    for (const dict of Object.values(ALL)) {
        for (const [ru, translated] of Object.entries(dict.groups)) {
            if (translated === group) return ru;
        }
    }

    return group;
}

/**
 * Все описания техники, которые приложение когда-либо ставило этому
 * упражнению. По ним отличается наш текст от написанного человеком.
 */
export function deliveredHowTo(canonical) {
    return Object.values(ALL)
        .map((dict) => dict.howTo[canonical])
        .filter(Boolean);
}

export function localizeExercise(item, lang, howToRu = '') {
    const dict = ALL[lang];

    if (!dict) return { name: item.name, group: item.group || '', howTo: howToRu };

    return {
        name: dict.names[item.name] || item.name,
        group: item.group ? (dict.groups[item.group] || item.group) : '',
        howTo: dict.howTo[item.name] || howToRu
    };
}
