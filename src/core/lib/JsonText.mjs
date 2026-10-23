/**
 * Bounded strict-JSON text inspection. Parsed values never become output.
 * Preserves number/string spelling, duplicate members and member order.
 * @author SamuelNotes
 * @license Apache-2.0
 */
const ENCODER = new TextEncoder();
const TOKEN = /"(?:\\.|[^"\\])*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null|[{}[\],:]/y;

/** Inspect complete strict JSON without retaining a parsed value tree. */
export function inspectJsonText(text, {maxBytes=65536, maxTokens=16384, maxDepth=64}={}) {
    if (typeof text !== "string") throw new TypeError("JSON text must be a string");
    for (const [value, maximum] of [[maxBytes, 65536], [maxTokens, 16384], [maxDepth, 64]]) {
        if (!Number.isInteger(value) || value < 1 || value > maximum) throw new RangeError("Invalid JSON text budget");
    }
    if (text.length > maxBytes || ENCODER.encode(text).length > maxBytes) throw new RangeError("Lossless JSON text is limited to 64 KiB per document (or the smaller configured byte budget).");
    const tokens = [];
    let cursor = 0, depth = 0, peakDepth = 0;
    while (cursor < text.length) {
        if (/[\x20\t\r\n]/.test(text[cursor])) {
            cursor++; continue;
        }
        if (tokens.length >= maxTokens) throw new RangeError("Lossless JSON token limit reached (at most 16,384 tokens).");
        TOKEN.lastIndex = cursor;
        const match = TOKEN.exec(text);
        if (!match) throw new SyntaxError("Lossless mode requires a complete strict JSON document; JSON5 syntax is not supported.");
        const raw = match[0], kind = raw[0] === '"' ? "string" : /^[-\d]/.test(raw) ? "number" :
            /^(true|false|null)$/.test(raw) ? "literal" : "punctuation";
        tokens.push({raw, kind, start: cursor, end: TOKEN.lastIndex});
        cursor = TOKEN.lastIndex;
        if (raw === "{" || raw === "[") {
            depth++; peakDepth = Math.max(peakDepth, depth);
            if (depth > maxDepth) throw new RangeError("Lossless JSON nesting limit reached (at most 64 containers).");
        } else if (raw === "}" || raw === "]") depth--;
    }
    // Syntax only. Never serialize or compare this coerced JavaScript value.
    try {
        JSON.parse(text);
    } catch {
        throw new SyntaxError("Lossless mode requires a complete strict JSON document; JSON5 syntax is not supported.");
    }
    return {tokens, byteLength: ENCODER.encode(text).length, peakDepth};
}

/** Replace only insignificant whitespace; retain every JSON token verbatim. */
export function formatJsonText(text, indent="  ", {maxOutputBytes=1048576, ...limits}={}) {
    if (typeof indent !== "string" || !/^[ \t]{0,16}$/.test(indent)) throw new RangeError("Lossless indentation must contain 0–16 spaces or tabs.");
    if (!Number.isInteger(maxOutputBytes) || maxOutputBytes < 1 || maxOutputBytes > 1048576) throw new RangeError("Invalid lossless output budget");
    const {tokens} = inspectJsonText(text, limits), parts = [];
    let depth = 0, outputBytes = 0;
    const append = piece => {
        outputBytes += ENCODER.encode(piece).length;
        if (outputBytes > maxOutputBytes) throw new RangeError("Lossless formatted output exceeds its byte limit (at most 1 MiB).");
        parts.push(piece);
    };
    const newline = () => append("\n" + indent.repeat(depth));
    for (let index = 0; index < tokens.length; index++) {
        const raw = tokens[index].raw;
        if (raw === "{" || raw === "[") {
            append(raw); depth++;
            if (!["}", "]"].includes(tokens[index + 1]?.raw)) newline();
        } else if (raw === "}" || raw === "]") {
            depth--;
            if (!["{", "["].includes(tokens[index - 1]?.raw)) newline();
            append(raw);
        } else if (raw === ",") {
            append(raw); newline();
        } else if (raw === ":") append(": ");
        else append(raw);
    }
    return parts.join("");
}

/** Locate an exact token; columns count Unicode code points, not bytes. */
function locate(text, token) {
    if (!token) return {kind: "end", raw: "", start: text.length, line: text.split("\n").length, column: 1};
    const prefix = text.slice(0, token.start);
    return {...token, line: prefix.split("\n").length, column: [...prefix.slice(prefix.lastIndexOf("\n") + 1)].length + 1};
}

/** First differing token only; no semantic equivalence or complete-diff claim. */
export function compareJsonTexts(left, right, limits={}) {
    let a, b;
    try {
        a = inspectJsonText(left, limits); b = inspectJsonText(right, limits);
    } catch (error) {
        if (!(error instanceof RangeError || error instanceof SyntaxError)) throw error;
        return {status: "not-compared", reason: error.message};
    }
    if (left === right) return {status: "identical", tokens: a.tokens.length};
    let index = 0;
    while (index < a.tokens.length && index < b.tokens.length && a.tokens[index].raw === b.tokens[index].raw) index++;
    if (index === a.tokens.length && index === b.tokens.length) return {status: "formatting-only", tokens: index};
    const oldToken = locate(left, a.tokens[index]), newToken = locate(right, b.tokens[index]);
    let inside = 0;
    while (inside < oldToken.raw.length && inside < newToken.raw.length && oldToken.raw[inside] === newToken.raw[inside]) inside++;
    return {status: "different", tokenIndex: index, left: oldToken, right: newToken, withinTokenOffset: inside,
        scope: "First different token spelling; more changes may exist. Numeric spelling, escapes and member order are significant here."};
}
