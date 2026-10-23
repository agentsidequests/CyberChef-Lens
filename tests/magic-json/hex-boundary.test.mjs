import {test, before} from "node:test";
import assert from "node:assert/strict";
import {deflateSync} from "node:zlib";
import log from "loglevel";
import {investigatePayloadTrail, recognizeTrailTransports} from "../../src/core/lib/MagicPayloadTrail.mjs";
import {prepareMagicRecipes, replayMagicRecipe} from "../../src/core/lib/MagicEvidenceReplay.mjs";

const target = '{\n  "case": "OPS-731",\n  "service": "billing-worker",\n  "retryLimit": 1e400,\n  "status": "queued",\n  "\\u0073tatus": "released"\n}\n';
const container = text => `.${deflateSync(Buffer.from(text)).toString("base64url")}.${"A".repeat(43)}`;
const inspect = text => investigatePayloadTrail(Buffer.from(text), {
    prepare: prepareMagicRecipes, replay: recipe => replayMagicRecipe(recipe, Buffer.from(text))
});
const forms = [
    {name: "continuous", encode: text => Buffer.from(text).toString("hex")},
    {name: "space-delimited", encode: text => [...Buffer.from(text)].map(byte => byte.toString(16).padStart(2, "0")).join(" ")}
];
const boundaries = [
    {name: "no boundary whitespace", prefix: "", suffix: ""},
    {name: "terminal LF", prefix: "", suffix: "\n"},
    {name: "terminal CRLF", prefix: "", suffix: "\r\n"},
    {name: "terminal spaces and tab", prefix: "", suffix: " \t"},
    {name: "leading tab and terminal LF", prefix: "\t", suffix: "\n"},
    {name: "Unicode boundary whitespace", prefix: "\u00a0", suffix: "\u2003"},
    {name: "surrounding blank lines", prefix: "\r\n", suffix: "\n\n"}
];

before(async () => {
    log.setLevel("silent", false);
    await prepareMagicRecipes([]);
});

for (const form of forms) for (const boundary of boundaries) test(`${form.name} hex with ${boundary.name}: exact full-input replay`, async () => {
    const input = boundary.prefix + form.encode(container(target)) + boundary.suffix;
    const report = await inspect(input);
    assert.equal(report.status, "complete", report.reason);
    assert.equal(report.original, input);
    const result = report.outputs.find(output => output.text === target);
    assert.ok(result, "the original complete input must reach the exact 129-byte payload");
    assert.equal(result.byteLength, 129);
    for (const source of result.sources) {
        assert.equal(new TextDecoder().decode(await replayMagicRecipe(source.recipe, Buffer.from(input))), target);
        for (const hop of source.hops) {
            assert.equal(new TextDecoder().decode(await replayMagicRecipe(hop.recipe, Buffer.from(input))), report.nodes[hop.nodeId].text);
        }
    }
});

test("hex recognition does not admit internal newlines, odd pairs, prefixes or junk", () => {
    for (const input of ["7b\n7d", "7b\r\n7d", "7b\t7d", "7b  7d", "7b7", "0x7b7d", "hex:7b7d", "7b7d!", "7b\u200b7d"]) {
        assert.ok(!recognizeTrailTransports(input).some(candidate => candidate.kind === "Hexadecimal transport"), input);
    }
});

test("boundary handling never trims decoded payload bytes to make invalid JSON pass", async () => {
    const input = forms[0].encode(container(target + "\u0000")) + "\n";
    const report = await inspect(input);
    assert.equal(report.outputs.length, 0);
});

test("an already-valid JSON document containing hex strings remains unchanged", async () => {
    const input = ' \n{"hex":"7b7d","spaced":"7b 7d"}\t';
    const report = await inspect(input);
    assert.equal(report.outputs.length, 1);
    assert.equal(report.outputs[0].text, input);
    assert.ok(report.outputs[0].sources.every(source => !source.recipe.length));
});
