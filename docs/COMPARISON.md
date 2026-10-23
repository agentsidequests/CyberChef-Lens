# Recorded comparison: a bounded engineering result

The native baseline is CyberChef's unchanged Magic engine from
`cc70a4530b86aff4bc40ccc74b1ad4857eccdca2`, using its pinned configuration.
Where depth 3 missed a target, depth 5 and intensive depth 3 were also checked.
These were shared-engine checks, not a separately deployed stock browser.

| Selected public targets | Stock automatic Magic | JSON investigation after known-gap repairs |
| --- | ---: | ---: |
| Four ordinary token payloads | 4/4 | 4/4 |
| Two compressed SMART examples, 01 and 03 | 0/2 | 2/2 |
| One padded token and one unsigned token | 0/2 | 2/2 |
| **Complete JSON values recovered** | **4/8** | **8/8** |

Competent manual extraction recipes recovered all eight payloads. Exact text was
scored separately: this fork preserved it on six targets; the other two recovered
the full values with changed formatting. Reformatting was not a semantic miss.

Cases were evaluator-selected, not random or blind. The eight targets contain
seven distinct JSON values, including a familiar hello/world value. The SMART
cases reuse a known compression profile. The final result includes repairs on
the observed padded/unsigned misses; do not present it as a fresh holdout score.
Only completed discovered/eligible pools support a native miss; the check does
not cover every possible depth, recipe, encoding, producer or application.

The private engineering replay covered 98 historical trials (97 unique inputs),
retaining every previous complete output, passed native witness and original.
Nineteen recorded non-goal controls remained action-free. That historical corpus
is not the portable feature suite included here, and its count is not a public
benchmark score. The portable suite tests the relevant mechanisms using mostly
constructed inputs without requiring historical Git objects or archived source.

## Public input sources

### Small reproducible unsigned example

The prior README's short unsigned example remains a public input check, separate
from the newer fictional three-layer showcase:

```text
eyJhbGciOiJub25lIn0.eyJoZWxsbyI6ICJ3b3JsZCJ9.
```

The exact target is `{"hello": "world"}`. In the recorded native automatic
searches it was not recovered as a complete payload. The JSON goal recovers it
with an unsigned/unverified label. Manual middle-field extraction and Base64url
decoding also recover it; no new decoder or authentication capability is claimed.

### Source records

