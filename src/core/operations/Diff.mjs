/**
 * @author n1474335 [n1474335@gmail.com]
 * @copyright Crown Copyright 2016
 * @license Apache-2.0
 */

import Operation from "../Operation.mjs";
import Utils from "../Utils.mjs";
import * as JsDiff from "diff";
import OperationError from "../errors/OperationError.mjs";
import {formatJsonText, compareJsonTexts} from "../lib/JsonText.mjs";
import {compareJsonStructure} from "../lib/JsonStructure.mjs";
import {presentJsonStructure} from "../lib/JsonStructurePresentation.mjs";

/**
 * Diff operation
 */
class Diff extends Operation {

    /**
     * Diff constructor
     */
    constructor() {
        super();

        this.name = "Diff";
        this.module = "Diff";
        this.description = "Compares two inputs (separated by the specified delimiter) and highlights the differences between them.";
        this.description += "<br><br><b>JSON (lossless):</b> Format two complete strict JSON documents without coercing numbers or removing duplicate members, then compare their lines. Member order, numeric spelling and string escape spelling remain significant; this is not semantic equality. Limits per document: 64 KiB, 16,384 tokens, depth 64 and 1 MiB formatted output. Comparison has a cooperative 250 ms / 1,024-edit limit. A limited comparison reports failure, not equality. Existing modes remain unchanged.";
        this.description += "<br><br><b>JSON structure (lossless):</b> Locate field/array changes with original source positions. Match decoded member names by occurrence and arrays by index; report key spelling and member-order changes separately. Not semantic equality or inferred array moves. Same document/token/depth limits, 128 retained change records; counts still cover the complete bounded documents. Show added/removed filters whole addition/removal records. Show subtraction and Ignore whitespace do not apply; insignificant whitespace is always ignored.";
        this.infoURL = "https://wikipedia.org/wiki/File_comparison";
        this.inputType = "string";
        this.outputType = "html";
        this.args = [
            {
                "name": "Sample delimiter",
                "type": "binaryString",
                "value": "\\n\\n"
            },
            {
                "name": "Diff by",
                "type": "option",
                "value": ["Character", "Word", "Line", "Sentence", "CSS", "JSON", "JSON (lossless)", "JSON structure (lossless)"]
            },
            {
                "name": "Show added",
                "type": "boolean",
                "value": true
            },
            {
                "name": "Show removed",
                "type": "boolean",
                "value": true
            },
            {
                "name": "Show subtraction",
                "type": "boolean",
                "value": false,
                "hint": "Not used by JSON structure (lossless), which lists only changes"
            },
            {
                "name": "Ignore whitespace",
                "type": "boolean",
                "value": false,
                "hint": "Relevant for word and line. JSON structure always ignores insignificant whitespace."
            }
        ];
    }

    /**
     * @param {string} input
     * @param {Object[]} args
     * @returns {html}
     */
    run(input, args) {
        const [
            sampleDelim,
            diffBy,
            showAdded,
            showRemoved,
            showSubtraction,
            ignoreWhitespace
        ] = args;
        if (["JSON (lossless)", "JSON structure (lossless)"].includes(diffBy) && (!sampleDelim.length || sampleDelim.length > 1024 || new TextEncoder().encode(sampleDelim).length > 1024 || input.length > 131072 + sampleDelim.length)) {
            throw new OperationError("Lossless Diff requires a nonempty delimiter up to 1 KiB and two documents up to 64 KiB each.");
        }
        const samples = input.split(sampleDelim);
        let output = "",
            diff, losslessStatus;

        // Node and Webpack load modules slightly differently
        const jsdiff = JsDiff.default ? JsDiff.default : JsDiff;

        if (!samples || samples.length !== 2) {
            throw new OperationError("Incorrect number of samples, perhaps you need to modify the sample delimiter or add more samples?");
        }

        switch (diffBy) {
            case "Character":
                diff = jsdiff.diffChars(samples[0], samples[1]);
                break;
            case "Word":
                if (ignoreWhitespace) {
                    diff = jsdiff.diffWords(samples[0], samples[1]);
                } else {
                    diff = jsdiff.diffWordsWithSpace(samples[0], samples[1]);
                }
                break;
            case "Line":
                if (ignoreWhitespace) {
                    diff = jsdiff.diffTrimmedLines(samples[0], samples[1]);
                } else {
                    diff = jsdiff.diffLines(samples[0], samples[1]);
                }
                break;
            case "Sentence":
                diff = jsdiff.diffSentences(samples[0], samples[1]);
                break;
            case "CSS":
                diff = jsdiff.diffCss(samples[0], samples[1]);
                break;
            case "JSON":
                diff = jsdiff.diffJson(samples[0], samples[1]);
                break;
            case "JSON (lossless)": {
                let left, right;
                try {
                    left = formatJsonText(samples[0]); right = formatJsonText(samples[1]);
                    losslessStatus = compareJsonTexts(samples[0], samples[1]).status;
                } catch (error) {
                    if (error instanceof RangeError || error instanceof SyntaxError) throw new OperationError(error.message);
                    throw error;
                }
                diff = jsdiff.diffLines(left, right, {timeout: 250, maxEditLength: 1024});
                if (!diff) throw new OperationError("Lossless JSON comparison did not finish within its work limits. No equality conclusion. Compare a smaller document or use another Diff mode.");
                break;
            }
            case "JSON structure (lossless)": {
                try {
                    return presentJsonStructure(compareJsonStructure(samples[0], samples[1]), samples[0], samples[1], {showAdded, showRemoved});
                } catch (error) {
                    if (error instanceof RangeError || error instanceof SyntaxError) throw new OperationError(error.message);
                    throw error;
                }
            }
            default:
                throw new OperationError("Invalid 'Diff by' option.");
        }

        for (let i = 0; i < diff.length; i++) {
            if (diff[i].added) {
                if (showAdded) output += "<ins>" + Utils.escapeHtml(diff[i].value) + "</ins>";
            } else if (diff[i].removed) {
                if (showRemoved) output += "<del>" + Utils.escapeHtml(diff[i].value) + "</del>";
            } else if (!showSubtraction) {
                output += Utils.escapeHtml(diff[i].value);
            }
        }

        if (losslessStatus) {
            const label = losslessStatus === "identical" ? "Exact source texts match." : losslessStatus === "formatting-only" ?
                "Only insignificant JSON whitespace differs. Token spelling matches." : "JSON token text differs.";
            return '<section style="white-space:normal"><p><strong>Lossless JSON comparison.</strong> ' + label +
                "</p><p>Numbers, duplicate members, member order and escape spelling are preserved. This is a text comparison, not semantic or authenticity verification. " +
                "Additions and removals below respect the display checkboxes; hidden changes are not an equality result.</p>" +
                '<pre style="white-space:pre-wrap;overflow-wrap:anywhere" tabindex="0" aria-label="Lossless JSON changes">' + output + "</pre></section>";
        }
        return output;
    }

}

export default Diff;
