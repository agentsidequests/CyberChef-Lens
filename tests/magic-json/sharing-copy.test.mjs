import {test} from "node:test";
import assert from "node:assert/strict";
import {createLensSharingCopy, DEFAULT_SHARING_FIELDS} from "../../src/core/lib/LensSharing.mjs";
import {lensEvidenceExample, lensSharingExample} from "../../src/core/lib/LensEvidenceExample.mjs";
import {inspectLensEvidence} from "../../src/core/lib/LensEvidence.mjs";
import {verifyLensEvidence} from "../../src/core/lib/LensVerification.mjs";

const recordFor = payload => {
    const record = JSON.parse(lensEvidenceExample());
    record.result.text = payload; record.result.byteLength = Buffer.byteLength(payload);
    return record;
};
const create = (record, options) => createLensSharingCopy(Buffer.from(typeof record === "string" ? record : JSON.stringify(record)), options);
const payloadOf = result => JSON.parse(result.text).payload.text;

test("the fictional sharing example demonstrates both automatic and additional redaction", () => {
    const original = lensSharingExample(), automatic = create(original), additional = create(original, {exactText: "Ada Example"});
    assert.equal(automatic.counts.total, 1); assert.ok(payloadOf(automatic).includes("Ada Example"));
    assert.ok(!automatic.text.includes("EXAMPLE-TOKEN-NOT-REAL"));
    assert.equal(additional.counts.total, 2); assert.ok(!additional.text.includes("Ada Example"));
    assert.ok(payloadOf(additional).includes("9007199254740993"));
    assert.ok(original.includes("EXAMPLE-TOKEN-NOT-REAL"));
});

test("the entire sharing copy omits canaries in every non-payload evidence carrier", () => {
    const record = recordFor('{"case":"PUBLIC-204","token":"VALUE-CANARY-863"}');
    const canaries = ["INPUT-CANARY-251", "RECIPE-CANARY-377", "WARNING-CANARY-482", "METADATA-CANARY-519", "EXTRA-CANARY-624", "VALUE-CANARY-863", "RULE-CANARY-758"];
    record.input.text = canaries[0]; record.input.byteLength = Buffer.byteLength(record.input.text);
    record.result.routes = [{recipe: [{op: "Run JavaScript", args: [canaries[1]]}], httpOrigin: {field: canaries[3]}}];
    record.result.warnings = [canaries[2]]; record.investigation.status = canaries[3]; record.arbitrary = canaries[4];
    const original = JSON.stringify(record), result = create(original, {exactText: canaries[6]});
    for (const canary of canaries) assert.ok(!result.text.includes(canary), canary);
    assert.equal(JSON.stringify(record), original);
    const copy = JSON.parse(result.text);
    assert.deepEqual(Object.keys(copy), ["format", "formatVersion", "producer", "notice", "redaction", "payload"]);
    assert.equal(copy.format, "cyberchef-lens-sharing-copy");
    assert.equal(payloadOf(result), '{"case":"PUBLIC-204","token":"[REDACTED]"}');
    assert.equal(copy.payload.byteLength, Buffer.byteLength(copy.payload.text));
    assert.throws(() => inspectLensEvidence(Buffer.from(result.text)), /formatVersion 1/);
});

test("sharing copies cannot enter saved replay verification", async () => {
    const result = create(recordFor('{"token":"secret"}'));
    await assert.rejects(verifyLensEvidence(Buffer.from(result.text)), /formatVersion 1/);
});

test("decoded duplicate names, case and separator variants all redact their whole values", () => {
    const payload = '{"access_token":"one","\\u0061ccess_token":"two","ACCESS-TOKEN":{"nested":"three"},"access token":["four"],"ok":1}';
    const result = create(recordFor(payload));
    assert.equal(payloadOf(result), '{"access_token":"[REDACTED]","\\u0061ccess_token":"[REDACTED]","ACCESS-TOKEN":"[REDACTED]","access token":"[REDACTED]","ok":1}');
    assert.deepEqual(result.counts, {values: 4, keys: 0, total: 4});
});

test("covered subtrees do not create overlapping edits or double-count descendants", () => {
    const result = create(recordFor('{"secret":{"password":"CANARY","token":["CANARY"]},"password":false}'), {exactText: "CANARY"});
    assert.equal(payloadOf(result), '{"secret":"[REDACTED]","password":"[REDACTED]"}');
    assert.deepEqual(result.counts, {values: 2, keys: 0, total: 2});
});

test("literal text matches decoded string substrings and keys including Unicode escapes", () => {
    const result = create(recordFor('{"owner":"hi ali\\u0063e!","ali\\u0063e-account":3,"other":"ALICE"}'), {exactText: "alice"});
    assert.equal(payloadOf(result), '{"owner":"[REDACTED]","[REDACTED KEY 1]":3,"other":"ALICE"}');
    assert.deepEqual(result.counts, {values: 1, keys: 1, total: 2});
});

