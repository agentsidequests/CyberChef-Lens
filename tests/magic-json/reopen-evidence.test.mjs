import {test} from "node:test";
import assert from "node:assert/strict";
import InspectLensEvidence from "../../src/core/operations/InspectLensEvidence.mjs";
import Dish from "../../src/core/Dish.mjs";
import Utils from "../../src/core/Utils.mjs";
import {createJsonEvidence} from "../../src/core/lib/MagicJsonExport.mjs";
import {inspectLensEvidence} from "../../src/core/lib/LensEvidence.mjs";

const payload = ' {"account":9007199254740993,"role":"viewer","\\u0072ole":"admin","note":"海 😀 <img onerror=x>"}\r\n';
const original = "fictional-original\r\n";
const record = () => createJsonEvidence({text: payload, sources: [{recipe: [{op: "HTTP request", args: ["https://example.invalid/never-run"]}], warnings: ["Saved warning"]}]},
    {report: {original, status: "incomplete", reason: "state-limit"}, mode: "JSON wrappers", index: 0, count: 2});

/** Run the real flow-control operation with its surrounding recipe preserved. */
async function run(input=record(), mode="Review") {
    const operation = new InspectLensEvidence(), args = [mode];
    const dish = new Dish(new TextEncoder().encode(input).buffer, Dish.ARRAY_BUFFER);
    const prefix = {op: "From Hex", args: ["Auto"]}, suffix = {op: "To Base64", args: ["A-Za-z0-9+/="]};
    await operation.run({dish, progress: 1, opList: [{config: prefix}, {ingValues: args, config: {op: "Inspect Lens Evidence", args}}, {config: suffix}]});
    const text = await dish.get(Dish.STRING);
    return {operation, text, html: operation.present(text, args), prefix, suffix};
}

test("review keeps the record unchanged, recalculates cautions and never loads its stored recipe", async () => {
    const input = record(), value = JSON.parse(input);
    value.result.parsingCautions = {status: "complete", total: 0, findings: []};
    const revised = JSON.stringify(value), result = await run(revised);
    assert.equal(result.text, revised);
    assert.match(result.html, /Saved recipes were not executed/);
    assert.match(result.html, /Recomputed now/);
    assert.match(result.html, /2 parsing cautions/);
    assert.match(result.html, /incomplete/);
    assert.doesNotMatch(result.html, /href="[^"]*(?:HTTP_request|example\.invalid)/);
    assert.doesNotMatch(result.html, /<img|<script|<svg/i);
});

for (const [label, change, message] of [
    ["unknown version", value => {
        value.formatVersion = 2;
    }, /formatVersion 1/],
    ["missing input", value => {
        delete value.input;
    }, /missing supported/],
    ["wrong encoding", value => {
        value.input.encoding = "Latin-1";
    }, /missing supported/],
    ["byte mismatch", value => {
        value.result.byteLength++;
    }, /byte count does not match/],
    ["scalar payload", value => {
        value.result.text = "true"; value.result.byteLength = 4;
    }, /JSON object or array/],
    ["malformed payload tail", value => {
        value.result.text += "x"; value.result.byteLength++;
    }, /JSON object or array/],
    ["unpaired Unicode", value => {
        value.input.text = "\ud800"; value.input.byteLength = 3;
    }, /exact UTF-8/],
    ["input too large", value => {
        value.input.text = "a".repeat(65537); value.input.byteLength = 65537;
    }, /within its byte limit/],
    ["missing routes", value => {
        value.result.routes = [];
    }, /missing supported/],
    ["too many routes", value => {
        value.result.routes = Array.from({length: 65}, () => ({recipe: []}));
    }, /missing supported/],
    ["malformed recipe data", value => {
        value.result.routes[0].recipe = "run this";
    }, /inert operation/],
    ["excessive saved steps", value => {
        value.result.routes[0].recipe = Array.from({length: 257}, () => ({op: "x", args: []}));
    }, /256 steps/]
]) test(`${label} refuses recovery without repairing imported contents`, async () => {
    const value = JSON.parse(record()); change(value);
    await assert.rejects(run(JSON.stringify(value)), message);
});

