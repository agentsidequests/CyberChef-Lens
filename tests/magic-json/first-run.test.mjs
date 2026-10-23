import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync, existsSync} from "node:fs";
import {resolve, dirname} from "node:path";
import {fileURLToPath} from "node:url";
import template from "lodash/template.js";
import Utils from "../../src/core/Utils.mjs";

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
    const attribution = html.match(/<details[^>]*>\s*<summary>Build and licensing<\/summary>[\s\S]*?<\/details>/)?.[0];
    assert.ok(attribution);
    assert.doesNotMatch(attribution.split(">")[0], /\bopen\b/);
    assert.match(attribution, /Crown Copyright/);
    assert.match(attribution, /Apache Licence/);
});

test("the demo opens a same-app document separately with source-bound input", () => {
    const html = read("src/web/html/index.html"), config = read("Gruntfile.js");
    const anchor = html.match(/<a id="lens-guide-demo"[\s\S]*?<\/a>/)?.[0];
    assert.ok(anchor);
    assert.match(anchor, /href="#recipe=Magic\(3,false,false,'','JSON%20payload%20trail'\)/);
    assert.match(anchor, /target="_blank"/);
    assert.match(anchor, /rel="noopener"/);
    assert.doesNotMatch(anchor, /https?:|data-dismiss/);
    assert.match(anchor, /htmlWebpackPlugin\.options\.lensExampleInput/);
    assert.equal((config.match(/lensExampleInput: /g) || []).length, 2, "prod and dev use the same fixture");
    assert.match(config, /readFileSync\("examples\/lens-investigation\.txt"\)/);
});

for (const documentURL of [
    "http://localhost/index.html#recipe=To_Hex()",
    "http://localhost/CyberChef_v11.5.0.html#recipe=To_Hex()",
    "http://localhost/review/nested/CyberChef_v11.5.0.html?view=local#input=cHJldmlvdXM",
    "http://localhost/review/nested/?view=local#recipe=To_Hex()"
]) {
    test(`the demo retains its containing document at ${documentURL}`, () => {
        const anchor = read("src/web/html/index.html").match(/<a id="lens-guide-demo"[\s\S]*?<\/a>/)[0];
        const sample = readFileSync(new URL("examples/lens-investigation.txt", root));
        const rendered = template(anchor)({htmlWebpackPlugin: {options: {lensExampleInput: sample.toString("base64")}}});
        const href = rendered.match(/href="([^"]+)"/)[1].replaceAll("&amp;", "&");
        const original = new URL(documentURL), target = new URL(href, original);
        assert.equal(target.origin, original.origin);
        assert.equal(target.pathname, original.pathname, "renamed and nested entrypoints must stay reachable");
        assert.equal(target.search, original.search, "preserve the serving document's query");
        assert.notEqual(target.hash, original.hash, "use the demo fragment rather than the existing workspace");
        const params = Utils.parseURIParams(target.hash);
        assert.equal(params.recipe, "Magic(3,false,false,'','JSON payload trail')");
        assert.deepEqual(Buffer.from(params.input, "base64"), sample);
        assert.equal(params.ieol, "LF");
        assert.equal(params.oenc, "65001");
        assert.equal(params.oeol, "LF");
    });
}

test("the rendered demo survives CyberChef's native URI parser byte for byte", () => {
    const anchor = read("src/web/html/index.html").match(/<a id="lens-guide-demo"[\s\S]*?<\/a>/)[0];
    const sample = readFileSync(new URL("examples/lens-investigation.txt", root));
    for (const bytes of [sample, Buffer.from([0xfb, 0xff, 0xfe, 0x00])]) {
        const encoded = bytes.toString("base64");
        const rendered = template(anchor)({htmlWebpackPlugin: {options: {lensExampleInput: encoded}}});
        const href = rendered.match(/href="([^"]+)"/)[1].replaceAll("&amp;", "&");
        const params = Utils.parseURIParams(new URL(href, "http://localhost/").hash);
        assert.equal(params.input, encoded, "padding and + must not become a missing parameter or a space");
        assert.deepEqual(Buffer.from(params.input, "base64"), bytes);
    }
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
