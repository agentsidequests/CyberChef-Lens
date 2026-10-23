import {test} from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";

test("Jimp completes malformed ASF rejection while retaining valid PNG decoding", () => {
    const root = fileURLToPath(new URL("../../", import.meta.url));
    const code = `
        import assert from "node:assert/strict";
        import {Jimp} from "jimp";
        const image = new Jimp({width: 2, height: 2, color: 0x336699ff});
        const png = await image.getBuffer("image/png");
        const restored = await Jimp.read(png);
        assert.equal(restored.width, 2); assert.equal(restored.height, 2);
        assert.equal(restored.getPixelColor(0, 0), 0x336699ff);
        console.log("READY");
        for (const size of [0, 1, 23, 24]) {
            const bytes = Buffer.alloc(55);
            Buffer.from("3026b2758e66cf11a6d9", "hex").copy(bytes);
            bytes.writeBigUInt64LE(BigInt(size), 46);
            await assert.rejects(Jimp.read(bytes), /mime|type|format/i);
        }
        console.log("REJECTED");
    `;
    const result = spawnSync(process.execPath, ["--input-type=module", "--eval", code], {cwd: root, encoding: "utf8", timeout: 10000});
    assert.equal(result.error?.code, undefined, "File detection must complete within the bounded child process");
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /READY/); assert.match(result.stdout, /REJECTED/);
});
