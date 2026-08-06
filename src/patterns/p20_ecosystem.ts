/**
 * patterns/p20_ecosystem.ts
 *
 * Renders Pattern 20 (Ecosystem / Stakeholder Map): navy center node →
 * inner ring (≤4 blue nodes at doc's NW/NE/SW/SE slots) → outer ring
 * (≤8 white/navy-border nodes at 8 cardinal slots).
 *
 * Geometry: center (3850000, 2700000, 1450000²) → center point
 * (4575000, 3425000). Inner slots verbatim from slide_patterns.md P20.
 * Outer slots computed around the center with rx=2900000, ry=2100000
 * (clamped so the widest node stays inside the safe margin: E slot right
 * edge = 8575000 < 8686800), S slot clamped above the source zone.
 *
 * Connectors: dashed `888888` straight lines from center to each node
 * CENTER, rendered UNDER the nodes (z-order) so each line visually stops
 * at the node's filled edge — the standard trick, and it sidesteps
 * needing ellipse connection-site indices.
 */

import { ShapeIdAllocator } from "../ids.js";
import { renderConnector } from "../geometry/connectors.js";
import { BRAND } from "../palette.js";
import { escapeXmlText } from "../xml.js";
import type { Rect } from "../templates/common.js";
import { Pattern20EcosystemSpecSchema, type Pattern20EcosystemSpec } from "../types.js";

const CENTER_RECT: Rect = { x: 3850000, y: 2700000, cx: 1450000, cy: 1450000 };
const CENTER_PT = { x: CENTER_RECT.x + CENTER_RECT.cx / 2, y: CENTER_RECT.y + CENTER_RECT.cy / 2 };
const INNER_SLOTS = [
  { x: 1700000, y: 1700000 },
  { x: 5800000, y: 1700000 },
  { x: 1700000, y: 4200000 },
  { x: 5800000, y: 4200000 },
] as const;
const INNER_CX = 1300000;
const INNER_CY = 720000;
const OUTER_CX = 1100000;
const OUTER_CY = 540000;
// 8 cardinal slots (N → NE → E → …) as CENTER points about CENTER_PT.
// Bounds-checked: E right edge 8575000 < 8686800 (right margin); S bottom
// 5400000 = content-zone floor; W left edge 575000 > 457200 (left margin).
// Diagonal slots may slightly kiss the inner ring's corners (≤0.5mm) —
// acceptable on 4:3 canvas with doc-fixed inner slots.
const OUTER_CENTERS: { x: number; y: number }[] = [
  { x: 4575000, y: 1595000 }, // N  (slot 0)
  { x: 7475000, y: 1525000 }, // NE (slot 1)
  { x: 8025000, y: 3425000 }, // E  (slot 2)
  { x: 7475000, y: 4950000 }, // SE (slot 3)
  { x: 4575000, y: 5130000 }, // S  (slot 4)
  { x: 1675000, y: 4950000 }, // SW (slot 5)
  { x: 1125000, y: 3425000 }, // W  (slot 6)
  { x: 1675000, y: 1525000 }, // NW (slot 7)
];
/** Quadrant-label corner → outer-ring slots that would overlap it. */
const QUAD_LABEL_CONFLICTS: Record<string, number[]> = {
  topLeft: [7],
  topRight: [1],
  bottomLeft: [],
  bottomRight: [],
};

export interface RenderedEcosystem {
  bodyXml: string;
  shapeIds: number[];
}

function nodeXml(params: {
  shapeId: number;
  name: string;
  rect: Rect;
  text: string;
  fillHex?: string;
  borderHex?: string;
  textColorHex: string;
  fontSizePt: number;
  ellipse?: boolean;
}): string {
  const { shapeId, name, rect, text, fillHex, borderHex, textColorHex, fontSizePt, ellipse = false } = params;
  const geom = ellipse
    ? `<a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom>`
    : `<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 12000"/></a:avLst></a:prstGeom>`;
  const fill = fillHex ? `<a:solidFill><a:srgbClr val="${fillHex}"/></a:solidFill>` : "<a:noFill/>";
  const line = borderHex
    ? `<a:ln w="12700"><a:solidFill><a:srgbClr val="${borderHex}"/></a:solidFill></a:ln>`
    : `<a:ln><a:noFill/></a:ln>`;
  return `<p:sp>
  <p:nvSpPr><p:cNvPr id="${shapeId}" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${rect.x}" y="${rect.y}"/><a:ext cx="${rect.cx}" cy="${rect.cy}"/></a:xfrm>
    ${geom}
    ${fill}
    ${line}
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" anchor="ctr" lIns="45720" tIns="22860" rIns="45720" bIns="22860"><a:normAutofit fontScale="100000" lnSpcReduction="0"/></a:bodyPr>
    <a:lstStyle/>
    <a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" sz="${Math.round(fontSizePt * 100)}" b="1" dirty="0"><a:solidFill><a:srgbClr val="${textColorHex}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${escapeXmlText(text)}</a:t></a:r></a:p>
  </p:txBody>
</p:sp>`;
}

