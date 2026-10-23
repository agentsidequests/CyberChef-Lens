import {test} from "node:test";
import assert from "node:assert/strict";
import log from "loglevel";
import Magic from "../../src/core/operations/Magic.mjs";
import Dish from "../../src/core/Dish.mjs";
import {inspectJsonWrappers} from "../../src/core/lib/MagicWrappers.mjs";
import {prepareMagicRecipes, replayMagicRecipe} from "../../src/core/lib/MagicEvidenceReplay.mjs";

log.setLevel("silent", false);
const bytes = text => new TextEncoder().encode(text).buffer;
const encode = text => Buffer.from(typeof text === "string" ? text : JSON.stringify(text)).toString("base64url");
const body = ' {"case":"signature-shape","n":9007199254740993,"n":-0,"note":"海 😀"}\r\n';
const token = (header, payload=body, signature=Buffer.alloc(256, 19).toString("base64url")) => `${encode(header)}.${encode(payload)}.${signature}`;
const inspect = (input, options={}) => inspectJsonWrappers(bytes(input), recipe => replayMagicRecipe(recipe, bytes(input)), {prepare: prepareMagicRecipes, ...options});

for (const size of [1, 132, 256, 384, 512, 1024]) test(`canonical ${size}-byte signature field preserves exact JSON, without verification`, async () => {
    const input = token({alg: "RS256"}, body, Buffer.alloc(size, 19).toString("base64url"));
    const report = await inspect(input), candidate = report.candidates.find(item => item.accepted);
    assert.ok(candidate);
    assert.equal(candidate.evidence.text, body);
    assert.equal(candidate.compactVariant.signatureShapeOnly, true);
    assert.equal(candidate.compatibility.status, "shape-only");
    assert.match(candidate.interpretationWarnings.join(" "), /not been verified/);
    assert.equal(new TextDecoder().decode(await replayMagicRecipe(candidate.recipe, bytes(input))), body);
    assert.equal(report.original, input);
});

test("a header declaration and signature length never claim algorithm/key validity", async () => {
    const report = await inspect(token({alg: "example-unrecognized-algorithm"}));
    const candidate = report.candidates.find(item => item.accepted);
    assert.ok(candidate); assert.equal(candidate.compatibility.status, "shape-only");
    assert.match(candidate.kind, /signature unchecked/);
    assert.match(candidate.interpretationWarnings.join(" "), /algorithm\/key compatibility/);
});

test("generic JSON arrays remain arrays, not JWT Claims Set objects", async () => {
    const report = await inspect(token({alg: "ES512"}, '[1,{"fresh":true}]', Buffer.alloc(132).toString("base64url")));
    const candidate = report.candidates.find(item => item.accepted);
    assert.ok(candidate);
    assert.equal(candidate.compatibility.format, "JWS");
    assert.match(candidate.interpretationWarnings.join(" "), /not a JWT Claims Set/);
});

test("invalid or unsupported headers acquire no new payload action", async () => {
    for (const header of [{}, [], {alg: ""}, {alg: 7}, {alg: "none"}, {alg: "RS256", enc: "A128GCM"}, {alg: "RS256", zip: "DEF"},
                          {alg: "RS256", crit: []}, {alg: "RS256", b64: false}, {alg: "RS256", b64: "true"},
                          '{"alg":"RS256","alg":"HS256"}', String.raw`{"alg":"RS256","a\u006cg":"HS256"}`]) {
        const report = await inspect(token(header));
        assert.ok(!report.candidates.some(item => item.accepted), JSON.stringify(header));
        assert.ok(!report.candidates.some(item => item.compressed));
    }
});

test("noncanonical alphabets, pad bits, detached and extra fields remain unsupported", async () => {
    for (const signature of ["AB", "A", "A+AA", "A/AA", "A AAA", "AA$A", "AAA.AAA"]) {
        const report = await inspect(token({alg: "RS256"}, body, signature));
        assert.ok(!report.candidates.some(item => item.accepted), signature);
    }
    for (const input of [`${encode({alg: "RS256"})}..${"A".repeat(342)}`, token({alg: "RS256"})+".extra"]) {
        assert.ok(!(await inspect(input)).candidates.some(item => item.accepted));
    }
});

test("non-JSON, scalar and malformed UTF-8 fields do not become JSON payloads", async () => {
    for (const payload of ["Payload", '"scalar"', "5", "null", "{\"x\":1}tail"]) {
        assert.ok(!(await inspect(token({alg: "RS256"}, payload))).candidates.some(item => item.accepted));
    }
    const input = `${encode({alg: "RS256"})}.${Buffer.from([255]).toString("base64url")}.${"A".repeat(342)}`;
    assert.ok(!(await inspect(input)).candidates.some(item => item.accepted));
});

test("signature-independent extraction retains shared budgets, cancellation and loader failure", async () => {
    const input = token({alg: "RS256"});
    for (const options of [{maxCandidates: 1}, {maxMillis: 0}, {maxOutputBytes: 8}]) {
        const report = await inspect(input, options);
        assert.equal(report.status, "incomplete");
        assert.ok(!report.candidates.some(item => item.accepted));
    }
    const controller = new AbortController(); controller.abort();
    assert.equal((await inspect(input, {signal: controller.signal})).status, "cancelled");
    const report = await inspectJsonWrappers(bytes(input), () => {
        throw new Error("must not replay");
    }, {prepare: async()=>{
        throw new Error("injected loader failure");
    }});
    assert.equal(report.status, "incomplete");
    assert.ok(!report.candidates.some(item => item.accepted));
});

for (const goal of ["JSON object or array", "JSON wrappers", "JSON payload trail"]) test(`${goal} shows the signature warning before the replay action`, async () => {
    const input = token({alg: "RS256"}, body.replace("signature-shape", "<img src=x onerror=alert(731)>"));
    const args = [3, false, false, "", goal], operation = new Magic(), dish = new Dish(bytes(input), Dish.ARRAY_BUFFER);
    await operation.run({dish, progress: 0, opList: [{ingValues: args, config: {op: "Magic", args}}]});
    const html = operation.present(), report = await dish.get(Dish.JSON);
    assert.equal(report.original, input);
    assert.doesNotMatch(html, /<img/);
    assert.match(html, /&lt;img/);
    const action = goal === "JSON payload trail" ? "Load full JSON recipe" : "Load payload recipe";
    assert.ok(html.indexOf("Encoding shape only") >= 0);
    assert.ok(html.indexOf("Encoding shape only") < html.lastIndexOf(action));
    assert.match(html, /9007199254740993/);
});
