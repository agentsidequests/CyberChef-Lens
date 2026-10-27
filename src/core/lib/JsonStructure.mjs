/**
 * Bounded structural comparison over original strict-JSON tokens.
 * Only member names are decoded; primitive values never pass through coercion.
 * @author SamuelNotes
 * @license Apache-2.0
 */
import {inspectJsonText} from "./JsonText.mjs";
import {jsonSourceLocation} from "./JsonSourceLocation.mjs";

/** Build a source-span tree after the existing syntax and budget checks. */
function tree(text, limits) {
    const {tokens} = inspectJsonText(text, limits);
    let cursor = 0;
    const read = () => {
        const token = tokens[cursor++], raw = token.raw;
        const kind = raw === "{" ? "object" : raw === "[" ? "array" :
            raw === "null" ? "null" : raw === "true" || raw === "false" ? "boolean" : token.kind;
        const node = {kind, start: token.start, end: token.end};
        if (kind === "object") {
            node.members = []; node.counts = new Map(); node.byId = new Map();
            while (tokens[cursor].raw !== "}") {
                const key = tokens[cursor++], name = JSON.parse(key.raw);
                const occurrence = (node.counts.get(name) || 0) + 1;
                node.counts.set(name, occurrence);
                cursor++; // colon; complete strict syntax was checked above
                const member = {key, name, occurrence, id: JSON.stringify([name, occurrence]), value: read()};
                node.members.push(member); node.byId.set(member.id, member);
                if (tokens[cursor].raw !== ",") break;
                cursor++;
            }
            node.end = tokens[cursor++].end;
        } else if (kind === "array") {
            node.items = [];
            while (tokens[cursor].raw !== "]") {
                node.items.push(read());
                if (tokens[cursor].raw !== ",") break;
                cursor++;
            }
            node.end = tokens[cursor++].end;
        }
        return node;
    };
    return read();
}

/** Source line and Unicode-character column; never a byte-offset claim. */
function side(text, span) {
    if (!span) return null;
    return {raw: text.slice(span.start, span.end), start: span.start, end: span.end,
        ...jsonSourceLocation(text, span.start)};
}

/** Keep a long path bounded, without cutting a surrogate pair. */
function pathLabel(parts) {
    let label = "$", shortened = false;
    for (const part of parts) {
        if (label.length + part.length > 512) {
            const end = Math.max(0, 509 - label.length);
            let piece = part.slice(0, end);
            if (/[\uD800-\uDBFF]$/.test(piece)) piece = piece.slice(0, -1);
            label += piece + "…"; shortened = true; break;
        }
        label += part;
    }
    return {path: label, pathShortened: shortened};
}

/**
 * Match decoded member name plus occurrence, arrays by index. Not semantic diff.
 * Count all bounded-tree changes while retaining at most maxChanges detail rows.
 */
export function compareJsonStructure(left, right, {maxChanges=128, ...limits}={}) {
    if (!Number.isInteger(maxChanges) || maxChanges < 1 || maxChanges > 128) throw new RangeError("Invalid structural detail limit");
    const a = tree(left, limits), b = tree(right, limits);
    const changes = [], counts = {value: 0, type: 0, added: 0, removed: 0, "key-spelling": 0, "member-order": 0};
    let total = 0;
    const record = (kind, path, oldSpan, newSpan) => {
        total++; counts[kind]++;
        if (changes.length < maxChanges) changes.push({kind, ...pathLabel(path), left: side(left, oldSpan), right: side(right, newSpan)});
    };
    const walk = (oldNode, newNode, path) => {
        if (!oldNode) {
            record("added", path, null, newNode); return;
        }
        if (!newNode) {
            record("removed", path, oldNode, null); return;
        }
        if (oldNode.kind !== newNode.kind) {
            record("type", path, oldNode, newNode); return;
        }
        if (oldNode.kind === "object") {
            const oldCommon = oldNode.members.filter(member => newNode.byId.has(member.id));
            const newCommon = newNode.members.filter(member => oldNode.byId.has(member.id));
            if (oldCommon.some((member, index) => member.id !== newCommon[index].id)) {
                record("member-order", path, oldNode, newNode);
            }
            for (const member of oldNode.members) {
                const match = newNode.byId.get(member.id);
                const duplicate = Math.max(oldNode.counts.get(member.name), newNode.counts.get(member.name) || 0) > 1;
                const childPath = path.concat(`[${JSON.stringify(member.name)}]${duplicate ? `#${member.occurrence}` : ""}`);
                if (match && member.key.raw !== match.key.raw) record("key-spelling", childPath, member.key, match.key);
                walk(member.value, match?.value, childPath);
            }
            for (const member of newNode.members) {
                if (oldNode.byId.has(member.id)) continue;
                const duplicate = Math.max(oldNode.counts.get(member.name) || 0, newNode.counts.get(member.name)) > 1;
                walk(null, member.value, path.concat(`[${JSON.stringify(member.name)}]${duplicate ? `#${member.occurrence}` : ""}`));
            }
        } else if (oldNode.kind === "array") {
            for (let index = 0; index < Math.max(oldNode.items.length, newNode.items.length); index++) {
                walk(oldNode.items[index], newNode.items[index], path.concat(`[${index}]`));
            }
        } else if (left.slice(oldNode.start, oldNode.end) !== right.slice(newNode.start, newNode.end)) {
            record("value", path, oldNode, newNode);
        }
    };
    walk(a, b, []);
    return {status: total ? "different" : left === right ? "identical" : "formatting-only", total, counts, changes, maxChanges,
        truncated: total > changes.length};
}
