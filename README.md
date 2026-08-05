# vnf-pptx-toolkit — Phase 1

Deterministic building blocks that offload mechanical computation from the
LM in the `vnf-slidedeck-generator` skill. The LM keeps doing judgement
(content, storyline, pattern choice); this package does arithmetic, ID
bookkeeping, color lookup, connector geometry, and OOXML integrity
validation — the exact defect classes documented in the skill's changelog
(v2.1 double-underline bug, wrong-direction connectors, duplicate shape
IDs, source-line/footer collisions).

## Modules

| File | Replaces the LM having to... | Verified against |
|---|---|---|
| `src/units.ts` | hand-compute EMU coordinates, grid columns, zone y-bands, title-fit (80/100 char rule), master-band collisions | values transcribed from `references/slide_specs.md` |
| `src/palette.ts` | recall/retype 15 brand hex codes, semantic status pairs, categorical/sequential palettes, Harvey ball glyphs | `references/slide_specs.md` color tables |
| `src/ids.ts` | manually track `cNvPr id`, `rIdN`, `sldId` uniqueness | Gate A rules in `validate_pptx_unpacked.py` |
| `src/geometry/connectors.ts` | decide `flipH`/`flipV` by hand for Pyramid/Driver-Tree/Ecosystem connectors | the documented v2.2 connector-geometry fix |
| `src/validator.ts` | — (this **is** Gate A) | line-by-line port of `scripts/validate_pptx_unpacked.py`; cross-checked against the Python original on both a clean and a deliberately-broken copy of `assets/vnf_slide_template.pptx` — identical output, identical exit code |

## Usage

```bash
npm install
npm run build

# Gate A, in-process (no python subprocess needed)
npm run validate -- /path/to/unpacked/

# or programmatically, inside an agent-loop tool:
import { validateUnpacked, connectorGeom, ShapeIdAllocator, BRAND } from "vnf-pptx-toolkit";
```

## What Phase 1 deliberately does NOT do

- Render any slide XML (that's Phase 2/3 — `src/templates/*` and `src/patterns/*`, one function per component/pattern, built on top of these primitives).
- Unpack/pack the `.pptx` (Phase 4 — `src/assembler.ts`, via `jszip`).
- Anything requiring judgement: outline generation, action-title wording, pattern selection, storyline coherence. Those stay with the LM; Zod schemas around their output are a Phase 2 concern.

## Test status

`npm test` → 13/13 passing (units, palette, ids, connector-geometry math).
Validator additionally smoke-tested against the real
`assets/vnf_slide_template.pptx` from the skill bundle, both clean and with
2 injected defects (duplicate `cNvPr id`, missing slide `.rels`) — output
byte-for-byte equivalent to the Python original in both cases.

---

## Phase 2 — first pattern renderer (Pattern 11: Pyramid Principle)

Added:

| File | Purpose |
|---|---|
| `src/types.ts` | Zod schema (`Pattern11PyramidSpecSchema`) — the JSON contract the LM must produce: `governingThought` + exactly 3 `arguments`, each with 1-3 evidence bullets. Invalid input throws before any XML is generated. |
| `src/templates/common.ts` | `renderFilledTextBox()` and `renderBulletListBox()` — generic, reusable `<p:sp>` renderers behind every card/box-style pattern, not just the Pyramid. |
| `src/patterns/p11_pyramid.ts` | `renderPattern11Pyramid(spec, slideNumber)` — composes the above + `ids.ts` + `geometry/connectors.ts` into the full Pyramid pattern (1 top box, 3 argument boxes, 3 evidence boxes, 3 connectors). |
| `src/xml.ts` | Shared `escapeXmlText`/`escapeXmlAttr`, used by every renderer. |

**Bug found and fixed during Phase 2**: `CXN_IDX` in `geometry/connectors.ts`
had `left`/`right` swapped (`references/slide_patterns.md` specifies
`0=top, 1=right, 2=bottom, 3=left`; Phase 1 shipped `1=left, 3=right`).
Caught by transcribing the pattern doc's worked numeric example into a
regression test (`test/pattern11.test.ts`) rather than trusting the
original write-up — exactly the class of error this toolkit exists to
prevent, and it still needs a real test to catch.

**Verification, end to end (not just unit tests):**

1. `test/pattern11.test.ts` (7 tests) — connector geometry reproduces the
   exact numeric worked example in `slide_patterns.md` for all 3
   connectors; Zod schema accepts/rejects correctly; renderer produces 10
   shapes with unique, slide-scoped ids.
2. Rendered a real spec, spliced the resulting `slide3.xml` into a copy of
   the actual `assets/vnf_slide_template.pptx` (new `_rels`, new
   `[Content_Types].xml` override, new `rId`/`sldId` via `RidAllocator`/
   `SldIdAllocator`).
3. **Gate A** (our TS validator): `OK: 3 slide(s) validated, no integrity issues.`
4. **Gate B**: `python-pptx` opened it (`OK: 3 slides`); `soffice --headless --convert-to pdf` converted it without error.
5. **Gate C**: rendered slide 3 to JPEG and visually confirmed — navy
   governing-thought box, 3 blue argument boxes, 3 evidence boxes with
   correct bullets, connectors fanning out in the correct directions (no
   wrong-direction bug), sitting correctly under the template's Content
   layout (VNF logo, "Confidential", page number 3 all present,
   untouched, from the master).

`npm test` now → 20/20 passing.

## Next (Phase 2 continued / Phase 3)

- Port Pattern 16 (Driver Tree) and Pattern 20 (Ecosystem) — the other two
  connector-using patterns — reusing `geometry/connectors.ts` and
  `templates/common.ts` unchanged.
- Port the remaining 21 patterns (mostly simpler: single/multi box
  layouts, no connectors).
- `src/assembler.ts` (Phase 4): replace the manual splice-by-hand script
  used for this verification with a proper `jszip`-based
  unpack/inject/pack pipeline, so the LM calls one `buildDeck()` tool
  instead of the multi-step process shown above.

