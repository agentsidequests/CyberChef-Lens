import {test, before} from "node:test";
import assert from "node:assert/strict";
import {deflateSync} from "node:zlib";
import log from "loglevel";
import {verifyLensEvidence} from "../../src/core/lib/LensVerification.mjs";
import {lensEvidenceExample} from "../../src/core/lib/LensEvidenceExample.mjs";
import {investigateLensSource, readLensSource} from "../../src/core/lib/LensWorkspace.mjs";
import {prepareMagicRecipes, replayMagicRecipe} from "../../src/core/lib/MagicEvidenceReplay.mjs";
import {createJsonEvidence} from "../../src/core/lib/MagicJsonExport.mjs";
import {presentLensVerification} from "../../src/core/lib/MagicJsonPresentation.mjs";
import InspectLensEvidence from "../../src/core/operations/InspectLensEvidence.mjs";
import Dish from "../../src/core/Dish.mjs";

const bytes = value => Buffer.from(typeof value === "string" ? value : JSON.stringify(value));
const example = () => JSON.parse(lensEvidenceExample());
const check = (value, options) => verifyLensEvidence(bytes(value), options);
const changePayload = (record, text) => {
    record.result.text = text; record.result.byteLength = Buffer.byteLength(text);
};
const save = async (input, target) => {
    const report = await investigateLensSource(input, 5);
    const group = report.outputs.find(item => item.text === target);
    assert.ok(group);
    return createJsonEvidence(group, {report, mode: "JSON payload trail", index: 0, count: report.outputs.length});
};
before(async () => {
    log.setLevel("silent", false); await prepareMagicRecipes([]);
});

test("saved example regenerates its route and ignores recorded budgets/status as authority", async () => {
    const record = example();
    record.investigation = {mode: "Run JavaScript", status: "authenticated", limits: {maxDepth: 999, maxMillis: 999999}};
    const result = await check(record);
    assert.equal(result.status, "matches"); assert.deepEqual(result.counts, {matched: 1, mismatched: 0, unreproduced: 0});
    assert.equal(result.search.limits.maxDepth, 5); assert.equal(result.search.limits.maxMillis, 3000);
    const html = presentLensVerification(result);
    assert.match(html, /Consistency, not authenticity/); assert.match(html, /Coordinated edits can still match/);
});

