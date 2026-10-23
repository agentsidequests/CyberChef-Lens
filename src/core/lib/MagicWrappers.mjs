/**
 * Bounded recognition of signed-JSON container shapes.
 * All decoding is performed by native CyberChef operations. Recognition
 * does not identify the producer or verify any signature, timestamp or claim.
 *
 * @author SamuelNotes
 * @license Apache-2.0
 */
import {inspectMagicCandidates, validateJsonDocument} from "./MagicEvidence.mjs";
import {annotateWrapperInterpretation} from "./MagicInterpretation.mjs";
import {recognizeJsonCarriers, carrierGuardFailure, hasDuplicateJsonMembers} from "./MagicCarriers.mjs";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const owns = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

/** Lexical canonicality only; this does not decode the field. */
function isBase64url(text) {
    if (!/^[A-Za-z0-9_-]+$/.test(text) || text.length % 4 === 1) return false;
    const tail = ALPHABET.indexOf(text.at(-1));
    return text.length % 4 === 2 ? tail % 16 === 0 :
        text.length % 4 === 3 ? tail % 4 === 0 : true;
}

/** Known digest lengths only; compatible shape is not signature validation. */
function isSignatureShape(text) {
    return [27, 43, 86].includes(text.length) && isBase64url(text);
}

/** Padded Base64url syntax only; padding is not canonical JOSE encoding. */
function isPaddedBase64url(text) {
    const match = /^([A-Za-z0-9_-]+)(={0,2})$/.exec(text);
    if (!match || !isBase64url(match[1])) return false;
    return !match[2].length || text.length % 4 === 0 && match[2].length === 4 - match[1].length % 4;
}

/** Existing extraction preserves complete capture bytes, without JSON repair. */
function extractionRecipe(pattern) {
    return [
        {op: "Regular expression", args: ["User defined",
                                          pattern, false, false, false, false, false, false, "List capture groups"]}
    ];
}

/** Existing operations preserve exact decoded payload bytes for validation. */
function payloadRecipe(separator, index=0) {
    const delimiter = separator === "." ? "\\." : ":";
    const prefix = index === 1 ? `[A-Za-z0-9_-]+${delimiter}` : "";
    return extractionRecipe(`^\\s*${prefix}([A-Za-z0-9_-]+)(?=${delimiter})`)
        .concat({op: "From Base64", args: ["A-Za-z0-9-_", true, false]});
}

/** Extract exactly the original field, including valid padding, using native operations. */
function compactFieldRecipe(index) {
    const prefix = index === 1 ? "[A-Za-z0-9_-]+={0,2}\\." : "";
    return extractionRecipe(`^\\s*${prefix}([A-Za-z0-9_-]+={0,2})(?=\\.)`)
        .concat({op: "From Base64", args: ["A-Za-z0-9-_", true, false]});
}

/** New variants never infer compression, encryption or an absent signature. */
function compactVariantRefusal(candidate, headerText) {
    const header = JSON.parse(headerText);
    if (Array.isArray(header) || !owns(header, "alg") || typeof header.alg !== "string" || !header.alg.length) return "A compact field requires an object header with a nonempty algorithm declaration.";
    if (hasDuplicateJsonMembers(headerText)) return "Duplicate compact-token header members are ambiguous; no field action is offered.";
    if (owns(header, "enc") || owns(header, "zip") || owns(header, "crit") || owns(header, "b64") && header.b64 !== true) return "Encryption, compression, critical or encoding overrides are outside padded/unsigned field extraction.";
    if (candidate.compactVariant.unsigned && header.alg !== "none") return "The signature is missing. Only an explicit alg:none declaration permits the unsigned route.";
    if (!candidate.compactVariant.unsigned && header.alg === "none") return "An alg:none declaration with a nonempty final field is inconsistent; no new field action is offered.";
    return null;
}

