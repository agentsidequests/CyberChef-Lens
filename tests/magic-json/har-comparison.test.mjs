import {test, before} from "node:test";
import assert from "node:assert/strict";
import {deflateRawSync} from "node:zlib";
import log from "loglevel";
import {selectLensHarPair, lensHarExample} from "../../src/core/lib/LensHar.mjs";
import {investigateLensHarPair, compareLensSources} from "../../src/core/lib/LensWorkspace.mjs";
import {prepareMagicRecipes} from "../../src/core/lib/MagicEvidenceReplay.mjs";
import {createJsonEvidence} from "../../src/core/lib/MagicJsonExport.mjs";
import {verifyLensEvidence} from "../../src/core/lib/LensVerification.mjs";
const encode = text => Buffer.from(text).toString("base64url");
const envelope = text => JSON.stringify({protected: encode('{"alg":"HS256"}'), payload: encode(text), signature: "A".repeat(43)});
const capture = (left, right) => JSON.stringify({log: {version: "1.2", entries: [
    {request: {postData: {text: left}}, response: {content: {text: Buffer.from(right).toString("base64"), encoding: "base64"}}}
]}});
before(async () => {
    log.setLevel("silent", false); await prepareMagicRecipes([]);
});

test("one HAR action returns independent body reports and an initial request/response comparison", async () => {
    const result = await investigateLensHarPair(lensHarExample(), 0);
    assert.equal(result.reports.length, 2);
    assert.equal(result.comparison.report.total, 4);
    assert.deepEqual(result.comparison.selection, [0, 0]);
    assert.match(result.comparison.html, /Request body/); assert.match(result.comparison.html, /Response body/);
    assert.ok(!result.comparison.html.includes("Source A")); assert.ok(!result.comparison.html.includes("Source B"));
    assert.match(result.reports[0].original, /queued/); assert.match(result.reports[1].original, /released/);
    assert.equal(result.reports[0].harSelection.field, "log.entries[0].request.postData.text");
    assert.equal(result.reports[1].harSelection.field, "log.entries[0].response.content.text");
});

test("paired selection stays in one entry and requires both actual recorded fields", () => {
    const raw = JSON.parse(capture("{}", "[]")); raw.log.entries.push({request: {postData: {text: '{"other":1}'}}});
    const text = JSON.stringify(raw), selected = selectLensHarPair(text, 0);
    assert.equal(selected[0].text, "{}"); assert.equal(selected[1].text, "[]");
    assert.throws(() => selectLensHarPair(text, 1), /Response body:.*not recorded/);
    for (const entry of [-1, 2, "0", undefined]) assert.throws(() => selectLensHarPair(text, entry), /Request body:.*Choose/);
    raw.log.entries[0].request.postData.text = "";
    assert.throws(() => selectLensHarPair(JSON.stringify(raw), 0), /Request body:.*empty/);
    raw.log.entries[0].request.postData.text = "{}"; raw.log.entries[0].response.content.encoding = "gzip";
    assert.throws(() => selectLensHarPair(JSON.stringify(raw), 0), /Response body:.*Unsupported/);
});

test("initial selection prefers retained original JSON envelopes over their deeper decoded payloads", async () => {
    const left = '{"status":"queued","id":9007199254740993}\r\n';
    const right = '{"status":"released","id":9007199254740993}\r\n';
    const lbody = envelope(left), rbody = envelope(right);
    const result = await investigateLensHarPair(capture(lbody, rbody), 0);
    result.reports.forEach((report, index) => {
        assert.ok(report.outputs.length >= 2);
        assert.equal(report.outputs[result.comparison.selection[index]].text, index ? rbody : lbody);
    });
    const decoded = result.reports.map((report, index) => report.outputs.find(group => group.text === (index ? right : left)).text);
    const deeper = compareLensSources(...decoded, true);
    assert.equal(deeper.report.total, 1); assert.match(deeper.html, /9007199254740993/);
});

test("non-JSON on either side retains both investigations without a false equality conclusion", async () => {
    for (const pair of [["plain text", "{}"], ["{}", "plain text"], ["left", "right"]]) {
        const result = await investigateLensHarPair(capture(...pair), 0);
        assert.equal(result.reports.length, 2); assert.match(result.comparison.error, /No retained JSON.*No equality conclusion/);
        assert.equal(result.comparison.html, undefined); assert.equal(result.comparison.report, undefined);
    }
});

test("comparison budget refusal preserves complete successfully decoded bodies", async () => {
    const large = '{"x":"' + "x".repeat(65536) + '"}';
    const compact = `${encode('{"alg":"HS256","zip":"DEF"}')}.${deflateRawSync(Buffer.from(large)).toString("base64url")}.${"A".repeat(43)}`;
    const result = await investigateLensHarPair(capture(compact, compact), 0);
    assert.ok(result.reports.every(report => report.outputs.some(group => group.text === large)));
    assert.match(result.comparison.error, /could not be compared.*Both investigations are retained/);
    assert.equal(result.comparison.html, undefined);
});

test("duplicate keys, Unicode, CRLF and number spellings survive comparison and each side's evidence", async () => {
    const left = '{"role":1,"\\u0072ole":2,"id":9007199254740993,"note":"海 😀"}\r\n';
    const right = '{"role":1,"\\u0072ole":3,"id":9007199254740993,"note":"海 😀"}\r\n';
    const result = await investigateLensHarPair(capture(left, right), 0);
    assert.equal(result.comparison.report.total, 1);
    for (const [index, report] of result.reports.entries()) {
        const group = report.outputs[result.comparison.selection[index]], expected = index ? right : left;
        assert.equal(group.text, expected);
        const evidence = createJsonEvidence(group, {report, mode: "JSON payload trail", index: result.comparison.selection[index], count: report.outputs.length});
        const record = JSON.parse(evidence);
        assert.equal(record.input.text, expected); assert.equal(record.result.text, expected);
        assert.equal(record.investigation.harSelection.entry, 1);
        assert.match(record.investigation.harSelection.field, index ? /response/ : /request/);
        assert.ok((await verifyLensEvidence(Buffer.from(evidence))).counts.matched >= 1);
    }
});

test("compared untrusted markup remains escaped and ordinary two-capture labels stay unchanged", async () => {
    const result = await investigateLensHarPair(capture('{"x":"<img src=x onerror=alert(1)>"}', '{"x":"<script>alert(2)</script>"}'), 0);
    assert.ok(!result.comparison.html.includes("<img src=x")); assert.ok(!result.comparison.html.includes("<script>"));
    assert.match(result.comparison.html, /Request body/); assert.match(result.comparison.html, /Response body/);
    const ordinary = compareLensSources('{"x":1}', '{"x":2}');
    assert.match(ordinary.html, /Source A/); assert.match(ordinary.html, /Source B/);
});
