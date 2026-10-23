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
