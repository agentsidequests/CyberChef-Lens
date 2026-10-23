/** Exact, bounded UTF-8 file reading for the guided workspace. @license Apache-2.0 */
export function readLensSource(input) {
    const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) :
        ArrayBuffer.isView(input) ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength) : null;
    if (!bytes) throw new TypeError("Load a UTF-8 text file.");
    if (bytes.length > 65536) throw new RangeError("Each source is limited to 64 KiB. The file was not shortened.");
    try {
        return new TextDecoder("utf-8", {fatal: true, ignoreBOM: true}).decode(bytes);
    } catch {
        throw new TypeError("This file is not strict UTF-8 text. Use the recipe workspace for binary data.");
    }
}
