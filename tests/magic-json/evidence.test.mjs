import {test} from "node:test";
import assert from "node:assert/strict";
import {inspectMagicCandidates, validateJsonDocument} from "../../src/core/lib/MagicEvidence.mjs";

const bytes = text => new TextEncoder().encode(text);
const candidates = Array.from({length: 3}, (_, i) => ({recipe: [{op: "fixture", args: [i]}]}));

test("accepts complete objects, arrays and Unicode", () => {
    for (const text of ['{"ok":true}', "[1,2,3]", '{"station":"東京 🌙"}']) {
        assert.equal(validateJsonDocument(bytes(text)).status, "passed");
    }
});
test("valid-looking preview cannot conceal a malformed tail", () => {
    const text = '{"note":"' + "a".repeat(140) + '"}';
    assert.equal(validateJsonDocument(bytes(text + " GARBAGE")).status, "invalid-json");
    assert.equal(validateJsonDocument(bytes(text.slice(0, -1))).status, "invalid-json");
});
test("strict UTF-8: replacement decoding must not make a match", () => {
    const input = Uint8Array.from([123, 34, 120, 34, 58, 34, 255, 34, 125]);
    assert.doesNotThrow(() => JSON.parse(new TextDecoder().decode(input)));
    assert.equal(validateJsonDocument(input).status, "invalid-utf8");
});
test("honours typed-array offset; ignores unrelated surrounding bytes", () => {
    const backing = bytes('BAD{"ok":1}TAIL');
    assert.equal(validateJsonDocument(backing.subarray(3, 11)).status, "passed");
});
test("no silent JSON5 repair or scalar-goal drift", () => {
    for (const text of ["null", "42", '"hello"', "true"]) {
        assert.equal(validateJsonDocument(bytes(text)).status, "wrong-goal");
    }
    assert.equal(validateJsonDocument(bytes("{unquoted: 1}")).status, "invalid-json");
    assert.throws(() => validateJsonDocument("not bytes"), TypeError);
});
test("complete replay can promote rank two, without mutating native candidates", async () => {
    const before = JSON.stringify(candidates);
    const report = await inspectMagicCandidates(candidates, async recipe =>
        bytes(["junk", '{"ok":true}', "malformed"][recipe[0].args[0]]));
    assert.equal(report.conclusion, "one-output");
    assert.deepEqual(report.distinctOutputs[0].ranks, [2]);
    assert.equal(report.checked, 3);
    assert.equal(JSON.stringify(candidates), before);
});
test("identical outputs share evidence; different outputs remain ambiguous", async () => {
    const report = await inspectMagicCandidates(candidates, async recipe =>
        bytes(recipe[0].args[0] === 2 ? '{"x":2}' : '{"x":1}'));
    assert.equal(report.conclusion, "multiple-outputs");
    assert.deepEqual(report.distinctOutputs[0].ranks, [1, 2]);
});
test("candidate cap cannot support a one-output conclusion", async () => {
    const report = await inspectMagicCandidates(candidates, async () => bytes("{}"), {maxCandidates: 1});
    assert.equal(report.status, "incomplete");
    assert.equal(report.reason, "candidate-limit");
    assert.equal(report.conclusion, "not-established");
});
test("replay error and oversized output are incomplete, not negative evidence", async () => {
    const error = await inspectMagicCandidates(candidates, async () => {
        throw new Error("fixture");
    });
    assert.equal(error.status, "incomplete");
    const size = await inspectMagicCandidates(candidates, async () => bytes('{"long":true}'), {maxOutputBytes: 2});
    assert.equal(size.reason, "output-limit");
    assert.equal(size.conclusion, "not-established");
});
test("cancellation before start and during replay cannot become success", async () => {
    const controller = new AbortController();
    controller.abort();
    let calls = 0;
    const report = await inspectMagicCandidates(candidates, async () => {
        calls++;
        return bytes("{}");
    }, {signal: controller.signal});
    assert.equal(report.status, "cancelled");
    assert.equal(calls, 0);
    const later = new AbortController();
    const mid = await inspectMagicCandidates(candidates, async () => {
        later.abort(); return bytes("{}");
    }, {signal: later.signal});
    assert.equal(mid.conclusion, "not-established");
});
test("time ceiling and invalid budgets fail closed", async () => {
    const report = await inspectMagicCandidates(candidates, async () => bytes("{}"), {maxMillis: 0});
    assert.equal(report.reason, "time-limit");
    await assert.rejects(inspectMagicCandidates(candidates, async () => bytes("{}"), {maxCandidates: Infinity}), RangeError);
    await assert.rejects(inspectMagicCandidates(candidates, async () => bytes("{}"), {maxMillis: -1}), RangeError);
});
test("all-invalid complete pool and empty pool have narrow no-output result", async () => {
    assert.equal((await inspectMagicCandidates(candidates, async () => bytes("not json"))).conclusion, "no-output");
    assert.equal((await inspectMagicCandidates([], async () => bytes("{}"))).conclusion, "no-output");
});
