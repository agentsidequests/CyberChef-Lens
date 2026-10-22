/**
 * Read-only presentation of checked JSON evidence. No decoding or validation.
 * @author SamuelNotes
 * @license Apache-2.0
 */
import Utils from "../Utils.mjs";

const escape = value => Utils.escapeHtml(String(value));
const routine = note => /^(One checksummed zlib layer only;|Explicit zip:DEF profile:)/.test(note);
const listNotes = notes => [...new Set(notes || [])];
const issues = notes => listNotes(notes).filter(note => !routine(note));
const pre = (text, label) => `<pre tabindex="0" aria-label="${escape(label)}">${escape(text)}</pre>`;

/** Add only insignificant JSON whitespace; never coerce values through a parser. */
export function readableJsonPreview(text, limit=4096) {
    let end = Math.min(text.length, limit);
    if (end < text.length && /[\uD800-\uDBFF]/.test(text[end - 1])) end--;
    const source = text.slice(0, end);
    let output = "", depth = 0, quoted = false, escaped = false;
    const newline = () => "\n" + "  ".repeat(Math.min(depth, 12));
    for (let index = 0; index < source.length; index++) {
        const char = source[index];
        if (quoted) {
            output += char;
            if (escaped) escaped = false;
            else if (char === "\\") escaped = true;
            else if (char === '"') quoted = false;
        } else if (char === '"') {
            quoted = true;
            output += char;
        } else if (char === "{" || char === "[") {
            output += char;
            depth++;
            if (!/^[\x20\t\r\n]*[}\]]/.test(source.slice(index + 1))) output += newline();
        } else if (char === "}" || char === "]") {
            depth = Math.max(0, depth - 1);
            if (!/[{[]\s*$/.test(output)) output += newline();
            output += char;
        } else if (char === ",") output += char + newline();
        else if (char === ":") output += ": ";
        else if (!/[\x20\t\r\n]/.test(char)) output += char;
    }
    return {text: output, exact: source, shortened: end < text.length};
}

const styles = `<style>
.magic-json{white-space:normal;font:14px/1.45 Arial,sans-serif;color:#203247;max-width:72rem;padding:4px 6px 16px;overflow-wrap:anywhere}
.magic-json *{box-sizing:border-box}.magic-json h2{font-size:20px;line-height:1.2;margin:0 0 5px;font-weight:600;color:inherit}
.magic-json h3{font-size:16px;line-height:1.3;margin:0;font-weight:600;color:inherit}.magic-json p{margin:5px 0 9px}
.magic-json .mj-status{margin:0 0 5px}.magic-json .mj-trust,.magic-json .mj-meta{font-size:12px;color:#4c5f72}
.magic-json .mj-trust{margin-bottom:12px}.magic-json .mj-card{border:1px solid #c9d5df;border-radius:6px;margin:10px 0 14px;background:#fff;overflow:hidden}
.magic-json .mj-head{padding:12px 14px 10px;background:#f5f8fa;border-bottom:1px solid #dce4ea}
.magic-json .mj-body{padding:10px 14px}.magic-json .mj-actions{display:flex;align-items:center;gap:8px 12px;flex-wrap:wrap;margin-top:9px}
.magic-json a.mj-action{display:inline-block;background:#125a86;color:#fff!important;padding:7px 11px;border-radius:4px;font-weight:600;text-decoration:none;text-transform:none;letter-spacing:normal;line-height:1.35}
.magic-json a.mj-action:hover{background:#084568}.magic-json a{color:#125a86}.magic-json a:focus-visible,.magic-json summary:focus-visible,.magic-json pre:focus-visible{outline:3px solid #b65b00;outline-offset:3px}
.magic-json .mj-action-note{font-size:12px;color:#4c5f72}.magic-json .mj-label{font-size:12px;color:#4c5f72;margin:0 0 5px}
.magic-json pre{font:12px/1.55 Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere;word-break:normal;max-height:20rem;overflow:auto;background:#f7f9fb;color:#203247;padding:10px;border:1px solid #e0e7ed;border-radius:4px;margin:0 0 9px}
.magic-json details{margin:8px 0}.magic-json summary{cursor:pointer;font-size:13px;color:#344d63;padding:3px 0;list-style-position:inside}
.magic-json details[open]>summary{font-weight:600;margin-bottom:6px}.magic-json .mj-warning{border-left:3px solid #b77412;background:#fff6e4;color:#583d10;padding:8px 10px;margin:8px 0;font-size:13px}
.magic-json ul{padding-left:20px;margin:4px 0}.magic-json .mj-chain{font-size:12px;color:#344d63;margin:5px 0 10px}.magic-json .mj-chain span{display:inline-block}
.magic-json .mj-source{border-top:1px solid #dce4ea;padding-top:8px;margin-top:10px}.magic-json dt{font-size:12px;margin-top:6px}.magic-json dd{margin:2px 0 8px}.magic-json code{white-space:pre-wrap;color:inherit}
@media(max-width:600px){.magic-json{padding:4px 2px 12px}.magic-json .mj-head,.magic-json .mj-body{padding:10px}.magic-json h2{font-size:18px}.magic-json pre{font-size:11px}}
</style>`;

