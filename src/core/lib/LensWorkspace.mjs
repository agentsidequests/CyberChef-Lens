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
export function compareLensSources(left, right) {
    const report = compareJsonStructure(left, right);
    return {report, html: presentJsonStructure(report, left, right,
        {beforeLabel: "Source A", afterLabel: "Source B"})};
}