export function renderPattern20Ecosystem(rawSpec: unknown, slideNumber: number): RenderedEcosystem {
  const spec: Pattern20EcosystemSpec = Pattern20EcosystemSpecSchema.parse(rawSpec);

  // Top-corner quadrant labels share the canvas band used by the NE/NW
  // outer nodes — fail fast with a readable message instead of overlaying.
  const quadrant = spec.quadrantLabels;
  if (quadrant) {
    for (const [key, conflictSlots] of Object.entries(QUAD_LABEL_CONFLICTS)) {
      const label = (quadrant as Record<string, string | undefined>)[key];
      if (!label) continue;
      const used = conflictSlots.filter((slot) => slot < spec.outer.length);
      if (used.length) {
        throw new Error(
          `P20: quadrantLabels.${key} ("${label}") overlaps the occupied outer slot(s) ${used.join(", ")} — drop the label or leave the corner slot(s) empty`
        );
      }
    }
  }

  const ids = new ShapeIdAllocator(slideNumber);
  const allIds: number[] = [];
  const connectors: string[] = [];
  const nodes: string[] = [];

  // --- connectors FIRST (rendered under nodes) ---
  const link = (toX: number, toY: number, name: string): void => {
    const id = ids.alloc();
    allIds.push(id);
    connectors.push(
      renderConnector({
        connectorShapeId: id,
        name,
        from: { x: CENTER_PT.x, y: CENTER_PT.y },
        to: { x: toX, y: toY },
        colorHex: BRAND.gray,
        weightEmu: 9525,
        dash: "dash",
      })
    );
  };

  spec.inner.forEach((_, i) => {
    link(INNER_SLOTS[i].x + INNER_CX / 2, INNER_SLOTS[i].y + INNER_CY / 2, `LinkIn${i + 1}`);
  });
  spec.outer.forEach((_, i) => link(OUTER_CENTERS[i].x, OUTER_CENTERS[i].y, `LinkOut${i + 1}`));

  // --- nodes ON TOP ---
  spec.inner.forEach((text, i) => {
    const id = ids.alloc();
    allIds.push(id);
    nodes.push(
      nodeXml({
        shapeId: id,
        name: `EcoInner${i + 1}`,
        rect: { x: INNER_SLOTS[i].x, y: INNER_SLOTS[i].y, cx: INNER_CX, cy: INNER_CY },
        text,
        fillHex: BRAND.xanhSang,
        textColorHex: BRAND.white,
        fontSizePt: 11,
      })
    );
  });
  spec.outer.forEach((text, i) => {
    const id = ids.alloc();
    allIds.push(id);
    nodes.push(
      nodeXml({
        shapeId: id,
        name: `EcoOuter${i + 1}`,
        rect: { x: OUTER_CENTERS[i].x - OUTER_CX / 2, y: OUTER_CENTERS[i].y - OUTER_CY / 2, cx: OUTER_CX, cy: OUTER_CY },
        text,
        fillHex: BRAND.white,
        borderHex: BRAND.navyDam,
        textColorHex: BRAND.navyDam,
        fontSizePt: 10,
      })
    );
  });

  // Center on top of everything
  const centerId = ids.alloc();
  allIds.push(centerId);
  nodes.push(
    nodeXml({
      shapeId: centerId,
      name: "EcoCenter",
      rect: CENTER_RECT,
      text: spec.center,
      fillHex: BRAND.navyDam,
      borderHex: BRAND.xanhSang,
      textColorHex: BRAND.white,
      fontSizePt: 14,
      ellipse: true,
    })
  );

  // Optional quadrant labels (corners)
  const quadDefs: { text: string | undefined; x: number; y: number; align: "l" | "r" }[] = [
    { text: quadrant?.topLeft, x: 230400, y: 1310000, align: "l" },
    { text: quadrant?.topRight, x: 6559200, y: 1310000, align: "r" },
    { text: quadrant?.bottomLeft, x: 230400, y: 5580000, align: "l" },
    { text: quadrant?.bottomRight, x: 6559200, y: 5580000, align: "r" },
  ];
  quadDefs.forEach((qd, i) => {
    if (!qd.text) return;
    const id = ids.alloc();
    allIds.push(id);
    nodes.push(`<p:sp>
  <p:nvSpPr><p:cNvPr id="${id}" name="EcoQuad${i}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
  <p:spPr><a:xfrm><a:off x="${qd.x}" y="${qd.y}"/><a:ext cx="1900000" cy="252000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>
  <p:txBody><a:bodyPr wrap="square" anchor="ctr" lIns="0" tIns="0" rIns="0" bIns="0"/><a:lstStyle/><a:p><a:pPr algn="${qd.align}"/><a:r><a:rPr lang="en-US" sz="1000" b="1" spc="200" dirty="0"><a:solidFill><a:srgbClr val="${BRAND.gray}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${escapeXmlText(qd.text.toUpperCase())}</a:t></a:r></a:p></p:txBody>
</p:sp>`);
  });

  return { bodyXml: [...connectors, ...nodes].join("\n"), shapeIds: allIds };
}

export const __internalP20 = { CENTER_RECT, CENTER_PT, INNER_SLOTS, OUTER_CENTERS, INNER_CX, INNER_CY, OUTER_CX, OUTER_CY };

