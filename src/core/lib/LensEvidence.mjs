/**
 * Read an untrusted Lens record as data. Never load or execute stored recipes.
 * @author SamuelNotes
 * @license Apache-2.0
 */
import OperationError from "../errors/OperationError.mjs";
import {hasDuplicateJsonMembers} from "./MagicCarriers.mjs";
import {validateJsonDocument} from "./MagicEvidence.mjs";

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder("utf-8", {fatal: true, ignoreBOM: true});
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const strings = value => Array.isArray(value) && value.length <= 256 && value.every(item => typeof item === "string");

/** Bound the outer JSON structure before parsing; quoted payload text is inert. */
function boundNesting(text) {
    let depth = 0, quoted = false, escaped = false;
    for (const char of text) {
        if (quoted) {
            if (escaped) escaped = false;
            else if (char === "\\") escaped = true;
            else if (char === '"') quoted = false;
        } else if (char === '"') quoted = true;
        else if (char === "{" || char === "[") {
            if (++depth > 64) throw new OperationError("Evidence record nesting exceeds 64 containers.");
        } else if (char === "}" || char === "]") depth--;
    }
}

/** A decoded JSON string must round-trip through UTF-8 without replacement. */
function checkText(value, declared, limit, label) {
    if (typeof value !== "string" || value.length > limit) throw new OperationError(`${label} must be text within its byte limit.`);
    const bytes = ENCODER.encode(value);
    if (bytes.length > limit || DECODER.decode(bytes) !== value) throw new OperationError(`${label} is oversized or cannot be recovered as exact UTF-8.`);
    if (!Number.isSafeInteger(declared) || declared !== bytes.length) throw new OperationError(`${label} byte count does not match the saved text. Review the original record.`);
    return bytes;
}

/** Validate a bounded version-1 profile, not the truth of a saved investigation. */
export function inspectLensEvidence(input) {
    const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) :
        ArrayBuffer.isView(input) ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength) : null;
    if (!bytes) throw new TypeError("Evidence inspection requires bytes");
    if (bytes.length > 2097152) throw new OperationError("Evidence records are limited to 2 MiB. No partial record is inspected.");
    let text, record;
    try {
        text = DECODER.decode(bytes);
    } catch {
        throw new OperationError("Evidence record is not strict UTF-8.");
    }
    boundNesting(text);
    try {
        record = JSON.parse(text);
    } catch {
        throw new OperationError("Paste one complete strict JSON evidence record, without a trailing document or JSON5 syntax.");
    }
    if (hasDuplicateJsonMembers(text)) throw new OperationError("Duplicate evidence-record member names are ambiguous. No recovery action is offered.");
    if (!object(record) || record.format !== "cyberchef-lens-evidence" || record.formatVersion !== 1) {
        throw new OperationError("Expected a CyberChef Lens evidence record with formatVersion 1.");
    }
    if (!object(record.input) || record.input.encoding !== "UTF-8" || !object(record.result) ||
        !object(record.investigation) || typeof record.investigation.mode !== "string" || typeof record.investigation.status !== "string" ||
        !strings(record.result.warnings) || !Array.isArray(record.result.routes) || record.result.routes.length < 1 || record.result.routes.length > 64) {
        throw new OperationError("The evidence record is missing supported input, result, warning, investigation or recipe-route fields.");
    }
    checkText(record.input.text, record.input.byteLength, 65536, "Saved Magic-step input");
    const payload = checkText(record.result.text, record.result.byteLength, 1048576, "Saved payload");
    if (validateJsonDocument(payload).status !== "passed") throw new OperationError("The saved payload is not a complete strict JSON object or array. It is not repaired or replaced.");
    for (const route of record.result.routes) {
        if (!object(route) || !Array.isArray(route.recipe) || route.recipe.length > 256 ||
            route.recipe.some(step => !object(step) || typeof step.op !== "string" || !Array.isArray(step.args))) {
            throw new OperationError("Saved recipes must be inert operation/argument arrays, with at most 256 steps per route.");
        }
    }
    return {text, input: record.input.text, payload: record.result.text,
        inputBytes: record.input.byteLength, payloadBytes: payload.length,
        investigation: record.investigation, savedWarnings: record.result.warnings, routes: record.result.routes};
}
