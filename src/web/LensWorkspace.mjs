/**
 * Guided local investigation, isolated from the expert recipe workspace.
 * @author SamuelNotes
 * @license Apache-2.0
 */
import LensWorker from "worker-loader?inline=no-fallback!./workers/LensWorkspaceWorker.mjs";
import Utils from "../core/Utils.mjs";
import {readLensSource} from "../core/lib/LensSource.mjs";
import {presentPayloadTrail} from "../core/lib/MagicJsonPresentation.mjs";

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
        <p>Find JSON inside supported encoded layers, inspect the cautions, and carry the exact result forward.</p></div>
        <div class="lw-mode" role="group" aria-label="Investigation task">
        <button type="button" id="lw-single" aria-pressed="true">Investigate data</button>
        <button type="button" id="lw-pair" aria-pressed="false">Compare two captures</button></div>
        <section class="lw-sources" aria-label="Original sources"></section>
        <div class="lw-run"><button type="button" id="lw-run" class="lw-primary">Find JSON</button>
        <button type="button" id="lw-cancel" hidden>Cancel</button>
        <button type="button" id="lw-demo">Try the fictional example</button>
        <details class="lw-depth"><summary>Search settings</summary><label for="lw-depth">Layer limit</label>
        <select id="lw-depth"><option>1</option><option>2</option><option selected>3</option><option>4</option><option>5</option></select>
        <p>Default: 3 layers. Recognized profiles only, up to 64 KiB per source. Increasing depth does not increase trust.</p></details></div>
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
    let pair = false, reports = [], worker = null, job = 0;

    /** Stop CPU work and reject any late reply before changing a source. */
    function stop() {
        job++;
        if (worker) worker.terminate();
        worker = null;
        get("lw-cancel").hidden = true;
        get("lw-run").disabled = false;
        get("lw-results").removeAttribute("aria-busy");
    }

    /** A source or mode change invalidates every dependent result. */
    function invalidate() {
        stop(); reports = [];
        get("lw-results").replaceChildren();
        status("Sources changed. Find JSON again to refresh results.");
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
            if (file.size > 65536) throw new RangeError("Each source is limited to 64 KiB. The file was not shortened.");
            const text = readLensSource(await file.arrayBuffer());
            if (revision !== sources[index].revision) return;
            invalidate(); sources[index].text = text;
            get(`lw-input-${index}`).value = text;
            sourceNote(index, `${file.name} · original UTF-8 text retained; editing creates a new source`);
            status(`Source ${index ? "B" : "A"} loaded. Choose Find JSON when ready.`);
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
            <textarea id="lw-input-${index}" spellcheck="false" placeholder="Paste JSON, an encoded string, or a supported copied field…" aria-describedby="lw-note-${index}"></textarea>
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
                    option.textContent = `Result ${value + 1}: layer ${group.sources[0].depth} · ${group.byteLength} bytes · ${group.sources[0].kind || "original JSON"}`;
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
        status(`${reports.map((report, index) => `Source ${index ? "B" : "A"}: ${report.outputs.length} JSON layer(s), ${report.status}${report.depthLimited ? ", layer limit reached" : ""}`).join(". ")}. Inspect the cautions before using a result.`);
        target.scrollIntoView({block: "start"});
        target.querySelector("h2").focus({preventScroll: true});
    }

    /** A worker per job provides cancellation and isolates the original recipe. */
    function run(action, texts) {
        stop();
        const id = job;
        worker = new LensWorker();
        get("lw-run").disabled = true; get("lw-cancel").hidden = false;
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
            if (action === "lensCompare") {
                get("lw-comparison").innerHTML = message.result.html;
                status(`Comparison complete: ${message.result.report.total} change records across the selected layers.`);
                get("lw-comparison").scrollIntoView({block: "start"});
            } else {
                reports = message.result; showReports();
            }
        });
        worker.postMessage({action: "docURL", data: document.location.href.split(/[#?]/)[0].replace(/\/[^/]*$/, "")});
        worker.postMessage({action, id, sources: texts, depth: Number(get("lw-depth").value)});
    }

    /** Switch task while retaining both source texts for deliberate reuse. */
    function setMode(value) {
        pair = value; invalidate(); get("lw-source-1").hidden = !pair;
        get("lw-single").setAttribute("aria-pressed", String(!pair));
        get("lw-pair").setAttribute("aria-pressed", String(pair));
        get("lw-run").textContent = pair ? "Find JSON in both sources" : "Find JSON";
    }
    get("lw-single").addEventListener("click", () => setMode(false));
    get("lw-pair").addEventListener("click", () => setMode(true));
    get("lw-depth").addEventListener("change", invalidate);
    get("lw-run").addEventListener("click", () => {
        invalidate(); run("lensInvestigate", sources.slice(0, pair ? 2 : 1).map(source => source.text));
    });
    get("lw-cancel").addEventListener("click", () => {
        stop(); status("Cancelled. Sources retained; no new completed result is claimed.");
    });
    get("lw-demo").addEventListener("click", () => {
        setMode(false); sources[0].revision++;
        const encoded = new URLSearchParams(document.getElementById("lens-guide-demo").hash.slice(1)).get("input");
        sources[0].text = readLensSource(Uint8Array.from(atob(encoded), char => char.charCodeAt(0)));
        get("lw-input-0").value = sources[0].text;
        sourceNote(0, "Fictional three-layer sample · fabricated signatures");
        get("lw-depth").value = "3";
        status("Fictional example loaded. Choose Find JSON to follow its three layers.");
    });
    opener.addEventListener("click", () => {
        native.hidden = true; root.hidden = false; get("lw-input-0").focus();
    });
    const close = () => {
        if (worker) status("Cancelled while leaving the workspace. Sources retained; choose Find JSON to run again.");
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
