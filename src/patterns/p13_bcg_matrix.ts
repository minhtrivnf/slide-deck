/**
 * patterns/p13_bcg_matrix.ts
 *
 * Renders Pattern 13 (BCG 2×2 Matrix — axes + bubbles). Geometry from
 * slide_patterns.md P13: plot (1300000, 1620000, 6800000 × 4200000);
 * quadrant labels at (1400000/4900000, 1700000/3700000); mid-lines at
 * x=4700000 / y=3720000; quadrant fills per doc (TL F2F2F2 neutral,
 * TR E8F5E9 star, BL FCE4E4 dog, BR FFF4E0 question); bubble XML per
 * slide_templates.md (alpha 65%, navy border, white 10pt bold label).
 *
 * Bubbles are positioned in normalized [0..1]² coordinates — never in
 * EMU — mapped onto the plot rect in code (y=0 is BOTTOM edge).
 */

import { ShapeIdAllocator } from "../ids.js";
import { renderConnector } from "../geometry/connectors.js";
import { BRAND, SEMANTIC } from "../palette.js";
import { escapeXmlText } from "../xml.js";
import { renderRect, type Rect } from "../templates/common.js";
import { Pattern13BcgMatrixSpecSchema, type Pattern13BcgMatrixSpec } from "../types.js";

const PLOT: Rect = { x: 1300000, y: 1620000, cx: 6800000, cy: 4200000 };
const QUADRANT_FILLS = {
  tl: SEMANTIC.neutral.light,
  tr: SEMANTIC.success.light,
  bl: SEMANTIC.danger.light,
  br: SEMANTIC.warning.light,
} as const;
const QUAD_LABEL_POS = {
  tl: { x: 1400000, y: 1700000 },
  tr: { x: 4900000, y: 1700000 },
  bl: { x: 1400000, y: 3700000 },
  br: { x: 4900000, y: 3700000 },
} as const;
const BUBBLE_D = { s: 360000, m: 504000, l: 720000 } as const;
const AXIS_LABEL_X = { x: 1300000, y: 5940000, cx: 6800000, cy: 252000 };

export interface RenderedBcgMatrix {
  bodyXml: string;
  shapeIds: number[];
}

