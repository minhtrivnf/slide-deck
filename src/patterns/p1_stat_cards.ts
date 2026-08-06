/**
 * patterns/p1_stat_cards.ts
 *
 * Renders Pattern 1 (3-column) and Pattern 2 (2-column) stat callout
 * cards — the two patterns share one shape family (card + accent bar +
 * category/stat/label/bullets text) and differ only in column count and
 * x-positions, per references/slide_patterns.md Pattern 1 / Pattern 2
 * tables and slide_templates.md "3-Column Card (Pattern 1)".
 */


import { ShapeIdAllocator } from "../ids.js";
import { BRAND, categoricalColor } from "../palette.js";
import { fitLabel, pxForEmu } from "../units.js";
import { escapeXmlText } from "../xml.js";
import { Rect, renderRect } from "../templates/common.js";
import { Pattern1StatCalloutSpecSchema, type Pattern1StatCalloutSpec } from "../types.js";

// Columns transcribed verbatim from slide_patterns.md Pattern 1 / Pattern 2.
const LAYOUT_3COL = {
  xs: [457200, 3327400, 6197600],
  cardCx: 2641600,
  textCx: 2235200,
};
const LAYOUT_2COL = {
  xs: [457200, 4648200],
  cardCx: 4038600,
  textCx: 3632200,
};
const CARD_Y = 1651000;
const CARD_CY = 3429000;
const BAR_CY = 63500;
const TEXT_CY = 3048000;
// Text box is inset from the card by (203200, 228600) per the template
// ("Card Text" x=660400 vs card x=457200; y=1879600 vs card y=1651000).
const TEXT_INSET_X = 203200;
const TEXT_INSET_Y = 228600;

export interface RenderedStatCards {
  bodyXml: string;
  shapeIds: number[];
}

export function renderPattern1StatCards(rawSpec: unknown, slideNumber: number): RenderedStatCards {
  const spec: Pattern1StatCalloutSpec = Pattern1StatCalloutSpecSchema.parse(rawSpec);
  const expectedCols = spec.pattern === "P1" ? 3 : 2;
  if (spec.cards.length !== expectedCols) {
    throw new Error(`${spec.pattern} requires exactly ${expectedCols} cards, got ${spec.cards.length}`);
  }
  const layout = spec.pattern === "P1" ? LAYOUT_3COL : LAYOUT_2COL;
  const ids = new ShapeIdAllocator(slideNumber);

  const allIds: number[] = [];
  const parts: string[] = [];

  spec.cards.forEach((card, i) => {
    const x = layout.xs[i];
    const accent = card.accentColorHex ?? categoricalColor(i);
    const cardRect: Rect = { x, y: CARD_Y, cx: layout.cardCx, cy: CARD_CY };

    const cardId = ids.alloc();
    const barId = ids.alloc();
    const textId = ids.alloc();
    allIds.push(cardId, barId, textId);

    parts.push(
      renderRect({
        shapeId: cardId,
        name: `Card${i + 1}`,
        rect: cardRect,
        fillHex: "F7F8FA",
        borderHex: "E5E7EB",
        roundedCornerAdj: 4500,
      })
    );
    parts.push(
      renderRect({
        shapeId: barId,
        name: `Bar${i + 1}`,
        rect: { x, y: CARD_Y, cx: layout.cardCx, cy: BAR_CY },
        fillHex: accent,
      })
    );

    const bulletParas = card.bullets
      .map(
        (b) => `    <a:p>
      <a:pPr marL="171450" indent="-171450">
        <a:spcBef><a:spcPts val="600"/></a:spcBef>
        <a:buClr><a:srgbClr val="${accent}"/></a:buClr>
        <a:buFont typeface="Arial"/><a:buChar char="•"/>
      </a:pPr>
      <a:r><a:rPr lang="en-US" sz="1100" dirty="0">
        <a:solidFill><a:srgbClr val="2C2C2C"/></a:solidFill>
        <a:latin typeface="Calibri"/>
      </a:rPr><a:t>${escapeXmlText(b)}</a:t></a:r>
    </a:p>`
      )
      .join("\n");

    // Stat PT theo độ rộng text: giảm cỡ khi quá dài, fallback cắt + "…"
    // khi không chữa được — thay vì để tràn khỏi card hoặc abort deck.
    const statFit = fitLabel(card.stat, pxForEmu(layout.textCx - 360000), [32, 28, 24, 20]);
    const statSize = statFit.fontSizePt * 100;
    const catFit = fitLabel(card.category.toUpperCase(), pxForEmu(layout.textCx), [10, 9, 8]);
    const labelFit = fitLabel(card.label, pxForEmu(layout.textCx), [10, 9, 8]);

    const textXml = `<p:sp>
  <p:nvSpPr>
    <p:cNvPr id="${textId}" name="CardTxt${i + 1}"/>
    <p:cNvSpPr txBox="1"/>
    <p:nvPr/>
  </p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${x + TEXT_INSET_X}" y="${CARD_Y + TEXT_INSET_Y}"/><a:ext cx="${layout.textCx}" cy="${TEXT_CY}"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
    <a:noFill/>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="t"><a:noAutofit/></a:bodyPr>
    <a:lstStyle/>
    <a:p>
      <a:pPr algn="l"/>
      <a:r><a:rPr lang="en-US" sz="${catFit.fontSizePt * 100}" b="1" spc="200" dirty="0">
        <a:solidFill><a:srgbClr val="${accent}"/></a:solidFill>
        <a:latin typeface="Calibri"/>
      </a:rPr><a:t>${escapeXmlText(catFit.text)}</a:t></a:r>
    </a:p>
    <a:p>
      <a:pPr algn="l"><a:spcBef><a:spcPts val="600"/></a:spcBef></a:pPr>
      <a:r>      <a:rPr lang="en-US" sz="${statSize}" b="1" dirty="0">
        <a:solidFill><a:srgbClr val="${BRAND.navyDam}"/></a:solidFill>
        <a:latin typeface="Calibri"/>
      </a:rPr><a:t>${escapeXmlText(statFit.text)}</a:t></a:r>
    </a:p>
    <a:p>
      <a:pPr algn="l"/>
      <a:r><a:rPr lang="en-US" sz="${labelFit.fontSizePt * 100}" b="1" spc="100" dirty="0">
        <a:solidFill><a:srgbClr val="595959"/></a:solidFill>
        <a:latin typeface="Calibri"/>
      </a:rPr><a:t>${escapeXmlText(labelFit.text)}</a:t></a:r>
    </a:p>
    <a:p><a:pPr algn="l"><a:spcBef><a:spcPts val="800"/></a:spcBef><a:buNone/></a:pPr><a:endParaRPr lang="en-US" sz="400"/></a:p>
${bulletParas}
  </p:txBody>
</p:sp>`;
    parts.push(textXml);
  });

  return { bodyXml: parts.join("\n"), shapeIds: allIds };
}

export const __internalP1 = { LAYOUT_3COL, LAYOUT_2COL, CARD_Y, CARD_CY, BAR_CY, TEXT_CY };