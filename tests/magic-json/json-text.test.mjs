import {test} from "node:test";
import assert from "node:assert/strict";
import {inspectJsonText, formatJsonText, compareJsonTexts} from "../../src/core/lib/JsonText.mjs";
import JSONBeautify from "../../src/core/operations/JSONBeautify.mjs";
import Diff from "../../src/core/operations/Diff.mjs";

const corpus = [
    "{}", "[]", "null", "true", "false", "1e400", "-0", '"plain string"',
    ' {"n":9007199254740993123456789,"n":1.000e+400,"n":-0}\n',
    String.raw`{"a\u0062":"\u0061","quote":"\"","slash":"\\","space":" a b ","emoji":"海 😀"}`,
    '[{"a":[1,true,null,{},[]]},[[]],-1.234567890123456789e-400]',
    '{"__proto__":{"polluted":"no"},"constructor":"literal","__proto__":null}',
    '{"note":"<img src=x onerror=alert(731)>","line":"a\\nb"}'
];
for (const [index, input] of corpus.entries()) test(`lossless formatting keeps every token spelling, case ${index + 1}`, () => {
    const before = inspectJsonText(input), output = formatJsonText(input, "\t"), after = inspectJsonText(output);
    assert.deepEqual(after.tokens.map(token => token.raw), before.tokens.map(token => token.raw));
    assert.equal(compareJsonTexts(input, output).status, input === output ? "identical" : "formatting-only");
    assert.equal({}.polluted, undefined);
});

test("large adjacent numbers, duplicate members and overflowing exponents remain distinct", () => {
    for (const [left, right, rawLeft, rawRight] of [
        ['{"account":9007199254740992}', '{"account":9007199254740993}', "9007199254740992", "9007199254740993"],
        ['{"role":"reader","role":"admin"}', '{"role":"admin"}', '"reader"', '"admin"'],
        ['{"limit":1e400}', '{"limit":null}', "1e400", "null"]
    ]) {
        const result = compareJsonTexts(left, right);
        assert.equal(result.status, "different");
        assert.equal(result.left.raw, rawLeft);
        assert.equal(result.right.raw, rawRight);
        assert.notEqual(formatJsonText(left), formatJsonText(right));
    }
});

test("numeric spelling, string escape spelling and member order are deliberately not semantic equality", () => {
    for (const [left, right] of [["1", "1.0"], ['"a"', '"\\u0061"'], ['{"a":1,"b":2}', '{"b":2,"a":1}'], ["0", "-0"]]) {
        assert.equal(compareJsonTexts(left, right).status, "different");
    }
    assert.equal(compareJsonTexts(' {"a":1}\r\n', '{\n  "a": 1\n}').status, "formatting-only");
});

test("first changed token has original line/Unicode-character column and a within-token offset", () => {
    const result = compareJsonTexts('{\n "😀":"prefix-old"}', '{\n "😀":"prefix-new"}');
    assert.equal(result.left.line, 2);
    assert.equal(result.left.column, 6);
    assert.equal(result.withinTokenOffset, 8);
    assert.match(result.scope, /more changes may exist/);
});

test("strict syntax refuses JSON5, trailing garbage and malformed documents", () => {
    for (const input of ["", "{unquoted:1}", '{"x":NaN}', '{"x":1,}', '{"x":1}//comment', "[1,]", "[}", "01", '"bad\\x41"', '{"x":1}tail']) {
        assert.throws(() => formatJsonText(input), /strict JSON/);
        assert.equal(compareJsonTexts(input, input).status, "not-compared");
    }
});

test("UTF-8 byte, token, nesting, indent and output bounds fail explicitly", () => {
    assert.throws(() => formatJsonText('"' + "海".repeat(22000) + '"'), /64 KiB/);
    assert.throws(() => inspectJsonText("[1,2,3]", {maxTokens: 4}), /token limit/);
    assert.throws(() => formatJsonText("[".repeat(65) + "0" + "]".repeat(65)), /nesting/);
    assert.throws(() => formatJsonText("{}", "--"), /spaces or tabs/);
    assert.throws(() => formatJsonText("{}", " ".repeat(17)), /spaces or tabs/);
    assert.throws(() => formatJsonText('{"x":1}', "  ", {maxOutputBytes: 3}), /output exceeds/);
    assert.throws(() => formatJsonText("[".repeat(63) + "[" + Array(2000).fill("1").join(",") + "]" + "]".repeat(63), " ".repeat(16)), /output exceeds/);
    const result = compareJsonTexts("{}", " ".repeat(65537));
    assert.equal(result.status, "not-compared");
    assert.match(result.reason, /64 KiB/);
});

