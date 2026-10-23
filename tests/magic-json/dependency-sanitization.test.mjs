import {test} from "node:test";
import assert from "node:assert/strict";
import {JSDOM} from "jsdom";
import createDOMPurify from "dompurify";

// Regression for the patched library's nondefault template-safe DOM mode.
// RecipeWaiter currently uses ordinary string sanitization instead.
for (const expression of ["{{value}}", "${value}", "<%value%>"]) {
    test(`sanitization neutralizes a split shadow-root template: ${expression}`, () => {
        const window = new JSDOM("").window;
        try {
            const host = window.document.createElement("div");
            const shadow = host.attachShadow({mode: "open"});
            for (const character of expression) {
                shadow.appendChild(window.document.createTextNode(character));
            }
            createDOMPurify(window).sanitize(host, {IN_PLACE: true, SAFE_FOR_TEMPLATES: true});
            assert.ok(!shadow.textContent.includes(expression));
        } finally {
            window.close();
        }
    });
}
