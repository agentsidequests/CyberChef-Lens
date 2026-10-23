import {test} from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";

test("browser-bundled Jimp decodes, resizes and refuses malformed ASF without a DOM", () => {
    const root = fileURLToPath(new URL("../../", import.meta.url));
    const code = `
        import assert from "node:assert/strict";
        import {mkdtempSync, writeFileSync, rmSync} from "node:fs";
        import {tmpdir} from "node:os";
        import {join, resolve, sep} from "node:path";
        import {createRequire} from "node:module";
        import webpack from "webpack";
        const root = process.cwd(), require = createRequire(join(root, "package.json"));
        assert.equal(typeof document, "undefined");
        const base = require("./webpack.config.js"), prefix = join(tmpdir(), "cyberchef-jimp-browser-");
        const folder = mkdtempSync(prefix), entry = join(folder, "entry.mjs");
        try {
            writeFileSync(entry, 'import {Jimp, JimpMime, ResizeStrategy} from "jimp"; export async function smoke() {' +
                'if (!JimpMime.png || !ResizeStrategy.NEAREST_NEIGHBOR) throw new Error("Missing image exports");' +
                'const source = new Jimp({width:2,height:2,color:0x336699ff});' +
                'const png = await source.getBuffer(JimpMime.png); const image = await Jimp.read(png);' +
                'image.resize({w:4,h:3,mode:ResizeStrategy.NEAREST_NEIGHBOR});' +
                'const restored = await Jimp.read(await image.getBuffer(JimpMime.png));' +
                'let rejected=0; for(const size of [0,1,23,24]) {const bytes=Buffer.alloc(55); Buffer.from("3026b2758e66cf11a6d9","hex").copy(bytes); bytes.writeBigUInt64LE(BigInt(size),46); try {await Jimp.read(bytes);} catch(e) {if (!/mime|type|format/i.test(e.message)) throw e; rejected++;}}' +
                'return {width:restored.width,height:restored.height,pixel:restored.getPixelColor(0,0),rejected};}');
            const compiler = webpack({mode:"development",target:"web",devtool:false,entry,
                output:{path:folder,filename:"bundle.cjs",library:{type:"commonjs2"},publicPath:"",globalObject:"globalThis"},
                resolve:{...base.resolve,modules:[join(root,"node_modules"),"node_modules"]},
                module:{rules:base.module.rules.filter(rule => rule.parser)},
                optimization:{minimize:false},
                plugins:[new webpack.ProvidePlugin({Buffer:["buffer","Buffer"],process:"process"}),
                    new webpack.DefinePlugin({"process.browser":"true"})]});
            const stats = await new Promise((done, fail) => compiler.run((error,result) => error ? fail(error) : done(result)));
            await new Promise((done,fail) => compiler.close(error => error ? fail(error) : done()));
            assert.equal(stats.hasErrors(),false,stats.toString({all:false,errors:true}));
            const warnings = stats.toString({all:false,warnings:true});
            assert.ok(!/export .*not found.*jimp/i.test(warnings),"Jimp browser exports must be present: " + warnings);
            assert.deepEqual(await require(join(folder,"bundle.cjs")).smoke(),{width:4,height:3,pixel:0x336699ff,rejected:4});
            console.log("BROWSER_IMAGE_PASS");
        } finally {
            assert.ok(resolve(folder).startsWith(resolve(tmpdir()) + sep));
            assert.ok(resolve(folder).startsWith(resolve(prefix)));
            rmSync(folder,{recursive:true,force:true});
        }
    `;
    const result = spawnSync(process.execPath, ["--input-type=module", "--eval", code], {cwd: root, encoding: "utf8", timeout: 60000, maxBuffer: 1048576});
    assert.equal(result.error?.code, undefined, "The browser bundle check must complete within its bounded child");
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /BROWSER_IMAGE_PASS/);
});
