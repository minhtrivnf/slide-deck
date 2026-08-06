/**
 * patterns/p10_exec_summary.ts
 *
 * Renders Pattern 10 (Executive Summary — Action Title + 3 Pillars).
 * Geometry from slide_patterns.md Pattern 10 (v2.2: pillars y=1224000,
 * badge y=1368000) cross-checked against the offsets implied by
 * slide_templates.md's Pillar Card example (badge/text inset from the
 * card's own x/y by a constant, applied here relative to the v2.2 y).
 */


import { ShapeIdAllocator } from "../ids.js";
import { BRAND } from "../palette.js";
import { fitTitle, resolveActionTitleFit } from "../units.js";
import { escapeXmlText } from "../xml.js";
import { renderEllipseBadge, renderHeadingBulletsBox, renderRect, renderTaglineBox, StyledBullet } from "../templates/common.js";
import { Pattern10ExecSummarySpecSchema, type Pattern10ExecSummarySpec } from "../types.js";

const ACTION_TITLE_RECT = { x: 230400, y: 0, cx: 8683200, cy: 1080000 };
const PILLAR_XS = [457200, 3327400, 6197600] as const;
const PILLAR_Y = 1224000;
const PILLAR_CX = 2641600;
const PILLAR_CY = 4176000;
// Offsets transcribed from slide_templates.md Pillar Card (badge x=660400 vs
// card x=457200 -> +203200; badge y=1764000 vs card y=1620000 -> +144000).
const BADGE_OFFSET = { x: 203200, y: 144000, cx: 432000, cy: 432000 };
const TEXT_OFFSET_X = 203200;
const TEXT_OFFSET_Y = 684000;
const TEXT_BOTTOM_GAP = 144000;

export interface RenderedExecSummary {
  bodyXml: string;
  shapeIds: number[];
}

export function renderPattern10ExecSummary(rawSpec: unknown, slideNumber: number): RenderedExecSummary {
  const spec: Pattern10ExecSummarySpec = Pattern10ExecSummarySpecSchema.parse(rawSpec);
  // Never abort the deck on an over-wide action title: trim it to one line.
  const actionTitle = fitTitle(spec.actionTitle);
  const fit = resolveActionTitleFit(actionTitle);

  const ids = new ShapeIdAllocator(slideNumber);
  const allIds: number[] = [];
  const parts: string[] = [];

  const titleId = ids.alloc();
  allIds.push(titleId);
  parts.push(`<p:sp>
  <p:nvSpPr><p:cNvPr id="${titleId}" name="ActionTitle"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${ACTION_TITLE_RECT.x}" y="${ACTION_TITLE_RECT.y}"/><a:ext cx="${ACTION_TITLE_RECT.cx}" cy="${ACTION_TITLE_RECT.cy}"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
    <a:noFill/>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" anchor="ctr" lIns="0" tIns="0" rIns="0" bIns="0"><a:noAutofit/></a:bodyPr>
    <a:lstStyle/>
    <a:p>
      <a:pPr algn="l"/>
      <a:r><a:rPr lang="en-US" sz="${(fit.ok ? fit.fontSizePt : 20) * 100}" b="1" dirty="0">
        <a:solidFill><a:srgbClr val="${BRAND.navyDam}"/></a:solidFill>
        <a:latin typeface="Calibri"/>
      </a:rPr><a:t>${escapeXmlText(actionTitle)}</a:t></a:r>
    </a:p>
  </p:txBody>
</p:sp>`);

  spec.pillars.forEach((pillar, i) => {
    const x = PILLAR_XS[i];
    const cardId = ids.alloc();
    const badgeId = ids.alloc();
    const textId = ids.alloc();
    allIds.push(cardId, badgeId, textId);

    parts.push(
      renderRect({
        shapeId: cardId,
        name: `Pillar${i + 1}`,
        rect: { x, y: PILLAR_Y, cx: PILLAR_CX, cy: PILLAR_CY },
        fillHex: BRAND.white,
        borderHex: BRAND.lightGrayRule,
        roundedCornerAdj: 4500,
      })
    );
    parts.push(
      renderEllipseBadge({
        shapeId: badgeId,
        name: `PillarBadge${i + 1}`,
        rect: { x: x + BADGE_OFFSET.x, y: PILLAR_Y + BADGE_OFFSET.y, cx: BADGE_OFFSET.cx, cy: BADGE_OFFSET.cy },
        text: String(i + 1),
        fillHex: BRAND.navyDam,
      })
    );
    const bullets: StyledBullet[] = pillar.bullets.map((text) => ({ text }));
    parts.push(
      renderHeadingBulletsBox({
        shapeId: textId,
        name: `PillarText${i + 1}`,
        rect: {
          x: x + TEXT_OFFSET_X,
          y: PILLAR_Y + TEXT_OFFSET_Y,
          cx: PILLAR_CX - 2 * TEXT_OFFSET_X,
          cy: PILLAR_CY - TEXT_OFFSET_Y - TEXT_BOTTOM_GAP,
        },
        heading: pillar.heading,
        bullets,
      })
    );
  });

  const boxId = ids.alloc();
  const textId = ids.alloc();
  allIds.push(boxId, textId);
  parts.push(
    renderTaglineBox({
      boxShapeId: boxId,
      textShapeId: textId,
      text: spec.takeaway,
      prefix: spec.takeawayPrefix,
    })
  );

  return { bodyXml: parts.join("\n"), shapeIds: allIds };
}

export const __internalP10 = { ACTION_TITLE_RECT, PILLAR_XS, PILLAR_Y, PILLAR_CX, PILLAR_CY, BADGE_OFFSET };
