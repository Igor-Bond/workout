/**
 * Разбор исходников для поиска непереведённого (§53).
 *
 * Проверка отрисовкой видит только то, что успело нарисоваться. Диалог,
 * который никто не открыл, ветка, для которой не нашлось данных, сообщение
 * об ошибке, которой не случилось, — всё это остаётся непроверенным, и
 * ровно там русский текст и доживал до людей.
 *
 * Здесь приложение не выполняется, а читается. Каждая строковая постоянная
 * с кириллицей — либо ключ перевода, либо забытое место; третьего в коде
 * интерфейса нет. Такая проверка не зависит ни от данных, ни от того, дошёл
 * ли кто-нибудь до нужного окна.
 *
 * Разбор нарочно свой и маленький: настоящий разборщик JavaScript сюда не
 * затащишь без сборки, а всё, что нужно, — отличить строку от комментария и
 * найти текст внутри шаблона.
 */

const CYRILLIC = /[А-Яа-яЁё]/;

/**
 * Сообщение в журнал разработчика, а не человеку.
 *
 * В проекте такие сообщения все до одного начинаются с имени подсистемы в
 * скобках — «[База]», «[PWA]». Проверка на это опирается, а значит и
 * закрепляет: сообщение без скобок она посчитает текстом для человека и
 * потребует перевести.
 */
