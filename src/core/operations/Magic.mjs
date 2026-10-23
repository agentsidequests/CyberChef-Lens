/**
 * @author n1474335 [n1474335@gmail.com]
 * @copyright Crown Copyright 2016
 * @license Apache-2.0
 */

import Operation from "../Operation.mjs";
import Utils from "../Utils.mjs";
import Dish from "../Dish.mjs";
import MagicLib from "../lib/Magic.mjs";
import {replayMagicRecipe, prepareMagicRecipes} from "../lib/MagicEvidenceReplay.mjs";
import {inspectJsonWrappers} from "../lib/MagicWrappers.mjs";
import {investigateMagic} from "../lib/MagicInvestigation.mjs";
import {investigatePayloadTrail} from "../lib/MagicPayloadTrail.mjs";
import {presentJsonInvestigation, presentJsonWrappers, presentPayloadTrail} from "../lib/MagicJsonPresentation.mjs";
import OperationError from "../errors/OperationError.mjs";

/**
 * Magic operation
 * Fork modification: optional complete-JSON investigation and replayable wrapper evidence.
 */
class Magic extends Operation {

    /**
     * Magic constructor
     */
    constructor() {
        super();

        this.name = "Magic";
        this.flowControl = true;
        this.module = "Default";
        this.description = "The Magic operation attempts to detect various properties of the input data and suggests which operations could help to make more sense of it.<br><br><b>Options</b><br><u>Depth:</u> If an operation appears to match the data, it will be run and the result will be analysed further. This argument controls the maximum number of levels of recursion.<br><br><u>Intensive mode:</u> When this is turned on, various operations like XOR, bit rotates, and character encodings are brute-forced to attempt to detect valid data underneath. To improve performance, only the first 100 bytes of the data is brute-forced.<br><br><u>Extensive language support:</u> At each stage, the relative byte frequencies of the data will be compared to average frequencies for a number of languages. The default set consists of ~40 of the most commonly used languages on the Internet. The extensive list consists of 284 languages and can result in many languages matching the data if their byte frequencies are similar.<br><br>Optionally enter a regular expression to match a string you expect to find to filter results (crib).";
        this.infoURL = "https://github.com/gchq/CyberChef/wiki/Automatic-detection-of-encoded-data-using-CyberChef-Magic";
        this.description += "<br><br><u>JSON object or array:</u> The combined investigation uses native Magic and bounded wrapper recognition together. Existing recipes are replayed on the full input; identical JSON texts share a result with route-labelled recipes and competing texts remain separate. The crib applies to decoded outputs from both routes. This checks syntax, not meaning, producer identity or authenticity. Input limit 64 KiB and depth 5. Native evidence has a 256-candidate/cooperative 2-second replay budget; wrapper evidence has at most three replays and its own cooperative 2-second budget. Each output is limited to 1 MiB. Module loading and native search are outside those budgets, not wall-clock guarantees. Use Any for original behavior.";
        this.description += "<br><br><u>JSON wrappers:</u> A separate focused investigation of Flask-compatible and Django-compatible containers, JWT-shaped tokens, untimed serializers, paired data/signature Cookies and Base64url JSON signature envelopes. Leading-dot compressed shapes use one bounded, checksummed zlib layer. Compact JWS-shaped tokens with an explicit zip:DEF header can use one bounded raw-DEFLATE layer, which has no checksum. Both require complete-stream consumption and cap output growth during decoding. Other extraction and Base64 recipes retain their existing behavior. Complete payload bytes, the original container and unverified fields remain available. No signature or credential verification. Envelope extraction supports at most two signature records and rejects duplicate members or unsupported encoding/critical declarations; raw or detached payloads are not extracted. Compressed compact tokens refuse duplicate headers, critical declarations, encoding overrides and encryption headers. Cookie extraction supports at most three unquoted, same-name data/signature pairs. This mode does not run generic Magic; depth, intensive mode, language and crib do not apply. Maximum input 64 KiB; at most three native replays within the cooperative evidence budget. Other compressed formats and signature lengths may not be recognized.";
        this.description += "<br><br><u>Padded and unsigned compact tokens:</u> The JSON routes also inspect correctly padded Base64url fields in uncompressed three-part tokens, and empty-signature tokens with an explicit alg:none object header. Padded data is not canonical JWT/JWS encoding. These variants refuse duplicate headers, encryption, compression, critical declarations and encoding overrides. Extraction uses existing native operations and the same evidence budgets; it does not authenticate a message or validate application claims.";
        this.description += "<br><br><u>JSON payload trail:</u> Follow recognized Base64, hexadecimal, percent-encoding and guarded container layers in one investigation. Each result and intermediate layer has a native recipe replayed against the complete original input. Depth limits decoding/container layers (0–5); intensive mode, language and crib are not used. No arbitrary JSON-field rewriting, signature verification or decryption. Input/expandable layers: 64 KiB. At most 16 retained states, 64 replays, 2 MiB retained state bytes and 1 MiB per output. The cooperative exploration budget is three seconds after module preparation, not a hard CPU, memory or wall-clock guarantee. Results at different layers remain separate; deeper does not mean more trustworthy.";
        this.inputType = "ArrayBuffer";
        this.outputType = "JSON";
        this.presentType = "html";
        this.args = [
            {
                "name": "Depth",
                "type": "number",
                "value": 3
            },
            {
                "name": "Intensive mode",
                "type": "boolean",
                "value": false
            },
            {
                "name": "Extensive language support",
                "type": "boolean",
                "value": false
            },
            {
                "name": "Crib (known plaintext string or regex)",
                "type": "string",
                "value": ""
            },
            {
                "name": "Output goal",
                "type": "option",
                "value": ["Any", "JSON object or array", "JSON wrappers", "JSON payload trail"]
            }
        ];
    }

