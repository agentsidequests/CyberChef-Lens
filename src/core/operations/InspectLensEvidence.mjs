/**
 * @author SamuelNotes [218310461+agentsidequests@users.noreply.github.com]
 * @copyright Crown Copyright 2026
 * @license Apache-2.0
 */

import Operation from "../Operation.mjs";
import Dish from "../Dish.mjs";
import Utils from "../Utils.mjs";
import {inspectLensEvidence} from "../lib/LensEvidence.mjs";
import {verifyLensEvidence} from "../lib/LensVerification.mjs";
import {presentLensEvidence, presentLensVerification} from "../lib/MagicJsonPresentation.mjs";

/**
 * Inspect Lens Evidence operation
 */
class InspectLensEvidence extends Operation {

    /**
     * InspectLensEvidence constructor
     */
    constructor() {
        super();

        this.name = "Inspect Lens Evidence";
        this.flowControl = true;
        this.module = "Default";
        this.description = "Reopen a saved CyberChef Lens evidence JSON record. Review checks the version-1 structure, UTF-8, declared byte lengths and complete payload syntax, and recomputes selected parsing cautions. It does not rerun the investigation, authenticate the record or execute its saved recipes.<br><br>Verify replay explicitly regenerates current bounded payload-trail routes from the saved input and checks exact payload bytes and saved HTTP coordinates. Stored operations and limits never direct execution. Unsupported routes stay inert; not reproduced is not proof of alteration. Coordinated edits can still match: consistency is not authenticity.<br><br>Payload text and Magic-step input recover only their exact saved strings. The top-level Input and surrounding operations stay unchanged. Imported records can contain secrets. Maximum record 2 MiB, outer nesting 64, saved input 64 KiB, payload 1 MiB and 64 inert recipe routes.";
        this.inputType = "ArrayBuffer";
        this.outputType = "string";
        this.presentType = "html";
        this.args = [
            {
                name: "Output",
                type: "option",
                value: ["Review", "Payload text", "Magic-step input", "Verify replay"]
            }
        ];
    }

    /**
     * @param {Object} state
     * @returns {Object}
     */
    async run(state) {
        this.review = null;
        this.verification = null;
        this.state = state;
        this.mode = state.opList[state.progress].ingValues[0] || "Review";
        const input = await state.dish.get(Dish.ARRAY_BUFFER);
        if (this.mode === "Verify replay") {
            this.verification = await verifyLensEvidence(input);
            this.review = this.verification.review;
        } else this.review = inspectLensEvidence(input);
        state.dish.set(this.mode === "Payload text" ? this.review.payload :
            this.mode === "Magic-step input" ? this.review.input : this.review.text, Dish.STRING);
        return state;
    }

    /** Review only; recovery modes expose the exact saved text as ordinary output. */
    present(data) {
        if (!this.review || !["Review", "Verify replay"].includes(this.mode)) return Utils.escapeHtml(data);
        const current = this.state.opList.map(op => op.config);
        const recipeUrl = mode => Utils.escapeHtml("#recipe=" + Utils.encodeURIFragment(Utils.generatePrettyRecipe(
            current.slice(0, this.state.progress).concat({op: this.name, args: [mode]}, current.slice(this.state.progress + 1)))));
        return this.verification ? presentLensVerification(this.verification, {recipeUrl}) : presentLensEvidence(this.review, {recipeUrl});
    }

}

export default InspectLensEvidence;