test("invalid budget/types cannot masquerade as a comparison", () => {
    assert.throws(() => inspectJsonText({}, {}), TypeError);
    assert.throws(() => inspectJsonText("{}", {maxTokens: NaN}), RangeError);
    assert.throws(() => formatJsonText("{}", " ", {maxOutputBytes: 0}), RangeError);
    assert.throws(() => compareJsonTexts({}, "{}"), TypeError);
});

test("native Beautify's opt-in path preserves evidence, refuses sort and respects plain presentation", () => {
    const operation = new JSONBeautify(), input = '{"a":9007199254740993,"a":1e400}';
    const output = operation.run(input, ["  ", false, true, true]);
    assert.match(output, /9007199254740993/);
    assert.match(output, /1e400/);
    assert.equal((output.match(/"a"/g) || []).length, 2);
    assert.throws(() => operation.run(input, ["  ", true, true, true]), /preserves member order/);
    assert.throws(() => operation.run("{x:1}", ["  ", false, true, true]), /strict JSON/);
    assert.throws(() => operation.run("", ["  ", false, true, true]), /strict JSON/);
    assert.equal(operation.run("", ["  ", false, true]), "");
    assert.equal(operation.run(input, ["  ", false, true]), '{\n  "a": null\n}');
    assert.doesNotMatch(operation.present(output, ["  ", false, false, true]), /section|<pre/);
    const hostile = operation.run('{"x":"<img onerror=alert(1)>"}', ["  ", false, true, true]);
    assert.doesNotMatch(operation.present(hostile, ["  ", false, true, true]), /<img/);
});

test("native lossless Diff highlights exact number changes without rewriting or false equality", () => {
    const operation = new Diff(), delimiter = "\n===\n";
    const left = '{"n":9007199254740992}', right = '{"n":9007199254740993}';
    const html = operation.run(left + delimiter + right, [delimiter, "JSON (lossless)", true, true, false, true]);
    assert.match(html, /JSON token text differs/);
    assert.match(html, /<del>[\s\S]*9007199254740992/);
    assert.match(html, /<ins>[\s\S]*9007199254740993/);
    const whitespace = operation.run(left + delimiter + ' { "n" : 9007199254740992 }', [delimiter, "JSON (lossless)", true, true, false, false]);
    assert.match(whitespace, /Only insignificant JSON whitespace differs/);
    assert.doesNotMatch(whitespace, /<del>|<ins>/);
    assert.throws(() => operation.run("{}"+delimiter+"{x:1}", [delimiter, "JSON (lossless)", true, true, false, false]), /strict JSON/);
    assert.throws(() => operation.run("x".repeat(140000), [delimiter, "JSON (lossless)", true, true, false, false]), /64 KiB/);
    assert.throws(() => operation.run("{}{}", ["", "JSON (lossless)", true, true, false, false]), /nonempty delimiter/);
    assert.throws(() => operation.run("{}{}", ["海".repeat(342), "JSON (lossless)", true, true, false, false]), /1 KiB/);
    assert.match(operation.run("a"+delimiter+"b", [delimiter, "Character", true, true, false, false]), /<del>a<\/del><ins>b<\/ins>/);
});

test("a work-limited full diff refuses a complete-comparison conclusion", () => {
    const left = JSON.stringify(Array.from({length: 1100}, (_, i) => i));
    const right = JSON.stringify(Array.from({length: 1100}, (_, i) => i + 10000));
    assert.throws(() => new Diff().run(left+"\n===\n"+right, ["\n===\n", "JSON (lossless)", true, true, false, false]), /did not finish[\s\S]+No equality conclusion/);
});
