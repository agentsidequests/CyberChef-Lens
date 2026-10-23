import {test} from "node:test";
import assert from "node:assert/strict";
import {compareJsonStructure} from "../../src/core/lib/JsonStructure.mjs";
import {presentJsonStructure} from "../../src/core/lib/JsonStructurePresentation.mjs";
import {compareJsonTexts, inspectJsonText} from "../../src/core/lib/JsonText.mjs";
import Diff from "../../src/core/operations/Diff.mjs";
import {readFileSync} from "node:fs";

test("structure compares exact numeric and string lexemes, not converted values", () => {
    for (const [left, right] of [["9007199254740992", "9007199254740993"], ["1e400", "2e400"], ["1e-400", "0"],
                                 ["1.0", "1"], ["-0", "0"], ['"a"', '"\\u0061"']]) {
        const report = compareJsonStructure(left, right);
        assert.equal(report.total, 1);
        assert.equal(report.changes[0].kind, "value");
        assert.equal(report.changes[0].left.raw, left);
        assert.equal(report.changes[0].right.raw, right);
    }
});

test("nested changes have exact source spans, original Unicode columns and escaped path labels", () => {
    const left = '{\n "😀":[{"a.b[0]":true}],"tail":0}', right = '{\n "😀":[{"a.b[0]":false}],"tail":1}';
    const report = compareJsonStructure(left, right);
    assert.equal(report.total, 2);
    assert.equal(report.changes[0].path, '$["😀"][0]["a.b[0]"]');
    assert.equal(report.changes[0].left.line, 2);
    assert.equal(report.changes[0].left.column, 17);
    for (const change of report.changes) {
        assert.equal(change.left.raw, left.slice(change.left.start, change.left.end));
        assert.equal(change.right.raw, right.slice(change.right.start, change.right.end));
    }
});

test("duplicate names match by occurrence across escape aliases at every ancestor", () => {
    const left = String.raw`{"role":1,"\u0072ole":{"x":2,"x":3}}`;
    const right = '{"role":1,"role":{"x":2,"x":4}}';
    const report = compareJsonStructure(left, right);
    assert.deepEqual(report.changes.map(change => [change.kind, change.path]), [
        ["key-spelling", '$["role"]#2'], ["value", '$["role"]#2["x"]#2']
    ]);
    assert.equal(report.changes[0].left.raw, '"\\u0072ole"');
    assert.equal(report.changes[1].left.raw, "3");
});

test("removing an early duplicate does not silently infer which occurrence survived", () => {
    const report = compareJsonStructure('{"x":1,"x":2}', '{"x":2}');
    assert.deepEqual(report.changes.map(change => [change.kind, change.path]), [
        ["value", '$["x"]#1'], ["removed", '$["x"]#2']
    ]);
});

test("member order is independently reported without fabricated value changes", () => {
    const left = '{"a":1,"b":2,"c":3}', right = '{"c":3,"a":1,"b":2}';
    const report = compareJsonStructure(left, right);
    assert.equal(report.total, 1);
    assert.equal(report.changes[0].kind, "member-order");
    assert.equal(report.changes[0].path, "$");
    assert.equal(report.changes[0].left.raw, left);
    assert.equal(report.changes[0].right.raw, right);
    const insertion = compareJsonStructure(left, '{"a":1,"new":{},"b":2,"c":3}');
    assert.equal(insertion.total, 1);
    assert.equal(insertion.counts.added, 1);
    assert.equal(insertion.counts["member-order"], 0);
});

test("arrays match by index, reporting shifts rather than claiming inferred moves", () => {
    const report = compareJsonStructure('["a","b"]', '["new","a","b"]');
    assert.deepEqual(report.changes.map(change => [change.kind, change.path]), [
        ["value", "$[0]"], ["value", "$[1]"], ["added", "$[2]"]
    ]);
    assert.equal(compareJsonStructure("[1,2]", "[1]").changes[0].kind, "removed");
});

