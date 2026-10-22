/**
* ZlibInflateBounded tests
*
* @author SamuelNotes
* @license Apache-2.0
*/

import TestRegister from "../../lib/TestRegister.mjs";

TestRegister.addTests([
    {
        name: "Zlib Inflate Bounded: exact checksummed JSON",
        input: "789cab56cacf56b22a292a4dad050016e30411",
        expectedOutput: '{"ok":true}',
        recipeConfig: [
            {op: "From Hex", args: ["Auto"]},
            {
                op: "Zlib Inflate Bounded",
                args: [1048576],
            },
        ],
    },
    {
        name: "Zlib Inflate Bounded: no partial output past chosen cap",
        input: "789cab56cacf56b22a292a4dad050016e30411",
        expectedOutput: "Bounded zlib decode refused: output-limit. No partial output returned.",
        recipeConfig: [{op: "From Hex", args: ["Auto"]}, {op: "Zlib Inflate Bounded", args: [10]}],
    },
    {
        name: "Zlib Inflate Bounded: trailing bytes are not silently discarded",
        input: "789cab56cacf56b22a292a4dad050016e304115441494c",
        expectedOutput: "Bounded zlib decode refused: trailing-compressed-bytes. No partial output returned.",
        recipeConfig: [{op: "From Hex", args: ["Auto"]}, {op: "Zlib Inflate Bounded", args: [1048576]}],
    },
]);
