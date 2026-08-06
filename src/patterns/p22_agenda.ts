/**
 * patterns/p22_agenda.ts
 *
 * Renders Pattern 22 (Agenda / Table of Contents). Row/badge geometry
 * follows slide_templates.md "Agenda Row (Pattern 22)" (row + badge +
 * combined title/page text box), row-y stepping follows slide_patterns.md
 * ("Item rows: y=1620000 + N × 720000").
 */

import { ShapeIdAllocator } from "../ids.js";
import { BRAND } from "../palette.js";
import { escapeXmlText } from "../xml.js";
import { renderRect, renderEllipseBadge } from "../templates/common.js";

import { Pattern22AgendaSpecSchema, type Pattern22AgendaSpec } from "../types.js";

const TITLE_RECT = { x: 230400, y: 0, cx: 8683200, cy: 720000 };
const ROW_X_LEFT = 500000;
const ROW_X_RIGHT = 4600000;
const ROW_Y_BASE = 1620000;
const ROW_STEP = 720000;
const ROW_CX = 3800000;
const ROW_CY = 600000;
const BADGE_OFFSET = { x: 80000, y: 84000, cx: 432000, cy: 432000 };
const TEXT_X_OFFSET = 620000;
const TEXT_CX = 3100000;
const ROW_FILL_ALT = ["FFFFFF", "F5F5FF"];
const ROW_FILL_HIGHLIGHT = "D6F1FC";

export interface RenderedAgenda {
  bodyXml: string;
  shapeIds: number[];
}

export function renderPattern22Agenda(rawSpec: unknown, slideNumber: number): RenderedAgenda {
  const spec: Pattern22AgendaSpec = Pattern22AgendaSpecSchema.parse(rawSpec);
  const ids = new ShapeIdAllocator(slideNumber);
  const allIds: number[] = [];
  const parts: string[] = [];

  const titleId = ids.alloc();
  allIds.push(titleId);
  parts.push(`<p:sp>
  <p:nvSpPr><p:cNvPr id="${titleId}" name="AgendaTitle"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${TITLE_RECT.x}" y="${TITLE_RECT.y}"/><a:ext cx="${TITLE_RECT.cx}" cy="${TITLE_RECT.cy}"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
    <a:noFill/>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" anchor="ctr" lIns="0" tIns="0" rIns="0" bIns="0"/>
    <a:lstStyle/>
    <a:p>
      <a:pPr algn="l"/>
      <a:r><a:rPr lang="en-US" sz="2400" b="1" dirty="0">
        <a:solidFill><a:srgbClr val="${BRAND.navyDam}"/></a:solidFill>
        <a:latin typeface="Calibri"/>
      </a:rPr><a:t>AGENDA</a:t></a:r>
    </a:p>
  </p:txBody>
</p:sp>`);

  spec.items.forEach((item, i) => {
    // Determine if 2-column layout (when > 5 items)
    const use2Cols = spec.items.length > 5;
    let rowX: number, textX: number, rowY: number;
    
    if (use2Cols) {
      const itemsPerCol = Math.ceil(spec.items.length / 2);
      const isRightCol = i >= itemsPerCol;
      const indexInCol = isRightCol ? i - itemsPerCol : i;
      rowX = isRightCol ? ROW_X_RIGHT : ROW_X_LEFT;
      textX = rowX + TEXT_X_OFFSET;
      rowY = ROW_Y_BASE + indexInCol * ROW_STEP;
    } else {
      // Single column (original layout, centered)
      rowX = 1000000;
      textX = 1620000;
      rowY = ROW_Y_BASE + i * ROW_STEP;
    }
    
    const rowId = ids.alloc();
    const badgeId = ids.alloc();
    const textId = ids.alloc();
    allIds.push(rowId, badgeId, textId);

    const fill = item.highlighted ? ROW_FILL_HIGHLIGHT : ROW_FILL_ALT[i % 2];
    parts.push(
      renderRect({
        shapeId: rowId,
        name: `AgendaRow${i + 1}`,
        rect: { x: rowX, y: rowY, cx: ROW_CX, cy: ROW_CY },
        fillHex: fill,
      })
    );
    parts.push(
      renderEllipseBadge({
        shapeId: badgeId,
        name: `AgendaNum${i + 1}`,
        rect: {
          x: rowX + BADGE_OFFSET.x,
          y: rowY + BADGE_OFFSET.y,
          cx: BADGE_OFFSET.cx,
          cy: BADGE_OFFSET.cy,
        },
        text: String(i + 1),
        fillHex: BRAND.navyDam,
      })
    );

    const bold = item.highlighted ? 1 : 0;
    const pageRun = item.page !== undefined
      ? `<a:r><a:rPr lang="en-US" sz="1100" i="1" dirty="0"><a:solidFill><a:srgbClr val="${BRAND.gray}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>     p. ${escapeXmlText(String(item.page))}</a:t></a:r>`
      : "";
    parts.push(`<p:sp>
  <p:nvSpPr><p:cNvPr id="${textId}" name="AgendaTxt${i + 1}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${textX}" y="${rowY}"/><a:ext cx="${TEXT_CX}" cy="${ROW_CY}"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
    <a:noFill/>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" anchor="ctr" lIns="91440" tIns="0" rIns="91440" bIns="0"/>
    <a:lstStyle/>
    <a:p>
      <a:pPr algn="l"/>
      <a:r><a:rPr lang="en-US" sz="1600" b="${bold}" dirty="0">
        <a:solidFill><a:srgbClr val="${BRAND.navyDam}"/></a:solidFill>
        <a:latin typeface="Calibri"/>
      </a:rPr><a:t>${escapeXmlText(item.title)}</a:t></a:r>
      ${pageRun}
    </a:p>
  </p:txBody>
</p:sp>`);
  });

  return { bodyXml: parts.join("\n"), shapeIds: allIds };
}

export const __internalP22 = { TITLE_RECT, ROW_X_LEFT, ROW_X_RIGHT, ROW_Y_BASE, ROW_STEP, ROW_CX, ROW_CY, BADGE_OFFSET };
