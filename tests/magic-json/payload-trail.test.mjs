import {test, before} from "node:test";
import assert from "node:assert/strict";
import {deflateRawSync} from "node:zlib";
import log from "loglevel";
import {investigatePayloadTrail, recognizeTrailTransports} from "../../src/core/lib/MagicPayloadTrail.mjs";
import {prepareMagicRecipes, replayMagicRecipe} from "../../src/core/lib/MagicEvidenceReplay.mjs";

const encode = text => Buffer.from(text).toString("base64url");
const signature = "A".repeat(43);
const envelope = (payload, protectedHeader='{"alg":"HS256"}') => JSON.stringify({protected: encode(protectedHeader), payload: encode(payload), signature});
const cookie = payload => `session=${Buffer.from(payload).toString("base64")}; session.sig=${signature}`;
const compact = payload => `${encode('{"alg":"none"}')}.${encode(payload)}.`;
const percent = text => [...Buffer.from(text)].map(byte => `%${byte.toString(16).padStart(2, "0")}`).join("");
const target = ' {"ticket":"LENS-204","amount":9007199254740993123,"note":"海 😀","id":1,"id":2}\n';
const inspect = (text, options={}) => {
    const input = Buffer.from(text);
    return investigatePayloadTrail(input, {replay: recipe => replayMagicRecipe(recipe, input), prepare: prepareMagicRecipes, ...options});
};
before(async () => {
    log.setLevel("silent", false); await prepareMagicRecipes([]);
});

for (const [name, wrap, depth] of [
    ["Base64 to Cookie to envelope", text => Buffer.from(cookie(envelope(text))).toString("base64"), 3],
    ["percent to Base64 to compressed compact token", text => percent(Buffer.from(`${encode('{"alg":"ES256","zip":"DEF"}')}.${deflateRawSync(Buffer.from(text)).toString("base64url")}.${"A".repeat(86)}`).toString("base64")), 3],
    ["JSON envelope to compact token", text => envelope(compact(text)), 2],
    ["Cookie to compact token", text => cookie(compact(text)), 2],
    ["hexadecimal to Cookie", text => Buffer.from(cookie(text)).toString("hex"), 2]
]) test(`${name} keeps exact text and a full original-input native witness`, async () => {
    const input = wrap(target), result = await inspect(input);
    const output = result.outputs.find(item => item.text === target);
    assert.ok(output, JSON.stringify(result.stops));
    assert.equal(output.sources[0].depth, depth);
    assert.equal(result.original, input);
    for (const source of output.sources) {
        assert.equal(new TextDecoder().decode(await replayMagicRecipe(source.recipe, Buffer.from(input))), target);
        for (const hop of source.hops) assert.equal(new TextDecoder().decode(await replayMagicRecipe(hop.recipe, Buffer.from(input))), result.nodes[hop.nodeId].text);
    }
});

test("outer JSON and a deeper payload remain distinct layers, never a chosen meaning", async () => {
    const input = envelope(target), result = await inspect(input);
    assert.equal(result.outputs[0].text, target);
    assert.ok(result.outputs.some(output => output.text === input && output.sources[0].depth === 0));
    assert.match(result.scope, /not more trustworthy/);
});

test("valid JSON containing escapes is not globally decoded into a different meaning", async () => {
    const input = '{"note":"%41%42","encoded":"eyJ4IjoxfQ=="}';
    const result = await inspect(input);
    assert.deepEqual(result.outputs.map(output => output.text), [input]);
    assert.equal(result.checkedReplays, 0);
});

test("a refused protected header at an intermediate layer never earns an inner payload action", async () => {
    for (const header of ['{"alg":"HS256","crit":["unknown"]}', '{"alg":"HS256","b64":false}', '{"alg":"HS256","alg":"none"}']) {
        const input = Buffer.from(envelope(target, header)).toString("base64");
        const result = await inspect(input);
        assert.ok(!result.outputs.some(output => output.text === target));
        assert.ok(result.stops.some(stop => /refusal|not-followed/.test(stop.reason)));
    }
});

test("a missing signature remains refused after transport decoding", async () => {
    const input = encode(`${encode('{"alg":"HS256"}')}.${encode(target)}.`);
    const result = await inspect(input);
    assert.ok(!result.outputs.some(output => output.text === target));
    assert.ok(result.stops.some(stop => /missing|empty/i.test(stop.detail || "")));
});

test("noncanonical Base64 padding bits and malformed percent UTF-8 are not repaired", () => {
    for (const text of ["e31=", "e31", "e30==", "%7B%22x%22%3A%22%FF%22%7D", "%7Q"]) assert.equal(recognizeTrailTransports(text).length, 0, text);
    assert.equal(recognizeTrailTransports('{"x":"%41"}').length, 0);
});

test("depth ceilings preserve checked earlier layers without reaching a deeper target", async () => {
    const input = envelope(compact(target)), result = await inspect(input, {maxDepth: 1});
    assert.ok(!result.outputs.some(output => output.text === target));
    assert.ok(result.depthLimited);
    assert.equal(result.original, input);
});

test("replay/state/retained-byte budgets stop without an out-of-budget result", async () => {
    const input = cookie(target);
    for (const [options, reason] of [[{maxReplays: 0}, "replay-limit"], [{maxStates: 1}, "state-limit"], [{maxRetainedBytes: Buffer.byteLength(input)}, "retained-byte-limit"]]) {
        const result = await inspect(input, options);
        assert.equal(result.status, "incomplete");
        assert.equal(result.reason, reason);
        assert.ok(!result.outputs.some(output => output.text === target));
    }
});

test("cancellation and a zero exploration clock accept no late witness", async () => {
    const controller = new AbortController();
    controller.abort();
    for (const options of [{signal: controller.signal}, {maxMillis: 0}]) {
        const result = await inspect(cookie(target), options);
        assert.equal(result.checkedReplays, 0);
        assert.equal(result.outputs.length, 0);
    }
    const during = new AbortController();
    const result = await inspect(encode(target), {signal: during.signal, replay: async () => {
        during.abort(); return Buffer.from(target);
    }});
    assert.equal(result.status, "cancelled");
    assert.equal(result.outputs.length, 0);
});

test("an identity/no-op replay cannot grow the trail", async () => {
    const input = encode(target);
    const result = await inspect(input, {replay: async () => Buffer.from(input)});
    assert.equal(result.nodes.length, 1);
    assert.equal(result.outputs.length, 0);
});

test("an oversized native output is not retained or offered", async () => {
    const result = await inspect(encode(target), {maxOutputBytes: 32});
    assert.equal(result.reason, "output-limit");
    assert.equal(result.outputs.length, 0);
});

test("input, type and budget validation happen before replay", async () => {
    await assert.rejects(() => investigatePayloadTrail(Buffer.alloc(65537), {replay: async () => {
        throw new Error("unreachable");
    }}), /64 KiB/);
    await assert.rejects(() => investigatePayloadTrail("not bytes", {replay: async () => new ArrayBuffer(0)}), TypeError);
    await assert.rejects(() => inspect("{}", {maxDepth: 6}), RangeError);
    await assert.rejects(() => inspect("{}", {maxStates: 0}), RangeError);
});
