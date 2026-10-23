import {test, before} from "node:test";
import assert from "node:assert/strict";
import log from "loglevel";
import {inspectLensHar, selectLensHar, lensHarExample} from "../../src/core/lib/LensHar.mjs";
import {investigateLensSource} from "../../src/core/lib/LensWorkspace.mjs";
import {prepareMagicRecipes} from "../../src/core/lib/MagicEvidenceReplay.mjs";
import {createJsonEvidence} from "../../src/core/lib/MagicJsonExport.mjs";
import {verifyLensEvidence} from "../../src/core/lib/LensVerification.mjs";
import {createLensSharingCopy} from "../../src/core/lib/LensSharing.mjs";

const payload = '{\r\n "id":9007199254740993,"status":"queued","\\u0073tatus":"released","label":"海 😀","token":"SECRET"\r\n}\r\n';
const capture = entries => JSON.stringify({log: {version: "1.2", entries}});
const request = text => ({request: {method: "POST", url: "https://example.invalid/?private=URL-CANARY", postData: {text}}});
const response = (text, encoding) => ({response: {status: 200, headers: [{name: "Content-Encoding", value: "gzip"}], content: {text, encoding}}});
const choose = (text, entry=0, part="response") => selectLensHar(text, {entry, part});

before(async () => {
    log.setLevel("silent", false); await prepareMagicRecipes([]);
});

test("HAR selects one exact recorded body, preserving CRLF, escapes, duplicate keys and large numbers", () => {
    const raw = capture([{...request('{"status":"queued"}'), ...response(Buffer.from(payload).toString("base64"), "base64")}]);
    assert.equal(choose(raw, 0, "request").text, '{"status":"queued"}');
    const selected = choose(raw);
    assert.equal(selected.text, payload);
    assert.equal(selected.origin.field, "log.entries[0].response.content.text");
    assert.equal(selected.origin.entry, 1);
    assert.deepEqual(Object.keys(selected.origin).sort(), ["entry", "field", "representation"]);
    assert.equal(inspectLensHar(raw)[0].parts[1].available, true);
});

test("HAR never inflates already HTTP-decoded text from a gzip header or trusts size metadata", () => {
    const entry = response(payload);
    entry.response.content.size = 1; entry.response.bodySize = -1;
    assert.equal(choose(capture([entry])).text, payload);
    assert.equal(choose(capture([request(payload)]), 0, "request").text, payload);
});

test("HAR missing and empty bodies are distinct, and params/files are not reconstructed", () => {
    const raw = capture([{request: {postData: {params: [{name: "x", value: "{}"}]}}, response: {content: {text: ""}}}]);
    const parts = inspectLensHar(raw)[0].parts;
    assert.equal(parts[0].available, false); assert.match(parts[0].note, /not recorded/);
    assert.equal(parts[1].available, false); assert.match(parts[1].note, /empty/);
    assert.throws(() => choose(raw, 0, "request"), /not recorded/);
    assert.throws(() => choose(raw), /empty/);
    const entry = request(payload); entry.request.postData.params = [{name: "ignored", value: "OTHER"}];
    assert.equal(choose(capture([entry]), 0, "request").text, payload);
});

test("unsupported encodings, non-text and invalid UTF-8 refuse without substitution", () => {
    for (const encoding of ["", "gzip", "BASE64", null, 1]) {
        assert.throws(() => choose(capture([response("e30=", encoding)])), /Unsupported/);
    }
    const entry = request(payload); entry.request.postData.encoding = "base64";
    assert.throws(() => choose(capture([entry]), 0, "request"), /Unsupported/);
    assert.throws(() => choose(capture([response(2)])), /string/);
    assert.throws(() => choose(capture([response("/w==", "base64")])), /UTF-8/);
    assert.throws(() => choose(capture([response("\uD800")])), /exact UTF-8/);
});

test("Base64 is canonical standard form including padding bits, not permissive garbage removal", () => {
    for (const value of ["e30", "e30=\n", "e31=", "e30===", "e3_="]) {
        assert.throws(() => choose(capture([response(value, "base64")])), /canonical/);
    }
    assert.throws(() => choose(capture([response("", "base64")])), /empty/);
    assert.equal(choose(capture([response("e30=", "base64")])).text, "{}");
});

