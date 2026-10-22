/**
* RawInflateBounded tests
*
* @author SamuelNotes
* @license Apache-2.0
*/

import TestRegister from "../../lib/TestRegister.mjs";

TestRegister.addTests([
    {
        name: "Raw Inflate Bounded: exact JSON from raw DEFLATE",
        input: "ab56cacf56b22a292a4dad0500",
        expectedOutput: '{"ok":true}',
        recipeConfig: [
            {op: "From Hex", args: ["Auto"]},
            {op: "Raw Inflate Bounded", args: [1048576]},
        ],
    },
    {
        name: "Raw Inflate Bounded: no partial result past output cap",
        input: "ab56cacf56b22a292a4dad0500",
        expectedOutput: "Bounded raw DEFLATE decode refused: output-limit. No partial output returned.",
        recipeConfig: [{op: "From Hex", args: ["Auto"]}, {op: "Raw Inflate Bounded", args: [10]}],
    },
    {
        name: "Raw Inflate Bounded: trailing bytes are refused",
        input: "ab56cacf56b22a292a4dad05005441494c",
        expectedOutput: "Bounded raw DEFLATE decode refused: trailing-compressed-bytes. No partial output returned.",
        recipeConfig: [{op: "From Hex", args: ["Auto"]}, {op: "Raw Inflate Bounded", args: [1048576]}],
    },
    {
        name: "Raw Inflate Bounded: zlib framing is not a raw stream",
        input: "789cab56cacf56b22a292a4dad050016e30411",
        expectedOutput: "Bounded raw DEFLATE decode refused: invalid-or-truncated-stream. No partial output returned.",
        recipeConfig: [{op: "From Hex", args: ["Auto"]}, {op: "Raw Inflate Bounded", args: [1048576]}],
    },
]);
