/**
 * Selected JSON parsing cautions; source tokens are never rewritten.
 * @author SamuelNotes
 * @license Apache-2.0
 */
import {inspectJsonText} from "./JsonText.mjs";
import {jsonSourceLocation} from "./JsonSourceLocation.mjs";

/** Original decoded-text location, counting Unicode code points. */
function location(text, token) {
    return {raw: token.raw, ...jsonSourceLocation(text, token.start)};
}

/** Inspect duplicate names and selected JavaScript numeric range effects only. */
export function inspectJsonHazards(text, {maxFindings=16, ...limits}={}) {
    if (!Number.isInteger(maxFindings) || maxFindings < 1 || maxFindings > 32) throw new RangeError("Invalid JSON caution display limit");
    let tokens;
    try {
        ({tokens} = inspectJsonText(text, limits));
    } catch (error) {
        if (!(error instanceof RangeError || error instanceof SyntaxError)) throw error;
        return {status: "not-inspected", reason: error.message, findings: [], total: 0};
    }
    const scopes = [], findings = [], counts = {"duplicate-key": 0, "unsafe-range": 0, "nonfinite-number": 0, "underflow-number": 0};
    let total = 0;
    const record = (code, token, first) => {
        total++; counts[code]++;
        if (findings.length < maxFindings) findings.push({code, token: location(text, token), ...(first ? {first: location(text, first)} : {})});
    };
    for (let index = 0; index < tokens.length; index++) {
        const token = tokens[index];
        if (token.raw === "{") scopes.push(new Map());
        else if (token.raw === "[") scopes.push(null);
        else if (token.raw === "}" || token.raw === "]") scopes.pop();
        else if (token.kind === "string" && tokens[index + 1]?.raw === ":") {
            // Only string tokens are parsed: escaping aliases a name, not a value.
            const name = JSON.parse(token.raw), scope = scopes[scopes.length - 1];
            if (scope.has(name)) record("duplicate-key", token, scope.get(name));
            else scope.set(name, token);
        } else if (token.kind === "number") {
            // A conversion probes a consumer hazard; it never supplies output.
            const value = Number(token.raw);
            if (!Number.isFinite(value)) record("nonfinite-number", token);
            else if (value === 0 && /[1-9]/.test(token.raw.split(/[eE]/)[0])) record("underflow-number", token);
            else if (Math.abs(value) > Number.MAX_SAFE_INTEGER) record("unsafe-range", token);
        }
    }
    return {status: "complete", findings, total, counts, truncated: total > findings.length};
}
