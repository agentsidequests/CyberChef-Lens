/**
 * Narrow, read-only framing of one copied UTF-8 HTTP/1.x request.
 * Native byte slices remain replayable against the entire original source.
 * @author SamuelNotes
 * @license Apache-2.0
 */
const ENCODER = new TextEncoder();
const TOKEN = "[!#$%&'*+.^_`|~A-Za-z0-9-]+";
const REQUEST_LINE = new RegExp(`^(${TOKEN}) ([\\x21-\\x7e]+) HTTP/1\\.[01]$`);
const HEADER = new RegExp(`^(${TOKEN}):([\\t\\x20-\\x7e]*)$`);
const HTTP_LIKE = new RegExp(`^(?:${TOKEN}[ \\t]+\\S+[ \\t]+HTTP/\\d|HTTP/\\d|:method\\b)`);

/** Recognize only a whole original request, never issue it or guess framing. */
export function inspectHttpRequest(text) {
    const first = text.split(/\r?\n/, 1)[0];
    if (!HTTP_LIKE.test(first)) return {status: "not-request"};
    const refuse = reason => ({status: "unsupported", reason, candidates: []});
    if (ENCODER.encode(text).length > 65536) return refuse("The complete request exceeds 64 KiB.");
    const request = REQUEST_LINE.exec(first);
    if (!request) return refuse("Use one complete HTTP/1.0 or HTTP/1.1 request, starting with its request line.");
    const newline = text.slice(first.length, first.length + 2) === "\r\n" ? "\r\n" : "\n";
    const end = text.indexOf(newline + newline);
    if (end < 0) return refuse("The request header section needs its terminating blank line.");
    const head = text.slice(0, end), lines = head.split(newline);
    if (lines.length > 129) return refuse("More than 128 request headers; no fields were silently omitted.");
    if (lines.some(line => /[\r\n]/.test(line))) return refuse("Mixed or bare-CR header line endings are unsupported.");
    if (lines.some(line => ENCODER.encode(line).length > 8192)) return refuse("A request line or header exceeds 8192 bytes.");
    const headers = new Map();
    let offset = ENCODER.encode(first + newline).length;
    for (let index = 1; index < lines.length; index++) {
        const line = lines[index], match = HEADER.exec(line);
        if (!match) return refuse("A header is folded or has unsupported field syntax. Nothing was unfolded or repaired.");
        const name = match[1].toLowerCase();
        if (["host", "authorization", "cookie", "content-length", "content-encoding", "transfer-encoding"].includes(name) && headers.has(name)) {
            return refuse(`Repeated ${name} headers are outside this copy-import profile.`);
        }
        if (!headers.has(name)) headers.set(name, {text: line, value: match[2].trim(), line: index + 1, byteOffset: offset});
        offset += ENCODER.encode(line + newline).length;
    }
    if (first.endsWith("HTTP/1.1") && !headers.get("host")?.value) return refuse("HTTP/1.1 import requires one nonempty Host header.");
    if (headers.has("host") && !/^[^\s,/@?#\\]+$/.test(headers.get("host").value)) return refuse("The Host field is outside this copy-import profile.");
    if (headers.has("transfer-encoding")) return refuse("Transfer-Encoding is unsupported. Import a separately decoded capture with its original retained.");
    if (headers.has("content-encoding") && headers.get("content-encoding").value.toLowerCase() !== "identity") {
        return refuse("Encoded request bodies are unsupported by this UTF-8 request profile.");
    }
    const bodyAt = end + newline.length * 2, body = text.slice(bodyAt), bodyBytes = ENCODER.encode(body).length;
    const length = headers.get("content-length");
    if (length && (!/^\d+$/.test(length.value) || Number(length.value) !== bodyBytes)) {
        return refuse("Content-Length must match all remaining body bytes in UTF-8. Nothing was shortened or newline-repaired.");
    }
    if (!length && bodyBytes) return refuse("A nonempty request body needs one matching Content-Length; trailing data was not guessed to be a body.");
    const candidates = [];
    const add = (field, value, line, byteOffset) => {
        const byteLength = ENCODER.encode(value).length;
        if (!byteLength) return;
        candidates.push({kind: `HTTP request ${field}`, recipe: [{op: "Take bytes", args: [byteOffset, byteLength, false]}],
            httpOrigin: {field, line, byteOffset, byteLength}});
    };
    for (const field of ["Authorization", "Cookie"]) {
        const header = headers.get(field.toLowerCase());
        if (header) add(field, header.text, header.line, header.byteOffset);
    }
    if (bodyBytes) add("body", body, lines.length + 2, ENCODER.encode(text.slice(0, bodyAt)).length);
    return {status: "supported", method: request[1], headerCount: lines.length - 1, bodyBytes, candidates};
}
