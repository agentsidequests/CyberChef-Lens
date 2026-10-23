# A session export that deserves a closer look

This is a **fictional training fixture**, not a captured user session. Both
signatures are fabricated. Do not use it as an authentication or exploit test.

## In CyberChef Lens

1. Drag `lens-investigation.txt` into Input, or copy its complete text there.
2. Add **Magic**, leave **Depth** at **3**, and choose
   **Output goal → JSON payload trail**.
3. Open **Inspect locations and parsing consequences**. The final payload has
   two cautions: one repeated member name and one unsafe-range number.
4. Open **Follow the decoding trail** to inspect the paired Cookie and compact
   token. Choose **Load full JSON recipe** to replay from the unchanged input.

Before loading the recipe, you can open **Save this result**. **Download exact
JSON** matches the reference payload byte for byte. **Download evidence JSON**
also keeps the unredacted Magic-step input, replay recipes, cautions and recorded
search status. The payload is stored as a string, not parsed account/role values.
These fictional files are safe training material; real input may contain live
credentials. Review any saved result before sharing it.

To reopen that record, copy the complete evidence JSON (not just its payload),
paste it into Input and replace the current recipe with **Inspect Lens Evidence**.
You can find it by searching Operations for “Lens”. Review shows fresh payload
cautions without executing any saved recipe. Use **Recover saved payload** to
return the exact reference text, or **Recover saved Magic-step input** for the
saved input. Neither action overwrites Input or authenticates the record.

The three logical layers are Base64 → paired Cookie → compact token → JSON.
The final `lens-investigation-payload.txt` is the exact 100-byte reference,
including its final LF. The input file also ends in LF; do not delete characters
inside the encoded string or paste the reference payload as the starting input.

## Why the cautions matter

`"role"` and `"\u0072ole"` decode to the same name. A parser may keep only one
value. The account number `9007199254740993` is outside JavaScript's safe-integer
range; ordinary JavaScript parsing and serialization writes it back as
`9007199254740992`. This fixture makes both changes visible. It does not prove
how an unspecified application handles the data.

Lens keeps both members and the exact numeric spelling. It does not decide which
role should win, validate an account, or verify a signature.

## The competent manual route

The five-operation native recipe is in `lens-investigation-recipe.json`. Copy
its complete JSON into the **Recipe** field in CyberChef's **Load recipe** dialog,
then choose **LOAD**. Use the original input file, not the reference payload.
It uses only existing From Base64 and Regular expression operations. Its complete
output matches the reference payload. The addition is automatic guarded
composition and review, not a decoding algorithm that stock CyberChef lacks.

These files are included in Lens's standalone ZIP under `examples/`. Keep that
folder separate from Input: drag the individual input file, not the folder.
The examples require no network service, key or API account.

For a saved-record replay check, choose **Lens workspace → Verify saved evidence**,
load `lens-evidence.json` or choose **Try a saved example**, then **Check saved
evidence**. The example matches its decoded payload. Changing only its saved
`result.text` from `queued` to `failed` keeps valid JSON and equal byte lengths,
but produces a mismatch. Coordinated edits can match; this is consistency, not
authenticity. The [verification guide](../docs/USAGE.md#check-saved-replay) explains
supported profiles and unresolved outcomes.

When pasting one paired Cookie field directly, one terminal LF or CRLF is
accepted. The saved original input keeps that ending; extracted payload bytes
are unchanged. That field-only profile refuses complete requests or folded/multiline headers.
Blank lines, bare CR, quoted values and duplicate Cookie names remain refused.
For a complete request use **Lens workspace → Try an HTTP request**, or load
`lens-http-request.txt`. Its Authorization payload says `queued` and its body
says `released`; both remain separate results. No signature is genuine and no
request is sent. The [request guide](../docs/USAGE.md#whole-copied-http-requests)
describes accepted framing and refusal cases.

## A copied Authorization field

`lens-bearer-header.txt` contains the same fictional compact token with an
`Authorization: Bearer` prefix. Paste its complete text into Input and choose
**Magic → Output goal → JSON wrappers**, or use **JSON payload trail**. The
result keeps the exact reference payload and two parsing cautions. Its label
does not verify a JWT, signature or session. In trail mode the field and compact
token are one named compound carrier profile backed by native extraction.

## Compare two fictional captures

Put the complete `lens-json-comparison.txt` in Input. Add **Diff**, set
**Sample delimiter** to `\n===\n`, and choose **JSON structure (lossless)**.
Eight change records locate the account number, second role's key spelling and
value, daily limit, changed/added array positions, removed `retired` member and
added `enabled` member. Both documents contain deliberate numeric/parser
cautions. They are not real sessions and do not demonstrate authorization.

Paths use decoded names and duplicate occurrence numbers; arrays use zero-based
indexes. Counts are change records, not affected leaf counts or a semantic
assessment. **Show added** and **Show removed** filter corresponding records
without hiding their totals. Source locations and exact token previews remain
inspectable. **JSON (lossless)** retains the separate full line-comparison route.
