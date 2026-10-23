import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import log from "loglevel";
import Magic from "../../src/core/operations/Magic.mjs";
import Dish from "../../src/core/Dish.mjs";
import {inspectJsonWrappers} from "../../src/core/lib/MagicWrappers.mjs";
import {investigatePayloadTrail} from "../../src/core/lib/MagicPayloadTrail.mjs";
import {prepareMagicRecipes, replayMagicRecipe} from "../../src/core/lib/MagicEvidenceReplay.mjs";

log.setLevel("silent", false);
const encode = text => Buffer.from(typeof text === "string" ? text : JSON.stringify(text)).toString("base64url");
const body = ' {"account":9007199254740993,"role":"viewer","\\u0072ole":"admin","note":"海 😀"}\r\n';
const token = (header={alg: "HS256"}, payload=body, signature="A".repeat(43)) => `${encode(header)}.${encode(payload)}.${signature}`;
const inspect = (input, options={}) => inspectJsonWrappers(Buffer.from(input), recipe => replayMagicRecipe(recipe, Buffer.from(input)), {prepare: prepareMagicRecipes, ...options});
const trail = (input, options={}) => investigatePayloadTrail(Buffer.from(input), {replay: recipe => replayMagicRecipe(recipe, Buffer.from(input)), prepare: prepareMagicRecipes, ...options});

for (const [name, wrap] of [
    ["full field", value => `Authorization: Bearer ${value}`],
    ["case-insensitive names", value => `authorization: bearer ${value}`],
    ["horizontal field whitespace and CRLF", value => `\tAUTHORIZATION:\tBEARER   ${value}\t\r\n`],
    ["bare field value", value => `Bearer ${value}`],
    ["bare value with outer whitespace and LF", value => `\tBearer ${value}  \n`],
    ["no optional space after colon", value => `Authorization:Bearer ${value}\n`]
]) test(`${name}: preserve complete input, payload and native prefix replay`, async () => {
    const input = wrap(token()), report = await inspect(input);
    const candidate = report.candidates.find(item => item.accepted);
    assert.ok(candidate, report.reason);
    assert.equal(report.original, input);
    assert.equal(candidate.origin, "bearer-field");
    assert.equal(candidate.evidence.text, body);
    assert.equal(candidate.recipe.length, 3);
    assert.equal(candidate.recipe[0].op, "Regular expression");
    assert.match(candidate.interpretationWarnings.join(" "), /Bearer label does not verify/);
    assert.equal(Buffer.from(await replayMagicRecipe(candidate.recipe, Buffer.from(input))).toString(), body);
    assert.equal(Buffer.from(await replayMagicRecipe(candidate.headerRecipe, Buffer.from(input))).toString(), '{"alg":"HS256"}');
    assert.notEqual(Buffer.from(await replayMagicRecipe(candidate.recipe, Buffer.from(input + " extra"))).toString(), body);
});

test("canonical short, ECDSA-sized and RSA-sized fields remain unverified data", async () => {
    for (const size of [1, 32, 64, 132, 256, 512]) {
        const report = await inspect("Authorization: Bearer " + token({alg: "example-algorithm"}, body, Buffer.alloc(size, 19).toString("base64url")));
        const candidate = report.candidates.find(item => item.accepted);
        assert.ok(candidate, String(size));
        assert.equal(candidate.evidence.text, body);
        assert.match(candidate.resultRole, /unverified/);
    }
});

test("an explicitly unsigned field can be inspected without granting integrity", async () => {
    const report = await inspect("Bearer " + token({alg: "none"}, body, ""));
    const candidate = report.candidates.find(item => item.accepted);
    assert.ok(candidate);
    assert.match(candidate.interpretationWarnings.join(" "), /Unsigned token/);
});

test("arrays stay generic JSON, not a valid JWT Claims Set", async () => {
    const candidate = (await inspect("Bearer " + token({alg: "RS256"}, '[1,{"x":true}]', Buffer.alloc(256).toString("base64url")))).candidates.find(item => item.accepted);
    assert.ok(candidate);
    assert.match(candidate.interpretationWarnings.join(" "), /not a JWT Claims Set/);
});

test("quotes, duplicate fields, extra credentials and unsupported copied contexts acquire no payload action", async () => {
    const value = token();
    for (const input of [`Authorization: Bearer "${value}"`, `Authorization: Bearer ${value},${value}`,
                         `Authorization: Bearer ${value} extra`, `Authorization: Bearer ${value}\r\nAuthorization: Bearer ${value}`,
                         `Authorization: Bearer\r\n ${value}`, `Authorization: Bearer ${value}\n\n`,
                         `Authorization: Bearer\t${value}`, `Authorization: Bearer\u00a0${value}`, `Bearer \u00a0${value}`,
                         `Authorization : Bearer ${value}`, `Proxy-Authorization: Bearer ${value}`, `Basic ${value}`,
                         `Authorization: Basic ${value}`, `GET / HTTP/1.1\r\nAuthorization: Bearer ${value}\r\n`,
                         `curl -H 'Authorization: Bearer ${value}'`, "Authorization: Bearer mF_9.B5f-4.1JqM", "Bearer "]) {
        const report = await inspect(input);
        assert.ok(!report.candidates.some(item => item.accepted), input);
        assert.ok(!(await trail(input)).outputs.some(item => item.text === body), input);
    }
});

