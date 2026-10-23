/**
 * Lossless JSON Diff and retained raw-mode controls.
 * @author SamuelNotes
 * @license Apache-2.0
 */
import TestRegister from "../../lib/TestRegister.mjs";

TestRegister.addTests([
    {
        name: "Diff: lossless JSON retains adjacent large numeric tokens",
        input: '{"n":9007199254740992}\n===\n{"n":9007199254740993}',
        expectedMatch: /JSON token text differs[\s\S]+<del>[\s\S]+9007199254740992[\s\S]+<ins>[\s\S]+9007199254740993/,
        recipeConfig: [{op: "Diff", args: ["\\n===\\n", "JSON (lossless)", true, true, false, false]}]
    },
    {
        name: "Diff: lossless JSON identifies formatting-only differences",
        input: '{"n":1.0}\n===\n { "n" : 1.0 }',
        expectedMatch: /Only insignificant JSON whitespace differs[\s\S]+1.0/,
        unexpectedMatch: /<ins>|<del>/,
        recipeConfig: [{op: "Diff", args: ["\\n===\\n", "JSON (lossless)", true, true, false, false]}]
    },
    {
        name: "Diff: original raw JSON mode remains unchanged",
        input: '{"n":9007199254740992}\n===\n{"n":9007199254740993}',
        expectedMatch: /<del>[\s\S]+9007199254740992[\s\S]+<ins>[\s\S]+9007199254740993/,
        unexpectedMatch: /Lossless JSON comparison/,
        recipeConfig: [{op: "Diff", args: ["\\n===\\n", "JSON", true, true, false, false]}]
    },
    {
        name: "Diff: lossless JSON cannot silently compare invalid syntax",
        input: "{}\n===\n{x:1}",
        expectedOutput: "Lossless mode requires a complete strict JSON document; JSON5 syntax is not supported.",
        recipeConfig: [{op: "Diff", args: ["\\n===\\n", "JSON (lossless)", true, true, false, false]}]
    }
]);
