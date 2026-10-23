import {test} from "node:test";
import assert from "node:assert/strict";
import log from "loglevel";
import Magic from "../../src/core/operations/Magic.mjs";
import Dish from "../../src/core/Dish.mjs";
import Utils from "../../src/core/Utils.mjs";
import {inspectJsonWrappers} from "../../src/core/lib/MagicWrappers.mjs";
import {prepareMagicRecipes, replayMagicRecipe} from "../../src/core/lib/MagicEvidenceReplay.mjs";

log.setLevel("silent", false);
const bytes = text => new TextEncoder().encode(text).buffer;
const encode = (text, padded=false) => Buffer.from(text).toString(padded ? "base64" : "base64url").replaceAll("+", "-").replaceAll("/", "_");
const token = (header, payload, signature="", padded=false) => `${encode(typeof header === "string" ? header : JSON.stringify(header), padded)}.${encode(payload, padded)}.${signature}`;
const examples = [
    {id: "synthetic-padded-fields", input: token({alg: "HS256"}, '{"foo":"paddedbar"}', "YQ==", true), expectedTexts: ['{"foo":"paddedbar"}']},
    {id: "unsigned-document-example", input: "eyJhbGciOiJub25lIn0.eyJoZWxsbyI6ICJ3b3JsZCJ9.", expectedTexts: ['{"hello": "world"}']}
];
const inspect = (input, options={}) => inspectJsonWrappers(bytes(input), recipe => replayMagicRecipe(recipe, bytes(input)), {prepare: prepareMagicRecipes, ...options});
/**
 *
 */
async function run(input, goal="JSON object or array") {
    const args = [3, false, false, "", goal], op = new Magic(), dish = new Dish(bytes(input), Dish.ARRAY_BUFFER);
    await op.run({dish, progress: 0, opList: [{ingValues: args, config: {op: "Magic", args}}]});
    return {op, report: await dish.get(Dish.JSON), html: op.present()};
}

for (const item of examples) test(`${item.id} yields exact native extraction in both modes`, async () => {
    const id = item.id;
    for (const goal of ["JSON object or array", "JSON wrappers"]) {
        const {report, html} = await run(item.input, goal);
        const candidates = goal === "JSON wrappers" ? report.candidates : report.wrappers.candidates;
        const candidate = candidates.find(item => item.accepted);
        assert.ok(candidate, `${id}/${goal}`);
        assert.equal(candidate.evidence.text, item.expectedTexts[0]);
        assert.equal(report.original, item.input);
        assert.match(html, /unverified|not authenticated/);
        assert.match(html, id === "synthetic-padded-fields" ? /Load field recipe/ : /Load payload recipe/);
        if (id === "synthetic-padded-fields") {
            assert.equal(candidate.compatibility.status, "incompatible");
            assert.ok(candidate.compatibility.reasons.includes("padded-fields"));
            assert.doesNotMatch(candidate.kind, /^JWT-shaped/);
            // The record also retains this warning in its copyable evidence text.
            // Count the actionable card header, not the separately disclosed record.
            const cardHead = /<div class="mj-head">([\s\S]*?)<\/div><div class="mj-body">/.exec(html)[1];
            assert.equal((cardHead.match(/Padded Base64url fields are inspectable data/g) || []).length, 1);
        } else {
            assert.match(candidate.resultRole, /unsigned/i);
            assert.match(candidate.interpretationWarnings.join(" "), /no signature|unsigned/i);
        }
        const fragment = Utils.unescapeHtml(/href="#recipe=([^"]+)"/.exec(html)[1]);
        const recipe = Utils.parseRecipeConfig(decodeURIComponent(fragment));
        const result = await replayMagicRecipe(recipe, bytes(item.input));
        assert.equal(new TextDecoder("utf8", {fatal: true}).decode(result), item.expectedTexts[0]);
    }
});

test("changed objects, arrays and exact lexical content survive both supported variants", async () => {
    const payloads = [' { "note":"海 😀 <img src=x>", "v":900719925474099312345, "n":-0, "v":2 }\n', '[1, {"fresh":"x"}]', "{}"];
    for (const payload of payloads) for (const input of [token({alg: "none"}, payload), token({alg: "RS256"}, payload, "YQ==", true)]) {
        const report = await inspect(input);
        const candidate = report.candidates.find(item => item.accepted);
        assert.ok(candidate);
        assert.equal(candidate.evidence.text, payload);
        assert.equal(report.original, input);
        if (payload.startsWith("[")) {
            assert.equal(candidate.compatibility.status, "incompatible");
            assert.ok(candidate.compatibility.reasons.includes("claims-not-object"));
        }
    }
});

