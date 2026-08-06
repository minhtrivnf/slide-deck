/**
 * patterns/p18_maturity_radar.ts
 *
 * Renders Pattern 18 (Maturity Radar / Spider) as COMPUTED freeform
 * polygons (`<a:custGeom>`) — the skill doc recommends embedded chart.xml
 * "for accuracy", but freeform paths computed in code are exact (this is
 * precisely the math the LLM should never hand-write), package-light
 * (no chart part, no rels), and satisfy Gate A out of the box.
 *
 * Geometry from slide_patterns.md P18: radar plot (1500000, 1620000,
 * 4200000 × 4200000); legend (6000000, 2160000); bullets (6000000,
 * 4200000, 2400000 × 1620000). Scale 0–5. Rings: 5 concentric polygons
 * at r×{0.2..1.0} (noFill, D9D9D9) + axis spokes. Current = D6F1FC 40%
 * fill + 0070C0 outline; target = noFill + 953735 outline (heavier).
 *
 * Axis 0 points straight UP; axes advance clockwise.
 */

import { ShapeIdAllocator } from "../ids.js";
import { renderConnector } from "../geometry/connectors.js";
import { BRAND } from "../palette.js";
import { escapeXmlText } from "../xml.js";
import { renderRect, type Rect } from "../templates/common.js";
import { Pattern18MaturityRadarSpecSchema, type Pattern18MaturityRadarSpec } from "../types.js";

const PLOT: Rect = { x: 1500000, y: 1620000, cx: 4200000, cy: 4200000 };
const CENTER = { x: PLOT.x + PLOT.cx / 2, y: PLOT.y + PLOT.cy / 2 };
const R_MAX = 1800000; // leaves (4200000/2 - 1800000) = 300000 for axis labels
const GRID_STEPS = 5;
const LEGEND_POS = { x: 6000000, y: 2160000 };
const BULLETS_RECT: Rect = { x: 6000000, y: 4200000, cx: 2400000, cy: 1620000 };
const LABEL_RADIUS = R_MAX + 240000;
const MAX_SCALE = 5;

export interface RenderedRadar {
  bodyXml: string;
  shapeIds: number[];
}

interface Pt {
  x: number;
  y: number;
}

/** Vertex of axis i (0 = up, clockwise) at fractional radius r∈[0,1]. */
export function radarPoint(axisIndex: number, axisCount: number, r: number): Pt {
  const angle = -Math.PI / 2 + (2 * Math.PI * axisIndex) / axisCount;
  return {
    x: Math.round(CENTER.x + r * R_MAX * Math.cos(angle)),
    y: Math.round(CENTER.y + r * R_MAX * Math.sin(angle)),
  };
}

function custGeomPolygon(params: {
  shapeId: number;
  name: string;
  pts: Pt[];
  fillHex?: string;
  fillAlphaPct?: number;
  borderHex?: string;
  borderWeightEmu?: number;
}): string {
  const { shapeId, name, pts, fillHex, fillAlphaPct, borderHex, borderWeightEmu = 12700 } = params;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const w = Math.max(...xs) - x0 || 1;
  const h = Math.max(...ys) - y0 || 1;
  const path =
    `<a:moveTo><a:pt x="${pts[0].x - x0}" y="${pts[0].y - y0}"/></a:moveTo>` +
    pts
      .slice(1)
      .map((p) => `<a:lnTo><a:pt x="${p.x - x0}" y="${p.y - y0}"/></a:lnTo>`)
      .join("") +
    `<a:close/>`;
  const fill = fillHex
    ? `<a:solidFill><a:srgbClr val="${fillHex}">${fillAlphaPct !== undefined ? `<a:alpha val="${fillAlphaPct * 1000}"/>` : ""}</a:srgbClr></a:solidFill>`
    : "<a:noFill/>";
  const line = borderHex
    ? `<a:ln w="${borderWeightEmu}"><a:solidFill><a:srgbClr val="${borderHex}"/></a:solidFill></a:ln>`
    : `<a:ln><a:noFill/></a:ln>`;
  return `<p:sp>
  <p:nvSpPr><p:cNvPr id="${shapeId}" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${x0}" y="${y0}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm>
    <a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="${w}" b="${h}"/><a:pathLst><a:path w="${w}" h="${h}">${path}</a:path></a:pathLst></a:custGeom>
    ${fill}
    ${line}
  </p:spPr>
  <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody>
</p:sp>`;
}

