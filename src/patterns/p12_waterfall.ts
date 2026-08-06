/**
 * patterns/p12_waterfall.ts
 *
 * Renders Pattern 12 (Waterfall / Bridge Chart). Geometry from
 * slide_patterns.md P12: 6 slots at step 1200000 starting x=457200
 * (doc's listed xs 457200/1700000/2900000/.../6500000 are that same
 * arithmetic series within ≤42 800 EMU), bar cx=1100000.
 *
 * DEVIATION FROM DOC (justified): the doc's baseline y=5400000 collides
 * with Zone 3 (source line at y=5436000..5616000) whenever a waterfall
 * slide carries a source citation — leaving no legal band for the
 * under-baseline driver names. Baseline is lifted to y=4980000 so the
 * stack [plot 1800000..4980000] → [names 5040000..5380000] → [source
 * 5436000..5616000] → [tagline 5832000..6264000] never overlaps.
 *
 * Component rules from slide_templates.md P12: anchors `002060`, positive
 * delta `2E7D32`, negative `C00000`, dashed `D9D9D9` connectors between
 * bar tops, delta labels 12pt bold above bars, driver names 10pt below
 * the baseline.
 */

import { ShapeIdAllocator } from "../ids.js";
import { renderConnector } from "../geometry/connectors.js";
import { BRAND, SEMANTIC } from "../palette.js";
import { fitLabel, pxForEmu } from "../units.js";
import { renderRect } from "../templates/common.js";
import { escapeXmlText } from "../xml.js";
import { Pattern12WaterfallSpecSchema, type Pattern12WaterfallSpec } from "../types.js";

const SLOT_X0 = 457200;
const SLOT_STEP = 1200000;
const BAR_CX = 1100000;
const BASELINE_Y = 4980000;
const PLOT_CY = 3180000; // 4980000 - 1800000
const DELTA_LABEL_CY = 252000;
const NAME_Y = 5040000;
const NAME_CY = 340000;

export interface RenderedWaterfall {
  bodyXml: string;
  shapeIds: number[];
}

interface BarGeom {
  x: number;
  y: number;
  cy: number;
  fillHex: string;
  labelAbove: string;
  nameBelow: string;
  levelAfter: number;
}

