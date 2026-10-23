/**
 * Bounded escaped presentation of selected parsing cautions.
 * @author SamuelNotes
 * @license Apache-2.0
 */
import Utils from "../Utils.mjs";
import {inspectJsonHazards} from "./JsonHazards.mjs";

const escape = value => Utils.escapeHtml(String(value));
const descriptions = {
    "duplicate-key": ["Repeated member name", "These names decode to the same string in the same object. A consumer may keep one value, reject the object or apply another policy. Lens does not choose or remove either member."],
    "unsafe-range": ["Outside JavaScript's safe-integer range", "The magnitude exceeds 9,007,199,254,740,991. Some values in this range are exactly representable, but adjacent integers or finer detail may be rounded by JavaScript Number consumers. Check the target parser."],
    "nonfinite-number": ["Overflows JavaScript Number", "JavaScript Number conversion is nonfinite. A parse/stringify round trip can replace this number with null. Other numeric implementations may retain it."],
    "underflow-number": ["Nonzero number becomes zero in JavaScript", "JavaScript Number conversion produces zero from this nonzero literal. A consumer with a different numeric representation may retain it."]
};

/** Keep displayed lexemes bounded without splitting surrogate pairs. */
function excerpt(raw) {
    let end = Math.min(raw.length, 120);
    if (end < raw.length && /[\uD800-\uDBFF]/.test(raw[end - 1])) end--;
    return escape(raw.slice(0, end)) + (end < raw.length ? "… (token shortened)" : "");
}

/** Cautions are read-only and appear before result actions, not hidden by syntax. */
export function presentJsonHazards(text, locationLabel="this result's exact decoded text") {
    const report = inspectJsonHazards(text);
    if (report.status !== "complete") return '<details style="white-space:normal;margin:8px 0"><summary>Parsing-caution inspection not completed</summary>' +
        `<p>${escape(report.reason)} Original text and recipe actions remain available. No clean result is implied.</p></details>`;
    if (!report.total) return "";
    return '<section aria-label="JSON parsing cautions" style="white-space:normal;border-left:3px solid #b77412;background:#fff6e4;color:#583d10;padding:8px 10px;margin:8px 0;font-size:13px">' +
        `<strong>${report.total} parsing caution${report.total === 1 ? "" : "s"} · original tokens kept</strong>` +
        `<p style="margin:5px 0">${report.counts["duplicate-key"] ? `${report.counts["duplicate-key"]} repeated member name${report.counts["duplicate-key"] === 1 ? "" : "s"}. ` : ""}` +
        `${report.total - report.counts["duplicate-key"] ? `${report.total - report.counts["duplicate-key"]} JavaScript numeric range caution${report.total - report.counts["duplicate-key"] === 1 ? "" : "s"}. ` : ""}` +
        "Check the receiving parser before using these values.</p><details><summary>Inspect locations and parsing consequences</summary>" +
        `<p>Positions refer to ${escape(locationLabel)}; columns count Unicode characters, not bytes.</p><ol>` +
        report.findings.map(item => `<li><strong>${escape(descriptions[item.code][0])}</strong> · line ${item.token.line}, column ${item.token.column}<br>` +
            `<code style="white-space:pre-wrap;overflow-wrap:anywhere">${excerpt(item.token.raw)}</code>` +
            (item.first ? `<p>First occurrence: line ${item.first.line}, column ${item.first.column} · <code style="white-space:pre-wrap;overflow-wrap:anywhere">${excerpt(item.first.raw)}</code></p>` : "") +
            `<p>${escape(descriptions[item.code][1])}</p></li>`).join("") + "</ol>" +
        (report.truncated ? `<p>Showing ${report.findings.length} of ${report.total} cautions. Category totals cover the complete inspected document.</p>` : "") +
        "<p>Selected checks only, not a complete precision, schema, security or application-policy audit. Absence of a caution is not a safety verdict.</p></details></section>";
}
