import {test} from "node:test";
import assert from "node:assert/strict";
import config from "../../webpack.config.js";

const rules = config.module.rules;
const babel = rules.find(rule => rule.loader === "babel-loader");
const material = rules.find(rule => rule.options?.imports === "default popper.js/dist/umd/popper.js Popper");
const fonts = rules.find(rule => rule.generator?.filename === "assets/fonts/[name][ext]");

test("ordinary dependencies are excluded on POSIX and Windows, while intended shims remain eligible", () => {
    for (const separator of ["/", "\\"]) {
        const dependency = name => ["repo", "node_modules", name, "index.js"].join(separator);
        assert.equal(babel.exclude.test(dependency("lodash")), true);
        assert.equal(babel.exclude.test(dependency("crypto-api")), false);
        assert.equal(babel.exclude.test(dependency("bootstrap")), false);
    }
});

test("material-design import shim matches JavaScript, never CSS, on both path styles", () => {
    for (const separator of ["/", "\\"]) {
        const file = extension => ["repo", "node_modules", "bootstrap-material-design", "dist", `bootstrap.${extension}`].join(separator);
        assert.equal(material.test.test(file("js")), true);
        assert.equal(material.test.test(file("css")), false);
    }
});

test("bitmap-font PNGs and font files match the dedicated asset rule on both path styles", () => {
    for (const separator of ["/", "\\"]) {
        assert.equal(fonts.test.test(["repo", "fonts", "bmfonts", "atlas.png"].join(separator)), true);
        assert.equal(fonts.test.test(["repo", "images", "ordinary.png"].join(separator)), false);
        assert.equal(fonts.test.test(["repo", "fonts", "atlas.fnt"].join(separator)), true);
    }
});
