import {test} from "node:test";
import assert from "node:assert/strict";
import Diff from "../../src/core/operations/Diff.mjs";

const delimiter = "\n===\n";
const run = (left, right, added=true, removed=true) => new Diff().run(left + delimiter + right,
    [delimiter, "JSON structure (lossless)", added, removed, false, false]);

test("structure mode locates later fields and retains exact large-number changes", () => {
    const html = run('{"n":9007199254740992,"role":"viewer"}', '{"n":9007199254740993,"role":"admin"}');
    assert.match(html, /2 changes/);
    assert.match(html, /9007199254740992/);
    assert.match(html, /9007199254740993/);
    assert.match(html, /viewer/);
    assert.match(html, /admin/);
    assert.match(html, /line 1, column/);
});

test("structure mode keeps duplicate occurrence identity instead of last-value parsing", () => {
    const html = run(String.raw`{"role":"viewer","\u0072ole":"reviewer"}`, '{"role":"viewer","role":"admin"}');
    assert.match(html, /Key spelling/);
    assert.match(html, /#2/);
    assert.match(html, /reviewer/);
    assert.match(html, /admin/);
});

test("structure mode never calls hidden changes equality and escapes hostile text", () => {
    const html = run('{"kept":1,"removed":"<img src=x onerror=alert(1)>"}', '{"kept":1,"added":"<script>x</script>"}', false, false);
    assert.match(html, /2 changes/);
    assert.match(html, /2 hidden/);
    assert.doesNotMatch(html, /<img|<script/);
});
