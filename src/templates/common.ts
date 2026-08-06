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

/**
 * Renders a plain filled/outlined shape (rect or roundRect) with an empty
 * text body — the workhorse for cards, bars, tiles and table-free
 * containers. No text is ever written here; text is layered on top by the
 * caller so a shape can never "own" a string that overflows.
 */
export function renderRect(params: {
  shapeId: number;
  name: string;
  rect: Rect;
  fillHex?: string; // omit for no fill
  borderHex?: string; // omit for no border
  borderWeightEmu?: number;
  roundedCornerAdj?: number; // e.g. 4500 for the VNF card radius
}): string {
  const { shapeId, name, rect, fillHex, borderHex, borderWeightEmu = 12700, roundedCornerAdj } = params;
  const geom = roundedCornerAdj !== undefined ? "roundRect" : "rect";
  const avLst = roundedCornerAdj !== undefined ? `<a:gd name="adj" fmla="val ${roundedCornerAdj}"/>` : "";
  const fill = fillHex ? `<a:solidFill><a:srgbClr val="${fillHex}"/></a:solidFill>` : "<a:noFill/>";
  const line = borderHex
    ? `<a:ln w="${borderWeightEmu}"><a:solidFill><a:srgbClr val="${borderHex}"/></a:solidFill></a:ln>`
    : `<a:ln><a:noFill/></a:ln>`;
  return `<p:sp>
  <p:nvSpPr><p:cNvPr id="${shapeId}" name="${escapeXmlText(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${rect.x}" y="${rect.y}"/><a:ext cx="${rect.cx}" cy="${rect.cy}"/></a:xfrm>
    <a:prstGeom prst="${geom}"><a:avLst>${avLst}</a:avLst></a:prstGeom>
    ${fill}
    ${line}
  </p:spPr>
  <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody>
</p:sp>`;
}

/**
 * Renders a circular/elliptical number badge — used by Process Flow steps,
 * Executive Summary pillars, and Agenda rows. White bold number centered on
 * the fill color.
 */
export function renderEllipseBadge(params: {
  shapeId: number;
  name: string;
  rect: Rect;
  text: string;
  fillHex: string;
  textColorHex?: string;
  fontSizePt?: number;
}): string {
  const { shapeId, name, rect, text, fillHex, textColorHex = "FFFFFF", fontSizePt = 16 } = params;
  return `<p:sp>
  <p:nvSpPr><p:cNvPr id="${shapeId}" name="${escapeXmlText(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${rect.x}" y="${rect.y}"/><a:ext cx="${rect.cx}" cy="${rect.cy}"/></a:xfrm>
    <a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom>
    <a:solidFill><a:srgbClr val="${fillHex}"/></a:solidFill>
    <a:ln w="9525"><a:solidFill><a:srgbClr val="${fillHex}"/></a:solidFill></a:ln>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" anchor="ctr" lIns="0" tIns="0" rIns="0" bIns="0"><a:noAutofit/></a:bodyPr>
    <a:lstStyle/>
    <a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" sz="${Math.round(fontSizePt * 100)}" b="1" dirty="0"><a:solidFill><a:srgbClr val="${textColorHex}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${escapeXmlText(text)}</a:t></a:r></a:p>
  </p:txBody>
</p:sp>`;
}

/** A single styled bullet line for `renderHeadingBulletsBox`. */
export interface StyledBullet {
  text: string;
  fontSizePt?: number;
  textColorHex?: string;
  bulletGlyph?: string;
  bulletColorHex?: string;
}

/**
 * Renders a heading + bullet-list text box (no fill) — the body of
 * Executive Summary pillar cards, Source/Methodology columns, and the
 * Build detail panel.
 */