test("added and removed subtrees and type replacements count once", () => {
    const report = compareJsonStructure('{"keep":{},"old":{"many":[1,2,3]}}', '{"keep":false,"new":[4,5]}');
    assert.equal(report.total, 3);
    assert.deepEqual(report.changes.map(change => change.kind), ["type", "removed", "added"]);
    assert.equal(report.changes[1].left.raw, '{"many":[1,2,3]}');
    assert.equal(report.changes[2].right.raw, "[4,5]");
});

test("prototype-shaped names and hostile keys/values remain ordinary escaped data", () => {
    const left = '{"__proto__":{"polluted":1},"constructor":0,"<img src=x>":"<script>old</script>"}';
    const right = '{"__proto__":{"polluted":2},"constructor":1,"<img src=x>":"<svg onload=x>"}';
    const report = compareJsonStructure(left, right), html = presentJsonStructure(report, left, right);
    assert.equal(report.total, 3);
    assert.equal({}.polluted, undefined);
    assert.doesNotMatch(html, /<img|<script>|<svg/);
    assert.match(html, /&lt;img/);
    assert.match(html, /&lt;svg/);
});

test("detail truncation retains complete category totals and never claims equality", () => {
    const left = JSON.stringify(Array.from({length: 220}, (_, index) => index));
    const right = JSON.stringify(Array.from({length: 220}, (_, index) => index + 1));
    const report = compareJsonStructure(left, right);
    assert.equal(report.total, 220);
    assert.equal(report.counts.value, 220);
    assert.equal(report.changes.length, 128);
    assert.equal(report.truncated, true);
    const html = presentJsonStructure(report, left, right);
    assert.match(html, /128 of 220/);
    assert.equal((html.match(/class="js-change"/g) || []).length, 128);
    const small = compareJsonStructure(left, right, {maxChanges: 2});
    assert.equal(small.total, 220);
    assert.equal(small.changes.length, 2);
    assert.match(presentJsonStructure(small, left, right), /2 retained change records/);
});

test("filtered additions/removals retain true totals even after retained-row truncation", () => {
    const left = JSON.stringify(Object.fromEntries(Array.from({length: 150}, (_, index) => [`old${index}`, index])));
    const right = '{"new":true}', report = compareJsonStructure(left, right);
    const html = presentJsonStructure(report, left, right, {showAdded: false, showRemoved: false});
    assert.equal(report.total, 151);
    assert.match(html, /151 hidden/);
    assert.match(html, /128 of 151/);
    assert.match(html, /0 shown after filters/);
    assert.doesNotMatch(html, /class="js-change"/);
    assert.doesNotMatch(html, /Exact source texts match/);
});

test("long paths/previews are bounded and show a late deciding character", () => {
    const name = "long".repeat(400), prefix = "😀".repeat(1000);
    const left = JSON.stringify({[name]: prefix + "OLD" + "z".repeat(1000)});
    const right = JSON.stringify({[name]: prefix + "NEW" + "z".repeat(1000)});
    const report = compareJsonStructure(left, right), html = presentJsonStructure(report, left, right);
    assert.equal(report.total, 1);
    assert.ok(report.changes[0].path.length <= 512);
    assert.equal(report.changes[0].pathShortened, true);
    assert.match(html, /Path shortened/);
    assert.match(html, /OLD/);
    assert.match(html, /NEW/);
    assert.match(html, /preview shortened/);
    assert.ok(html.length < 15000);
    assert.doesNotMatch(html, /\uFFFD/);
});

test("identical versus formatting-only is distinguished across primitive and container cases", () => {
    for (const value of ["{}", "[]", "null", "false", "true", "1e400", '"x"', '{"x":1,"x":2}']) {
        assert.equal(compareJsonStructure(value, value).status, "identical");
        assert.equal(compareJsonStructure(value, " \n" + value + "\r\n").status, "formatting-only");
    }
});

