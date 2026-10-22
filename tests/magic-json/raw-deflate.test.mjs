import {test} from "node:test";
import assert from "node:assert/strict";
import {deflateRawSync, deflateSync, gzipSync, inflateRawSync} from "node:zlib";
import {boundedRawDeflate, boundedZlib} from "../../src/core/lib/BoundedZlib.mjs";
import Operation from "../../src/core/operations/RawInflateBounded.mjs";

test("raw streams match the independent platform oracle on complete exact JSON text", () => {
    for (const body of [' { "a":900719925474099312345, "a":2 }\n', '[1,"海",null]', "{}", '{"tail":"complete"}']) {
        const input = new Uint8Array(deflateRawSync(Buffer.from(body)));
        const result = boundedRawDeflate(input);
        assert.equal(result.status, "passed");
        assert.deepEqual(Buffer.from(result.bytes), inflateRawSync(input, {maxOutputLength: 1048576}));
        assert.equal(new TextDecoder().decode(result.bytes), body);
        assert.equal(result.stateFreed, true);
        assert.equal(result.consumedBytes, input.length);
        assert.deepEqual(Buffer.from(new Operation().run(input.slice().buffer, [1048576])), Buffer.from(result.bytes));
    }
});
test("raw stored, fixed and dynamic streams preserve Unicode, arrays and sliced byte views", () => {
    for (const value of [{city: "海 🛰", list: [true, null, 1.2]}, {}, [], {n: "a".repeat(32768)}]) {
        const expected = Buffer.from(JSON.stringify(value));
        for (const options of [{level: 0}, {level: 9}, {strategy: 4}]) {
            const compressed = deflateRawSync(expected, options);
            const backing = Buffer.concat([Buffer.from("before"), compressed, Buffer.from("after")]);
            const input = backing.subarray(6, 6 + compressed.length);
            const result = boundedRawDeflate(input);
            assert.equal(result.status, "passed");
            assert.deepEqual(Buffer.from(result.bytes), expected);
            assert.equal(result.consumedBytes, compressed.length);
        }
    }
});
test("raw exact cap passes and overflow produces at most one extra byte with no returned prefix", () => {
    const expected = Buffer.from('{"ok":true}');
    for (const maxOutputBytes of [expected.length - 1, expected.length, expected.length + 1]) {
        const result = boundedRawDeflate(new Uint8Array(deflateRawSync(expected)), {maxOutputBytes});
        assert.equal(result.status, maxOutputBytes < expected.length ? "incomplete" : "passed");
        assert.ok(result.retainedBytes <= maxOutputBytes);
        assert.ok(result.emittedBytes <= maxOutputBytes + 1);
        if (result.status !== "passed") assert.equal(result.bytes, undefined);
    }
    const bomb = boundedRawDeflate(new Uint8Array(deflateRawSync(Buffer.from("x".repeat(1310720)))));
    assert.equal(bomb.reason, "output-limit");
    assert.equal(bomb.emittedBytes, 1048577);
    assert.equal(bomb.retainedBytes, 1048576);
    assert.ok(bomb.maxChunkBytes <= 16384);
    assert.equal(bomb.bytes, undefined);
    assert.equal(bomb.stateFreed, true);
});
test("raw framing rejects every tested trailing, concatenated, truncated and dictionary-dependent stream", () => {
    for (const options of [{level: 0}, {level: 9}, {strategy: 4}]) {
        const good = deflateRawSync(Buffer.from('{"ok":true}'), options);
        for (const input of [good.subarray(0, -1), good.subarray(0, -2), new Uint8Array(), Buffer.from([0xff]),
                             ...[Buffer.from([0]), Buffer.from([0, 0]), Buffer.from("tail"), good].map(tail => Buffer.concat([good, tail])),
                             deflateSync(Buffer.from("{}")), gzipSync(Buffer.from("{}"))]) {
            const result = boundedRawDeflate(new Uint8Array(input));
            assert.notEqual(result.status, "passed");
            assert.equal(result.bytes, undefined);
            assert.equal(result.stateFreed, true);
        }
    }
    const dictionary = Buffer.from("unique-pattern-for-preset-dictionary");
    const packed = deflateRawSync(Buffer.from("unique-pattern-for-preset-dictionary unique-pattern-for-preset-dictionary"), {dictionary});
    assert.notEqual(boundedRawDeflate(new Uint8Array(packed)).status, "passed");
});
test("checksummed zlib mode keeps its checksum and never silently accepts a raw stream", () => {
    const payload = Buffer.from("{}");
    assert.equal(boundedZlib(new Uint8Array(deflateSync(payload))).status, "passed");
    assert.notEqual(boundedZlib(new Uint8Array(deflateRawSync(payload))).status, "passed");
    const damaged = deflateSync(payload); damaged[damaged.length - 1] ^= 1;
    assert.notEqual(boundedZlib(new Uint8Array(damaged)).status, "passed");
    const alteredValid = boundedRawDeflate(new Uint8Array(deflateRawSync(Buffer.from('{"altered":true}'))));
    assert.equal(alteredValid.status, "passed"); // No raw checksum or authenticity claim.
});
test("raw cancellation, zero clock and invalid bounds fail before useful output", () => {
    const controller = new AbortController(); controller.abort();
    const input = new Uint8Array(deflateRawSync(Buffer.from("{}")));
    for (const options of [{signal: controller.signal}, {maxMillis: 0}]) {
        const result = boundedRawDeflate(input, options);
        assert.equal(result.status, "incomplete");
        assert.equal(result.emittedBytes, 0);
        assert.equal(result.bytes, undefined);
        assert.equal(result.stateFreed, true);
    }
    assert.throws(() => boundedRawDeflate(new Uint8Array(65537)), RangeError);
    for (const maxOutputBytes of [0, 1048577, 1.2]) assert.throws(() => boundedRawDeflate(input, {maxOutputBytes}), RangeError);
});
test("raw operation metadata bounds arguments and adds no generic Magic discovery signature", () => {
    const op = new Operation();
    assert.deepEqual(op.checks || [], []);
    assert.equal(op.module, "BoundedCompression");
    for (const value of [0, 1048577, 1.2]) assert.throws(() => op.validateIngredients([value]));
    assert.throws(() => op.run(new ArrayBuffer(65537), [1048576]), /64 KiB/);
    assert.match(op.description, /no checksum/);
});
