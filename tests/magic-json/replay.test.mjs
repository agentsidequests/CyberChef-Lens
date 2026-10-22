import {test} from "node:test";
import assert from "node:assert/strict";
import log from "loglevel";
import {replayMagicRecipe} from "../../src/core/lib/MagicEvidenceReplay.mjs";

log.setLevel("silent", false);
test("replay checks the full native recipe output, including the tail", async () => {
    const text = JSON.stringify({note: "long synthetic record ".repeat(50), tail: "FINISH"});
    const input = Buffer.from(Buffer.from(text).toString("base64"));
    const output = await replayMagicRecipe([{op: "From Base64", args: ["A-Za-z0-9+/=", true, false]}], input);
    assert.equal(new TextDecoder().decode(output), text);
});
test("a sliced input does not expose other bytes in its backing buffer", async () => {
    const input = new TextEncoder().encode("before{}after");
    assert.equal(new TextDecoder().decode(await replayMagicRecipe([], input.subarray(6, 8))), "{}");
});
test("native operation errors remain replay failures, not candidate data", async () => {
    await assert.rejects(replayMagicRecipe([{op: "JSON Beautify", args: ["  ", false, false]}], new TextEncoder().encode("{broken")), /did not complete/);
});
