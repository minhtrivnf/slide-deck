/**
 * patterns/p5_icon_grid.ts
 *
 * Renders Pattern 5 (Icon Grid 2×2). Geometry from slide_patterns.md P5:
 * circle centers (1500000/5500000, 2200000/4200000), ø=800000; label
 * boxes x=900000/4900000 (centered under each circle).
 * Circle: fill `D6F1FC`, border `0070C0` 1pt, glyph 28pt navy centered;
 * label 12pt bold navy + optional description 10pt gray below.
 */

import { ShapeIdAllocator } from "../ids.js";
import { BRAND } from "../palette.js";
import { fitLabel, pxForEmu } from "../units.js";
import { escapeXmlText } from "../xml.js";
import { Pattern5IconGridSpecSchema, type Pattern5IconGridSpec } from "../types.js";

const D = 800000;
const CENTERS = [
  { cx: 1500000, cy: 2200000, labelX: 900000 },
  { cx: 5500000, cy: 2200000, labelX: 4900000 },
  { cx: 1500000, cy: 4200000, labelX: 900000 },
  { cx: 5500000, cy: 4200000, labelX: 4900000 },
] as const;
const LABEL_CX = 1200000;
const LABEL_GAP = 72000;

export interface RenderedIconGrid {
  bodyXml: string;
  shapeIds: number[];
}

export function renderPattern5IconGrid(rawSpec: unknown, slideNumber: number): RenderedIconGrid {
  const spec: Pattern5IconGridSpec = Pattern5IconGridSpecSchema.parse(rawSpec);
  const ids = new ShapeIdAllocator(slideNumber);
  const allIds: number[] = [];
  const parts: string[] = [];

  spec.items.forEach((item, i) => {
    const center = CENTERS[i];
    const circleId = ids.alloc();
    const iconId = ids.alloc();
    const labelId = ids.alloc();
    allIds.push(circleId, iconId, labelId);
    const labelFit = fitLabel(item.label, pxForEmu(LABEL_CX), [12, 11, 10]);

    // Circle rendered as ellipse (renderRect only does rect/roundRect)
    parts.push(`<p:sp>
  <p:nvSpPr><p:cNvPr id="${circleId}" name="IconCircle${i + 1}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${center.cx - D / 2}" y="${center.cy - D / 2}"/><a:ext cx="${D}" cy="${D}"/></a:xfrm>
    <a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom>
    <a:solidFill><a:srgbClr val="${BRAND.xanhDaTroi}"/></a:solidFill>
    <a:ln w="12700"><a:solidFill><a:srgbClr val="${BRAND.xanhSang}"/></a:solidFill></a:ln>
  </p:spPr>
  <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody>
</p:sp>`);
    parts.push(`<p:sp>
  <p:nvSpPr><p:cNvPr id="${iconId}" name="IconGlyph${i + 1}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${center.cx - D / 2}" y="${center.cy - D / 2}"/><a:ext cx="${D}" cy="${D}"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" anchor="ctr" lIns="0" tIns="0" rIns="0" bIns="0"><a:noAutofit/></a:bodyPr>
    <a:lstStyle/>
    <a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" sz="2800" b="1" dirty="0"><a:solidFill><a:srgbClr val="${BRAND.navyDam}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${escapeXmlText(item.icon)}</a:t></a:r></a:p>
  </p:txBody>
</p:sp>`);

    const descP = item.description
      ? `<a:p><a:pPr algn="ctr"><a:spcBef><a:spcPts val="200"/></a:spcBef></a:pPr><a:r><a:rPr lang="en-US" sz="1000" dirty="0"><a:solidFill><a:srgbClr val="${BRAND.gray}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${escapeXmlText(item.description)}</a:t></a:r></a:p>`
      : "";
    parts.push(`<p:sp>
  <p:nvSpPr><p:cNvPr id="${labelId}" name="IconLabel${i + 1}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${center.labelX}" y="${center.cy + D / 2 + LABEL_GAP}"/><a:ext cx="${LABEL_CX}" cy="${item.description ? 720000 : 360000}"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" anchor="t" lIns="0" tIns="0" rIns="0" bIns="0"><a:noAutofit/></a:bodyPr>
    <a:lstStyle/>
    <a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" sz="${labelFit.fontSizePt * 100}" b="1" dirty="0"><a:solidFill><a:srgbClr val="${BRAND.navyDam}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${escapeXmlText(labelFit.text)}</a:t></a:r></a:p>
    ${descP}
  </p:txBody>
</p:sp>`);
  });

  return { bodyXml: parts.join("\n"), shapeIds: allIds };
}

export const __internalP5 = { D, CENTERS, LABEL_CX };