export function renderPattern18MaturityRadar(rawSpec: unknown, slideNumber: number): RenderedRadar {
  const spec: Pattern18MaturityRadarSpec = Pattern18MaturityRadarSpecSchema.parse(rawSpec);
  const n = spec.axes.length;

  const ids = new ShapeIdAllocator(slideNumber);
  const allIds: number[] = [];
  const parts: string[] = [];
  const push = (xml: string, ...newIds: number[]): void => {
    parts.push(xml);
    allIds.push(...newIds);
  };

  // Concentric polygon grid rings + spokes
  for (let ring = 1; ring <= GRID_STEPS; ring++) {
    const r = ring / GRID_STEPS;
    const pts = Array.from({ length: n }, (_, i) => radarPoint(i, n, r));
    const id = ids.alloc();
    push(custGeomPolygon({ shapeId: id, name: `RadarRing${ring}`, pts, borderHex: BRAND.lightGrayRule, borderWeightEmu: 6350 }), id);
  }
  spec.axes.forEach((_, i) => {
    const tip = radarPoint(i, n, 1);
    const id = ids.alloc();
    push(
      renderConnector({ connectorShapeId: id, name: `RadarSpoke${i + 1}`, from: CENTER, to: tip, colorHex: BRAND.lightGrayRule, weightEmu: 6350 }),
      id
    );
  });

  // Data polygons: target rendered UNDER current (z-order: draw both, current on top for its translucent fill readability)
  const targetPts = spec.axes.map((a, i) => radarPoint(i, n, a.target / MAX_SCALE));
  const currentPts = spec.axes.map((a, i) => radarPoint(i, n, a.current / MAX_SCALE));
  const tgtId = ids.alloc();
  push(custGeomPolygon({ shapeId: tgtId, name: "RadarTarget", pts: targetPts, borderHex: BRAND.doChinh, borderWeightEmu: 19050 }), tgtId);
  const curId = ids.alloc();
  push(
    custGeomPolygon({ shapeId: curId, name: "RadarCurrent", pts: currentPts, fillHex: BRAND.xanhDaTroi, fillAlphaPct: 40, borderHex: BRAND.xanhSang, borderWeightEmu: 12700 }),
    curId
  );

  // Axis name labels around the radar
  spec.axes.forEach((a, i) => {
    const lp = radarPoint(i, n, LABEL_RADIUS / R_MAX);
    const id = ids.alloc();
    push(
      `<p:sp>
  <p:nvSpPr><p:cNvPr id="${id}" name="RadarAxisLbl${i + 1}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${lp.x - 400000}" y="${lp.y - 120000}"/><a:ext cx="800000" cy="240000"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" anchor="ctr" lIns="0" tIns="0" rIns="0" bIns="0"><a:noAutofit/></a:bodyPr>
    <a:lstStyle/>
    <a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" sz="1000" b="1" dirty="0"><a:solidFill><a:srgbClr val="${BRAND.navyDam}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${escapeXmlText(a.name)}</a:t></a:r></a:p>
  </p:txBody>
</p:sp>`,
      id
    );
  });

  // Legend (Current / Target swatches)
  const leg1Id = ids.alloc();
  const leg2Id = ids.alloc();
  const leg1TxtId = ids.alloc();
  const leg2TxtId = ids.alloc();
  push(renderRect({ shapeId: leg1Id, name: "LegSwCur", rect: { x: LEGEND_POS.x, y: LEGEND_POS.y, cx: 360000, cy: 180000 }, fillHex: BRAND.xanhDaTroi, borderHex: BRAND.xanhSang }), leg1Id);
  push(
    `<p:sp>
  <p:nvSpPr><p:cNvPr id="${leg1TxtId}" name="LegTxtCur"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
  <p:spPr><a:xfrm><a:off x="${LEGEND_POS.x + 457200}" y="${LEGEND_POS.y}"/><a:ext cx="1900000" cy="180000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>
  <p:txBody><a:bodyPr wrap="square" anchor="ctr" lIns="0" tIns="0" rIns="0" bIns="0"/><a:lstStyle/><a:p><a:pPr algn="l"/><a:r><a:rPr lang="en-US" sz="1100" dirty="0"><a:solidFill><a:srgbClr val="${BRAND.bodyText}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>Hiện tại (current)</a:t></a:r></a:p></p:txBody>
</p:sp>`,
    leg1TxtId
  );
  push(renderRect({ shapeId: leg2Id, name: "LegSwTgt", rect: { x: LEGEND_POS.x, y: LEGEND_POS.y + 300000, cx: 360000, cy: 180000 }, borderHex: BRAND.doChinh, borderWeightEmu: 19050 }), leg2Id);
  push(
    `<p:sp>
  <p:nvSpPr><p:cNvPr id="${leg2TxtId}" name="LegTxtTgt"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
  <p:spPr><a:xfrm><a:off x="${LEGEND_POS.x + 457200}" y="${LEGEND_POS.y + 300000}"/><a:ext cx="1900000" cy="180000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>
  <p:txBody><a:bodyPr wrap="square" anchor="ctr" lIns="0" tIns="0" rIns="0" bIns="0"/><a:lstStyle/><a:p><a:pPr algn="l"/><a:r><a:rPr lang="en-US" sz="1100" dirty="0"><a:solidFill><a:srgbClr val="${BRAND.bodyText}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>Mục tiêu (target)</a:t></a:r></a:p></p:txBody>
</p:sp>`,
    leg2TxtId
  );

  // Right-side commentary bullets
  const bulletsId = ids.alloc();
  const bulletPs = spec.bullets
    .map(
      (b) => `    <a:p>
      <a:pPr marL="171450" indent="-171450">
        <a:spcBef><a:spcPts val="600"/></a:spcBef>
        <a:buClr><a:srgbClr val="${BRAND.xanhSang}"/></a:buClr>
        <a:buFont typeface="Arial"/><a:buChar char="•"/>
      </a:pPr>
      <a:r><a:rPr lang="en-US" sz="1100" dirty="0"><a:solidFill><a:srgbClr val="${BRAND.bodyText}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${escapeXmlText(b)}</a:t></a:r>
    </a:p>`
    )
    .join("\n");
  push(
    `<p:sp>
  <p:nvSpPr><p:cNvPr id="${bulletsId}" name="RadarBullets"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${BULLETS_RECT.x}" y="${BULLETS_RECT.y}"/><a:ext cx="${BULLETS_RECT.cx}" cy="${BULLETS_RECT.cy}"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="t"/>
    <a:lstStyle/>
${bulletPs}
  </p:txBody>
</p:sp>`,
    bulletsId
  );

  return { bodyXml: parts.join("\n"), shapeIds: allIds };
}

export const __internalP18 = { PLOT, CENTER, R_MAX, GRID_STEPS, LABEL_RADIUS, radarPoint };

