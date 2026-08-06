/**
 * patterns/p19_three_horizon.ts
 *
 * Renders Pattern 19 (Three-Horizon Framework, McKinsey).
 *
 * Curves: the doc allows the simplified build — "3 horizontal arrows of
 * differing length stacked at decreasing y" (slide_templates.md P19) —
 * implemented here as `rightArrow` bands in H colors, ascending toward
 * H3. Geo of the bands derives from the doc's y-bands (H1 4400000 /
 * H2 3200000 / H3 2000000).
 *
 * Right panels: fixed y slots (1620000/3060000/4500000), 2700000×1300000,
 * border in horizon color (H1 002060 / H2 0070C0 / H3 953735) per
 * slide_templates.md P19 markup (spc200 heading, theme, • initiatives).
 *
 * DEVIATION: doc's rotated Y-axis label is replaced by a small caption at
 * the plot's top-left (avoids off-canvas negative offsets pre-rotation).
 */

import { ShapeIdAllocator } from "../ids.js";
import { BRAND } from "../palette.js";
import { escapeXmlText } from "../xml.js";
import { renderRect, type Rect } from "../templates/common.js";
import { Pattern19ThreeHorizonSpecSchema, type Pattern19ThreeHorizonSpec } from "../types.js";

const PLOT_X = 230400;
const H_COLORS = [BRAND.navyDam, BRAND.xanhSang, BRAND.doChinh] as const;
const H_BAND_Y = [4400000, 3200000, 2000000] as const;
const H_BAR: Record<number, { x: number; cx: number }> = {
  0: { x: 230400, cx: 2600000 }, // H1 — starts now, short run
  1: { x: 1700000, cx: 3300000 }, // H2 — builds over
  2: { x: 3300000, cx: 2900000 }, // H3 — long option (ends 6200000 < 8700000)
};
const H_BAR_CY = 720000;
const PANEL_X = 6000000;
const PANEL_YS = [1620000, 3060000, 4500000] as const;
const PANEL_CX = 2700000;
const PANEL_CY = 1300000;
const X_LABEL_RECT: Rect = { x: 230400, y: 5940000, cx: 5500000, cy: 252000 };

export interface RenderedThreeHorizon {
  bodyXml: string;
  shapeIds: number[];
}

