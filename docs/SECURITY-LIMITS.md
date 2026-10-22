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

The added inflation operations cap produced output, require complete consumption
of one stream and never return a partial prefix after refusal. Checksummed zlib
and raw DEFLATE are separate operations; raw DEFLATE has no checksum. Decoder
workspace and final output assembly consume memory beyond retained-output bytes.

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
