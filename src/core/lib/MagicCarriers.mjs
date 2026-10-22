/**
 * Bounded carrier recognition, not signature or producer validation.
 * Extraction and decoding use existing native CyberChef operations only.
 * @author SamuelNotes
 * @license Apache-2.0
 */
const owns = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** Canonical unpadded Base64url shape, without decoding. */
function url64(text, empty=false) {
    if (typeof text !== "string" || !text.length) return empty && text === "";
    if (!/^[A-Za-z0-9_-]+$/.test(text) || text.length % 4 === 1) return false;
    const tail = URL_ALPHABET.indexOf(text.at(-1));
    return text.length % 4 === 2 ? tail % 16 === 0 : text.length % 4 === 3 ? tail % 4 === 0 : true;
}

/** Canonical padded standard Base64 shape, without decoding. */
function standard64(text) {
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text) || !text.length) return false;
    return url64(text.replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_"));
}

/**
 * Find duplicate keys in an already JSON.parse-qualified document. The lexer
 * ignores punctuation inside strings and compares keys after escape handling.
 */
export function hasDuplicateJsonMembers(text) {
    const stack = [];
    const tokens = /"(?:[^"\\]|\\[\s\S])*"|[{}[\]]/g;
    for (const token of text.matchAll(tokens)) {
        const value = token[0];
        if (value === "{") stack.push(new Set());
        else if (value === "[") stack.push(null);
        else if (value === "}" || value === "]") stack.pop();
        else if (stack.at(-1)) {
            let end = token.index + value.length;
            while (/\s/.test(text[end] || "") && end < text.length) end++;
            if (text[end] !== ":") continue;
            const key = JSON.parse(value);
            if (stack.at(-1).has(key)) return true;
            stack.at(-1).add(key);
        }
    }
    return false;
}

/** Existing JPath emits a quoted string; Base64 discards those non-alphabet quotes. */
function jsonFieldRecipe(path) {
    return [{op: "JPath expression", args: [path, "\\n"]},
            {op: "From Base64", args: ["A-Za-z0-9-_", true, false]}];
}

/** A refusal affects this carrier route only, not native generic JSON evidence. */
const unsupported = reason => ({handled: true, status: "unsupported", reason, candidates: []});

/** Recognize a JSON envelope with at most two signature records. */
function jsonEnvelope(text) {
    let value;
    try {
        value = JSON.parse(text);
    } catch {
        return {handled: false};
    }
    if (!object(value) || !owns(value, "payload") || !["signature", "signatures"].some(key => owns(value, key))) return {handled: false};
    if (hasDuplicateJsonMembers(text)) return unsupported("Duplicate JSON members make envelope extraction ambiguous.");
    const general = owns(value, "signatures");
    if (general && ["signature", "protected", "header"].some(key => owns(value, key))) return unsupported("Mixed general and flattened envelope fields are outside this extraction.");
    const records = general ? value.signatures : [value];
    if (!Array.isArray(records) || !records.length || records.length > 2) return unsupported("Envelope extraction supports one or two signature records only.");
    if (!url64(value.payload)) return unsupported("Only nonempty canonical Base64url envelope payloads are supported; raw and detached payloads are not extracted.");
    const guardRecipes = [];
    const headers = [];
    for (const [index, record] of records.entries()) {
        if (!object(record) || !owns(record, "signature") || !url64(record.signature, true)) return unsupported("A signature record does not have the supported envelope shape.");
        if (owns(record, "header") && !object(record.header)) return unsupported("Unprotected envelope headers must be JSON objects.");
        const unprotected = record.header || {};
        if (owns(unprotected, "b64") || owns(unprotected, "crit")) return unsupported("Encoding or critical declarations in an unprotected header are not supported.");
        headers.push(unprotected);
        if (owns(record, "protected")) {
            if (!url64(record.protected)) return unsupported("Protected headers must be nonempty canonical Base64url strings.");
            guardRecipes.push({recipe: jsonFieldRecipe(general ? `$.signatures[${index}].protected` : "$.protected"), index});
        }
    }
    return {handled: true, candidates: [{kind: "JWS-shaped JSON envelope", origin: "json-envelope",
        resultRole: "Extracted envelope payload (unverified)", payloadAction: true,
        recipe: jsonFieldRecipe("$.payload"), guardRecipes, unprotectedHeaders: headers,
        fields: [{name: "Encoded envelope payload", value: value.payload},
                 {name: "Signature records and headers (unverified)", value: JSON.stringify(records)}]}]};
}

