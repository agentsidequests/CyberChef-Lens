import {test} from "node:test";
import assert from "node:assert/strict";
import {combineMagicEvidence, investigateMagic} from "../../src/core/lib/MagicInvestigation.mjs";

const bytes = text => new TextEncoder().encode(text);
const passed = text => ({status: "passed", text, byteLength: bytes(text).length});
const recipe = [{op: "From Base64", args: ["A-Za-z0-9-_", true, false]}];
const token = "eyJ4IjoxfQ:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

/** Build source reports with object identity like the native evidence helper. */
function reports(nativeTexts=["{\"x\":1}"], wrapperTexts=["{\"x\":1}"]) {
    const candidates = nativeTexts.map(() => ({recipe}));
    return [{status: "complete", checked: candidates.length, total: candidates.length, candidates,
        entries: candidates.map((candidate, i) => ({rank: i + 1, candidate, evidence: passed(nativeTexts[i])}))},
            {status: "complete", checked: wrapperTexts.length, total: wrapperTexts.length, original: token,
                candidates: wrapperTexts.map(text => ({accepted: true, kind: "Test shape", recipe,
                    fields: [{name: "Signature (unverified)", value: "AAAA"}], evidence: passed(text)}))}];
}

test("same complete text shares a card but retains each route and original input", () => {
    const [native, wrappers] = reports();
    const result = combineMagicEvidence(native, wrappers);
    assert.equal(result.outputs.length, 1);
    assert.deepEqual(result.outputs[0].sources.map(source => source.route), ["native", "wrapper"]);
    assert.equal(result.outputs[0].sources[0].nativeRank, 1);
    assert.equal(result.original, token);
    assert.equal(result.conclusion, "one-output");
});
test("different values and formatting remain competing exact texts", () => {
    const result = combineMagicEvidence(...reports(['{"x":1}', '{ "x":1 }'], ['{"x":2}']));
    assert.equal(result.outputs.length, 3);
    assert.equal(result.conclusion, "multiple-outputs");
});
test("crib subset retains original native rank, not its checked-pool rank", () => {
    const [native, wrappers] = reports(['{"x":1}', '{"x":2}'], []);
    native.entries = [{...native.entries[1], rank: 1}];
    const result = combineMagicEvidence(native, wrappers);
    assert.equal(result.outputs[0].sources[0].nativeRank, 2);
    assert.equal(result.outputs[0].sources[0].checkedPoolRank, 1);
});
test("crib applies to both complete outputs without mutating global regex state", () => {
    const [native, wrappers] = reports(['{"x":1}', '{"x":2}'], ['{"x":2}', '{"x":3}']);
    const crib = /2/g;
    crib.lastIndex = 9;
    const result = combineMagicEvidence(native, wrappers, crib);
    assert.deepEqual(result.outputs.map(output => output.text), ['{"x":2}']);
    assert.equal(result.outputs[0].sources.length, 2);
    assert.equal(result.wrapperCribExcluded, 1);
    assert.equal(crib.lastIndex, 9);
});
test("a valid payload does not bypass the JWT header gate or rejected format", () => {
    const [native, wrappers] = reports([], ['{"x":1}', '{"x":2}']);
    wrappers.candidates[0].headerRecipe = recipe;
    wrappers.candidates[0].headerEvidence = {status: "not-jwt-header"};
    wrappers.candidates[1].accepted = false;
    assert.equal(combineMagicEvidence(native, wrappers).outputs.length, 0);
});
test("failed replay evidence never enters a checked-output group", () => {
    const [native, wrappers] = reports();
    native.entries[0].evidence = {status: "replay-error", text: '{"x":1}'};
    wrappers.candidates[0].evidence = {status: "invalid-json", text: '{"x":1}'};
    assert.equal(combineMagicEvidence(native, wrappers).outputs.length, 0);
});
test("merge preserves source reports and candidate identities", () => {
    const [native, wrappers] = reports();
    const before = JSON.stringify([native, wrappers]);
    const candidate = native.entries[0].candidate;
    combineMagicEvidence(native, wrappers);
    assert.equal(JSON.stringify([native, wrappers]), before);
    assert.equal(native.entries[0].candidate, candidate);
});
for (const [route, status] of [["native", "incomplete"], ["native", "cancelled"],
                               ["wrappers", "incomplete"], ["wrappers", "cancelled"], ["wrappers", "unsupported"]]) {
    test(`${route} ${status} keeps measured output but prevents a single-answer conclusion`, () => {
        const [native, wrappers] = reports();
        (route === "native" ? native : wrappers).status = status;
        const result = combineMagicEvidence(native, wrappers);
        assert.equal(result.outputs.length, 1);
        assert.equal(result.conclusion, "not-established");
        assert.notEqual(result.status, "complete");
    });
}
test("native discovery failure cannot erase an already checked wrapper output", async () => {
    const result = await investigateMagic(bytes(token), {
        discover: async () => {
            throw new Error("search unavailable");
        }, replay: async () => bytes('{"x":1}')
    });
    assert.equal(result.outputs[0].text, '{"x":1}');
    assert.equal(result.outputs[0].sources[0].route, "wrapper");
    assert.equal(result.status, "incomplete");
    assert.match(result.native.reason, /search unavailable/);
});
test("wrapper preparation failure cannot erase a checked native output", async () => {
    const result = await investigateMagic(bytes(token), {
        prepare: async () => {
            throw new Error("loader unavailable");
        },
        discover: async () => [{recipe}], replay: async () => bytes('{"x":1}')
    });
    assert.equal(result.wrappers.status, "incomplete");
    assert.equal(result.outputs[0].sources[0].route, "native");
    assert.equal(result.conclusion, "not-established");
});
test("candidate budget is not hidden by a successful wrapper result", async () => {
    const result = await investigateMagic(bytes(token), {
        discover: async () => [{recipe}, {recipe}], replay: async () => bytes('{"x":1}'),
        nativeBudget: {maxCandidates: 1}
    });
    assert.equal(result.native.total, 2);
    assert.equal(result.native.checked, 1);
    assert.equal(result.native.reason, "candidate-limit");
    assert.equal(result.outputs[0].sources.length, 2);
    assert.equal(result.conclusion, "not-established");
});
test("zero evidence-time budget cannot produce a successful checked output", async () => {
    let replays = 0;
    const result = await investigateMagic(bytes(token), {
        discover: async () => [{recipe}], replay: async () => {
            replays++; return bytes("{}");
        },
        nativeBudget: {maxMillis: 0}, wrapperBudget: {maxMillis: 0}
    });
    assert.equal(replays, 0);
    assert.equal(result.outputs.length, 0);
    assert.equal(result.status, "incomplete");
});
test("oversize input is rejected before preparation, discovery or replay", async () => {
    let calls = 0;
    await assert.rejects(investigateMagic(new Uint8Array(65537), {
        discover: async () => {
            calls++; return [];
        }, replay: async () => {
            calls++; return bytes("{}");
        },
        prepare: async () => {
            calls++;
        }
    }), /64 KiB/);
    assert.equal(calls, 0);
});
test("cancellation skips native search and cannot become a success", async () => {
    const controller = new AbortController();
    controller.abort();
    let searched = false;
    const result = await investigateMagic(bytes(token), {
        signal: controller.signal, discover: async () => {
            searched = true; return [];
        },
        replay: async () => {
            assert.fail("cancelled replay ran");
        }
    });
    assert.equal(searched, false);
    assert.equal(result.status, "cancelled");
    assert.equal(result.outputs.length, 0);
});
test("unsupported compressed wrapper does not disable the independent native route", async () => {
    const result = await investigateMagic(bytes(".unsupported.container"), {
        discover: async () => [{recipe}], replay: async () => bytes("{}")
    });
    assert.equal(result.wrappers.status, "unsupported");
    assert.equal(result.outputs[0].sources[0].route, "native");
    assert.equal(result.status, "limited");
    assert.equal(result.conclusion, "not-established");
});
