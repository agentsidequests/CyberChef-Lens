# CyberChef Lens

**Decode the layers. Keep the evidence.**

An unofficial CyberChef fork for investigating encoded JSON. Follow a payload
through its wrappers, inspect what each step produced, and load the native recipe
that reproduces it. Large numbers, repeated fields and original text stay intact.

The added investigation runs in your browser, without a model or external
service. General-purpose Magic remains available under **Any**.
[Scope and security limits](docs/SECURITY-LIMITS.md) ·
[Upstream documentation](UPSTREAM-README.md) · [Apache-2.0](LICENSE)

## Try one investigation

A session export can decode cleanly and still deserve a closer look. This
**fictional training sample** wraps a paired session Cookie in Base64; inside
the Cookie is a compact token. Its signatures are fabricated.

1. Put [the sample input](examples/lens-investigation.txt) in **Input**—drag the
   downloaded file into the app, or copy its complete text.
2. Add **Magic**, leave **Depth** at **3**, and choose
   **Output goal → JSON payload trail**.
3. Open **Inspect locations and parsing consequences**, then
   **Follow the decoding trail**. Choose **Load full JSON recipe** to replay
   the extraction from your unchanged original input.

![The fictional sample reaches its exact JSON through three layers, with two parsing cautions before replay.](docs/images/investigation.png)

The recovered document contains:

```json
{
  "case": "SUP-4821",
  "account": 9007199254740993,
  "role": "viewer",
  "\u0072ole": "admin"
}
```

There are two reasons not to tidy this up with an ordinary parse-and-reserialize
formatter. The account number becomes `9007199254740992` when written back through
JavaScript's number type. And `"role"` and `"\u0072ole"` name the same member:
JavaScript's parser keeps only the later `"admin"` value.

Lens preserves the original tokens and points to both problems. It does not
choose a role, authenticate a session or decide how another application should
interpret the document.

[Sample files and manual recipe](examples/README.md) ·
[Exact reference payload](examples/lens-investigation-payload.txt)

Stock CyberChef can decode these layers with native operations too. The included
five-operation recipe is the competent manual route. Lens adds automatic guarded
composition, complete-output checks and a review that keeps the evidence visible.
This demonstration is not a benchmark or a real incident.

## What's different from upstream

Available now:

- **JSON payload trail:** compose recognized transport and container layers,
  inspect intermediate text, and load a complete recipe for any reached layer.
  Different JSON layers remain separate; deeper is not more trustworthy.
- **Lossless JSON inspection:** format strict JSON without rounding numbers or
  dropping duplicate members; compare the formatted texts with an opt-in Diff
  mode. A structural Diff locates changed fields and array positions, including
  duplicate-member occurrences. Lens also locates the first changed token across
  checked investigation results.
- **Parsing cautions:** locate repeated member names and selected JavaScript
  numeric range problems before passing a decoded document to another tool.
  Original fields and number spellings stay intact; no value is silently chosen.
- **Save this result:** download the exact decoded JSON, or keep a portable
  evidence JSON with its input, replay recipes, warnings and search status.
  Downloads are explicit and unredacted; review them before sharing.
- **Reopen a record:** Inspect Lens Evidence recovers exact saved input/payload
  text, checks the supported record structure and recomputes payload cautions.
  Stored recipes stay read-only; reopening never executes them.
- Replays native candidate recipes on complete input and checks strict UTF-8 and
  whole-document JSON, instead of accepting a valid-looking prefix.
- Retains competing exact texts and recipe provenance. A syntax match does not
  choose an intended interpretation or authenticate a message.
- Recognizes a bounded set of JSON-bearing containers, including compact tokens,
  paired cookies, JSON envelopes and explicitly supported compressed profiles.
- Preserves exact JSON from canonical compact tokens with signature sizes outside
  the older serializer heuristics, including a published RSA example. A checked
  encoding shape is not a verified signature or algorithm/key match.
- Uses bounded inflation for its compressed wrapper recipes: one layer, 64 KiB
  compressed input, 1 MiB decoded-output cap, no partial payload result. Raw
  DEFLATE has no checksum. Timers are cooperative, not a process sandbox.

The recorded engineering comparison recovered all eight selected public JSON
targets automatically, versus four with the pinned native Magic baseline. Manual
recipes recovered all eight. This was a small selected set, including repairs
on known misses—not a blind benchmark or a general accuracy claim. See
[comparison scope and sources](docs/COMPARISON.md).

