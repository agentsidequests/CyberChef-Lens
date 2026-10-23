# CyberChef Lens

**Follow the layers. Keep the recipe.**

An unofficial CyberChef fork for investigating encoded data. Give Magic a JSON
goal, or follow a payload through several encoding and container layers. Inspect
what each step produced, then load the complete decoding recipe. The original
input stays put.

The JSON investigation runs locally; it does not call a model or external
service. Original operations remain available, and **Any** keeps general-purpose
Magic unchanged.

This is not an official GCHQ release or a production-security certification.
[Security and compatibility limits](docs/SECURITY-LIMITS.md) ·
[Original CyberChef documentation](UPSTREAM-README.md) ·
[Apache-2.0 license](LICENSE) · [Third-party notices](THIRD_PARTY_NOTICES.md)

## Try the difference

Paste this published unsigned-token example into Input:

```text
eyJhbGciOiJub25lIn0.eyJoZWxsbyI6ICJ3b3JsZCJ9.
```

| Automatic investigation | Result |
| --- | --- |
| Stock Magic, in the tested searches | No complete JSON payload recovered |
| This fork, with the JSON goal | Exact payload below, with a reusable extraction recipe |

```json
{"hello": "world"}
```

The result is labelled **Unsigned JSON payload (unverified)**. Its `alg: none`
header declares no signature; decoding supplies no authentication, integrity or
claim validation. Click **Load payload recipe** to replace Magic with the actual
extraction steps. The original input stays unchanged.

Stock CyberChef can recover this too: manually extract the middle field and
decode Base64url. The addition is automatic recognition, complete-output checking
and a working recipe—not a new decoding algorithm.

## What's different from upstream

Available now:

- **JSON payload trail:** compose recognized transport and container layers,
  inspect intermediate text, and load a complete recipe for any reached layer.
  Different JSON layers remain separate; deeper is not more trustworthy.
- Replays native candidate recipes on complete input and checks strict UTF-8 and
  whole-document JSON, instead of accepting a valid-looking prefix.
- Retains competing exact texts and recipe provenance. A syntax match does not
  choose an intended interpretation or authenticate a message.
- Recognizes a bounded set of JSON-bearing containers, including compact tokens,
  paired cookies, JSON envelopes and explicitly supported compressed profiles.
- Uses bounded inflation for its compressed wrapper recipes: one layer, 64 KiB
  compressed input, 1 MiB decoded-output cap, no partial payload result. Raw
  DEFLATE has no checksum. Timers are cooperative, not a process sandbox.

The recorded engineering comparison recovered all eight selected public JSON
targets automatically, versus four with the pinned native Magic baseline. Manual
recipes recovered all eight. This was a small selected set, including repairs
on known misses—not a blind benchmark or a general accuracy claim. See
[comparison scope and sources](docs/COMPARISON.md).

## One investigation, several layers

Paste this fictional two-layer example into Input, add **Magic**, and choose
**Output goal → JSON payload trail**:

```text
ZXlKaGJHY2lPaUp1YjI1bEluMC5leUpvWld4c2J5STZJQ0ozYjNKc1pDSjku
```

The trail follows **Base64 → unsigned compact token → JSON**. Open **Follow the
decoding trail** to inspect the token between the two steps, or click **Load full
JSON recipe** to work directly with `{"hello": "world"}`. Every offered layer
recipe was replayed against the complete original input. The token is unsigned;
the decoded text is not authenticated.

This mode follows a finite set of Base64, hexadecimal, percent-encoding and
guarded container profiles. It does not rewrite arbitrary encoded-looking
strings inside an existing JSON document. Depth means logical layers, from
0 to 5; other Magic search settings do not apply. State, replay, byte and
cooperative-time limits are explicit in the result. It is not an exhaustive
search or a hard resource sandbox.

## Roadmap

The experimental JSON investigation and multi-layer payload trail are available
with portable tests and a source build. Clean-install CI still needs a completed
remote run. Broader encoding coverage and stronger resource isolation need their
own evidence before they are advertised; no delivery date is promised.

## Run from source

Use Node.js 24 and the included lockfile:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run prepare:magic-json
npm test
npm run test:magic-json
npm run build
```

The preparation command runs only the inspected source generators and the two
existing upstream compatibility fixes. It does not run dependency lifecycle
hooks, download a browser, configure a global package or publish anything.

The built application is in `build/prod/index.html`; the same directory contains
a standalone ZIP with its licenses. Serve the directory locally to exercise the
production bundle. Add **Magic**, leave depth at **3**, and choose **Output goal →
JSON object or array**. **JSON wrappers** checks a single container; **JSON payload
trail** follows recognized layers without running generic search.

The check-only workflow runs native tests, portable feature tests and the build.
It has read-only repository permission and no deployment or publication steps.
The package is marked private to prevent accidental npm publication.

## Attribution

Built on [GCHQ CyberChef](https://github.com/gchq/CyberChef), pinned initially to
`cc70a4530b86aff4bc40ccc74b1ad4857eccdca2`. Original source notices and license
remain intact. This fork adds the optional JSON investigation, bounded-inflate
operations and portability/release checks. It does not implement signature
verification or replace upstream cryptographic algorithms.

Example input:
[jose-jwt fixture](https://github.com/dvsekhvalnov/jose-jwt/blob/20abc4ebf916e1e36586d67609c17d045af1d503/UnitTests/TestSuite.cs).
