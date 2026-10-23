/**
 * Lossless JSON Diff and retained raw-mode controls.
 * @author SamuelNotes
 * @license Apache-2.0
 */
import TestRegister from "../../lib/TestRegister.mjs";

TestRegister.addTests([
    {
        name: "Diff: structural JSON locates exact later field changes",
        input: '{"n":9007199254740992,"role":"viewer"}\n===\n{"n":9007199254740993,"role":"admin"}',
        expectedMatch: /2 changes[\s\S]+9007199254740992[\s\S]+9007199254740993[\s\S]+viewer[\s\S]+admin/,
        recipeConfig: [{op: "Diff", args: ["\\n===\\n", "JSON structure (lossless)", true, true, false, false]}]
    },
    {
        name: "Diff: structural JSON retains duplicate occurrence and escape alias",
        input: '{"role":1,"\\u0072ole":2}\n===\n{"role":1,"role":3}',
        expectedMatch: /2 changes[\s\S]+Key spelling[\s\S]+#2[\s\S]+Value \/ token spelling/,
        recipeConfig: [{op: "Diff", args: ["\\n===\\n", "JSON structure (lossless)", true, true, false, false]}]
    },
    {
        name: "Diff: structural JSON filters do not imply equality",
        input: '{"old":1}\n===\n{"new":2}',
        expectedMatch: /2 changes[\s\S]+2 hidden[\s\S]+No retained change rows/,
        unexpectedMatch: /class="js-change"|Exact source texts match/,
        recipeConfig: [{op: "Diff", args: ["\\n===\\n", "JSON structure (lossless)", false, false, false, false]}]
    },
    {
        name: "Diff: structural JSON reports order without fabricated value changes",
        input: '{"a":1,"b":2}\n===\n{"b":2,"a":1}',
        expectedMatch: /1 change across[\s\S]+Member order/,
        unexpectedMatch: /<h3>Value/,
        recipeConfig: [{op: "Diff", args: ["\\n===\\n", "JSON structure (lossless)", true, true, false, false]}]
    },
    {
        name: "Diff: structural JSON refuses malformed text",
        input: "{}\n===\n{x:1}",
        expectedOutput: "Lossless mode requires a complete strict JSON document; JSON5 syntax is not supported.",
        recipeConfig: [{op: "Diff", args: ["\\n===\\n", "JSON structure (lossless)", true, true, false, false]}]
    },
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
