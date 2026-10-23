import {test} from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";

test("image operations return only the encoded Buffer view, with no adjacent allocation bytes", () => {
    const root = fileURLToPath(new URL("../../", import.meta.url));
    const code = `
        import assert from "node:assert/strict";
        import {registerHooks} from "node:module";
        import {fileURLToPath} from "node:url";
        import {relative} from "node:path";
        import {Jimp} from "jimp";
        import {PNG_HEX} from "./tests/samples/Images.mjs";
        const root = process.cwd();
        // Supply the same local font assets that webpack exposes in the browser.
        const hooks = registerHooks({load(url, context, nextLoad) {
            if (/\\.(?:fnt|png)$/.test(url)) return {format:"module", shortCircuit:true,
                source:"export default " + JSON.stringify(relative(root, fileURLToPath(url)).replaceAll("\\\\", "/"))};
            return nextLoad(url, context);
        }});
        globalThis.self = {docURL:root};
        const names = ["AddTextToImage", "BlurImage", "ContainImage", "ConvertImageFormat",
            "CoverImage", "CropImage", "DitherImage", "FlipImage", "ImageBrightnessContrast",
            "ImageFilter", "ImageHueSaturationLightness", "ImageOpacity", "InvertImage",
            "NormaliseImage", "ResizeImage", "RotateImage", "SharpenImage"];
        const original = Jimp.prototype.getBuffer;
        let encoded, allocation, calls = 0;
        const wrongLengths = [];
        Jimp.prototype.getBuffer = async function(...args) {
            encoded = await original.apply(this, args);
            allocation = Buffer.alloc(encoded.length + 64, 0xa5);
            const view = allocation.subarray(23, 23 + encoded.length);
            encoded.copy(view);
            assert.ok(view.byteOffset > 0 && view.byteLength < view.buffer.byteLength);
            calls++;
            return view;
        };
        try {
            const bytes = Buffer.from(PNG_HEX, "hex");
            const input = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
            for (const name of names) {
                const {default: Op} = await import("./src/core/operations/" + name + ".mjs");
                const op = new Op();
                const args = op.args.map(arg => Array.isArray(arg.value) ? arg.value[arg.defaultIndex ?? 0] : arg.value);
                op.args.forEach((arg, index) => {
                    if (arg.name === "Width" || arg.name === "Height") args[index] = 12;
                    if (arg.name === "Text") args[index] = "A";
                    if (arg.name === "Size") args[index] = 8;
                });
                const before = calls, output = await op.run(input, args);
                assert.equal(calls, before + 1, name + " must reach the encoder");
                assert.ok(output instanceof ArrayBuffer, name);
                if (output.byteLength !== encoded.length) {
                    wrongLengths.push(name);
                    continue;
                }
                assert.ok(Buffer.from(output).equals(encoded), name + " must preserve exactly the encoded bytes");
                allocation.fill(0x5a);
                assert.ok(Buffer.from(output).equals(encoded), name + " output must own its bytes");
                const decoded = await Jimp.read(Buffer.from(output));
                assert.ok(decoded.width > 0 && decoded.height > 0, name);
            }
            assert.deepEqual(wrongLengths, [], "Operations must return exactly the encoded length");
            console.log("EXACT_IMAGE_VIEWS " + names.length);
        } finally {
            Jimp.prototype.getBuffer = original;
            hooks.deregister();
            delete globalThis.self;
        }
    `;
    const run = spawnSync(process.execPath, ["--no-warnings", "--openssl-legacy-provider", "--input-type=module", "--eval", code],
        {cwd: root, encoding: "utf8", timeout: 60000, maxBuffer: 1048576});
    assert.equal(run.error?.code, undefined, "Image boundary check must complete within the bounded child");
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.match(run.stdout, /EXACT_IMAGE_VIEWS 17/);
});

test("Node image wrappers produce complete decodable images under the normal Buffer pool", async () => {
    const {Jimp} = await import("jimp");
    const {resizeImage, convertImageFormat} = await import("../../src/node/index.mjs");
    const fixtures = await import("../samples/Images.mjs");
    assert.ok(Buffer.poolSize > 0, "Do not disable pooling to qualify this boundary");
    const solid = new Jimp({width: 3, height: 2, color: 0x336699ff});
    const inputs = [Buffer.from(fixtures.PNG_HEX, "hex"), Buffer.from(fixtures.JPG_B64, "base64"),
                    Buffer.from(fixtures.GIF_ANIMATED_HEX, "hex"), await solid.getBuffer("image/bmp"), await solid.getBuffer("image/tiff")];
    for (const input of inputs) {
        const original = await Jimp.read(input);
        const resized = await resizeImage(input, {width: 4, height: 3, resizingAlgorithm: "Nearest Neighbour"});
        const image = await Jimp.read(Buffer.from(resized.to("ArrayBuffer")));
        assert.equal(image.width, 4);
        assert.equal(image.height, 3);
        const converted = await convertImageFormat(input, {outputFormat: "PNG"});
        const restored = await Jimp.read(Buffer.from(converted.to("ArrayBuffer")));
        assert.equal(restored.width, original.width);
        assert.equal(restored.height, original.height);
        assert.ok(restored.bitmap.data.equals(original.bitmap.data));
    }
    for (const outputFormat of ["JPEG", "PNG", "BMP", "TIFF"]) {
        const dish = await convertImageFormat(inputs[0], {outputFormat});
        const image = await Jimp.read(Buffer.from(dish.to("ArrayBuffer")));
        assert.equal(image.width, 32);
        assert.equal(image.height, 32);
    }
    await assert.rejects(resizeImage(Buffer.from("not an image")), /Invalid file type/);
    await assert.rejects(convertImageFormat(Buffer.from("not an image")), /Invalid file format/);
});
