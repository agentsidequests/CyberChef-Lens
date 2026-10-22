import {readdirSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const tests = readdirSync(new URL("../tests/magic-json/", import.meta.url))
    .filter(name => name.endsWith(".test.mjs")).sort()
    .map(name => fileURLToPath(new URL(`../tests/magic-json/${name}`, import.meta.url)));
if (!tests.length) throw new Error("No JSON investigation tests were found");
const result = spawnSync(process.execPath,
    ["--no-warnings", "--openssl-legacy-provider", "--test", ...tests], {cwd: root, stdio: "inherit"});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
