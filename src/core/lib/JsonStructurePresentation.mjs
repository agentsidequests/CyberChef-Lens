/**
 * Read-only structural change report. All source text remains untrusted.
 * @author SamuelNotes
 * @license Apache-2.0
 */
import Utils from "../Utils.mjs";
import {presentJsonHazards} from "./JsonHazardPresentation.mjs";

const escape = value => Utils.escapeHtml(String(value));
const labels = {value: "Value / token spelling", type: "Type changed", added: "Added", removed: "Removed",
    "key-spelling": "Key spelling", "member-order": "Member order"};

/** Show the deciding character even when the rest of a token is very long. */
function excerpt(raw, offset=0) {
    let start = Math.max(0, offset - 100), end = Math.min(raw.length, start + 320);
    if (start && /[\uDC00-\uDFFF]/.test(raw[start])) start--;
    if (end < raw.length && /[\uD800-\uDBFF]/.test(raw[end - 1])) end--;
    return {text: (start ? "…" : "") + raw.slice(start, end) + (end < raw.length ? "…" : ""), shortened: start > 0 || end < raw.length};
}

/** Pair before/after source slices, never normalized JavaScript values. */
function row(change, beforeLabel, afterLabel, embedded) {
    let offset = 0;
    if (change.left && change.right) {
        while (offset < Math.min(change.left.raw.length, change.right.raw.length) && change.left.raw[offset] === change.right.raw[offset]) offset++;
    }
    const panel = (item, label) => {
        if (!item) return `<div class="js-side"><p class="js-label">${escape(label)}</p><p>Not present</p></div>`;
        const preview = excerpt(item.raw, offset);
        return `<div class="js-side"><p class="js-label">${escape(label)} · line ${item.line}, column ${item.column}</p>` +
            `<pre tabindex="0" aria-label="${escape(label)} source preview">${escape(preview.text)}</pre>` +
            (preview.shortened ? '<p class="js-note">Source preview shortened around the first changed character. Original Input is unchanged.</p>' : "") + "</div>";
    };
    const heading = embedded ? "h5" : "h3";
    return '<li class="js-change">' + `<${heading}>${labels[change.kind]}</${heading}><p class="js-path"><code>${escape(change.path)}</code></p>` +
        (change.pathShortened ? '<p class="js-note">Path shortened; use the source locations to disambiguate.</p>' : "") +
        (change.kind === "member-order" ? '<p class="js-note">The relative order of matched members changed. Added/removed members alone do not trigger this row.</p>' : "") +
        '<div class="js-pair">' + panel(change.left, beforeLabel) + panel(change.right, afterLabel) + "</div></li>";
}

/** Checkboxes filter changes, not the comparison conclusion or caution checks. */
export function presentJsonStructure(report, left, right, {showAdded=true, showRemoved=true,
    beforeLabel="Before", afterLabel="After", embedded=false}={}) {
    const visible = change => (change.kind !== "added" || showAdded) && (change.kind !== "removed" || showRemoved);
    const hidden = (showAdded ? 0 : report.counts.added) + (showRemoved ? 0 : report.counts.removed);
    const rows = report.changes.filter(visible);
    const title = report.total ? `${report.total} change${report.total === 1 ? "" : "s"} across the compared structure` :
        report.status === "identical" ? "Exact source texts match" : "Only insignificant JSON whitespace differs";
    const heading = embedded ? "h4" : "h2", subheading = embedded ? "h5" : "h3";
    const cautions = (text, label) => `<${subheading}>${escape(label)} document</${subheading}>` +
        (presentJsonHazards(text, `the ${label} document`) || '<p class="js-note">No selected parsing cautions found in this bounded inspection.</p>');
    return '<section class="json-structure" style="white-space:normal">' +
        "<style>.json-structure{font:14px/1.45 Arial,sans-serif;color:#203247;max-width:72rem;padding:8px;overflow-wrap:anywhere}" +
        ".json-structure *{box-sizing:border-box}.json-structure h2{font-size:20px;margin:0 0 6px}.json-structure h3,.json-structure h4,.json-structure h5{font-size:14px;margin:0 0 5px;color:inherit}" +
        ".json-structure p{margin:5px 0 9px}.json-structure .js-note,.json-structure .js-label{font-size:12px;color:#4c5f72}" +
        ".json-structure .js-changes{list-style:none;padding:0;margin:12px 0}.json-structure .js-change{border-top:1px solid #c9d5df;padding:13px 0}" +
        ".json-structure .js-pair{display:flex;flex-wrap:wrap;gap:10px}.json-structure .js-side{flex:1 1 240px;min-width:0;background:#f5f8fa;padding:9px;border:1px solid #dce4ea;border-radius:4px}" +
        ".json-structure pre{font:12px/1.5 Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere;margin:0;max-height:16rem;overflow:auto}" +
        ".json-structure .js-path code{font:12px/1.4 Consolas,monospace}.json-structure pre:focus-visible,.json-structure summary:focus-visible{outline:3px solid #b65b00;outline-offset:3px}</style>" +
        `<${heading}>JSON structure · lossless comparison</${heading}>` + `<p><strong>${title}.</strong></p>` +
        '<p class="js-note">Members match by decoded name and occurrence; arrays by index, not inferred moves. Numbers, escapes, duplicate members and member order remain significant. This is not semantic equality or authenticity verification.</p>' +
        `<p class="js-note">${report.counts.value} value/token · ${report.counts.type} type · ${report.counts.added} added · ${report.counts.removed} removed · ` +
        `${report.counts["key-spelling"]} key spelling · ${report.counts["member-order"]} member order</p>` +
        (hidden ? `<p><strong>${hidden} hidden by the addition/removal checkboxes.</strong> Hidden changes are not equality.</p>` : "") +
        (report.truncated ? `<p><strong>Detail limit: ${report.changes.length} of ${report.total} change records retained; ${rows.length} shown after filters.</strong> Category counts cover both complete bounded documents; omitted records are not shown.</p>` : "") +
        "<details><summary>How to read paths and counts</summary><p>A path such as <code>$[&quot;role&quot;]#2</code> means the second occurrence of that decoded member name. Duplicate matching is positional within each name, not a decision about which value is intended. A path is a report label, not executable JSONPath. Array indexes start at zero.</p>" +
        "<p>An added/removed subtree or a type replacement counts once, not once per descendant. A key spelling change and its value change are separate records. Locations refer to each original document; columns count Unicode characters, not bytes. " +
        (embedded ? "Insignificant whitespace is always ignored." : "Show subtraction and Ignore whitespace do not alter this mode: only change records are listed and insignificant whitespace is always ignored.") + "</p></details>" +
        "<details><summary>Parsing cautions for both source documents</summary>" +
        cautions(left, beforeLabel) + cautions(right, afterLabel) +
        '<p class="js-note">Selected parser checks only, not a safety verdict. Cautions do not alter the compared text.</p></details>' +
        '<ol class="js-changes">' + rows.map(change => row(change, beforeLabel, afterLabel, embedded)).join("") + "</ol>" +
        (!rows.length && report.total ? "<p>No retained change rows are visible with the current filters. Restore Show added / Show removed, or use JSON (lossless) for the line comparison.</p>" : "") +
        `<p class="js-note">Limits: 64 KiB per document, 16,384 tokens, 64 nested containers and ${report.maxChanges || 128} retained change records. Nothing is loaded, repaired or executed; Input stays unchanged.</p></section>`;
}
