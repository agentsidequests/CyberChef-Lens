/**
 * Output-growth and whole-stream controls over Pako's public inflate API.
 * Not a hard process-memory/time boundary or an authenticity check.
 * @author SamuelNotes
 * @license Apache-2.0
 */
import {ZStream, zlibInflateInit2, zlibInflate, zlibInflateEnd,
    Z_OK, Z_STREAM_END, Z_NEED_DICT, Z_NO_FLUSH} from "pako-bounded";

/** Decode exactly one checksummed zlib stream, without returning partial data. */
export function boundedZlib(input, options) {
    return boundedInflate(input, options, 15);
}

/** Decode exactly one raw DEFLATE stream. Raw framing has no checksum. */
export function boundedRawDeflate(input, options) {
    return boundedInflate(input, options, -15);
}

/** Shared controls; explicit framing never enables automatic format fallback. */
function boundedInflate(input, {maxOutputBytes=1048576, maxMillis=2000, signal}={}, windowBits) {
    if (!(input instanceof Uint8Array) || input.byteLength > 65536) throw new RangeError("Compressed input limit is 64 KiB.");
    if (!Number.isInteger(maxOutputBytes) || maxOutputBytes < 1 || maxOutputBytes > 1048576 ||
        !Number.isFinite(maxMillis) || maxMillis < 0 || maxMillis > 2000) throw new RangeError("Invalid bounded inflate limit.");
    const stream = new ZStream();
    const chunks = [];
    const start = performance.now();
    let retainedBytes = 0;
    let emittedBytes = 0;
    let iterations = 0;
    let maxChunkBytes = 0;
    let status = "incomplete";
    let reason = null;
    let bytes;
    const fail = (failure, category="rejected") => {
        status = category;
        reason = failure;
    };
    if (zlibInflateInit2(stream, windowBits) !== Z_OK) throw new Error("Inflater initialization failed.");
    stream.input = input;
    // eslint-disable-next-line camelcase -- Public Pako z_stream API field.
    stream.next_in = 0;
    // eslint-disable-next-line camelcase -- Public Pako z_stream API field.
    stream.avail_in = input.byteLength;
    try {
        for (;;) {
            if (signal?.aborted) {
                fail("cancelled", "incomplete");
                break;
            }
            if (performance.now() - start >= maxMillis) {
                fail("time-limit", "incomplete");
                break;
            }
            // One extra byte distinguishes exact-cap stream end from overflow.
            const length = Math.min(16384, maxOutputBytes - retainedBytes + 1);
            stream.output = new Uint8Array(length);
            // eslint-disable-next-line camelcase -- Public Pako z_stream API field.
            stream.next_out = 0;
            // eslint-disable-next-line camelcase -- Public Pako z_stream API field.
            stream.avail_out = length;
            const before = stream.next_in;
            const code = zlibInflate(stream, Z_NO_FLUSH);
            iterations++;
            const produced = stream.next_out;
            emittedBytes += produced;
            maxChunkBytes = Math.max(maxChunkBytes, produced);
            if (emittedBytes > maxOutputBytes) {
                fail("output-limit", "incomplete");
                break;
            }
            if (code !== Z_OK && code !== Z_STREAM_END) {
                fail(code === Z_NEED_DICT ? "dictionary-required" : "invalid-or-truncated-stream");
                break;
            }
            if (produced) {
                chunks.push(stream.output.subarray(0, produced));
                retainedBytes += produced;
            }
            if (code === Z_STREAM_END) {
                if (stream.avail_in) {
                    fail("trailing-compressed-bytes");
                    break;
                }
                bytes = new Uint8Array(retainedBytes);
                let offset = 0;
                for (const chunk of chunks) {
                    bytes.set(chunk, offset);
                    offset += chunk.length;
                }
                status = "passed";
                break;
            }
            if (!produced && before === stream.next_in) {
                fail("truncated-stream");
                break;
            }
        }
    } finally {
        zlibInflateEnd(stream);
    }
    return {status, reason, bytes, retainedBytes, emittedBytes, iterations, maxChunkBytes,
        consumedBytes: stream.next_in, inputBytes: input.byteLength, stateFreed: stream.state === null};
}