## Coverage and limits

The trail follows a finite set of Base64, hexadecimal, percent-encoding and
guarded container profiles. It does not decode arbitrary encoded-looking strings
inside an existing JSON document. Depth means logical layers, from 0 to 5; the
other Magic search settings do not apply. State, replay, byte and cooperative-time
limits appear in the result. Reaching a JSON layer does not authenticate it.

This is an experimental unofficial fork, not an official GCHQ release or a
production-security certification.
[Security and compatibility limits](docs/SECURITY-LIMITS.md) ·
[Third-party notices](THIRD_PARTY_NOTICES.md)

## A formatter should not change the evidence

These are different account numbers:

```text
{"account":9007199254740992}

{"account":9007199254740993}
```

Parsing both through an ordinary JavaScript number and writing them back can
make them identical. Repeated object members can disappear in the same trip.
For an investigation, that is a poor time to tidy up.

In **JSON Beautify**, enable **Lossless strict JSON**. It copies the original
number, string and punctuation tokens, replacing only insignificant whitespace.
The two account numbers stay different. Repeated members, escape spelling and
member order remain intact. This mode accepts strict JSON, not JSON5, and does
not sort keys.

For a full comparison, select **Diff → JSON (lossless)** and supply two documents
separated by your sample delimiter. The example above uses the default blank-line
delimiter. Or use **Compare checked texts** in a Lens
investigation to locate the first differing token. A formatting-only match does
not merge the original results or choose a decoding route.

Native Character Diff and raw JSON Diff already preserve differences in these
source strings. The addition is a lossless formatting-and-comparison workflow
and an integrated review, not a claim that native Diff cannot find the change.
Member order, numeric spelling and string escapes stay significant here; the
comparison does not decide semantic equivalence or authenticate either message.

The new text-inspection paths are bounded to 64 KiB per document, 16,384 tokens
and 64 nested containers. Formatting output is capped at 1 MiB. Lens compares
at most eight retained texts against one explicit reference and shows only the
first changed token. The opt-in full Diff has cooperative work limits and
refuses a completion claim if it cannot finish.

Valid JSON is not the end of the investigation. Consider:

```json
{"role":"reader","\u0072ole":"admin","account":9007199254740993}
```

The two role names decode to the same string. JavaScript's ordinary JSON parser
keeps the later value and rounds the account number; another consumer may handle
them differently. Lens shows **2 parsing cautions**, with the original locations
and the exact tokens. Open **Inspect locations and parsing consequences** before
using the recovered values. It does not choose a role or replace the account ID.

These selected checks appear on Lens result cards and in JSON Beautify's opt-in
lossless formatted view. They cover repeated names, numeric overflow, nonzero
numbers becoming zero, and magnitudes outside JavaScript's safe-integer range.
They are not a complete floating-point precision or security audit. A quiet card
is not a safety verdict. Inspection is limited to the text budgets above, with
at most 16 detailed findings shown and complete counts for an inspected document.

## Compare the fields, not just the first change

To review two captures, put the [fictional comparison sample](examples/lens-json-comparison.txt)
in Input. Add **Diff**, set **Sample delimiter** to `\n===\n`, and choose
**Diff by → JSON structure (lossless)**. The sample produces eight change records:
the account number, the second role's spelling and value, a limit, two array
positions, one removed member and one added member. Before/After panels retain
the original tokens and source locations, including `1e400` rather than a parsed
JavaScript infinity or `null`.

Members match by decoded name and occurrence, not by a parser's last retained
value. `$["role"]#2` identifies the second member with that decoded name. Arrays
match by index; an insertion may appear as several changed positions, not an
inferred move. Reordered matched members get their own record. String escapes,
numeric spelling and member order remain differences; this is not semantic
equality, JSONPath execution or a choice of intended meaning.

The review counts changes across both complete bounded documents, but retains
at most 128 detail records. Hidden additions/removals and omitted records are
explicit. Added/removed subtrees and type replacements count once, not once per
descendant. For a full line comparison, use **JSON (lossless)** instead. Native
Character and Line Diff can already find raw changes; the addition is a
source-preserving field/occurrence review.

## Published-format check