test("genuine HTTP evidence keeps full Unicode/CRLF bytes and independently rechecks source locations", async () => {
    const body = ' {"note":"海 😀","id":1,"id":2}\r\n';
    const input = `POST / HTTP/1.1\r\nHost: example.invalid\r\nContent-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
    const source = await save(input, body), result = await check(source);
    assert.equal(result.status, "matches"); assert.equal(result.review.input, input);
    assert.equal(result.routes[0].locationMatches, true);
    const edited = JSON.parse(source); edited.result.routes[0].httpOrigin.byteOffset++;
    const changed = await check(edited);
    assert.equal(changed.status, "differences"); assert.equal(changed.routes[0].payloadMatches, true);
    assert.equal(changed.routes[0].locationMatches, false);
    assert.equal(changed.routes[0].fields, null);
    assert.doesNotMatch(presentLensVerification(changed), /What changed in the payload/);
    assert.match(presentLensVerification(changed), /Saved HTTP source coordinates differ/);
});

test("genuine compressed serializer exports reproduce exact numbers and repeated members", async () => {
    const target = '{"id":9007199254740993,"id":2}\n';
    const input = "." + deflateSync(Buffer.from(target)).toString("base64url") + ".AAAA.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const result = await check(await save(input, target));
    assert.equal(result.status, "matches"); assert.equal(result.review.payload, target);
});

test("a large valid evidence file can reproduce a near-1-MiB payload within the current caps", async () => {
    const target = JSON.stringify({note: "a".repeat(1040000)});
    const input = "." + deflateSync(Buffer.from(target)).toString("base64url") + ".AAAA.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const source = await save(input, target);
    assert.ok(Buffer.byteLength(source) > 65536 && Buffer.byteLength(source) < 2097152);
    const result = await check(source);
    assert.equal(result.status, "matches"); assert.equal(result.review.payloadBytes, Buffer.byteLength(target));
    assert.match(presentLensVerification(result), /Parsing-caution inspection not completed/);
});

test("a changed valid saved payload is a byte mismatch, not an accepted current result", async () => {
    const record = example(), original = record.result.text;
    changePayload(record, original.replace("queued", "failed"));
    const result = await check(record);
    assert.equal(result.status, "differences"); assert.equal(result.routes[0].actualPreview, original);
    assert.equal(result.routes[0].firstDifference, Buffer.from(original).indexOf(Buffer.from("queued")));
    assert.match(presentLensVerification(result), /Payload bytes differ/);
});

test("changed saved input is detected when its regenerated route produces different bytes", async () => {
    const record = example(), different = record.result.text.replace("queued", "failed");
    record.input.text = Buffer.from(different).toString("base64") + "\n"; record.input.byteLength = Buffer.byteLength(record.input.text);
    assert.equal((await check(record)).status, "differences");
    changePayload(record, different);
    assert.equal((await check(record)).status, "matches", "Coordinated consistent edits are not historical tamper detection");
});

test("changed recipe arguments remain inert even when the operation name is supported", async () => {
    const record = example(); record.result.routes[0].recipe[0].args[0] = "arbitrary alphabet";
    const executed = [], result = await check(record, {replay: async (config, input) => {
        executed.push(config); return replayMagicRecipe(config, input);
    }});
    assert.equal(result.counts.unreproduced, 1);
    assert.ok(!executed.some(config => JSON.stringify(config).includes("arbitrary alphabet")));
    assert.match(presentLensVerification(result), /Not reproduced/);
});

test("unrecognized operation fields cannot disappear from a claimed recipe match", async () => {
    const record = example(); record.result.routes[0].recipe[0].disabled = true;
    const result = await check(record, {replay: () => assert.fail("must not execute")});
    assert.equal(result.counts.unreproduced, 1); assert.equal(result.search.checkedReplays, 0);
});

for (const operation of ["HTTP request", "Run JavaScript", "Fork", "Magic", "Inspect Lens Evidence"]) {
    test(`stored ${operation} cannot trigger a module load or execution`, async () => {
        const record = example(); record.result.routes = [{recipe: [{op: operation, args: ["https://example.invalid/never"]}]}];
        let calls = 0;
        const result = await check(record, {prepare: () => {
            calls++; throw new Error("must not load");
        }, replay: () => {
            calls++; throw new Error("must not execute");
        }});
        assert.equal(calls, 0); assert.equal(result.status, "incomplete"); assert.equal(result.search.status, "not-run");
    });
}

test("arbitrary Regex, JPath and inflate arguments never reach generated native execution", async () => {
    const record = example();
    record.result.routes = [
        {recipe: [{op: "Regular expression", args: ["User defined", "^(a+)+$", true]}]},
        {recipe: [{op: "JPath expression", args: ["$..[?(@.run())]", "\n"]}]},
        {recipe: [{op: "Zlib Inflate Bounded", args: [999999999]}]}
    ];
    const executed = [], result = await check(record, {replay: async (config, input) => {
        executed.push(JSON.stringify(config)); return replayMagicRecipe(config, input);
    }});
    assert.equal(result.counts.unreproduced, 3);
    assert.ok(executed.every(config => !config.includes("^(a+)+$") && !config.includes("@.run()") && !config.includes("999999999")));
});

test("supported and unsupported saved routes keep independent outcomes", async () => {
    const record = example(); record.result.routes.push({recipe: [{op: "HTTP request", args: []}]});
    const result = await check(record);
    assert.deepEqual(result.counts, {matched: 1, mismatched: 0, unreproduced: 1});
    assert.equal(result.status, "incomplete");
});

test("identity routes are checked against unchanged original input", async () => {
    const record = example(); record.input.text = record.result.text; record.input.byteLength = record.result.byteLength;
    record.result.routes[0].recipe = [];
    assert.equal((await check(record)).status, "matches");
    changePayload(record, "{}");
    assert.equal((await check(record)).routes[0].firstDifference, 1);
});

test("duplicate saved routes reuse the bounded generated evidence", async () => {
    const record = example(); record.result.routes = Array.from({length: 64}, () => record.result.routes[0]);
    const result = await check(record);
    assert.equal(result.counts.matched, 64); assert.ok(result.search.checkedReplays < 10);
});

test("overlong stored programs are refused without trying them", async () => {
    const record = example(); record.result.routes[0].recipe = Array.from({length: 33}, () => ({op: "From Base64", args: []}));
    const result = await check(record, {replay: () => assert.fail("must not execute")});
    assert.equal(result.counts.unreproduced, 1); assert.equal(result.search.checkedReplays, 0);
});

test("zero clock, cancellation and module failure never become an empty success", async () => {
    for (const options of [{maxMillis: 0}, {signal: AbortSignal.abort()}, {prepare: () => {
        throw new Error("missing module");
    }}]) {
        const result = await check(example(), options);
        assert.equal(result.status, "incomplete"); assert.equal(result.counts.matched, 0);
        assert.equal(result.counts.unreproduced, 1);
    }
});

test("byte counts, duplicate record metadata and invalid version still refuse before a replay", async () => {
    const record = example(); record.result.byteLength++;
    await assert.rejects(check(record), /byte count/);
    await assert.rejects(check(lensEvidenceExample().trimEnd().slice(0, -1) + ',"formatVersion":1}'), /Duplicate/);
    record.formatVersion = 2; await assert.rejects(check(record), /formatVersion 1/);
});

test("untrusted markup in a changed payload remains escaped", async () => {
    const record = example(); changePayload(record, '{"x":"<img src=x onerror=alert(1)>"}');
    const result = await check(record), html = presentLensVerification(result);
    assert.ok(!/<img src=x|<script>/.test(html)); assert.equal(result.status, "differences");
});

test("evidence mode expands only the file record limit, not ordinary source limits", () => {
    const data = Buffer.from("a".repeat(70000));
    assert.throws(() => readLensSource(data), /64 KiB/);
    assert.equal(readLensSource(data, 2097152).length, 70000);
    assert.throws(() => readLensSource(Buffer.alloc(2097153), 2097152), /2 MiB/);
    assert.throws(() => readLensSource(data, 99999999), /Unsupported/);
});

test("native verification keeps the whole record as output and clears stale success after failure", async () => {
    const operation = new InspectLensEvidence(), source = lensEvidenceExample();
    const run = async text => {
        const input = bytes(text), dish = new Dish(input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength), Dish.ARRAY_BUFFER);
        await operation.run({dish, progress: 0, opList: [{ingValues: ["Verify replay"], config: {op: operation.name, args: ["Verify replay"]}}]});
        return dish.get(Dish.STRING);
    };
    const output = await run(source);
    assert.equal(output, source); assert.equal(operation.verification.status, "matches");
    assert.match(operation.present(output), /Saved replay check/);
    await assert.rejects(run("{}"), /formatVersion 1/);
    assert.equal(operation.verification, null); assert.equal(operation.review, null);
    assert.doesNotMatch(operation.present("invalid"), /data-lens-verification/);
});

test("native recipe execution accepts the explicit verification mode and returns the exact record", async () => {
    const source = lensEvidenceExample();
    const result = await replayMagicRecipe([{op: "Inspect Lens Evidence", args: ["Verify replay"]}], bytes(source));
    assert.equal(Buffer.from(result).toString("utf8"), source);
});
