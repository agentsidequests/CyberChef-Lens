import {test, before} from "node:test";
import assert from "node:assert/strict";
import {deflateSync} from "node:zlib";
import log from "loglevel";
import {verifyLensEvidence} from "../../src/core/lib/LensVerification.mjs";
import {lensEvidenceExample} from "../../src/core/lib/LensEvidenceExample.mjs";
import {prepareMagicRecipes} from "../../src/core/lib/MagicEvidenceReplay.mjs";
import {presentLensVerification} from "../../src/core/lib/MagicJsonPresentation.mjs";

const recordFor = (saved, current, compressed=false) => {
    const record = JSON.parse(lensEvidenceExample());
    record.result.text = saved; record.result.byteLength = Buffer.byteLength(saved);
    record.input.text = compressed ? "." + deflateSync(Buffer.from(current)).toString("base64url") + ".AAAA.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" :
        Buffer.from(current).toString("base64") + "\n";
    record.input.byteLength = Buffer.byteLength(record.input.text);
    if (compressed) record.result.routes[0].recipe = [
        {op: "Regular expression", args: ["User defined", "^\\s*\\.([A-Za-z0-9_-]+)(?=\\.)", false, false, false, false, false, false, "List capture groups"]},
        {op: "From Base64", args: ["A-Za-z0-9-_", true, false]}, {op: "Zlib Inflate Bounded", args: [1048576]}
    ];
    return record;
};
const verify = record => verifyLensEvidence(Buffer.from(JSON.stringify(record)));
before(async () => {
    log.setLevel("silent", false); await prepareMagicRecipes([]);
});

test("replay field explanations preserve duplicate occurrences, exact numbers and every change kind", async () => {
    const saved = '{"id":9007199254740993,"id":2,"status":"failed","\\u006b":1,"type":false,"removed":{},"list":[1,2]}';
    const current = '{"status":"queued","id":9007199254740992,"id":3,"k":1,"type":[],"added":true,"list":[1,4,5]}';
    const result = await verify(recordFor(saved, current)), fields = result.routes[0].fields;
    assert.equal(result.status, "differences"); assert.equal(fields.text, current);
    assert.deepEqual(fields.report.counts, {value: 4, type: 1, added: 2, removed: 1, "key-spelling": 1, "member-order": 1});
    const id = fields.report.changes.find(change => change.path === '$["id"]#1');
    assert.equal(id.left.raw, "9007199254740993"); assert.equal(id.right.raw, "9007199254740992");
    assert.ok(fields.report.changes.some(change => change.path === '$["id"]#2'));
    const html = presentLensVerification(result);
    for (const text of ["What changed in the payload", "Saved payload", "Reproduced payload", "Type changed", "Key spelling", "Member order", "9007199254740993"]) assert.ok(html.includes(text), text);
});

test("a late long-token change is explained from complete text beyond the old preview", async () => {
    const prefix = "a".repeat(5000), saved = JSON.stringify({note: prefix + "tail-saved"});
    const current = JSON.stringify({note: prefix + "tail-current"});
    const result = await verify(recordFor(saved, current)), route = result.routes[0];
    assert.equal(route.previewTruncated, true); assert.ok(!route.actualPreview.includes("tail-current"));
    assert.equal(route.fields.report.changes[0].path, '$["note"]');
    assert.match(presentLensVerification(result), /tail-saved/); assert.match(presentLensVerification(result), /tail-current/);
});

test("whitespace-only explanations cannot turn a byte mismatch into a match", async () => {
    const result = await verify(recordFor('{"x":1}', ' {\r\n "x" : 1\r\n}\n'));
    assert.equal(result.routes[0].fields.report.status, "formatting-only");
    assert.equal(result.counts.mismatched, 1); assert.equal(result.counts.matched, 0);
    const html = presentLensVerification(result);
    assert.match(html, /Only insignificant JSON whitespace differs/); assert.match(html, /remains a byte mismatch/);
});

