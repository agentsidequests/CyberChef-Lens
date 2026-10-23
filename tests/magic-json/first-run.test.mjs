import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync, existsSync} from "node:fs";
import {resolve, dirname} from "node:path";
import {fileURLToPath} from "node:url";

const root = new URL("../../", import.meta.url);
const read = name => readFileSync(new URL(name, root), "utf8");

test("the primary README leads to one investigation before the technical reference", () => {
    const text = read("README.md");
    assert.ok(text.split(/\r?\n/).length <= 135, "keep the entry short; limits live in the linked reference");
    assert.match(text, /Lens guide \/ Help/);
    assert.match(text, /three-layer demo/);
    assert.match(text, /docs\/USAGE\.md/);
    assert.ok(text.indexOf("## Try it") < text.indexOf("## Build"));
    assert.match(text, /unofficial/i);
    assert.match(text, /native operations|manual recipes/i);
    assert.match(text, /not.*authenticat|does not.*verif/i);
});

test("the app's existing help exposes all four real goals without a new state-changing handler", () => {
    const html = read("src/web/html/index.html");
    assert.match(html, /id="support"[^>]+data-target="#support-modal"[^>]*>Lens guide \/ Help/);
    assert.match(html, /id="lens-first-run"/);
    for (const goal of ["Any", "JSON object or array", "JSON wrappers", "JSON payload trail"]) assert.ok(html.includes(`<strong>${goal}</strong>`));
    assert.match(html, /Crib.*not used|not use.*Crib/s);
    assert.match(html, /64 KiB/);
});

test("the demo opens a same-app document separately with source-bound input", () => {
    const html = read("src/web/html/index.html"), config = read("Gruntfile.js");
    const anchor = html.match(/<a id="lens-guide-demo"[\s\S]*?<\/a>/)?.[0];
    assert.ok(anchor);
    assert.match(anchor, /href="index\.html#recipe=Magic\(3,false,false,'','JSON%20payload%20trail'\)/);
    assert.match(anchor, /target="_blank"/);
    assert.match(anchor, /rel="noopener"/);
    assert.doesNotMatch(anchor, /https?:|data-dismiss/);
    assert.match(anchor, /htmlWebpackPlugin\.options\.lensExampleInput/);
    assert.equal((config.match(/lensExampleInput: /g) || []).length, 2, "prod and dev use the same fixture");
    assert.match(config, /readFileSync\("examples\/lens-investigation\.txt"\)/);
});

test("reopening help returns to the guide without changing the working recipe or input", () => {
    const html = read("src/web/html/index.html");
    assert.match(html, /id="support-modal"[^>]*aria-labelledby="support-title"/);
    assert.match(html, /id="support-title">CyberChef Lens/);
    const handler = read("src/web/waiters/ControlsWaiter.mjs").split("supportButtonClick(e) {")[1].split("/**")[0];
    assert.match(handler, /\$\("#tab-1"\)\.tab\("show"\)/);
    assert.match(handler, /querySelectorAll\('a\[data-toggle="collapse"\]'\)/, "FAQ keyboard toggles must not intercept the demo's ordinary link");
    assert.doesNotMatch(handler, /getElementsByTagName\("a"\)/);
    assert.doesNotMatch(handler, /setInput|setRecipe|clearRecipe|localStorage\.set/);
});

test("the compact entry retains working local links and task-level custody", () => {
    for (const name of ["README.md", "docs/USAGE.md"]) {
        const text = read(name);
        for (const match of text.matchAll(/\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
            if (/^(https?:|#)/.test(match[1])) continue;
            const target = resolve(dirname(fileURLToPath(new URL(name, root))), decodeURIComponent(match[1].split("#")[0]));
            assert.ok(existsSync(target), `${name}: ${match[1]}`);
        }
    }
    const guide = read("docs/USAGE.md");
    for (const phrase of ["JSON Beautify", "Lossless strict JSON", "JSON structure (lossless)", "Inspect Lens Evidence", "Magic-step input", "unredacted", "JSON5", "Crib", "64 KiB"]) assert.ok(guide.includes(phrase), phrase);
    assert.match(guide, /no.*signature|not.*authenticat/i);
    assert.match(guide, /(?:not|never|none).*execut/i);
});