export function renderPattern19ThreeHorizon(rawSpec: unknown, slideNumber: number): RenderedThreeHorizon {
  const spec: Pattern19ThreeHorizonSpec = Pattern19ThreeHorizonSpecSchema.parse(rawSpec);
  const ids = new ShapeIdAllocator(slideNumber);
  const allIds: number[] = [];
  const parts: string[] = [];
  const push = (xml: string, ...newIds: number[]): void => {
    parts.push(xml);
    allIds.push(...newIds);
  };

  // Y caption (top-left of plot)
  const capId = ids.alloc();
  push(
    `<p:sp>
  <p:nvSpPr><p:cNvPr id="${capId}" name="YCaption"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
  <p:spPr><a:xfrm><a:off x="${PLOT_X}" y="1360000"/><a:ext cx="2400000" cy="240000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>
   <p:txBody><a:bodyPr wrap="square" anchor="ctr" lIns="0" tIns="0" rIns="0" bIns="0"><a:normAutofit fontScale="100000" lnSpcReduction="0"/></a:bodyPr><a:lstStyle/><a:p><a:pPr algn="l"/><a:r><a:rPr lang="en-US" sz="1000" b="1" spc="200" dirty="0"><a:solidFill><a:srgbClr val="${BRAND.subtleBody}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>↑ ${escapeXmlText(spec.yAxisLabel.toUpperCase())}</a:t></a:r></a:p></p:txBody>
</p:sp>`,
    capId
  );

  spec.horizons.forEach((h, i) => {
    const color = H_COLORS[i];

    // S-curve band (simplified as rightArrow per doc's simpler-build note)
    const band = H_BAR[i];
    const bandId = ids.alloc();
    push(
      `<p:sp>
  <p:nvSpPr><p:cNvPr id="${bandId}" name="H${i + 1}Curve"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${band.x}" y="${H_BAND_Y[i]}"/><a:ext cx="${band.cx}" cy="${H_BAR_CY}"/></a:xfrm>
    <a:prstGeom prst="rightArrow"><a:avLst/></a:prstGeom>
    <a:solidFill><a:srgbClr val="${color}"><a:alpha val="${i === 0 ? 100000 : 80000}"/></a:srgbClr></a:solidFill>
    <a:ln><a:noFill/></a:ln>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" anchor="ctr" lIns="182880" tIns="0" rIns="457200" bIns="0"/>
    <a:lstStyle/>
    <a:p><a:pPr algn="l"/><a:r><a:rPr lang="en-US" sz="1400" b="1" dirty="0"><a:solidFill><a:srgbClr val="${BRAND.white}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>H${i + 1}</a:t></a:r></a:p>
  </p:txBody>
</p:sp>`,
      bandId
    );

    // Right panel
    const panelY = PANEL_YS[i];
    const panelId = ids.alloc();
    const bullets = h.initiatives
      .map(
        (ini) => `    <a:p>
      <a:pPr marL="171450" indent="-171450"><a:spcBef><a:spcPts val="400"/></a:spcBef>
        <a:buClr><a:srgbClr val="${color}"/></a:buClr>
        <a:buFont typeface="Arial"/><a:buChar char="•"/>
      </a:pPr>
      <a:r><a:rPr lang="en-US" sz="1100" dirty="0"><a:solidFill><a:srgbClr val="${BRAND.bodyText}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${escapeXmlText(ini)}</a:t></a:r>
    </a:p>`
      )
      .join("\n");
    push(
      `<p:sp>
  <p:nvSpPr><p:cNvPr id="${panelId}" name="H${i + 1}Panel"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${PANEL_X}" y="${panelY}"/><a:ext cx="${PANEL_CX}" cy="${PANEL_CY}"/></a:xfrm>
    <a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 4500"/></a:avLst></a:prstGeom>
    <a:solidFill><a:srgbClr val="${BRAND.white}"/></a:solidFill>
    <a:ln w="12700"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></a:ln>
  </p:spPr>
   <p:txBody>
     <a:bodyPr wrap="square" lIns="91440" tIns="91440" rIns="91440" bIns="91440" anchor="t"><a:normAutofit fontScale="100000" lnSpcReduction="0"/></a:bodyPr>
     <a:lstStyle/>
     <a:p><a:pPr algn="l"/><a:r><a:rPr lang="en-US" sz="1100" b="1" spc="200" dirty="0"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>HORIZON ${i + 1} · ${escapeXmlText(h.timeframe.toUpperCase())}</a:t></a:r></a:p>
     <a:p><a:pPr algn="l"><a:spcBef><a:spcPts val="300"/></a:spcBef></a:pPr><a:r><a:rPr lang="en-US" sz="1300" b="1" dirty="0"><a:solidFill><a:srgbClr val="${BRAND.navyDam}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${escapeXmlText(h.theme)}</a:t></a:r></a:p>
${bullets}
   </p:txBody>
</p:sp>`,
      panelId
    );
  });

  // X-axis label
  const xId = ids.alloc();
  push(
    `<p:sp>
  <p:nvSpPr><p:cNvPr id="${xId}" name="XAxisLabel"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
  <p:spPr><a:xfrm><a:off x="${X_LABEL_RECT.x}" y="${X_LABEL_RECT.y}"/><a:ext cx="${X_LABEL_RECT.cx}" cy="${X_LABEL_RECT.cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>
   <p:txBody><a:bodyPr wrap="square" anchor="ctr" lIns="0" tIns="0" rIns="0" bIns="0"><a:normAutofit fontScale="100000" lnSpcReduction="0"/></a:bodyPr><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" sz="1100" b="1" spc="200" dirty="0"><a:solidFill><a:srgbClr val="${BRAND.navyDam}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${escapeXmlText(spec.xAxisLabel.toUpperCase())} →</a:t></a:r></a:p></p:txBody>
</p:sp>`,
    xId
  );

  return { bodyXml: parts.join("\n"), shapeIds: allIds };
}

export const __internalP19 = { H_COLORS, H_BAND_Y, H_BAR, H_BAR_CY, PANEL_X, PANEL_YS, PANEL_CX, PANEL_CY };