test("new route refuses missing signatures, ambiguous headers and unsupported declarations", async () => {
    const headers = [{alg: "HS256"}, {alg: "NONE"}, {}, {alg: 7}, [], '{"alg":"HS256","alg":"none"}',
                     '{"alg":"HS256","a\\u006cg":"none"}', {alg: "none", enc: "A128GCM"}, {alg: "none", zip: "DEF"},
                     {alg: "none", b64: false}, {alg: "none", b64: "true"}, {alg: "none", crit: []}];
    for (const header of headers) {
        const report = await inspect(token(header, '{"x":1}'));
        assert.ok(!report.candidates.some(item => item.accepted), JSON.stringify(header));
        assert.doesNotMatch(report.interpretationWarnings?.join(" ") || "", /alg:none declares no signature/);
    }
    for (const header of [{alg: "RS256", zip: "DEF"}, {alg: "RS256", enc: "A128GCM"}, {alg: "RS256", crit: []}, {alg: "RS256", b64: false},
                          '{"alg":"HS256","alg":"RS256"}', {alg: "none"}]) {
        const report = await inspect(token(header, '{"x":1}', "YQ==", true));
        assert.ok(!report.candidates.some(item => item.accepted), JSON.stringify(header));
        assert.ok(!report.candidates.some(item => item.compressed));
    }
});

test("bad padding, nonzero pad bits, mixed alphabet, detached and extra fields acquire no new action", async () => {
    const header = encode('{"alg":"none"}');
    const inputs = [header+".e30==.", header+".e30===.", header+".e31=.", header+".e=30.", header+".e30= .", header+"==."+encode("{}")+".",
                    header+".e3+/.", header+"..", header+"."+encode("{}")+"..", header+"."+encode("{}")+".YQ==="];
    for (const input of inputs) {
        const report = await inspect(input);
        assert.ok(!report.candidates.some(item => item.accepted), input);
    }
});

test("invalid UTF-8, scalar, malformed-tail and encoded header without an object never become payloads", async () => {
    for (const body of ['"scalar"', "null", "5", '{"x":1} junk']) {
        const report = await inspect(token({alg: "none"}, body));
        assert.ok(!report.candidates.some(item => item.accepted));
    }
    const report = await inspect(encode('{"alg":"none"}')+"."+Buffer.from([255, 254]).toString("base64url")+".");
    assert.ok(!report.candidates.some(item => item.accepted));
});

test("the same evidence budget, cancellation and module failure boundaries govern both probes", async () => {
    const input = token({alg: "none"}, '{"fresh":true}');
    const limited = await inspect(input, {maxCandidates: 1});
    assert.equal(limited.status, "incomplete");
    assert.ok(!limited.candidates.some(item => item.accepted));
    const timed = await inspect(input, {maxMillis: 0});
    assert.equal(timed.status, "incomplete");
    assert.ok(!timed.candidates.some(item => item.accepted));
    const capped = await inspect(input, {maxOutputBytes: 8});
    assert.equal(capped.status, "incomplete");
    assert.ok(!capped.candidates.some(item => item.accepted));
    const controller = new AbortController(); controller.abort();
    const cancelled = await inspect(input, {signal: controller.signal});
    assert.equal(cancelled.status, "cancelled");
    assert.ok(!cancelled.candidates.some(item => item.accepted));
    const failed = await inspectJsonWrappers(bytes(input), () => {
        throw new Error("injected");
    }, {prepare: prepareMagicRecipes});
    assert.equal(failed.status, "incomplete");
    assert.ok(!failed.candidates.some(item => item.accepted));
    const startup = await inspectJsonWrappers(bytes(input), () => {
        throw new Error("must not replay");
    }, {prepare: async()=>{
        throw new Error("module unavailable");
    }});
    assert.equal(startup.status, "incomplete");
    assert.ok(!startup.candidates.some(item => item.accepted));
});

test("new fields remain inert HTML and preserve surrounding recipe steps", async () => {
    const {op} = await run(token({alg: "none"}, '{"fresh":"<script>bad()</script>"}'));
    const before = {op: "To Hex", args: ["Space", 0]}, after = {op: "To Base64", args: ["A-Za-z0-9+/="]};
    op.state.opList = [{config: before}, ...op.state.opList, {config: after}]; op.state.progress=1;
    const html = op.present();
    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /&lt;script&gt;/);
    for (const link of html.matchAll(/href="#recipe=([^"]+)"/g)) {
        const recipe = Utils.parseRecipeConfig(decodeURIComponent(Utils.unescapeHtml(link[1])));
        assert.deepEqual(recipe[0], before);
        assert.deepEqual(recipe.at(-1), after);
    }
});
