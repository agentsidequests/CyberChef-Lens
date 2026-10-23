import {test} from "node:test";
import assert from "node:assert/strict";
import {z} from "zod";

test("oversized bounded Zod arrays stop before visiting their elements", () => {
    let visited = 0;
    const schema = z.array(z.preprocess(value => {
        visited++;
        return value;
    }, z.string())).max(4);
    const result = schema.safeParse(Array(256).fill(0));
    assert.equal(result.success, false);
    assert.equal(visited, 0);
    assert.equal(result.error.issues.length, 1);
});

test("an unbounded Zod array still visits all elements and reports their issues", () => {
    let visited = 0;
    const schema = z.array(z.preprocess(value => {
        visited++;
        return value;
    }, z.string()));
    const result = schema.safeParse(Array(256).fill(0));
    assert.equal(result.success, false);
    assert.equal(visited, 256);
    assert.equal(result.error.issues.length, 256);
});

test("valid values within a Zod array bound still receive element validation", () => {
    let visited = 0;
    const schema = z.array(z.preprocess(value => {
        visited++;
        return value;
    }, z.string())).max(4);
    assert.deepEqual(schema.parse(["one", "two"]), ["one", "two"]);
    assert.equal(visited, 2);
});
