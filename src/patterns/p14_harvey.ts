/**
 * patterns/p14_harvey.ts
 *
 * Renders Pattern 14 (Harvey Ball Comparison): options as columns,
 * criteria as rows, cells = Harvey Ball glyphs (○ ◔ ◑ ◕ ●) colored by
 * semantic status. Geometry from slide_patterns.md P14: table
 * (457200, 1620000, 8229600 × 3960000); criteria col cx=2700000; option
 * cols share the remaining width (doc's 4-option case = 1382400 each);
 * header 360000, criteria rows 432000, optional score footer 504000.
 *
 * Glyph + color logic from slide_templates.md: polarity "positive" —
 * ●/◕ success, ◑ warning, ◔/○ danger; polarity "neutral" — all navy.
 */

import { ShapeIdAllocator } from "../ids.js";
import { BRAND, SEMANTIC, harveyBall } from "../palette.js";
import { escapeXmlText } from "../xml.js";
import { Pattern14HarveySpecSchema, type Pattern14HarveySpec } from "../types.js";

const TABLE_X = 457200;
const TABLE_Y = 1620000;
const TABLE_CX = 8229600;
const CRITERIA_COL_CX = 2700000;
const HEADER_CY = 360000;
const ROW_CY = 432000;
const FOOTER_CY = 504000;

export interface RenderedHarvey {
  bodyXml: string;
  shapeIds: number[];
}

function glyphColor(level: number, polarity: "positive" | "neutral"): string {
  if (polarity === "neutral") return BRAND.navyDam;
  if (level >= 3) return SEMANTIC.success.dark;
  if (level === 2) return SEMANTIC.warning.dark;
  return SEMANTIC.danger.dark;
}

function cellXml(params: {
  shapeId: number;
  name: string;
  rect: { x: number; y: number; cx: number; cy: number };
  text: string;
  sz: number;
  colorHex: string;
  bold?: boolean;
  align?: "l" | "ctr";
  fillHex?: string;
}): string {
  const { shapeId, name, rect, text, sz, colorHex, bold = false, align = "l", fillHex } = params;
  const fill = fillHex ? `<a:solidFill><a:srgbClr val="${fillHex}"/></a:solidFill>` : "<a:noFill/>";
  return `<p:sp>
  <p:nvSpPr><p:cNvPr id="${shapeId}" name="${name}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${rect.x}" y="${rect.y}"/><a:ext cx="${rect.cx}" cy="${rect.cy}"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
    ${fill}
    <a:ln w="9525"><a:solidFill><a:srgbClr val="${BRAND.lightGrayRule}"/></a:solidFill></a:ln>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" anchor="ctr" lIns="91440" tIns="0" rIns="45720" bIns="0"><a:noAutofit/></a:bodyPr>
    <a:lstStyle/>
    <a:p><a:pPr algn="${align}"/><a:r><a:rPr lang="en-US" sz="${sz}"${bold ? ` b="1"` : ""} dirty="0"><a:solidFill><a:srgbClr val="${colorHex}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${escapeXmlText(text)}</a:t></a:r></a:p>
  </p:txBody>
</p:sp>`;
}

export function renderPattern14Harvey(rawSpec: unknown, slideNumber: number): RenderedHarvey {
  const spec: Pattern14HarveySpec = Pattern14HarveySpecSchema.parse(rawSpec);
  const nOpt = spec.options.length;
  spec.criteria.forEach((c, i) => {
    if (c.levels.length !== nOpt) {
      throw new Error(`P14 criterion ${i} ("${c.name}") has ${c.levels.length} levels but there are ${nOpt} options`);
    }
  });
  if (spec.weightedScores && spec.weightedScores.length !== nOpt) {
    throw new Error(`P14 weightedScores has ${spec.weightedScores.length} values but there are ${nOpt} options`);
  }

  const optionCx = Math.floor((TABLE_CX - CRITERIA_COL_CX) / nOpt);
  const optX = (j: number): number => TABLE_X + CRITERIA_COL_CX + j * optionCx;

  const ids = new ShapeIdAllocator(slideNumber);
  const allIds: number[] = [];
  const add = (xml: string, id: number): void => {
    parts.push(xml);
    allIds.push(id);
  };
  const parts: string[] = [];

  // Header row
  const headCritId = ids.alloc();
  add(
    cellXml({ shapeId: headCritId, name: "HvHeadCrit", rect: { x: TABLE_X, y: TABLE_Y, cx: CRITERIA_COL_CX, cy: HEADER_CY }, text: "CRITERIA", sz: 1200, colorHex: BRAND.white, bold: true, fillHex: BRAND.navyDam }),
    headCritId
  );
  spec.options.forEach((opt, j) => {
    const id = ids.alloc();
    add(
      cellXml({ shapeId: id, name: `HvHeadOpt${j + 1}`, rect: { x: optX(j), y: TABLE_Y, cx: optionCx, cy: HEADER_CY }, text: opt.toUpperCase(), sz: 1200, colorHex: BRAND.white, bold: true, align: "ctr", fillHex: BRAND.navyDam }),
      id
    );
  });

  // Criteria rows
  spec.criteria.forEach((crit, i) => {
    const y = TABLE_Y + HEADER_CY + i * ROW_CY;
    const nameId = ids.alloc();
    add(
      cellXml({ shapeId: nameId, name: `HvCrit${i + 1}`, rect: { x: TABLE_X, y, cx: CRITERIA_COL_CX, cy: ROW_CY }, text: crit.name, sz: 1100, colorHex: BRAND.navyDam, bold: true }),
      nameId
    );
    crit.levels.forEach((lv, j) => {
      const id = ids.alloc();
      add(
        cellXml({
          shapeId: id,
          name: `HvCell${i + 1}_${j + 1}`,
          rect: { x: optX(j), y, cx: optionCx, cy: ROW_CY },
          text: harveyBall(lv),
          sz: 2000,
          colorHex: glyphColor(lv, spec.polarity),
          align: "ctr",
        }),
        id
      );
    });
  });

  // Optional weighted-score footer
  if (spec.weightedScores) {
    const y = TABLE_Y + HEADER_CY + spec.criteria.length * ROW_CY;
    const labelId = ids.alloc();
    add(
      cellXml({ shapeId: labelId, name: "HvScoreLbl", rect: { x: TABLE_X, y, cx: CRITERIA_COL_CX, cy: FOOTER_CY }, text: "WEIGHTED SCORE", sz: 1100, colorHex: BRAND.white, bold: true, fillHex: BRAND.navyTram }),
      labelId
    );
    spec.weightedScores.forEach((s, j) => {
      const id = ids.alloc();
      add(
        cellXml({ shapeId: id, name: `HvScore${j + 1}`, rect: { x: optX(j), y, cx: optionCx, cy: FOOTER_CY }, text: s, sz: 1300, colorHex: BRAND.navyDam, bold: true, align: "ctr", fillHex: "FFF7E0" }),
        id
      );
    });
  }

  return { bodyXml: parts.join("\n"), shapeIds: allIds };
}

export const __internalP14 = { TABLE_X, TABLE_Y, TABLE_CX, CRITERIA_COL_CX, HEADER_CY, ROW_CY, FOOTER_CY };

