/**
 * Isolated, disposable native worker for explicit guided-workspace jobs.
 * Reuse ChefWorker's qualified operation-module loader and no recipe UI state.
 * @author SamuelNotes
 * @license Apache-2.0
 */
import "../../core/ChefWorker.js";
import {investigateLensSource, compareLensSources} from "../../core/lib/LensWorkspace.mjs";

self.addEventListener("message", async event => {
    const {action, id, sources, depth} = event.data;
    if (action !== "lensInvestigate" && action !== "lensCompare") return;
    try {
        let result;
        if (!Array.isArray(sources) || sources.length < 1 || sources.length > 2) throw new TypeError("Choose one or two sources.");
        if (action === "lensCompare") {
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
