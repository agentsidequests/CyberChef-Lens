/**
 * Source-coordinate regressions; original text and raw offsets stay intact.
 * @author SamuelNotes
 * @license Apache-2.0
 */
import {test} from "node:test";
import assert from "node:assert/strict";
import {inspectJsonHazards} from "../../src/core/lib/JsonHazards.mjs";
import {compareJsonTexts} from "../../src/core/lib/JsonText.mjs";
import {compareJsonStructure} from "../../src/core/lib/JsonStructure.mjs";

for (const [name, breaks, lines] of [
    ["LF", ["\n", "\n", "\n"], [2, 3]],
    ["CRLF", ["\r\n", "\r\n", "\r\n"], [2, 3]],
    ["CR", ["\r", "\r", "\r"], [2, 3]],
    ["mixed", ["\r\n", "\r", "\n"], [2, 3]],
    ["LFCR", ["\n\r", "\n\r", "\n\r"], [3, 5]]
]) {
    test(`${name} source locations follow logical lines without rewriting input`, () => {
        const source = "{" + breaks[0] + '  "role":1,' + breaks[1] + '  "\\u0072ole":2' + breaks[2] + "}";
        const report = inspectJsonHazards(source), duplicate = report.findings.find(item => item.code === "duplicate-key");
        assert.equal(report.counts["duplicate-key"], 1);
        assert.deepEqual([duplicate.first.line, duplicate.first.column], [lines[0], 3]);
        assert.deepEqual([duplicate.token.line, duplicate.token.column], [lines[1], 3]);
        const prefix = "{" + breaks[0] + '  "role":';
        const left = prefix + "1" + breaks[1] + "}", right = prefix + "2" + breaks[1] + "}";
        const lexical = compareJsonTexts(left, right), structural = compareJsonStructure(left, right);
        assert.equal(structural.total, 1);
        for (const token of [lexical.left, lexical.right, structural.changes[0].left, structural.changes[0].right]) {
            assert.deepEqual([token.line, token.column], [lines[0], 10]);
            assert.equal(token.start, prefix.length);
        }
        assert.equal(lexical.left.raw, "1"); assert.equal(lexical.right.raw, "2");
    });
}

test("CRLF plus an astral character keeps raw UTF-16 offsets and code-point columns separate", () => {
    const prefix = '{\r\n  "🦆":0,"role":';
    const result = compareJsonTexts(prefix + "1}", prefix + "2}");
    assert.deepEqual([result.left.line, result.left.column], [2, 16]);
    assert.equal(result.left.start, prefix.length);
    assert.notEqual(result.left.start, prefix.replace(/\r\n/g, "\n").length);
});

test("escaped CR and Unicode CR inside strings are source spelling, not line breaks", () => {
    const source = '{"s":"a\\rb\\u000D🦆","role":1,"\\u0072ole":2}';
    const duplicate = inspectJsonHazards(source).findings.find(item => item.code === "duplicate-key");
    assert.equal(duplicate.first.line, 1); assert.equal(duplicate.token.line, 1);
    assert.equal(duplicate.first.column, [...source.slice(0, source.indexOf('"role"'))].length + 1);
});

test("actual and escaped astral spelling are not normalized into the same source coordinates", () => {
    const actual = '{"note":"🦆",', escaped = '{"note":"\\uD83E\\uDD86",';
    const find = prefix => inspectJsonHazards(prefix + '"role":1,"role":2}').findings[0].first.column;
    assert.equal(find(escaped) - find(actual), 11);
    const compare = prefix => compareJsonTexts(prefix + '"role":1}', prefix + '"role":2}').left.start;
    assert.equal(compare(escaped) - compare(actual), 10);
});
