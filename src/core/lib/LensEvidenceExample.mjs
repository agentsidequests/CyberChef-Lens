/** Fictional, editable consistency-check fixture. @license Apache-2.0 */
export function lensEvidenceExample() {
    const payload = '{"case":"SAVE-204","status":"queued","id":1,"id":2}\n';
    const input = btoa(payload) + "\n";
    return JSON.stringify({format: "cyberchef-lens-evidence", formatVersion: 1, producer: "CyberChef Lens",
        notice: "Fictional editable example, not an authenticity proof.",
        input: {encoding: "UTF-8", text: input, byteLength: input.length},
        investigation: {mode: "JSON payload trail", status: "fictional-example"},
        result: {text: payload, byteLength: payload.length, warnings: ["Fictional example; no signature or identity is verified."],
            routes: [{recipe: [{op: "From Base64", args: ["A-Za-z0-9+/=", true, false]}]}]}
    }, null, 2) + "\n";
}
