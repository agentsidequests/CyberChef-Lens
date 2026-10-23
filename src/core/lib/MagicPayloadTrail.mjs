/**
 * Bounded composition of native transport and guarded container recipes.
 * Every edge replays its entire prefix against the complete original bytes.
 * No signature, issuer, claim, schema or intended-meaning verification.
 * @author SamuelNotes
 * @license Apache-2.0
 */
import {validateJsonDocument} from "./MagicEvidence.mjs";
import {inspectJsonWrappers} from "./MagicWrappers.mjs";
import {hasDuplicateJsonMembers} from "./MagicCarriers.mjs";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const copyRecipe = recipe => recipe.map(step => ({op: step.op, args: JSON.parse(JSON.stringify(step.args))}));
const asBytes = input => input instanceof ArrayBuffer ? new Uint8Array(input) :
    ArrayBuffer.isView(input) ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength) : null;
const textOf = bytes => new TextDecoder("utf-8", {fatal: true, ignoreBOM: true}).decode(bytes);
const sameBytes = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);

/** Recognize canonical pad bits as well as alphabet, length and padding. */
function base64Transport(text) {
    const match = /^([A-Za-z0-9+/_-]+)(={0,2})$/.exec(text);
    if (!match || /[+/]/.test(match[1]) && /[-_]/.test(match[1]) || match[1].length % 4 === 1) return null;
    const bare = match[1].replace(/\+/g, "-").replace(/\//g, "_");
    const remainder = bare.length % 4, tail = ALPHABET.indexOf(bare.at(-1));
    if (remainder === 2 && tail % 16 || remainder === 3 && tail % 4) return null;
    if (match[2] && (text.length % 4 || match[2].length !== 4 - remainder)) return null;
    return {op: "From Base64", args: [/[-_]/.test(text) ? "A-Za-z0-9-_" : "A-Za-z0-9+/=", true, false]};
}

/** Do not transform string contents inside an already valid JSON document. */
export function recognizeTrailTransports(text) {
    try {
        JSON.parse(text);
        return [];
    } catch {
        // Only a complete non-JSON transport is eligible here.
    }
    const trimmed = text.trim(), candidates = [];
    const base64 = base64Transport(trimmed);
    if (base64) candidates.push({kind: "Base64 transport", recipe: [base64]});
    if (/^(?:[\da-f]{2}){2,}$/i.test(trimmed)) candidates.push({kind: "Hexadecimal transport", recipe: [{op: "From Hex", args: ["None"]}]});
    else if (/^[\da-f]{2}(?: [\da-f]{2})+$/i.test(trimmed)) candidates.push({kind: "Hexadecimal transport", recipe: [{op: "From Hex", args: ["Space"]}]});
    if (trimmed.includes("%") && /^(?:[A-Za-z\d_.~!'()*+-]|%[\da-f]{2})+$/i.test(trimmed)) {
        try {
            // Guard the native operation's fallback for malformed UTF-8 escapes.
            decodeURIComponent(trimmed);
            candidates.push({kind: "Percent-encoded transport", recipe: [{op: "URL Decode", args: [false]}]});
        } catch {
            // Invalid percent/UTF-8 transport is not silently repaired.
        }
    }
    return candidates;
}

/** Additional transit guards do not change existing wrapper-mode behavior. */
function canFollow(candidate) {
    if (!candidate.extractionEligible || !["passed", "invalid-json", "wrong-goal"].includes(candidate.evidence.status)) return false;
    if (candidate.headerEvidence?.status === "passed") {
        const header = JSON.parse(candidate.headerEvidence.text);
        if (hasDuplicateJsonMembers(candidate.headerEvidence.text) || "enc" in header || "crit" in header ||
            "b64" in header && header.b64 !== true || header.alg === "none" && !candidate.compactVariant?.unsigned) return false;
    }
    return !candidate.compatibility?.reasons?.some(reason => ["unencoded-payload", "none-with-signature"].includes(reason));
}

/**
 * Follow only recognized profiles; never claim an exhaustive encoding search.
 * Limits are cooperative between native executions, not a process sandbox.
 * @param {ArrayBuffer|ArrayBufferView} input Complete original input.
 * @param {Object} options
 * @param {Function} options.replay Native recipe execution on original bytes.
 * @param {Function} [options.prepare] Native module initialization.
 * @param {number} [options.maxDepth=3] Logical decoding/container hops.
 * @param {number} [options.maxStates=16]
 * @param {number} [options.maxReplays=64] Includes headers and carrier guards.
 * @param {number} [options.maxRetainedBytes=2097152]
 * @param {number} [options.maxOutputBytes=1048576]
 * @param {number} [options.maxMillis=3000] Excludes initial module preparation.
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<Object>} Checked JSON layers, complete recipes and stops.
 */
export async function investigatePayloadTrail(input, {replay, prepare, maxDepth=3, maxStates=16,
    maxReplays=64, maxRetainedBytes=2097152, maxOutputBytes=1048576, maxMillis=3000, signal}={}) {
    const originalBytes = asBytes(input);
    if (!originalBytes) throw new TypeError("Payload trail requires bytes");
    if (originalBytes.byteLength > 65536) throw new RangeError("Payload trail input exceeds 64 KiB");
    if (typeof replay !== "function") throw new TypeError("Native replay is required");
    for (const [value, min, max] of [[maxDepth, 0, 5], [maxStates, 1, 64], [maxReplays, 0, 256],
                                     [maxRetainedBytes, 1, 8388608], [maxOutputBytes, 1, 1048576]]) {
        if (!Number.isInteger(value) || value < min || value > max) throw new RangeError("Invalid payload-trail budget");
    }
    if (!Number.isFinite(maxMillis) || maxMillis < 0 || maxMillis > 10000) throw new RangeError("Invalid payload-trail clock");
    const root = originalBytes.slice();
    let original;
    try {
        original = textOf(root);
    } catch { /* Binary input remains in the input pane. */ }
    const report = {status: "complete", reason: null, original, inputByteLength: root.length,
        nodes: [], outputs: [], stops: [], checkedReplays: 0, retainedBytes: 0,
        limits: {maxDepth, maxStates, maxReplays, maxRetainedBytes, maxOutputBytes, maxMillis},
        scope: "Recognized transport/container profiles only; deeper JSON is not more trustworthy. No authentication or exhaustive search."};
    const stop = reason => {
        if (report.status !== "cancelled") {
            report.status = reason === "cancelled" ? "cancelled" : "incomplete";
            report.reason ??= reason;
            if (reason === "cancelled") report.reason = reason;
        }
    };
    if (signal?.aborted || maxMillis === 0) {
        stop(signal?.aborted ? "cancelled" : "time-limit");
        return report;
    }
    const prepared = performance.now();
    try {
        if (prepare) await prepare([[{op: "From Base64", args: ["A-Za-z0-9+/=", true, false]},
                                     {op: "From Hex", args: ["None"]}, {op: "URL Decode", args: [false]},
                                     {op: "Regular expression", args: ["User defined", "", false, false, false, false, false, false, "List capture groups"]},
                                     {op: "JPath expression", args: ["$.payload", "\\n"]},
                                     {op: "Raw Inflate Bounded", args: [1048576]}, {op: "Zlib Inflate Bounded", args: [1048576]}]]);
    } catch {
        stop("module-preparation");
        return report;
    }
    report.preparationMs = performance.now() - prepared;
    const start = performance.now(), retained = new Map(), buffers = new Map(), outputs = new Map();
    const check = () => {
        if (signal?.aborted) stop("cancelled");
        else if (performance.now() - start >= maxMillis) stop("time-limit");
        if (report.status === "incomplete" || report.status === "cancelled") throw new Error(report.reason);
    };
    const remember = (bytes, source) => {
        if (bytes.length > maxOutputBytes) {
            stop("output-limit"); return;
        }
        let text;
        try {
            text = textOf(bytes);
        } catch {
            report.stops.push({node: source.parentId, reason: "invalid-utf8"}); return;
        }
        const old = retained.get(text);
        if (old) {
            if (source.hops.length) source.hops.at(-1).nodeId = old.id;
            const different = !old.sources.some(item => JSON.stringify(item.recipe) === JSON.stringify(source.recipe));
            if (different && old.sources.length < 4) old.sources.push(source);
            else if (different) report.stops.push({node: old.id, reason: "alternative-route-limit"});
            return;
        }
        if (report.nodes.length >= maxStates) {
            stop("state-limit"); return;
        }
        if (report.retainedBytes + bytes.length > maxRetainedBytes) {
            stop("retained-byte-limit"); return;
        }
        const node = {id: report.nodes.length, byteLength: bytes.length, text, sources: [source]};
        if (source.hops.length) source.hops.at(-1).nodeId = node.id;
        report.nodes.push(node);
        retained.set(text, node);
        buffers.set(node.id, bytes.slice());
        report.retainedBytes += bytes.length;
        const evidence = validateJsonDocument(bytes, maxOutputBytes);
        node.evidence = {status: evidence.status};
        if (evidence.status === "passed") {
            const output = {nodeId: node.id, text, byteLength: bytes.length, sources: node.sources};
            outputs.set(text, output);
        }
    };
    try {
        check();
        remember(root, {recipe: [], hops: [], depth: 0, parentId: null, kind: "Original input", warnings: []});
        for (let cursor = 0; cursor < report.nodes.length; cursor++) {
            check();
            const node = report.nodes[cursor], source = node.sources[0], bytes = buffers.get(node.id);
            if (source.depth >= maxDepth) {
                report.stops.push({node: node.id, reason: "depth-limit"});
                continue;
            }
            if (bytes.length > 65536) {
                report.stops.push({node: node.id, reason: "expansion-input-limit"});
                continue;
            }
            const captured = new Map();
            const execute = async local => {
                check();
                if (report.checkedReplays >= maxReplays) {
                    stop("replay-limit"); throw new Error(report.reason);
                }
                const recipe = copyRecipe(source.recipe.concat(local));
                if (recipe.length > 32) {
                    stop("recipe-limit"); throw new Error(report.reason);
                }
                report.checkedReplays++;
                const output = asBytes(await replay(recipe));
                check();
                if (!output) throw new TypeError("Native replay did not return bytes");
                if (output.length > maxOutputBytes) {
                    stop("output-limit"); throw new Error(report.reason);
                }
                captured.set(JSON.stringify(local), output);
                return output;
            };
            const follow = (local, output, kind, warnings=[]) => {
                if (!output || sameBytes(output, bytes)) return;
                const recipe = copyRecipe(source.recipe.concat(local));
                remember(output, {recipe, depth: source.depth + 1, parentId: node.id, kind,
                    warnings: [...new Set(source.warnings.concat(warnings))],
                    hops: source.hops.concat({kind, inputBytes: bytes.length, outputBytes: output.length, recipe: copyRecipe(recipe)})});
            };
            const wrappers = await inspectJsonWrappers(bytes, execute, {prepare, signal,
                maxOutputBytes, maxCandidates: 3, maxMillis: Math.max(0, maxMillis - (performance.now() - start))});
            check();
            if (wrappers.status === "unsupported") report.stops.push({node: node.id, reason: "guard-or-profile-refusal", detail: wrappers.reason});
            if (wrappers.status === "incomplete") {
                report.stops.push({node: node.id, reason: wrappers.reason || "wrapper-check-incomplete"});
                // A failed decode is not evidence of an exhausted valid search.
                stop(wrappers.reason || "wrapper-check-incomplete");
            }
            for (const candidate of wrappers.candidates) {
                const kind = candidate.origin === "cookie-pair" ? "Paired Cookie" :
                    candidate.origin === "json-envelope" ? "JSON signature envelope" :
                        candidate.headerRecipe ? candidate.compressed ? "Compressed compact token" : "Compact token" : candidate.kind;
                if (canFollow(candidate)) follow(candidate.recipe, captured.get(JSON.stringify(candidate.recipe)), kind,
                    candidate.interpretationWarnings || []);
                else if (candidate.evidence?.status === "passed" || candidate.extractionEligible === false) {
                    report.stops.push({node: node.id, reason: "wrapper-not-followed", detail: candidate.interpretationWarnings?.join(" ") || "Header or profile guard did not qualify."});
                }
            }
            check();
            for (const candidate of recognizeTrailTransports(node.text)) {
                try {
                    const output = await execute(candidate.recipe);
                    follow(candidate.recipe, output, candidate.kind);
                } catch {
                    if (report.status === "complete") stop("native-replay-error");
                    throw new Error(report.reason);
                }
            }
            // Yield after each bounded state so the host can deliver cancellation.
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        check();
    } catch {
        if (report.status === "complete") stop("investigation-error");
    }
    report.outputs = [...outputs.values()].sort((a, b) => b.sources[0].depth - a.sources[0].depth);
    report.elapsedMs = performance.now() - start;
    report.depthLimited = report.stops.some(item => item.reason === "depth-limit");
    return report;
}
