import {test} from "node:test";
import assert from "node:assert/strict";
import {inspectJsonHazards} from "../../src/core/lib/JsonHazards.mjs";
import {presentJsonHazards} from "../../src/core/lib/JsonHazardPresentation.mjs";
import {presentJsonInvestigation, presentJsonWrappers, presentPayloadTrail} from "../../src/core/lib/MagicJsonPresentation.mjs";
import JSONBeautify from "../../src/core/operations/JSONBeautify.mjs";

test("duplicate names are decoded per object and report both original locations", () => {
    const report = inspectJsonHazards(String.raw`{"role":"reader","\u0072ole":"admin","role":false}`);
    assert.equal(report.status, "complete");
    assert.equal(report.counts["duplicate-key"], 2);
    assert.equal(report.findings[0].first.column, 2);
    assert.equal(report.findings[0].token.column, 18);
    assert.equal(report.findings[1].first.column, 2);
    assert.equal(report.findings[0].token.raw, String.raw`"\u0072ole"`);
});

test("objects and arrays isolate member scopes, including outer names after nested values", () => {
    for (const text of ['{"a":{"role":1},"b":{"role":2}}', '[{"role":1},{"role":2}]', '{"a":[{"a":1}],"b":{"a":1}}', String.raw`{"s":"\"role\": role","role":1}`]) {
        assert.equal(inspectJsonHazards(text).total, 0, text);
    }
    assert.equal(inspectJsonHazards('{"a":{"a":1},"a":2}').counts["duplicate-key"], 1);
    assert.equal(inspectJsonHazards('{"a":[{"x":1,"x":2}],"b":{"x":1,"x":2}}').counts["duplicate-key"], 2);
});

test("Unicode aliases are decoded, not normalized, and columns count characters", () => {
    assert.equal(inspectJsonHazards('{"é":1,"é":2}').total, 0);
    const finding = inspectJsonHazards('{\n "😀":1,"😀":2}').findings[0];
    assert.equal(finding.token.line, 2);
    assert.equal(finding.token.column, 8);
    assert.equal(finding.first.column, 2);
});

test("numeric cautions distinguish range, overflow and nonzero-to-zero conversion", () => {
    const text = '{"a":9007199254740993,"b":-9007199254740992,"c":1e400,"d":-1e400,"e":1e-4000,"f":-2.5e-4000}';
    const report = inspectJsonHazards(text);
    assert.deepEqual(report.counts, {"duplicate-key": 0, "unsafe-range": 2, "nonfinite-number": 2, "underflow-number": 2});
    assert.equal(report.findings[0].token.raw, "9007199254740993");
    assert.equal(report.findings[2].token.raw, "1e400");
    assert.equal(report.findings[4].token.raw, "1e-4000");
});

test("ordinary numbers and exact zero exponents do not generate range alarms", () => {
    for (const text of ["0", "-0", "0e400", "-0.000e-4000", "1.0", "0.1", "5e-324", "9007199254740991", "-9007199254740991", "1e3"]) {
        assert.equal(inspectJsonHazards(text).total, 0, text);
    }
});

test("prototype-looking member names cannot mutate the environment", () => {
    const report = inspectJsonHazards('{"__proto__":1,"constructor":2,"toString":3,"__proto__":4,"constructor":5,"toString":6}');
    assert.equal(report.counts["duplicate-key"], 3);
    assert.equal({}.polluted, undefined);
});

test("display caps do not change whole-document category counts", () => {
    const text = "{" + Array.from({length: 41}, (_, index)=>`"a":${index}`).join(",") + "}";
    const report = inspectJsonHazards(text);
    assert.equal(report.total, 40); assert.equal(report.findings.length, 16); assert.equal(report.truncated, true);
    assert.equal(inspectJsonHazards(text, {maxFindings: 2}).findings.length, 2);
    assert.equal(inspectJsonHazards(text, {maxFindings: 32}).findings.length, 32);
    assert.match(presentJsonHazards(text), /Showing 16 of 40 cautions/);
    assert.throws(()=>inspectJsonHazards(text, {maxFindings: 33}), RangeError);
});

