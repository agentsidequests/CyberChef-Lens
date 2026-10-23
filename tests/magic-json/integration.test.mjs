import {test, before} from "node:test";
import assert from "node:assert/strict";
import {deflateSync, deflateRawSync} from "node:zlib";
import log from "loglevel";
import Magic from "../../src/core/operations/Magic.mjs";
import Dish from "../../src/core/Dish.mjs";
import {inspectJsonWrappers} from "../../src/core/lib/MagicWrappers.mjs";
import {prepareMagicRecipes, replayMagicRecipe} from "../../src/core/lib/MagicEvidenceReplay.mjs";

const bytes = text => new TextEncoder().encode(text).buffer;
const encode = text => Buffer.from(text).toString("base64url");
const signature = "A".repeat(43);
const header = encode('{"alg":"HS256"}');
const inspect = input => inspectJsonWrappers(bytes(input), recipe => replayMagicRecipe(recipe, bytes(input)), {prepare: prepareMagicRecipes});
before(async () => {
    log.setLevel("silent", false); await prepareMagicRecipes([]);
});

for (const [name, wrap] of [
    ["ordinary compact", body => `${header}.${encode(body)}.${signature}`],
    ["raw-compressed compact", body => `${encode('{"alg":"ES256","zip":"DEF"}')}.${deflateRawSync(Buffer.from(body)).toString("base64url")}.${"A".repeat(86)}`],
    ["checksummed leading-dot serializer", body => `.${deflateSync(Buffer.from(body)).toString("base64url")}.${signature}`],
    ["paired cookie", body => `session=${Buffer.from(body).toString("base64")}; session.sig=${signature}`],
    ["JSON envelope", body => JSON.stringify({protected: header, payload: encode(body), signature})]
]) test(`${name} preserves exact JSON text and a native replay recipe`, async () => {
    const body = ' { "note":"海 😀 <img src=x onerror=alert(731)>", "id":900719925474099312345, "id":2 }\n';
    const input = wrap(body);
    const result = await inspect(input);
    const accepted = result.candidates.find(candidate => candidate.accepted);
    assert.ok(accepted, name);
    assert.equal(accepted.evidence.text, body);
    assert.equal(result.original, input);
    assert.equal(new TextDecoder().decode(await replayMagicRecipe(accepted.recipe, bytes(input))), body);
});

test("unsupported declarations and duplicate protected members never get an envelope payload action", async () => {
    for (const protectedText of ['{"alg":"HS256","b64":false}', '{"alg":"HS256","crit":["unknown"]}', '{"alg":"HS256","alg":"none"}']) {
        const input = JSON.stringify({protected: encode(protectedText), payload: encode('{"x":1}'), signature});
        const result = await inspect(input);
        assert.ok(!result.candidates.some(candidate => candidate.accepted));
    }
});

test("duplicate cookie names are refused instead of silently choosing one", async () => {
    const input = `a=e30=; a=e30=; a.sig=${signature}`;
    const result = await inspect(input);
    assert.equal(result.status, "unsupported");
    assert.equal(result.candidates.length, 0);
});

test("the real operation escapes hostile-looking text and keeps unsigned trust visible before the action", async () => {
    const body = '{"note":"<img src=x onerror=alert(731)>","__proto__":{"polluted":"no"}}';
    const input = `${encode('{"alg":"none"}')}.${encode(body)}.`;
    const args = [3, false, false, "", "JSON object or array"];
    const operation = new Magic();
    const dish = new Dish(bytes(input), Dish.ARRAY_BUFFER);
    await operation.run({dish, progress: 0, opList: [{ingValues: args, config: {op: "Magic", args}}]});
    const report = await dish.get(Dish.JSON), html = operation.present();
    assert.equal(report.original, input);
    assert.ok(report.outputs.some(output => output.text === body));
    assert.doesNotMatch(html, /<img|<script|<svg/i);
    assert.ok(html.includes("&lt;img"));
    assert.ok(html.indexOf("no authentication") < html.indexOf("Load payload recipe"));
    assert.equal({}.polluted, undefined);
});

test("two valid interpretations remain separate instead of selecting the most readable one", async () => {
    const input = '{"note":"%41%42%43%44"}';
    const args = [3, false, false, "", "JSON object or array"];
    const operation = new Magic(), dish = new Dish(bytes(input), Dish.ARRAY_BUFFER);
    await operation.run({dish, progress: 0, opList: [{ingValues: args, config: {op: "Magic", args}}]});
    const report = await dish.get(Dish.JSON);
    assert.ok(report.outputs.some(output => output.text === input));
    assert.ok(report.outputs.some(output => output.text === '{"note":"ABCD"}'));
    assert.match(operation.present(), /different JSON outputs/);
    assert.match(operation.present(), /Compare 2 checked texts/);
    assert.match(operation.present(), /JSON token text differs/);
    assert.match(operation.present(), /%41%42%43%44/);
    assert.match(operation.present(), /ABCD/);
});

for (const goal of ["JSON object or array", "JSON wrappers", "JSON payload trail"]) test(`${goal} adds cautions without changing the recovered text or replay`, async () => {
    const body = String.raw`{"role":"reader","\u0072ole":"admin","account":9007199254740993,"limit":1e400,"tiny":1e-4000}`;
    const input = `session=${Buffer.from(body).toString("base64")}; session.sig=${signature}`;
    const args = [3, false, false, "", goal], operation = new Magic(), dish = new Dish(bytes(input), Dish.ARRAY_BUFFER);
    await operation.run({dish, progress: 0, opList: [{ingValues: args, config: {op: "Magic", args}}]});
    const report = await dish.get(Dish.JSON), html = operation.present();
    const candidate = goal === "JSON wrappers" ? report.candidates.find(item=>item.accepted && item.evidence.text === body) : report.outputs.find(item=>item.text === body)?.sources[0];
    assert.ok(candidate);
    assert.equal(new TextDecoder().decode(await replayMagicRecipe(candidate.recipe, bytes(input))), body);
    assert.equal(report.original, input);
    assert.match(html, /4 parsing cautions/);
    assert.match(html, /Repeated member name/);
    assert.match(html, /9007199254740993/);
    assert.match(html, /Overflows JavaScript Number/);
    assert.match(html, /Nonzero number becomes zero/);
    const action = goal === "JSON payload trail" ? "Load full JSON recipe" : "Load payload recipe";
    assert.ok(html.indexOf("4 parsing cautions") < html.indexOf(action));
});
