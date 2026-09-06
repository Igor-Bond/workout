/**
 * Данные с часов через Intervals.icu (§62.1 ТЗ).
 *
 * Часы Zepp пишут сон и пульс покоя в своё облако, и наружу оно их само не
 * отдаёт. Прямого пути от Zepp к приложению нет: Google Fit закрывает свой
 * REST в конце 2026 года, Health Connect живёт только на Android. Остаётся
 * тот путь, который Zepp предлагает сам, — привязка стороннего сервиса, и
 * единственный в этом списке, у кого есть открытый ключ на чтение, это
 * Intervals.icu.
 *
 * Значит, цепочка такая: часы → Zepp → Intervals.icu → приложение. Звеньев
 * многовато, но каждое из них человек настраивает один раз, а альтернатива —
 * вписывать сон руками, чего никто делать не станет.
 *
 * Напрямую из браузера, без посредника: проверено, Intervals.icu отвечает на
 * запрос с личным ключом со страницы приложения. Ключ личный и лежит только
 * на этом устройстве — как и ключ тренера (§39.1), в облако он не уезжает.
 */

import { t } from '../core/i18n.js';

const ENDPOINT = 'https://intervals.icu/api/v1/athlete';

/** Сколько ждать ответа: обычный список замеров приходит за секунду. */
const TIMEOUT = 15000;

const DAY = 86400000;

/** Дата в виде, который понимает Intervals.icu: 2026-09-06. */
function ymd(ts) {
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, '0');

    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Понятная причина вместо кода ответа. */
function причина(status) {
    if (status === 401 || status === 403) return t('Ключ не принят. Проверьте его в настройках Intervals.icu.');
    if (status === 404) return t('Спортсмен не найден. Проверьте номер вида i123456.');
    if (status === 429) return t('Слишком часто. Intervals.icu просит подождать.');
    if (status >= 500) return t('Intervals.icu ответил ошибкой. Попробуйте позже.');

    return t('Не удалось получить данные с часов.');
}