/** Keep consequential warnings beside the affected evidence. */
function warnings(notes) {
    const visible = issues(notes);
    return visible.length ? '<div class="mj-warning" role="note"><strong>Before you use this result</strong><ul>' +
        visible.map(note => `<li>${escape(note)}</li>`).join("") + "</ul></div>" : "";
}

/** Pair readable indentation with a bounded exact-text view. */
function preview(text) {
    const view = readableJsonPreview(text);
    return '<p class="mj-label">Readable preview · indentation added, values unchanged</p>' + pre(view.text, "Readable JSON preview") +
        (view.shortened ? '<p class="mj-meta">Preview shortened. Load a recipe for the complete checked output.</p>' : "") +
        "<details><summary>Exact text preview — original formatting</summary>" + pre(view.exact, "Exact text preview") +
        (view.shortened ? '<p class="mj-meta">This exact-text preview is also shortened.</p>' : "") + "</details>";
}

/** Name the action for the evidence role, not merely valid syntax. */
function actionLabel(source, role) {
    if (role === "Outer JSON envelope") return "Inspect envelope recipe";
    if (source.resultRole && source.resultRole !== "Possible token payload" && !source.payloadAction) return "Load field recipe";
    return source.route === "native" ? "Load JSON recipe" : "Load payload recipe";
}

/** Show operations without exposing their arguments at first touch. */
function chain(recipe) {
    return '<p class="mj-chain">' + (recipe.length ? recipe.map(step => `<span>${escape(step.op)}</span>`).join(" → ") :
        "Original input (no decoding)") + "</p>";
}

/** Retain inspectable container fields without authenticating them. */
function fields(source) {
    return source.fields?.length ? "<details><summary>Container fields — not authenticated</summary><dl>" +
        source.fields.map(field => `<dt>${escape(field.name)}</dt><dd><code>${escape(field.value)}</code></dd>`).join("") + "</dl></details>" : "";
}

/** Preserve route provenance, arguments and alternative replay links. */
function sourceDetail(source, context, role, alternative=false) {
    const label = source.route === "native" ? `Native Magic · original rank ${source.nativeRank}` : `Possible ${source.kind}`;
    return '<div class="mj-source">' + `<p class="mj-meta">${escape(label)}</p>` +
        (alternative ? `<a href="${context.recipeUrl(source.recipe)}">${actionLabel(source, role)}</a>` : "") +
        chain(source.recipe) + "<details><summary>Exact recipe and arguments</summary>" +
        pre(Utils.generatePrettyRecipe(source.recipe, true) || "Original input (no decoding)", "Recipe and arguments") + "</details>" + fields(source) + "</div>";
}

/** State the compression boundary at the action surface. */
function compressionCue(sources) {
    const operations = sources.flatMap(source => source.recipe.map(step => step.op));
    if (operations.includes("Raw Inflate Bounded")) return "Raw DEFLATE · bounded output (1 MiB) · no checksum";
    if (operations.includes("Zlib Inflate Bounded")) return "Zlib · bounded output (1 MiB) · checksum checked";
    return "Complete JSON object/array · syntax checked, not authenticated";
}

