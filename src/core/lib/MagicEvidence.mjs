/**
 * Optional full-output evidence for Magic candidates. This does not discover
 * recipes, change Magic's generic ranking, or establish intended meaning.
 *
 * @author SamuelNotes
 * @license Apache-2.0
 */

/**
 * Check a complete byte sequence against the explicit JSON object/array goal.
 * No replacement decoding, substring extraction or JSON5 repair is allowed.
 *
 * @param {ArrayBuffer|ArrayBufferView} input
 * @param {number} [maxOutputBytes=1048576]
 * @returns {Object} Syntax evidence, not semantic or authenticity confidence.
 */
export function validateJsonDocument(input, maxOutputBytes=1048576) {
    let bytes;
    if (input instanceof ArrayBuffer) {
        bytes = new Uint8Array(input);
    } else if (ArrayBuffer.isView(input)) {
        bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    } else {
        throw new TypeError("Replay must return bytes, not a text preview");
    }
    if (bytes.byteLength > maxOutputBytes) {
        return {status: "output-limit", byteLength: bytes.byteLength};
    }
    let text;
    try {
        text = new TextDecoder("utf-8", {fatal: true, ignoreBOM: true}).decode(bytes);
    } catch {
        return {status: "invalid-utf8", byteLength: bytes.byteLength};
    }
    let value;
    try {
        value = JSON.parse(text);
    } catch {
        return {status: "invalid-json", byteLength: bytes.byteLength};
    }
    if (value === null || typeof value !== "object") {
        return {status: "wrong-goal", byteLength: bytes.byteLength};
    }
    return {status: "passed", byteLength: bytes.byteLength, text};
}

/**
 * Replay a bounded native candidate pool and report the evidence without
 * turning a partial search or a valid structure into certainty.
 *
 * Limits here are cooperative, between replays. The caller must isolate and
 * terminate search/replay workers for a hard time or memory ceiling.
 *
 * @param {Object[]} candidates Native Magic candidates, in native rank order.
 * @param {Function} replay Replays the recipe on the COMPLETE original input.
 * @param {Object} [options]
 * @param {number} [options.maxCandidates=256]
 * @param {number} [options.maxOutputBytes=1048576]
 * @param {number} [options.maxMillis=2000] Evidence time, excluding discovery.
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<Object>} Bounded evidence and unchanged source candidates.
 */
export async function inspectMagicCandidates(candidates, replay, {
    maxCandidates=256, maxOutputBytes=1048576, maxMillis=2000, signal
}={}) {
    if (!Array.isArray(candidates) || typeof replay !== "function") {
        throw new TypeError("Candidates and a full-input replay function are required");
    }
    if (!Number.isInteger(maxCandidates) || maxCandidates < 0 || maxCandidates > 4096 ||
        !Number.isInteger(maxOutputBytes) || maxOutputBytes < 1 || maxOutputBytes > 16777216 ||
        !Number.isFinite(maxMillis) || maxMillis < 0 || maxMillis > 30000) {
        throw new RangeError("Invalid evidence budget");
    }
    const start = performance.now();
    const entries = [];
    const groups = new Map();
    let status = "complete";
    let reason = null;
    for (let i = 0; i < candidates.length; i++) {
        if (signal?.aborted) {
            status = "cancelled";
            reason = "cancelled";
            break;
        }
        if (i >= maxCandidates || performance.now() - start >= maxMillis) {
            status = "incomplete";
            reason = i >= maxCandidates ? "candidate-limit" : "time-limit";
            break;
        }
        let evidence;
        try {
            const output = await replay(candidates[i].recipe);
            // A late result is not allowed to override cancellation or a budget.
            if (signal?.aborted || performance.now() - start >= maxMillis) {
                status = signal?.aborted ? "cancelled" : "incomplete";
                reason = signal?.aborted ? "cancelled" : "time-limit";
                break;
            }
            evidence = validateJsonDocument(output, maxOutputBytes);
        } catch {
            evidence = {status: "replay-error"};
        }
        const entry = {rank: i + 1, candidate: candidates[i], evidence};
        entries.push(entry);
        if (evidence.status === "replay-error" || evidence.status === "output-limit") {
            status = "incomplete";
            reason ??= evidence.status;
        }
        if (evidence.status === "passed") {
            if (!groups.has(evidence.text)) {
                groups.set(evidence.text, {text: evidence.text, byteLength: evidence.byteLength, ranks: []});
            }
            groups.get(evidence.text).ranks.push(entry.rank);
        }
        // Let the host deliver cancellation; do not monopolise the UI thread.
        if ((i + 1) % 8 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
    // Also respect a cancellation delivered by the final cooperative yield.
    if (signal?.aborted) {
        status = "cancelled";
        reason = "cancelled";
    }
    const distinctOutputs = [...groups.values()];
    return {
        status, reason,
        conclusion: status !== "complete" ? "not-established" :
            distinctOutputs.length > 1 ? "multiple-outputs" :
                distinctOutputs.length === 1 ? "one-output" : "no-output",
        checked: entries.length, total: candidates.length,
        elapsedMs: performance.now() - start,
        entries, distinctOutputs,
        scope: "Complete UTF-8 JSON object/array syntax within this candidate pool only. " +
            "Not proof of intent, authenticity, schema or duplicate-key absence. " +
            "Outputs are grouped by exact text; formatting differences remain distinct."
    };
}