/** Leading-dot zlib containers only; no recursion or JWT zip inference. */
function compressedCandidate(text) {
    const separator = text.includes(":") ? ":" : ".";
    const fields = text.slice(1).split(separator);
    if (![2, 3].includes(fields.length) || !isBase64url(fields[0]) || !isSignatureShape(fields.at(-1))) return null;
    if (fields.length === 3 && !(separator === ":" ? /^[A-Za-z0-9]{1,16}$/.test(fields[1]) :
        fields[1].length <= 11 && isBase64url(fields[1]))) return null;
    const delimiter = separator === "." ? "\\." : ":";
    return {kind: separator === ":" ? "compressed Django-shaped container" : "compressed URL-safe serializer",
        compressed: true, payloadAction: true, resultRole: "Decoded compressed payload",
        recipe: extractionRecipe(`^\\s*\\.([A-Za-z0-9_-]+)(?=${delimiter})`)
            .concat({op: "From Base64", args: ["A-Za-z0-9-_", true, false]},
                {op: "Zlib Inflate Bounded", args: [1048576]}),
        fields: [{name: "Compression marker", value: "."}, ...fields.map((value, i) => ({value,
            name: i === 0 ? "Encoded compressed payload" : i === fields.length - 1 ?
                "Possible signature (unverified)" : "Possible timestamp (unverified)"}))]};
}

/** A native-decoded header may select one explicit raw layer, never a guess. */
function configureCompressedJws(candidate, headerText) {
    const header = JSON.parse(headerText);
    if (Array.isArray(header) || !owns(header, "zip")) return;
    let refusal;
    if (hasDuplicateJsonMembers(headerText)) refusal = "Duplicate compressed-token header members are ambiguous.";
    else if (!owns(header, "alg") || typeof header.alg !== "string" || !header.alg.length || header.alg === "none") refusal = "Compressed-token extraction requires a non-none algorithm shape; this does not verify it.";
    else if (header.zip !== "DEF") refusal = "Only the explicit zip:DEF compressed-token profile is supported.";
    else if (owns(header, "enc")) refusal = "Encryption headers are outside compressed JWS extraction; no JWE decryption is performed.";
    else if (owns(header, "b64") && header.b64 !== true) refusal = "Unencoded or ambiguous payload declarations are not supported for compressed-token extraction.";
    else if (owns(header, "crit")) refusal = "Critical header declarations are outside this bounded compressed-token profile.";
    if (refusal) {
        candidate.compressionRefusal = refusal;
        return;
    }
    candidate.compressed = "raw-deflate";
    candidate.payloadAction = true;
    candidate.recipe = candidate.recipe.concat({op: "Raw Inflate Bounded", args: [1048576]});
    candidate.fields[1].name = "Encoded raw-DEFLATE payload";
}

/**
 * Investigate a narrow, opt-in family without running generic Magic search.
 * At most three native replays; one explicit bounded layer, no recursion or repair.
 *
 * @param {ArrayBuffer|ArrayBufferView} input Original complete container.
 * @param {Function} replay Native recipe execution against that same input.
 * @param {Object} [options] Evidence budgets and optional native module loader.
 * @returns {Promise<Object>} Original token, hypotheses and syntax evidence.
 */
