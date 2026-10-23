/**
 * Portable selected-result records. Payloads remain exact strings, not values.
 * A snapshot is editable data, not an authenticated evidence container.
 * @author SamuelNotes
 * @license Apache-2.0
 */
import {inspectJsonHazards} from "./JsonHazards.mjs";

const ENCODER = new TextEncoder();
export const JSON_EXPORT_BYTES = 2097152;

/** Serialize only this checked result and the input its recipes actually used. */
export function createJsonEvidence(group, {report, mode, index, count}) {
    if (typeof report.original !== "string") throw new RangeError("Exact UTF-8 input text is unavailable; no replayable evidence file is offered.");
    if (group.sources.length > 64) throw new RangeError("More than 64 recipe routes were retained; no routes are silently omitted from an evidence file.");
    const notes = [...new Set([
        "Decoded syntax only. Signatures, claims, timestamps, producer identity and intended meaning remain unverified.",
        ...(report.interpretationWarnings || []), ...(group.interpretationWarnings || []),
        ...group.sources.flatMap(source => [...(source.warnings || []), ...(source.interpretationWarnings || [])])
    ])];
    const routeSummary = route => route && ({status: route.status, reason: route.reason ?? null,
        checked: route.checked ?? null, total: route.total ?? null});
    const evidence = {
        format: "cyberchef-lens-evidence", formatVersion: 1,
        producer: "CyberChef Lens",
        notice: "Unredacted local snapshot, not a signature, chain-of-custody or authenticity proof. " +
            "This editable file may contain credentials. Review before sharing. Other results are not included; the selected result is not a preferred truth.",
        input: {encoding: "UTF-8", scope: "Complete input to this Magic step, after any preceding recipe operations.",
            text: report.original, byteLength: ENCODER.encode(report.original).length},
        replay: "Run a result route's recipe against input.text. These recipes exclude surrounding operations; do not run them against a different top-level Input.",
        investigation: {mode, status: report.status, reason: report.reason ?? null,
            selectedResult: index + 1, retainedResultCount: count,
            scope: report.scope || "Recognized candidates and profiles only, not every possible decoding.",
            depthLimited: !!report.depthLimited, limits: report.limits ?? null,
            checkedReplays: report.checkedReplays ?? null,
            checked: report.checked ?? null, total: report.total ?? null,
            native: routeSummary(report.native), wrappers: routeSummary(report.wrappers),
            stops: report.stops || []},
        result: {text: group.text, byteLength: ENCODER.encode(group.text).length,
            role: group.role || "Checked JSON layer", warnings: notes,
            parsingCautions: inspectJsonHazards(group.text),
            routes: group.sources.map(source => ({route: source.route, kind: source.kind,
                depth: source.depth, nativeRank: source.nativeRank, recipe: source.recipe,
                warnings: [...(source.warnings || []), ...(source.interpretationWarnings || [])]}))}
    };
    const text = JSON.stringify(evidence, null, 2) + "\n";
    if (text.length > JSON_EXPORT_BYTES || ENCODER.encode(text).length > JSON_EXPORT_BYTES) {
        throw new RangeError("The complete evidence snapshot exceeds 2 MiB; it is not truncated.");
    }
    return text;
}
