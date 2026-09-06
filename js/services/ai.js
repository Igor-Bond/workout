/**
 * Обращение к языковой модели (§60 ТЗ).
 *
 * Напрямую из браузера, без посредника. Проверено: Google отвечает на запрос
 * с личным ключом прямо со страницы приложения, и заводить ради этого сервер
 * значило бы завести то единственное, чего в приложении нет, — сервер.
 *
 * Ключ личный и лежит только на этом устройстве. В облако он не уезжает
 * (§39.1): ключ — это доступ к оплаченной квоте, и класть его в общее
 * хранилище наравне с планом нельзя. На втором устройстве заводится свой.
 *
 * Ключ в клиентском приложении виден тому, кто откроет хранилище браузера, и
 * это надо знать. Защита от чужих рук здесь не в тайне, а в ограничении
 * ключа по адресу в консоли Google: ключ, работающий только с этого сайта,
 * бесполезен в чужих.
 *
 * Модель задаётся настройкой, а не зашита. Их состав меняется чаще, чем
 * выходят версии приложения, и человек, у которого перестала отвечать одна,
 * должен уметь вписать другую сам, а не ждать обновления.
 */

import { t } from '../core/i18n.js';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Модель по умолчанию. Меняется в настройках, если состав моделей уехал. */
export const DEFAULT_MODEL = 'gemini-3.5-flash';

/**
 * Под какими ключами лежат ключ и модель.
 *
 * Здесь, а не в экране разговора: обращаться к модели стало нужно и с других
 * экранов — из плана, чтобы заполнить карточки упражнений (§60.1), — и
 * второе написание тех же имён рано или поздно разошлось бы с первым.
 */
export const KEY_SETTING = 'aiKey';
export const MODEL_SETTING = 'aiModel';

/**
 * Сколько ждать ответа.
 *
 * Минута: программа на восемь недель считается дольше короткого ответа, а
 * висеть без конца нельзя — человек не поймёт, идёт ли что-то вообще.
 */
const TIMEOUT = 60000;

/** Понятная причина вместо кода ошибки. */
function причина(status, body) {
    const текст = String(body?.error?.message || '');

    if (status === 400 && /API key not valid/i.test(текст)) return t('Ключ не принят. Проверьте, что скопирован он целиком.');
    if (status === 400) return t('Запрос не принят: {что}', { что: текст || status });
    if (status === 403) return t('Доступ запрещён. Возможно, ключ ограничен другим адресом или модель недоступна в вашей стране.');
    if (status === 404) return t('Модель «{модель}» не найдена. Впишите другую в настройках разговора.', { модель: '' });
    if (status === 429) return t('Слишком часто. Google просит подождать.');
    if (status >= 500) return t('Google ответил ошибкой. Попробуйте ещё раз.');

    return текст || t('Не удалось получить ответ.');
}

export const ai = {

    DEFAULT_MODEL,

    /** Готов ли разговор: без ключа обращаться некуда. */
    ready: (key) => !!String(key || '').trim(),

    /**
     * Спросить. messages — [{ role: 'user' | 'model', text }].
     *
     * Возвращает текст ответа или бросает с понятным сообщением: разговор —
     * не обмен данными, его провал должен быть виден сразу и словами.
     */
    async ask({ key, model = DEFAULT_MODEL, system = '', messages = [] } = {}) {
        if (!ai.ready(key)) throw new Error(t('Ключ не задан.'));
        if (messages.length === 0) throw new Error(t('Нечего спрашивать.'));

        const url = `${ENDPOINT}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

        const body = {
            contents: messages.map((m) => ({
                role: m.role === 'model' ? 'model' : 'user',
                parts: [{ text: m.text }]
            }))
        };

        if (system.trim()) body.systemInstruction = { parts: [{ text: system }] };

        const control = new AbortController();
        const срок = setTimeout(() => control.abort(), TIMEOUT);

        let response;
        let data;

        try {
            response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: control.signal
            });

            data = await response.json().catch(() => null);
        } catch (e) {
            if (e.name === 'AbortError') throw new Error(t('Ответа нет уже минуту. Похоже, не дождёмся.'));
            throw new Error(t('Нет связи с Google.'));
        } finally {
            clearTimeout(срок);
        }

        if (!response.ok) {
            const сообщение = response.status === 404
                ? t('Модель «{модель}» не найдена. Впишите другую в настройках разговора.', { модель: model })
                : причина(response.status, data);

            throw new Error(сообщение);
        }

        const текст = (data?.candidates?.[0]?.content?.parts || [])
            .map((p) => p.text || '')
            .join('')
            .trim();

        /*
         * Пустой ответ — не молчание, а отказ, и сказать об этом надо прямо.
         *
         * Модель обрывает ответ по своим соображениям — упёрлась в предел
         * длины или в свои правила, — и человек, увидевший пустое место,
         * решит, что сломалось приложение.
         */
        if (!текст) {
            const причина_отказа = data?.candidates?.[0]?.finishReason || data?.promptFeedback?.blockReason;

            throw new Error(причина_отказа
                ? t('Ответ не получен: {что}', { что: причина_отказа })
                : t('Ответ пришёл пустым.'));
        }

        return текст;
    }
};
