/**
 * patterns/p8_quote.ts
 *
 * Renders Pattern 8 (Quote Highlight). Coordinates for the quote mark and
 * quote text/attribution x/y are transcribed verbatim from
 * slide_patterns.md Pattern 8; slide_patterns.md doesn't specify cy for
 * the text/attribution boxes (only x/y), so cy is derived here to keep a
 * safe gap above the next fixed element (attribution y=4000000) — see
 * QUOTE_TEXT_CY comment below.
 */

import { ShapeIdAllocator } from "../ids.js";
import { BRAND } from "../palette.js";
import { escapeXmlText } from "../xml.js";
import { Pattern8QuoteSpecSchema, type Pattern8QuoteSpec } from "../types.js";

const QUOTE_MARK: { x: number; y: number; cx: number; cy: number } = { x: 457200, y: 1800000, cx: 800000, cy: 900000 };
const QUOTE_TEXT_X = 800000;
const QUOTE_TEXT_Y = 2200000;
const QUOTE_TEXT_CX = 7544000;
// Derived, not in doc: gap kept above the fixed attribution y=4000000.
const QUOTE_TEXT_CY = 4000000 - QUOTE_TEXT_Y - 120000;
const ATTRIBUTION_X = 800000;
const ATTRIBUTION_Y = 4000000;
const ATTRIBUTION_CX = 7544000;
const ATTRIBUTION_CY = 400000;

export interface RenderedQuote {
  bodyXml: string;
  shapeIds: { mark: number; text: number; attribution: number };
}

export function renderPattern8Quote(rawSpec: unknown, slideNumber: number): RenderedQuote {
  const spec: Pattern8QuoteSpec = Pattern8QuoteSpecSchema.parse(rawSpec);
  const ids = new ShapeIdAllocator(slideNumber);

  const markId = ids.alloc();
  const textId = ids.alloc();
  const attrId = ids.alloc();

  const markXml = `<p:sp>
  <p:nvSpPr><p:cNvPr id="${markId}" name="QuoteMark"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${QUOTE_MARK.x}" y="${QUOTE_MARK.y}"/><a:ext cx="${QUOTE_MARK.cx}" cy="${QUOTE_MARK.cy}"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
    <a:noFill/>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" anchor="t" lIns="0" tIns="0" rIns="0" bIns="0"/>
    <a:lstStyle/>
    <a:p>
      <a:pPr algn="l"/>
      <a:r><a:rPr lang="en-US" sz="7200" b="1" dirty="0">
        <a:solidFill><a:srgbClr val="${BRAND.xanhSang}"/></a:solidFill>
        <a:latin typeface="Calibri"/>
      </a:rPr><a:t>&#8220;</a:t></a:r>
    </a:p>
  </p:txBody>
</p:sp>`;

  const textXml = `<p:sp>
  <p:nvSpPr><p:cNvPr id="${textId}" name="QuoteText"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${QUOTE_TEXT_X}" y="${QUOTE_TEXT_Y}"/><a:ext cx="${QUOTE_TEXT_CX}" cy="${QUOTE_TEXT_CY}"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
    <a:noFill/>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" anchor="t" lIns="0" tIns="0" rIns="0" bIns="0"/>
    <a:lstStyle/>
    <a:p>
      <a:pPr algn="l"/>
      <a:r><a:rPr lang="en-US" sz="1800" i="1" dirty="0">
        <a:solidFill><a:srgbClr val="${BRAND.navyDam}"/></a:solidFill>
        <a:latin typeface="Calibri"/>
      </a:rPr><a:t>${escapeXmlText(spec.quote)}</a:t></a:r>
    </a:p>
  </p:txBody>
</p:sp>`;

  const attrXml = `<p:sp>
  <p:nvSpPr><p:cNvPr id="${attrId}" name="QuoteAttribution"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${ATTRIBUTION_X}" y="${ATTRIBUTION_Y}"/><a:ext cx="${ATTRIBUTION_CX}" cy="${ATTRIBUTION_CY}"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
    <a:noFill/>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" anchor="t" lIns="0" tIns="0" rIns="0" bIns="0"/>
    <a:lstStyle/>
    <a:p>
      <a:pPr algn="l"/>
      <a:r><a:rPr lang="en-US" sz="1200" dirty="0">
        <a:solidFill><a:srgbClr val="${BRAND.gray}"/></a:solidFill>
        <a:latin typeface="Calibri"/>
      </a:rPr><a:t>${escapeXmlText(`— ${spec.attribution}`)}</a:t></a:r>
    </a:p>
  </p:txBody>
</p:sp>`;

  return { bodyXml: [markXml, textXml, attrXml].join("\n"), shapeIds: { mark: markId, text: textId, attribution: attrId } };
}

export const __internalP8 = { QUOTE_MARK, QUOTE_TEXT_X, QUOTE_TEXT_Y, ATTRIBUTION_X, ATTRIBUTION_Y };