const DIAGNOSTIC = /^\s*\[[А-ЯЁA-Z]/;

let cache = null;

/**
 * Состав приложения берётся из сервис-воркера.
 *
 * Список файлов там уже есть и уже сверяется отдельной проверкой, так что
 * новый модуль попадает под проверку перевода сам — без второго списка,
 * который непременно бы отстал.
 */
export async function sources() {
    if (cache) return cache;

    const sw = await (await fetch('../sw.js', { cache: 'no-store' })).text();
    const block = sw.match(/PRECACHE_URLS\s*=\s*\[([\s\S]*?)\];/);

    const paths = [...block[1].matchAll(/'([^']+)'/g)]
        .map((m) => m[1])
        .filter((p) => p.startsWith('js/') && p.endsWith('.js'))

        // Словари — сами перевод, а не то, что переводят
        .filter((p) => !p.startsWith('js/i18n/'))
        .filter((p) => p !== 'js/firebase.config.js');

    cache = await Promise.all(paths.map(async (path) => ({
        path,
        code: await (await fetch(`../${path}`, { cache: 'no-store' })).text()
    })));

    return cache;
}

/**
 * Разложить код на строки, куски шаблонов и всё остальное.
 *
 * Комментарии выбрасываются целиком: они по-русски по всему проекту, и без
 * этого шага проверка утонула бы в них.
 */
export function scan(code) {
    const strings = [];
    const chunks = [];

    const stack = [];
    let kind = 'code';
    let depth = 0;
    let chunkStart = 0;
    let template = 0;
    let counter = 0;
    let i = 0;

    // Косая черта начинает деление или образец — различить их можно только
    // по тому, что стоит перед ней
    const regexHere = () => {
        let j = i - 1;
        while (j >= 0 && /\s/.test(code[j])) j--;
        return j < 0 || '(,=:[!&|?{};+-*%^~'.includes(code[j]) || /\breturn$|\btypeof$|\bcase$/.test(code.slice(0, j + 1));
    };

    while (i < code.length) {
        const c = code[i];

        if (kind === 'template') {
            if (c === '\\') { i += 2; continue; }

            if (c === '$' && code[i + 1] === '{') {
                chunks.push({ value: code.slice(chunkStart, i), start: chunkStart, template });
                stack.push({ kind: 'template' });
                kind = 'code';
                depth = 0;
                i += 2;
                continue;
            }

            if (c === '`') {
                chunks.push({ value: code.slice(chunkStart, i), start: chunkStart, template });
                const frame = stack.pop();
                kind = 'code';
                depth = frame.depth;
                template = frame.template;
                i++;
                continue;
            }

            i++;
            continue;
        }

        if (c === '/' && code[i + 1] === '/') {
            while (i < code.length && code[i] !== '\n') i++;
            continue;
        }

        if (c === '/' && code[i + 1] === '*') {
            i += 2;
            while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i++;
            i += 2;
            continue;
        }

        if (c === '/' && regexHere()) {
            i++;
            while (i < code.length && code[i] !== '/' && code[i] !== '\n') {
                if (code[i] === '\\') i++;
                if (code[i] === '[') {
                    while (i < code.length && code[i] !== ']' && code[i] !== '\n') {
                        if (code[i] === '\\') i++;
                        i++;
                    }
                }
                i++;
            }
            i++;
            continue;
        }

        if (c === "'" || c === '"') {
            const start = i;
            i++;

            let value = '';
            while (i < code.length && code[i] !== c) {
                if (code[i] === '\\') { value += code[i + 1]; i += 2; continue; }
                value += code[i];
                i++;
            }

            i++;
            strings.push({ value, start, end: i });
            continue;
        }

        if (c === '`') {
            stack.push({ kind: 'code', depth, template });
            kind = 'template';
            template = ++counter;
            chunkStart = i + 1;
            i++;
            continue;
        }

        if (c === '{') { depth++; i++; continue; }

        if (c === '}') {
            if (depth === 0 && stack.length && stack[stack.length - 1].kind === 'template') {
                stack.pop();
                kind = 'template';
                chunkStart = i + 1;
                i++;
                continue;
            }

            depth = Math.max(0, depth - 1);
            i++;
            continue;
        }

        i++;
    }

    return { strings, chunks };
}

/** Стоит ли строка первым доводом в вызове перевода. */
function isKey(code, start) {
    return /(?:^|[^\w$.])(?:i18n\.)?t\(\s*$/.test(code.slice(Math.max(0, start - 40), start));
}

/**
 * Ключи перевода, которые встречаются в коде.
 *
 * Только постоянные: `t(p.label)` сюда не попадает, и это честно — какой
 * текст туда придёт, из одного файла не видно.
 */
export function keysIn(code) {
    const { strings } = scan(code);
    return strings.filter((s) => isKey(code, s.start)).map((s) => s.value);
}

/**
 * Русский текст, который не обёрнут в перевод.
 *
 * Возвращает и строковые постоянные, и текст прямо в разметке шаблона:
 * забыть можно и то и другое, а на экране разницы нет.
 */
export function untranslated(code, known = new Set()) {
    const { strings, chunks } = scan(code);
    const out = [];

    for (const s of strings) {
        if (!CYRILLIC.test(s.value)) continue;
        if (isKey(code, s.start) || DIAGNOSTIC.test(s.value)) continue;

        // Строка может доехать до перевода не сразу, а через переменную:
        // подписи видов упражнений лежат таблицей, а t() зовётся уже на
        // месте показа. Признак один — она есть в словарях
        if (known.has(s.value)) continue;

        out.push({ kind: 'строка', text: s.value, line: lineAt(code, s.start) });
    }

    // Сообщение в журнал часто собирается из кусков, и скобка с именем
    // подсистемы стоит только в первом. Помечен первый — помечен весь шаблон
    const seen = new Set();
    const diagnostic = new Set();

    for (const chunk of chunks) {
        if (seen.has(chunk.template)) continue;

        seen.add(chunk.template);
        if (DIAGNOSTIC.test(chunk.value)) diagnostic.add(chunk.template);
    }

    for (const chunk of chunks) {
        if (diagnostic.has(chunk.template)) continue;

        // Внутри разметки берём слова, а не всю строку с отступами и тегами
        const words = chunk.value
            .replace(/<!--[\s\S]*?-->/g, ' ')
            .replace(/<[^>]*>/g, ' ')
            .split(/\n/)
            .map((s) => s.trim())
            .filter((s) => CYRILLIC.test(s));

        // Словарь тут не оправдание: текст, набранный прямо в разметке,
        // до перевода не доходит никогда — на экран попадает он сам
        for (const word of words) {
            out.push({ kind: 'разметка', text: word, line: lineAt(code, chunk.start) });
        }
    }

    return out;
}

/** Номер строки — чтобы находка сразу показывала, куда идти. */
export function lineAt(code, index) {
    return code.slice(0, index).split('\n').length;
}

/**
 * Код без строк и комментариев: на их месте пробелы.
 *
 * Длина сохраняется, поэтому позиции и номера строк остаются прежними. Нужно
 * тому, кто ищет устройство кода, а не его текст: слово в комментарии и
 * слово в строке — не то же самое, что слово в коде.
 */
export function skeleton(code) {
    const { strings, chunks } = scan(code);
    const out = code.split('');

    const стереть = (from, to) => {
        for (let i = from; i < to && i < out.length; i++) {
            if (out[i] !== '\n') out[i] = ' ';
        }
    };

    for (const s of strings) стереть(s.start + 1, s.end - 1);
    for (const c of chunks) стереть(c.start, c.start + c.value.length);

    // Комментарии сканер и так пропускает, но в тексте они остаются
    return out.join('')
        .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
        .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
}

/**
 * Таблицы верхнего уровня: `const ИМЯ = { ... }` с их ключами.
 *
 * Нужно, чтобы отличить таблицу от совпадения слов. Границы объекта берутся
 * по скобкам, а не по числу строк: таблица бывает с пустой строкой посреди,
 * и окном постоянной высоты её разрезает пополам.
 */
export function objects(code) {
    const bare = skeleton(code);
    const out = [];

    for (const m of bare.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\{/g)) {
        const open = m.index + m[0].length - 1;

        let depth = 0;
        let close = -1;

        for (let i = open; i < bare.length; i++) {
            if (bare[i] === '{') depth++;
            else if (bare[i] === '}' && --depth === 0) { close = i; break; }
        }

        if (close < 0) continue;

        const body = bare.slice(open + 1, close);

        // Только свои ключи: у вложенных объектов своя жизнь
        const own = body.replace(/\{[^{}]*\}/g, ' ');
        const keys = [...own.matchAll(/(?:^|[,{])\s*'?([A-Za-z_$][\w$]*)'?\s*:/g)].map((k) => k[1]);

        out.push({ name: m[1], line: lineAt(code, open), keys });
    }

    return out;
}