test("unsupported text, UTF-8 bytes, tokens and depth do not earn a clean inspection", () => {
    for (const text of ["", "{x:1}", '{"a":1}tail', '"' + "海".repeat(22000) + '"', "[".repeat(65) + "0" + "]".repeat(65), "[" + Array(8193).fill("0").join(",") + "]"]) {
        assert.equal(inspectJsonHazards(text).status, "not-inspected");
        assert.match(presentJsonHazards(text), /inspection not completed/);
        assert.match(presentJsonHazards(text), /No clean result is implied/);
    }
});

test("hostile/long names remain escaped and bounded, not executable markup", () => {
    const name = "<img src=x onerror=alert(731)>" + "a".repeat(5000);
    const html = presentJsonHazards(JSON.stringify({[name]: 1}).slice(0, -1) + "," + JSON.stringify(name) + ":2}");
    assert.doesNotMatch(html, /<img|onerror="|<script/);
    assert.match(html, /&lt;img/); assert.match(html, /token shortened/);
    assert.ok(html.length < 4000);
});

test("benign documents do not acquire a clean/safe certificate or extra clutter", () => {
    assert.equal(presentJsonHazards('{"message":"hello","fraction":0.1}'), "");
});

test("lossless Beautify keeps raw output unchanged and identifies formatted coordinates", () => {
    const operation = new JSONBeautify(), input = String.raw`{"role":"reader","\u0072ole":"admin","n":9007199254740993}`;
    const args = ["  ", false, true, true], output = operation.run(input, args), html = operation.present(output, args);
    assert.match(html, /2 parsing cautions/);
    assert.match(html, /formatted output shown below, not the original input/);
    assert.match(html, /line 3, column 3/);
    assert.match(output, /9007199254740993/);
    assert.equal(operation.present(output, ["  ", false, false, true]), output.replace(/"/g, "&quot;"));
    assert.doesNotMatch(operation.present(operation.run(input, ["  ", false, true]), ["  ", false, true]), /parsing caution/);
});

test("formatted expansion beyond the inspection budget is explicitly not inspected", () => {
    const operation = new JSONBeautify(), args = ["    ", false, true, true];
    const input = "[".repeat(20) + Array(1000).fill("0").join(",") + "]".repeat(20);
    const output = operation.run(input, args);
    assert.ok(output.length > 65536 && output.length < 1048576);
    assert.match(operation.present(output, args), /inspection not completed/);
    assert.match(operation.present(output, args), /No clean result is implied/);
});

const text = '{"role":"reader","role":"admin","n":9007199254740993}';
const source = {route: "native", nativeRank: 1, recipe: [], warnings: [], hops: [], depth: 0};
const group = {text, byteLength: Buffer.byteLength(text), sources: [source]};
const context = {recipeUrl: ()=>"#recipe=", anyUrl: "#any"};
for (const [name, present, report, action] of [
    ["combined", presentJsonInvestigation, {status: "complete", outputs: [group], interpretationWarnings: [], native: {status: "complete", checked: 1, total: 1, candidates: []}, wrappers: {status: "complete", checked: 0, total: 0, candidates: []}}, "Load JSON recipe"],
    ["wrappers", presentJsonWrappers, {status: "complete", candidates: [{...source, accepted: true, evidence: {text, byteLength: Buffer.byteLength(text)}, resultRole: "Possible token payload"}], interpretationWarnings: []}, "Load payload recipe"],
    ["trail", presentPayloadTrail, {status: "complete", outputs: [group], nodes: [], stops: [], limits: {maxDepth: 3, maxStates: 16, maxReplays: 64, maxRetainedBytes: 2097152, maxOutputBytes: 1048576, maxMillis: 3000}}, "Keep original JSON"]
]) test(`${name} shows selected cautions before the original result action`, () => {
    const html = present(report, context);
    assert.match(html, /2 parsing cautions/);
    assert.ok(html.indexOf("2 parsing cautions") < html.indexOf(action));
    assert.match(html, /exact decoded text/);
    assert.match(html, /not a complete precision/);
    assert.match(html, /9007199254740993/);
});