export function renderPattern13BcgMatrix(rawSpec: unknown, slideNumber: number): RenderedBcgMatrix {
  const spec: Pattern13BcgMatrixSpec = Pattern13BcgMatrixSpecSchema.parse(rawSpec);
  const ids = new ShapeIdAllocator(slideNumber);
  const allIds: number[] = [];
  const parts: string[] = [];
  const push = (xml: string, ...newIds: number[]): void => {
    parts.push(xml);
    allIds.push(...newIds);
  };

  // 4 quadrant fills (under everything)
  const midX = PLOT.x + PLOT.cx / 2;
  const midY = PLOT.y + PLOT.cy / 2;
  const quadrantRects: { x: number; y: number; fill: string; name: string }[] = [
    { x: PLOT.x, y: PLOT.y, fill: QUADRANT_FILLS.tl, name: "QuadTL" },
    { x: midX, y: PLOT.y, fill: QUADRANT_FILLS.tr, name: "QuadTR" },
    { x: PLOT.x, y: midY, fill: QUADRANT_FILLS.bl, name: "QuadBL" },
    { x: midX, y: midY, fill: QUADRANT_FILLS.br, name: "QuadBR" },
  ];
  for (const q of quadrantRects) {
    const id = ids.alloc();
    push(
      renderRect({ shapeId: id, name: q.name, rect: { x: q.x, y: q.y, cx: PLOT.cx / 2, cy: PLOT.cy / 2 }, fillHex: q.fill }),
      id
    );
  }

  // Outer frame + mid-lines
  const frameId = ids.alloc();
  push(
    renderRect({ shapeId: frameId, name: "2x2Frame", rect: PLOT, borderHex: BRAND.gray, borderWeightEmu: 12700 }),
    frameId
  );
  const vId = ids.alloc();
  const hId = ids.alloc();
  push(
    renderConnector({ connectorShapeId: vId, name: "VLine", from: { x: midX, y: PLOT.y }, to: { x: midX, y: PLOT.y + PLOT.cy }, colorHex: BRAND.lightGrayRule, weightEmu: 9525 }),
    vId
  );
  push(
    renderConnector({ connectorShapeId: hId, name: "HLine", from: { x: PLOT.x, y: midY }, to: { x: PLOT.x + PLOT.cx, y: midY }, colorHex: BRAND.lightGrayRule, weightEmu: 9525 }),
    hId
  );

  // Quadrant labels (order: TL, TR, BL, BR)
  const quadKeys = ["tl", "tr", "bl", "br"] as const;
  spec.quadrantLabels.forEach((label, i) => {
    const pos = QUAD_LABEL_POS[quadKeys[i]];
    const id = ids.alloc();
    push(
      `<p:sp>
  <p:nvSpPr><p:cNvPr id="${id}" name="QuadLbl${i + 1}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${pos.x}" y="${pos.y}"/><a:ext cx="3200000" cy="252000"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" anchor="t" lIns="0" tIns="0" rIns="0" bIns="0"><a:noAutofit/></a:bodyPr>
    <a:lstStyle/>
    <a:p><a:pPr algn="l"/><a:r><a:rPr lang="en-US" sz="1000" b="1" spc="200" dirty="0"><a:solidFill><a:srgbClr val="${BRAND.subtleBody}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${escapeXmlText(label.toUpperCase())}</a:t></a:r></a:p>
  </p:txBody>
</p:sp>`,
      id
    );
  });

  // Bubbles — normalized coords → plot EMU (y=0 at bottom edge)
  spec.bubbles.forEach((b, i) => {
    const d = BUBBLE_D[b.size];
    const bx = Math.round(PLOT.x + b.x * PLOT.cx - d / 2);
    const by = Math.round(PLOT.y + (1 - b.y) * PLOT.cy - d / 2);
    const id = ids.alloc();
    push(
      `<p:sp>
  <p:nvSpPr><p:cNvPr id="${id}" name="Bubble${i + 1}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${bx}" y="${by}"/><a:ext cx="${d}" cy="${d}"/></a:xfrm>
    <a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom>
    <a:solidFill><a:srgbClr val="${BRAND.xanhSang}"><a:alpha val="65000"/></a:srgbClr></a:solidFill>
    <a:ln w="12700"><a:solidFill><a:srgbClr val="${BRAND.navyDam}"/></a:solidFill></a:ln>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" anchor="ctr" lIns="22860" tIns="0" rIns="22860" bIns="0"><a:noAutofit/></a:bodyPr>
    <a:lstStyle/>
    <a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" sz="1000" b="1" dirty="0"><a:solidFill><a:srgbClr val="${BRAND.white}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${escapeXmlText(b.label)}</a:t></a:r></a:p>
  </p:txBody>
</p:sp>`,
      id
    );
  });

  // Axis labels
  const xAxisId = ids.alloc();
  push(
    `<p:sp>
  <p:nvSpPr><p:cNvPr id="${xAxisId}" name="XAxisLabel"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${AXIS_LABEL_X.x}" y="${AXIS_LABEL_X.y}"/><a:ext cx="${AXIS_LABEL_X.cx}" cy="${AXIS_LABEL_X.cy}"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" anchor="ctr" lIns="0" tIns="0" rIns="0" bIns="0"><a:noAutofit/></a:bodyPr>
    <a:lstStyle/>
    <a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" sz="1100" b="1" spc="200" dirty="0"><a:solidFill><a:srgbClr val="${BRAND.navyDam}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${escapeXmlText(spec.xAxisLabel.toUpperCase())} →</a:t></a:r></a:p>
  </p:txBody>
</p:sp>`,
    xAxisId
  );
  const yAxisId = ids.alloc();
  push(
    `<p:sp>
  <p:nvSpPr><p:cNvPr id="${yAxisId}" name="YAxisLabel"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="230400" y="3060000"/><a:ext cx="800000" cy="1320000"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" anchor="ctr" lIns="0" tIns="0" rIns="0" bIns="0"><a:noAutofit/></a:bodyPr>
    <a:lstStyle/>
    <a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" sz="1100" b="1" spc="200" dirty="0"><a:solidFill><a:srgbClr val="${BRAND.navyDam}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${escapeXmlText(spec.yAxisLabel.toUpperCase())} ↑</a:t></a:r></a:p>
  </p:txBody>
</p:sp>`,
    yAxisId
  );

  return { bodyXml: parts.join("\n"), shapeIds: allIds };
}

export const __internalP13 = { PLOT, QUADRANT_FILLS, BUBBLE_D, QUAD_LABEL_POS, AXIS_LABEL_X };

