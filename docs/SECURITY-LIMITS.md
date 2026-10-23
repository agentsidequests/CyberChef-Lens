# Experimental scope and known limits

This fork is an inspection tool, not an authentication service. Do not use a
decoded payload to grant access, trust an issuer or accept a signature. Avoid
entering live credentials, personal records or production cookies during review;
use fictional data when reporting a problem.

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
without selecting it as truth. Only the first changed token is located; a
shortened preview can omit other differences. Exact text, formatting-only text
and token differences are separate outcomes. Numeric spelling, string escapes
and member order stay significant even when an application might treat them
as equivalent. Unsupported/oversize comparisons remain explicitly unchecked;
their original result and guarded recipe action remain available.

Diff's separate JSON (lossless) mode formats both documents, then uses the
existing line-diff library with a cooperative 250 ms and 1,024-edit cap. This
clock does not cover parsing, formatting or all internal work. A limited diff
returns an explicit failure, not equality. Display checkboxes can hide additions
or removals; the comparison status still reports differing token text. A custom
sample delimiter must be nonempty and at most 1 KiB UTF-8. No cryptographic,
schema, semantic-equivalence or duplicate-member interpretation is performed.

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

## Inherited dependency advisories — reviewed October 22, 2026

The production lockfile audit reports 26 affected package entries: 1 critical,
2 high, 19 moderate and 4 low. These are package counts, not independent flaws.
They are inherited unchanged from the pinned upstream baseline. This fork has
not run a broad dependency upgrade or claimed that inherited risks are resolved.

- DOMPurify 3.4.16 has a critical-rated advisory involving `SAFE_FOR_TEMPLATES`
  with DOM-returning modes/shadow roots. The inspected caller uses ordinary
  string sanitization; exploitability of that nondefault configuration was not
  established here. The advisory metadata lists 3.4.17 as patched.
  [Advisory](https://github.com/advisories/GHSA-cg2g-xh64-v4q7).
- Markdown-it 14.3.2 has denial-of-service advisories. HTML rendering is disabled
  here, but a separate default-options reference-parsing case remains relevant
  to review. The records list 14.3.3 as a patched 14.x version.
  [HTML-specific](https://github.com/advisories/GHSA-vfgh-jcmw-g37q),
  [default options](https://github.com/advisories/GHSA-gfr2-rv44-r23c).
- Node-forge 1.4.0 has an RSA signature-verification advisory with no patched
  version listed at review. The JSON feature does not verify signatures; that
  does not dispose of the risk in unrelated inherited operations.
  [Advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv).

The added Pako 3.0.2 alias was not listed in that audit. Absence from an advisory
list is not a security guarantee. Its published code is unmodified and its MIT
AND Zlib notices are retained in the root third-party notices file.

This candidate does not claim an exhaustive security review, a complete browser
matrix, a hard sandbox, a fresh-install pass on every platform or production
hardening. Source publication, binary distribution, hosting and acceptance of
security risk are separate decisions. CI configuration is not evidence that a
remote CI run has completed.
