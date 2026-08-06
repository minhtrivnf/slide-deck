/**
 * patterns/p24_build.ts
 *
 * Renders Pattern 24 (Build / Sequential Reveal): 3–5 stage tiles in a
 * fixed horizontal row; the focused stage is navy + white text, revealed
 * stages are F2F2F2 + gray, future stages are white-outline (state matrix
 * from slide_templates.md P24). A detail panel below describes only the
 * focused stage.
 *
 * Geometry from slide_patterns.md P24: stage ys 2160000, cy=1800000;
 * xs 457200/2200000/3942800/5685600/7428400 (cx 1630000, last 1715000);
 * detail panel (457200, 4140000, 8229600 × 1800000).
 */

import { ShapeIdAllocator } from "../ids.js";
import { BRAND } from "../palette.js";
import { fitLabel, pxForEmu } from "../units.js";
import { escapeXmlText } from "../xml.js";
import { renderRect, renderHeadingBulletsBox, type Rect } from "../templates/common.js";
import { Pattern24BuildSpecSchema, type Pattern24BuildSpec } from "../types.js";

const STAGE_XS = [457200, 2200000, 3942800, 5685600, 7428400] as const;
const STAGE_CXS = [1630000, 1630000, 1630000, 1630000, 1715000] as const;
const STAGE_Y = 2160000;
const STAGE_CY = 1800000;
const PANEL_RECT: Rect = { x: 457200, y: 4140000, cx: 8229600, cy: 1800000 };

export interface RenderedBuild {
  bodyXml: string;
  shapeIds: number[];
}

type StageState = { fillHex: string; borderHex: string; textHex: string };
const STATE: Record<"focus" | "past" | "future", StageState> = {
  focus: { fillHex: BRAND.navyDam, borderHex: BRAND.navyDam, textHex: BRAND.white },
  past: { fillHex: "F2F2F2", borderHex: BRAND.lightGrayRule, textHex: BRAND.gray },
  future: { fillHex: BRAND.white, borderHex: BRAND.lightGrayRule, textHex: BRAND.lightGrayRule },
};

export function renderPattern24Build(rawSpec: unknown, slideNumber: number): RenderedBuild {
  const spec: Pattern24BuildSpec = Pattern24BuildSpecSchema.parse(rawSpec);
  if (spec.focusIndex >= spec.stages.length) {
    throw new Error(`P24 focusIndex=${spec.focusIndex} out of range for ${spec.stages.length} stages`);
  }
  if (spec.stages.length > STAGE_XS.length) {
    throw new Error(`P24 supports at most ${STAGE_XS.length} stages, got ${spec.stages.length}`);
  }

  const ids = new ShapeIdAllocator(slideNumber);
  const allIds: number[] = [];
  const parts: string[] = [];

  spec.stages.forEach((name, i) => {
    const state = i < spec.focusIndex ? STATE.past : i === spec.focusIndex ? STATE.focus : STATE.future;
    const rect: Rect = { x: STAGE_XS[i], y: STAGE_Y, cx: STAGE_CXS[i], cy: STAGE_CY };
    const tileId = ids.alloc();
    const textId = ids.alloc();
    allIds.push(tileId, textId);
    parts.push(
      renderRect({
        shapeId: tileId,
        name: `BuildStage${i + 1}`,
        rect,
        fillHex: state.fillHex,
        borderHex: state.borderHex,
        roundedCornerAdj: 6000,
      })
    );
    const stepFit = fitLabel(`STEP ${i + 1}`, pxForEmu(rect.cx - 182880), [10, 9, 8]);
    const nameFit = fitLabel(name, pxForEmu(rect.cx - 182880), [14, 12, 11, 10]);
    parts.push(`<p:sp>
  <p:nvSpPr><p:cNvPr id="${textId}" name="BuildStageText${i + 1}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${rect.x}" y="${rect.y}"/><a:ext cx="${rect.cx}" cy="${rect.cy}"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" anchor="ctr" lIns="91440" tIns="45720" rIns="91440" bIns="45720"/>
    <a:lstStyle/>
     <a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" sz="${stepFit.fontSizePt * 100}" b="1" spc="200" dirty="0"><a:solidFill><a:srgbClr val="${state.textHex}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${escapeXmlText(stepFit.text)}</a:t></a:r></a:p>
    <a:p><a:pPr algn="ctr"><a:spcBef><a:spcPts val="300"/></a:spcBef></a:pPr><a:r><a:rPr lang="en-US" sz="${nameFit.fontSizePt * 100}" b="1" dirty="0"><a:solidFill><a:srgbClr val="${state.textHex}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${escapeXmlText(nameFit.text)}</a:t></a:r></a:p>
  </p:txBody>
</p:sp>`);
  });

  // Detail panel for the focused stage
  const panelId = ids.alloc();
  allIds.push(panelId);
  parts.push(
    renderRect({
      shapeId: panelId,
      name: "BuildPanel",
      rect: PANEL_RECT,
      fillHex: "F7F8FA",
      borderHex: BRAND.navyDam,
      borderWeightEmu: 12700,
      roundedCornerAdj: 3000,
    })
  );
  const panelTextId = ids.alloc();
  allIds.push(panelTextId);
  parts.push(
    renderHeadingBulletsBox({
      shapeId: panelTextId,
      name: "BuildPanelText",
      rect: {
        x: PANEL_RECT.x + 228600,
        y: PANEL_RECT.y + 171450,
        cx: PANEL_RECT.cx - 2 * 228600,
        cy: PANEL_RECT.cy - 2 * 171450,
      },
      heading: `STEP ${spec.focusIndex + 1} — ${spec.detail.heading.toUpperCase()}`,
      headingFontSizePt: 13,
      headingColorHex: BRAND.navyDam,
      bullets: spec.detail.bullets.map((text) => ({ text })),
    })
  );

  return { bodyXml: parts.join("\n"), shapeIds: allIds };
}

export const __internalP24 = { STAGE_XS, STAGE_CXS, STAGE_Y, STAGE_CY, PANEL_RECT, STATE };

