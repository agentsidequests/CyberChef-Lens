/**
 * Reproduce saved claims using current generated routes, never stored programs.
 * @author SamuelNotes
 * @license Apache-2.0
 */
import {inspectLensEvidence} from "./LensEvidence.mjs";
import {investigatePayloadTrail} from "./MagicPayloadTrail.mjs";
import {prepareMagicRecipes, replayMagicRecipe} from "./MagicEvidenceReplay.mjs";

const ENCODER = new TextEncoder();
const PROFILE_OPERATIONS = new Set(["From Base64", "From Hex", "URL Decode", "Regular expression",
                                    "JPath expression", "Raw Inflate Bounded", "Zlib Inflate Bounded", "Take bytes"]);
const recipeKey = recipe => JSON.stringify(recipe.map(step => ({op: step.op, args: step.args})));

/** First unequal UTF-8 byte, including a length difference after a common prefix. */
function firstDifference(a, b) {
    const length = Math.min(a.length, b.length);
    for (let index = 0; index < length; index++) if (a[index] !== b[index]) return index;
    return length;
}

/** Compare only the four documented coordinates, with no type coercion. */
function sameLocation(saved, current) {
    return !!saved && !!current && ["field", "line", "byteOffset", "byteLength"].every(key => saved[key] === current[key]);
}

/**
 * Fixed current profiles generate the only executable configurations. Imported
 * mode, budgets, operation names, arguments and metadata never direct execution.
 * Optional adapters are for native-runtime qualification; UI messages supply none.
 */
export async function verifyLensEvidence(input, {signal, maxMillis=3000,
    prepare=prepareMagicRecipes, replay=replayMagicRecipe}={}) {
    const review = inspectLensEvidence(input), bytes = ENCODER.encode(review.input);
    const eligible = review.routes.map(route => route.recipe.length <= 32 &&
        route.recipe.every(step => PROFILE_OPERATIONS.has(step.op) &&
            Object.keys(step).every(key => key === "op" || key === "args")));
    const report = eligible.some(Boolean) ? await investigatePayloadTrail(bytes, {
        maxDepth: 5, signal, maxMillis, prepare, replay: config => replay(config, bytes)
    }) : {status: "not-run", reason: "No saved route is within the current verification profiles.",
        nodes: [], stops: [], checkedReplays: 0};
    const witnesses = new Map();
    for (const node of report.nodes) {
        for (const source of node.sources) witnesses.set(recipeKey(source.recipe), {node, source});
    }
    const expected = ENCODER.encode(review.payload), counts = {matched: 0, mismatched: 0, unreproduced: 0};
    const comparisons = new Map();
    const routes = review.routes.map((route, index) => {
        const key = eligible[index] ? recipeKey(route.recipe) : null, witness = witnesses.get(key);
        if (!witness) {
            counts.unreproduced++;
            return {index: index + 1, status: "unreproduced", reason: !eligible[index] ?
                "Outside current verification profiles or the 32-step limit. This saved recipe was not executed." :
                report.status === "complete" ? "No current qualified route reproduced this saved recipe. It was not executed from the record." :
                    "The current bounded check did not reproduce this saved route. It was not executed from the record."};
        }
        const {node, source} = witness;
        if (!comparisons.has(node.id)) {
            const payloadMatches = node.text === review.payload;
            comparisons.set(node.id, {payloadMatches, actualBytes: node.byteLength,
                firstDifference: payloadMatches ? null : firstDifference(expected, ENCODER.encode(node.text)),
                actualPreview: payloadMatches ? null : node.text.slice(0, 2048),
                previewTruncated: !payloadMatches && node.text.length > 2048});
        }
        const comparison = comparisons.get(node.id), locationSaved = route.httpOrigin !== undefined;
        const locationMatches = locationSaved ? sameLocation(route.httpOrigin, source.httpOrigin) : null;
        const status = comparison.payloadMatches && locationMatches !== false ? "matched" : "mismatched";
        counts[status]++;
        return {index: index + 1, status, ...comparison, locationSaved, locationMatches, currentOrigin: source.httpOrigin};
    });
    return {review, routes, counts, status: counts.mismatched ? "differences" : counts.unreproduced ? "incomplete" : "matches",
        search: {status: report.status, reason: report.reason, checkedReplays: report.checkedReplays,
            limits: report.limits, depthLimited: report.depthLimited, stops: report.stops}};
}
