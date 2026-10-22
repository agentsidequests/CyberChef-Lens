import {test} from "node:test";
import assert from "node:assert/strict";
import {deflateSync, deflateRawSync, gzipSync, inflateSync} from "node:zlib";
import {boundedZlib} from "../../src/core/lib/BoundedZlib.mjs";
import Operation from "../../src/core/operations/ZlibInflateBounded.mjs";
import {validateJsonDocument} from "../../src/core/lib/MagicEvidence.mjs";

const compress = value => new Uint8Array(deflateSync(Buffer.from(value)));
const text = result => new TextDecoder("utf-8", {fatal: true}).decode(result.bytes);

test("low-level decoder matches independent platform bytes on representative JSON text", () => {
    for (const body of [' { "a":900719925474099312345, "a":2 }\n', '[1,"海",null]', "{}", '{"tail":"complete"}']) {
        const packed = new Uint8Array(deflateSync(Buffer.from(body)));
        const oracle = inflateSync(packed, {maxOutputLength: 1048576});
        const result = boundedZlib(packed);
        assert.equal(result.status, "passed");
        assert.deepEqual(Buffer.from(result.bytes), oracle);
        assert.equal(result.inputBytes, result.consumedBytes);
        assert.equal(result.stateFreed, true);
        assert.deepEqual(Buffer.from(new Operation().run(packed.slice().buffer, [1048576])), oracle);
    }
});
test("changed Unicode, empty containers and compression modes preserve every output byte", () => {
    for (const value of [{city: "海 🛰", text: "<script>no execution</script>", value: -1.25}, [], {}, [true, null, 1]]) {
        for (const options of [{level: 0}, {level: 9}, {strategy: 4}]) {
            const expected = JSON.stringify(value);
            const input = new Uint8Array(deflateSync(Buffer.from(expected), options));
            assert.equal(text(boundedZlib(input)), expected);
        }
    }
});
test("exact output cap passes; one-byte overflow never returns a valid-looking prefix", () => {
    const body = '{"ok":true}';
    for (const limit of [body.length - 1, body.length, body.length + 1]) {
        const result = boundedZlib(compress(body), {maxOutputBytes: limit});
        assert.equal(result.status, limit < body.length ? "incomplete" : "passed");
        assert.ok(result.retainedBytes <= limit);
        assert.ok(result.emittedBytes <= limit + 1);
        if (result.status !== "passed") assert.equal(result.bytes, undefined);
    }
});
test("controlled oversized input stops producing at cap plus one and frees decoder state", () => {
    const body = JSON.stringify({text: "x".repeat(1310720)});
    const result = boundedZlib(compress(body));
    assert.equal(result.reason, "output-limit");
    assert.equal(result.emittedBytes, 1048577);
    assert.equal(result.retainedBytes, 1048576);
    assert.ok(result.maxChunkBytes <= 16384);
    assert.equal(result.bytes, undefined);
    assert.equal(result.stateFreed, true);
});
test("trailing text, an extra stream, wrong framing, checksums and missing ends fail closed", () => {
    const good = compress('{"ok":true}');
    const bad = good.slice();
    bad[bad.length - 1] ^= 1;
    const inputs = [bad, ...[1, 2, 3, 4, 5].map(n => good.slice(0, -n)),
                    Buffer.concat([good, Buffer.from("tail")]), Buffer.concat([good, good]),
                    deflateRawSync(Buffer.from("{}")), gzipSync(Buffer.from("{}")), new Uint8Array([0, 1, 2])];
    for (const input of inputs) {
        const result = boundedZlib(new Uint8Array(input));
        assert.notEqual(result.status, "passed");
        assert.equal(result.bytes, undefined);
        assert.equal(result.stateFreed, true);
    }
    const dictionary = deflateSync(Buffer.from("dictionary dictionary"), {dictionary: Buffer.from("dictionary")});
    assert.equal(boundedZlib(new Uint8Array(dictionary)).reason, "dictionary-required");
});
test("stream validity alone cannot promote scalar, invalid UTF-8 or malformed-tail JSON", () => {
    for (const raw of [Buffer.from("42"), Buffer.from('{"x":1} trailing'), Buffer.from([0xff, 0xfe])]) {
        const result = boundedZlib(new Uint8Array(deflateSync(raw)));
        assert.equal(result.status, "passed");
        assert.notEqual(validateJsonDocument(result.bytes).status, "passed");
    }
});
test("pre-cancellation and zero clock retain no output; input and option bounds fail before decoding", () => {
    const controller = new AbortController();
    controller.abort();
    for (const options of [{signal: controller.signal}, {maxMillis: 0}]) {
        const result = boundedZlib(compress("{}"), options);
        assert.equal(result.status, "incomplete");
        assert.equal(result.emittedBytes, 0);
        assert.equal(result.bytes, undefined);
        assert.equal(result.stateFreed, true);
    }
    assert.throws(() => boundedZlib(new Uint8Array(65537)), RangeError);
    for (const maxOutputBytes of [0, 1048577, 1.5]) assert.throws(() => boundedZlib(compress("{}"), {maxOutputBytes}), RangeError);
});
test("native argument metadata enforces the range; no generic Magic signature is added", () => {
    const op = new Operation();
    assert.deepEqual(op.checks || [], []);
    assert.equal(op.module, "BoundedCompression");
    for (const limit of [0, 1048577, 1.5]) assert.throws(() => op.validateIngredients([limit]));
    op.validateIngredients([1048576]);
    assert.throws(() => op.run(new ArrayBuffer(65537), [1048576]), /64 KiB/);
});