The source-led checks include the [RFC 7515 compact and JSON examples](https://www.rfc-editor.org/rfc/rfc7515.html#appendix-A).
All six selected JSON-bearing representations now yield their exact payload in
the focused and trail modes. They share one payload, so this is format coverage,
not six independent messages or an accuracy benchmark. Native Magic already
recovers the values in three of them, and manual recipes recover all six.
See [the comparison scope](docs/COMPARISON.md#rfc-format-coverage).

## Copied Bearer fields

You can paste one `Authorization: Bearer <token>` field, or just
`Bearer <token>`, into any JSON investigation goal. The field and compact token
are one named carrier profile, with native extraction from the unchanged input.
Try the [fictional header sample](examples/lens-bearer-header.txt); it reaches the
same exact reference payload as the three-layer demo above.

Field and scheme names are case-insensitive. One terminal LF or CRLF is allowed.
This narrow profile requires canonical unpadded compact fields and a checked
object header. It refuses ambiguous copies, unsupported header declarations and
opaque credentials rather than guessing which token to use. The Bearer label
does not authenticate a session or verify a JWT. Header blocks, quoted/curl
snippets, padded fields and compressed or detached/unencoded Bearer payloads
remain outside this profile. General-purpose **Any** is unchanged.

## Copied Cookie fields

For a paired Cookie field, one copied terminal LF or CRLF is accepted too. The
complete original input, including that ending, remains in the evidence record;
native replay extracts the exact payload without rewriting it. This still means
one unquoted field or Cookie-pair value, not a whole request: header blocks,
folded lines, extra blank lines, bare CR and duplicate names are refused.

## Roadmap

The experimental JSON investigation, multi-layer payload trail and lossless JSON
inspection are available with portable tests and a source build. The preceding
Bearer-field checkpoint passed an isolated Windows clean-install rehearsal with
fresh locked dependencies. Actual remote Ubuntu CI still needs a completed run.
Broader encoding coverage and stronger resource isolation need their own evidence
before they are advertised; no delivery date is promised.

## Take an investigation with you

Open **Save this result** on a JSON result card. **Download exact JSON** saves
the complete decoded text, including its whitespace and repeated members.
**Download evidence JSON** adds the unredacted input to that Magic step, all
retained recipes for that result, warnings, bounded parsing-caution findings and
the recorded search status. The payload stays a string inside the evidence file,
so a JSON reader cannot silently round its numbers or discard repeated members.
If a browser cannot start downloads, **View complete evidence JSON** exposes the
same complete record for manual copying, not a shortened preview.

Replay a saved route against the saved `input.text`. These are the operations
that replaced Magic, not any operations before or after it. If Magic followed
another decoder, the saved input is the output of that decoder—not necessarily
what was originally pasted into CyberChef's Input pane.

The file does not include other results, authenticate the message or establish
chain of custody. It is ordinary editable JSON and may contain live credentials.
There is no redaction, automatic download or new network call.
The total generated download text is capped at 2 MiB per presentation. If the
complete snapshot exceeds the budget, has more than 64 retained routes or lacks
exact UTF-8 input, Lens refuses that download rather than quietly shortening it.
The checked results and normal native recipe actions remain available.

To reopen a record, paste its complete evidence JSON into **Input** and add
**Inspect Lens Evidence** (search Operations for “Lens”). Leave **Output → Review**
selected. The review checks the supported version-1 structure, strict UTF-8,
declared byte counts and complete payload syntax, then recomputes selected
parsing cautions. **Recover saved payload** and **Recover saved Magic-step input**
return those exact strings as Output; Input and surrounding operations stay put.

This reads a record, not a signed receipt. A changed record can still be valid
JSON. Reopening does not establish who saved it, prove that its input produced
its payload, or rerun the investigation. Saved recipes are displayed as inert
text; none are loaded or executed. Recorded status is a claim from that file,
not a fresh complete-search result. Ordinary JSON parsing and manual extraction
can recover the fields too; the inspector adds a guarded review and exact-string
recovery workflow.

The reopening profile accepts up to 2 MiB of record text, 64 outer containers,
64 KiB saved input, 1 MiB payload, 64 routes, 256 steps per saved route and 256
saved warnings. Unsupported versions, ambiguous duplicate metadata names,
malformed fields and inconsistent byte counts are refused without repair.

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
