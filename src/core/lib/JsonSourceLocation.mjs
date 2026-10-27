/**
 * Logical source lines and Unicode-code-point columns from a raw UTF-16 offset.
 * Only the derived prefix is normalized; original source and offsets stay intact.
 * @author SamuelNotes
 * @license Apache-2.0
 */
export function jsonSourceLocation(text, sourceOffset) {
    const prefix = text.slice(0, sourceOffset).replace(/\r\n?/g, "\n");
    return {line: prefix.split("\n").length,
        column: [...prefix.slice(prefix.lastIndexOf("\n") + 1)].length + 1};
}
