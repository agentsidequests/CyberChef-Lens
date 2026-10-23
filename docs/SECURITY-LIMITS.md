# Experimental scope and known limits

This fork is an inspection tool, not an authentication service. Do not use a
decoded payload to grant access, trust an issuer or accept a signature. Avoid
entering live credentials, personal records or production cookies during review;
use fictional data when reporting a problem.

**Saved result files are unredacted.** The explicit exact-JSON download contains
the complete selected decoded text. The evidence-JSON download also contains
the exact UTF-8 input to this Magic step, its retained replay recipes, warnings
and bounded parsing-caution findings. Input, payload and recipe arguments may
contain secrets. Review before sharing; no redaction or automatic download is
performed. The editable snapshot is not signed, tamper-evident or a chain-of-
custody record, and contains no other retained results. Replay uses its saved
Magic-step input, not necessarily the top-level Input or surrounding operations.
Exported text is limited to 2 MiB across the presentation. An evidence snapshot
with missing exact input, more than 64 retained routes or excessive size is
refused rather than truncated. Existing native output-saving remains available.
The complete evidence-text view has the same privacy boundary and export budget;
it provides manual copying when a browser's download path is unavailable.

**Imported evidence is data, not executable authority.** Inspect Lens Evidence
checks a bounded version-1 record profile and recomputes payload cautions. Saved
recipes are displayed but never loaded or executed. Recovery returns a saved
string; it does not rederive the payload, authenticate the record or verify its
original investigation. Review leaves the complete record as its output, while
recovery modes return only the chosen saved string. Later operations in the
user's current recipe still apply normally. Record nesting is capped at 64,
with at most 64 inert routes, 256 steps per route and 256 saved warnings. Duplicate
outer metadata names, unsupported versions, invalid Unicode, inconsistent byte
lengths and malformed/scalar payloads cannot earn recovery actions. Payload
duplicate members remain intact and receive fresh cautions, not metadata refusal.

The JSON goal checks complete UTF-8 JSON objects/arrays within the candidates it
actually considers. It does not establish intended encoding, meaning, schema,
producer identity or general absence of duplicate payload keys. Duplicate-key
guards cover selected headers and envelopes. Ambiguous texts stay separate.

The JSON goal limits input to 64 KiB and depth to 5. Wrapper extraction checks at
most three recipes; native evidence checks at most 256 recipes. Their two-second
timers are cooperative between work units. Module startup, native discovery and
some existing operations remain outside those timers. This is not a hard CPU,
memory or whole-process isolation boundary. Original Any behavior is unchanged.

The separate JSON payload trail mode composes recognized layers. Default depth
is 3, with an integer range of 0–5. It retains at most 16 distinct states and
2 MiB of state bytes, performs at most 64 native replays (including guard/header
checks), and limits each output to 1 MiB. A cooperative three-second exploration
budget begins after module preparation. Original and expandable inputs are
limited to 64 KiB; full recipes are limited to 32 native operations. The engine
records depth ceilings, refusals and early budget stops. Earlier checked results
can remain visible after an incomplete search; they do not prove exhaustion.

Each retained state has at most four distinct recipe routes. Identical exact
texts share a state, but outer containers and different payload texts remain
separate. Intermediate compact-token transit refuses duplicate protected
members, encryption, critical declarations, unsupported encoding overrides and
inconsistent unsigned shapes. No arbitrary JSON-field harvesting or global
rewriting of strings inside a valid JSON document is performed.

Hex transports recognize complete byte pairs, either continuous or separated by
single spaces, with optional surrounding whitespace. Continuous hex replays
with the native automatic delimiter mode so boundary LF/CRLF cannot add decoded
null bytes. Internal newlines/tabs, odd pairs, prefixes and junk do not qualify
as hex transports. The complete original input and all decoded payload bytes,
including meaningful whitespace or invalid trailing bytes, remain unchanged.

