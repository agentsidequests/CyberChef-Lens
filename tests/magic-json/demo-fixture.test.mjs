import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {investigatePayloadTrail} from "../../src/core/lib/MagicPayloadTrail.mjs";
import {prepareMagicRecipes, replayMagicRecipe} from "../../src/core/lib/MagicEvidenceReplay.mjs";
import {inspectJsonHazards} from "../../src/core/lib/JsonHazards.mjs";
import {inspectJsonText} from "../../src/core/lib/JsonText.mjs";
import JSONBeautify from "../../src/core/operations/JSONBeautify.mjs";

const read = file => readFileSync(new URL("../../examples/" + file, import.meta.url), "utf8");
const input = read("lens-investigation.txt"), target = read("lens-investigation-payload.txt");
const sha = text => createHash("sha256").update(text).digest("hex");

test("the shipped fictional demo reaches its exact 100-byte payload through three replayable layers", async () => {
    assert.equal(sha(input), "8af8844478913c35745fcff9f27b472e39c7141052cbc3d27fe124eb4704823a");
    assert.equal(sha(target), "ac8cb52274a2a78451aa1f27082c4181c5ac34deffbc44527bb55811c4a916bc");
    const bytes = Buffer.from(input);
    const result = await investigatePayloadTrail(bytes, {replay: recipe => replayMagicRecipe(recipe, bytes), prepare: prepareMagicRecipes});
    const output = result.outputs.find(item => item.text === target);
    assert.ok(output, JSON.stringify(result.stops));
    assert.equal(result.original, input);
    assert.equal(output.sources[0].depth, 3);
    assert.equal(Buffer.byteLength(target), 100);
    for (const source of output.sources) {
        assert.equal(Buffer.from(await replayMagicRecipe(source.recipe, bytes)).toString(), target);
        for (const hop of source.hops) assert.equal(Buffer.from(await replayMagicRecipe(hop.recipe, bytes)).toString(), result.nodes[hop.nodeId].text);
    }
    const manual = JSON.parse(read("lens-investigation-recipe.json"));
    assert.equal(manual.length, 5);
    assert.equal(Buffer.from(await replayMagicRecipe(manual, bytes)).toString(), target);
    const hazards = inspectJsonHazards(target);
    assert.equal(hazards.total, 2);
    assert.equal(hazards.counts["duplicate-key"], 1);
    assert.equal(hazards.counts["unsafe-range"], 1);
});

test("the demo's formatting comparison preserves tokens only in the opt-in lossless path", () => {
    const operation = new JSONBeautify();
    const legacy = operation.run(target, ["  ", false, false, false]);
    assert.ok(legacy.includes("9007199254740992"));
    assert.ok(!legacy.includes("viewer"));
    const lossless = operation.run(target, ["  ", false, false, true]);
    assert.deepEqual(inspectJsonText(lossless).tokens.map(token => token.raw), inspectJsonText(target).tokens.map(token => token.raw));
    assert.equal(inspectJsonHazards(lossless).total, 2);
});
