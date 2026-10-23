/**
 * Isolated, disposable native worker for explicit guided-workspace jobs.
 * Reuse ChefWorker's qualified operation-module loader and no recipe UI state.
 * @author SamuelNotes
 * @license Apache-2.0
 */
import "../../core/ChefWorker.js";
import {investigateLensSource, compareLensSources} from "../../core/lib/LensWorkspace.mjs";
import {verifyLensEvidence} from "../../core/lib/LensVerification.mjs";
import {presentLensVerification} from "../../core/lib/MagicJsonPresentation.mjs";
import {createLensSharingCopy} from "../../core/lib/LensSharing.mjs";
import {inspectLensHar, selectLensHar} from "../../core/lib/LensHar.mjs";

self.addEventListener("message", async event => {
    const {action, id, sources, depth, sharing, har} = event.data;
    if (!["lensInvestigate", "lensCompare", "lensVerify", "lensShare", "lensHarIndex", "lensHarInvestigate"].includes(action)) return;
    try {
        let result;
        if (!Array.isArray(sources) || sources.length < 1 || sources.length > 2) throw new TypeError("Choose one or two sources.");
        if (action === "lensHarIndex" || action === "lensHarInvestigate") {
            if (sources.length !== 1) throw new TypeError("Load one complete HAR capture in Source A.");
            if (action === "lensHarIndex") result = inspectLensHar(sources[0]);
            else {
                const selected = selectLensHar(sources[0], har);
                const report = await investigateLensSource(selected.text, depth);
                report.harSelection = selected.origin;
                result = [report];
            }
        } else if (action === "lensShare") {
            if (sources.length !== 1 || typeof sources[0] !== "string") throw new TypeError("Load one saved evidence record.");
            result = createLensSharingCopy(new TextEncoder().encode(sources[0]), sharing);
        } else if (action === "lensVerify") {
            if (sources.length !== 1 || typeof sources[0] !== "string") throw new TypeError("Load one saved evidence record.");
            const verification = await verifyLensEvidence(new TextEncoder().encode(sources[0]));
            result = {html: presentLensVerification(verification), counts: verification.counts};
        } else if (action === "lensCompare") {
            if (sources.length !== 2) throw new TypeError("Comparison needs both sources.");
            result = compareLensSources(...sources);
        } else {
            result = [];
            for (const source of sources) result.push(await investigateLensSource(source, depth));
        }
        self.postMessage({action: "lensComplete", id, result});
    } catch (error) {
        self.postMessage({action: "lensError", id, error: error.message || "This job could not finish."});
    }
});