- Go mixed-type, numeric-audience and padded examples:
  [golang-jwt fixtures](https://github.com/golang-jwt/jwt/blob/d2cffb184933cab5b685db7e9eea56326f0acc0d/parser_test.go).
- Joe example:
  [JJWT documentation](https://github.com/jwtk/jjwt/blob/fb71496164c71442d08adec4571d9616ed5e1b8d/README.adoc).
- Unsigned and HS384 examples:
  [jose-jwt fixtures](https://github.com/dvsekhvalnov/jose-jwt/blob/20abc4ebf916e1e36586d67609c17d045af1d503/UnitTests/TestSuite.cs).
- Compressed examples 01 and 03:
  [official SMART examples](https://spec.smarthealth.cards/examples/).

Decoding a published SMART test payload does not establish issuer trust,
revocation status, medical validity or signature verification. JSON arrays,
numeric audience values and padded fields can be inspectable data without being
valid JWT claims or canonical JOSE encoding.

## Layer composition: selected constructed probes

Before implementing JSON payload trail, four fictional nested cases were frozen:
Base64 → Cookie → JSON envelope; percent-encoding → Base64 → compressed compact
token; JSON envelope → compact token; and Cookie → compact token. The target text
included a large numeric lexeme, Unicode and original whitespace.

The pinned native Magic engine at depths 3 and 5 and the preceding JSON
investigation did not recover the final target in any of the four cases. One
returned the outer envelope, which is a different layer. Manual native recipes
recovered all four exact targets. The new opt-in trail also recovered all four
exact targets at depth 3, with full original-input recipes for the results and
intermediate layers.

These are same-case engineering checks on deliberately selected inputs, not
blind holdouts, public incident samples or evidence of general superiority.
They isolate automatic composition: the existing decoders already had the
necessary capabilities. The portable tests also cover 25 transport/container
combinations and guarded refusals; that matrix is a regression check, not a
performance benchmark.

## Lossless text: formatting is a separate boundary

Four constructed pairs were frozen before this continuation: adjacent integers
above JavaScript's exact-integer range, a repeated member versus its final
member alone, an overflowing exponent versus null, and a formatting-only
control. In the pinned native JSON Beautify path, each pair became identical
after parsing and serialization. Native Character Diff and raw JSON Diff found
differences in all four original string pairs; they are valid manual controls.

The new opt-in formatting path keeps every non-whitespace JSON token verbatim.
It distinguishes the first three pairs and identifies the fourth as
formatting-only, without assigning semantic equality. Repeated members, numeric
lexemes and escaped string spelling remain visible. The same bounded text
inspection supplies Lens's first-difference view. These selected mechanism tests
are not an independent field evaluation or a general comparison score.

## RFC format coverage

A later source-led challenge froze six JSON-bearing representations from
[RFC 7515](https://www.rfc-editor.org/rfc/rfc7515.html#appendix-A): HMAC, RSA,
ECDSA, unsigned compact form, general JSON and flattened JSON. All share the
same published payload; they test six representations, not six independent
messages. Display-only line wrapping was removed as the specification directs.

Before the repair, focused wrappers and payload trail preserved the exact text
for five of the six. The RSA example's longer signature was excluded by a
short-signature heuristic shared with serializer recognition. The new separate
guarded compact-field path recovers all six exact texts. The known-case repair
is included in this result; it is not a fresh holdout score.

Native Magic recovers the payload values in three cases, with different
formatting. It is not a semantic miss on the RSA example. Competent manual native
recipes recover all six exact texts. Existing native witnesses remain available.
The new path checks canonical Base64url and a complete object header with an
algorithm declaration; it does not verify cryptographic validity, key size,
algorithm/key compatibility, issuer or claims. Legacy serializer heuristics stay
unchanged. New-path encryption, compression, critical and unencoded overrides
remain outside this bounded profile.

Six separate public non-goal controls from RFC 7515, [RFC 7797](https://www.rfc-editor.org/rfc/rfc7797.html#section-4)
and [RFC 6750](https://www.rfc-editor.org/rfc/rfc6750.html#section-2.1) retain no
false JSON-payload action. A clearly labeled header or outer-envelope inspection
is not counted as payload recovery or a false payload result. Two author-composed
Bearer-header contexts were manual-only at that checkpoint; they are not
published example inputs and are not removed from the record to improve the score.

## Copied-field follow-on

The later Bearer-field profile addresses those two known composed copying
contexts. They remain a separate denominator from the six published JSON
representations. The manual control remains the same native extraction route.
This is a known-gap repair, not a fresh benchmark or a new decoding algorithm.

The profile follows the Bearer field syntax in [RFC 6750 section 2.1](https://www.rfc-editor.org/rfc/rfc6750.html#section-2.1)
and case-insensitive field/scheme names in [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-11.1),
but deliberately accepts only a narrow canonical compact-token subset. Opaque
tokens need not be JWTs and do not earn a new JSON-payload action. See the
[profile limits](SECURITY-LIMITS.md#copied-bearer-field-profile).

A repeat of the older challenge hit the 30-second process limit twice on native
search for the bare RFC 7515 HMAC input, before this profile was added. Its
focused wrapper, trail and manual extraction checks completed. The earlier
native-search result above is historical; that repeat did not freshly requalify
the row. A later isolated run of the same unmodified worker completed at depths
3 and 5 and retained the historical outputs and manual witness. Present phase
tracing records milliseconds in native search and most runtime in preparation,
but the cause of the two earlier untraced whole-worker timeouts is unknown.
This is a supplemental requalification, not a new single-run fourteen-row batch
or evidence that Lens fixed a native-search defect.
