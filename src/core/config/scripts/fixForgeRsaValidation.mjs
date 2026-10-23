/**
 * Backport the reviewed nested DigestAlgorithm element-count guard only.
 * Upstream candidate: digitalbazaar/forge#1152, ceba34402e329f0365134f23fe19898756527d65.
 * This does not change the published package version or suppress its advisory.
 *
 * @author SamuelNotes
 * @license Apache-2.0
 */

/* eslint no-console: ["off"] */

import {createHash} from "node:crypto";
import {readFileSync, writeFileSync, realpathSync, statSync} from "node:fs";
import {join, resolve} from "node:path";
import {pathToFileURL} from "node:url";

export const FORGE_RSA_BACKPORT = Object.freeze({
    version: "1.4.0",
    originalSha256: "fd4740238145ec26470eb3f06a627c72039538ce1307dbdce40521f94dfd0a50",
    patchedSha256: "c9b1e3799e230528b6d6815c1f6cd3c6058b9d45975264b55d995abb976589af"
});

const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

/**
 * Apply the exact reviewed guard to an owned physical npm installation.
 * Refuse another version, unknown bytes or linked/shared dependency targets.
 * A future upstream release requires a new review rather than a guessed patch.
 *
 * @param {string} [root=process.cwd()] - Project root with installed dependencies.
 * @returns {string} Whether the guard was applied or already present.
 */
export function applyForgeRsaBackport(root = process.cwd()) {
    const ownedRoot = realpathSync(root);
    const modules = join(ownedRoot, "node_modules");
    const forge = join(modules, "node-forge");
    const target = join(forge, "lib/rsa.js");
    for (const path of [modules, forge, join(forge, "lib"), target]) {
        if (realpathSync(path) !== path) {
            throw new Error("RSA backport requires physical project-local dependencies; refusing a linked target.");
        }
    }
    if (statSync(target).nlink !== 1) {
        throw new Error("RSA backport refuses a shared file; use a physical npm installation.");
    }
    const metadata = JSON.parse(readFileSync(join(forge, "package.json"), "utf8"));
    if (metadata.version !== FORGE_RSA_BACKPORT.version) {
        throw new Error("RSA backport requires node-forge 1.4.0; another version requires review.");
    }
    const bytes = readFileSync(target);
    const digest = sha256(bytes);
    if (digest === FORGE_RSA_BACKPORT.patchedSha256) return "already applied";
    if (digest !== FORGE_RSA_BACKPORT.originalSha256) {
        throw new Error("Unrecognized node-forge RSA bytes; refusing to overwrite them.");
    }
    const before = "obj.value.length !== 2) {";
    const after = "obj.value.length !== 2 ||\n" +
        "            obj.value[0].value.length !==\n" +
        "              (('parameters' in capture) ? 2 : 1)) {";
    const text = bytes.toString("utf8");
    if (text.split(before).length !== 2) throw new Error("RSA backport anchor is not unique.");
    const patched = Buffer.from(text.replace(before, after), "utf8");
    if (sha256(patched) !== FORGE_RSA_BACKPORT.patchedSha256) {
        throw new Error("RSA backport result differs from the reviewed bytes.");
    }
    writeFileSync(target, patched);
    return "applied";
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
    console.log(`node-forge RSA nested-element backport: ${applyForgeRsaBackport()}`);
}