    /**
     * @param {Object} state - The current state of the recipe.
     * @param {number} state.progress - The current position in the recipe.
     * @param {Dish} state.dish - The Dish being operated on.
     * @param {Operation[]} state.opList - The list of operations in the recipe.
     * @returns {Object} The updated state of the recipe.
     */
    async run(state) {
        const ings = state.opList[state.progress].ingValues,
            [depth, intensive, extLang, crib, goal] = ings,
            dish = state.dish,
            input = await dish.get(Dish.ARRAY_BUFFER),
            magic = new MagicLib(input),
            cribRegex = !["JSON wrappers", "JSON payload trail"].includes(goal) && crib && crib.length ? new RegExp(crib, "i") : null;
        this.evidenceReport = null;
        this.wrapperReport = null;
        this.investigationReport = null;
        this.trailReport = null;
        if (goal === "JSON payload trail") {
            if (input.byteLength > 65536 || !Number.isInteger(depth) || depth < 0 || depth > 5) {
                throw new OperationError("JSON payload trails support inputs up to 64 KiB and an integer depth from 0 to 5.");
            }
            this.trailReport = await investigatePayloadTrail(input, {
                replay: config => replayMagicRecipe(config, input), prepare: prepareMagicRecipes, maxDepth: depth
            });
            this.state = state;
            dish.set(this.trailReport, Dish.JSON);
            return state;
        }
        if (goal === "JSON wrappers") {
            if (input.byteLength > 65536) {
                throw new OperationError("JSON wrapper investigation supports inputs up to 64 KiB.");
            }
            this.wrapperReport = await inspectJsonWrappers(input, config => replayMagicRecipe(config, input),
                {prepare: prepareMagicRecipes});
            this.state = state;
            dish.set(this.wrapperReport, Dish.JSON);
            return state;
        }
        if (goal === "JSON object or array" && (input.byteLength > 65536 || depth > 5)) {
            throw new OperationError("JSON-goal checking supports inputs up to 64 KiB and depth up to 5. Choose Any for the original Magic behavior.");
        }
        if (goal === "JSON object or array") {
            this.investigationReport = await investigateMagic(input, {
                discover: () => magic.speculativeExecution(depth, extLang, intensive, [], false, cribRegex),
                replay: config => replayMagicRecipe(config, input), prepare: prepareMagicRecipes, cribRegex
            });
            this.state = state;
            dish.set(this.investigationReport, Dish.JSON);
            return state;
        }
        let options = await magic.speculativeExecution(depth, extLang, intensive, [], false, cribRegex);

        // Filter down to results which matched the crib
        if (cribRegex) {
            options = options.filter(option => option.matchesCrib);
        }

        // Record the current state for use when presenting
        this.state = state;

        dish.set(options, Dish.JSON);
        return state;
    }

