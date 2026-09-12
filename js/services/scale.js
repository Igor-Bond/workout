/**
 * Весы по Bluetooth (§65 ТЗ).
 *
 * Вес — единственное число, которое человек до сих пор вводил руками каждую
 * неделю, хотя рядом стоит устройство, которое его и так знает. А состав тела
 * — жир, воду, мышцы — приложение не получит ниоткуда больше: по нему и видно,
 * уходит ли живот, когда вес стоит на месте.
 *
 * Разговор идёт стандартным профилем Bluetooth SIG, а не языком производителя:
 * Weight Scale (0x181D), Body Composition (0x181B) и User Data (0x181C). Это
 * выяснилось разведкой (tools/scale-probe.html) и оказалось удачей — чужой
 * протокол пришлось бы разбирать по чужим же догадкам.
 *
 * Три вещи, которые стоили дня разведки и потому записаны здесь:
 *
 * Весы не отвечают по нешифрованной связи ничего — даже уровень заряда.
 * Шифрование начинается с обычного чтения; подписка его не начинает, потому
 * что пишет в дескриптор, и на такую запись Android спаривание затевает не
 * всегда. Поэтому первым делом читаются признаки весов — не за данными, а
 * ради шифрования.
 *
 * Весы держат восемь мест под разных людей и без опознания молчат. Место
 * заводится либо на самих весах кнопкой SET, либо по Bluetooth — но второе
 * на экране весов не показывается, и ткнуть в него человек не может.
 * Поэтому приложение спрашивает номер места и код, а не заводит своё.
 *
 * Подписки ставятся до опознания: накопленное весы отдают сразу, как только
 * узнают человека, и то, что приехало до подписки, пропадает молча.
 *
 * Работает в Chrome на Android и настольных системах. В Firefox и на iPhone
 * Web Bluetooth нет вовсе, и это не чинится со стороны приложения — кнопка
 * там просто не показывается.
 */

/** Службы профиля. */
const ВЕСЫ = 0x181d;
const СОСТАВ = 0x181b;
const ЧЕЛОВЕК = 0x181c;

/** Характеристики. */
const ПРИЗНАКИ = 0x2a9e;          // Weight Scale Feature
const ИЗМЕРЕНИЕ = 0x2a9d;         // Weight Measurement
const ИЗМЕРЕНИЕ_СОСТАВА = 0x2a9c; // Body Composition Measurement
const ПУЛЬТ = 0x2a9f;             // User Control Point

/** Сколько ждать, пока человек встанет на весы и они посчитают. */
const СРОК = 90000;

/** Ключ настройки: номер места в памяти весов и код согласия. */
export const SCALE_USER = 'scaleUser';

/**
 * Метка времени профиля: год, месяц, день, часы, минуты, секунды.
 *
 * Часы весов сбиваются при смене батареек, и год из будущего или прошлого
 * тут не редкость. Явно негодную метку отдаём как null: замер от этого не
 * пропадает, он просто становится сегодняшним.
 */
function времяЗаписи(dv, at) {
    const год = dv.getUint16(at, true);
    if (год < 2000 || год > 2100) return null;

    const d = new Date(год, dv.getUint8(at + 2) - 1, dv.getUint8(at + 3),
        dv.getUint8(at + 4), dv.getUint8(at + 5), dv.getUint8(at + 6));

    const ts = d.getTime();

    return Number.isFinite(ts) ? ts : null;
}

