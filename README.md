# CyberChef Lens

**Follow encoded JSON. Keep the original evidence.**

An unofficial [CyberChef](https://github.com/gchq/CyberChef) fork for following
JSON through encoded layers, comparing the results and replaying the recipe
that produced each one. These investigations retain large numbers and repeated
fields without rewriting their values.

The added investigations run in your browser, without a model or external
service. CyberChef's general-purpose Magic remains available under **Any**.

## Try it

In the built app, open **Lens guide / Help** at the top right, then choose
**Open the three-layer demo (new tab)**. It opens a separate workspace; your
current input and recipe stay where they are.

The fictional sample goes through Base64, a paired Cookie and a compact token.
Its final JSON has **two parsing cautions**. Open **Inspect locations and parsing
consequences**: the account number can round in JavaScript, and two differently
spelled fields decode to the same name. The signatures are fabricated.

Choose **Load full JSON recipe** to reproduce the exact payload from the original
input. Nothing is authenticated and no conflicting value is selected for you.

![A three-layer investigation retains the exact JSON and locates two parsing cautions.](docs/images/investigation.png)

Prefer to enter the sample yourself? Use [the input file](examples/lens-investigation.txt),
add **Magic**, leave **Depth** at **3**, and select **JSON payload trail**.
[Sample instructions and the competent manual recipe](examples/README.md).

## Choose a goal in Magic

| Your task | Output goal |
| --- | --- |
| Explore unknown data, not necessarily JSON | **Any** — original general-purpose Magic |
| Look for complete JSON using native Magic and wrapper checks together | **JSON object or array** |
| Inspect a recognized token, Cookie or JSON signature envelope directly | **JSON wrappers** — no generic search |
| Follow JSON through several recognized encoding/container layers | **JSON payload trail** — start at Depth 3 |

Depth counts decoding layers in the trail. **Crib** filters the combined JSON
search; it is not used by the focused wrappers or trail modes.
[Settings, supported profiles and recovery](docs/USAGE.md).

## What Lens adds

Stock CyberChef's native operations can already decode the demonstration with a
manual recipe. Lens adds guarded automatic composition and a review that keeps
the exact output, its source recipe and its cautions together.

- **Compare before choosing.** Different decoded texts stay separate. Open
  **Review field changes** inside an investigation, or use **Diff → JSON structure
  (lossless)** for two captures. Original tokens and duplicate-field occurrences
  remain visible.
- **Format without replacing values.** Enable **JSON Beautify → Lossless strict
  JSON** to retain number spelling, repeated members and string escapes.
- **Carry the result forward.** **Save this result** offers exact JSON and an
  evidence record. **Inspect Lens Evidence** reopens that record without executing
  its saved recipes. Exports are unredacted; review them before sharing.

## Boundaries worth knowing

This is an experimental unofficial fork, not an official GCHQ release or a
security certification. Valid JSON does not verify a signature, issuer or claim.
A quiet caution panel is not a safety verdict.

JSON investigations accept at most **64 KiB of input** and follow finite profiles
within stated work limits. Unsupported input or an incomplete search is not proof
that no payload exists. The result reports its scope and stopping points.

[User guide](docs/USAGE.md) · [Security and compatibility limits](docs/SECURITY-LIMITS.md) ·
[Selected-format comparison and its limits](docs/COMPARISON.md)

## Build and check

Use Node.js 24 and the included lockfile:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run prepare:magic-json
npm test
npm run test:magic-json
npm run build
```

The production app and standalone ZIP are in `build/prod/`. Serve that directory
locally to review the production build; `npm start` runs the development server.
The preparation command runs the inspected source generators and compatibility
fixes, not dependency lifecycle hooks or a browser installer. The check-only CI
workflow does not deploy or publish anything; an actual remote run is separate.

## Built on CyberChef

Based on [GCHQ CyberChef](https://github.com/gchq/CyberChef), initially pinned to
`cc70a4530b86aff4bc40ccc74b1ad4857eccdca2`. Original notices and the
[Apache-2.0 license](LICENSE) remain intact.
[Upstream documentation](UPSTREAM-README.md) · [Third-party notices](THIRD_PARTY_NOTICES.md).
