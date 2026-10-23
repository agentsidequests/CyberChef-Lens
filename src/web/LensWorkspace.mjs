/**
 * Guided local investigation, isolated from the expert recipe workspace.
 * @author SamuelNotes
 * @license Apache-2.0
 */
import LensWorker from "worker-loader?inline=no-fallback!./workers/LensWorkspaceWorker.mjs";
import Utils from "../core/Utils.mjs";
import {readLensSource} from "../core/lib/LensSource.mjs";
import {presentPayloadTrail} from "../core/lib/MagicJsonPresentation.mjs";
import {lensEvidenceExample, lensSharingExample} from "../core/lib/LensEvidenceExample.mjs";
import {DEFAULT_SHARING_FIELDS} from "../core/lib/LensSharing.mjs";
import {createJsonEvidence} from "../core/lib/MagicJsonExport.mjs";

/** Attach a task surface without changing Input, Recipe, URL or stored options. */
export default function setupLensWorkspace() {
    const opener = document.getElementById("lens-workspace-open");
    const native = document.getElementById("content-wrapper");
    const root = document.createElement("section");
    root.id = "lens-workspace";
    root.hidden = true;
    root.setAttribute("aria-label", "Lens guided workspace");
    root.innerHTML = `<div class="lw-shell">
        <header class="lw-header"><div><span class="lw-brand">CyberChef Lens</span>
        <span class="lw-local">Local · no upload</span></div>
        <button type="button" id="lw-close">Recipe workspace ↗</button></header>
        <main><div class="lw-intro"><p class="lw-eyebrow">GUIDED WORKSPACE</p>
        <h1>Follow the JSON. Keep the evidence.</h1>
        <p>Find JSON in encoded data or a whole copied HTTP request, inspect the cautions, and carry the exact result forward.</p></div>
        <div class="lw-mode" role="group" aria-label="Investigation task">
        <button type="button" id="lw-single" aria-pressed="true">Investigate data</button>
        <button type="button" id="lw-pair" aria-pressed="false">Compare two captures</button>
        <button type="button" id="lw-verify" aria-pressed="false">Verify saved evidence</button></div>
        <p id="lw-verify-note" hidden>Load a complete Lens evidence JSON record in Source A, up to 2 MiB. Lens regenerates supported decoding routes and compares exact payload bytes. Recipes supplied by the file stay inert. A match checks consistency, not authenticity.</p>
        <section class="lw-sources" aria-label="Original sources"></section>
        <div class="lw-run"><button type="button" id="lw-run" class="lw-primary">Find JSON</button>
        <button type="button" id="lw-cancel" hidden>Cancel</button>
        <button type="button" id="lw-demo">Try the fictional example</button>
        <button type="button" id="lw-http-demo">Try an HTTP request</button>
        <button type="button" id="lw-evidence-demo" hidden>Try a saved example</button>
        <button type="button" id="lw-share" hidden>Prepare sharing copy</button>
        <button type="button" id="lw-share-demo" hidden>Try a sharing example</button>
        <details class="lw-depth" id="lw-settings"><summary>Search settings</summary><label for="lw-depth">Layer limit</label>
        <select id="lw-depth"><option>1</option><option>2</option><option selected>3</option><option>4</option><option>5</option></select>
        <p>Default: 3 layers. Recognized profiles only, up to 64 KiB per source. Increasing depth does not increase trust.</p></details></div>
        <section id="lw-sharing" class="lw-report" aria-label="Sharing rules" hidden>
        <h2>Choose what to redact</h2>
        <p>The copy omits the complete original input, every recipe, source coordinates, investigation metadata and saved warnings. Only the modified payload and generic copy information are included. Originals stay unchanged.</p>
        <div class="lw-sharing-rules"><div><label for="lw-share-fields">Member names to redact</label>
        <p class="lw-source-note">One per line. Case, spaces, hyphens and underscores are ignored. Whole values or subtrees are replaced.</p>
        <textarea id="lw-share-fields" spellcheck="false"></textarea></div>
        <div><label for="lw-share-literals">Exact text to remove</label>
        <p class="lw-source-note">One per line; edge spaces are trimmed. Case-sensitive substrings in decoded strings/keys, or exact number/boolean/null tokens. Whole matching values are replaced.</p>
        <textarea id="lw-share-literals" spellcheck="false" placeholder="Optional: a name, identifier or credential…"></textarea></div></div>
        <p class="lw-source-note">At most 64 rules of 128 characters per list. Payload limit: 64 KiB, 16,384 tokens and 64 nested containers. Nothing is truncated. Rules can miss unknown or encoded sensitive content; review the entire copy.</p>
        </section>
        <p id="lw-status" role="status" aria-live="polite">Choose a file or paste data, then find JSON. Nothing runs while you type.</p>
        <p class="lw-footnote">Sources stay in this tab's memory and clear on reload. Decoding does not authenticate a signature, sender or claim.</p>
        <section id="lw-results" aria-label="Investigation results"></section>
        </main></div>`;
    document.body.appendChild(root);
    const get = id => root.querySelector(`#${id}`);
    const status = message => {
        get("lw-status").textContent = message;
    };
    const sources = [{text: "", revision: 0}, {text: "", revision: 0}];
    let pair = false, verifying = false, reports = [], worker = null, job = 0, sharingRecord = null, sharingLabel = null;
    get("lw-share-fields").value = DEFAULT_SHARING_FIELDS;

    /** Stop CPU work and reject any late reply before changing a source. */
    function stop() {
        job++;
        if (worker) worker.terminate();
        worker = null;
        get("lw-cancel").hidden = true;
        get("lw-run").disabled = false;
        get("lw-share").disabled = false;
        get("lw-results").removeAttribute("aria-busy");
    }

    /** A source or mode change invalidates every dependent result. */
    function invalidate(clearSharing=true) {
        stop(); reports = [];
        if (clearSharing) {
            sharingRecord = null; sharingLabel = null; get("lw-sharing").hidden = true;
            get("lw-share").hidden = !verifying; get("lw-share").textContent = "Prepare sharing copy";
        }
        get("lw-results").replaceChildren();
        status("Sources or settings changed. Run the task again to refresh results.");
    }

    /** Keep raw file text separate from textarea newline normalization. */
    function sourceNote(index, label) {
        get(`lw-note-${index}`).textContent = `${label} · ${new TextEncoder().encode(sources[index].text).length} bytes`;
    }

    /** Validate before replacing an existing source; reject late file reads. */
    async function loadFile(file, index) {
        const revision = ++sources[index].revision;
        try {
            if (!file) return;
            const limit = verifying ? 2097152 : 65536;
            if (file.size > limit) throw new RangeError(`Each source is limited to ${verifying ? "2 MiB" : "64 KiB"}. The file was not shortened.`);
            const text = readLensSource(await file.arrayBuffer(), limit);
            if (revision !== sources[index].revision) return;
            invalidate(); sources[index].text = text;
            get(`lw-input-${index}`).value = text;
            sourceNote(index, `${file.name} · original UTF-8 text retained; editing creates a new source`);
            status(`Source ${index ? "B" : "A"} loaded. Choose ${verifying ? "Check saved evidence" : "Find JSON"} when ready.`);
        } catch (error) {
            if (revision === sources[index].revision) status(`${error.message} Previous source retained.`);
        }
    }

    sources.forEach((source, index) => {
        const panel = document.createElement("section");
        panel.className = "lw-source";
        panel.id = `lw-source-${index}`;
        panel.innerHTML = `<div class="lw-source-title"><label for="lw-input-${index}">Source ${index ? "B" : "A"}</label>
            <button type="button" id="lw-clear-${index}">Clear</button></div>
            <textarea id="lw-input-${index}" spellcheck="false" placeholder="Paste JSON, encoded data, or a complete HTTP/1.x request…" aria-describedby="lw-note-${index}"></textarea>
            <label class="lw-file">Choose a UTF-8 file<input type="file" id="lw-file-${index}" aria-label="Choose source ${index ? "B" : "A"} file"></label>
            <p class="lw-source-note" id="lw-note-${index}">Or drop one text file here · 64 KiB maximum</p>`;
        root.querySelector(".lw-sources").appendChild(panel);
        panel.hidden = index === 1;
        get(`lw-input-${index}`).addEventListener("input", event => {
            sources[index].revision++; invalidate(); source.text = event.target.value;
            sourceNote(index, "Edited text");
        });
        get(`lw-file-${index}`).addEventListener("change", event => {
            loadFile(event.target.files[0], index); event.target.value = "";
        });
        get(`lw-clear-${index}`).addEventListener("click", () => {
            sources[index].revision++; invalidate(); source.text = "";
            get(`lw-input-${index}`).value = ""; sourceNote(index, "Empty source");
        });
        panel.addEventListener("dragover", event => {
            event.preventDefault(); panel.classList.add("lw-dropping");
        });
        panel.addEventListener("dragleave", () => panel.classList.remove("lw-dropping"));
        panel.addEventListener("drop", event => {
            event.preventDefault(); event.stopPropagation(); panel.classList.remove("lw-dropping");
            if (event.dataTransfer.files.length !== 1) status("Drop one UTF-8 text file into each source.");
            else loadFile(event.dataTransfer.files[0], index);
        });
    });

    /** Open a recipe with its complete original input only after an explicit click. */
    function recipeUrl(recipe, original) {
        const bytes = new TextEncoder().encode(original);
        let binary = "";
        for (const byte of bytes) binary += String.fromCharCode(byte);
        // Carry exact original bytes through native input-editor newline handling.
        const carrier = btoa(binary);
        const fullRecipe = [{op: "From Base64", args: ["A-Za-z0-9+/=", true, false]}, ...recipe];
        return Utils.escapeHtml("#recipe=" + Utils.encodeURIFragment(Utils.generatePrettyRecipe(fullRecipe)) +
            "&input=" + btoa(carrier).replace(/=+$/, "") + "&ieol=LF&oenc=65001");
    }

    /** Render the existing checked cards; source labels and layer choices stay explicit. */
    function showReports() {
        const target = get("lw-results");
        target.replaceChildren();
        reports.forEach((report, index) => {
            const section = document.createElement("section");
            section.className = "lw-report";
            const heading = document.createElement("h2");
            heading.tabIndex = -1;
            heading.textContent = `Source ${index ? "B" : "A"} · ${report.outputs.length} JSON layer${report.outputs.length === 1 ? "" : "s"}`;
            section.appendChild(heading);
            const content = document.createElement("div");
            content.innerHTML = presentPayloadTrail(report, {
                recipeUrl: recipe => recipeUrl(recipe, report.original),
                anyUrl: recipeUrl([{op: "Magic", args: [3, false, false, "", "Any"]}], report.original)
            });
            content.querySelectorAll('a[href^="#recipe="]').forEach(link => {
                link.target = "_blank"; link.rel = "noopener";
                link.title = "Open this recipe with the original source in a new tab";
            });
            content.querySelectorAll(".mj-action-note").forEach(note => {
                note.textContent = "Opens a recipe with this source in a new tab.";
            });
            content.querySelectorAll(".mj-meta").forEach(note => {
                if (note.textContent.startsWith("Depth sets")) note.textContent = "The layer limit comes from Search settings. Only recognized profiles are followed.";
            });
            section.appendChild(content); target.appendChild(section);
            if (report.outputs.length) {
                const sharing = document.createElement("div"); sharing.className = "lw-result-share";
                const label = document.createElement("label"); label.textContent = `Source ${index ? "B" : "A"} result to share `;
                const select = document.createElement("select"); select.id = `lw-share-choice-${index}`;
                report.outputs.forEach((group, value) => {
                    const option = document.createElement("option"); option.value = value;
                    option.textContent = `Result ${value + 1} · ${group.byteLength} bytes`; select.appendChild(option);
                });
                label.appendChild(select); sharing.appendChild(label);
                const button = document.createElement("button"); button.type = "button";
                button.textContent = `Prepare sharing copy from Source ${index ? "B" : "A"}`;
                button.addEventListener("click", () => {
                    try {
                        const selected = Number(select.value);
                        previewSharing(createJsonEvidence(report.outputs[selected], {report, mode: "JSON payload trail", index: selected, count: report.outputs.length}),
                            `Source ${index ? "B" : "A"} · result ${selected + 1}`);
                    } catch (error) {
                        status(error.message);
                    }
                });
                sharing.appendChild(button); section.appendChild(sharing);
            }
        });
        if (pair && reports.every(report => report.outputs.length)) {
            const controls = document.createElement("section");
            controls.className = "lw-compare";
            controls.innerHTML = "<h2>Compare selected JSON layers</h2><p>Choose one result from each source. The first listed layer is a starting selection, not a preferred truth.</p>";
            controls.querySelector("h2").tabIndex = -1;
            reports.forEach((report, index) => {
                const label = document.createElement("label");
                label.textContent = `Source ${index ? "B" : "A"} layer `;
                const select = document.createElement("select");
                select.id = `lw-choice-${index}`;
                report.outputs.forEach((group, value) => {
                    const option = document.createElement("option");
                    option.value = value;
                    const source = group.sources[0];
                    option.textContent = `Result ${value + 1}: ${source.httpOrigin ? source.httpOrigin.field + " · " : ""}layer ${source.depth} · ${group.byteLength} bytes · ${source.kind || "original JSON"}`;
                    select.appendChild(option);
                });
                select.addEventListener("change", () => {
                    stop(); get("lw-comparison").replaceChildren(); status("Layer selection changed. Compare again to refresh the comparison.");
                });
                label.appendChild(select); controls.appendChild(label);
            });
            const button = document.createElement("button");
            button.type = "button"; button.textContent = "Compare selected layers"; button.className = "lw-primary";
            button.addEventListener("click", () => run("lensCompare", reports.map((report, index) => report.outputs[Number(get(`lw-choice-${index}`).value)].text)));
            controls.appendChild(button);
            const comparison = document.createElement("div"); comparison.id = "lw-comparison"; controls.appendChild(comparison);
            target.prepend(controls);
        }
        status(`${reports.map((report, index) => `Source ${index ? "B" : "A"}: ${report.outputs.length} JSON layer(s), ${report.httpRequest?.status === "unsupported" ? "HTTP import refused" : report.status}${report.depthLimited ? ", layer limit reached" : ""}`).join(". ")}. Inspect the cautions before using a result.`);
        target.scrollIntoView({block: "start"});
        target.querySelector("h2").focus({preventScroll: true});
    }

    /** Render only the newly constructed copy; no original record becomes a link. */
    function showSharing(result) {
        const section = document.createElement("section"); section.className = "lw-report";
        section.innerHTML = '<h2 tabindex="-1">Review sharing copy</h2><p class="lw-sharing-origin"></p><p class="lw-sharing-count"></p>' +
            "<p>This is a modified sharing copy, not replayable evidence. Original input, recipes, coordinates, metadata, warnings and rule text are omitted. Original sources and evidence stay unchanged.</p>" +
            "<p>Review every field below. Rules can miss sensitive names, values and encoded content. A replacement count is not a privacy guarantee.</p>" +
            '<label for="lw-sharing-payload">Payload in this sharing copy — complete</label><textarea id="lw-sharing-payload" readonly spellcheck="false"></textarea>' +
            '<p><a class="lw-share-download" download="CyberChef-Lens-sharing-copy.json">Download sharing copy</a></p>' +
            '<details><summary>Complete sharing JSON and manual copy</summary><label for="lw-sharing-json">Complete sharing JSON</label><textarea id="lw-sharing-json" readonly spellcheck="false"></textarea>' +
            '<p class="lw-source-note">The entire copy is shown. You can select all and copy this text if downloading is unavailable. It is separate from the original evidence.</p></details>';
        section.querySelector(".lw-sharing-origin").textContent = `Copy source: ${sharingLabel}.`;
        section.querySelector(".lw-sharing-count").textContent = result.counts.total ?
            `${result.counts.values} value/subtree replacements · ${result.counts.keys} key replacements · ${result.payloadBytes} modified-payload bytes.` :
            "No values or keys matched these rules. The payload still contains all its original values. Review it or add rules before sharing.";
        section.querySelector(".lw-share-download").href = "data:application/json;charset=utf-8," + encodeURIComponent(result.text);
        section.querySelector("#lw-sharing-payload").value = JSON.parse(result.text).payload.text;
        section.querySelector("#lw-sharing-json").value = result.text;
        get("lw-results").replaceChildren(section);
        status(`Sharing preview ready: ${result.counts.total} replacements. Review the complete copy; the original is unchanged.`);
        section.scrollIntoView({block: "start"}); section.querySelector("h2").focus({preventScroll: true});
    }

    /** A selected-result record is retained separately from Source A/B. */
    function previewSharing(text, label=sharingLabel || "Saved record in Source A") {
        invalidate(false); sharingRecord = text; sharingLabel = label;
        get("lw-sharing").hidden = false; get("lw-share").hidden = false;
        get("lw-share").textContent = "Refresh sharing copy";
        run("lensShare", [text]);
    }

    /** A worker per job provides cancellation and isolates the original recipe. */
    function run(action, texts) {
        stop();
        const id = job;
        worker = new LensWorker();
        get("lw-run").disabled = true; get("lw-cancel").hidden = false;
        get("lw-share").disabled = true;
        get("lw-results").setAttribute("aria-busy", "true");
        status("Working locally… Cancel remains available while native modules load and the bounded check runs.");
        const fail = message => {
            if (id !== job) return; stop(); status(message);
        };
        worker.addEventListener("error", () => fail("The worker could not finish. Your sources are retained. Try again or open the recipe workspace."));
        worker.addEventListener("message", event => {
            const message = event.data;
            if (id !== job || message.id !== id) return;
            if (message.action === "lensError") fail(message.error);
            if (message.action !== "lensComplete") return;
            stop();
            if (action === "lensShare") {
                showSharing(message.result);
            } else if (action === "lensCompare") {
                get("lw-comparison").innerHTML = message.result.html;
                status(`Comparison complete: ${message.result.report.total} change records across the selected layers.`);
                get("lw-comparison").scrollIntoView({block: "start"});
            } else if (action === "lensVerify") {
                get("lw-results").innerHTML = message.result.html;
                const counts = message.result.counts;
                status(`Saved replay check: ${counts.matched} matched, ${counts.mismatched} differed, ${counts.unreproduced} not reproduced. This checks consistency, not authenticity.`);
                const heading = get("lw-results").querySelector("h2");
                heading.tabIndex = -1; heading.focus();
                get("lw-results").scrollIntoView({block: "start"});
            } else {
                reports = message.result; showReports();
            }
        });
        worker.postMessage({action: "docURL", data: document.location.href.split(/[#?]/)[0].replace(/\/[^/]*$/, "")});
        worker.postMessage({action, id, sources: texts, depth: Number(get("lw-depth").value),
            sharing: action === "lensShare" ? {memberNames: get("lw-share-fields").value, exactText: get("lw-share-literals").value} : undefined});
    }

    /** Switch task while retaining both source texts for deliberate reuse. */
    function setMode(value) {
        pair = value === "compare"; verifying = value === "verify";
        sources.forEach(source => source.revision++);
        invalidate(); get("lw-source-1").hidden = !pair;
        get("lw-single").setAttribute("aria-pressed", String(!pair && !verifying));
        get("lw-pair").setAttribute("aria-pressed", String(pair));
        get("lw-verify").setAttribute("aria-pressed", String(verifying));
        get("lw-verify-note").hidden = !verifying;
        get("lw-evidence-demo").hidden = !verifying;
        get("lw-share-demo").hidden = !verifying;
        for (const id of ["lw-demo", "lw-http-demo", "lw-settings"]) get(id).hidden = verifying;
        get("lw-input-0").placeholder = verifying ? "Paste one complete saved Lens evidence JSON record…" : "Paste JSON, encoded data, or a complete HTTP/1.x request…";
        sources.forEach((source, index) => {
            sourceNote(index, `Retained source · ${verifying ? "2 MiB evidence record" : "64 KiB source"} limit; choose a new file or edit to replace`);
        });
        get("lw-run").textContent = verifying ? "Check saved evidence" : pair ? "Find JSON in both sources" : "Find JSON";
        status(verifying ? "Load saved evidence or try the saved example, then check it. Nothing runs while you type." : "Choose a file or paste data, then find JSON.");
    }
    get("lw-single").addEventListener("click", () => setMode("investigate"));
    get("lw-pair").addEventListener("click", () => setMode("compare"));
    get("lw-verify").addEventListener("click", () => setMode("verify"));
    get("lw-share").addEventListener("click", () => previewSharing(sharingRecord ?? sources[0].text));
    for (const id of ["lw-share-fields", "lw-share-literals"]) get(id).addEventListener("input", () => invalidate(false));
    get("lw-depth").addEventListener("change", invalidate);
    get("lw-run").addEventListener("click", () => {
        invalidate(); run(verifying ? "lensVerify" : "lensInvestigate", sources.slice(0, pair ? 2 : 1).map(source => source.text));
    });
    get("lw-cancel").addEventListener("click", () => {
        stop(); status("Cancelled. Sources retained; no new completed result is claimed.");
    });
    get("lw-demo").addEventListener("click", () => {
        setMode("investigate"); sources[0].revision++;
        const encoded = new URLSearchParams(document.getElementById("lens-guide-demo").hash.slice(1)).get("input");
        sources[0].text = readLensSource(Uint8Array.from(atob(encoded), char => char.charCodeAt(0)));
        get("lw-input-0").value = sources[0].text;
        sourceNote(0, "Fictional three-layer sample · fabricated signatures");
        get("lw-depth").value = "3";
        status("Fictional example loaded. Choose Find JSON to follow its three layers.");
    });
    get("lw-http-demo").addEventListener("click", () => {
        setMode("investigate"); sources[0].revision++;
        const payload = '{"case":"HTTP-204","status":"queued"}';
        const token = btoa('{"alg":"HS256"}').replace(/=+$/, "") + "." + btoa(payload).replace(/=+$/, "") + "." + "A".repeat(43);
        const body = '{"case":"HTTP-204","status":"released"}\n';
        sources[0].text = "POST /jobs HTTP/1.1\nHost: example.invalid\nAuthorization: Bearer " + token +
            "\nContent-Type: application/json\nContent-Length: " + new TextEncoder().encode(body).length + "\n\n" + body;
        get("lw-input-0").value = sources[0].text;
        sourceNote(0, "Fictional HTTP request · fabricated signature · header and body deliberately disagree");
        get("lw-depth").value = "3";
        status("HTTP example loaded. Find JSON to inspect the Authorization payload and body as separate results.");
    });
    get("lw-evidence-demo").addEventListener("click", () => {
        setMode("verify"); sources[0].text = lensEvidenceExample();
        get("lw-input-0").value = sources[0].text;
        sourceNote(0, "Fictional saved record · edit it to try a changed claim");
        status("Saved example loaded. Choose Check saved evidence to compare its replay with the saved payload.");
    });
    get("lw-share-demo").addEventListener("click", () => {
        setMode("verify"); sources[0].text = lensSharingExample();
        get("lw-input-0").value = sources[0].text;
        get("lw-share-fields").value = DEFAULT_SHARING_FIELDS; get("lw-share-literals").value = "";
        sourceNote(0, "Fictional sharing example · invented token and identity");
        previewSharing(sources[0].text, "Fictional sharing example in Source A");
    });
    opener.addEventListener("click", () => {
        native.hidden = true; root.hidden = false; get("lw-input-0").focus();
    });
    const close = () => {
        if (worker) status("Cancelled while leaving the workspace. Sources retained; choose the task action to run again.");
        stop(); root.hidden = true; native.hidden = false; opener.focus();
    };
    get("lw-close").addEventListener("click", close);
    root.addEventListener("keydown", event => {
        if (event.key === "Escape") close();
        event.stopPropagation();
    });
    root.addEventListener("dragover", event => event.preventDefault());
    root.addEventListener("drop", event => {
        event.preventDefault(); event.stopPropagation();
        status("Drop one UTF-8 text file into a Source area.");
    });
}
