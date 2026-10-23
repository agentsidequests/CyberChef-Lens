/**
 * Magic tests.
 *
 * @author n1474335 [n1474335@gmail.com]
 *
 * @copyright Crown Copyright 2018
 * @license Apache-2.0
 */
import TestRegister from "../../lib/TestRegister.mjs";
import { JPG_RAW } from "../../samples/Images.mjs";

TestRegister.addTests([
    {
        name: "Magic: nothing",
        input: "",
        expectedOutput: "Nothing of interest could be detected about the input data.\nHave you tried modifying the operation arguments?",
        recipeConfig: [
            {
                op: "Magic",
                args: [3, false, false]
            }
        ],
    },
    {
        name: "Magic: hex, correct rank",
        input: "41 42 43 44 45",
        expectedMatch: /Properties[^#]+?#recipe=From_Hex\('Space'\)"/,
        recipeConfig: [
            {
                op: "Magic",
                args: [3, false, false]
            }
        ],
    },
    {
        name: "Magic: jpeg render",
        input: JPG_RAW,
        expectedMatch: /Render_Image\('Raw'\)/,
        recipeConfig: [
            {
                op: "Magic",
                args: [3, false, false]
            }
        ],
    },
    {
        name: "Magic: mojibake",
        input: "\xd0\x91\xd1\x8b\xd1\0\xd1\x82\xd1\x80\xd0\xb0\xd1\0\x20\xd0\xba\xd0\xbe\xd1\x80\xd0\xb8\xd1\x87\xd0\xbd\xd0\xb5\xd0\xb2\xd0\xb0\xd1\0\x20\xd0\xbb\xd0\xb8\xd1\0\xd0\xb0\x20\xd0\xbf\xd1\x80\xd1\x8b\xd0\xb3\xd0\xb0\xd0\xb5\xd1\x82\x20\xd1\x87\xd0\xb5\xd1\x80\xd0\xb5\xd0\xb7\x20\xd0\xbb\xd0\xb5\xd0\xbd\xd0\xb8\xd0\xb2\xd1\x83\xd1\x8e\x20\xd1\0\xd0\xbe\xd0\xb1\xd0\xb0\xd0\xba\xd1\x83\x2e",
        expectedMatch: /Быртрар коричневар лира прыгает через ленивую робаку./,
        recipeConfig: [
            {
                op: "Magic",
                args: [1, true, false]
            }
        ],
    },
    {
        name: "Magic: extensive language support, Yiddish",
        input: "די שנעל ברוין פאָקס דזשאַמפּס איבער די פויל הונט.",
        expectedMatch: /Yiddish/,
        recipeConfig: [
            {
                op: "Magic",
                args: [1, false, true]
            }
        ],
    },
    {
        name: "Magic Chain: Base64",
        input: "WkVkV2VtUkRRbnBrU0Vwd1ltMWpQUT09",
        expectedMatch: /From_Base64\('A-Za-z0-9\+\/=',true,false\)\nFrom_Base64\('A-Za-z0-9\+\/=',true,false\)\nFrom_Base64\('A-Za-z0-9\+\/=',true,false\)/,
        recipeConfig: [
            {
                op: "Magic",
                args: [3, false, false]
            }
        ],
    },
    {
        name: "Magic Chain: Hex -> Hexdump -> Base64",
        input: "MDAwMDAwMDAgIDM3IDM0IDIwIDM2IDM1IDIwIDM3IDMzIDIwIDM3IDM0IDIwIDMyIDMwIDIwIDM3ICB8NzQgNjUgNzMgNzQgMjAgN3wKMDAwMDAwMTAgIDMzIDIwIDM3IDM0IDIwIDM3IDMyIDIwIDM2IDM5IDIwIDM2IDY1IDIwIDM2IDM3ICB8MyA3NCA3MiA2OSA2ZSA2N3w=",
        expectedMatch: /From_Base64\('A-Za-z0-9\+\/=',true,false\)\nFrom_Hexdump\(\)\nFrom_Hex\('Space'\)/,
        recipeConfig: [
            {
                op: "Magic",
                args: [3, false, false]
            }
        ],
    },
    {
        name: "Magic Chain: Charcode -> Octal -> Base32",
        input: "GY3SANRUEA2DAIBWGYQDMNJAGQYCANRXEA3DGIBUGAQDMNZAGY2CANBQEA3DEIBWGAQDIMBAGY3SANRTEA2DAIBWG4QDMNBAGQYCANRXEA3DEIBUGAQDMNRAG4YSANBQEA3DMIBRGQ2SANBQEA3DMIBWG4======",
        expectedMatch: /From_Base32\('A-Z2-7=',false\)\nFrom_Octal\('Space'\)\nFrom_Hex\('Space'\)/,
        recipeConfig: [
            {
                op: "Magic",
                args: [3, false, false]
            }
        ],
    },
    {
        name: "Magic Chain: Base64 output",
        input: "WkVkV2VtUkRRbnBrU0Vwd1ltMWpQUT09",
        expectedMatch: /test string/,
        recipeConfig: [
            {
                op: "Magic",
                args: [3, false, false]
            }
        ],
    },
    {
        name: "Magic Chain: Decimal -> Base32 -> Base32",
        input: "I5CVSVCNJFBFER2BLFJUCTKKKJDVKUKEINGUUV2FIFNFIRKJIJJEORJSKNAU2SSSI5MVCRCDJVFFKRKBLFKECTSKIFDUKWKUIFEUEUSHIFNFCPJ5HU6Q====",
        expectedMatch: /test string/,
        recipeConfig: [
            {
                op: "Magic",
                args: [3, false, false]
            }
        ],
    },
    {
        name: "Magic: Raw Inflate",
        input: "\x4d\x52\xb1\x6e\xdc\x30\x0c\xdd\xf3\x15\x44\x80\x6e\xae\x91\x02\x4d\x80\x8e\x4d\x9a\x21\x53\x8b\xa6\x43\x56\x5a\xe2\x9d\x84\x93\x25\x43\x94\xed\xf8\xef\xf3\xe8\x6b\x0e\xb7\x1c\xce\xd4\x7b\x8f\x8f\x7c\x7c\xda\x06\xa9\x4f\x41\x0e\x14\x95\x98\x34\x8e\x53\x92\x8e\x62\x6e\x73\x6c\x71\x11\x5a\x65\x20\x9e\x26\x3a\x94\x4a\x8e\x6b\xdd\x62\x3e\x52\x99\x1b\x71\x4a\x34\x72\xce\x52\xa9\x1c\xe8\xd6\x99\xd0\x2d\x95\x49\x2a\xb7\x58\xb2\xd2\x1a\x5b\x88\x19\xa2\x26\x31\xd4\xb2\xaa\xd4\x9e\xfe\x05\x51\xb9\x86\xc5\xec\xd2\xec\xe5\x7f\x6b\x92\xec\x8a\xb7\x1e\x29\x9e\x84\xde\x7e\xff\x25\x34\x7e\x64\x95\x87\xef\x1d\x8d\xa5\x0a\xb9\x62\xc0\x77\x43\xd6\x6d\x32\x91\x33\xf6\xe7\xf3\x6b\x47\xbf\x9e\x5f\x89\xb3\xa7\xc7\x54\xd6\x43\xd4\xd0\x91\xab\x82\x4e\x10\x1c\x62\xe6\xba\xed\xaf\x41\xde\xfd\x3c\x4e\x8a\x57\x88\x55\x51\x35\x15\x7b\xf1\x72\x5d\xc1\x60\x9e\x1b\x03\xc6\xc9\xcd\xe9\xac\x13\x58\x31\xc3\x8e\x76\x41\xdc\x49\xe7\x11\x42\x2f\x7f\x96\x87\xbd\xf6\xd6\xdf\xdf\xfd\xa0\x89\xab\x02\x0c\x66\xe0\x7c\x34\x1a\xfe\x54\x76\x0d\xeb\xfa\x1c\x11\x2c\x23\x8c\xb3\x0b\xfb\x64\xfd\xcd\x0d\xb6\x43\xad\x94\x64\x69\x78\xd1\x78\xcc\xe2\x51\x00\x85\x07\x2c\x67\x28\x2d\x50\x13\x17\x72\x84\xa3\x9d\x9d\x4b\xfe\x7a\x5d\xe1\xb4\x69\x53\xe3\x20\x9c\x38\x99\x69\xd9\x87\xc0\xa2\x2f\xab\x5b\x79\x3b\xe7\x63\x41\x06\x5e\xcc\x1f\x18\x5e\x20\x61\xe5\x0b\xd0\xbc\xa8\x25\xc0\xe9\x58\x2a\x5e\x46\xed\xe9\xa5\x41\x40\x81\xc9\x4e\x70\x22\xbe\xbb\x58\xed\x68\x98\x63\xc2\x6d\xc0\x18\x72\xad\x32\x4a\x6e\x38\x94\x8d\x10\x6e\x2d\xc0\xd2\x60\x09\x7c\xfa\x34\x4f\x2d\x48\xac\xf4\xed\xee\x0b\x3e\x72\x59\xf6\xab\xa0\x16\x47\x1c\xc9\x82\x65\xa9\xe0\x17\xb6\x36\xc1\x46\xfb\x0f",
        expectedMatch: /#recipe=Raw_Inflate(.|\n)+CyberChef is a simple, intuitive web app for carrying out all manner of /,
        recipeConfig: [
            {
                op: "Magic",
                args: [1, false, false]
            }
        ]
    },
    {
        name: "Magic: Defang IP Address, valid",
        input: "192.168.0.1",
        expectedMatch: /Properties[^#]+?#recipe=Defang_IP_Addresses\(\)"/,
        recipeConfig: [
            {
                op: "Magic",
                args: [1, false, false]
            }
        ]
    },
    {
        name: "Magic: Defang IP Address, invalid",
        input: "192.168.0.1.0",
        unexpectedMatch: /Defang_IP_Addresses/,
        recipeConfig: [
            {
                op: "Magic",
                args: [1, false, false]
            }
        ]
    },
    {
        name: "Magic: invalid zero A1Z26 values do not match",
        input: "0,0",
        unexpectedMatch: /A1Z26 Cipher Decode/,
        recipeConfig: [
            {
                op: "Magic",
                args: [0, false, false]
            }
        ]
    },
    {
        name: "Magic: invalid high A1Z26 values do not match",
        input: "27,1",
        unexpectedMatch: /A1Z26 Cipher Decode/,
        recipeConfig: [
            {
                op: "Magic",
                args: [0, false, false]
            }
        ]
    },
    {
        name: "Magic: valid leading-zero A1Z26 values match",
        input: "26,01",
        expectedMatch: /A1Z26 Cipher Decode/,
        recipeConfig: [
            {
                op: "Magic",
                args: [0, false, false]
            }
        ]
    },
    {
        name: "Magic: valid leading-zero A1Z26 values match with two digits",
        input: "09,10",
        expectedMatch: /A1Z26 Cipher Decode/,
        recipeConfig: [
            {
                op: "Magic",
                args: [0, false, false]
            }
        ]
    },
    {
        name: "Magic JSON goal: complete Base64 document",
        input: "eyJkZW1vIjp0cnVlLCJ2YWx1ZXMiOlsxLDIsM119",
        expectedMatch: /One JSON output found\. Inspect it before use[\s\S]+not verified[\s\S]+Complete JSON object\/array[\s\S]+Load JSON recipe[\s\S]+Readable preview/,
        recipeConfig: [{op: "Magic", args: [3, false, false, "", "JSON object or array"]}]
    },
    {
        name: "Magic JSON goal: reject malformed tail beyond preview",
        input: '{"note":"' + "a".repeat(140) + '"} TRAILING GARBAGE',
        expectedMatch: /No JSON object or array found in these candidate pools/,
        recipeConfig: [{op: "Magic", args: [1, false, false, "", "JSON object or array"]}]
    },
    {
        name: "Magic JSON goal: competing valid percent interpretations",
        input: '{"note":"%41%42%43%44"}',
        expectedMatch: /2 different JSON outputs survived. Compare before choosing[\s\S]+Original input \(no decoding\)/,
        recipeConfig: [{op: "Magic", args: [1, false, false, "", "JSON object or array"]}]
    },
    {
        name: "Magic JSON goal: negative empty input",
        input: "",
        expectedMatch: /No JSON object or array found in these candidate pools/,
        recipeConfig: [{op: "Magic", args: [1, false, false, "", "JSON object or array"]}]
    },
    {
        name: "Magic JSON goal: original Any behavior has no evidence panel",
        input: "41 42 43 44 45",
        unexpectedMatch: /data-magic-goal-report/,
        recipeConfig: [{op: "Magic", args: [3, false, false, "", "Any"]}]
    },
    {
        name: "Magic JSON goal: bound input before discovery",
        input: "a".repeat(65537),
        expectedOutput: "JSON-goal checking supports inputs up to 64 KiB and depth up to 5. Choose Any for the original Magic behavior.",
        recipeConfig: [{op: "Magic", args: [3, false, false, "", "JSON object or array"]}]
    },
    {
        name: "Magic JSON goal: bound depth before discovery",
        input: "{}",
        expectedOutput: "JSON-goal checking supports inputs up to 64 KiB and depth up to 5. Choose Any for the original Magic behavior.",
        recipeConfig: [{op: "Magic", args: [6, false, false, "", "JSON object or array"]}]
    },
    {
        name: "Magic JSON goal: no raw HTML interpolation from candidate data",
        input: '{"example":"<img src=x onerror=alert(1)>"}',
        unexpectedMatch: /<img src=x/,
        recipeConfig: [{op: "Magic", args: [1, false, false, "", "JSON object or array"]}]
    },
    {
        name: "Magic JSON goal: untimed URL-safe serializer",
        input: "WzEsMiwzLDRd.wSPHqC0gR7VUqivlSukJ0IeTDgo",
        expectedMatch: /Complete JSON object\/array[\s\S]+\[1,2,3,4\][\s\S]+Possible untimed URL-safe serializer/,
        recipeConfig: [{op: "Magic", args: [3, false, false, "", "JSON object or array"]}]
    },
    {
        name: "Magic JSON goal: raw untimed JSON keeps internal periods and needs no Base64",
        input: '{"value":1.25,"site":"a.b:c"}.' + "A".repeat(43),
        expectedMatch: /Complete JSON object\/array[\s\S]+1\.25[\s\S]+Possible untimed raw JSON serializer/,
        unexpectedMatch: /From_Base64/,
        recipeConfig: [{op: "Magic", args: [3, false, false, "", "JSON object or array"]}]
    },
    {
        name: "Magic wrappers: Flask payload and trust boundary",
        input: "eyJyb2xlIjoic3VwZXJ1c2VyIiwidXNlciI6ImFkbWluIn0.aZ-KEw.E_x6bOhA4GU9t72pMinJUjN-O3I",
        expectedMatch: /not verified[\s\S]+Complete JSON object\/array[\s\S]+Load payload recipe[\s\S]+superuser[\s\S]+Possible Flask-compatible session[\s\S]+unverified/,
        recipeConfig: [{op: "Magic", args: [3, false, false, "", "JSON wrappers"]}]
    },
    {
        name: "Magic wrappers: Django no generic search or crib",
        input: "eyJtZXNzYWdlIjoiSGVsbG8hIn0:bzb48DBkB-bwLaCnUVB75r5VAPUEpzWJPrTb80JMIXM",
        expectedMatch: /Complete JSON object\/array[\s\S]+Load payload recipe[\s\S]+Hello![\s\S]+Possible Django-compatible signed object/,
        recipeConfig: [{op: "Magic", args: [9, true, true, "[invalid and ignored crib", "JSON wrappers"]}]
    },
    {
        name: "Magic wrappers: unsupported compressed-container shape",
        input: ".abc.def.ghi",
        expectedMatch: /unsupported[\s\S]+not a supported compressed-container shape[\s\S]+No decompression was attempted/,
        recipeConfig: [{op: "Magic", args: [3, false, false, "", "JSON wrappers"]}]
    },
    {
        name: "Magic wrappers: no markup execution from decoded JSON",
        input: "eyJ4IjoiPGltZyBzcmM9eCBvbmVycm9yPWFsZXJ0KDEpPiJ9:bzb48DBkB-bwLaCnUVB75r5VAPUEpzWJPrTb80JMIXM",
        unexpectedMatch: /<img src=x/,
        recipeConfig: [{op: "Magic", args: [3, false, false, "", "JSON wrappers"]}]
    },
    {
        name: "Magic interpretation: unencoded JWS field is not a compatible JWT payload",
        input: "eyJhbGciOiJIUzI1NiIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19.eyJwcm9iZSI6Im5vdC1hLXRydXN0ZWQtY2xhaW0ifQ." + "A".repeat(43),
        expectedMatch: /JWT compatibility check failed[\s\S]+not the declared JWS payload[\s\S]+Load field recipe/,
        unexpectedMatch: /JWT-compatible token/,
        recipeConfig: [{op: "Magic", args: [3, false, false, "", "JSON object or array"]}]
    },
    {
        name: "Magic interpretation: header collision is visible",
        input: "eyJhbGciOiJIUzI1NiJ9.JC4wMg.5mvfOroL-g7HyqJoozehmsaqmvTYGEq5jTI1gVvoEoQ",
        expectedMatch: /Possible header \/ first-field interpretation[\s\S]+may be a header rather than the message[\s\S]+Load field recipe/,
        unexpectedMatch: /Load payload recipe/,
        recipeConfig: [{op: "Magic", args: [3, false, false, "", "JSON object or array"]}]
    },
    {
        name: "Magic interpretation: JSON envelope is not extracted inner payload",
        input: '{"payload":"eyJ4IjoxfQ","signature":"unverified"}',
        expectedMatch: /inner payload has not been extracted[\s\S]+Outer JSON envelope[\s\S]+Inspect envelope recipe/,
        unexpectedMatch: /Load payload recipe/,
        recipeConfig: [{op: "Magic", args: [3, false, false, "", "JSON object or array"]}]
    },
    {
        name: "Magic carriers: paired Cookie data has a native payload action",
        input: "session=eyJtZXNzYWdlIjoiaGkifQ==; session.sig=vdp2-kj-91tgzbWcV1QzofT3hu0",
        expectedMatch: /Extracted Cookie payload \(unverified\)[\s\S]+Load payload recipe/,
        recipeConfig: [{op: "Magic", args: [3, false, false, "", "JSON object or array"]}]
    },
    {
        name: "Magic carriers: outer envelope and extracted payload have distinct roles",
        input: '{"payload":"eyJ4IjoxfQ","protected":"eyJhbGciOiJIUzI1NiJ9","signature":"' + "A".repeat(43) + '"}',
        expectedMatch: /inner JSON payload was extracted[\s\S]+Outer JSON envelope[\s\S]+Inspect envelope recipe[\s\S]+Extracted envelope payload \(unverified\)[\s\S]+Load payload recipe/,
        unexpectedMatch: /inner payload has not been extracted/,
        recipeConfig: [{op: "Magic", args: [3, false, false, "", "JSON object or array"]}]
    },
    {
        name: "Magic carriers: unencoded envelope stays inspectable without a payload action",
        input: '{"payload":"eyJ4IjoxfQ","protected":"eyJhbGciOiJIUzI1NiIsImI2NCI6ZmFsc2V9","signature":"' + "A".repeat(43) + '"}',
        expectedMatch: /b64:false[\s\S]+Inspect envelope recipe/,
        unexpectedMatch: /Load payload recipe/,
        recipeConfig: [{op: "Magic", args: [3, false, false, "", "JSON object or array"]}]
    },
    {
        name: "Magic compact variants: unsigned JSON is visibly unauthenticated",
        input: "eyJhbGciOiJub25lIn0.eyJoZWxsbyI6ICJ3b3JsZCJ9.",
        expectedMatch: /Unsigned JSON payload \(unverified\)[\s\S]+Unsigned token[\s\S]+no authentication[\s\S]+Load payload recipe/,
        recipeConfig: [{op: "Magic", args: [3, false, false, "", "JSON object or array"]}]
    },
    {
        name: "Magic compact variants: padded fields are generic data, not canonical JWT",
        input: "eyJhbGciOiJIUzI1NiJ9.eyJ4IjoxfQ==.YQ==",
        expectedMatch: /Decoded padded JSON field \(unverified\)[\s\S]+not canonical JWT\/JWS encoding[\s\S]+Load field recipe/,
        recipeConfig: [{op: "Magic", args: [3, false, false, "", "JSON wrappers"]}]
    },
    {
        name: "Magic compact variants: missing signature cannot silently become unsigned",
        input: "eyJhbGciOiJIUzI1NiJ9.e30.",
        expectedMatch: /signature is missing[\s\S]+explicit alg:none/,
        recipeConfig: [{op: "Magic", args: [3, false, false, "", "JSON wrappers"]}]
    },
    {
        name: "Magic wrappers: input bound",
        input: "a".repeat(65537),
        expectedOutput: "JSON wrapper investigation supports inputs up to 64 KiB.",
        recipeConfig: [{op: "Magic", args: [3, false, false, "", "JSON wrappers"]}]
    },
    {
        name: "Magic payload trail: Base64 to unsigned compact token, with exact recipes",
        input: "ZXlKaGJHY2lPaUp1YjI1bEluMC5leUpvWld4c2J5STZJQ0ozYjNKc1pDSjku",
        expectedMatch: /Follow the payload[\s\S]+Layer 2[\s\S]+no authentication[\s\S]+Load full JSON recipe[\s\S]+hello[\s\S]+Load layer 1 recipe/,
        recipeConfig: [{op: "Magic", args: [3, false, false, "[", "JSON payload trail"]}]
    },
    {
        name: "Magic payload trail: valid JSON strings are not globally URL-decoded",
        input: '{"note":"%41%42%43%44"}',
        expectedMatch: /Original input · complete JSON[\s\S]+%41%42%43%44/,
        unexpectedMatch: /ABCD/,
        recipeConfig: [{op: "Magic", args: [3, false, false, "", "JSON payload trail"]}]
    },
    {
        name: "Magic payload trail: depth ceiling is visible without a terminal action",
        input: "ZXlKaGJHY2lPaUp1YjI1bEluMC5leUpvWld4c2J5STZJQ0ozYjNKc1pDSjku",
        expectedMatch: /No JSON object or array[\s\S]+Depth ceiling reached \(1 layer\)/,
        unexpectedMatch: /Load full JSON recipe/,
        recipeConfig: [{op: "Magic", args: [1, false, false, "", "JSON payload trail"]}]
    },
    {
        name: "Magic payload trail: input bound",
        input: "a".repeat(65537),
        expectedOutput: "JSON payload trails support inputs up to 64 KiB and an integer depth from 0 to 5.",
        recipeConfig: [{op: "Magic", args: [3, false, false, "", "JSON payload trail"]}]
    },
    {
        name: "Magic payload trail: conditional depth bound preserves original Magic range",
        input: "{}",
        expectedOutput: "JSON payload trails support inputs up to 64 KiB and an integer depth from 0 to 5.",
        recipeConfig: [{op: "Magic", args: [6, false, false, "", "JSON payload trail"]}]
    }
]);
