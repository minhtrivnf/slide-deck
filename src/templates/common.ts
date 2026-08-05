/**
 * templates/common.ts
 *
 * Reusable `<p:sp>` renderers, parameterized instead of copy-pasted per
 * pattern (the original slide_templates.md is "copy this XML, replace
 * [PLACEHOLDER]" — this is the same templates as functions, so a fix
 * here fixes every pattern that uses it, instead of needing to be
 * re-applied to N copy-pasted XML blocks).
 */

import { escapeXmlText } from "../xml.js";

export type Align = "l" | "ctr" | "r";
export type Anchor = "t" | "ctr" | "b";

export interface Rect {
  x: number;
  y: number;
  cx: number;
  cy: number;
}

/**
 * Renders a filled or unfilled rectangle containing a single run of text.
 * This is the base component behind action titles, pyramid tiers,
 * takeaway boxes, and most card-style patterns.
 */
export function renderFilledTextBox(params: {
  shapeId: number;
  name: string;
  rect: Rect;
  text: string;
  fontSizePt: number;
  textColorHex: string;
  bold?: boolean;
  italic?: boolean;
  fillHex?: string; // omit for no fill
  borderHex?: string; // omit for no border
  borderWeightEmu?: number;
  roundedCornerAdj?: number; // e.g. 4500 for the VNF card/tagline radius
  align?: Align;
  anchor?: Anchor;
  fontFamily?: string;
}): string {
  const {
    shapeId,
    name,
    rect,
    text,
    fontSizePt,
    textColorHex,
    bold = false,
    italic = false,
    fillHex,
    borderHex,
    borderWeightEmu = 12700,
    roundedCornerAdj,
    align = "l",
    anchor = "ctr",
    fontFamily = "Calibri",
  } = params;

  const geom = roundedCornerAdj !== undefined ? "roundRect" : "rect";
  const avLst = roundedCornerAdj !== undefined ? `<a:gd name="adj" fmla="val ${roundedCornerAdj}"/>` : "";
  const fill = fillHex ? `<a:solidFill><a:srgbClr val="${fillHex}"/></a:solidFill>` : "<a:noFill/>";
  const line = borderHex
    ? `<a:ln w="${borderWeightEmu}"><a:solidFill><a:srgbClr val="${borderHex}"/></a:solidFill></a:ln>`
    : "";

  return `<p:sp>
  <p:nvSpPr>
    <p:cNvPr id="${shapeId}" name="${escapeXmlText(name)}"/>
    <p:cNvSpPr txBox="1"/>
    <p:nvPr/>
  </p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${rect.x}" y="${rect.y}"/><a:ext cx="${rect.cx}" cy="${rect.cy}"/></a:xfrm>
    <a:prstGeom prst="${geom}"><a:avLst>${avLst}</a:avLst></a:prstGeom>
    ${fill}
    ${line}
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" anchor="${anchor}" lIns="45720" tIns="22860" rIns="45720" bIns="22860"><a:noAutofit/></a:bodyPr>
    <a:lstStyle/>
    <a:p>
      <a:pPr algn="${align}"/>
      <a:r><a:rPr lang="en-US" sz="${Math.round(fontSizePt * 100)}" b="${bold ? 1 : 0}" i="${italic ? 1 : 0}" dirty="0">
        <a:solidFill><a:srgbClr val="${textColorHex}"/></a:solidFill>
        <a:latin typeface="${fontFamily}"/>
      </a:rPr><a:t>${escapeXmlText(text)}</a:t></a:r>
    </a:p>
  </p:txBody>
</p:sp>`;
}

/**
 * Renders a box containing a bulleted list — used for the bottom-tier
 * evidence stacks in Pattern 11, and reusable for any card pattern that
 * needs 1-N bullet lines instead of a single run of text.
 */
export function renderBulletListBox(params: {
  shapeId: number;
  name: string;
  rect: Rect;
  bullets: string[];
  fontSizePt?: number;
  textColorHex?: string;
  fontFamily?: string;
  bulletGlyph?: string;
}): string {
  const {
    shapeId,
    name,
    rect,
    bullets,
    fontSizePt = 13,
    textColorHex = "2C2C2C",
    fontFamily = "Calibri",
    bulletGlyph = "•",
  } = params;

  const paragraphs = bullets
    .map(
      (b) => `    <a:p>
      <a:pPr algn="l"/>
      <a:r><a:rPr lang="en-US" sz="${Math.round(fontSizePt * 100)}" dirty="0">
        <a:solidFill><a:srgbClr val="${textColorHex}"/></a:solidFill>
        <a:latin typeface="${fontFamily}"/>
      </a:rPr><a:t>${escapeXmlText(bulletGlyph)} ${escapeXmlText(b)}</a:t></a:r>
    </a:p>`
    )
    .join("\n");

  return `<p:sp>
  <p:nvSpPr>
    <p:cNvPr id="${shapeId}" name="${escapeXmlText(name)}"/>
    <p:cNvSpPr txBox="1"/>
    <p:nvPr/>
  </p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${rect.x}" y="${rect.y}"/><a:ext cx="${rect.cx}" cy="${rect.cy}"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
    <a:noFill/>
    <a:ln><a:solidFill><a:srgbClr val="002060"/></a:solidFill></a:ln>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" anchor="t" lIns="91440" tIns="45720" rIns="45720" bIns="45720"><a:noAutofit/></a:bodyPr>
    <a:lstStyle/>
${paragraphs}
  </p:txBody>
</p:sp>`;
}
