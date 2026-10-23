/**
 * Bounded HAR 1.2 recorded-body selection. No traffic reconstruction or fetch.
 * @author SamuelNotes
 * @license Apache-2.0
 */
import {hasDuplicateJsonMembers} from "./MagicCarriers.mjs";
import {readLensSource} from "./LensSource.mjs";

const ENCODER = new TextEncoder();
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const owns = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

/** Bound metadata before JSON.parse; quoted body strings do not add nesting. */
function parseHar(text) {
    if (typeof text !== "string" || text.length > 2097152) throw new RangeError("HAR captures are limited to 2 MiB. Nothing is shortened.");
    if (readLensSource(ENCODER.encode(text), 2097152) !== text) throw new TypeError("The capture cannot be recovered as exact UTF-8.");
    const json = text.startsWith("\uFEFF") ? text.slice(1) : text;
    let depth = 0, quoted = false, escaped = false;
    for (const char of json) {
        if (quoted) {
            if (escaped) escaped = false;
            else if (char === "\\") escaped = true;
            else if (char === '"') quoted = false;
        } else if (char === '"') quoted = true;
        else if (char === "{" || char === "[") {
            if (++depth > 64) throw new RangeError("HAR metadata nesting exceeds 64 containers.");
        } else if (char === "}" || char === "]") depth--;
    }
    let capture;
    try {
        capture = JSON.parse(json);
    } catch {
        throw new TypeError("Load one complete strict JSON HAR capture.");
    }
    if (hasDuplicateJsonMembers(json)) throw new TypeError("Duplicate HAR metadata members make body selection ambiguous.");
    if (!object(capture) || !object(capture.log) || capture.log.version !== "1.2" || !Array.isArray(capture.log.entries)) {
        throw new TypeError("This importer needs HAR 1.2 with a log.entries array.");
    }
    if (!capture.log.entries.length) throw new RangeError("This capture contains no entries.");
    if (capture.log.entries.length > 256) throw new RangeError("HAR captures are limited to 256 entries. No entries are silently omitted.");
    return capture.log.entries;
}

/** One recorded field, never params, cookies, a header block or another entry. */
function body(entry, part) {
    const container = part === "request" ? entry?.request?.postData : entry?.response?.content;
    if (!object(container) || !owns(container, "text")) throw new TypeError("Body text was not recorded. Parameters and files are not reconstructed.");
    if (typeof container.text !== "string") throw new TypeError("Recorded body text must be a string.");
    const encoding = container.encoding;
    if (encoding !== undefined && !(part === "response" && encoding === "base64")) {
        throw new TypeError("Unsupported recorded body encoding. Only response content.encoding = base64 is decoded.");
    }
    let text = container.text;
    if (encoding === "base64") {
        if (text.length > 87384) throw new RangeError("Decoded body exceeds the 64 KiB selection limit.");
        if (text.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(text)) throw new TypeError("Response text is not canonical standard Base64.");
        const length = text.length / 4 * 3 - (text.endsWith("==") ? 2 : text.endsWith("=") ? 1 : 0);
        if (length > 65536) throw new RangeError("Decoded body exceeds the 64 KiB selection limit.");
        let binary;
        try {
            binary = atob(text);
        } catch {
            throw new TypeError("Response text is not canonical standard Base64.");
        }
        if (btoa(binary) !== text) throw new TypeError("Response text is not canonical standard Base64 (including padding bits).");
        text = readLensSource(Uint8Array.from(binary, char => char.charCodeAt(0)));
    } else {
        if (text.length > 65536) throw new RangeError("Recorded body exceeds the 64 KiB selection limit.");
        if (readLensSource(ENCODER.encode(text)) !== text) throw new TypeError("Recorded body cannot be recovered as exact UTF-8.");
    }
    return {text, representation: encoding === "base64" ? "Base64 decoded once to strict UTF-8" : "Recorded UTF-8 text; no HTTP decompression applied"};
}

/** Return small, inert entry labels and explicit body availability, not bodies. */
export function inspectLensHar(text) {
    return parseHar(text).map((entry, index) => {
        const label = value => typeof value === "string" ? value.slice(0, 220).replace(/[\u0000-\u001f\u007f]/g, " ") : "unknown";
        const parts = ["request", "response"].map(part => {
            try {
                const selected = body(entry, part);
                return {part, available: !!selected.text.length, note: selected.text.length ? selected.representation : "Recorded body is empty (0 bytes)."};
            } catch (error) {
                return {part, available: false, note: error.message};
            }
        });
        const status = Number.isSafeInteger(entry?.response?.status) ? entry.response.status : "unknown";
        return {index, label: `${index + 1} · ${label(entry?.request?.method)} · ${label(entry?.request?.url)} · status ${status}`, parts};
    });
}

/** Reparse the complete retained capture; UI summaries never authorize extraction. */
export function selectLensHar(text, {entry, part}={}) {
    return selectEntry(parseHar(text), entry, part);
}

/** Select from one parsed capture; paired bodies cannot cross entry boundaries. */
function selectEntry(entries, entry, part) {
    if (!Number.isInteger(entry) || entry < 0 || entry >= entries.length || !["request", "response"].includes(part)) {
        throw new RangeError("Choose one listed entry and its request or response body.");
    }
    const selected = body(entries[entry], part);
    if (!selected.text.length) throw new RangeError("Recorded body is empty (0 bytes). There is no JSON to investigate.");
    const path = `log.entries[${entry}].${part}.${part === "request" ? "postData" : "content"}.text`;
    return {...selected, origin: {entry: entry + 1, field: path, representation: selected.representation}};
}

/** Both bodies belong to the same explicit entry, with independent representations. */
export function selectLensHarPair(text, entry) {
    const entries = parseHar(text);
    return ["request", "response"].map(part => {
        try {
            return selectEntry(entries, entry, part);
        } catch (error) {
            throw new TypeError(`${part === "request" ? "Request" : "Response"} body: ${error.message}`);
        }
    });
}

/** A small fictional capture: request/response disagree; a second body is missing. */
export function lensHarExample() {
    const response = '{\r\n  "case":"HAR-204", "status":"released",\r\n  "id":9007199254740993, "label":"海 😀", "token":"FICTIONAL-HAR-TOKEN"\r\n}\r\n';
    const encoded = btoa(String.fromCharCode(...ENCODER.encode(response)));
    return JSON.stringify({log: {version: "1.2", creator: {name: "Fictional Lens example", version: "1"}, entries: [
        {request: {method: "POST", url: "https://example.invalid/jobs", postData: {mimeType: "application/json", text: '{"case":"HAR-204","status":"queued"}\r\n'}},
            response: {status: 202, content: {mimeType: "application/json", text: encoded, encoding: "base64"}}},
        {request: {method: "GET", url: "https://example.invalid/not-recorded"}, response: {status: 204, content: {size: 0, mimeType: "application/json"}}}
    ]}}, null, 2) + "\n";
}
