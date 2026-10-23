import {test, before} from "node:test";
import assert from "node:assert/strict";
import log from "loglevel";
import Magic from "../../src/core/operations/Magic.mjs";
import Dish from "../../src/core/Dish.mjs";
import Utils from "../../src/core/Utils.mjs";
import {prepareMagicRecipes, replayMagicRecipe} from "../../src/core/lib/MagicEvidenceReplay.mjs";
import {presentJsonComparison} from "../../src/core/lib/MagicJsonPresentation.mjs";

const group = (text, role) => ({text, role, sources: [{recipe: [], depth: 1, hops: [], warnings: []}]});
before(async () => {
    log.setLevel("silent", false); await prepareMagicRecipes([]);
});

test("the field review exposes changes after the first token without an input-replacement action", () => {
    const html = presentJsonComparison([
        group('{"n":9007199254740992,"role":"viewer"}'),
        group('{"n":9007199254740993,"role":"admin","limit":1e400}')
    ]);
    assert.match(html, /Review field changes/);
    assert.match(html, /3 changes across the compared structure/);
    assert.match(html, /9007199254740992/);
    assert.match(html, /9007199254740993/);
    assert.match(html, /viewer/);
    assert.match(html, /admin/);
    assert.match(html, /1e400/);
    assert.match(html, /Reference · Result 1/);
    assert.match(html, /Compared · Result 2/);
    assert.doesNotMatch(html, /Before source preview|After source preview|href=/);
});

test("inline duplicate occurrences preserve key spelling and exact later values", () => {
    const html = presentJsonComparison([
        group(String.raw`{"n":1,"role":"viewer","\u0072ole":"reviewer"}`),
        group('{"n":2,"role":"viewer","role":"admin"}')
    ]);
    assert.match(html, /3 changes across the compared structure/);
    assert.match(html, /#2/);
    assert.match(html, /Key spelling/);
    assert.match(html, /reviewer/);
    assert.match(html, /admin/);
});

test("inline additions and removals are not filtered or called equality", () => {
    const html = presentJsonComparison([group('{"removed":true}'), group('{"added":false}')]);
    assert.match(html, /2 changes across the compared structure/);
    assert.match(html, /1 added · 1 removed/);
    assert.doesNotMatch(html, /hidden by|checkboxes|Show subtraction/);
});

test("inline detail limits retain complete counts and disclose omitted records", () => {
    const left = JSON.stringify(Array.from({length: 140}, (_, i) => i));
    const right = JSON.stringify(Array.from({length: 140}, (_, i) => i + 1000));
    const html = presentJsonComparison([group(left), group(right)]);
    assert.match(html, /140 changes across the compared structure/);
    assert.match(html, /128 of 140 change records retained/);
    assert.equal((html.match(/class="js-change"/g) || []).length, 128);
});

test("formatting matches and refused texts never receive a contradictory field review", () => {
    for (const right of [' { "n" : 1 } ', " ".repeat(65537), '{"n":1}tail']) {
        const html = presentJsonComparison([group('{"n":1}'), group(right)]);
        assert.doesNotMatch(html, /Review field changes/);
        assert.match(html, /Only insignificant JSON whitespace differs|Not compared/);
    }
});

test("untrusted result labels, paths and later values remain escaped", () => {
    const html = presentJsonComparison([
        group('{"n":1,"<img src=x>":"<script>before</script>"}', '<svg onload="x">'),
        group('{"n":2,"<img src=x>":"<script>after</script>"}', '" onfocus="x')
    ]);
    assert.doesNotMatch(html, /<img|<svg|<script|aria-label="[^"]*" onfocus=/);
    assert.match(html, /&lt;img/);
    assert.match(html, /&lt;script/);
    assert.match(html, /&lt;svg/);
});

test("layer comparison is collapsed and does not invent chronology or a preferred truth", () => {
    const a = group('{"payload":"e30"}', "Outer JSON envelope"), b = group("{}");
    a.sources[0].depth = 1; b.sources[0].depth = 2;
    const html = presentJsonComparison([a, b], true);
    assert.match(html, /Different container\/payload layers are not competing answers/);
    assert.match(html, /not a preferred truth/);
    assert.match(html, /Compared · Result 2 · layer 2/);
    assert.doesNotMatch(html, /class="mj-comparison" open|Before source preview|After source preview/);
});

for (const goal of ["JSON object or array", "JSON wrappers", "JSON payload trail"]) test(`${goal} connects comparison to exact native replay without mutating input`, async () => {
    const left = '{"case":"SUP-5932","n":9007199254740992,"role":"viewer"}';
    const right = '{"case":"SUP-5932","n":9007199254740993,"role":"admin","limit":1e400}';
    const sig = "A".repeat(43), field = (name, text) => `${name}=${Buffer.from(text).toString("base64")}; ${name}.sig=${sig}`;
    const input = `Cookie: ${field("first", left)}; ${field("second", right)}\r\n`;
    const args = [3, false, false, "", goal], operation = new Magic();
    const dish = new Dish(new TextEncoder().encode(input).buffer, Dish.ARRAY_BUFFER);
    await operation.run({dish, progress: 0, opList: [{ingValues: args, config: {op: "Magic", args}}]});
    const report = await dish.get(Dish.JSON), frozen = JSON.stringify(report), html = operation.present();
    assert.match(html, /Review field changes · 3 changes/);
    assert.match(html, /Compared · Result 2/);
    assert.match(html, /role/);
    assert.match(html, /not a preferred truth/);
    assert.equal(report.original, input);
    assert.equal(JSON.stringify(report), frozen, "presenting does not rewrite the investigation");
    const links = [...html.matchAll(/href="#recipe=([^"]+)"/g)].map(match =>
        Utils.parseRecipeConfig(decodeURIComponent(Utils.unescapeHtml(match[1]))));
    const payloads = [];
    for (const recipe of links.filter(recipe => recipe.some(step => step.op === "Regular expression"))) {
        payloads.push(Buffer.from(await replayMagicRecipe(recipe, Buffer.from(input))).toString("utf8"));
    }
    assert.ok(payloads.includes(left)); assert.ok(payloads.includes(right));
});