test("redacted key labels never collide with existing or generated names", () => {
    const result = create(recordFor('{"[REDACTED KEY 1]":1,"alice":2,"alice":3}'), {exactText: "alice"});
    assert.equal(payloadOf(result), '{"[REDACTED KEY 1]":1,"[REDACTED KEY 2]":2,"[REDACTED KEY 3]":3}');
});

test("literal primitive rules preserve exact unsafe number spelling and never round", () => {
    const result = create(recordFor("[9007199254740993,9007199254740992,1e400,true,null,1.0,1]"), {exactText: "9007199254740993\ntrue\nnull\n1"});
    assert.equal(payloadOf(result), '["[REDACTED]",9007199254740992,1e400,"[REDACTED]","[REDACTED]",1.0,"[REDACTED]"]');
});

test("untouched duplicate members, CRLF, Unicode, escapes and numeric tokens are byte-exact", () => {
    const payload = ' {\r\n "id":9007199254740993,"id":1e400,"note":"海 😀 \\u0061","password":"remove"\r\n}\r\n';
    const result = create(recordFor(payload));
    assert.equal(payloadOf(result), payload.replace('"remove"', '"[REDACTED]"'));
});

test("literal metacharacters and prototype names are data rather than regex or object mutation", () => {
    const result = create(recordFor('{"__proto__":{"polluted":true},"constructor":"x","note":"a.*b"}'), {memberNames: "__proto__\nconstructor", exactText: ".*"});
    assert.equal(payloadOf(result), '{"__proto__":"[REDACTED]","constructor":"[REDACTED]","note":"[REDACTED]"}');
    assert.equal({}.polluted, undefined);
});

test("all defaults are editable, empty lists preserve the payload and zero counts are honest", () => {
    assert.match(DEFAULT_SHARING_FIELDS, /password/);
    const payload = '{"token":"retained","unknown":"PRIVATE-UNRECOGNIZED"}', result = create(recordFor(payload), {memberNames: "", exactText: ""});
    assert.equal(payloadOf(result), payload); assert.equal(result.counts.total, 0);
    assert.match(JSON.parse(result.text).notice, /can miss/);
});

test("unknown fields are an explicit hard negative to exhaustive secret-detection claims", () => {
    const result = create(recordFor('{"unusual":"UNKNOWN-CREDENTIAL-387"}'));
    assert.ok(result.text.includes("UNKNOWN-CREDENTIAL-387")); assert.equal(result.counts.total, 0);
    assert.match(result.text, /Not an exhaustive secret detector/);
});

test("rule lists trim edge whitespace, deduplicate and never appear as saved instructions", () => {
    const result = create(recordFor('{"private_id":1,"note":"NAME-CANARY"}'), {memberNames: "  private-id \r\n PRIVATE_ID\n", exactText: " NAME-CANARY \n"});
    assert.equal(payloadOf(result), '{"private_id":"[REDACTED]","note":"[REDACTED]"}');
    assert.ok(!result.text.includes("NAME-CANARY")); assert.ok(!result.text.includes("PRIVATE_ID"));
});

for (const options of [{memberNames: null}, {exactText: []}, {memberNames: "x".repeat(129)}, {exactText: "x".repeat(8193)},
                       {memberNames: "_ -"}, {exactText: Array.from({length: 65}, (_, i) => `rule${i}`).join("\n")}]) {
    test(`invalid or excessive rules refuse without producing a copy: ${JSON.stringify(options).slice(0, 55)}`, () => {
        assert.throws(() => create(recordFor("{}"), options), RangeError);
    });
}

for (const [name, payload] of [["bytes", JSON.stringify({note: "海".repeat(22000)})],
                               ["tokens", JSON.stringify(Array.from({length: 8200}, () => 0))], ["depth", "[".repeat(65) + "0" + "]".repeat(65)]]) {
    test(`redaction refuses the complete payload at its ${name} budget`, () => {
        assert.throws(() => create(recordFor(payload)), RangeError);
    });
}

test("invalid record structure, byte counts, UTF-8 and saved payload syntax stay rejected", () => {
    const record = recordFor("{}"); record.result.byteLength++;
    assert.throws(() => create(record), /byte count/);
    assert.throws(() => create(recordFor('{"truncated":')), /complete strict JSON/);
    assert.throws(() => create("{}"), /formatVersion 1/);
    assert.throws(() => createLensSharingCopy(Buffer.from([0xff])), /strict UTF-8/);
});

