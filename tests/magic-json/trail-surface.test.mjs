import {test, before} from "node:test";
import assert from "node:assert/strict";
import log from "loglevel";
import Magic from "../../src/core/operations/Magic.mjs";
import Dish from "../../src/core/Dish.mjs";
import Utils from "../../src/core/Utils.mjs";
import {prepareMagicRecipes, replayMagicRecipe} from "../../src/core/lib/MagicEvidenceReplay.mjs";
import {presentPayloadTrail} from "../../src/core/lib/MagicJsonPresentation.mjs";

const encode = text => Buffer.from(text).toString("base64url");
const signature = "A".repeat(43);
const compact = text => `${encode('{"alg":"none"}')}.${encode(text)}.`;
const envelope = text => JSON.stringify({protected: encode('{"alg":"HS256"}'), payload: encode(text), signature});
const cookie = text => `session=${Buffer.from(text).toString("base64")}; session.sig=${signature}`;
before(async () => {
    log.setLevel("silent", false); await prepareMagicRecipes([]);
});

/** Run the real operation between surrounding recipe steps. */
async function run(input, depth=3, crib="[") {
    const args = [depth, true, true, crib, "JSON payload trail"], operation = new Magic();
    const dish = new Dish(new TextEncoder().encode(input).buffer, Dish.ARRAY_BUFFER);
    const prefix = {op: "From Hex", args: ["Auto"]}, suffix = {op: "To Base64", args: ["A-Za-z0-9+/="]};
    await operation.run({dish, progress: 1, opList: [{config: prefix}, {ingValues: args, config: {op: "Magic", args}}, {config: suffix}]});
    return {operation, report: await dish.get(Dish.JSON), prefix, suffix};
}

test("the real Magic mode ignores crib/language/intensive, retains exact text, and presents full and layer actions", async () => {
    const target = ' {"id":900719925474099312345,"id":2,"note":"海 😀 <img src=x onerror=alert(731)>"}\n';
    const input = Buffer.from(cookie(envelope(target))).toString("base64");
    const {operation, report, prefix, suffix} = await run(input);
    const html = operation.present();
    assert.ok(report.outputs.some(output => output.text === target));
    assert.match(html, /Follow the payload/);
    assert.match(html, /Layer 3/);
    assert.match(html, /Load layer 1 recipe/);
    assert.match(html, /900719925474099312345/);
    assert.doesNotMatch(html, /<img|<script|<svg/i);
    assert.match(html, /&lt;img/);
    assert.ok(html.indexOf("Decoded, not verified") < html.indexOf("Load full JSON recipe"));
    const link = [...html.matchAll(/href="(#recipe=[^"]+)"/g)].find(match => match.index > html.indexOf('class="mj-action"'));
    const recipe = Utils.parseRecipeConfig(decodeURIComponent(Utils.unescapeHtml(link[1]).slice(8)));
    assert.deepEqual(recipe[0], prefix);
    assert.deepEqual(recipe.at(-1), suffix);
    assert.equal(new TextDecoder().decode(await replayMagicRecipe(recipe.slice(1, -1), Buffer.from(input))), target);
    assert.equal(report.original, input);
});

test("depth and size validation occurs at the operation boundary", async () => {
    for (const depth of [-1, 6, 1.5, NaN]) await assert.rejects(run("{}", depth), /integer depth/);
    await assert.rejects(run("a".repeat(65537)), /64 KiB/);
});

test("depth-ceiling and refusal views do not invent a usable inner result", async () => {
    const inner = '{"hidden":true}';
    const limited = await run(envelope(compact(inner)), 1);
    assert.ok(!limited.report.outputs.some(output => output.text === inner));
    assert.match(limited.operation.present(), /Depth ceiling reached/);
    const refused = `${encode('{"alg":"HS256","crit":["unknown"]}')}.${encode(inner)}.${signature}`;
    const result = await run(Buffer.from(refused).toString("base64"));
    assert.equal(result.report.outputs.length, 0);
    assert.doesNotMatch(result.operation.present(), /Load full JSON recipe/);
    assert.match(result.operation.present(), /wrapper-not-followed/);
});

test("presenter escapes stop metadata and labels a partial search even with a prior witness", () => {
    const report = {status: "incomplete", reason: '<svg onload="x">', nodes: [],
        outputs: [{text: "{}", byteLength: 2, sources: [{depth: 0, recipe: [], hops: [], warnings: []}]}],
        stops: [{node: 0, reason: "refusal", detail: "<img>"}],
        checkedReplays: 2, retainedBytes: 20, limits: {maxDepth: 3, maxStates: 16, maxReplays: 64, maxRetainedBytes: 2097152, maxOutputBytes: 1048576, maxMillis: 3000}};
    const html = presentPayloadTrail(report, {recipeUrl: () => "#recipe=", anyUrl: "#recipe=Magic()"});
    assert.match(html, /Search stopped early/);
    assert.match(html, /Keep original JSON/);
    assert.doesNotMatch(html, /<svg|<img/);
    assert.match(html, /&lt;svg/);
    assert.match(html, /&lt;img/);
});

test("switching an operation instance back to Any cannot leave a stale trail report", async () => {
    const {operation} = await run(compact("{}"));
    const args = [0, false, false, "", "Any"], dish = new Dish(new TextEncoder().encode("plain text").buffer, Dish.ARRAY_BUFFER);
    await operation.run({dish, progress: 0, opList: [{ingValues: args, config: {op: "Magic", args}}]});
    assert.equal(operation.trailReport, null);
    assert.doesNotMatch(operation.present(await dish.get(Dish.JSON)), /data-magic-trail-report/);
});