export function renderHeadingBulletsBox(params: {
  shapeId: number;
  name: string;
  rect: Rect;
  heading: string;
  headingFontSizePt?: number;
  headingColorHex?: string;
  bullets: StyledBullet[];
  headingAlign?: Align;
}): string {
  const {
    shapeId,
    name,
    rect,
    heading,
    headingFontSizePt = 14,
    headingColorHex = "002060",
    bullets,
    headingAlign = "l",
  } = params;
  const paras = [
    `    <a:p>
      <a:pPr algn="${headingAlign}"/>
      <a:r><a:rPr lang="en-US" sz="${Math.round(headingFontSizePt * 100)}" b="1" dirty="0">
        <a:solidFill><a:srgbClr val="${headingColorHex}"/></a:solidFill>
        <a:latin typeface="Calibri"/>
      </a:rPr><a:t>${escapeXmlText(heading)}</a:t></a:r>
    </a:p>`,
    ...bullets.map(
      (b) => `    <a:p>
      <a:pPr marL="171450" indent="-171450">
        <a:spcBef><a:spcPts val="300"/></a:spcBef>
        <a:buClr><a:srgbClr val="${b.bulletColorHex ?? "595959"}"/></a:buClr>
        <a:buFont typeface="Arial"/><a:buChar char="${escapeXmlText(b.bulletGlyph ?? "•")}"/>
      </a:pPr>
      <a:r><a:rPr lang="en-US" sz="${Math.round((b.fontSizePt ?? 11) * 100)}" dirty="0">
        <a:solidFill><a:srgbClr val="${b.textColorHex ?? "2C2C2C"}"/></a:solidFill>
        <a:latin typeface="Calibri"/>
      </a:rPr><a:t>${escapeXmlText(b.text)}</a:t></a:r>
    </a:p>`
    ),
  ].join("\n");
  return `<p:sp>
  <p:nvSpPr><p:cNvPr id="${shapeId}" name="${escapeXmlText(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${rect.x}" y="${rect.y}"/><a:ext cx="${rect.cx}" cy="${rect.cy}"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
    <a:noFill/>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" anchor="t" lIns="45720" tIns="22860" rIns="45720" bIns="22860"><a:noAutofit/></a:bodyPr>
    <a:lstStyle/>
${paras}
  </p:txBody>
</p:sp>`;
}

/**
 * Renders the VNF tagline/takeaway box (rounded light-blue container with a
 * bold navy text line) — the shared "so what" strip at the bottom of
 * analytical slides. `prefix` is optional ("Tóm lại:"-style lead-in) and
 * rendered bold before the text.
 */
export function renderTaglineBox(params: {
  boxShapeId: number;
  textShapeId: number;
  text: string;
  prefix?: string;
}): string {
  const { boxShapeId, textShapeId, text, prefix } = params;
  const box = renderFilledTextBox({
    shapeId: boxShapeId,
    name: "TaglineBox",
    rect: { x: 457200, y: 5832000, cx: 8229600, cy: 432000 },
    text: "",
    fontSizePt: 1,
    textColorHex: "002060",
    fillHex: "D6F1FC",
    roundedCornerAdj: 4500,
    align: "l",
    anchor: "ctr",
  });
  const lead = prefix ? `<a:r><a:rPr lang="en-US" sz="1300" b="1" dirty="0"><a:solidFill><a:srgbClr val="002060"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${escapeXmlText(prefix)} </a:t></a:r>` : "";
  const txt = `<p:sp>
  <p:nvSpPr><p:cNvPr id="${textShapeId}" name="TaglineText"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="571200" y="5904000"/><a:ext cx="8001600" cy="288000"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
    <a:noFill/>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" anchor="ctr" lIns="0" tIns="0" rIns="0" bIns="0"><a:noAutofit/></a:bodyPr>
    <a:lstStyle/>
    <a:p><a:pPr algn="l"/>${lead}<a:r><a:rPr lang="en-US" sz="1300" b="1" dirty="0"><a:solidFill><a:srgbClr val="002060"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${escapeXmlText(text)}</a:t></a:r></a:p>
  </p:txBody>
</p:sp>`;
  return `${box}\n${txt}`;
}