test("many changed fields retain 32 rows with complete bounded counts", async () => {
    const saved = JSON.stringify(Array.from({length: 180}, (_, index) => index));
    const current = JSON.stringify(Array.from({length: 180}, (_, index) => index + 1));
    const result = await verify(recordFor(saved, current)), report = result.routes[0].fields.report;
    assert.equal(report.total, 180); assert.equal(report.counts.value, 180);
    assert.equal(report.changes.length, 32); assert.equal(report.truncated, true);
    const html = presentLensVerification(result);
    assert.match(html, /32 of 180 change records/); assert.match(html, /32 retained change records/);
    assert.equal((html.match(/class="js-change"/g) || []).length, 32);
});

for (const [name, large, reason] of [
    ["saved UTF-8 byte limit", JSON.stringify({note: "海".repeat(22000)}), /64 KiB/],
    ["token limit", JSON.stringify(Array.from({length: 8200}, () => 0)), /token limit/],
    ["nesting limit", "[".repeat(65) + "0" + "]".repeat(65), /nesting limit/]
]) {
    test(`field refusal at the ${name} preserves the complete mismatch`, async () => {
        const result = await verify(recordFor(large, "{}")), fields = result.routes[0].fields;
        assert.equal(result.counts.mismatched, 1); assert.equal(fields.report.status, "not-compared");
        assert.match(fields.report.reason, reason); assert.equal(fields.text, undefined);
        assert.match(presentLensVerification(result), /Field explanation unavailable/);
        assert.match(presentLensVerification(result), /no partial field comparison was used/);
    });
}

test("a reproduced payload over the field byte budget still gets a complete byte verdict", async () => {
    const current = JSON.stringify({note: "a".repeat(70000)}), result = await verify(recordFor("{}", current, true));
    assert.equal(result.routes[0].actualBytes, Buffer.byteLength(current));
    assert.equal(result.routes[0].fields.report.status, "not-compared");
    assert.match(result.routes[0].fields.report.reason, /64 KiB/); assert.equal(result.counts.mismatched, 1);
});

test("64 duplicate mismatch routes share one explanation and one detailed rendering", async () => {
    const record = recordFor('{"x":1}', '{"x":2}');
    record.result.routes = Array.from({length: 64}, () => record.result.routes[0]);
    const result = await verify(record), html = presentLensVerification(result);
    assert.equal(result.counts.mismatched, 64);
    assert.ok(result.routes.every(route => route.fields === result.routes[0].fields && route.comparisonRoute === 1));
    assert.equal((html.match(/class="json-structure"/g) || []).length, 1);
    assert.equal((html.match(/Same reproduced payload as saved route 1/g) || []).length, 63);
    assert.ok(html.length < 100000); assert.ok(result.search.checkedReplays < 10);
});

test("equal payloads and unsupported routes manufacture no field changes", async () => {
    const record = recordFor('{"x":1}', '{"x":1}');
    record.result.routes.push({recipe: [{op: "HTTP request", args: []}]});
    const result = await verify(record), html = presentLensVerification(result);
    assert.equal(result.routes[0].fields, null); assert.equal(result.routes[1].fields, undefined);
    assert.doesNotMatch(html, /What changed in the payload|class="json-structure"/);
});

test("untrusted paths, raw tokens and reproduced markup stay inert", async () => {
    const key = "</summary><script>alert(1)</script>", saved = JSON.stringify({[key]: "<img src=x onerror=alert(1)>"});
    const current = JSON.stringify({[key]: "<svg onload=alert(1)>"});
    const result = await verify(recordFor(saved, current)), html = presentLensVerification(result);
    assert.ok(!/<script>|<img src=x|<svg onload/.test(html));
    assert.match(html, /&lt;script&gt;/); assert.match(html, /&lt;svg/);
    assert.equal(result.routes[0].fields.report.counts.value, 1);
});
