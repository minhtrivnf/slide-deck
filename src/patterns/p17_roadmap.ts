/**
 * patterns/p17_roadmap.ts
 *
 * Renders Pattern 17 (Roadmap / Gantt Timeline): quarter header row →
 * workstream rows with rounded bars spanning quarters + amber milestone
 * diamonds + optional dashed red TODAY line.
 *
 * Geometry from slide_patterns.md P17: header (2200000, 1620000,
 * 6500000 × 360000); label col x=230400 cx=1900000; plot y=2160000, row
 * cy=800000; bar cy=432000 (roundRect adj=25000); quarter col uniform
 * (doc's 8-quarter case = 812500); milestone diamond 252000; bar colors
 * rotate through the categorical palette.
 */

import { ShapeIdAllocator } from "../ids.js";
import { renderConnector } from "../geometry/connectors.js";
import { BRAND, categoricalColor } from "../palette.js";
import { fitLabel, pxForEmu } from "../units.js";
import { escapeXmlText } from "../xml.js";
import { renderRect, type Rect } from "../templates/common.js";
import { Pattern17RoadmapSpecSchema, type Pattern17RoadmapSpec } from "../types.js";

const HEADER_Y = 1620000;
const HEADER_CY = 360000;
const PLOT_X = 2200000;
const PLOT_CX = 6500000;
const PLOT_Y = 2160000;
const ROW_CY = 800000;
const BAR_CY = 432000;
const BAR_INSET_X = 45720;
const LABEL_X = 230400;
const LABEL_CX = 1900000;
const MILESTONE_D = 252000;

export interface RenderedRoadmap {
  bodyXml: string;
  shapeIds: number[];
}

function textBox(params: {
  shapeId: number;
  name: string;
  rect: Rect;
  text: string;
  sz: number;
  colorHex: string;
  bold?: boolean;
  align?: "l" | "r" | "ctr";
  fillHex?: string;
}): string {
  const { shapeId, name, rect, text, sz, colorHex, bold = false, align = "l", fillHex } = params;
  const fill = fillHex ? `<a:solidFill><a:srgbClr val="${fillHex}"/></a:solidFill>` : "<a:noFill/>";
  return `<p:sp>
  <p:nvSpPr><p:cNvPr id="${shapeId}" name="${name}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${rect.x}" y="${rect.y}"/><a:ext cx="${rect.cx}" cy="${rect.cy}"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${fill}
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" anchor="ctr" lIns="91440" tIns="0" rIns="91440" bIns="0"><a:noAutofit/></a:bodyPr>
    <a:lstStyle/>
    <a:p><a:pPr algn="${align}"/><a:r><a:rPr lang="en-US" sz="${sz}"${bold ? ` b="1"` : ""} dirty="0"><a:solidFill><a:srgbClr val="${colorHex}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${escapeXmlText(text)}</a:t></a:r></a:p>
  </p:txBody>
</p:sp>`;
}