test("canonical compact syntax is required before native header/payload decoding", async () => {
    for (const value of [token() + ".extra", token().replace(/\.[^.]+$/, ".AB"), token().replace(/\.[^.]+$/, ".A"),
                         token().replace(/\.[^.]+$/, ".AAAA="), token().replace(/\.[^.]+$/, ".AA+A"),
                         `${encode({alg: "HS256"})}..${"A".repeat(43)}`, `${encode({alg: "HS256"})}=.${encode(body)}.${"A".repeat(43)}`]) {
        let replays = 0;
        const result = await inspectJsonWrappers(Buffer.from("Bearer " + value), async () => {
            replays++; return Buffer.from("{}");
        });
        assert.equal(replays, 0);
        assert.ok(!result.candidates.some(item => item.accepted));
    }
});

test("copied Bearer fields never bypass strict compact-header refusals", async () => {
    for (const header of [{}, [], {alg: ""}, {alg: 4}, {alg: "none"}, {alg: "HS256", enc: "A128GCM"},
                          {alg: "HS256", zip: "DEF"}, {alg: "HS256", crit: []}, {alg: "HS256", b64: false},
                          {alg: "HS256", b64: "true"}, '{"alg":"HS256","alg":"RS256"}', String.raw`{"alg":"HS256","a\u006cg":"RS256"}`]) {
        const input = "Authorization: Bearer " + token(header);
        const report = await inspect(input);
        assert.ok(!report.candidates.some(item => item.accepted), JSON.stringify(header));
        assert.ok(!report.candidates.some(item => item.compressed));
        assert.ok(!(await trail(input)).outputs.some(item => item.text === body));
    }
});

test("non-JSON, scalars, malformed UTF-8 and trailing text are not promoted", async () => {
    for (const payload of ["Payload", "null", "7", '"string"', '{"x":1}tail']) {
        assert.ok(!(await inspect("Bearer " + token({alg: "HS256"}, payload))).candidates.some(item => item.accepted));
    }
    const value = `${encode({alg: "HS256"})}._w.${"A".repeat(43)}`;
    assert.ok(!(await inspect("Bearer " + value)).candidates.some(item => item.accepted));
});

test("one named Bearer/compact carrier profile preserves complete trail witnesses", async () => {
    const input = "Authorization: Bearer " + token(), report = await trail(input);
    const output = report.outputs.find(item => item.text === body);
    assert.ok(output);
    assert.equal(report.original, input);
    assert.equal(output.sources[0].depth, 1);
    assert.match(output.sources[0].hops[0].kind, /Bearer/);
    assert.equal(Buffer.from(await replayMagicRecipe(output.sources[0].recipe, Buffer.from(input))).toString(), body);
    assert.ok(!(await trail(input, {maxDepth: 0})).outputs.some(item => item.text === body));
});

test("shared limits, cancellation, loader errors and bare-token behavior are retained", async () => {
    const input = "Bearer " + token();
    for (const options of [{maxCandidates: 1}, {maxMillis: 0}, {maxOutputBytes: 8}]) {
        const report = await inspect(input, options);
        assert.equal(report.status, "incomplete");
        assert.ok(!report.candidates.some(item => item.accepted));
    }
    const controller = new AbortController(); controller.abort();
    assert.equal((await inspect(input, {signal: controller.signal})).status, "cancelled");
    const failed = await inspectJsonWrappers(Buffer.from(input), () => {
        throw new Error("must not replay");
    }, {prepare: async()=>{
        throw new Error("injected loader failure");
    }});
    assert.equal(failed.status, "incomplete");
    assert.ok(!failed.candidates.some(item => item.accepted));
    const bare = await inspect(token());
    assert.ok(bare.candidates.some(item => item.accepted && item.evidence.text === body));
    assert.ok(!bare.candidates.some(item => item.origin === "bearer-field"));
    await assert.rejects(() => inspect("Bearer " + "A".repeat(65536)), /64 KiB/);
});

for (const goal of ["JSON object or array", "JSON wrappers", "JSON payload trail"]) test(`${goal} keeps copied-field warnings before actions and escapes payload text`, async () => {
    const input = "Authorization: Bearer " + token({alg: "HS256"}, body.replace("viewer", "<img src=x onerror=alert(731)>"));
    const args = [3, false, false, "", goal], operation = new Magic();
    const dish = new Dish(new TextEncoder().encode(input).buffer, Dish.ARRAY_BUFFER);
    await operation.run({dish, progress: 0, opList: [{ingValues: args, config: {op: "Magic", args}}]});
    const html = operation.present();
    assert.doesNotMatch(html, /<img/);
    assert.match(html, /&lt;img/);
    assert.match(html, /Bearer label does not verify/);
    const action = goal === "JSON payload trail" ? "Load full JSON recipe" : "Load payload recipe";
    assert.ok(html.indexOf("Bearer label does not verify") < html.lastIndexOf(action));
    assert.equal((await dish.get(Dish.JSON)).original, input);
});

test("the shipped fictional Bearer fixture replays to the existing exact reference payload", async () => {
    const input = readFileSync(new URL("../../examples/lens-bearer-header.txt", import.meta.url), "utf8");
    const target = readFileSync(new URL("../../examples/lens-investigation-payload.txt", import.meta.url), "utf8");
    const candidate = (await inspect(input)).candidates.find(item => item.accepted);
    assert.ok(candidate);
    assert.equal(candidate.evidence.text, target);
});
