import {test} from "node:test";
import assert from "node:assert/strict";
import {presentJsonComparison, presentPayloadTrail} from "../../src/core/lib/MagicJsonPresentation.mjs";

const group = (text, extra={}) => ({text, sources: [{recipe: [], depth: 0, hops: [], warnings: []}], ...extra});

test("a comparison locates exact large-number changes and cannot bypass recipe warnings", () => {
    const html = presentJsonComparison([group('{"n":9007199254740992}'), group('{"n":9007199254740993}')]);
    assert.match(html, /JSON token text differs/);
    assert.match(html, /9007199254740992/);
    assert.match(html, /9007199254740993/);
    assert.match(html, /line 1, column 6/);
    assert.match(html, /not a complete diff or semantic-equivalence/);
    assert.doesNotMatch(html, /href=|Load .*recipe/);
    assert.match(html, /Recipes and their warnings remain/);
});

test("formatting-only texts stay separate without implying semantic equality", () => {
    const html = presentJsonComparison([group('{"n":1.0}'), group(' { "n" : 1.0 }')]);
    assert.match(html, /Only insignificant JSON whitespace differs/);
    assert.match(html, /original formatting and each decoding route remain separate/);
    assert.doesNotMatch(html, /JSON token text differs/);
});

test("outer envelopes and payload layers are not promoted to competing answers", () => {
    const html = presentJsonComparison([group('{"payload":"e30"}', {role: "Outer JSON envelope"}), group("{}", {role: "Possible payload"})]);
    assert.match(html, /Different container\/payload layers are not competing answers/);
    assert.doesNotMatch(html, /class="mj-comparison" open/);
    assert.match(html, /Result 1 · Outer JSON envelope/);
});

test("the comparison caps pairs, refuses oversize text and never hides retained outputs", () => {
    assert.equal(presentJsonComparison([group("{}")]), "");
    const html = presentJsonComparison([group("{}"), group(" ".repeat(65537))]);
    assert.match(html, /Not compared/);
    assert.match(html, /original results and recipes are still available/);
    const many = presentJsonComparison(Array.from({length: 12}, (_, i) => group(`{"n":${i}}`)));
    assert.match(many, /first 8 of 12 retained texts/);
    assert.equal((many.match(/class="mj-pair"/g) || []).length, 7);
});

test("hostile strings and result roles are escaped in the comparison", () => {
    const html = presentJsonComparison([group('{"x":"<img onerror=alert(1)>"}', {role: '<svg onload="x">'}), group('{"x":"<script>x</script>"}')]);
    assert.doesNotMatch(html, /<img|<script|<svg/);
    assert.match(html, /&lt;img/);
    assert.match(html, /&lt;svg/);
});

test("a long token preview is centered on the change instead of clipping the deciding character", () => {
    const left = JSON.stringify({note: "a".repeat(800) + "OLD" + "z".repeat(800)});
    const right = JSON.stringify({note: "a".repeat(800) + "NEW" + "z".repeat(800)});
    const html = presentJsonComparison([group(left), group(right)]);
    assert.match(html, /OLD/);
    assert.match(html, /NEW/);
    assert.ok(html.length < 4000);
});

test("trail cards use matching result numbers and disclose ignored search controls", () => {
    const outputs = [group('{"x":1}'), group("{}")].map((item, index) => ({...item, byteLength: item.text.length,
        sources: [{recipe: [], depth: 2 - index, kind: "Test layer", hops: [], warnings: []}]}));
    const report = {outputs, nodes: [], stops: [], status: "complete", checkedReplays: 2, retainedBytes: 9,
        limits: {maxDepth: 3, maxStates: 16, maxReplays: 64, maxRetainedBytes: 2097152, maxOutputBytes: 1048576, maxMillis: 3000}};
    const html = presentPayloadTrail(report, {recipeUrl: () => "#recipe=Test()", anyUrl: "#recipe=Magic()"});
    assert.match(html, /Result 1 · Layer 2/);
    assert.match(html, /Result 2 · Layer 1/);
    assert.match(html, /Result 1 · layer 2/);
    assert.ok(html.indexOf("Crib, intensive mode and language settings are not used") < html.indexOf("Load full JSON recipe"));
});
