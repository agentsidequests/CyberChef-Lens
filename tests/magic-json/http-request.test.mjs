import {test, before} from "node:test";
import assert from "node:assert/strict";
import log from "loglevel";
import {inspectHttpRequest} from "../../src/core/lib/LensHttpRequest.mjs";
import {investigateLensSource, compareLensSources} from "../../src/core/lib/LensWorkspace.mjs";
import {prepareMagicRecipes, replayMagicRecipe} from "../../src/core/lib/MagicEvidenceReplay.mjs";
import {createJsonEvidence} from "../../src/core/lib/MagicJsonExport.mjs";
import {inspectLensEvidence} from "../../src/core/lib/LensEvidence.mjs";
import {presentPayloadTrail} from "../../src/core/lib/MagicJsonPresentation.mjs";

const encode = text => Buffer.from(text).toString("base64url");
const token = text => `${encode('{"alg":"HS256"}')}.${encode(text)}.${"A".repeat(43)}`;
const payload = ' {"case":"HTTP-204","note":"海 😀","id":1,"id":2}\r\n';
const request = (body, headers=[], newline="\r\n") => ["POST /jobs HTTP/1.1", "Host: example.invalid", ...headers,
                                                       `Content-Length: ${Buffer.byteLength(body)}`, "", body].join(newline);
before(async () => {
    log.setLevel("silent", false); await prepareMagicRecipes([]);
});

for (const newline of ["\r\n", "\n"]) test(`whole HTTP request ${JSON.stringify(newline)} preserves Unicode body, locations and native witnesses`, async () => {
    const input = request(payload, [`Authorization: Bearer ${token('{"status":"queued"}')}`,
                                    `Cookie: session=${Buffer.from('{"status":"cookie"}').toString("base64")}; session.sig=${"A".repeat(43)}`], newline);
    const report = await investigateLensSource(input);
    assert.equal(report.status, "complete"); assert.equal(report.original, input);
    assert.equal(report.httpRequest.status, "supported"); assert.equal(report.outputs.length, 3);
    assert.equal(report.outputs.find(group => group.text === payload).sources[0].httpOrigin.line, 7);
    for (const group of report.outputs) {
        for (const source of group.sources) {
            const origin = source.httpOrigin;
            assert.ok(["Authorization", "Cookie", "body"].includes(origin.field));
            const sliced = Buffer.from(input).subarray(origin.byteOffset, origin.byteOffset + origin.byteLength);
            assert.equal(sliced.length, origin.byteLength);
            assert.equal(Buffer.from(await replayMagicRecipe(source.recipe, Buffer.from(input))).toString(), group.text);
            assert.deepEqual(source.recipe[0], {op: "Take bytes", args: [origin.byteOffset, origin.byteLength, false]});
        }
    }
    const body = report.outputs.find(group => group.text === payload);
    const saved = JSON.parse(createJsonEvidence(body, {report, mode: "JSON payload trail", index: 0, count: 3}));
    assert.equal(saved.input.text, input); assert.equal(saved.result.text, payload);
    assert.deepEqual(saved.result.routes[0].httpOrigin, body.sources[0].httpOrigin);
    assert.equal(inspectLensEvidence(Buffer.from(JSON.stringify(saved))).payload, payload);
    const html = presentPayloadTrail(report, {recipeUrl: () => "#recipe=", anyUrl: "#recipe=Magic()"});
    assert.match(html, /Request source: Authorization/); assert.match(html, /Request source: body/);
    assert.match(html, /No request was sent/);
});

test("identical fields retain every original-request route through further decoding", async () => {
    const carrier = `Authorization: Bearer ${token(payload)}`;
    const input = request(carrier, [carrier]);
    const report = await investigateLensSource(input);
    const group = report.outputs.find(item => item.text === payload);
    assert.ok(group); assert.equal(group.sources.length, 2);
    assert.deepEqual(group.sources.map(source => source.httpOrigin.field).sort(), ["Authorization", "body"]);
    for (const source of group.sources) assert.equal(Buffer.from(await replayMagicRecipe(source.recipe, Buffer.from(input))).toString(), payload);
});

test("equal JSON from body and token has distinct routes without duplicate result cards", async () => {
    const input = request(payload, [`Authorization: Bearer ${token(payload)}`]);
    const report = await investigateLensSource(input);
    assert.equal(report.outputs.length, 1); assert.equal(report.outputs[0].sources.length, 2);
    assert.equal(new Set(report.outputs[0].sources.map(source => source.httpOrigin.byteOffset)).size, 2);
});

