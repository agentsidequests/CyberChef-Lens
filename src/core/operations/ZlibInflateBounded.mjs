/**
 * @author SamuelNotes
 * @license Apache-2.0
 */

import Operation from "../Operation.mjs";
import OperationError from "../errors/OperationError.mjs";
import {boundedZlib} from "../lib/BoundedZlib.mjs";

/**
 * Zlib Inflate Bounded operation
 */
class ZlibInflateBounded extends Operation {

    /**
     * ZlibInflateBounded constructor
     */
    constructor() {
        super();

        this.name = "Zlib Inflate Bounded";
        this.module = "BoundedCompression";
        this.description = "Decompresses exactly one complete checksummed zlib stream. Rejects trailing bytes, truncation, required dictionaries and wrong framing. Maximum compressed input 64 KiB; output is limited during decoding, not only after allocation. At most one overflow-detection byte is produced beyond the selected output cap; partial output is never returned.<br><br>Output chunks are at most 16 KiB. Decoder workspace and successful output assembly use additional memory. The two-second timer is cooperative between chunks, not a hard wall-clock or process-memory limit. This does not verify a signature or the meaning of decoded data. Raw DEFLATE and gzip are not supported by this operation.";
        this.infoURL = "https://wikipedia.org/wiki/Zlib";
        this.inputType = "ArrayBuffer";
        this.outputType = "ArrayBuffer";
        this.args = [
            {
                name: "Maximum output bytes",
                type: "number",
                value: 1048576,
                min: 1,
                max: 1048576,
                integer: true
            }
        ];
    }

    /**
     * @param {ArrayBuffer} input
     * @param {Object[]} args
     * @returns {ArrayBuffer}
     */
    run(input, args) {
        if (input.byteLength > 65536) throw new OperationError("Compressed input limit is 64 KiB.");
        const result = boundedZlib(new Uint8Array(input), {maxOutputBytes: args[0]});
        if (result.status !== "passed") throw new OperationError(`Bounded zlib decode refused: ${result.reason}. No partial output returned.`);
        return result.bytes.buffer;
    }

}

export default ZlibInflateBounded;