/** Put a reproducible action above its evidence preview. */
function resultCard(group, index, count, context) {
    // Prefer the bounded payload replay for the action, not an unbounded native alternative.
    const source = group.sources.find(item => item.recipe.some(step => /^(Raw|Zlib) Inflate Bounded$/.test(step.op)) && item.payloadAction) || group.sources[0];
    const role = group.role || "JSON result";
    return '<article class="mj-card"><div class="mj-head">' +
        `<h3>${count > 1 ? `Result ${index + 1} · ` : ""}${escape(role)}</h3>` +
        `<p class="mj-meta">${escape(compressionCue(group.sources))} · ${group.byteLength} bytes</p>` +
        warnings(group.interpretationWarnings) +
        '<div class="mj-actions">' + `<a class="mj-action" href="${context.recipeUrl(source.recipe)}">${actionLabel(source, role)}</a>` +
        '<span class="mj-action-note">Replaces Magic. Input stays unchanged.</span></div></div><div class="mj-body">' +
        preview(group.text) +
        "<details><summary>How this was decoded" + (group.sources.length > 1 ? ` · ${group.sources.length} recipe routes` : "") + "</summary>" +
        sourceDetail(source, context, role) + group.sources.filter(item => item !== source).slice(0, 15).map(item => sourceDetail(item, context, role, true)).join("") +
        (group.sources.length > 16 ? `<p class="mj-meta">Showing 16 of ${group.sources.length} routes.</p>` : "") +
        '<p class="mj-meta">Matching output is not independent corroboration.</p></details></div></article>';
}

/** Keep full original input recoverable, separately from previews. */
function original(report, label) {
    return report.original === undefined ? "" : `<details><summary>${label} (complete, unchanged)</summary>` + pre(report.original, label) + "</details>";
}

/** Retain unsupported and competing wrapper hypotheses. */
function hypotheses(report) {
    return report.candidates.length ? "<details><summary>All wrapper hypotheses</summary><ul>" + report.candidates.map(candidate =>
        `<li>Possible ${escape(candidate.kind)}: ${escape(candidate.evidence.status)}` +
        (candidate.headerEvidence ? `; header ${escape(candidate.headerEvidence.status)}` : "") +
        (candidate.accepted ? "; JSON field check passed (crib may still exclude it)" : "; not confirmed") +
        (candidate.compatibility ? `; ${escape(candidate.compatibility.format)} compatibility: ${escape(candidate.compatibility.status)}` : "") + "</li>").join("") + "</ul></details>" : "";
}

const limits = "<p>Only discovered candidates were checked, not every possible decoding. Exact text differences, including formatting, remain separate. " +
    "Compatible wrapper shapes do not identify their producer. No signature, schema or intended-meaning verification; duplicate-key checks cover selected headers/envelopes only, not all payloads.</p>" +
    "<p>Compressed paths use one bounded checksummed zlib layer or, for explicit zip:DEF compact tokens, one bounded raw-DEFLATE layer with no checksum. " +
    "Gzip, recursive compression, general JWE and credential validation remain outside these wrapper paths. Compressed input is limited to 64 KiB; retained output to 1 MiB, with at most one overflow-detection byte. " +
    "Decoder workspace and output assembly need additional memory; this is not an absolute process-memory limit. Invalid UTF-8, malformed JSON, scalar payloads and noncanonical Base64url fields cannot earn the payload label.</p>";

/** Fold routine boundary detail, never actual interpretation conflicts. */
function scopeNotes(notes) {
    const folded = listNotes(notes).filter(routine);
    return folded.length ? "<ul>" + folded.map(note => `<li>${escape(note)}</li>`).join("") + "</ul>" : "";
}