Individual compressed steps use the bounded operations below. A trail may
compose multiple recognized steps, but every expandable state must still meet
the 64 KiB input limit. Buffers, module loading, native-operation workspace,
recipe-prefix re-execution and final assembly consume resources beyond retained
state bytes. Cancellation/time checks occur between native work units and are
not a hard preemption guarantee. The browser's normal stop/restart behavior is
separate from the engine's programmatic AbortSignal checks.

The added inflation operations cap produced output, require complete consumption
of one stream and never return a partial prefix after refusal. Checksummed zlib
and raw DEFLATE are separate operations; raw DEFLATE has no checksum. Decoder
workspace and final output assembly consume memory beyond retained-output bytes.

## Lossless JSON inspection

The opt-in lossless JSON formatting/comparison paths accept complete strict JSON
only, with 64 KiB per document, 16,384 tokens and nesting depth 64. Formatting
retains each token spelling and order, replacing insignificant whitespace only;
output is capped at 1 MiB. These bounds are not whole-process memory limits.
Parsed JavaScript values are used only to validate syntax, never to supply
rewritten output or semantic comparisons. Repeated keys are retained, not
resolved or declared safe.

Lens compares no more than eight results against the first displayed text,
without selecting it as truth. The first-token glance is not a full comparison; a
shortened preview can omit other differences. Exact text, formatting-only text
and token differences are separate outcomes. Numeric spelling, string escapes
and member order stay significant even when an application might treat them
as equivalent. Unsupported/oversize comparisons remain explicitly unchecked;
their original result and guarded recipe action remain available.

Each differing inspected pair also has a collapsed field review, reusing the
structural comparison below. It counts all changes within those document bounds
and retains at most 128 detail records per pair, with omitted details explicit.
Reference/Compared labels identify results, not chronology, intended meaning or
trust. Up to seven pairs are prepared; opening the disclosure neither changes
Input nor runs a recipe. The report does not select a result, suppress its
warnings or combine layer texts into one answer. All additions/removals are
included; the standalone Diff's display-filter controls do not apply here.

Diff's separate JSON (lossless) mode formats both documents, then uses the
existing line-diff library with a cooperative 250 ms and 1,024-edit cap. This
clock does not cover parsing, formatting or all internal work. A limited diff
returns an explicit failure, not equality. Display checkboxes can hide additions
or removals; the comparison status still reports differing token text. A custom
sample delimiter must be nonempty and at most 1 KiB UTF-8. No cryptographic,
schema, semantic-equivalence or duplicate-member interpretation is performed.

## Signature-length-independent compact-field extraction

An additional route handles canonical unpadded compact fields whose signature
length does not match the legacy serializer list. It reuses complete strict
header/payload checks and existing native extraction; no decoder algorithm or
cryptographic verification was added. A header must be an object with a nonempty
algorithm declaration and no duplicate names. Missing/nonobject headers,
inconsistent `alg:none` with a nonempty signature, encryption, compression,
critical and unsupported encoding declarations do not earn this new action.

Only the encoding shape is checked. Even a correctly sized field or a declared
algorithm with an arbitrary signature is not authenticated. Unknown algorithm
names may still be inspectable data; algorithm/key compatibility is not checked.
JSON arrays are generic JSON, not JWT Claims Set objects. Legacy short-signature
serializer behavior, shared evidence budgets, cancellation and output bounds are
unchanged. That signature-length change does not add detached/unencoded payloads
or additional compressed profiles. The later copied-field profile is below.

## Copied Bearer field profile

Only a single `Authorization: Bearer` field or bare `Bearer` value is eligible.
Field/scheme names are case-insensitive; surrounding SP/HTAB and one terminal LF
or CRLF are allowed, with one or more SP after the scheme. Embedded/folded lines,
extra credentials, quotes, other schemes and header blocks are not repaired.

The credential must have three canonical unpadded Base64url fields. The header
and payload are nonempty. An empty signature still requires explicit `alg:none`.
Native header decoding must yield a complete object with a nonempty algorithm
declaration and no duplicate names, enc/zip/crit or unsupported b64 declaration.
The new profile does not enable compression. Opaque Bearer credentials can be
valid authorization data but remain outside this JSON-inspection profile.

