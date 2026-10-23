import {test, after} from "node:test";
import assert from "node:assert/strict";
import {readFileSync, writeFileSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, linkSync} from "node:fs";
import {tmpdir} from "node:os";
import {join, dirname, basename} from "node:path";
import {createHash, createPrivateKey, privateEncrypt, sign, constants} from "node:crypto";
import forge from "node-forge";
import RSAVerify from "../../src/core/operations/RSAVerify.mjs";
import {applyForgeRsaBackport, FORGE_RSA_BACKPORT} from "../../src/core/config/scripts/fixForgeRsaValidation.mjs";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const installed = new URL("../../node_modules/node-forge/lib/rsa.js", import.meta.url);
const installedText = readFileSync(installed, "utf8");
const before = "obj.value.length !== 2) {";
const afterGuard = "obj.value.length !== 2 ||\n" +
    "            obj.value[0].value.length !==\n" +
    "              (('parameters' in capture) ? 2 : 1)) {";
const original = hash(installedText) === FORGE_RSA_BACKPORT.patchedSha256 ?
    installedText.replace(afterGuard, before) : installedText;
assert.equal(hash(original), FORGE_RSA_BACKPORT.originalSha256);

const temporaryBase = realpathSync(tmpdir()), containers = [];
after(() => {
    for (const container of containers) {
        assert.equal(dirname(container), temporaryBase);
        assert.ok(basename(container).startsWith("cyberchef-forge-test-"));
        assert.equal(realpathSync(container), container);
        rmSync(container, {recursive: true, force: true});
    }
});

/** Build an owned test installation, optionally linking one dependency directory. */
function fixture(linked = "") {
    const container = mkdtempSync(join(temporaryBase, "cyberchef-forge-test-"));
    containers.push(container);
    const root = join(container, "project"), external = join(container, "shared");
    mkdirSync(root);
    const modules = join(root, "node_modules");
    const packageRoot = linked === "modules" ? join(external, "node-forge") :
        linked === "package" ? external : join(modules, "node-forge");
    const lib = linked === "lib" ? external : join(packageRoot, "lib");
    mkdirSync(packageRoot, {recursive: true});
    mkdirSync(lib, {recursive: true});
    const metadata = join(packageRoot, "package.json"), target = join(lib, "rsa.js");
    writeFileSync(metadata, JSON.stringify({version: "1.4.0"}));
    writeFileSync(target, original);
    const type = process.platform === "win32" ? "junction" : "dir";
    if (linked === "modules") symlinkSync(external, modules, type);
    if (linked === "package") {
        mkdirSync(modules);
        symlinkSync(external, join(modules, "node-forge"), type);
    }
    if (linked === "lib") symlinkSync(external, join(packageRoot, "lib"), type);
    return {container, root, metadata, target};
}

test("the backport applies exact reviewed bytes and is idempotent", () => {
    const sample = fixture();
    assert.equal(applyForgeRsaBackport(sample.root), "applied");
    assert.equal(hash(readFileSync(sample.target)), FORGE_RSA_BACKPORT.patchedSha256);
    assert.equal(applyForgeRsaBackport(sample.root), "already applied");
    assert.equal(hash(readFileSync(sample.target)), FORGE_RSA_BACKPORT.patchedSha256);
});

test("the backport refuses unknown bytes without overwriting them", () => {
    const sample = fixture(), modified = original + "// unknown modification\n";
    writeFileSync(sample.target, modified);
    assert.throws(() => applyForgeRsaBackport(sample.root), /Unrecognized.*refusing/);
    assert.equal(readFileSync(sample.target, "utf8"), modified);
});

test("another node-forge version requires review and is not patched", () => {
    const sample = fixture();
    writeFileSync(sample.metadata, JSON.stringify({version: "1.4.1"}));
    assert.throws(() => applyForgeRsaBackport(sample.root), /another version requires review/);
    assert.equal(hash(readFileSync(sample.target)), FORGE_RSA_BACKPORT.originalSha256);
});

for (const linked of ["modules", "package", "lib"]) {
    test(`the backport refuses a linked ${linked} directory`, () => {
        const sample = fixture(linked);
        assert.throws(() => applyForgeRsaBackport(sample.root), /physical project-local/);
        assert.equal(hash(readFileSync(sample.target)), FORGE_RSA_BACKPORT.originalSha256);
    });
}

test("the backport refuses a hard-linked source file", () => {
    const sample = fixture();
    linkSync(sample.target, join(sample.container, "rsa-shared.js"));
    assert.throws(() => applyForgeRsaBackport(sample.root), /shared file/);
    assert.equal(hash(readFileSync(sample.target)), FORGE_RSA_BACKPORT.originalSha256);
});

test("the executable installation contains the reviewed RSA guard", () => {
    assert.equal(hash(readFileSync(installed)), FORGE_RSA_BACKPORT.patchedSha256);
});

// Already-public upstream test keys; no live key or credential is used.
const rsaFixtures = readFileSync(new URL("../operations/tests/RSA.mjs", import.meta.url), "utf8");
const pemPrivate = rsaFixtures.match(/const PEM_PRIV_2048 = `([\s\S]+?)`;/)[1];
const pemPublic = rsaFixtures.match(/const PEM_PUB_2048 = `([\s\S]+?)`;/)[1];
const privateKey = createPrivateKey(pemPrivate), operation = new RSAVerify();
const message = "Lens fictional local verification boundary test";
const asn = forge.asn1;
const make = (type, constructed, value) => asn.create(asn.Class.UNIVERSAL, type, constructed, value);

for (const [label, algorithm] of [["SHA-1", "sha1"], ["MD5", "md5"], ["SHA-256", "sha256"],
                                  ["SHA-384", "sha384"], ["SHA-512", "sha512"]]) {
    test(`RSA Verify preserves valid ${label} signatures and rejects extra nested elements`, () => {
        const args = [pemPublic, message, "Raw", label];
        const valid = sign(algorithm, Buffer.from(message), privateKey);
        assert.equal(operation.run(valid.toString("latin1"), args), "Verified OK");
        assert.equal(operation.run(valid.toString("latin1"), [pemPublic, message + " changed", "Raw", label]),
            "Verification Failure");
        const digest = createHash(algorithm).update(message).digest("latin1");
        for (const variant of ["extra-octet", "extra-null", "extra-without-null"]) {
            const identifier = [make(asn.Type.OID, false, asn.oidToDer(forge.oids[algorithm]).getBytes())];
            if (variant !== "extra-without-null") identifier.push(make(asn.Type.NULL, false, ""));
            identifier.push(make(variant === "extra-null" ? asn.Type.NULL : asn.Type.OCTETSTRING, false,
                variant === "extra-null" ? "" : "fictional extra child"));
            const info = Buffer.from(asn.toDer(make(asn.Type.SEQUENCE, true, [
                make(asn.Type.SEQUENCE, true, identifier), make(asn.Type.OCTETSTRING, false, digest)
            ])).getBytes(), "latin1");
            const encoded = Buffer.concat([Buffer.from([0, 1]), Buffer.alloc(256 - info.length - 3, 255), Buffer.from([0]), info]);
            const signature = privateEncrypt({key: privateKey, padding: constants.RSA_NO_PADDING}, encoded);
            assert.throws(() => operation.run(signature.toString("latin1"), args), /valid.*DigestInfo/i, variant);
        }
    });
}
