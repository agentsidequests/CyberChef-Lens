import {test, before} from "node:test";
import assert from "node:assert/strict";
import log from "loglevel";
import Magic from "../../src/core/operations/Magic.mjs";
import Dish from "../../src/core/Dish.mjs";
import Utils from "../../src/core/Utils.mjs";
import {recognizeJsonCarriers} from "../../src/core/lib/MagicCarriers.mjs";
import {prepareMagicRecipes, replayMagicRecipe} from "../../src/core/lib/MagicEvidenceReplay.mjs";

const payload = ' \r\n{"order_id":9007199254741099,"stage":"queued","\\u0073tage":"review","note":"海 🛰️"}\r\n';
const sig = "A".repeat(43), encoded = Buffer.from(payload).toString("base64");
const field = `Cookie: cart.v2=${encoded}; cart.v2.sig=${sig}`;
before(async () => {
    log.setLevel("silent", false); await prepareMagicRecipes([]);
});

for (const ending of ["\n", "\r\n"]) test(`a copied single Cookie field with ${JSON.stringify(ending)} preserves native replay`, async () => {
    const input = field + ending, report = recognizeJsonCarriers(input);
    assert.equal(report.status, undefined);
    assert.equal(report.candidates.length, 1);
    const output = await replayMagicRecipe(report.candidates[0].recipe, Buffer.from(input));
    assert.deepEqual(Buffer.from(output), Buffer.from(payload));
});

test("case and horizontal whitespace are preserved in input, not part of the payload", async () => {
    const input = "\t" + field.replace("Cookie:", "cOoKiE:") + "\t \r\n";
    const candidate = recognizeJsonCarriers(input).candidates[0];
    assert.deepEqual(Buffer.from(await replayMagicRecipe(candidate.recipe, Buffer.from(input))), Buffer.from(payload));
});

test("one terminal ending never admits multiline, blank-line, bare-CR or folded fields", () => {
    for (const input of [field + "\n\n", field + "\r\n\r\n", field + "\r", "\n" + field, "\r\n" + field,
                         field + "\r\nHost: example.invalid", field.replace("; ", ";\r\n ")]) {
        const result = recognizeJsonCarriers(input);
        assert.equal(result.status, "unsupported", JSON.stringify(input));
        assert.equal(result.candidates.length, 0);
    }
});

test("duplicate data/signature names and quoted values still have no extraction action", () => {
    for (const input of [field + `; cart.v2=${encoded}\r\n`, field + `; cart.v2.sig=${sig}\n`,
                         field.replace(encoded, `"${encoded}"`) + "\n"]) {
        assert.equal(recognizeJsonCarriers(input).status, "unsupported");
    }
});

for (const goal of ["JSON object or array", "JSON wrappers", "JSON payload trail"]) test(`copied CRLF field works through ${goal}, including its offered replay`, async () => {
    const input = field + "\r\n", args = [3, false, false, "", goal];
    const op = new Magic(), dish = new Dish(new TextEncoder().encode(input).buffer, Dish.ARRAY_BUFFER);
    await op.run({dish, progress: 0, opList: [{ingValues: args, config: {op: "Magic", args}}]});
    const html = op.present();
    assert.match(html, /9007199254741099/);
    assert.match(html, /2 parsing cautions/);
    assert.match(html, /Decoded, not verified|not authenticated|unverified/i);
    const recipes = [...html.matchAll(/href="#recipe=([^"]+)"/g)].map(match =>
        Utils.parseRecipeConfig(decodeURIComponent(Utils.unescapeHtml(match[1]))));
    const selected = recipes.find(recipe => recipe.some(step => step.op === "Regular expression"));
    assert.ok(selected, "native replay link exists");
    assert.deepEqual(Buffer.from(await replayMagicRecipe(selected, Buffer.from(input))), Buffer.from(payload));
    assert.equal((await dish.get(Dish.JSON)).original, input);
});
