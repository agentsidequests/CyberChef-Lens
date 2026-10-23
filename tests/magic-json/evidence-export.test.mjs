import {test} from "node:test";
import assert from "node:assert/strict";
import log from "loglevel";
import Magic from "../../src/core/operations/Magic.mjs";
import Dish from "../../src/core/Dish.mjs";
import Utils from "../../src/core/Utils.mjs";
import {replayMagicRecipe} from "../../src/core/lib/MagicEvidenceReplay.mjs";
import {createJsonEvidence, JSON_EXPORT_BYTES} from "../../src/core/lib/MagicJsonExport.mjs";
import {presentPayloadTrail} from "../../src/core/lib/MagicJsonPresentation.mjs";

log.setLevel("silent", false);
const payload = ' {"n":9007199254740993,"role":"viewer","\\u0072ole":"admin","note":"海 😀 <img onerror=x>"}\r\n';
const encode = text => Buffer.from(text).toString("base64url");
const input = `Authorization: Bearer ${encode('{"alg":"HS256"}')}.${encode(payload)}.${"A".repeat(43)}\r\n`;

/** Exercise real operation presentation, not a fixture-only serializer. */
async function run(goal, value=input) {
    const args = [3, false, false, "", goal], operation = new Magic();
    const dish = new Dish(new TextEncoder().encode(value).buffer, Dish.ARRAY_BUFFER);
    await operation.run({dish, progress: 1, opList: [
        {config: {op: "From Hex", args: ["Auto"]}},
        {ingValues: args, config: {op: "Magic", args}},
        {config: {op: "To Base64", args: ["A-Za-z0-9+/="]}}
    ]});
    return {html: operation.present(await dish.get(Dish.JSON)), report: await dish.get(Dish.JSON)};
}

/** Decode the actual download URI; JSON strings must preserve the evidence. */
function downloads(html) {
    return [...html.matchAll(/<a\b[^>]*href="(data:application\/json[^"]+)"[^>]*download="([^"]+)"[^>]*>/g)].map(match => ({
        name: match[2], text: decodeURIComponent(Utils.unescapeHtml(match[1]).split(",").slice(1).join(","))
    }));
}

for (const goal of ["JSON wrappers", "JSON payload trail", "JSON object or array"]) {
    test(`${goal}: save exact JSON and replayable unverified evidence without surrounding operations`, async () => {
        const {html} = await run(goal);
        assert.match(html, /<details class="mj-export"><summary>Save this result<\/summary>/);
        assert.doesNotMatch(html, /<details class="mj-export" open/);
        assert.ok(html.indexOf("unredacted") < html.indexOf("Download evidence JSON"));
        const files = downloads(html), exact = files.find(file => file.name.endsWith("-payload.json"));
        assert.equal(exact?.text, payload);
        const snapshot = JSON.parse(files.find(file => file.name.endsWith("-evidence.json")).text);
        assert.equal(snapshot.format, "cyberchef-lens-evidence");
        assert.equal(snapshot.formatVersion, 1);
        assert.equal(snapshot.input.text, input);
        assert.match(snapshot.input.scope, /this Magic step/);
        assert.equal(snapshot.result.text, payload);
        assert.equal(snapshot.result.byteLength, Buffer.byteLength(payload));
        assert.equal(snapshot.result.parsingCautions.total, 2);
        assert.ok(snapshot.result.warnings.some(note => /not|unverified/i.test(note)));
        assert.equal(snapshot.investigation.mode, goal);
        assert.ok(snapshot.result.routes.length);
        for (const route of snapshot.result.routes) {
            assert.notEqual(route.recipe[0]?.op, "From Hex");
            assert.notEqual(route.recipe.at(-1)?.op, "To Base64");
            assert.equal(Buffer.from(await replayMagicRecipe(route.recipe, Buffer.from(snapshot.input.text))).toString(), payload);
        }
        assert.doesNotMatch(html, /<img|<script|<svg/i);
    });
}

test("a refused wrapper has no misleading result download", async () => {
    const {html} = await run("JSON wrappers", "Bearer opaque-credential");
    assert.equal(downloads(html).length, 0);
    assert.doesNotMatch(html, /Save this result/);
});

test("a one-layer trail uses the singular layer label", async () => {
    const {html} = await run("JSON payload trail");
    assert.match(html, /Follow the decoding trail · 1 layer<\/summary>/);
    assert.doesNotMatch(html, /1 layers/);
});

