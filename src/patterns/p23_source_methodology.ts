/**
 * patterns/p23_source_methodology.ts
 *
 * Renders Pattern 23 (Source / Methodology). 3 fixed columns
 * (Sources / Methodology / Assumptions & Caveats), each a heading +
 * bullet list box, per slide_patterns.md Pattern 23 coordinates
 * (matches slide_templates.md "Source / Methodology Column Header"
 * cx=2641600 cy=4320000 exactly). Sources use an en-dash bullet per the
 * doc ("use '–' not '•' for sources"); the other two columns use the
 * standard bullet glyph.
 */

import { ShapeIdAllocator } from "../ids.js";
import { renderHeadingBulletsBox, type StyledBullet } from "../templates/common.js";
import { BRAND } from "../palette.js";
import { Pattern23SourceMethodSpecSchema, type Pattern23SourceMethodSpec, type SourceMethodColumn } from "../types.js";

const COL_XS = [457200, 3327400, 6197600] as const;
const COL_Y = 1620000;
const COL_CX = 2641600;
const COL_CY = 4320000;

export interface RenderedSourceMethod {
  bodyXml: string;
  shapeIds: number[];
}

function bulletsFor(col: SourceMethodColumn, glyph: string): StyledBullet[] {
  return col.items.map((text) => ({
    text,
    fontSizePt: 11,
    textColorHex: BRAND.bodyText,
    bulletGlyph: glyph,
    bulletColorHex: BRAND.gray,
  }));
}

export function renderPattern23SourceMethodology(rawSpec: unknown, slideNumber: number): RenderedSourceMethod {
  const spec: Pattern23SourceMethodSpec = Pattern23SourceMethodSpecSchema.parse(rawSpec);
  const ids = new ShapeIdAllocator(slideNumber);
  const allIds: number[] = [];

  const columns: { col: SourceMethodColumn; glyph: string }[] = [
    { col: spec.sources, glyph: "\u2013" }, // en dash, per doc rule for sources
    { col: spec.methodology, glyph: "\u2022" },
    { col: spec.assumptions, glyph: "\u2022" },
  ];

  const parts = columns.map(({ col, glyph }, i) => {
    const shapeId = ids.alloc();
    allIds.push(shapeId);
    return renderHeadingBulletsBox({
      shapeId,
      name: `SrcMethodCol${i + 1}`,
      rect: { x: COL_XS[i], y: COL_Y, cx: COL_CX, cy: COL_CY },
      heading: col.header.toUpperCase(),
      headingFontSizePt: 13,
      headingColorHex: BRAND.navyDam,
      bullets: bulletsFor(col, glyph),
    });
  });

  return { bodyXml: parts.join("\n"), shapeIds: allIds };
}

export const __internalP23 = { COL_XS, COL_Y, COL_CX, COL_CY };
