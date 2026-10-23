/**
* InspectLensEvidence tests
*
* @author SamuelNotes [218310461+agentsidequests@users.noreply.github.com]
* @copyright Crown Copyright 2026
* @license Apache-2.0
*/

import TestRegister from "../../lib/TestRegister.mjs";
import {createJsonEvidence} from "../../../src/core/lib/MagicJsonExport.mjs";

const payload = '{"account":9007199254740993,"role":"viewer","\\u0072ole":"admin"}\n';
const input = createJsonEvidence({text: payload, sources: [{recipe: [], warnings: []}]},
    {report: {original: "fictional-input\r\n", status: "complete"}, mode: "JSON wrappers", index: 0, count: 1});

TestRegister.addTests([
    {
        name: "Inspect Lens Evidence: fresh review without running saved recipes",
        input,
        expectedMatch: /Saved recipes were not executed[\s\S]*2 parsing cautions/,
        recipeConfig: [{op: "Inspect Lens Evidence", args: ["Review"]}],
    },
    {
        name: "Inspect Lens Evidence: exact payload recovery",
        input, expectedOutput: Buffer.from(payload).toString("base64"),
        recipeConfig: [{op: "Inspect Lens Evidence", args: ["Payload text"]}, {op: "To Base64", args: ["A-Za-z0-9+/="]}],
    },
    {
        name: "Inspect Lens Evidence: exact saved input recovery",
        input, expectedOutput: Buffer.from("fictional-input\r\n").toString("base64"),
        recipeConfig: [{op: "Inspect Lens Evidence", args: ["Magic-step input"]}, {op: "To Base64", args: ["A-Za-z0-9+/="]}],
    },
    {
        name: "Inspect Lens Evidence: ordinary JSON is not a Lens record",
        input: "{}", expectedOutput: "Expected a CyberChef Lens evidence record with formatVersion 1.",
        recipeConfig: [{op: "Inspect Lens Evidence", args: ["Review"]}],
    },
]);
