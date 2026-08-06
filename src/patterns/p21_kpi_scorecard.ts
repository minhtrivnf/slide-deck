/**
 * patterns/p21_kpi_scorecard.ts
 *
 * Renders Pattern 21 (KPI Scorecard): 4–8 tiles in a fixed 2×4 grid.
 * Geometry from slide_patterns.md P21: tile xs 457200/2607400/4757600/
 * 6907800, ys 1620000/3420000, tile 2030200×1640000.
 *
 * Tile structure per slide_templates.md P21: body (white, border D9D9D9,
 * roundRect 4500) + top status bar 36000 EMU in semantic dark + text
 * (name+glyph 12/14pt, value 28pt bold navy, target/delta 10pt gray).
 * Status bar + glyph color come from the SAME SEMANTIC pair — a tile can
 * never mix families.
 */

import { ShapeIdAllocator } from "../ids.js";
import { BRAND, GLYPHS, SEMANTIC, type SemanticStatus } from "../palette.js";
import { fitLabel, pxForEmu } from "../units.js";
import { escapeXmlText } from "../xml.js";
import { renderRect, type Rect } from "../templates/common.js";
import { Pattern21KpiScorecardSpecSchema, type KpiTile as KpiTileSpec, type Pattern21KpiScorecardSpec } from "../types.js";

const TILE_XS = [457200, 2607400, 4757600, 6907800] as const;
const TILE_YS = [1620000, 3420000] as const;
const TILE_CX = 2030200;
const TILE_CY = 1640000;
const STATUS_BAR_CY = 36000;
const TEXT_INSET = { x: 114300, y: 180000, cx: 1801600, cy: 1380000 };

export interface RenderedKpiScorecard {
  bodyXml: string;
  shapeIds: number[];
}

const TREND_GLYPH = { up: GLYPHS.trendUp, down: GLYPHS.trendDown, flat: GLYPHS.trendFlat } as const;

export function renderPattern21KpiScorecard(rawSpec: unknown, slideNumber: number): RenderedKpiScorecard {
  const spec: Pattern21KpiScorecardSpec = Pattern21KpiScorecardSpecSchema.parse(rawSpec);

  const ids = new ShapeIdAllocator(slideNumber);
  const allIds: number[] = [];
  const parts: string[] = [];

  spec.kpis.forEach((kpi: KpiTileSpec, i: number) => {
    const x = TILE_XS[i % 4];
    const y = TILE_YS[Math.floor(i / 4)];
    const status: SemanticStatus = kpi.status;
    const statusDark = SEMANTIC[status].dark;

    const tileId = ids.alloc();
    const barId = ids.alloc();
    const textId = ids.alloc();
    allIds.push(tileId, barId, textId);

    parts.push(
      renderRect({
        shapeId: tileId,
        name: `KpiTile${i + 1}`,
        rect: { x, y, cx: TILE_CX, cy: TILE_CY },
        fillHex: BRAND.white,
        borderHex: BRAND.lightGrayRule,
        roundedCornerAdj: 4500,
      })
    );
    parts.push(
      renderRect({ shapeId: barId, name: `KpiStatus${i + 1}`, rect: { x, y, cx: TILE_CX, cy: STATUS_BAR_CY }, fillHex: statusDark })
    );

    const metaLine = [kpi.target, kpi.delta].filter(Boolean).join("   |   ");
    const nameFit = fitLabel(kpi.name, pxForEmu(TEXT_INSET.cx), [12, 11, 10]);
    const showGlyph = nameFit.text === kpi.name;
    const nameGlyphSz = nameFit.fontSizePt * 100;
    const valueFit = fitLabel(kpi.value, pxForEmu(TEXT_INSET.cx), [28, 24, 20, 18]);
    const valueSz = valueFit.fontSizePt * 100;
    const metaFit = fitLabel(metaLine, pxForEmu(TEXT_INSET.cx), [10, 9, 8]);
    const metaSz = metaFit.fontSizePt * 100;
    parts.push(`<p:sp>
  <p:nvSpPr><p:cNvPr id="${textId}" name="KpiText${i + 1}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${x + TEXT_INSET.x}" y="${y + TEXT_INSET.y}"/><a:ext cx="${TEXT_INSET.cx}" cy="${TEXT_INSET.cy}"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="t"/>
    <a:lstStyle/>
    <a:p>
      <a:pPr algn="l"/>
      <a:r><a:rPr lang="en-US" sz="${nameGlyphSz}" b="1" dirty="0"><a:solidFill><a:srgbClr val="${BRAND.navyDam}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${escapeXmlText(nameFit.text)}${showGlyph ? "   " : ""}</a:t></a:r>
      ${showGlyph ? `<a:r><a:rPr lang="en-US" sz="${nameGlyphSz}" b="1" dirty="0"><a:solidFill><a:srgbClr val="${statusDark}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${escapeXmlText(TREND_GLYPH[kpi.trend])}</a:t></a:r>` : ""}
    </a:p>
    <a:p>
      <a:pPr algn="ctr"><a:spcBef><a:spcPts val="600"/></a:spcBef></a:pPr>
      <a:r><a:rPr lang="en-US" sz="${valueSz}" b="1" dirty="0"><a:solidFill><a:srgbClr val="${BRAND.navyDam}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${escapeXmlText(valueFit.text)}</a:t></a:r>
    </a:p>
     <a:p>
       <a:pPr algn="ctr"><a:spcBef><a:spcPts val="200"/></a:spcBef></a:pPr>
       <a:r><a:rPr lang="en-US" sz="${metaSz}" dirty="0"><a:solidFill><a:srgbClr val="${BRAND.gray}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${escapeXmlText(metaFit.text)}</a:t></a:r>
     </a:p>
  </p:txBody>
</p:sp>`);
  });

  return { bodyXml: parts.join("\n"), shapeIds: allIds };
}

export const __internalP21 = { TILE_XS, TILE_YS, TILE_CX, TILE_CY, STATUS_BAR_CY };