export const icu = {

    /** Готов ли обмен: нужны и ключ, и номер спортсмена. */
    ready: (key, athlete) => !!String(key || '').trim() && !!String(athlete || '').trim(),

    /**
     * Запрос к Intervals.icu с личным ключом.
     *
     * Один на все концы сервиса: ошибки, срок ожидания и разбор ответа у них
     * общие, и второе написание того же рано или поздно разошлось бы с первым.
     */
    async get(url, key) {
        const control = new AbortController();
        const срок = setTimeout(() => control.abort(), TIMEOUT);

        let response;
        let data;

        try {
            response = await fetch(url, {
                headers: { Authorization: `Basic ${btoa(`API_KEY:${String(key).trim()}`)}` },
                signal: control.signal
            });

            data = await response.json().catch(() => null);
        } catch (e) {
            if (e.name === 'AbortError') throw new Error(t('Intervals.icu не ответил.'));
            throw new Error(t('Нет связи с Intervals.icu.'));
        } finally {
            clearTimeout(срок);
        }

        if (!response.ok) throw new Error(причина(response.status));

        return data;
    },

    /** Адрес конца сервиса за последние days дней. */
    url(athlete, path, { days = 28, now = Date.now() } = {}) {
        return `${ENDPOINT}/${encodeURIComponent(String(athlete).trim())}/${path}`
            + `?oldest=${ymd(now - days * DAY)}&newest=${ymd(now)}`;
    },

    /**
     * Замеры за последние days дней.
     *
     * Возвращает [{ date, sleep, rhr, hrv, steps }] — секунды сна, удары в
     * минуту. Пропуски остаются пропусками: часы снимают не каждую ночь, и
     * подставлять вместо пропуска ноль значило бы считать бессонницу.
     */
    async wellness({ key, athlete, days = 28, now = Date.now() } = {}) {
        if (!icu.ready(key, athlete)) throw new Error(t('Часы не привязаны.'));

        return icu.read(await icu.get(icu.url(athlete, 'wellness', { days, now }), key));
    },

    /**
     * Занятия, записанные часами, за последние days дней (§62.2).
     *
     * Отдельным запросом, а не вместе с замерами: у Intervals.icu это разные
     * концы, и складывать их в один вызов значило бы терять оба, когда упал
     * один.
     */
    async activities({ key, athlete, days = 28, now = Date.now() } = {}) {
        if (!icu.ready(key, athlete)) throw new Error(t('Часы не привязаны.'));

        return icu.readActivities(await icu.get(icu.url(athlete, 'activities', { days, now }), key));
    },

    /**
     * Что сервис прислал на самом деле (§62.3).
     *
     * Пустой список занятий значит одно из трёх: занятий правда нет, Zepp их
     * не отдаёт, или приложение не узнало полей. Различить это со стороны
     * нельзя, а гадать вместе с человеком — худшее, что можно сделать с
     * настройкой в три звена. Поэтому приложение спрашивает и показывает:
     * сколько записей пришло и какие в них поля.
     *
     * Имена полей, а не значения: имена отвечают на вопрос «узнало ли
     * приложение пульс», а значения — это уже данные человека, и складывать
     * их в настройку незачем.
     */
    async probe({ key, athlete, path = 'activities', days = 28, now = Date.now() } = {}) {
        const data = await icu.get(icu.url(athlete, path, { days, now }), key);

        if (!Array.isArray(data)) return { count: 0, keys: [] };

        const поля = new Set();

        for (const row of data.slice(0, 5)) {
            for (const [k, v] of Object.entries(row || {})) {
                if (v !== null && v !== undefined && v !== '') поля.add(k);
            }
        }

        return { count: data.length, keys: [...поля].sort() };
    },


    /**
     * Разбор занятия.
     *
     * Имена полей приняты с запасом: у Intervals.icu часть величин приходит
     * то под своим именем, то под приставкой icu_ — в зависимости от того,
     * посчитал их сервис сам или взял у источника. Перебрать три написания
     * дешевле, чем однажды показать пустой пульс и гадать почему.
     */
    readActivities(data) {
        if (!Array.isArray(data)) return [];

        const число = (v) => (Number.isFinite(v) && v > 0 ? v : null);
        const первое = (...vs) => vs.map(число).find((v) => v !== null) ?? null;

        return data
            .map((row) => {
                const начало = new Date(String(row?.start_date_local || row?.start_date || '')).getTime();
                if (!Number.isFinite(начало)) return null;

                const длительность = первое(row?.elapsed_time, row?.moving_time, row?.icu_elapsed_time) || 0;

                return {
                    id: String(row?.id ?? ''),
                    name: String(row?.name || ''),
                    type: String(row?.type || ''),
                    start: начало,
                    end: начало + длительность * 1000,
                    seconds: длительность,
                    avgHr: первое(row?.average_heartrate, row?.icu_average_hr, row?.icu_hr_avg),
                    maxHr: первое(row?.max_heartrate, row?.icu_max_hr),
                    calories: первое(row?.calories, row?.icu_calories, row?.kcal),
                    load: первое(row?.icu_training_load, row?.trimp)
                };
            })
            .filter(Boolean);
    },

    /**
     * Разбор ответа в свои замеры.
     *
     * Отдельно от запроса: у сервиса в строке два десятка полей, из которых
     * нужны четыре, и разбор — единственное здесь, что стоит проверять.
     *
     * Строка без сна и без пульса выбрасывается: Intervals.icu заводит запись
     * на каждый день, в том числе пустую, и без отбора «данных за неделю»
     * оказалось бы семь, а замеров — два. Строка с одними шагами остаётся:
     * шаги тоже ответ на вопрос, чем человек занят помимо тренировок.
     */
    read(data) {
        if (!Array.isArray(data)) return [];

        const число = (v) => (Number.isFinite(v) && v > 0 ? v : null);

        return data
            .map((row) => {
                const день = new Date(`${String(row?.id || '')}T00:00:00`).getTime();

                return {
                    date: Number.isFinite(день) ? день : null,
                    sleep: число(row?.sleepSecs),
                    rhr: число(row?.restingHR),
                    hrv: число(row?.hrv),
                    steps: число(row?.steps),

                    // Оценку сна считает сам Zepp, и она видна в его же
                    // приложении: приложение её не толкует, а передаёт
                    score: число(row?.sleepScore)
                };
            })
            .filter((r) => r.date !== null && (r.sleep || r.rhr || r.hrv || r.steps));
    }
};

/** Ключи настроек. Личные, на этом устройстве: в облако не уезжают (§39.1). */
export const ICU_KEY = 'icuKey';
export const ICU_ATHLETE = 'icuAthlete';

/** Под этими ключами лежит привезённое — чтобы не ходить в сеть за каждым показом. */
export const ICU_DATA = 'icuWellness';
export const ICU_ACTS = 'icuActivities';