test("two complete request bodies remain independent comparison sources", async () => {
    const [a, b] = await Promise.all([investigateLensSource(request('{"status":"queued"}')),
                                      investigateLensSource(request('{"status":"released"}'))]);
    assert.equal(compareLensSources(a.outputs[0].text, b.outputs[0].text).report.total, 1);
});

test("strict request framing refuses ambiguity instead of extracting a plausible field", async () => {
    const valid = request(payload, [`Authorization: Bearer ${token(payload)}`]);
    const cases = [
        valid.replace("Content-Length:", "Content-Length: 1\r\nContent-Length:"),
        valid.replace("Content-Length:", "Content-Length: 1, 1\r\nX-Length:"),
        valid.replace("Host:", "Transfer-Encoding: chunked\r\nHost:"),
        valid.replace("Host:", "Content-Encoding: gzip\r\nHost:"),
        valid.replace("Host:", "Host: other.invalid\r\nHost:"),
        valid.replace("Host: example.invalid", "Host: a,b"),
        valid.replace("Host: example.invalid\r\n", ""),
        valid.replace("Host:", " Host:"), valid.replace("Host:", "Host :"),
        valid.replace("Host:", "X-Note: 海\r\nHost:"),
        valid.replace("Host:", "X-Note: x\u0000y\r\nHost:"),
        valid.replace("Host:", "X-Note: x\r\n y\r\nHost:"),
        valid.replace("Host:", "X: " + "a".repeat(8193) + "\r\nHost:"),
        valid.replace("Host:", Array.from({length: 129}, () => "X: y\r\n").join("") + "Host:"),
        valid.replace("Host:", "Cookie: a=b\r\nCookie: c=d\r\nHost:"),
        valid.replace("Host:", "Authorization: x\r\nHost:"),
        valid.replace(/Content-Length: \d+\r\n/, ""), valid.slice(0, -1), valid + "\r\nGET / HTTP/1.1\r\nHost: x\r\n\r\n",
        valid.replace("\r\nHost", "\nHost"), valid.replace("HTTP/1.1", "HTTP/2"),
        "HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\n{}", ":method: POST\n\n{}",
        "GET / HTTP/1.1\r\nHost: example.invalid"
    ];
    for (const input of cases) {
        const report = await investigateLensSource(input);
        assert.equal(report.httpRequest.status, "unsupported", input.slice(0, 80));
        assert.equal(report.outputs.length, 0); assert.equal(report.checkedReplays, 0);
        assert.equal(report.original, input);
        assert.match(presentPayloadTrail(report, {recipeUrl: () => "#", anyUrl: "#"}), /HTTP request not imported/);
    }
});

test("empty and HTTP/1.0 requests are framed without invented payloads", async () => {
    for (const input of ["GET / HTTP/1.1\nHost: example.invalid\n\n", "GET / HTTP/1.0\r\n\r\n"]) {
        const report = await investigateLensSource(input);
        assert.equal(report.httpRequest.status, "supported"); assert.equal(report.outputs.length, 0);
    }
});

test("Content-Length counts UTF-8 octets and depth applies to the extraction hop", async () => {
    const input = request(payload), wrong = input.replace(String(Buffer.byteLength(payload)), String(payload.length));
    assert.equal(inspectHttpRequest(wrong).status, "unsupported");
    const encoded = request(encode(payload));
    assert.equal((await investigateLensSource(encoded, 1)).outputs.length, 0);
    assert.equal((await investigateLensSource(encoded, 2)).outputs[0].text, payload);
    assert.equal(inspectHttpRequest("X".repeat(65537) + " / HTTP/1.1\n\n").status, "unsupported");
});

test("HTTP-looking JSON values and embedded requests retain the previous profile scope", async () => {
    const json = '{"note":"GET / HTTP/1.1"}';
    assert.equal(inspectHttpRequest(json).status, "not-request");
    assert.equal((await investigateLensSource(json)).outputs[0].text, json);
    const report = await investigateLensSource(encode(request(payload)));
    assert.equal(report.httpRequest, undefined); assert.equal(report.outputs.length, 0);
});

test("unsafe request body markup is retained as text and escaped in presentation", async () => {
    const text = '{"html":"<img src=x onerror=alert(1)>"}';
    const report = await investigateLensSource(request(text));
    const html = presentPayloadTrail(report, {recipeUrl: () => "#", anyUrl: "#"});
    assert.ok(!html.includes("<img src=x")); assert.equal(report.outputs[0].text, text);
});