export function renderPattern17Roadmap(rawSpec: unknown, slideNumber: number): RenderedRoadmap {
  const spec: Pattern17RoadmapSpec = Pattern17RoadmapSpecSchema.parse(rawSpec);
  const nQ = spec.quarters.length;
  const colCx = Math.floor(PLOT_CX / nQ);

  spec.workstreams.forEach((ws, i) => {
    ws.bars.forEach((b, k) => {
      if (b.fromQ > b.toQ || b.toQ >= nQ) {
        throw new Error(`P17 workstream ${i} ("${ws.name}") bar ${k}: invalid range [${b.fromQ}..${b.toQ}] for ${nQ} quarters`);
      }
    });
    ws.milestones.forEach((m, k) => {
      if (m.atQ >= nQ) throw new Error(`P17 workstream ${i} milestone ${k}: atQ=${m.atQ} out of ${nQ} quarters`);
    });
  });
  if (spec.todayQ !== undefined && spec.todayQ > nQ) {
    throw new Error(`P17 todayQ=${spec.todayQ} out of ${nQ} quarters`);
  }

  const ids = new ShapeIdAllocator(slideNumber);
  const allIds: number[] = [];
  const parts: string[] = [];
  const push = (xml: string, ...newIds: number[]): void => {
    parts.push(xml);
    allIds.push(...newIds);
  };

  // Quarter header cells
   spec.quarters.forEach((q, i) => {
      const id = ids.alloc();
      const qFit = fitLabel(q, pxForEmu(colCx - 91440), [11, 10, 9]);
      push(
        textBox({
          shapeId: id,
          name: `QHead${i + 1}`,
          rect: { x: PLOT_X + i * colCx, y: HEADER_Y, cx: colCx, cy: HEADER_CY },
          text: qFit.text,
          sz: qFit.fontSizePt * 100,
          colorHex: BRAND.navyDam,
          bold: true,
          align: "ctr",
          fillHex: "F2F2F2",
        }),
        id
      );
    });

  // Light vertical gridlines per quarter boundary
  for (let i = 1; i < nQ; i++) {
    const id = ids.alloc();
    push(
      renderConnector({
        connectorShapeId: id,
        name: `QGrid${i}`,
        from: { x: PLOT_X + i * colCx, y: PLOT_Y },
        to: { x: PLOT_X + i * colCx, y: PLOT_Y + spec.workstreams.length * ROW_CY },
        colorHex: "F2F2F2",
        weightEmu: 6350,
      }),
      id
    );
  }

  spec.workstreams.forEach((ws, i) => {
    const rowY = PLOT_Y + i * ROW_CY;
    const color = categoricalColor(i);

    const lblId = ids.alloc();
    const lblFit = fitLabel(ws.name, pxForEmu(LABEL_CX - 91440), [11, 10, 9]);
    push(
      textBox({
        shapeId: lblId,
        name: `WsLbl${i + 1}`,
        rect: { x: LABEL_X, y: rowY, cx: LABEL_CX, cy: ROW_CY },
        text: lblFit.text,
        sz: lblFit.fontSizePt * 100,
        colorHex: BRAND.navyDam,
        bold: true,
      }),
      lblId
    );

    ws.bars.forEach((bar, k) => {
      const barId = ids.alloc();
      const barRect: Rect = {
        x: PLOT_X + bar.fromQ * colCx + BAR_INSET_X,
        y: rowY + (ROW_CY - BAR_CY) / 2,
        cx: (bar.toQ - bar.fromQ + 1) * colCx - 2 * BAR_INSET_X,
        cy: BAR_CY,
      };
      const barLabelFit = bar.label
        ? fitLabel(bar.label, pxForEmu(barRect.cx - 182880), [10, 9, 8])
        : null;
      const labelXml = barLabelFit
        ? `<p:txBody><a:bodyPr wrap="square" anchor="ctr" lIns="91440" tIns="0" rIns="91440" bIns="0"/><a:lstStyle/><a:p><a:pPr algn="l"/><a:r><a:rPr lang="en-US" sz="${barLabelFit.fontSizePt * 100}" b="1" dirty="0"><a:solidFill><a:srgbClr val="${BRAND.white}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${escapeXmlText(barLabelFit.text)}</a:t></a:r></a:p></p:txBody>`
        : `<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody>`;
      push(
        `<p:sp>
  <p:nvSpPr><p:cNvPr id="${barId}" name="WsBar${i + 1}_${k + 1}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${barRect.x}" y="${barRect.y}"/><a:ext cx="${barRect.cx}" cy="${barRect.cy}"/></a:xfrm>
    <a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 25000"/></a:avLst></a:prstGeom>
    <a:solidFill><a:srgbClr val="${color}"/></a:solidFill>
    <a:ln><a:noFill/></a:ln>
  </p:spPr>
  ${labelXml}
</p:sp>`,
        barId
      );
    });

    ws.milestones.forEach((m, k) => {
      const msId = ids.alloc();
      const x = Math.round(PLOT_X + (m.atQ + (m.frac ?? 0)) * colCx - MILESTONE_D / 2);
      push(
        `<p:sp>
  <p:nvSpPr><p:cNvPr id="${msId}" name="Ms${i + 1}_${k + 1}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${x}" y="${rowY + (ROW_CY - MILESTONE_D) / 2}"/><a:ext cx="${MILESTONE_D}" cy="${MILESTONE_D}"/></a:xfrm>
    <a:prstGeom prst="diamond"><a:avLst/></a:prstGeom>
    <a:solidFill><a:srgbClr val="${BRAND.vangHoPhach}"/></a:solidFill>
    <a:ln w="9525"><a:solidFill><a:srgbClr val="${BRAND.navyDam}"/></a:solidFill></a:ln>
  </p:spPr>
  <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody>
</p:sp>`,
        msId
      );
       if (m.label) {
         const msLblId = ids.alloc();
         const msLblFit = fitLabel(m.label, pxForEmu(MILESTONE_D + 482400 - 91440), [9, 8, 7]);
         push(
           textBox({
             shapeId: msLblId,
             name: `MsLbl${i + 1}_${k + 1}`,
             rect: { x: x - 241200, y: rowY + (ROW_CY - MILESTONE_D) / 2 + MILESTONE_D, cx: MILESTONE_D + 482400, cy: 216000 },
             text: msLblFit.text,
             sz: msLblFit.fontSizePt * 100,
             colorHex: BRAND.subtleBody,
             align: "ctr",
           }),
           msLblId
         );
       }
    });
  });

  // Optional TODAY line at the START of quarter todayQ
  if (spec.todayQ !== undefined) {
    const id = ids.alloc();
    push(
      renderConnector({
        connectorShapeId: id,
        name: "TodayLine",
        from: { x: PLOT_X + spec.todayQ * colCx, y: PLOT_Y },
        to: { x: PLOT_X + spec.todayQ * colCx, y: PLOT_Y + spec.workstreams.length * ROW_CY },
        colorHex: BRAND.doCritical,
        weightEmu: 12700,
        dash: "dash",
      }),
      id
    );
  }

  return { bodyXml: parts.join("\n"), shapeIds: allIds };
}

export const __internalP17 = { HEADER_Y, HEADER_CY, PLOT_X, PLOT_CX, PLOT_Y, ROW_CY, BAR_CY, MILESTONE_D };

