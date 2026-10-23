# Lens user guide

For the short introduction and mode chooser, start with the [README](../README.md).
This guide covers the sample, exact-text tools, supported copied fields and
evidence recovery. [Security limits](SECURITY-LIMITS.md) own the detailed bounds.

## Guided workspace

Choose **Lens workspace** at the top left. **Investigate data** accepts a pasted
source or one UTF-8 text file; **Find JSON** runs the existing payload trail at a
default limit of three layers. **Search settings** exposes the one-to-five layer
limit. Nothing runs while you type. **Try the fictional example** loads the
three-layer fixture without starting a check.

**Compare two captures** gives Source A and Source B separate paste/file inputs.
Choose **Find JSON in both sources**, then select the layer from each source and
choose **Compare selected layers**. The first listed layer is only a starting
selection, not a preferred meaning. Structural comparison keeps exact tokens,
duplicate occurrences, locations and complete bounded counts. Its 64 KiB per
decoded document limit remains in force even if decoding reached a larger JSON.

Loaded files retain their original UTF-8 text, including CRLF. Editing a source
creates new text using the browser textarea's newline representation. Sources,
settings and selections invalidate dependent results; **Cancel** stops the
isolated worker and retains the source. Files above 64 KiB and invalid UTF-8 are
refused without replacing the previous source. Inputs remain in tab memory,
are not written to storage or the URL, and clear on reload. **Recipe workspace**
or Escape returns to the unchanged expert recipe and input.

The existing result cards provide layer inspection, exact JSON/evidence saves
and the complete-evidence copying fallback. Recipe links explicitly open a new
tab; that action carries source bytes in the local URL fragment, using a native
Base64 carrier to preserve line endings before the saved decoding steps.
Saved evidence retains the original source, not that presentation carrier.
Neither route authenticates input. The same profile and work limits apply.

## Recipe workspace goals

| Goal | Search and settings |
| --- | --- |
| **Any** | Original general-purpose Magic; use it when JSON is not the expected destination. |
| **JSON object or array** | Native Magic discovery plus guarded wrapper checks. Depth controls native recursion; Crib filters decoded outputs from both routes. |
| **JSON wrappers** | Recognized container profiles only, without generic Magic discovery. Depth, Crib, intensive mode and language settings are not used. |
| **JSON payload trail** | Recognized transport/container layers, each with a replayed recipe. Depth is the logical layer limit, from 0 to 5; start at 3. Crib, intensive mode and language settings are not used. |

The JSON goals accept at most 64 KiB of input. Choose a mode for the task rather
than treating the list as a quality ranking. A supported profile is a bounded
extraction route, not a proof of producer identity or authentication.

## Use the training sample

Open **Lens guide / Help → Open the three-layer demo (new tab)** in the app, or
follow the [individual input-file instructions](../examples/README.md). That
page includes the competent manual CyberChef recipe and the exact 100-byte
reference payload. The sample and its signatures are fictional.

## Coverage and limits

The trail follows a finite set of Base64, hexadecimal, percent-encoding and
guarded container profiles. It does not decode arbitrary encoded-looking strings
inside an existing JSON document. Depth means logical layers, from 0 to 5; the
other Magic search settings do not apply. State, replay, byte and cooperative-time
limits appear in the result. Reaching a JSON layer does not authenticate it.

This is an experimental unofficial fork, not an official GCHQ release or a
production-security certification.
[Security and compatibility limits](SECURITY-LIMITS.md) ·
[Third-party notices](../THIRD_PARTY_NOTICES.md)

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
investigation for a first-token glance, then open **Review field changes** to
inspect later differences with their source locations. A formatting-only match
does not merge the original results or choose a decoding route.

Native Character Diff and raw JSON Diff already preserve differences in these
source strings. The addition is a lossless formatting-and-comparison workflow
and an integrated review, not a claim that native Diff cannot find the change.
Member order, numeric spelling and string escapes stay significant here; the
comparison does not decide semantic equivalence or authenticate either message.

The new text-inspection paths are bounded to 64 KiB per document, 16,384 tokens
and 64 nested containers. Formatting output is capped at 1 MiB. Lens compares
at most eight retained texts against one explicit reference. Each differing pair
has a collapsed field review with complete bounded counts and up to 128 detail
records. Reference/Compared are result labels, not a chronology or a choice of
truth. The opt-in full line Diff has cooperative work limits and refuses a
completion claim if it cannot finish.

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

To review two captures, put the [fictional comparison sample](../examples/lens-json-comparison.txt)
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

## Copied Bearer fields

You can paste one `Authorization: Bearer <token>` field, or just
`Bearer <token>`, into any JSON investigation goal. The field and compact token
are one named carrier profile, with native extraction from the unchanged input.
Try the [fictional header sample](../examples/lens-bearer-header.txt); it reaches the
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

## Source and evidence

The [README](../README.md) contains build/check commands and upstream attribution.
[Comparison evidence](COMPARISON.md) distinguishes selected engineering cases,
published-format coverage and competent native/manual alternatives. Neither that
comparison nor this guide establishes general detection accuracy or security.
