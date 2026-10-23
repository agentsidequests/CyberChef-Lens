/**
 * Separate, non-replayable sharing copies. Original evidence stays untouched.
 * @author SamuelNotes
 * @license Apache-2.0
 */
import {inspectLensEvidence} from "./LensEvidence.mjs";
import {inspectJsonText} from "./JsonText.mjs";

const ENCODER = new TextEncoder();
const MARKER = '"[REDACTED]"';
export const DEFAULT_SHARING_FIELDS = ["password", "passwordHash", "secret", "clientSecret", "token", "accessToken",
                                       "refreshToken", "idToken", "apiKey", "authorization", "cookie", "setCookie",
                                       "session", "sessionId", "credential", "credentials", "privateKey"].join("\n");
const normalize = name => name.toLowerCase().replace(/[\s_-]/g, "");

/** Literal lists only: never accept a regular expression or executable path. */
function rules(text, names=false) {
    if (typeof text !== "string" || text.length > 8192 || ENCODER.encode(text).length > 8192) throw new RangeError("Each redaction rule list is limited to 8 KiB of text.");
    const items = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (items.length > 64 || items.some(item => item.length > 128)) throw new RangeError("Use at most 64 rules of 128 characters in each list.");
    if (names && items.some(item => !normalize(item))) throw new RangeError("Member-name rules must contain more than spaces, hyphens or underscores.");
    return [...new Set(names ? items.map(normalize) : items)];
}

/** Replace source spans without normalizing unaffected values, keys or whitespace. */
function redactPayload(text, fields, literals) {
    const {tokens} = inspectJsonText(text), edits = [], names = new Set(fields);
    const keyNames = new Set(tokens.filter((token, index) => tokens[index + 1]?.raw === ":").map(token => JSON.parse(token.raw)));
    let cursor = 0, values = 0, keys = 0, generated = 0;
    const contains = value => literals.some(literal => value.includes(literal));
    const replace = (span, replacement=MARKER) => edits.push({start: span.start, end: span.end, replacement});
    const read = covered => {
        const token = tokens[cursor++], start = token.start;
        let end = token.end;
        if (token.raw === "{") {
            while (tokens[cursor].raw !== "}") {
                const key = tokens[cursor++], name = JSON.parse(key.raw), selected = names.has(normalize(name));
                cursor++; // colon; strict syntax and budgets already checked
                const child = read(covered || selected);
                if (!covered && selected) {
                    replace(child); values++;
                }
                if (!covered && contains(name)) {
                    let label;
                    do {
                        label = `[REDACTED KEY ${++generated}]`;
                    } while (keyNames.has(label));
                    keyNames.add(label); replace(key, JSON.stringify(label)); keys++;
                }
                if (tokens[cursor].raw !== ",") break;
                cursor++;
            }
            end = tokens[cursor++].end;
        } else if (token.raw === "[") {
            while (tokens[cursor].raw !== "]") {
                read(covered);
                if (tokens[cursor].raw !== ",") break;
                cursor++;
            }
            end = tokens[cursor++].end;
        } else if (!covered && (token.kind === "string" ? contains(JSON.parse(token.raw)) : literals.includes(token.raw))) {
            replace(token); values++;
        }
        return {start, end};
    };
    read(false);
    edits.sort((a, b) => a.start - b.start);
    const parts = [];
    let end = 0;
    for (const edit of edits) {
        parts.push(text.slice(end, edit.start), edit.replacement); end = edit.end;
    }
    parts.push(text.slice(end));
    return {text: parts.join(""), values, keys};
}

/** Imported input, recipes, metadata, warnings and rule text never enter the copy. */
export function createLensSharingCopy(input, {memberNames=DEFAULT_SHARING_FIELDS, exactText=""}={}) {
    const fields = rules(memberNames, true), literals = rules(exactText);
    const review = inspectLensEvidence(input), redacted = redactPayload(review.payload, fields, literals);
    const counts = {values: redacted.values, keys: redacted.keys, total: redacted.values + redacted.keys};
    const copy = {
        format: "cyberchef-lens-sharing-copy", formatVersion: 1, producer: "CyberChef Lens",
        notice: "Modified sharing copy, not replayable evidence or an authenticity proof. " +
            "Review the entire copy before sharing. Selected rules can miss sensitive names, values and encoded content.",
        redaction: {valuesReplaced: counts.values, keysReplaced: counts.keys,
            omitted: ["Original input", "All recipes and source coordinates", "Investigation metadata", "Saved warnings", "Rule text", "Other record fields"],
            method: "Selected whole values and literal-matched keys replaced. Untouched JSON source tokens and whitespace retained. " +
                "Member-name matching ignores case, spaces, hyphens and underscores. Literal rules inspect decoded string/key substrings or exact primitive token spelling. Not an exhaustive secret detector."},
        payload: {encoding: "UTF-8", text: redacted.text, byteLength: ENCODER.encode(redacted.text).length}
    };
    const text = JSON.stringify(copy, null, 2) + "\n";
    if (ENCODER.encode(text).length > 1048576) throw new RangeError("The sharing copy exceeds 1 MiB. No partial copy is produced.");
    return {text, counts, payloadBytes: copy.payload.byteLength};
}