test("duplicate metadata names, including escape aliases, cannot select a replacement payload", async () => {
    const source = record();
    for (const suffix of [',"formatVersion":1', ',"format\\u0056ersion":1']) {
        await assert.rejects(run(source.trimEnd().slice(0, -1) + suffix + "}"), /Duplicate evidence-record/);
    }
});

test("whole-record UTF-8, syntax, size and outer nesting limits refuse before recovery", () => {
    const inspect = text => inspectLensEvidence(Buffer.from(text));
    assert.throws(() => inspectLensEvidence(Buffer.from([0xc3, 0x28])), /strict UTF-8/);
    assert.throws(() => inspect(record() + "{}"), /one complete strict JSON/);
    assert.throws(() => inspect("a".repeat(2097153)), /2 MiB/);
    assert.throws(() => inspect("[".repeat(65) + "0" + "]".repeat(65)), /nesting exceeds 64/);
});

test("stored network/code operations and prototype-shaped metadata remain inert text", async () => {
    const value = JSON.parse(record());
    value.result.routes[0].recipe.push({op: "Run JavaScript", args: ["throw new Error('must not run')"]});
    const source = JSON.stringify(value).replace('"formatVersion":1', '"formatVersion":1,"__proto__":{"lensPolluted":true}');
    const result = await run(source);
    assert.match(result.html, /Run JavaScript/);
    assert.match(result.html, /not executed/);
    assert.equal({}.lensPolluted, undefined);
    assert.ok(![...result.html.matchAll(/href="([^"]+)"/g)].some(match => /Run_JavaScript|HTTP_request|https?:/.test(match[1])));
});

test("an edited valid payload is readable but never represented as rederived or authentic", async () => {
    const value = JSON.parse(record()); value.result.text = "{}"; value.result.byteLength = 2;
    const result = await run(JSON.stringify(value));
    assert.match(result.html, /does not recheck its original decoding/);
    assert.match(result.html, /not authenticated/);
    assert.equal((await run(JSON.stringify(value), "Payload text")).text, "{}");
});

test("large valid payloads recover whole text while caution-budget limits stay visible", async () => {
    const value = JSON.parse(record());
    value.result.text = JSON.stringify({note: "a".repeat(70000)});
    value.result.byteLength = Buffer.byteLength(value.result.text);
    const result = await run(JSON.stringify(value));
    assert.match(result.html, /Parsing-caution inspection not completed/);
    assert.match(result.html, /Preview shortened/);
    assert.equal((await run(JSON.stringify(value), "Payload text")).text, value.result.text);
});

test("a near-1-MiB string payload remains within the supported recovery profile", async () => {
    const value = JSON.parse(record());
    value.result.text = JSON.stringify({note: "a".repeat(1048500)});
    value.result.byteLength = Buffer.byteLength(value.result.text);
    const source = JSON.stringify(value);
    assert.ok(Buffer.byteLength(source) < 2097152);
    assert.equal((await run(source, "Payload text")).text, value.result.text);
});

test("failed re-entry cannot leave a stale successful report available", async () => {
    const {operation} = await run();
    const dish = new Dish(new TextEncoder().encode("{}").buffer, Dish.ARRAY_BUFFER);
    await assert.rejects(operation.run({dish, progress: 0, opList: [{ingValues: ["Review"], config: {op: operation.name, args: ["Review"]}}]}), /formatVersion 1/);
    assert.equal(operation.review, null);
    assert.doesNotMatch(operation.present("invalid"), /data-lens-import-report/);
});

test("payload and saved input recover exactly, without numeric or newline changes", async () => {
    assert.equal((await run(record(), "Payload text")).text, payload);
    assert.equal((await run(record(), "Magic-step input")).text, original);
});

test("recovery links contain only the fixed inspector mode and retain surrounding operations", async () => {
    const {html, prefix, suffix} = await run();
    const recipes = [...html.matchAll(/href="#recipe=([^"]+)"/g)].map(match => Utils.parseRecipeConfig(decodeURIComponent(Utils.unescapeHtml(match[1]))));
    assert.equal(recipes.length, 2);
    for (const recipe of recipes) {
        assert.deepEqual(recipe[0], prefix);
        assert.deepEqual(recipe.at(-1), suffix);
        assert.equal(recipe[1].op, "Inspect Lens Evidence");
        assert.ok(["Payload text", "Magic-step input"].includes(recipe[1].args[0]));
        assert.equal(recipe.length, 3);
    }
});
