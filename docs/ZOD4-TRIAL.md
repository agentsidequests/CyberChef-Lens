# Isolated Zod 4 trial

This branch pins an npm override to Zod 4.6.7. Jimp 1.6.1 still declares a Zod 3
range, so this is an explicit compatibility trial rather than an upstream
supported dependency change. No other locked package is changed.

The bounded-array regression distinguishes the patched root export from Zod 3:
an oversized constrained array is refused before element parsing. An unbounded
array still walks its elements and reports their issues; this is not a general
resource limit for arbitrary schemas or image decoding.

Qualification must include actual resolved imports, image output/refusal parity,
native/API/focused suites, production lint/build and the exact packaged browser
entrypoint. Passing a version audit or an isolated import alone is insufficient.
The normal verified package remains the release candidate until a separate
adoption decision. This branch does not claim security clearance or publication.
