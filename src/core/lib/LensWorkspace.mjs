/**
 * Source-preserving jobs for the guided workspace. No new decoding profiles.
 * @author SamuelNotes
 * @license Apache-2.0
 */
import {investigatePayloadTrail} from "./MagicPayloadTrail.mjs";
import {prepareMagicRecipes, replayMagicRecipe} from "./MagicEvidenceReplay.mjs";
import {compareJsonStructure} from "./JsonStructure.mjs";
import {presentJsonStructure} from "./JsonStructurePresentation.mjs";
import {readLensSource} from "./LensSource.mjs";
import {selectLensHarPair} from "./LensHar.mjs";
export {readLensSource} from "./LensSource.mjs";

/** Investigate complete original text with the existing bounded trail. */
export async function investigateLensSource(text, depth=3) {
    if (typeof text !== "string" || !text.length) throw new TypeError("Paste data or choose a file first.");
    if (text.length > 65536) throw new RangeError("Each source is limited to 64 KiB.");
    const bytes = new TextEncoder().encode(text);
    if (readLensSource(bytes) !== text) throw new TypeError("Source text cannot round-trip through UTF-8 without replacement.");
    return investigatePayloadTrail(bytes, {maxDepth: depth, prepare: prepareMagicRecipes,
        replay: recipe => replayMagicRecipe(recipe, bytes)});
}

/** Compare two selected exact strings, without manufacturing a delimiter. */
export function compareLensSources(left, right, har=false) {
    const report = compareJsonStructure(left, right);
    return {report, html: presentJsonStructure(report, left, right,
        {beforeLabel: har === true ? "Request body" : "Source A", afterLabel: har === true ? "Response body" : "Source B"})};
}

/** Investigate independently; comparison refusal never discards retained layers. */
export async function investigateLensHarPair(text, entry, depth=3) {
    const selected = selectLensHarPair(text, entry), reports = [];
    for (const source of selected) {
        const report = await investigateLensSource(source.text, depth);
        report.harSelection = source.origin; reports.push(report);
    }
    const selection = reports.map(report => Math.max(0, report.outputs.findIndex(group => group.text === report.original)));
    let comparison;
    if (reports.some(report => !report.outputs.length)) {
        const missing = reports.map((report, index) => !report.outputs.length ? index ? "response" : "request" : null).filter(Boolean);
        comparison = {error: `No retained JSON layer in the ${missing.join(" and ")} body. No equality conclusion is available.`, selection};
    } else {
        try {
            comparison = {...compareLensSources(...reports.map((report, index) => report.outputs[selection[index]].text), true), selection};
        } catch (error) {
            comparison = {error: `The selected layers could not be compared: ${error.message} Both investigations are retained.`, selection};
        }
    }
    return {reports, comparison};
}
