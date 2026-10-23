import {execFileSync} from "node:child_process";
import {existsSync, writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

// Explicit allow-list of inspected upstream generators. No lifecycle hooks,
// global configuration, browser downloads, npm link, release or Git operations.
const root = fileURLToPath(new URL("../", import.meta.url));
if (!existsSync(new URL("../src/core/config/OperationConfig.json", import.meta.url))) {
    writeFileSync(new URL("../src/core/config/OperationConfig.json", import.meta.url), "[]\n");
}
for (const script of [
    "src/core/config/scripts/fixCryptoApiImports.mjs",
    "src/core/config/scripts/fixSnackBarMarkup.mjs",
    "src/core/config/scripts/fixForgeRsaValidation.mjs",
    "src/core/config/scripts/generateHTMLEntities.mjs",
    "src/core/config/scripts/generateOpsIndex.mjs",
    "src/core/config/scripts/generateConfig.mjs",
    "src/node/config/scripts/generateNodeIndex.mjs"
]) {
    execFileSync(process.execPath, ["--no-warnings", script], {cwd: root, stdio: "inherit"});
}
