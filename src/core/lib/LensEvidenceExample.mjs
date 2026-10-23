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

/** Invented credentials and identity for the sharing workflow; no real secrets. */
export function lensSharingExample() {
    const record = JSON.parse(lensEvidenceExample());
    const payload = '{"case":"SHARE-204","access_token":"EXAMPLE-TOKEN-NOT-REAL","customer":"Ada Example","id":9007199254740993}\n';
    record.input.text = btoa(payload) + "\n"; record.input.byteLength = record.input.text.length;
    record.result.text = payload; record.result.byteLength = payload.length;
    return JSON.stringify(record, null, 2) + "\n";
}