test("decoded-body bounds apply before decoding and count UTF-8 bytes", () => {
    const maximum = " ".repeat(65534) + "{}";
    assert.equal(choose(capture([response(Buffer.from(maximum).toString("base64"), "base64")])).text, maximum);
    for (const text of ["x".repeat(65537), "海".repeat(22000)]) {
        assert.throws(() => choose(capture([response(text)])), /64 KiB/);
        assert.throws(() => choose(capture([response(Buffer.from(text).toString("base64"), "base64")])), /64 KiB/);
    }
});

test("container limits, strict JSON, ambiguous metadata and versions refuse the complete index", () => {
    for (const text of ["{}", '{"log":{"version":"1.3","entries":[]}}', "{}{}", "// comment\n{}"])
        assert.throws(() => inspectLensHar(text));
    assert.throws(() => inspectLensHar(capture([])), /no entries/);
    assert.throws(() => inspectLensHar(capture(Array(257).fill({}))), /256/);
    assert.throws(() => inspectLensHar(capture([request("x".repeat(2097153))])), /2 MiB/);
    assert.throws(() => inspectLensHar(capture([request("海".repeat(750000))])), /2 MiB/);
    assert.throws(() => inspectLensHar('{"log":{"version":"1.2","entries":[],"\\u0065ntries":[{}]}}'), /Duplicate/);
    assert.throws(() => inspectLensHar(capture([{extra: JSON.parse("[".repeat(65) + "0" + "]".repeat(65))}])), /nesting/);
    assert.throws(() => inspectLensHar("\uD800"), /exact UTF-8/);
});

test("BOM applies only to the HAR document; selected body BOM and newlines remain exact", () => {
    const text = "\uFEFF{}\r\n";
    const raw = "\uFEFF" + capture([response(text)]);
    assert.equal(choose(raw).text, text);
    assert.equal(choose(capture([response(Buffer.from(text).toString("base64"), "base64")])).text, text);
});

test("entry identity, malformed entries and unsafe labels cannot mix bodies or create an extraction path", () => {
    const entries = [null, request('{"entry":2}'), response('{"entry":3}')];
    entries[1].request.url = "<img src=x onerror=alert(1)>\r\n" + "x".repeat(500);
    const raw = capture(entries), listed = inspectLensHar(raw);
    assert.equal(listed.length, 3); assert.equal(listed[0].parts[0].available, false);
    assert.ok(listed[1].label.length < 300); assert.ok(!listed[1].label.includes("\r"));
    assert.equal(choose(raw, 1, "request").text, '{"entry":2}');
    assert.equal(choose(raw, 2).text, '{"entry":3}');
    for (const selection of [{entry: -1, part: "response"}, {entry: 3, part: "request"}, {entry: "1", part: "request"}, {entry: 1, part: "__proto__"}])
        assert.throws(() => selectLensHar(raw, selection), /Choose/);
});

test("selected-body evidence replays from that body, excludes unrelated HAR metadata, and redacts separately", async () => {
    const raw = capture([{...request('{"status":"queued"}'), ...response(Buffer.from(payload).toString("base64"), "base64")}]);
    const selected = choose(raw), report = await investigateLensSource(selected.text);
    report.harSelection = selected.origin;
    const group = report.outputs.find(item => item.text === payload);
    assert.ok(group);
    const text = createJsonEvidence(group, {report, mode: "JSON payload trail", index: 0, count: report.outputs.length});
    const record = JSON.parse(text);
    assert.equal(record.input.text, payload); assert.match(record.input.scope, /not from the complete HAR/);
    assert.deepEqual(record.investigation.harSelection, selected.origin);
    assert.ok(!text.includes("URL-CANARY")); assert.ok(!text.includes("Content-Encoding"));
    const verified = await verifyLensEvidence(Buffer.from(text));
    assert.ok(verified.counts.matched >= 1);
    const copy = JSON.parse(createLensSharingCopy(Buffer.from(text)).text);
    assert.ok(!JSON.stringify(copy).includes("SECRET")); assert.ok(!JSON.stringify(copy).includes("harSelection"));
    assert.match(copy.payload.text, /9007199254740993/); assert.ok(copy.payload.text.endsWith("\r\n"));
    assert.equal(choose(raw).text, payload);
});

test("fictional example includes independent request/response and explicit missing-body entry", () => {
    const raw = lensHarExample();
    assert.equal(inspectLensHar(raw).length, 2);
    assert.match(choose(raw, 0, "request").text, /queued/);
    assert.match(choose(raw).text, /released/);
    assert.throws(() => choose(raw, 1), /not recorded/);
});