The native prefix extraction, compact-field extraction and Base64url decoding
replay against the complete original input. In trail mode this compound profile
counts as one named carrier step, not two independently inspected layers. Shared
input, replay, output, preparation, cancellation and cooperative-time limits
remain. No network request, key lookup, signature verification, authorization,
issuer, schema or claim validation is performed. Generic arrays are not JWT
Claims Set objects. No new general-purpose Magic recognizer is added.

## Sharing-copy boundary

Sharing copies are freshly constructed `cyberchef-lens-sharing-copy` records, not
replayable evidence. Only modified payload text, generic notices and aggregate
replacement counts enter the output. Original input, recipes, source coordinates,
investigation metadata, saved warnings, rule strings and arbitrary imported fields
are omitted, with no hidden originals in a download link. Imported recipes never
execute during redaction. Existing evidence validation precedes payload work.

Source-token replacement preserves untouched text, including duplicates and unsafe
number spelling. Literal matching decodes strings/keys; it does not evaluate regex
or paths. Selected subtrees suppress descendant edits. Literal-matched keys receive
generic labels that cannot collide with existing/generated names. Lists are capped
at 64 rules of 128 characters and 8 KiB each; complete payloads at 64 KiB, 16,384
tokens and 64 containers; complete copy at 1 MiB. Exceeding a limit refuses output.

Rules are selected redactions, not exhaustive secret or PII detection. Unknown
names, unselected keys/values and encoded content may remain. Zero replacements
do not attest privacy. The entire generated JSON is available for review, and only
explicit download/manual copy exports it. No automatic upload or publication.
The guided worker is disposable; source/rule/mode changes invalidate old results
and links. The selected result record stays separate from source captures. No
authentication, anonymity, irreversible erasure or independent privacy review is
claimed. Review and keep original evidence separately.

## Saved replay verification boundary

Explicit verification regenerates current bounded payload-trail routes from the
saved input. It never forwards a stored operation or arguments to a loader or
executor. An operation-name/32-step prefilter can skip unsupported claims; it is
not execution authority. Only the complete operation/argument array of a route
actually regenerated by the current recognizers is eligible for comparison.
Unrecognized operation fields, including a stored disabled flag, disqualify a
route rather than being silently discarded during comparison.
Arbitrary Regex/JPath arguments, network/code operations, general Magic and flow
control remain inert even when mixed with supported claims. No new decoder or
dependency is added. Review and exact recovery do not rerun decoding.

Input-record validation still enforces version, strict UTF-8, nesting, duplicate
metadata rejection, byte counts and finite record/input/payload/route sizes.
Imported budgets cannot expand the fixed current exploration limits. Guided
verification uses a disposable worker; source/mode changes and cancellation
terminate it and reject stale replies. A mode change also invalidates pending
file reads so the evidence file allowance cannot leak into ordinary import.

Each reproduced route checks all exact UTF-8 payload bytes and any saved HTTP
coordinates. Unreproduced claims remain explicitly unresolved. Current parsing
cautions do not validate saved warnings, search status or metadata generally.
Mismatched payloads additionally use the existing lossless source-token structural
comparison, bounded to 64 KiB per complete document, 16,384 tokens, 64 nested
containers and 32 retained rows per distinct reproduced output. Counts cover
complete bounded trees. Exceeding a limit refuses the explanation without altering
the complete byte mismatch. Duplicate routes reuse one comparison and detailed
rendering. Whitespace-only differences remain mismatches; values are never
re-serialized to manufacture equality. All paths and source excerpts are escaped.
Coordinated edits can pass: this is a local content-consistency check, not
authentication, historical tamper detection, schema verification or chain of
custody. Module loading remains outside the cooperative search clock; these
limits are not a process sandbox or hard CPU/memory ceiling.

## Whole copied HTTP request boundary

Only the original input to the payload trail is eligible for the HTTP/1.x
request profile. At most three native byte slices (Authorization, Cookie, body)
are considered after complete framing checks. The full original input remains
the replay witness. Identical text at different field offsets has separate
bounded states/routes; global state, replay, depth, output and time budgets still
apply. A refusal yields no partial extraction from that request.

