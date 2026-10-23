/**
 * JSONBeautify tests.
 *
 * @author Phillip Nordwall [Phillip.Nordwall@gmail.com]
 *
 * @copyright Crown Copyright 2018
 * @license Apache-2.0
 */
import TestRegister from "../../lib/TestRegister.mjs";

TestRegister.addTests([
    {
        name: "JSON Beautify: space, ''",
        input: "",
        expectedOutput: "",
        recipeConfig: [
            {
                op: "JSON Beautify",
                args: [" ", false, false],
            },
        ],
    },
    {
        name: "JSON Beautify: space, number",
        input: "42",
        expectedOutput: "42",
        recipeConfig: [
            {
                op: "JSON Beautify",
                args: [" ", false, false],
            },
        ],
    },
    {
        name: "JSON Beautify: space, string",
        input: "\"string\"",
        expectedOutput: "\"string\"",
        recipeConfig: [
            {
                op: "JSON Beautify",
                args: [" ", false, false],
            },
            {
                op: "HTML To Text",
                args: []
            }
        ],
    },
    {
        name: "JSON Beautify: space, boolean",
        input: "false",
        expectedOutput: "false",
        recipeConfig: [
            {
                op: "JSON Beautify",
                args: [" ", false, false],
            },
        ],
    },
    {
        name: "JSON Beautify: space, emptyList",
        input: "[]",
        expectedOutput: "[]",
        recipeConfig: [
            {
                op: "JSON Beautify",
                args: [" ", false, false],
            },
        ],
    },
    {
        name: "JSON Beautify: space, list",
        input: "[2,1]",
        expectedOutput: "[\n 2,\n 1\n]",
        recipeConfig: [
            {
                op: "JSON Beautify",
                args: [" ", false, false],
            },
        ],
    },
    {
        name: "JSON Beautify: tab, list",
        input: "[2,1]",
        expectedOutput: "[\n\t2,\n\t1\n]",
        recipeConfig: [
            {
                op: "JSON Beautify",
                args: ["\t", false, false],
            },
        ],
    },
    {
        name: "JSON Beautify: space, object",
        input: "{\"second\":2,\"first\":3}",
        expectedOutput: "{\n \"second\": 2,\n \"first\": 3\n}",
        recipeConfig: [
            {
                op: "JSON Beautify",
                args: [" ", false, false],
            },
            {
                op: "HTML To Text",
                args: []
            }
        ],
    },
    {
        name: "JSON Beautify: tab, nested",
        input: "[2,{\"second\":2,\"first\":3,\"beginning\":{\"j\":\"3\",\"i\":[2,3,false]}},1,2,3]",
        expectedOutput: "[\n\t2,\n\t{\n\t\t\"second\": 2,\n\t\t\"first\": 3,\n\t\t\"beginning\": {\n\t\t\t\"j\": \"3\",\n\t\t\t\"i\": [\n\t\t\t\t2,\n\t\t\t\t3,\n\t\t\t\tfalse\n\t\t\t]\n\t\t}\n\t},\n\t1,\n\t2,\n\t3\n]",
        recipeConfig: [
            {
                op: "JSON Beautify",
                args: ["\t", false, false],
            },
            {
                op: "HTML To Text",
                args: []
            }
        ],
    },
    {
        name: "JSON Beautify: tab, nested, sorted",
        input: "[2,{\"second\":2,\"first\":3,\"beginning\":{\"j\":\"3\",\"i\":[2,3,false]}},1,2,3]",
        expectedOutput: "[\n\t2,\n\t{\n\t\t\"beginning\": {\n\t\t\t\"i\": [\n\t\t\t\t2,\n\t\t\t\t3,\n\t\t\t\tfalse\n\t\t\t],\n\t\t\t\"j\": \"3\"\n\t\t},\n\t\t\"first\": 3,\n\t\t\"second\": 2\n\t},\n\t1,\n\t2,\n\t3\n]",
        recipeConfig: [
            {
                op: "JSON Beautify",
                args: ["\t", true, false],
            },
            {
                op: "HTML To Text",
                args: []
            }
        ],
    },
    {
        name: "JSON Beautify: lossless numeric spelling, duplicate members and escapes",
        input: '{"n":9007199254740993,"n":1e400,"escape":"\\u0061"}',
        expectedMatch: /Lossless strict JSON[\s\S]+9007199254740993[\s\S]+1e400[\s\S]+\\u0061/,
        recipeConfig: [{op: "JSON Beautify", args: ["  ", false, true, true]}]
    },
    {
        name: "JSON Beautify: lossless mode refuses key sorting",
        input: '{"b":2,"a":1}',
        expectedOutput: "Lossless JSON preserves member order. Turn off Sort Object Keys or leave lossless mode.",
        recipeConfig: [{op: "JSON Beautify", args: ["  ", true, true, true]}]
    },
    {
        name: "JSON Beautify: lossless mode refuses JSON5",
        input: "{unquoted:1}",
        expectedOutput: "Lossless mode requires a complete strict JSON document; JSON5 syntax is not supported.",
        recipeConfig: [{op: "JSON Beautify", args: ["  ", false, true, true]}]
    },
    {
        name: "JSON Beautify: lossless formatted output reports escaped duplicate aliases",
        input: String.raw`{"role":"reader","\u0072ole":"admin","account":9007199254740993}`,
        expectedMatch: /2 parsing cautions[\s\S]+Repeated member name[\s\S]+line 3, column 3[\s\S]+9007199254740993/,
        recipeConfig: [{op: "JSON Beautify", args: ["  ", false, true, true]}]
    },
    {
        name: "JSON Beautify: lossless plain presentation stays escaped text, not caution HTML",
        input: '{"a":1,"a":2,"n":1e400}',
        expectedOutput: "{\n  &quot;a&quot;: 1,\n  &quot;a&quot;: 2,\n  &quot;n&quot;: 1e400\n}",
        recipeConfig: [{op: "JSON Beautify", args: ["  ", false, false, true]}]
    },
]);