const group = (text="{}") => ({text, byteLength: Buffer.byteLength(text), sources: [
    {depth: 0, recipe: [], hops: [], warnings: ["First route warning"]},
    {depth: 1, recipe: [], hops: [], warnings: ["Alternative route warning"]}
]});
const report = outputs => ({original: "{}", outputs, status: "incomplete", reason: "state-limit",
    nodes: [], stops: [{node: 0, reason: "state-limit", detail: '<img onerror="x">'}],
    checkedReplays: 7, retainedBytes: 10, depthLimited: true,
    limits: {maxDepth: 1, maxStates: 16, maxReplays: 64, maxRetainedBytes: 2097152, maxOutputBytes: 1048576, maxMillis: 3000}});
const context = {recipeUrl: () => "#recipe=", anyUrl: "#recipe=Magic()"};

test("a snapshot preserves partial coverage, all routes and warnings without claiming a preferred result", () => {
    const value = group(), source = report([value, group('{"other":1}')]);
    const snapshot = JSON.parse(createJsonEvidence(value, {report: source, mode: "JSON payload trail", index: 0, count: 2}));
    assert.equal(snapshot.investigation.status, "incomplete");
    assert.equal(snapshot.investigation.reason, "state-limit");
    assert.equal(snapshot.investigation.depthLimited, true);
    assert.deepEqual(snapshot.investigation.stops, source.stops);
    assert.deepEqual(snapshot.investigation.limits, source.limits);
    assert.equal(snapshot.investigation.retainedResultCount, 2);
    assert.equal(snapshot.result.routes.length, 2);
    assert.ok(snapshot.result.warnings.includes("Alternative route warning"));
    assert.match(snapshot.notice, /Other results are not included/);
    assert.match(snapshot.notice, /not a preferred truth/);
    assert.equal(snapshot.result.parsingCautions.status, "complete");
    assert.equal(snapshot.result.parsingCautions.total, 0);
});

test("unavailable exact input refuses evidence, not the payload or existing recipe", () => {
    const value = group(), source = {...report([value]), original: undefined};
    assert.throws(() => createJsonEvidence(value, {report: source, mode: "JSON payload trail", index: 0, count: 1}), /Exact UTF-8 input/);
    const html = presentPayloadTrail(source, context), files = downloads(html);
    assert.equal(files.length, 1);
    assert.equal(files[0].text, "{}");
    assert.match(html, /Evidence download unavailable/);
    assert.match(html, /Keep original JSON/);
});

test("large payloads retain exact download and a truthful uninspected caution status", () => {
    const value = group(JSON.stringify({note: "a".repeat(70000)}));
    const snapshot = JSON.parse(createJsonEvidence(value, {report: report([value]), mode: "JSON payload trail", index: 0, count: 1}));
    assert.equal(snapshot.result.text, value.text);
    assert.equal(snapshot.result.parsingCautions.status, "not-inspected");
    assert.match(snapshot.result.parsingCautions.reason, /64 KiB/);
});

test("the shared 2 MiB download budget refuses rather than truncates or removes results", () => {
    const values = Array.from({length: 4}, (_, index) => group(JSON.stringify({index, text: "a".repeat(600000)})));
    const html = presentPayloadTrail(report(values), context), files = downloads(html);
    assert.ok(files.reduce((sum, file) => sum + Buffer.byteLength(file.text), 0) <= JSON_EXPORT_BYTES);
    assert.ok(files.length < 8);
    assert.ok(files.every(file => file.text === values.find(value => file.text === value.text)?.text || JSON.parse(file.text).formatVersion === 1));
    assert.match(html, /No partial file is offered/);
    assert.equal((html.match(/<article class="mj-card">/g) || []).length, 4);
    assert.doesNotMatch(html, /<img|<script|<svg/i);
});

test("an oversize snapshot or too many routes never silently drops evidence", () => {
    const tooMany = {...group(), sources: Array.from({length: 65}, () => group().sources[0])};
    assert.throws(() => createJsonEvidence(tooMany, {report: report([tooMany]), mode: "JSON payload trail", index: 0, count: 1}), /no routes are silently omitted/);
    const huge = group(JSON.stringify({text: "\u0001".repeat(400000)}));
    assert.throws(() => createJsonEvidence(huge, {report: report([huge]), mode: "JSON payload trail", index: 0, count: 1}), /not truncated/);
});

test("Any keeps its native presentation without export controls or stale evidence", async () => {
    const {html} = await run("Any", "plain text");
    assert.doesNotMatch(html, /Save this result|cyberchef-lens-evidence|data:application\/json/);
});