export const scale = {

    SCALE_USER,

    /** Умеет ли этот браузер разговаривать с устройствами. */
    available: () => typeof navigator !== 'undefined' && !!navigator.bluetooth,

    /**
     * Вес из Weight Measurement (0x2A9D).
     *
     * Единица зависит от первого бита признаков: в килограммах шаг пять
     * граммов, в фунтах — сотая доля фунта. Остальные поля необязательны и
     * идут строго в объявленном порядке, поэтому читать их можно только
     * подряд: пропустив одно, собьёшь все следующие.
     *
     * Фунты переводятся в килограммы здесь же. Приложение считает тоннаж и
     * долю собственного веса в килограммах (§6), и две единицы в одной базе
     * означали бы, что каждый расчёт обязан помнить, откуда пришло число.
     */
    parseWeight(dv) {
        const флаги = dv.getUint8(0);
        const фунты = !!(флаги & 1);

        let at = 1;
        const сырой = dv.getUint16(at, true); at += 2;

        const итог = {
            weight: фунты ? сырой * 0.01 * 0.45359237 : сырой * 0.005,
            at: null,
            user: null,
            bmi: null,
            height: null
        };

        if (флаги & 2) { итог.at = времяЗаписи(dv, at); at += 7; }
        if (флаги & 4) { итог.user = dv.getUint8(at); at += 1; }

        if (флаги & 8) {
            итог.bmi = dv.getUint16(at, true) * 0.1; at += 2;
            итог.height = фунты
                ? dv.getUint16(at, true) * 0.1 * 2.54   // дюймы в сантиметры
                : dv.getUint16(at, true) * 0.1;         // шаг 0,001 м — это миллиметры
            at += 2;
        }

        return итог;
    },

    /**
     * Состав тела из Body Composition Measurement (0x2A9C).
     *
     * Признаки двухбайтовые, полей до тринадцати, и порядок в записи тот же,
     * что порядок битов. Ни одно поле не обязательно: настоящая запись от
     * SBF77 несёт жир, обмен, мышцы в процентах, сухую массу, воду и
     * сопротивление — и ни веса, ни роста, ни метки времени.
     */
    parseBody(dv) {
        const флаги = dv.getUint16(0, true);
        const фунты = !!(флаги & 1);
        const масса = (v) => (фунты ? v * 0.01 * 0.45359237 : v * 0.005);

        let at = 2;

        const итог = {
            fat: dv.getUint16(at, true) * 0.1,
            at: null, user: null, basal: null, musclePercent: null, muscleMass: null,
            fatFree: null, lean: null, water: null, impedance: null, weight: null, height: null
        };

        at += 2;

        const поля = [
            [2, () => { итог.at = времяЗаписи(dv, at); at += 7; }],
            [4, () => { итог.user = dv.getUint8(at); at += 1; }],
            [8, () => { итог.basal = dv.getUint16(at, true); at += 2; }],
            [16, () => { итог.musclePercent = dv.getUint16(at, true) * 0.1; at += 2; }],
            [32, () => { итог.muscleMass = масса(dv.getUint16(at, true)); at += 2; }],
            [64, () => { итог.fatFree = масса(dv.getUint16(at, true)); at += 2; }],
            [128, () => { итог.lean = масса(dv.getUint16(at, true)); at += 2; }],
            [256, () => { итог.water = масса(dv.getUint16(at, true)); at += 2; }],
            [512, () => { итог.impedance = dv.getUint16(at, true) * 0.1; at += 2; }],
            [1024, () => { итог.weight = масса(dv.getUint16(at, true)); at += 2; }],
            [2048, () => {
                итог.height = фунты
                    ? dv.getUint16(at, true) * 0.1 * 2.54
                    : dv.getUint16(at, true) * 0.1;
                at += 2;
            }]
        ];

        for (const [бит, взять] of поля) {
            if (флаги & бит) взять();
        }

        return итог;
    },

    /**
     * Что из состава тела стоит хранить рядом с замером.
     *
     * Не всё подряд: сопротивление тела — служебное число прибора, из
     * которого он и считает остальное, а сухая масса и масса без жира это
     * почти одно и то же. Хранится то, на что человек смотрит: жир, вода,
     * мышцы.
     *
     * Пустые поля выбрасываются, а не пишутся пустыми: запись едет в облако
     * (§39), а там пустое поле внутри записи однажды уже роняло обмен (Р-97).
     */
    keep(состав) {
        const из = {
            fat: состав?.fat,
            water: состав?.water,
            muscle: состав?.musclePercent,
            basal: состав?.basal
        };

        const итог = {};

        for (const [имя, v] of Object.entries(из)) {
            if (Number.isFinite(v) && v > 0) итог[имя] = Math.round(v * 10) / 10;
        }

        return итог;
    },

    /**
     * Снять замер с весов.
     *
     * Возвращает { weight, body } или бросает с внятной причиной. Место и код
     * обязательны: без них весы молчат, а заводить своё место нельзя — на
     * экране весов оно не показывается, и выбрать его человек не сможет.
     *
     * onStatus зовётся на каждом шаге: разговор идёт секундами, и молчащее
     * приложение неотличимо от сломанного.
     */
    async read({ index, code, onStatus = () => {} } = {}) {
        if (!scale.available()) throw new Error('Этот браузер не умеет разговаривать с устройствами.');
        if (!(index >= 1 && index <= 8)) throw new Error('Не назван номер места в памяти весов.');

        const device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: [ВЕСЫ, СОСТАВ, ЧЕЛОВЕК]
        });

        onStatus('Подключаюсь…');
        const gatt = await device.gatt.connect();

        try {
            const служба = await gatt.getPrimaryService(ВЕСЫ);

            // Не за данными, а ради шифрования: без него весы не отвечают
            // вовсе, а подписка спаривание не затевает
            onStatus('Договариваюсь…');
            await (await служба.getCharacteristic(ПРИЗНАКИ)).readValue();

            let вес = null;
            let состав = null;
            let готово;
            const дождались = new Promise((resolve) => { готово = resolve; });

            const измерение = await служба.getCharacteristic(ИЗМЕРЕНИЕ);

            измерение.addEventListener('characteristicvaluechanged', (e) => {
                вес = scale.parseWeight(e.target.value);
                if (состав) готово();
            });

            await измерение.startNotifications();

            /*
             * Состав тела необязателен: весы могут его не посчитать, если
             * человек в носках или встал не всей стопой. Вес при этом
             * приезжает, и терять его из-за этого незачем.
             */
            try {
                const сс = await gatt.getPrimaryService(СОСТАВ);
                const сИзм = await сс.getCharacteristic(ИЗМЕРЕНИЕ_СОСТАВА);

                сИзм.addEventListener('characteristicvaluechanged', (e) => {
                    состав = scale.parseBody(e.target.value);
                    if (вес) готово();
                });

                await сИзм.startNotifications();
            } catch (e) {
                состав = null;
            }

            const люди = await gatt.getPrimaryService(ЧЕЛОВЕК);
            const пульт = await люди.getCharacteristic(ПУЛЬТ);

            const ответ = new Promise((resolve) => {
                пульт.addEventListener('characteristicvaluechanged', (e) => resolve(e.target.value), { once: true });
                setTimeout(() => resolve(null), 8000);
            });

            await пульт.startNotifications();

            onStatus('Представляюсь весам…');

            const пакет = new Uint8Array(4);
            пакет[0] = 0x02;
            пакет[1] = index;
            new DataView(пакет.buffer).setUint16(2, Number(code) || 0, true);

            await пульт.writeValue(пакет);

            const r = await ответ;

            if (!r || r.getUint8(2) !== 0x01) {
                throw new Error('Весы не признали: номер места или код не тот.');
            }

            onStatus('Встаньте на весы и выберите там своё место.');

            const срок = new Promise((resolve) => setTimeout(resolve, СРОК));
            await Promise.race([дождались, срок]);

            if (!вес) throw new Error('Весы ничего не прислали. Место на них выбрано?');

            return { weight: вес, body: состав };
        } finally {
            try {
                if (gatt.connected) gatt.disconnect();
            } catch (e) { /* уже отключились */ }
        }
    }
};
