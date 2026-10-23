import {test, before} from "node:test";
import assert from "node:assert/strict";
import {deflateSync, deflateRawSync} from "node:zlib";
import log from "loglevel";
import {investigatePayloadTrail} from "../../src/core/lib/MagicPayloadTrail.mjs";
import {prepareMagicRecipes, replayMagicRecipe} from "../../src/core/lib/MagicEvidenceReplay.mjs";

const b64 = text => Buffer.from(text).toString("base64url"), sig = "A".repeat(43);
const inspect = text => investigatePayloadTrail(Buffer.from(text), {prepare: prepareMagicRecipes, replay: recipe => replayMagicRecipe(recipe, Buffer.from(text))});
before(async () => {
    log.setLevel("silent", false); await prepareMagicRecipes([]);
});

const containers = [
    ["unsigned compact", text => `${b64('{"alg":"none"}')}.${b64(text)}.`],
    ["checksummed serializer", text => `.${deflateSync(Buffer.from(text)).toString("base64url")}.${sig}`],
    ["raw compressed compact", text => `${b64('{"alg":"ES256","zip":"DEF"}')}.${deflateRawSync(Buffer.from(text)).toString("base64url")}.${"A".repeat(86)}`],
    ["JSON envelope", text => JSON.stringify({protected: b64('{"alg":"HS256"}'), payload: b64(text), signature: sig})],
    ["paired Cookie", text => `data=${Buffer.from(text).toString("base64")}; data.sig=${sig}`]
];
const transports = [
    ["standard Base64", text => Buffer.from(text).toString("base64")],
    ["Base64url", b64],
    ["continuous hex", text => Buffer.from(text).toString("hex")],
    ["spaced hex", text => [...Buffer.from(text)].map(byte => byte.toString(16).padStart(2, "0")).join(" ")],
    ["percent", text => [...Buffer.from(text)].map(byte => `%${byte.toString(16).padStart(2, "0")}`).join("")]
];

for (const [outerName, outer] of transports) for (const [innerName, inner] of containers) test(`${outerName} / ${innerName}: composition and every offered witness`, async () => {
    const target = ' \n[{"n":-1.234567890123456789e+77,"emoji":"🛰️","duplicate":1,"duplicate":2},true,null]\t';
    const input = outer(inner(target)), report = await inspect(input);
    assert.equal(report.status, "complete", report.reason);
    assert.ok(report.outputs.some(output => output.text === target), `${outerName}/${innerName}`);
    for (const output of report.outputs) for (const source of output.sources) {
        assert.equal(new TextDecoder().decode(await replayMagicRecipe(source.recipe, Buffer.from(input))), output.text);
        for (const hop of source.hops) assert.equal(new TextDecoder().decode(await replayMagicRecipe(hop.recipe, Buffer.from(input))), report.nodes[hop.nodeId].text);
    }
});

test("unsupported, duplicate, encrypted and inconsistent intermediate profiles stay action-free", async () => {
    for (const header of ['{"alg":"HS256","enc":"A256GCM"}', '{"alg":"none"}', '{"alg":"HS256","alg":"HS256"}', '{"alg":"HS256","b64":false}', '{"alg":"HS256","crit":[]}']) {
        const input = b64(`${b64(header)}.${b64('{"private":"not-a-trusted-claim"}')}.${sig}`);
        const report = await inspect(input);
        assert.equal(report.outputs.length, 0, header);
    }
    for (const input of [b64(`data=e30=; data=e30=; data.sig=${sig}`),
                         b64(`{"payload":"e30","payload":"W10","protected":"${b64('{"alg":"HS256"}')}" ,"signature":"${sig}"}`)]) {
        const report = await inspect(input);
        assert.ok(!report.outputs.some(output => ["{}", "[]"].includes(output.text)));
        assert.ok(report.stops.some(stop => /refusal/.test(stop.reason)));
    }
});

test("scalar, malformed JSON and trailing binary data cannot become a complete JSON result", async () => {
    for (const target of ['"a string"', "42", "null", "true", '{"x":1}garbage', '{"x":1}\u0000', '{"x":', '{"x":NaN}']) {
        const report = await inspect(b64(containers[0][1](target)));
        assert.equal(report.outputs.length, 0, target);
    }
});