    /**
     * Displays Magic results in HTML for web apps.
     *
     * @param {JSON} options
     * @returns {html}
     */
    present(options) {
        if (this.trailReport) return presentPayloadTrail(this.trailReport, this.jsonPresentationContext());
        if (this.investigationReport) return this.presentInvestigation();
        if (this.wrapperReport) return this.presentWrappers();
        const currentRecipeConfig = this.state.opList.map(op => op.config);
        const evidence = this.evidenceReport;
        const evidenceByCandidate = new Map(evidence?.entries.map(entry => [entry.candidate, entry.evidence]) || []);

        let output = `<table
                class='table table-hover table-sm table-bordered'
                style='table-layout: fixed;'>
            <tr>
                <th>Recipe (click to load)</th>
                <th>Result snippet</th>
                <th>Properties</th>
            </tr>`;

        /**
         * Returns a CSS colour value based on an integer input.
         *
         * @param {number} val
         * @returns {string}
         */
        function chooseColour(val) {
            if (val < 3) return "green";
            if (val < 5) return "goldenrod";
            return "red";
        }

        options.forEach(option => {
            // Construct recipe URL
            // Replace this Magic op with the generated recipe
            const recipeConfig = currentRecipeConfig.slice(0, this.state.progress)
                    .concat(option.recipe)
                    .concat(currentRecipeConfig.slice(this.state.progress + 1)),
                recipeURL = "recipe=" + Utils.encodeURIFragment(Utils.generatePrettyRecipe(recipeConfig));

            let language = "",
                fileType = "",
                matchingOps = "",
                useful = "";
            const entropy = `<span data-toggle="tooltip" data-container="body" title="Shannon Entropy is measured from 0 to 8. High entropy suggests encrypted or compressed data. Normal text is usually around 3.5 to 5.">Entropy: <span style="color: ${chooseColour(option.entropy)}">${option.entropy.toFixed(2)}</span></span>`,
                validUTF8 = option.isUTF8 ? "<span data-toggle='tooltip' data-container='body' title='The data could be a valid UTF8 string based on its encoding.'>Valid UTF8</span>\n" : "";

            if (option.languageScores[0].probability > 0) {
                let likelyLangs = option.languageScores.filter(l => l.probability > 0);
                if (likelyLangs.length < 1) likelyLangs = [option.languageScores[0]];
                language = "<span data-toggle='tooltip' data-container='body' title='Based on a statistical comparison of the frequency of bytes in various languages. Ordered by likelihood.'>" +
                    "Possible languages:\n    " +
                    likelyLangs.map(lang => {
                        return MagicLib.codeToLanguage(lang.lang);
                    }).join("\n    ") +
                    "</span>\n";
            }

            if (option.fileType) {
                fileType = `<span data-toggle="tooltip" data-container="body" title="Based on the presence of magic bytes.">File type: ${option.fileType.mime} (${option.fileType.ext})</span>\n`;
            }

            if (option.matchingOps.length) {
                matchingOps = `Matching ops: ${[...new Set(option.matchingOps.map(op => op.op))].join(", ")}\n`;
            }

            if (option.useful) {
                useful = "<span data-toggle='tooltip' data-container='body' title='This could be an operation that displays data in a useful way, such as rendering an image.'>Useful op detected</span>\n";
            }

            const check = evidenceByCandidate.get(option);
            const checkLabels = {
                "passed": "Complete JSON object/array",
                "invalid-utf8": "Not valid UTF-8",
                "invalid-json": "Not complete strict JSON",
                "wrong-goal": "JSON scalar; object or array required",
                "output-limit": "Output too large to check",
                "replay-error": "Recipe replay failed"
            };
            const goalLabel = evidence ? `<p><strong>${check ? checkLabels[check.status] : "Not checked"}</strong>${
                check?.byteLength === undefined ? "" : ` · ${check.byteLength} bytes`}</p>` : "";
            const recipeLabel = evidence && !option.recipe.length ?
                "Original input (no decoding)" : Utils.generatePrettyRecipe(option.recipe, true);

            output += `<tr>
                <td><a href="#${recipeURL}">${recipeLabel}</a></td>
                <td>${Utils.escapeHtml(Utils.escapeWhitespace(Utils.truncate(option.data, 99)))}</td>
                <td>${goalLabel}${language}${fileType}${matchingOps}${useful}${validUTF8}${entropy}</td>
            </tr>`;
        });

        output += "</table><script type='application/javascript'>$('[data-toggle=\"tooltip\"]').tooltip()</script>";

        if (!options.length) {
            output = "Nothing of interest could be detected about the input data.\nHave you tried modifying the operation arguments?";
        }

        if (evidence) {
            let title = "No complete JSON object or array found in this candidate pool.";
            if (evidence.status !== "complete") {
                title = "Check incomplete — no single-answer conclusion.";
            } else if (evidence.distinctOutputs.length > 1) {
                title = `${evidence.distinctOutputs.length} different JSON outputs survived. Compare before choosing.`;
            } else if (evidence.distinctOutputs.length === 1) {
                title = "One JSON output survived the full check. Meaning is still yours to verify.";
            }
            output = "<section class=\"alert alert-info\" data-magic-goal-report=\"true\" " +
                "style=\"white-space:normal;font-family:Arial,sans-serif\">" +
                `<strong>${title}</strong>` +
                `<p>${evidence.checked} of ${evidence.total} candidate recipes checked on the complete input.` +
                (evidence.reason ? ` Stopped or limited: ${Utils.escapeHtml(evidence.reason)}.` : "") +
                "</p><details><summary>What this check can tell you</summary>" +
                "<p>A format match is not proof of intent, authenticity, schema or duplicate-key absence. " +
                "Only recipes found at this depth and matching your crib were considered. " +
                "Exact-text differences, including formatting, count as different outputs.</p>" +
                `</details></section>${output}`;
        }

        return output;
    }

    /** Shared presentation context; links replace only this operation. */
    jsonPresentationContext() {
        const current = this.state.opList.map(op => op.config);
        const recipeUrl = replacement => Utils.escapeHtml("#recipe=" + Utils.encodeURIFragment(Utils.generatePrettyRecipe(
            current.slice(0, this.state.progress).concat(replacement, current.slice(this.state.progress + 1)))));
        const any = {op: "Magic", args: [...this.state.opList[this.state.progress].ingValues]};
        any.args[4] = "Any";
        return {recipeUrl, anyUrl: recipeUrl([any])};
    }

    /** Display grouped complete-output checks without choosing an interpretation. */
    presentInvestigation() {
        return presentJsonInvestigation(this.investigationReport, this.jsonPresentationContext());
    }

    /** Display only measured hypotheses, never a signature-validity verdict. */
    presentWrappers() {
        return presentJsonWrappers(this.wrapperReport, this.jsonPresentationContext());
    }

}

export default Magic;
