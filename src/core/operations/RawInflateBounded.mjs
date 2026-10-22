/**
 * @author SamuelNotes
 * @license Apache-2.0
 */

import Operation from "../Operation.mjs";
import OperationError from "../errors/OperationError.mjs";
import {boundedRawDeflate} from "../lib/BoundedZlib.mjs";

/**
 * Raw Inflate Bounded operation
 */
class RawInflateBounded extends Operation {

    /**
     * RawInflateBounded constructor
     */
    constructor() {
        super();

        this.name = "Raw Inflate Bounded";
        this.module = "BoundedCompression";
        this.description = "Decompresses exactly one complete raw DEFLATE stream, with no zlib or gzip header. Rejects trailing bytes, truncation and wrong framing. Compressed input is limited to 64 KiB; output is capped during decoding. At most one overflow-detection byte is produced beyond the selected cap; partial output is never returned.<br><br>Raw DEFLATE has no checksum: a changed but valid stream can still decode successfully. Chunks are at most 16 KiB; decoder workspace and successful output assembly use additional memory. The two-second timer is cooperative between chunks, not a hard wall-clock or process-memory boundary. Decoding does not authenticate a signature or the meaning of data.";
        this.infoURL = "https://wikipedia.org/wiki/DEFLATE";
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
        const result = boundedRawDeflate(new Uint8Array(input), {maxOutputBytes: args[0]});
        if (result.status !== "passed") throw new OperationError(`Bounded raw DEFLATE decode refused: ${result.reason}. No partial output returned.`);
        return result.bytes.buffer;
    }

}

export default RawInflateBounded;