test("invalid syntax and all existing input budgets fail explicitly", () => {
    for (const value of ["", "{x:1}", '{"x":1,}', "{}{}", '"bad\\x20"', "[1,]", "01"]) {
        assert.throws(() => compareJsonStructure(value, "{}"), /strict JSON/);
    }
    assert.throws(() => compareJsonStructure("[".repeat(65) + "0" + "]".repeat(65), "[]"), /nesting/);
    assert.throws(() => compareJsonStructure('"' + "海".repeat(22000) + '"', "{}"), /64 KiB/);
    assert.throws(() => compareJsonStructure("[1,2,3]", "[]", {maxTokens: 4}), /token limit/);
    assert.throws(() => compareJsonStructure("{}", "{}", {maxChanges: 0}), /detail limit/);
    assert.throws(() => compareJsonStructure("{}", "{}", {maxChanges: 129}), /detail limit/);
    assert.throws(() => compareJsonStructure({}, "{}"), TypeError);
});

test("near-capacity flat and nested documents complete with bounded retained details", () => {
    const left = JSON.stringify(Array.from({length: 7000}, (_, index) => index % 10));
    const right = JSON.stringify(Array.from({length: 7000}, (_, index) => (index + 1) % 10));
    assert.ok(inspectJsonText(left).tokens.length < 16384);
    const report = compareJsonStructure(left, right);
    assert.equal(report.total, 7000);
    assert.equal(report.changes.length, 128);
    const prefix = "[".repeat(64), suffix = "]".repeat(64);
    assert.equal(compareJsonStructure(prefix + "1" + suffix, prefix + "2" + suffix).total, 1);
});

test("all differences in a deterministic corpus agree with lossless token comparison", () => {
    const corpus = ["{}", "[]", "true", "false", "null", "1", "1.0", "-0", "0", '"a"', '"\\u0061"',
                    '{"a":1,"b":2}', '{"b":2,"a":1}', '{"a":1,"a":2}', '{"a":2}', "[1,2]", "[2,1]", '{"\\u0061":1,"b":2}'];
    for (const left of corpus) for (const right of corpus) {
        assert.equal(compareJsonStructure(left, right).status, compareJsonTexts(left, right).status, `${left} / ${right}`);
    }
});

test("native controls preserve source text and refuse malformed delimiter/sample paths", () => {
    const operation = new Diff(), args = ["\n===\n", "JSON structure (lossless)", true, true, true, true];
    assert.match(operation.run("{}\n===\n {}", args), /Only insignificant JSON whitespace differs/);
    assert.match(operation.run("null\n===\nfalse", args), /Type changed/);
    assert.throws(() => operation.run("{}{}", ["", ...args.slice(1)]), /nonempty delimiter/);
    assert.throws(() => operation.run("{}", args), /Incorrect number of samples/);
    assert.throws(() => operation.run("{}\n===\n{}\n===\n{}", args), /Incorrect number of samples/);
    assert.throws(() => operation.run("{}\n===\n{x:1}", args), /strict JSON/);
    const html = operation.run('{"n":1e400}\n===\n{"n":2e400}', args);
    assert.match(html, /1e400/);
    assert.match(html, /2e400/);
    assert.match(html, /Overflows JavaScript Number/);
    assert.match(html, /not alter this mode/);
});

test("the shipped fictional sample has the eight documented change records", () => {
    const sample = readFileSync(new URL("../../examples/lens-json-comparison.txt", import.meta.url), "utf8");
    const [left, right] = sample.split("\n===\n"), report = compareJsonStructure(left, right);
    assert.equal(report.total, 8);
    assert.deepEqual(report.counts, {value: 4, type: 0, added: 2, removed: 1, "key-spelling": 1, "member-order": 0});
    assert.equal(report.changes.find(change => change.path === '$["account"]').right.raw, "9007199254740993");
    assert.equal(report.changes.find(change => change.path === '$["limits"]["daily"]').right.raw, "2e400");
});
