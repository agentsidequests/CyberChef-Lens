import {test, before} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import log from "loglevel";
import {readLensSource, investigateLensSource, compareLensSources} from "../../src/core/lib/LensWorkspace.mjs";
import {prepareMagicRecipes} from "../../src/core/lib/MagicEvidenceReplay.mjs";
import {createJsonEvidence} from "../../src/core/lib/MagicJsonExport.mjs";
import {inspectLensEvidence} from "../../src/core/lib/LensEvidence.mjs";

before(async () => {
    log.setLevel("silent", false); await prepareMagicRecipes([]);
});
test("source file retains CRLF, BOM and Unicode and refuses invalid UTF-8 or oversized input", () => {
    const text = '\uFEFF{"x":"海 😀"}\r\n';
    assert.equal(readLensSource(Buffer.from(text)), text);
    assert.throws(() => readLensSource(Uint8Array.of(0xff)), /UTF-8/);
    assert.throws(() => readLensSource(Buffer.alloc(65537)), /64 KiB/);
});
test("guided investigation retains exact input, duplicate members, big numbers and portable evidence", async () => {
    const payload = ' {"id":9007199254740993,"role":1,"role":2}\r\n';
    const input = Buffer.from(payload).toString("base64") + "\r\n";
    const report = await investigateLensSource(input);
    const group = report.outputs.find(item => item.text === payload);
    assert.ok(group);
    assert.equal(report.original, input);
    const evidence = createJsonEvidence(group, {report, mode: "JSON payload trail", index: 0, count: report.outputs.length});
    const reopened = inspectLensEvidence(Buffer.from(evidence));
    assert.equal(reopened.input, input); assert.equal(reopened.payload, payload);
});
test("guided comparison accepts independent documents with arbitrary delimiter strings inside", () => {
    const pair = readFileSync(new URL("../../examples/lens-json-comparison.txt", import.meta.url), "utf8").split("\n===\n");
    const result = compareLensSources(...pair);
    assert.equal(result.report.total, 8);
    assert.match(result.html, /Source A/); assert.match(result.html, /Source B/);
    assert.equal(compareLensSources('{"s":"===\\n\\n"}', '{"s":"===\\n\\n"}').report.total, 0);
});
test("unsupported, malformed and excessive inputs never become a successful empty comparison", async () => {
    assert.equal((await investigateLensSource("plain text")).outputs.length, 0);
    await assert.rejects(investigateLensSource(""), /first/);
    await assert.rejects(investigateLensSource("海".repeat(30000)), /64 KiB/);
    await assert.rejects(investigateLensSource("\uD800"), /replacement/);
    assert.throws(() => compareLensSources('{"a":', "{}"));
});
test("untrusted payload markup stays inert in comparison presentation", () => {
    const result = compareLensSources('{"x":"<img src=x onerror=alert(1)>"}', '{"x":"<script>alert(2)</script>"}');
    assert.ok(!result.html.includes("<img src=x"));
    assert.ok(!result.html.includes("<script>"));
});
