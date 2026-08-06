/**
 * patterns/p9_bar_chart.ts
 *
 * Renders Pattern 9 (shape-based horizontal bar chart). Geometry verbatim
 * from slide_patterns.md P9: bars at x=2000000, y=1800000 + i×800000,
 * h=600000, max width 6000000; category labels right-aligned at
 * x=457200 (11pt navy); value labels printed right after each bar end.
 * Bar colors rotate through the categorical palette.
 */

import { ShapeIdAllocator } from "../ids.js";
import { BRAND, categoricalColor } from "../palette.js";
import { escapeXmlText } from "../xml.js";
import { renderRect } from "../templates/common.js";
import { Pattern9BarChartSpecSchema, type Pattern9BarChartSpec } from "../types.js";

const BAR_X = 2000000;
const BAR_Y0 = 1800000;
const BAR_STEP_Y = 800000;
const BAR_CY = 600000;
const BAR_MAX_CX = 6000000;
const LABEL_RECT = { x: 457200, cx: 1400000 };

function textBox(params: {
  shapeId: number;
  name: string;
  rect: { x: number; y: number; cx: number; cy: number };
  runs: { text: string; sz: number; b?: boolean; colorHex: string }[];
  align?: "l" | "r" | "ctr";
}): string {
  const { shapeId, name, rect, runs, align = "l" } = params;
  const runsXml = runs
    .map(
      (r) => `<a:r><a:rPr lang="en-US" sz="${r.sz}"${r.b ? ` b="1"` : ""} dirty="0"><a:solidFill><a:srgbClr val="${r.colorHex}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${escapeXmlText(r.text)}</a:t></a:r>`
    )
    .join("");
  return `<p:sp>
  <p:nvSpPr><p:cNvPr id="${shapeId}" name="${name}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${rect.x}" y="${rect.y}"/><a:ext cx="${rect.cx}" cy="${rect.cy}"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
    <a:noFill/>
  </p:spPr>
  <p:txBody><a:bodyPr wrap="square" anchor="ctr" lIns="0" tIns="0" rIns="0" bIns="0"><a:noAutofit/></a:bodyPr><a:lstStyle/><a:p><a:pPr algn="${align}"/>${runsXml}</a:p></p:txBody>
</p:sp>`;
}

export interface RenderedBarChart {
  bodyXml: string;
  shapeIds: number[];
}

export function renderPattern9BarChart(rawSpec: unknown, slideNumber: number): RenderedBarChart {
  const spec: Pattern9BarChartSpec = Pattern9BarChartSpecSchema.parse(rawSpec);
  const ids = new ShapeIdAllocator(slideNumber);
  const allIds: number[] = [];
  const parts: string[] = [];

  const maxValue = Math.max(...spec.bars.map((b) => b.value));
  if (maxValue <= 0) throw new Error("P9 requires at least one bar with value > 0");

  spec.bars.forEach((bar, i) => {
    const y = BAR_Y0 + i * BAR_STEP_Y;
    const cx = Math.round((bar.value / maxValue) * BAR_MAX_CX);
    const accent = bar.accentColorHex ?? categoricalColor(i);

    const labelId = ids.alloc();
    const barId = ids.alloc();
    const valId = ids.alloc();
    allIds.push(labelId, barId, valId);

    parts.push(
      textBox({
        shapeId: labelId,
        name: `BarLbl${i + 1}`,
        rect: { x: LABEL_RECT.x, y, cx: LABEL_RECT.cx, cy: BAR_CY },
        runs: [{ text: bar.label, sz: 1100, b: true, colorHex: BRAND.navyDam }],
        align: "r",
      })
    );
    parts.push(renderRect({ shapeId: barId, name: `Bar${i + 1}`, rect: { x: BAR_X, y, cx, cy: BAR_CY }, fillHex: accent }));
    parts.push(
      textBox({
        shapeId: valId,
        name: `BarVal${i + 1}`,
        rect: { x: BAR_X + cx + 91440, y, cx: 900000, cy: BAR_CY },
        runs: [{ text: bar.valueLabel ?? String(bar.value), sz: 1100, b: true, colorHex: BRAND.navyDam }],
      })
    );
  });

  if (spec.unitNote) {
    const noteId = ids.alloc();
    allIds.push(noteId);
    parts.push(
      textBox({
        shapeId: noteId,
        name: "UnitNote",
        rect: { x: BAR_X, y: BAR_Y0 + spec.bars.length * BAR_STEP_Y, cx: 6000000, cy: 300000 },
        runs: [{ text: spec.unitNote, sz: 900, colorHex: BRAND.gray }],
      })
    );
  }

  return { bodyXml: parts.join("\n"), shapeIds: allIds };
}

export const __internalP9 = { BAR_X, BAR_Y0, BAR_STEP_Y, BAR_CY, BAR_MAX_CX, LABEL_RECT };