Header values are restricted to ASCII, with consistent LF or CRLF and finite
line/field limits. Repeated framing/carrier singleton fields, folding,
Transfer-Encoding and encoded request bodies are refused. A nonempty body needs
an exact UTF-8 Content-Length match. This is a read-only copied-text profile,
not wire parsing, HTTP conformance validation or an application security verdict.
Header/body locations and saved evidence are unauthenticated claims about the
copied text. A saved request can contain credentials in unrelated headers too;
exports remain unredacted. No network request is issued by this profile.

## Copied Cookie field endings

One unquoted paired Cookie field or Cookie-pair value may end with one LF or
CRLF. Only recognition removes that single terminal ending; the complete input
is retained, and native recipe replay still runs on its exact original bytes.
Any remaining CR/LF refuses the carrier route, including leading/folded lines,
header blocks, extra blank lines and bare CR. Quoted values and duplicate Cookie
names remain refused. This is a narrow copied-field profile, not general HTTP
parsing, credential validation or a choice among conflicting header fields.

## Selected parsing cautions

Lens cards and JSON Beautify's opt-in lossless formatted view inspect strict JSON
for repeated decoded member names within the same object, selected JavaScript
numeric overflow/underflow and magnitudes outside the safe-integer range. String
escapes are decoded for name comparison; Unicode normalization is not applied.
Separate objects have separate name scopes. Maps, not ordinary objects, hold
untrusted member names. Numeric conversion is a diagnostic probe only and never
supplies output or selects a duplicate value.

The existing 64 KiB / 16,384-token / depth-64 limits apply. All category counts
cover the complete inspected document; at most 16 detailed findings are shown
(the low-level maximum is 32). Invalid or oversize text reports inspection not
completed, not a clean document. Numeric checks are not a complete precision
analysis, and duplicate checks do not define an application's member policy.
Absence of a caution does not establish safety, validity for a schema or authenticity.

Locations on Lens cards refer to the exact decoded text, not the encoded input.
JSON Beautify receives formatted output for presentation, so its coordinates
explicitly refer to that formatted output rather than the original input. Plain
lossless output and all default legacy formatting remain unchanged. A formatter
can produce more than 64 KiB from a small input; in that case its presentation
reports that the caution inspection could not complete.

## Structural JSON comparison

Diff's opt-in **JSON structure (lossless)** mode builds a source-span tree from
the existing bounded strict-JSON token inspection. Only member names are decoded
to match them; values are compared by original token spelling. Untrusted names
use Maps, not object properties. No input-supplied operation, path or expression
is executed. All source snippets and report labels are escaped before display.

Objects match decoded name plus occurrence number; arrays match index. Member
order and key spelling are independent change categories. Duplicate alignment is
a deterministic report convention, not a claim that an occurrence kept its real
identity or that any application selects it. No Unicode normalization, numeric
equivalence, array move inference, schema or authenticity check is performed.

Each document is limited to 64 KiB, 16,384 tokens and 64 nested containers.
At most 128 change records retain details; complete category counts still cover
the bounded inputs. A subtree addition/removal or type replacement is one record.
Source previews are capped near 320 characters; path labels at 512 UTF-16 units,
with explicit shortening and source positions. Filters hide only whole addition
or removal records, never the comparison conclusion or total counts. Malformed
or oversized input is an error, not equality. These bounds are not a hard process
sandbox or a cross-browser performance guarantee. Existing Diff modes remain.

## Dependency advisories — reviewed October 23, 2026

After targeted dependency updates, the production lockfile audit reports
34 affected package entries: 0 critical, 30 high, 0 moderate and 4 low. These are
package counts, not independent flaws or verified exploits. The remaining
entries are inherited from the pinned upstream baseline. No broad dependency
upgrade or claim that all inherited risks are resolved is made.

