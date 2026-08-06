/**
 * patterns/p4_process.ts
 *
 * Renders Pattern 4 (Process Flow / Timeline).
 *
 * DEVIATION FROM DOC (justified): slide_patterns.md P4's own xs
 * (…7657200 + cx=1800000 = 9457200) overflow the 9144000-EMU canvas —
 * step 4 gets clipped by the slide edge. Compressed to fit the content
 * span 457200..8686800 while keeping the doc's step:arrow proportions:
 * step cx=1750000, stride 2150000 (step 1750000 + arrow 400000).
 *
 * Steps are numbered cards (badge + name + description); arrows are
 * `rightArrow` preset shapes in light gray between consecutive steps.
 */

import { ShapeIdAllocator } from "../ids.js";
import { BRAND } from "../palette.js";
import { escapeXmlText } from "../xml.js";
import { renderEllipseBadge, renderRect, type Rect } from "../templates/common.js";
import { Pattern4ProcessFlowSpecSchema, type Pattern4ProcessFlowSpec } from "../types.js";

const STEP_XS = [457200, 2607200, 4757200, 6907200] as const;
const STEP_CX = 1750000;
const ARROW_CX = 400000;
const ARROW_XS = STEP_XS.slice(0, -1).map((x) => x + STEP_CX) as unknown as readonly number[];
const STEP_Y = 2000000;
const STEP_CY = 2500000;
const ARROW_CY = 240000;
const BADGE_OFFSET = { x: 228600, y: 228600, d: 432000 };
const TEXT_OFFSET = { x: 228600, y: 800000 };

export interface RenderedProcessFlow {
  bodyXml: string;
  shapeIds: number[];
}

export function renderPattern4ProcessFlow(rawSpec: unknown, slideNumber: number): RenderedProcessFlow {
  const spec: Pattern4ProcessFlowSpec = Pattern4ProcessFlowSpecSchema.parse(rawSpec);
  if (spec.steps.length > STEP_XS.length) {
    throw new Error(`P4 supports at most ${STEP_XS.length} steps (fixed geometry), got ${spec.steps.length}`);
  }

  const ids = new ShapeIdAllocator(slideNumber);
  const allIds: number[] = [];
  const parts: string[] = [];

  spec.steps.forEach((step, i) => {
    const x = STEP_XS[i];
    const cardId = ids.alloc();
    const badgeId = ids.alloc();
    const textId = ids.alloc();
    allIds.push(cardId, badgeId, textId);

    parts.push(
      renderRect({
        shapeId: cardId,
        name: `StepCard${i + 1}`,
        rect: { x, y: STEP_Y, cx: STEP_CX, cy: STEP_CY },
        fillHex: "F7F8FA",
        borderHex: "E5E7EB",
        roundedCornerAdj: 4500,
      })
    );
    parts.push(
      renderEllipseBadge({
        shapeId: badgeId,
        name: `StepBadge${i + 1}`,
        rect: { x: x + BADGE_OFFSET.x, y: STEP_Y + BADGE_OFFSET.y, cx: BADGE_OFFSET.d, cy: BADGE_OFFSET.d },
        text: String(i + 1),
        fillHex: BRAND.navyDam,
      })
    );
    parts.push(`<p:sp>
  <p:nvSpPr><p:cNvPr id="${textId}" name="StepText${i + 1}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${x + TEXT_OFFSET.x}" y="${STEP_Y + TEXT_OFFSET.y}"/><a:ext cx="${STEP_CX - 2 * TEXT_OFFSET.x}" cy="${STEP_CY - TEXT_OFFSET.y - 228600}"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/>
  </p:spPr>
   <p:txBody>
     <a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="t"><a:normAutofit fontScale="100000" lnSpcReduction="0"/></a:bodyPr>
     <a:lstStyle/>
     <a:p><a:pPr algn="l"/><a:r><a:rPr lang="en-US" sz="1300" b="1" dirty="0"><a:solidFill><a:srgbClr val="${BRAND.navyDam}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${escapeXmlText(step.name)}</a:t></a:r></a:p>
     <a:p><a:pPr algn="l"><a:spcBef><a:spcPts val="400"/></a:spcBef></a:pPr><a:r><a:rPr lang="en-US" sz="1100" dirty="0"><a:solidFill><a:srgbClr val="${BRAND.subtleBody}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${escapeXmlText(step.description)}</a:t></a:r></a:p>
   </p:txBody>
</p:sp>`);
  });

  // Arrows between consecutive steps
  spec.steps.slice(0, -1).forEach((_, i) => {
    const id = ids.alloc();
    allIds.push(id);
    const rect: Rect = { x: ARROW_XS[i], y: STEP_Y + STEP_CY / 2 - ARROW_CY / 2, cx: ARROW_CX, cy: ARROW_CY };
    parts.push(`<p:sp>
  <p:nvSpPr><p:cNvPr id="${id}" name="Arrow${i + 1}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${rect.x}" y="${rect.y}"/><a:ext cx="${rect.cx}" cy="${rect.cy}"/></a:xfrm>
    <a:prstGeom prst="rightArrow"><a:avLst/></a:prstGeom>
    <a:solidFill><a:srgbClr val="${BRAND.lightGrayRule}"/></a:solidFill>
    <a:ln><a:noFill/></a:ln>
  </p:spPr>
  <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody>
</p:sp>`);
  });

  return { bodyXml: parts.join("\n"), shapeIds: allIds };
}

export const __internalP4 = { STEP_XS, ARROW_XS, STEP_Y, STEP_CX, STEP_CY };