export async function inspectJsonWrappers(input, replay, {prepare, ...budgets}={}) {
    const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) :
        ArrayBuffer.isView(input) ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength) : null;
    if (!bytes) throw new TypeError("Wrapper inspection requires bytes");
    if (bytes.byteLength > 65536) throw new RangeError("Wrapper input exceeds 64 KiB");
    let original;
    try {
        original = new TextDecoder("utf-8", {fatal: true, ignoreBOM: true}).decode(bytes);
    } catch {
        return {status: "unsupported", reason: "Input is not strict UTF-8.", candidates: []};
    }
    const text = original.trim();
    const candidates = [];
    const report = {original, status: "complete", reason: null, candidates};
    // The marker is structural, never disposable Base64 padding.
    if (text.startsWith(".")) {
        const candidate = compressedCandidate(text);
        if (!candidate) return {...report, status: "unsupported",
            reason: "Leading-dot input is not a supported compressed-container shape. No decompression was attempted."};
        candidates.push(candidate);
    }
    const carrier = candidates.length ? {handled: true} : recognizeJsonCarriers(original);
    if (carrier.status === "unsupported") return {...report, ...carrier, original};
    candidates.push(...carrier.candidates || []);
    if (!carrier.handled) {
    // A raw JSON document can contain colons and periods. Only its final
    // separator is structural here; the extracted prefix must still pass JSON.
        if (text.startsWith("{") || text.startsWith("[")) {
            const split = original.lastIndexOf(".");
            const suffix = original.slice(split + 1).trim();
            if (split > 0 && isSignatureShape(suffix)) {
                candidates.push({kind: "untimed raw JSON serializer",
                    rawPayloadText: original.slice(0, split),
                    recipe: extractionRecipe(`^([\\s\\S]+)(?=\\.[A-Za-z0-9_-]{${suffix.length}}\\s*$)`),
                    fields: [{name: "JSON payload", value: original.slice(0, split)},
                             {name: "Possible signature (unverified)", value: suffix}]});
            }
        }
        const separator = text.includes(":") ? ":" : ".";
        const fields = text.split(separator);
        const signature = fields.at(-1);
        const signatureShape = isSignatureShape(signature);
        if (signatureShape && separator === ":" && [2, 3].includes(fields.length) &&
        isBase64url(fields[0]) &&
        (fields.length === 2 || /^[A-Za-z0-9]{1,16}$/.test(fields[1]))) {
            candidates.push({kind: fields.length === 2 ? "Django-compatible signed object" :
                "Django-compatible timestamped object", recipe: payloadRecipe(":"),
            fields: fields.map((value, i) => ({name: i === 0 ? "Encoded payload" :
                i === fields.length - 1 ? "Possible signature (unverified)" : "Possible timestamp (unverified)", value}))});
        }
        if (signatureShape && separator === "." && fields.length === 2 && isBase64url(fields[0])) {
            candidates.push({kind: "untimed URL-safe serializer", recipe: payloadRecipe("."),
                fields: [{name: "Encoded payload", value: fields[0]},
                         {name: "Possible signature (unverified)", value: signature}]});
        }
        if (signatureShape && separator === "." && fields.length === 3 &&
        isBase64url(fields[0]) && isBase64url(fields[1])) {
            const fieldInfo = fields.map((value, i) => ({name: i === 2 ?
                "Possible signature (unverified)" : `Field ${i + 1}`, value}));
            if (fields[1].length === 6) {
                candidates.push({kind: "Flask-compatible session", recipe: payloadRecipe("."),
                    fields: fieldInfo.map((field, i) => ({...field, name: i === 0 ? "Encoded payload" :
                        i === 1 ? "Possible timestamp (unverified)" : field.name}))});
            }
            candidates.push({kind: "JWT-shaped token", recipe: payloadRecipe(".", 1),
                headerRecipe: payloadRecipe("."), fields: fieldInfo.map((field, i) => ({...field,
                    name: i === 0 ? "Encoded header" : i === 1 ? "Encoded payload" : field.name}))});
        }
        // Separate opt-in generic variants; do not relax any legacy serializer,
        // carrier or compressed-token recognizer.
        if (separator === "." && fields.length === 3 &&
            (signature === "" || fields.some(field => field.includes("="))) &&
            isPaddedBase64url(fields[0]) && isPaddedBase64url(fields[1]) &&
            (signature === "" || isPaddedBase64url(signature))) {
            candidates.push({kind: "Compact token field", compactVariant: {padded: fields.some(field => field.includes("=")), unsigned: signature === ""},
                recipe: compactFieldRecipe(1), headerRecipe: compactFieldRecipe(0),
                fields: [{name: "Encoded header (unverified)", value: fields[0]}, {name: "Encoded JSON field", value: fields[1]},
                         {name: signature === "" ? "No signature (unsigned; claims unverified)" : "Possible signature (unverified)", value: signature}]});
        }
    }
    // Decode a possible compact-token header before choosing its payload recipe.
    // Both still consume the same evidence pool, timer and cancellation budget.
    const probes = candidates.flatMap(candidate => [
        ...(candidate.headerRecipe ? [{recipe: candidate.headerRecipe, headerFor: candidate}] : []), candidate,
        ...(candidate.guardRecipes || []).map(guard => ({recipe: guard.recipe, guardIndex: guard.index, guardFor: candidate}))]);
    const preparationStart = performance.now();
    try {
        if (probes.length && prepare) await prepare([...probes.map(probe => probe.recipe),
            // Qualify the optional decoder before the shared evidence clock.
                                                     ...(candidates.some(candidate => candidate.headerRecipe && !candidate.compactVariant) ? [[{op: "Raw Inflate Bounded", args: [1048576]}]] : [])]);
    } catch {
        return {...report, status: "incomplete", reason: "Native decoder modules could not be prepared.",
            candidates: candidates.map(candidate => ({...candidate, accepted: false, evidence: {status: "not-checked"}}))};
    }
    report.preparationMs = performance.now() - preparationStart;
    const evidence = await inspectMagicCandidates(probes, async recipe => {
        const output = await replay(recipe);
        const headerProbe = probes.find(probe => probe.headerFor && probe.recipe === recipe);
        if (headerProbe) {
            const checked = validateJsonDocument(output, budgets.maxOutputBytes);
            if (checked.status === "passed") {
                if (headerProbe.headerFor.compactVariant) headerProbe.headerFor.variantRefusal = compactVariantRefusal(headerProbe.headerFor, checked.text);
                else configureCompressedJws(headerProbe.headerFor, checked.text);
            }
        }
        return output;
    }, budgets);
    report.evidenceMs = evidence.elapsedMs;
    report.status = evidence.status;
    report.reason = evidence.reason;
    for (const candidate of candidates) {
        candidate.evidence = evidence.entries.find(entry => entry.candidate === candidate)?.evidence || {status: "not-checked"};
        // Native string conversion can remove a BOM. A raw extraction must
        // reproduce the exact source prefix, not silently normalize it.
        if (candidate.rawPayloadText !== undefined && candidate.evidence.status === "passed" &&
            candidate.evidence.text !== candidate.rawPayloadText) {
            candidate.evidence = {...candidate.evidence, status: "source-mismatch"};
            if (report.status === "complete") report.status = "incomplete";
            report.reason ??= "Raw payload extraction changed the source text.";
        }
        if (candidate.headerRecipe) {
            candidate.headerEvidence = evidence.entries.find(entry => entry.candidate.headerFor === candidate)?.evidence || {status: "not-checked"};
            // A JSON payload alone is not enough to suggest a JWT header.
            if (candidate.headerEvidence.status === "passed") {
                const header = JSON.parse(candidate.headerEvidence.text);
                if (Array.isArray(header) || !Object.prototype.hasOwnProperty.call(header, "alg") ||
                    typeof header.alg !== "string" || !header.alg.length) {
                    candidate.headerEvidence = {...candidate.headerEvidence, status: "not-jwt-header"};
                }
            }
        }
        candidate.extractionEligible = (!candidate.headerRecipe || candidate.headerEvidence.status === "passed") &&
            !candidate.compressionRefusal && !candidate.variantRefusal;
        candidate.accepted = candidate.evidence.status === "passed" && candidate.extractionEligible;
        annotateWrapperInterpretation(candidate);
        if (candidate.variantRefusal) {
            candidate.interpretationWarnings.push(candidate.variantRefusal);
            if (report.status === "complete") report.status = "unsupported";
            report.reason ??= candidate.variantRefusal;
        }
        if (candidate.compressionRefusal) {
            candidate.interpretationWarnings.push(candidate.compressionRefusal);
            if (report.status === "complete") report.status = "unsupported";
            report.reason ??= candidate.compressionRefusal;
        }
        if (candidate.compressed === true) {
            candidate.interpretationWarnings.push("One checksummed zlib layer only; input limit 64 KiB and decoded-output cap 1 MiB. " +
                "Serialized JSON is not application-native type reconstruction. Signature, timestamp and producer remain unverified.");
        }
        if (candidate.compressed && candidate.evidence.status === "replay-error") {
            report.reason = "Compressed payload could not be completely decoded by the bounded recipe. " +
                "Malformed data or a decoding limit may be responsible; no partial payload action is offered.";
        }
        if (candidate.origin === "json-envelope") {
            const failure = carrierGuardFailure(candidate, evidence);
            if (failure) {
                candidate.extractionEligible = false;
                candidate.accepted = false;
                candidate.interpretationWarnings.push(failure);
                if (report.status === "complete") report.status = "unsupported";
                report.reason ??= failure;
            }
        }
    }
    report.interpretationWarnings = [...new Set(candidates.flatMap(candidate => candidate.interpretationWarnings))];
    report.checked = evidence.checked;
    report.total = evidence.total;
    return report;
}
