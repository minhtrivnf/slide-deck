/**
 * patterns/p6_swot.ts
 *
 * Renders Pattern 6 (Comparison Matrix 2×2 / SWOT). Geometry from
 * slide_patterns.md P6: quadrants (457200/4648200, 1651000/3841000),
 * 4038600×2000000, fills E8F5E9/FFF4E0 checker (TL/BR green-tint,
 * TR/BL amber-tint).
 *
 * Heading color pairs with the fill's semantic family (light fill E8F5E9
 * → dark 2E7D32, FFF4E0 → C97A00) — the "never mix families" rule.
 */

import { ShapeIdAllocator } from "../ids.js";
import { BRAND, SEMANTIC } from "../palette.js";
import { escapeXmlText, escapeXmlAttr } from "../xml.js";
import { Pattern6SwotSpecSchema, type Pattern6SwotSpec } from "../types.js";

const QUADS = [
  { x: 457200, y: 1651000, fillHex: SEMANTIC.success.light, darkHex: SEMANTIC.success.dark, defaultLabel: "S — Điểm mạnh" },
  { x: 4648200, y: 1651000, fillHex: SEMANTIC.warning.light, darkHex: SEMANTIC.warning.dark, defaultLabel: "W — Điểm yếu" },
  { x: 457200, y: 3841000, fillHex: SEMANTIC.warning.light, darkHex: SEMANTIC.warning.dark, defaultLabel: "O — Cơ hội" },
  { x: 4648200, y: 3841000, fillHex: SEMANTIC.success.light, darkHex: SEMANTIC.success.dark, defaultLabel: "T — Thách thức" },
] as const;
const QUAD_CX = 4038600;
const QUAD_CY = 2000000;
const TEXT_INSET = 171450;

export interface RenderedSwot {
  bodyXml: string;
  shapeIds: number[];
}

export function renderPattern6Swot(rawSpec: unknown, slideNumber: number): RenderedSwot {
  const spec: Pattern6SwotSpec = Pattern6SwotSpecSchema.parse(rawSpec);
  const ids = new ShapeIdAllocator(slideNumber);
  const allIds: number[] = [];
  const parts: string[] = [];

  spec.quadrants.forEach((quad, i) => {
    const q = QUADS[i];
    const bgId = ids.alloc();
    const textId = ids.alloc();
    allIds.push(bgId, textId);

    parts.push(`<p:sp>
  <p:nvSpPr><p:cNvPr id="${bgId}" name="Quad${i + 1}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${q.x}" y="${q.y}"/><a:ext cx="${QUAD_CX}" cy="${QUAD_CY}"/></a:xfrm>
    <a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 3000"/></a:avLst></a:prstGeom>
    <a:solidFill><a:srgbClr val="${q.fillHex}"/></a:solidFill>
    <a:ln><a:noFill/></a:ln>
  </p:spPr>
  <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody>
</p:sp>`);

    const bullets = quad.bullets
      .map(
        (b) => `    <a:p>
      <a:pPr marL="171450" indent="-171450">
        <a:spcBef><a:spcPts val="400"/></a:spcBef>
        <a:buClr><a:srgbClr val="${q.darkHex}"/></a:buClr>
        <a:buFont typeface="Arial"/><a:buChar char="•"/>
      </a:pPr>
      <a:r><a:rPr lang="en-US" sz="1100" dirty="0">
        <a:solidFill><a:srgbClr val="${BRAND.bodyText}"/></a:solidFill>
        <a:latin typeface="Calibri"/>
      </a:rPr><a:t>${escapeXmlText(b)}</a:t></a:r>
    </a:p>`
      )
      .join("\n");

    parts.push(`<p:sp>
  <p:nvSpPr><p:cNvPr id="${textId}" name="${escapeXmlAttr(`QuadText${i + 1}`)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${q.x + TEXT_INSET}" y="${q.y + TEXT_INSET}"/><a:ext cx="${QUAD_CX - 2 * TEXT_INSET}" cy="${QUAD_CY - 2 * TEXT_INSET}"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/>
  </p:spPr>
   <p:txBody>
     <a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="t"><a:normAutofit fontScale="100000" lnSpcReduction="0"/></a:bodyPr>
     <a:lstStyle/>
     <a:p>
       <a:pPr algn="l"/>
       <a:r><a:rPr lang="en-US" sz="1300" b="1" dirty="0">
         <a:solidFill><a:srgbClr val="${q.darkHex}"/></a:solidFill>
         <a:latin typeface="Calibri"/>
       </a:rPr><a:t>${escapeXmlText(quad.label ?? q.defaultLabel)}</a:t></a:r>
     </a:p>
${bullets}
   </p:txBody>
</p:sp>`);
  });

  return { bodyXml: parts.join("\n"), shapeIds: allIds };
}

export const __internalP6 = { QUADS, QUAD_CX, QUAD_CY };