/** Grouped native and wrapper evidence; no interpretation is selected for the user. */
export function presentJsonInvestigation(report, context) {
    const count = report.outputs.length;
    const title = !count && report.status !== "complete" ? "No checked result yet. The search did not finish." :
        count > 1 ? `${count} different JSON outputs survived. Compare before choosing.` :
            count ? "One JSON output found. Inspect it before use." : "No JSON object or array found in these candidate pools.";
    let output = '<section class="magic-json" data-magic-goal-report="true">' + styles +
        "<h2>JSON investigation</h2>" + `<p class="mj-status">${escape(title)}</p>` +
        '<p class="mj-trust"><strong>Decoded, not verified.</strong> Signatures, timestamps and claims remain unverified.</p>';
    if (report.status !== "complete") output += '<div class="mj-warning" role="note"><strong>Check incomplete.</strong> ' +
        "Any results below are checked witnesses, not a complete search. Open scope and coverage for the stopping reason.</div>";
    // A benign first result must not hide an input-level conflict on a later card.
    // With exactly one card, do not repeat its own warning above it.
    const attached = new Set(count === 1 ? report.outputs[0].interpretationWarnings || [] : []);
    output += warnings((report.interpretationWarnings || []).filter(note => !attached.has(note)));
    output += report.outputs.slice(0, 32).map((group, index) => resultCard(group, index, count, context)).join("");
    if (count > 32) output += `<p>Showing 32 of ${count} different checked outputs.</p>`;
    if (!count) output += "<p>Try another decoder, or return to Any for the original general-purpose search. In this combined mode, a crib can exclude otherwise valid JSON.</p>";
    output += '<p class="mj-meta">Recipe links replace only Magic; surrounding steps and input stay unchanged.</p>' +
        `<p><a href="${context.anyUrl}">Return to Any — original general-purpose Magic</a></p>` + original(report, "Original input") +
        '<details id="magic-investigation-coverage"><summary>Scope, coverage and unchecked possibilities</summary>' +
        `<p>Native route: <strong>${escape(report.native.status)}</strong>${report.native.reason ? ` — ${escape(report.native.reason)}` : ""}. ` +
        `${report.native.checked} of ${report.native.total ?? "unknown"} eligible recipes checked; ${report.native.candidates.length} candidates found before crib filtering. Original ranks are retained.</p>` +
        `<p>Wrapper route: <strong>${escape(report.wrappers.status)}</strong>${report.wrappers.reason ? ` — ${escape(report.wrappers.reason)}` : ""}. ` +
        `${report.wrappers.checked ?? 0} of ${report.wrappers.total ?? "unknown"} checks; ${report.wrapperCribExcluded} checked outputs excluded by the crib.</p>` +
        limits + "<p>A crib filters decoded outputs from both routes. Input limit 64 KiB, depth up to 5, output check limit 1 MiB. " +
        "Native evidence: at most 256 recipes / two cooperative seconds. Wrapper evidence: at most three replays / two cooperative seconds. " +
        "Module loading and native discovery are outside those timers; these are not wall-clock guarantees.</p>" +
        scopeNotes(report.interpretationWarnings) + hypotheses(report.wrappers) + "</details></section>";
    return output;
}

/** Focused wrappers retain fields and refusals without implying authentication. */
export function presentJsonWrappers(report, context) {
    const accepted = report.candidates.filter(candidate => candidate.accepted);
    let output = '<section class="magic-json" data-magic-wrapper-report="true">' + styles + "<h2>Look inside the wrapper</h2>" +
        `<p class="mj-status">${accepted.length ? `${accepted.length} checked JSON field${accepted.length === 1 ? "" : "s"}. Inspect the role before use.` :
            "No supported JSON wrapper confirmed by these checks."}</p>` +
        '<p class="mj-trust"><strong>Decoded, not verified.</strong> Signatures, timestamps and claims are not verified.</p>';
    if (report.status !== "complete") output += `<div class="mj-warning" role="note"><strong>Investigation incomplete or unsupported.</strong> ${escape(report.reason || report.status)}</div>`;
    else if (report.reason) output += `<p>${escape(report.reason)}</p>`;
    const attached = new Set(accepted.length === 1 ? accepted[0].interpretationWarnings || [] : []);
    output += warnings((report.interpretationWarnings || []).filter(note => !attached.has(note)));
    for (const [index, candidate] of accepted.entries()) output += resultCard({
        role: candidate.resultRole || "Possible token payload", text: candidate.evidence.text,
        byteLength: candidate.evidence.byteLength ?? new TextEncoder().encode(candidate.evidence.text).byteLength,
        interpretationWarnings: candidate.interpretationWarnings,
        sources: [{...candidate, route: "wrapper"}],
    }, index, accepted.length, context);
    const rejected = report.candidates.filter(candidate => !candidate.accepted);
    if (rejected.length) output += "<details><summary>Other examined interpretations (not confirmed)</summary>" + rejected.map(candidate =>
        `<div class="mj-source"><h3>Possible ${escape(candidate.kind)}</h3><p>Not confirmed: ${escape(candidate.evidence.status)}` +
        `${candidate.headerEvidence ? `; header ${escape(candidate.headerEvidence.status)}` : ""}.</p>` + warnings(candidate.interpretationWarnings) + fields(candidate) + "</div>").join("") + "</details>";
    if (!accepted.length) output += "<p>This focused mode checks recognized container shapes, not arbitrary encodings. Try Any or choose a decoder manually.</p>";
    return output + `<p><a href="${context.anyUrl}">Return to Any — original general-purpose Magic</a></p>` + original(report, "Original container") +
        "<details><summary>Scope, limits and other routes</summary>" + limits +
        "<p>Focused mode does not run generic Magic. Depth, intensive, language and crib settings are not used. No key guessing or signature checking. " +
        "At most three native recipes are replayed against the complete input. Native decoder loading happens before the cooperative two-second evidence budget; it is not a wall-clock guarantee.</p>" +
        scopeNotes(report.interpretationWarnings) + "</details></section>";
}