test("a full-size valid source can expand into a complete output without truncation", () => {
    const payload = JSON.stringify(Array.from({length: 7000}, () => 0)), result = create(recordFor(payload), {exactText: "0"});
    assert.equal(result.counts.total, 7000); assert.equal(JSON.parse(payloadOf(result)).length, 7000);
    assert.ok(Buffer.byteLength(result.text) < 1048576);
    assert.equal(result.review.total, 7000); assert.equal(result.review.rows.length, 128);
    assert.equal(result.review.truncated, true); assert.equal(result.review.rows[127].path, "$[127]");
});

test("local review locates duplicate escaped members and array fields in source order", () => {
    const payload = '{"token":1,"\\u0074oken":2,"rows":[{"password":false},"literal"]}';
    const result = create(recordFor(payload), {exactText: "literal"});
    assert.deepEqual(result.review.rows.map(row => [row.path, row.action, row.reason]), [
        ['$["token"]#1', "value", "member-name"], ['$["token"]#2', "value", "member-name"],
        ['$["rows"][0]["password"]', "value", "member-name"], ['$["rows"][1]', "value", "literal-text"]
    ]);
    assert.equal(result.review.total, result.counts.total); assert.equal(result.review.truncated, false);
    assert.deepEqual(Object.keys(JSON.parse(result.text).redaction), ["valuesReplaced", "keysReplaced", "omitted", "method"]);
    assert.ok(!result.text.includes('"review"'));
});

test("local review uses only renamed keys, including renamed ancestors of other replacements", () => {
    const result = create(recordFor('{"NAME-CANARY":{"password":"VALUE-CANARY","NAME-CANARY":"VALUE-CANARY"}}'),
        {exactText: "NAME-CANARY\nVALUE-CANARY"});
    const review = JSON.stringify(result.review);
    assert.ok(!review.includes("NAME-CANARY")); assert.ok(!review.includes("VALUE-CANARY"));
    assert.deepEqual(result.review.rows.map(row => row.path), [
        '$["[REDACTED KEY 2]"]', '$["[REDACTED KEY 2]"]["password"]',
        '$["[REDACTED KEY 2]"]["[REDACTED KEY 1]"]', '$["[REDACTED KEY 2]"]["[REDACTED KEY 1]"]'
    ]);
    assert.deepEqual(result.review.rows.map(row => row.action), ["key", "value", "key", "value"]);
    assert.ok(!result.text.includes("CANARY"));
});

test("whole-subtree review suppresses descendants but retains a separate key rename", () => {
    const result = create(recordFor('{"secret":{"token":"HIDDEN","password":["HIDDEN"]}}'), {exactText: "secret\nHIDDEN"});
    assert.equal(result.review.total, 2);
    assert.deepEqual(result.review.rows.map(row => [row.path, row.action, row.reason]), [
        ['$["[REDACTED KEY 1]"]', "key", "literal-text"], ['$["[REDACTED KEY 1]"]', "subtree", "member-name"]
    ]);
    assert.ok(!JSON.stringify(result.review).includes("HIDDEN"));
});

test("original payload positions count Unicode characters and CRLF lines", () => {
    const result = create(recordFor('[\r\n "海😀", "secret"\r\n]'), {exactText: "secret"});
    assert.deepEqual(result.review.rows, [{path: "$[1]", shortened: false, line: 2, column: 8, action: "value", reason: "literal-text"}]);
    assert.equal(payloadOf(result), '[\r\n "海😀", "[REDACTED]"\r\n]');
});

test("scalar evidence remains refused and already-redacted matches still describe replacement operations", () => {
    assert.throws(() => create(recordFor('  "secret"'), {exactText: "secret"}), /object or array/);
    const same = create(recordFor('{"token":"[REDACTED]"}'));
    assert.equal(payloadOf(same), '{"token":"[REDACTED]"}'); assert.equal(same.review.total, 1);
});

test("zero-match review is empty without implying that untouched values are safe", () => {
    const result = create(recordFor('{"unknown":"PRIVATE-UNRECOGNIZED"}'));
    assert.deepEqual(result.review, {rows: [], total: 0, truncated: false});
    assert.ok(result.text.includes("PRIVATE-UNRECOGNIZED")); assert.match(result.text, /Not an exhaustive secret detector/);
});

test("long review paths are explicitly shortened within 512 units without broken surrogate pairs", () => {
    for (const key of ["x".repeat(507), "😀".repeat(300)]) {
        const result = create(recordFor(JSON.stringify({[key]: {token: "hidden"}}))), row = result.review.rows[0];
        assert.equal(row.shortened, true); assert.ok(row.path.length <= 512); assert.ok(row.path.endsWith("…"));
        assert.ok(!/[\uD800-\uDBFF]…$/.test(row.path)); assert.equal(row.line, 1);
    }
});
