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
     * Замеры за последние days дней.
     *
     * Возвращает [{ date, sleep, rhr, hrv, steps }] — секунды сна, удары в
     * минуту. Пропуски остаются пропусками: часы снимают не каждую ночь, и
     * подставлять вместо пропуска ноль значило бы считать бессонницу.
     */
    async wellness({ key, athlete, days = 28, now = Date.now() } = {}) {
        if (!icu.ready(key, athlete)) throw new Error(t('Часы не привязаны.'));

        const id = String(athlete).trim();
        const url = `${ENDPOINT}/${encodeURIComponent(id)}/wellness`
            + `?oldest=${ymd(now - days * DAY)}&newest=${ymd(now)}`;

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

        return icu.read(data);
    },

    /**
     * Разбор ответа в свои замеры.
     *
     * Отдельно от запроса: у сервиса в строке два десятка полей, из которых
     * нужны четыре, и разбор — единственное здесь, что стоит проверять.
     *
     * Строка без сна и без пульса выбрасывается: Intervals.icu заводит запись
     * на каждый день, в том числе пустую, и без отбора «данных за неделю»
     * оказалось бы семь, а замеров — два.
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
                    steps: число(row?.steps)
                };
            })
            .filter((r) => r.date !== null && (r.sleep || r.rhr || r.hrv));
    }
};

/** Ключи настроек. Личные, на этом устройстве: в облако не уезжают (§39.1). */
export const ICU_KEY = 'icuKey';
export const ICU_ATHLETE = 'icuAthlete';

/** Под этим ключом лежат последние привезённые замеры — чтобы не ходить в сеть за каждым показом. */
export const ICU_DATA = 'icuWellness';
