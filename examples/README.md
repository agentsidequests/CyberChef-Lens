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

## A copied Authorization field

`lens-bearer-header.txt` contains the same fictional compact token with an
`Authorization: Bearer` prefix. Paste its complete text into Input and choose
**Magic → Output goal → JSON wrappers**, or use **JSON payload trail**. The
result keeps the exact reference payload and two parsing cautions. Its label
does not verify a JWT, signature or session. In trail mode the field and compact
token are one named compound carrier profile backed by native extraction.
