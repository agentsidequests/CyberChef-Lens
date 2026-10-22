/**
 * Interpretation annotations over already checked JSON; no decoding or trust.
 * @author SamuelNotes
 * @license Apache-2.0
 */
const owns = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

/** A shape cue only, not a JOSE-header validator. */
export function isJoseHeaderShape(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value) &&
        owns(value, "alg") && typeof value.alg === "string" && value.alg.length > 0;
}

/** Keep generic field evidence separate from three specific JWT constraints. */
export function annotateWrapperInterpretation(candidate) {
    candidate.interpretationWarnings = [];
    if (candidate.compactVariant) {
        const reasons = [];
        const explicitlyUnsigned = candidate.compactVariant.unsigned && !candidate.variantRefusal &&
            candidate.headerEvidence?.status === "passed" && JSON.parse(candidate.headerEvidence.text).alg === "none";
        if (candidate.compactVariant.padded) {
            reasons.push("padded-fields");
            candidate.interpretationWarnings.push("Padded Base64url fields are inspectable data, not canonical JWT/JWS encoding. No signature or claim has been verified.");
        }
        if (candidate.compactVariant.unsigned) candidate.interpretationWarnings.push(explicitlyUnsigned ?
            "Unsigned token: alg:none declares no signature. Decoding provides no authentication, integrity or claim validation." :
            "The final field is empty: no signature is present. The header interpretation and claims remain unverified.");
        if (candidate.evidence.status === "passed" && Array.isArray(JSON.parse(candidate.evidence.text))) {
            reasons.push("claims-not-object");
            candidate.interpretationWarnings.push("The decoded array is generic JSON, not a JWT Claims Set object.");
        }
        candidate.compatibility = {format: "JWT", status: reasons.length ? "incompatible" : "shape-only", reasons};
        candidate.kind = candidate.compactVariant.unsigned ? explicitlyUnsigned ? "Unsigned compact token (JSON field)" :
            "Empty-signature compact token (unresolved)" : "Padded compact token (JSON field)";
        candidate.resultRole = explicitlyUnsigned ? "Unsigned JSON payload (unverified)" : candidate.compactVariant.padded ?
            "Decoded padded JSON field (unverified)" : "Decoded compact JSON field (unresolved)";
        candidate.payloadAction = explicitlyUnsigned && !reasons.length;
        return;
    }
    if (candidate.compressed === "raw-deflate") {
        candidate.kind = "Compressed JWS-shaped token";
        candidate.resultRole = "Decoded compressed payload (unverified)";
        candidate.compatibility = {format: "Compressed JWS", status: "shape-only", reasons: []};
        candidate.interpretationWarnings.push("Explicit zip:DEF profile: one bounded raw-DEFLATE layer, input limit 64 KiB and output cap 1 MiB. " +
            "Raw DEFLATE has no checksum; valid altered bytes may decode. This is not general JWT/JWE validation, " +
            "SMART credential validation or type reconstruction. Signature, header claims, issuer and producer remain unverified.");
        return;
    }
    if (candidate.headerEvidence?.status === "passed") {
        const header = JSON.parse(candidate.headerEvidence.text);
        const reasons = [];
        if (owns(header, "b64") && header.b64 === false) {
            reasons.push("unencoded-payload");
            candidate.interpretationWarnings.push("JWT compatibility check failed: the header sets b64:false. " +
                "The Base64-decoded middle field is an alternative transformation, not the declared JWS payload.");
        }
        if (header.alg === "none" && candidate.fields.at(-1).value.length) {
            reasons.push("none-with-signature");
            candidate.interpretationWarnings.push("JWT compatibility check failed: alg:none requires an empty signature field. " +
                "This input has a nonempty final field; decoded JSON remains inspectable data.");
        }
        if (candidate.evidence.status === "passed" && Array.isArray(JSON.parse(candidate.evidence.text))) {
            reasons.push("claims-not-object");
            candidate.interpretationWarnings.push("JWT compatibility check failed: a JWT Claims Set must be a JSON object, not an array. " +
                "The decoded array is still valid generic JSON.");
        }
        candidate.compatibility = {format: "JWT", status: reasons.length ? "incompatible" : "shape-only", reasons};
        candidate.kind = reasons.length ? "Three-part token (JSON field)" : "JWT-shaped token";
        candidate.resultRole = reasons.length ? "Decoded middle field (JWT-incompatible)" : "Possible token payload";
        if (reasons.length) candidate.fields[1].name = "Middle field (interpretation unresolved)";
    } else if (!candidate.headerRecipe && candidate.kind === "Flask-compatible session" &&
        candidate.evidence.status === "passed" && isJoseHeaderShape(JSON.parse(candidate.evidence.text))) {
        candidate.kind = "Three-part wrapper (first JSON field)";
        candidate.resultRole = "Possible header / first-field interpretation";
        candidate.fields[0].name = "First field (possible header or payload)";
        candidate.fields[1].name = "Second field (timestamp-shaped only)";
        candidate.interpretationWarnings.push("The first JSON field also resembles a JOSE header: it may be a header rather than the message. " +
            "The second field is only timestamp-shaped. This does not identify a Flask producer or recover the intended message.");
    }
}

/** Annotate fresh result groups without mutating source reports or their data. */
export function annotateMagicInterpretations(groups, wrappers) {
    const warnings = new Set(wrappers.interpretationWarnings || []);
    let envelopeText;
    try {
        const value = JSON.parse(wrappers.original);
        if (value && !Array.isArray(value) && typeof value === "object" && owns(value, "payload") &&
            typeof value.payload === "string" && (owns(value, "signature") && typeof value.signature === "string" ||
                owns(value, "signatures") && Array.isArray(value.signatures))) envelopeText = JSON.stringify(value);
    } catch {
        // Most containers are not JSON themselves; this is not evidence failure.
    }
    const outputs = groups.map(group => {
        const notes = new Set(group.sources.flatMap(source => source.interpretationWarnings || []));
        let role = group.sources.find(source => source.resultRole)?.resultRole || "JSON result";
        if (envelopeText !== undefined && JSON.stringify(JSON.parse(group.text)) === envelopeText) {
            role = "Outer JSON envelope";
            const extracted = wrappers.candidates.some(candidate => candidate.accepted && candidate.origin === "json-envelope");
            notes.add(extracted ? "This is the outer JSON envelope; its inner JSON payload was extracted separately. " +
                "Neither the signature, headers nor the intended meaning have been verified." :
                "This JWS-shaped result is the outer JSON envelope. Its inner payload has not been extracted or interpreted; " +
                "valid container JSON is not evidence of inner-message recovery.");
        }
        for (const note of notes) warnings.add(note);
        return {...group, role, interpretationWarnings: [...notes]};
    });
    return {outputs, interpretationWarnings: [...warnings], messageInterpretation: warnings.size ? "unresolved" : "not-verified"};
}