/** Recognize same-name data/signature Cookie pairs, never choose duplicate names. */
function cookiePairs(text) {
    const original = text;
    text = text.trim();
    if (!/(?:^|;\s*)[^;=\s]+\.sig=/.test(text.replace(/^Cookie:\s*/i, ""))) return {handled: false};
    if (/[\r\n]/.test(original)) return unsupported("Multiline Cookie input is outside this extraction.");
    const cookies = new Map();
    for (const part of text.replace(/^Cookie:\s*/i, "").split(";")) {
        const match = part.trim().match(/^([!#$%&'*+.^_`|~A-Za-z0-9-]+)=([\x21-\x3A\x3C-\x7E]*)$/);
        if (!match || /["\\]/.test(match[2])) return unsupported("Only unquoted single-header Cookie pairs are supported.");
        if (cookies.has(match[1])) return unsupported("Duplicate Cookie names make extraction ambiguous.");
        cookies.set(match[1], match[2]);
    }
    const pairs = [...cookies].filter(([name, value]) => !name.endsWith(".sig") && standard64(value) &&
        cookies.has(name + ".sig") && [27, 43, 86].includes(cookies.get(name + ".sig").length) && url64(cookies.get(name + ".sig")));
    if (pairs.length > 3) return unsupported("More than three Cookie pairs exceed the native replay ceiling.");
    return {handled: true, candidates: pairs.map(([name, value]) => {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const pattern = `(?:^\\s*(?:[Cc][Oo][Oo][Kk][Ii][Ee]\\s*:\\s*)?|;\\s*)${escaped}=([A-Za-z0-9+/]+={0,2})(?=\\s*(?:;|$))`;
        return {kind: "Paired Cookie JSON data", origin: "cookie-pair", payloadAction: true,
            resultRole: "Extracted Cookie payload (unverified)",
            recipe: [{op: "Regular expression", args: ["User defined", pattern, false, false, false, false, false, false, "List capture groups"]},
                     {op: "From Base64", args: ["A-Za-z0-9+/=", true, false]}],
            fields: [{name: "Cookie name", value: name}, {name: "Encoded Cookie data", value},
                     {name: "Paired signature (unverified)", value: cookies.get(name + ".sig")}]};
    })};
}

/** Select one bounded carrier family before generic token-shape recognition. */
export function recognizeJsonCarriers(text) {
    return text.trimStart().startsWith("{") ? jsonEnvelope(text) : cookiePairs(text);
}

/** Apply encoding guards to native-decoded protected headers, not authenticity. */
export function carrierGuardFailure(candidate, evidence) {
    for (const guard of candidate.guardRecipes || []) {
        const checked = evidence.entries.find(entry => entry.candidate.guardFor === candidate && entry.candidate.guardIndex === guard.index)?.evidence;
        if (checked?.status !== "passed") return "A protected header could not be completely checked as JSON.";
        const header = JSON.parse(checked.text);
        if (!object(header)) return "A protected header is not a JSON object.";
        if (hasDuplicateJsonMembers(checked.text)) return "Duplicate protected-header members make encoding ambiguous.";
        if (Object.keys(header).some(key => owns(candidate.unprotectedHeaders[guard.index], key))) return "Protected and unprotected header names overlap.";
        if (owns(header, "b64") && header.b64 !== true) return "The header does not declare supported Base64url payload encoding; b64:false and nonboolean values are not extracted.";
        if (owns(header, "crit") && (!Array.isArray(header.crit) || !header.crit.length ||
            header.crit.some(key => key !== "b64" || !owns(header, key)) || new Set(header.crit).size !== header.crit.length)) return "An unsupported or malformed critical-header declaration blocks payload extraction.";
    }
    return null;
}