- DOMPurify is locked to 3.4.17, the patched version for the critical-rated
  `SAFE_FOR_TEMPLATES` advisory involving DOM-returning modes/shadow roots.
  Split shadow-root template regressions fail on 3.4.16 and pass on 3.4.17.
  The inspected application caller uses ordinary string sanitization;
  exploitability of that nondefault configuration in this app was not established.
  [Advisory](https://github.com/advisories/GHSA-cg2g-xh64-v4q7).
- Markdown-it is locked to 14.3.3 for its denial-of-service advisories. HTML
  rendering remains disabled; the separate default-options reference-parsing
  case was relevant to the existing caller. Reference labels now obey the
  999-Unicode-codepoint limit; overlong definitions remain literal text.
  Boundary regressions and the native Render Markdown fixtures pass.
  [HTML-specific](https://github.com/advisories/GHSA-vfgh-jcmw-g37q),
  [default options](https://github.com/advisories/GHSA-gfr2-rv44-r23c).
- Jimp is pinned to 1.6.1, using file-type 21.3.4. The official update removes
  the inherited file-type ASF non-progress advisory from this dependency path.
  A bounded child-process regression fails on the previous library and passes
  on the update, with valid PNG decoding as a control. The synthetic malformed
  ASF input was already refused by the application's image-signature check;
  this is library hardening, not a reproduced browser-operation hang.
  [Jimp release](https://github.com/jimp-dev/jimp/releases/tag/v1.6.1),
  [advisory](https://github.com/advisories/GHSA-5v7r-6r5c-r473).
  The published browser entry is an empty stub, so this fork's bundler selects
  the package's published ESM implementation while retaining transitive browser
  conditions. Jimp's parser import is kept inside the image module so worker
  decoding does not require a DOM script loader; the image module remains lazy.
  A bundled behavior regression without a DOM covers decoding, resizing and
  malformed ASF refusal; a successful Node import alone is insufficient.
- Node-forge remains version 1.4.0, with no released patched version listed at
  review. This fork backports the nested DigestAlgorithm element-count guard
  from [upstream candidate #1152](https://github.com/digitalbazaar/forge/pull/1152),
  commit `ceba34402e329f0365134f23fe19898756527d65`. The install/preparation/build
  helper accepts only the reviewed original or patched file hashes and refuses
  another version, unknown bytes or linked/shared dependency targets. A future
  official upgrade requires review rather than automatic application.
  RSA Verify regressions cover 14 extra nested-element cases across five hash
  algorithms, canonical valid signatures and changed-message failures using
  already-public test keys. This is a narrow validation backport, not a complete
  cryptographic or DER-conformance review. Omitted-NULL compatibility remains;
  some cases differ from OpenSSL. The package version and lockfile are unchanged,
  so the audit still reports the high-rated
  [advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv).
  The JSON investigation modes do not verify signatures.

The fresh audit includes the October 23 update to the
[Zod collection-validation advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5),
which now covers the inherited Zod 3.25.76 used by Jimp and propagates through
29 package entries. Zod's version is unchanged by this update. Application
exploitability has not been established; no forced major-version override is
applied. Earlier audit snapshots without this entry are superseded.
The four remaining low-rated entries follow the inherited elliptic dependency
path; they were not upgraded in this change. DOMPurify, Markdown-it,
file-type and the added Pako 3.0.2 alias were not listed in the
patched audit. Absence from an advisory list is not a security guarantee.
Pako's published code is unmodified and its MIT AND Zlib notices are retained
in the root third-party notices file.

The 17 image operations that previously returned a Jimp encoder Buffer's entire
backing ArrayBuffer now copy only its byteOffset/byteLength range. This prevents
adjacent allocation bytes from entering image output when Node pools or slices
Buffers. A regression surrounds real encoded images with sentinel bytes and
checks every repaired operation's exact length, content and output ownership.
The normal Node API entry is also checked with pooling enabled, five input
formats, four output formats and invalid-input controls. Browser image behavior
has a separate acceptance check. This is a narrow output-boundary repair, not
a review of all Buffer uses, image-decoder safety or resource limits.

This candidate does not claim an exhaustive security review, a complete browser
matrix, a hard sandbox, a fresh-install pass on every platform or production
hardening. Source publication, binary distribution, hosting and acceptance of
security risk are separate decisions. CI configuration is not evidence that a
remote CI run has completed.