export function renderPattern12Waterfall(rawSpec: unknown, slideNumber: number): RenderedWaterfall {
  const spec: Pattern12WaterfallSpec = Pattern12WaterfallSpecSchema.parse(rawSpec);

  const endValue = spec.end?.value ?? spec.start.value + spec.drivers.reduce((s, d) => s + d.delta, 0);
  if (endValue <= 0) throw new Error("P12: end value must be > 0 (bridge goes below zero — restate values)");

  // Cumulative levels, guarded: bridges below the baseline are out of model.
  const levels: number[] = [spec.start.value];
  spec.drivers.forEach((d) => levels.push(levels[levels.length - 1] + d.delta));
  levels.push(endValue);
  levels.forEach((lv, i) => {
    if (lv < 0) throw new Error(`P12: cumulative level after bar ${i} is ${lv} < 0 — restate the bridge`);
  });

  const maxLevel = Math.max(...levels);
  const scale = PLOT_CY / maxLevel;
  const fmt = (v: number, signed: boolean): string =>
    `${signed && v > 0 ? "+" : v < 0 ? "–" : ""}${Math.abs(v)}${spec.unit ? " " + spec.unit : ""}`;

  const bars: BarGeom[] = [];
  // Start anchor
  bars.push({
    x: SLOT_X0,
    y: BASELINE_Y - Math.round(spec.start.value * scale),
    cy: Math.round(spec.start.value * scale),
    fillHex: BRAND.navyDam,
    labelAbove: fmt(spec.start.value, false),
    nameBelow: spec.start.label,
    levelAfter: spec.start.value,
  });
  // Driver bars (float between levels)
  spec.drivers.forEach((d, i) => {
    const prev = levels[i];
    const next = levels[i + 1];
    bars.push({
      x: SLOT_X0 + (i + 1) * SLOT_STEP,
      y: BASELINE_Y - Math.round(Math.max(prev, next) * scale),
      cy: Math.round(Math.abs(next - prev) * scale),
      fillHex: d.delta >= 0 ? SEMANTIC.success.dark : SEMANTIC.danger.dark,
      labelAbove: fmt(d.delta, true),
      nameBelow: d.label,
      levelAfter: next,
    });
  });
  // End anchor
  const lastX = SLOT_X0 + (spec.drivers.length + 1) * SLOT_STEP;
  bars.push({
    x: lastX,
    y: BASELINE_Y - Math.round(endValue * scale),
    cy: Math.round(endValue * scale),
    fillHex: BRAND.navyDam,
    labelAbove: fmt(endValue, false),
    nameBelow: spec.end?.label ?? "End",
    levelAfter: endValue,
  });

  const ids = new ShapeIdAllocator(slideNumber);
  const allIds: number[] = [];
  const parts: string[] = [];

  bars.forEach((bar, i) => {
    const barId = ids.alloc();
    const lblId = ids.alloc();
    const nameId = ids.alloc();
    allIds.push(barId, lblId, nameId);
    // Fit cỡ chữ theo width thật — label/name dài tự giảm, fallback cắt + "…"
    const deltaFit = fitLabel(bar.labelAbove, pxForEmu(BAR_CX), [12, 11, 10]);
    const nameFit = fitLabel(bar.nameBelow, pxForEmu(BAR_CX + 100000), [10, 9, 8]);
    const deltaSz = deltaFit.fontSizePt * 100;
    const nameSz = nameFit.fontSizePt * 100;
    parts.push(renderRect({ shapeId: barId, name: `WfBar${i + 1}`, rect: { x: bar.x, y: bar.y, cx: BAR_CX, cy: bar.cy }, fillHex: bar.fillHex }));
    parts.push(`<p:sp>
  <p:nvSpPr><p:cNvPr id="${lblId}" name="WfDelta${i + 1}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${bar.x}" y="${bar.y - DELTA_LABEL_CY}"/><a:ext cx="${BAR_CX}" cy="${DELTA_LABEL_CY}"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/>
  </p:spPr>
  <p:txBody><a:bodyPr wrap="square" anchor="b" lIns="0" tIns="0" rIns="0" bIns="0"><a:noAutofit/></a:bodyPr><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" sz="${deltaSz}" b="1" dirty="0"><a:solidFill><a:srgbClr val="${BRAND.bodyText}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${escapeXmlText(deltaFit.text)}</a:t></a:r></a:p></p:txBody>
</p:sp>`);
    parts.push(`<p:sp>
  <p:nvSpPr><p:cNvPr id="${nameId}" name="WfName${i + 1}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${bar.x - 50000}" y="${NAME_Y}"/><a:ext cx="${BAR_CX + 100000}" cy="${NAME_CY}"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/>
  </p:spPr>
  <p:txBody><a:bodyPr wrap="square" anchor="t" lIns="0" tIns="0" rIns="0" bIns="0"><a:noAutofit/></a:bodyPr><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" sz="${nameSz}" dirty="0"><a:solidFill><a:srgbClr val="${BRAND.subtleBody}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${escapeXmlText(nameFit.text)}</a:t></a:r></a:p></p:txBody>
</p:sp>`);
  });

  // Dashed connectors between bar tops at the carried level
  for (let i = 0; i < bars.length - 1; i++) {
    const connId = ids.alloc();
    allIds.push(connId);
    const levelY = BASELINE_Y - Math.round(bars[i].levelAfter * scale);
    parts.push(
      renderConnector({
        connectorShapeId: connId,
        name: `WfConn${i + 1}`,
        from: { x: bars[i].x + BAR_CX, y: levelY },
        to: { x: bars[i + 1].x, y: levelY },
        colorHex: BRAND.lightGrayRule,
        weightEmu: 9525,
        dash: "dash",
      })
    );
  }

  return { bodyXml: parts.join("\n"), shapeIds: allIds };
}

export const __internalP12 = { SLOT_X0, SLOT_STEP, BAR_CX, BASELINE_Y, PLOT_CY, NAME_Y };

