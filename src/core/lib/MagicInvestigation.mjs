/**
 * Complementary, opt-in JSON investigation over existing native operations.
 * A checked format is not a producer, authenticity or intended-meaning proof.
 *
 * @author SamuelNotes
 * @license Apache-2.0
 */
import {inspectMagicCandidates} from "./MagicEvidence.mjs";
import {inspectJsonWrappers} from "./MagicWrappers.mjs";
import {annotateMagicInterpretations} from "./MagicInterpretation.mjs";

/**
 * Combine complete-output evidence without discarding route provenance,
 * original native ranks, partial coverage or competing exact JSON texts.
 *
 * @param {Object} native Native evidence, including original candidate order.
 * @param {Object} wrappers Wrapper hypotheses and their gated evidence.
 * @param {RegExp|null} [cribRegex=null]
 * @returns {Object} Grouped evidence; no automatically selected winner.
 */
export function combineMagicEvidence(native, wrappers, cribRegex=null) {
    const crib = cribRegex ? new RegExp(cribRegex.source, cribRegex.flags.replace(/[gy]/g, "")) : null;
    const outputs = new Map();
    let wrapperCribExcluded = 0;
    const add = (evidence, source) => {
        if (evidence?.status !== "passed" || typeof evidence.text !== "string") return;
        if (crib && !crib.test(evidence.text)) return;
        if (!outputs.has(evidence.text)) outputs.set(evidence.text,
            {text: evidence.text, byteLength: evidence.byteLength, sources: []});
        outputs.get(evidence.text).sources.push(source);
    };
    for (const entry of native.entries || []) {
        add(entry.evidence, {route: "native", recipe: entry.candidate.recipe,
            nativeRank: native.candidates.indexOf(entry.candidate) + 1, checkedPoolRank: entry.rank});
    }
    for (const candidate of wrappers.candidates) {
        if (!candidate.accepted || candidate.evidence?.status !== "passed" ||
            candidate.headerRecipe && candidate.headerEvidence?.status !== "passed") continue;
        if (crib && !crib.test(candidate.evidence.text)) {
            wrapperCribExcluded++;
            continue;
        }
        add(candidate.evidence, {route: "wrapper", kind: candidate.kind, recipe: candidate.recipe, fields: candidate.fields,
            resultRole: candidate.resultRole, payloadAction: candidate.payloadAction, origin: candidate.origin, compatibility: candidate.compatibility,
            interpretationWarnings: candidate.interpretationWarnings});
    }
    const status = native.status === "cancelled" || wrappers.status === "cancelled" ? "cancelled" :
        native.status !== "complete" || !["complete", "unsupported"].includes(wrappers.status) ? "incomplete" :
            wrappers.status === "unsupported" ? "limited" : "complete";
    const groups = [...outputs.values()];
    return {status, conclusion: status !== "complete" ? "not-established" :
        groups.length > 1 ? "multiple-outputs" : groups.length ? "one-output" : "no-output",
    ...annotateMagicInterpretations(groups, wrappers), native, wrappers, wrapperCribExcluded,
    original: wrappers.original,
    scope: "Complete output syntax within the native/eligible-wrapper candidate pools only. " +
        "Exact texts remain distinct, including formatting. No intent, authenticity, producer, schema or duplicate-key proof."};
}

/**
 * Run both routes on the same original bytes with separate bounded replay
 * budgets. Failure in one route cannot erase evidence from the other.
 *
 * @param {ArrayBuffer|ArrayBufferView} input
 * @param {Object} options
 * @param {Function} options.discover Native discovery on those same bytes.
 * @param {Function} options.replay Native recipe replay on those same bytes.
 * @param {Function} [options.prepare] Native module initialization.
 * @param {RegExp|null} [options.cribRegex=null]
 * @param {AbortSignal} [options.signal]
 * @param {Object} [options.nativeBudget] Optional evidence limits.
 * @param {Object} [options.wrapperBudget] Optional evidence limits.
 * @returns {Promise<Object>} Combined report, with route-specific evidence.
 */
export async function investigateMagic(input, {discover, replay, prepare, cribRegex=null,
    signal, nativeBudget={}, wrapperBudget={}}) {
    if (!(input instanceof ArrayBuffer) && !ArrayBuffer.isView(input)) throw new TypeError("Input must be bytes");
    if (input.byteLength > 65536) throw new RangeError("JSON investigation input exceeds 64 KiB");
    if (typeof discover !== "function" || typeof replay !== "function") throw new TypeError("Native discovery and replay are required");
    const wrappers = await inspectJsonWrappers(input, replay, {...wrapperBudget, prepare, signal});
    let native;
    if (signal?.aborted) {
        native = {status: "cancelled", reason: "cancelled", checked: 0, total: null, candidates: [], entries: []};
    } else {
        try {
            const candidates = await discover();
            if (!Array.isArray(candidates)) throw new TypeError("Native discovery returned no candidate array");
            const eligible = cribRegex ? candidates.filter(candidate => candidate.matchesCrib) : candidates;
            native = {...await inspectMagicCandidates(eligible, replay, {...nativeBudget, signal}), candidates};
        } catch (error) {
            native = {status: "incomplete", reason: `Native discovery/check failed: ${String(error.message).slice(0, 240)}`,
                checked: 0, total: null, candidates: [], entries: []};
        }
    }
    return {...combineMagicEvidence(native, wrappers, cribRegex), inputByteLength: input.byteLength};
}
