/**
 * patterns/p15_heatmap.ts
 *
 * Renders Pattern 15 (Heat Map / Risk Matrix): N×M colored grid with
 * axis titles + tick labels. Geometry from slide_patterns.md P15: plot
 * (1500000, 1620000, 6500000 × 4200000); doc's 5×5 cell 1300000×840000
 * is the uniform split for 5×5 — other grids split the same plot area.
 *
 * DEVIATION FROM DOC (justified): Y tick area widened from (x=1100000,
 * cx=360000) to (x=400000, cx=1060000) — Vietnamese tick labels like
 * "Rất cao" wrapped ugly inside the doc's narrow strip. Box ends at
 * 1460000, still left of the grid (1500000).
 *
 * Fills: "sequential" palette via SEQUENTIAL_5 (+ text via
 * textColorForSequentialStep); "risk" palette via the green→red diverging
 * ramp (riskColorForStep + textColorForDivergingStep). Cell border white
 * 0.5pt per slide_templates.md.
 */

import { ShapeIdAllocator } from "../ids.js";
import {
  BRAND,
  SEQUENTIAL_5,
  riskColorForStep,
  textColorForDivergingStep,
  textColorForSequentialStep,
} from "../palette.js";
import { escapeXmlText } from "../xml.js";
import { Pattern15HeatMapSpecSchema, type Pattern15HeatMapSpec } from "../types.js";

const GRID_X = 1500000;
const GRID_Y = 1620000;
const GRID_CX = 6500000;
const GRID_CY = 4200000;
const Y_TICK = { x: 400000, cx: 1060000 };
const X_TICK_Y = 5760000;
const X_TICK_CY = 180000;
const AXIS_LABEL_Y = 5940000;

export interface RenderedHeatMap {
  bodyXml: string;
  shapeIds: number[];
}

function cellFill(spec: Pattern15HeatMapSpec, step: number): string {
  return spec.palette === "risk" ? riskColorForStep(step) : SEQUENTIAL_5[step - 1];
}

function cellTextColor(spec: Pattern15HeatMapSpec, step: number): string {
  return spec.palette === "risk" ? textColorForDivergingStep(step) : textColorForSequentialStep(step);
}

export function renderPattern15HeatMap(rawSpec: unknown, slideNumber: number): RenderedHeatMap {
  const spec: Pattern15HeatMapSpec = Pattern15HeatMapSpecSchema.parse(rawSpec);
  const nRows = spec.yTicks.length;
  const nCols = spec.xTicks.length;
  const cellCx = Math.floor(GRID_CX / nCols);
  const cellCy = Math.floor(GRID_CY / nRows);

  spec.cells.forEach((c, i) => {
    if (c.row >= nRows || c.col >= nCols) {
      throw new Error(`P15 cell ${i} (${c.row},${c.col}) out of grid bounds ${nRows}×${nCols}`);
    }
  });

  const ids = new ShapeIdAllocator(slideNumber);
  const allIds: number[] = [];
  const parts: string[] = [];
  const smallText = (
    id: number,
    name: string,
    rect: { x: number; y: number; cx: number; cy: number },
    text: string,
    opts: { bold?: boolean; anchor?: "t" | "ctr"; align?: "l" | "ctr" | "r"; sz?: number; colorHex?: string } = {}
  ): string => {
    const { bold = false, anchor = "ctr", align = "ctr", sz = 1000, colorHex = BRAND.subtleBody } = opts;
    return `<p:sp>
  <p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${rect.x}" y="${rect.y}"/><a:ext cx="${rect.cx}" cy="${rect.cy}"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" anchor="${anchor}" lIns="0" tIns="0" rIns="0" bIns="0"><a:noAutofit/></a:bodyPr>
    <a:lstStyle/>
    <a:p><a:pPr algn="${align}"/><a:r><a:rPr lang="en-US" sz="${sz}"${bold ? ` b="1"` : ""} dirty="0"><a:solidFill><a:srgbClr val="${colorHex}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${escapeXmlText(text)}</a:t></a:r></a:p>
  </p:txBody>
</p:sp>`;
  };

  // Cells (sparse — unspecified cells are left empty/white)
  spec.cells.forEach((c, i) => {
    const id = ids.alloc();
    allIds.push(id);
    parts.push(`<p:sp>
  <p:nvSpPr><p:cNvPr id="${id}" name="HeatCell${i + 1}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${GRID_X + c.col * cellCx}" y="${GRID_Y + c.row * cellCy}"/><a:ext cx="${cellCx}" cy="${cellCy}"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
    <a:solidFill><a:srgbClr val="${cellFill(spec, c.step)}"/></a:solidFill>
    <a:ln w="6350"><a:solidFill><a:srgbClr val="${BRAND.white}"/></a:solidFill></a:ln>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" anchor="ctr"/><a:lstStyle/>
    <a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" sz="1100" b="1" dirty="0"><a:solidFill><a:srgbClr val="${cellTextColor(spec, c.step)}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${escapeXmlText(c.label ?? "")}</a:t></a:r></a:p>
  </p:txBody>
</p:sp>`);
  });

  // Tick labels
  spec.yTicks.forEach((t, r) => {
    const id = ids.alloc();
    allIds.push(id);
    parts.push(smallText(id, `YTick${r + 1}`, { x: Y_TICK.x, y: GRID_Y + r * cellCy, cx: Y_TICK.cx, cy: cellCy }, t, { align: "r", sz: 1000 }));
  });
  spec.xTicks.forEach((t, c) => {
    const id = ids.alloc();
    allIds.push(id);
    parts.push(smallText(id, `XTick${c + 1}`, { x: GRID_X + c * cellCx, y: X_TICK_Y, cx: cellCx, cy: X_TICK_CY }, t, { sz: 900 }));
  });

  // Axis labels
  if (spec.xAxisLabel) {
    const id = ids.alloc();
    allIds.push(id);
    parts.push(smallText(id, "XAxisLabel", { x: GRID_X, y: AXIS_LABEL_Y, cx: GRID_CX, cy: 252000 }, spec.xAxisLabel, { bold: true, sz: 1100, colorHex: BRAND.navyDam }));
  }
  if (spec.yAxisLabel) {
    const id = ids.alloc();
    allIds.push(id);
    // Doc's Y-axis label box: (230400, 3060000, 1100000 × 1320000) — plain
    // horizontal text, centered, vertically centered on the grid.
    parts.push(
      smallText(id, "YAxisLabel", { x: 230400, y: 3060000, cx: 1100000, cy: 1320000 }, spec.yAxisLabel, {
        bold: true,
        sz: 1100,
        colorHex: BRAND.navyDam,
        align: "l",
      })
    );
  }

  return { bodyXml: parts.join("\n"), shapeIds: allIds };
}

export const __internalP15 = { GRID_X, GRID_Y, GRID_CX, GRID_CY, Y_TICK, X_TICK_Y };

