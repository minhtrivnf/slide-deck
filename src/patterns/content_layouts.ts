/**
 * patterns/content_layouts.ts
 *
 * Real slide content renderers for every non-P11 pattern. Each layout draws
 * VNF-branded shapes from the structured PatternContent the specs LLM
 * produced, so slides get actual content instead of a "[Pattern placeholder]".
 *
 * Geometry follows the zone model: content runs from 3.4cm to 15.0cm, the
 * source line sits at 15.1cm, and the takeaway/tagline at 16.2cm. The
 * 17.5-18.2cm band is reserved for the slide master and never touched.
 */

import { renderFilledTextBox, renderBulletListBox } from "../templates/common.js";
import { ShapeIdAllocator } from "../ids.js";
import { BRAND, SEMANTIC, categoricalColor } from "../palette.js";
import { cmToEmu, ZONES } from "../units.js";
import type { PatternContent } from "../agent/pattern_spec.js";

export interface ContentLayoutResult {
  /** XML fragments for the content region (title/source/tagline excluded). */
  bodyXml: string;
  /** Every shape id allocated, for Gate A uniqueness checks. */
  shapeIds: number[];
}

const CONTENT_X = cmToEmu(1.27);
const CONTENT_W = cmToEmu(22.86);
const CONTENT_Y = ZONES.content.yStart; // 3.4cm
const CONTENT_BOTTOM = ZONES.content.yEnd; // 15.0cm
const GAP = cmToEmu(0.32);
const CONTENT_H = CONTENT_BOTTOM - CONTENT_Y;

function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function colWidths(count: number): number {
  return (CONTENT_W - GAP * (count - 1)) / count;
}

// ---------------------------------------------------------------------------
// P1 / P2 — stat callout cards
// ---------------------------------------------------------------------------

function renderStatCards(ids: ShapeIdAllocator, stats: PatternContent["stats"]): ContentLayoutResult {
  const items = (stats ?? []).slice(0, 3);
  const n = clampInt(items.length, 1, 3);
  const cardW = colWidths(n);
  const cardY = CONTENT_Y + cmToEmu(0.4);
  const cardH = cmToEmu(7.0);
  const pieces: string[] = [];
  const shapeIds: number[] = [];

  items.slice(0, n).forEach((stat, i) => {
    const x = CONTENT_X + i * (cardW + GAP);
    const boxId = ids.alloc();
    shapeIds.push(boxId);
    pieces.push(
      renderFilledTextBox({
        shapeId: boxId,
        name: `StatCard${i + 1}`,
        rect: { x, y: cardY, cx: cardW, cy: cardH },
        text: "",
        fontSizePt: 1,
        textColorHex: BRAND.white,
        fillHex: SEMANTIC.info.light,
        roundedCornerAdj: 4500,
      })
    );
    const valueId = ids.alloc();
    shapeIds.push(valueId);
    pieces.push(
      renderFilledTextBox({
        shapeId: valueId,
        name: `StatValue${i + 1}`,
        rect: { x, y: cardY + cmToEmu(0.4), cx: cardW, cy: cmToEmu(3.6) },
        text: stat.value,
        fontSizePt: 40,
        bold: true,
        textColorHex: BRAND.navyDam,
        align: "ctr",
        anchor: "ctr",
      })
    );
    const labelId = ids.alloc();
    shapeIds.push(labelId);
    pieces.push(
      renderFilledTextBox({
        shapeId: labelId,
        name: `StatLabel${i + 1}`,
        rect: { x: x + cmToEmu(0.3), y: cardY + cmToEmu(4.1), cx: cardW - cmToEmu(0.6), cy: cmToEmu(1.4) },
        text: stat.label,
        fontSizePt: 13,
        bold: true,
        textColorHex: BRAND.bodyText,
        align: "ctr",
        anchor: "t",
      })
    );
    if (stat.note) {
      const noteId = ids.alloc();
      shapeIds.push(noteId);
      pieces.push(
        renderFilledTextBox({
          shapeId: noteId,
          name: `StatNote${i + 1}`,
          rect: { x: x + cmToEmu(0.3), y: cardY + cmToEmu(5.4), cx: cardW - cmToEmu(0.6), cy: cmToEmu(1.2) },
          text: stat.note,
          fontSizePt: 10,
          textColorHex: BRAND.gray,
          align: "ctr",
          anchor: "t",
        })
      );
    }
  });

  return { bodyXml: pieces.join("\n"), shapeIds };
}

// ---------------------------------------------------------------------------
// P3 / P21 — data table (matrix: first row = headers)
// ---------------------------------------------------------------------------

function renderTable(ids: ShapeIdAllocator, matrix: PatternContent["matrix"]): ContentLayoutResult {
  const rows = (matrix ?? []).slice(0, 9);
  const pieces: string[] = [];
  const shapeIds: number[] = [];
  if (rows.length === 0) return renderBullets(ids, []);

  const colCount = clampInt(Math.max(...rows.map((r) => r.length), 1), 1, 6);
  const colW = CONTENT_W / colCount;
  const headerH = cmToEmu(1.2);
  const rowH = cmToEmu(1.0);
  const bodyRows = rows.slice(1).slice(0, 8);

  const headerY = CONTENT_Y;
  rows[0].slice(0, colCount).forEach((header, c) => {
    const id = ids.alloc();
    shapeIds.push(id);
    pieces.push(
      renderFilledTextBox({
        shapeId: id,
        name: "TblHeader",
        rect: { x: CONTENT_X + c * colW, y: headerY, cx: colW, cy: headerH },
        text: header,
        fontSizePt: 12,
        bold: true,
        textColorHex: BRAND.white,
        fillHex: BRAND.navyDam,
        align: "ctr",
        anchor: "ctr",
      })
    );
  });

  bodyRows.forEach((row, r) => {
    const y = headerY + headerH + r * rowH;
    const rowFill = r % 2 === 0 ? SEMANTIC.neutral.light : BRAND.white;
    row.slice(0, colCount).forEach((cell, c) => {
      const id = ids.alloc();
      shapeIds.push(id);
      pieces.push(
        renderFilledTextBox({
          shapeId: id,
          name: "TblCell",
          rect: { x: CONTENT_X + c * colW, y, cx: colW, cy: rowH },
          text: cell,
          fontSizePt: 11,
          textColorHex: BRAND.bodyText,
          fillHex: rowFill,
          align: "l",
          anchor: "ctr",
        })
      );
    });
  });

  return { bodyXml: pieces.join("\n"), shapeIds };
}

// ---------------------------------------------------------------------------
// P4 / P17 / P24 — ordered steps (process flow / roadmap / build)
// ---------------------------------------------------------------------------

function renderSteps(ids: ShapeIdAllocator, steps: PatternContent["steps"]): ContentLayoutResult {
  const items = (steps ?? []).slice(0, 6);
  const n = clampInt(items.length, 1, 6);
  const stepW = colWidths(n);
  const stepY = CONTENT_Y + cmToEmu(0.4);
  const stepH = cmToEmu(5.6);
  const pieces: string[] = [];
  const shapeIds: number[] = [];

  items.slice(0, n).forEach((step, i) => {
    const x = CONTENT_X + i * (stepW + GAP);
    const boxId = ids.alloc();
    shapeIds.push(boxId);
    pieces.push(
      renderFilledTextBox({
        shapeId: boxId,
        name: `StepBox${i + 1}`,
        rect: { x, y: stepY, cx: stepW, cy: stepH },
        text: "",
        fontSizePt: 1,
        textColorHex: BRAND.white,
        fillHex: categoricalColor(i),
        roundedCornerAdj: 6000,
      })
    );
    const numId = ids.alloc();
    shapeIds.push(numId);
    pieces.push(
      renderFilledTextBox({
        shapeId: numId,
        name: `StepNum${i + 1}`,
        rect: { x: x + cmToEmu(0.3), y: stepY + cmToEmu(0.3), cx: stepW - cmToEmu(0.6), cy: cmToEmu(1.0) },
        text: `${i + 1}. ${step.title}`,
        fontSizePt: 15,
        bold: true,
        textColorHex: BRAND.white,
        align: "ctr",
        anchor: "ctr",
      })
    );
    if (step.detail) {
      const detId = ids.alloc();
      shapeIds.push(detId);
      pieces.push(
        renderFilledTextBox({
          shapeId: detId,
          name: `StepDetail${i + 1}`,
          rect: { x: x + cmToEmu(0.3), y: stepY + cmToEmu(1.4), cx: stepW - cmToEmu(0.6), cy: stepH - cmToEmu(1.7) },
          text: step.detail,
          fontSizePt: 11,
          textColorHex: BRAND.white,
          align: "ctr",
          anchor: "t",
        })
      );
    }
  });

  return { bodyXml: pieces.join("\n"), shapeIds };
}

// ---------------------------------------------------------------------------
// P5 — icon grid 2x2
// ---------------------------------------------------------------------------

function renderGrid(ids: ShapeIdAllocator, items: PatternContent["items"]): ContentLayoutResult {
  const cells = (items ?? []).slice(0, 4);
  const boxW = colWidths(2);
  const boxH = cmToEmu(5.2);
  const yTop = CONTENT_Y + cmToEmu(0.3);
  const yBottom = yTop + boxH + GAP;
  const pieces: string[] = [];
  const shapeIds: number[] = [];

  cells.forEach((cell, i) => {
    const x = CONTENT_X + (i % 2) * (boxW + GAP);
    const y = i < 2 ? yTop : yBottom;
    const id = ids.alloc();
    shapeIds.push(id);
    pieces.push(
      renderFilledTextBox({
        shapeId: id,
        name: `GridCell${i + 1}`,
        rect: { x, y, cx: boxW, cy: boxH },
        text: cell,
        fontSizePt: 14,
        bold: true,
        textColorHex: BRAND.navyDam,
        fillHex: SEMANTIC.info.light,
        roundedCornerAdj: 4500,
        align: "ctr",
        anchor: "ctr",
      })
    );
  });

  return { bodyXml: pieces.join("\n"), shapeIds };
}

// ---------------------------------------------------------------------------
// P6 / P13 — quadrant matrix (SWOT / BCG 2x2)
// ---------------------------------------------------------------------------

function renderQuadrants(ids: ShapeIdAllocator, quadrants: PatternContent["quadrants"]): ContentLayoutResult {
  const qs = (quadrants ?? []).slice(0, 4);
  const boxW = colWidths(2);
  const headerH = cmToEmu(1.1);
  const bodyH = cmToEmu(4.1);
  const boxH = headerH + bodyH;
  const yTop = CONTENT_Y + cmToEmu(0.3);
  const yBottom = yTop + boxH + GAP;
  const pieces: string[] = [];
  const shapeIds: number[] = [];

  qs.forEach((q, i) => {
    const x = CONTENT_X + (i % 2) * (boxW + GAP);
    const y = i < 2 ? yTop : yBottom;
    const headerId = ids.alloc();
    shapeIds.push(headerId);
    pieces.push(
      renderFilledTextBox({
        shapeId: headerId,
        name: `QuadHeader${i + 1}`,
        rect: { x, y, cx: boxW, cy: headerH },
        text: q.label,
        fontSizePt: 13,
        bold: true,
        textColorHex: BRAND.white,
        fillHex: categoricalColor(i),
        align: "ctr",
        anchor: "ctr",
      })
    );
    if (q.points?.length) {
      const bodyId = ids.alloc();
      shapeIds.push(bodyId);
      pieces.push(
        renderBulletListBox({
          shapeId: bodyId,
          name: `QuadBody${i + 1}`,
          rect: { x: x + cmToEmu(0.2), y: y + headerH, cx: boxW - cmToEmu(0.4), cy: bodyH },
          bullets: q.points.slice(0, 5),
          fontSizePt: 12,
        })
      );
    }
  });

  return { bodyXml: pieces.join("\n"), shapeIds };
}

// ---------------------------------------------------------------------------
// P7 — layer divider (full-region big title)
// ---------------------------------------------------------------------------

export function renderDivider(ids: ShapeIdAllocator, spec: PatternContent): ContentLayoutResult {
  const pieces: string[] = [];
  const shapeIds: number[] = [];
  const titleId = ids.alloc();
  shapeIds.push(titleId);
  pieces.push(
    renderFilledTextBox({
      shapeId: titleId,
      name: "DividerTitle",
      rect: { x: CONTENT_X, y: cmToEmu(4.5), cx: CONTENT_W, cy: cmToEmu(4.0) },
      text: spec.title,
      fontSizePt: 32,
      bold: true,
      textColorHex: BRAND.navyDam,
      align: "ctr",
      anchor: "ctr",
    })
  );
  const subtitle = spec.items?.[0];
  if (subtitle) {
    const subId = ids.alloc();
    shapeIds.push(subId);
    pieces.push(
      renderFilledTextBox({
        shapeId: subId,
        name: "DividerSubtitle",
        rect: { x: CONTENT_X, y: cmToEmu(8.6), cx: CONTENT_W, cy: cmToEmu(1.4) },
        text: subtitle,
        fontSizePt: 18,
        textColorHex: BRAND.subtleBody,
        align: "ctr",
        anchor: "ctr",
      })
    );
  }
  return { bodyXml: pieces.join("\n"), shapeIds };
}

// ---------------------------------------------------------------------------
// P8 — quote highlight
// ---------------------------------------------------------------------------

function renderQuote(ids: ShapeIdAllocator, spec: PatternContent): ContentLayoutResult {
  const pieces: string[] = [];
  const shapeIds: number[] = [];
  const quoteId = ids.alloc();
  shapeIds.push(quoteId);
  pieces.push(
    renderFilledTextBox({
      shapeId: quoteId,
      name: "QuoteText",
      rect: { x: CONTENT_X + cmToEmu(1.5), y: cmToEmu(4.2), cx: CONTENT_W - cmToEmu(3.0), cy: cmToEmu(5.2) },
      text: `“${spec.quote ?? ""}”`,
      fontSizePt: 26,
      bold: false,
      italic: true,
      textColorHex: BRAND.navyDam,
      align: "ctr",
      anchor: "ctr",
    })
  );
  if (spec.quoteSource) {
    const srcId = ids.alloc();
    shapeIds.push(srcId);
    pieces.push(
      renderFilledTextBox({
        shapeId: srcId,
        name: "QuoteSource",
        rect: { x: CONTENT_X, y: cmToEmu(10.0), cx: CONTENT_W, cy: cmToEmu(1.2) },
        text: `— ${spec.quoteSource}`,
        fontSizePt: 14,
        textColorHex: BRAND.subtleBody,
        align: "ctr",
        anchor: "ctr",
      })
    );
  }
  return { bodyXml: pieces.join("\n"), shapeIds };
}

// ---------------------------------------------------------------------------
// P9 / P12 — horizontal bars
// ---------------------------------------------------------------------------

function renderBars(ids: ShapeIdAllocator, bars: PatternContent["bars"]): ContentLayoutResult {
  const items = (bars ?? []).slice(0, 8);
  const pieces: string[] = [];
  const shapeIds: number[] = [];
  if (items.length === 0) return renderBullets(ids, []);

  const labelW = cmToEmu(7.0);
  const barX = CONTENT_X + labelW + GAP;
  const valueW = cmToEmu(1.4);
  const barMaxW = CONTENT_W - labelW - GAP - valueW - cmToEmu(0.4);
  const barH = cmToEmu(0.6);
  const rowH = cmToEmu(0.85);
  const y0 = CONTENT_Y + cmToEmu(0.4);
  const maxV = Math.max(...items.map((b) => b.value), 1);

  items.forEach((b, i) => {
    const y = y0 + i * rowH;
    const labelId = ids.alloc();
    shapeIds.push(labelId);
    pieces.push(
      renderFilledTextBox({
        shapeId: labelId,
        name: `BarLabel${i + 1}`,
        rect: { x: CONTENT_X, y, cx: labelW, cy: barH },
        text: b.label,
        fontSizePt: 12,
        textColorHex: BRAND.bodyText,
        align: "r",
        anchor: "ctr",
      })
    );
    const w = Math.max(cmToEmu(0.2), (b.value / maxV) * barMaxW);
    const barId = ids.alloc();
    shapeIds.push(barId);
    pieces.push(
      renderFilledTextBox({
        shapeId: barId,
        name: `Bar${i + 1}`,
        rect: { x: barX, y, cx: w, cy: barH },
        text: "",
        fontSizePt: 1,
        textColorHex: BRAND.white,
        fillHex: categoricalColor(i),
      })
    );
    const valId = ids.alloc();
    shapeIds.push(valId);
    pieces.push(
      renderFilledTextBox({
        shapeId: valId,
        name: `BarValue${i + 1}`,
        rect: { x: barX + w + cmToEmu(0.1), y, cx: valueW, cy: barH },
        text: String(b.value),
        fontSizePt: 12,
        bold: true,
        textColorHex: BRAND.navyDam,
        align: "l",
        anchor: "ctr",
      })
    );
  });

  return { bodyXml: pieces.join("\n"), shapeIds };
}

// ---------------------------------------------------------------------------
// P10 / P19 — pillar columns (executive summary / three-horizon)
// ---------------------------------------------------------------------------

function renderPillars(ids: ShapeIdAllocator, pillars: PatternContent["pillars"]): ContentLayoutResult {
  const cols = (pillars ?? []).slice(0, 3);
  const n = clampInt(cols.length, 1, 3);
  const colW = colWidths(n);
  const headerH = cmToEmu(1.4);
  const headerY = CONTENT_Y + cmToEmu(0.2);
  const bodyY = headerY + headerH + GAP;
  const bodyH = CONTENT_BOTTOM - bodyY;
  const pieces: string[] = [];
  const shapeIds: number[] = [];

  cols.slice(0, n).forEach((p, i) => {
    const x = CONTENT_X + i * (colW + GAP);
    const headerId = ids.alloc();
    shapeIds.push(headerId);
    pieces.push(
      renderFilledTextBox({
        shapeId: headerId,
        name: `PillarHeader${i + 1}`,
        rect: { x, y: headerY, cx: colW, cy: headerH },
        text: p.title,
        fontSizePt: 14,
        bold: true,
        textColorHex: BRAND.white,
        fillHex: BRAND.navyDam,
        align: "ctr",
        anchor: "ctr",
      })
    );
    if (p.points?.length) {
      const bodyId = ids.alloc();
      shapeIds.push(bodyId);
      pieces.push(
        renderBulletListBox({
          shapeId: bodyId,
          name: `PillarBody${i + 1}`,
          rect: { x: x + cmToEmu(0.2), y: bodyY, cx: colW - cmToEmu(0.4), cy: bodyH },
          bullets: p.points.slice(0, 6),
          fontSizePt: 12,
        })
      );
    }
  });

  return { bodyXml: pieces.join("\n"), shapeIds };
}

// ---------------------------------------------------------------------------
// P22 / P23 / fallback — bullet lists (agenda, source/method, generic)
// ---------------------------------------------------------------------------

function renderBullets(ids: ShapeIdAllocator, items: PatternContent["items"], numbered = false): ContentLayoutResult {
  const bullets = (items ?? []).slice(0, 9);
  if (bullets.length === 0) {
    const id = ids.alloc();
    return {
      bodyXml: renderFilledTextBox({
        shapeId: id,
        name: "EmptyContent",
        rect: { x: CONTENT_X, y: CONTENT_Y, cx: CONTENT_W, cy: CONTENT_H },
        text: "Nội dung slide chưa được cung cấp.",
        fontSizePt: 13,
        textColorHex: BRAND.subtleBody,
        align: "l",
        anchor: "t",
      }),
      shapeIds: [id],
    };
  }
  const text = numbered ? bullets.map((b, i) => `${i + 1}. ${b}`) : bullets;
  const id = ids.alloc();
  return {
    bodyXml: renderBulletListBox({
      shapeId: id,
      name: numbered ? "NumberedList" : "BulletList",
      rect: { x: CONTENT_X, y: CONTENT_Y, cx: CONTENT_W, cy: CONTENT_H },
      bullets: text,
      fontSizePt: numbered ? 16 : 14,
      bulletGlyph: numbered ? "" : "•",
    }),
    shapeIds: [id],
  };
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

const RENDERS: Record<string, (ids: ShapeIdAllocator, spec: PatternContent) => ContentLayoutResult> = {
  P1: (ids, s) => renderStatCards(ids, s.stats),
  P2: (ids, s) => renderStatCards(ids, s.stats),
  P3: (ids, s) => renderTable(ids, s.matrix),
  P4: (ids, s) => renderSteps(ids, s.steps),
  P5: (ids, s) => renderGrid(ids, s.items),
  P6: (ids, s) => renderQuadrants(ids, s.quadrants),
  P8: (ids, s) => renderQuote(ids, s),
  P9: (ids, s) => renderBars(ids, s.bars),
  P10: (ids, s) => renderPillars(ids, s.pillars),
  P12: (ids, s) => renderBars(ids, s.bars),
  P13: (ids, s) => renderQuadrants(ids, s.quadrants),
  P14: (ids, s) => renderStatCards(ids, s.stats),
  P15: (ids, s) => renderTable(ids, s.matrix),
  P16: (ids, s) => renderSteps(ids, s.steps),
  P17: (ids, s) => renderSteps(ids, s.steps),
  P18: (ids, s) => renderStatCards(ids, s.stats),
  P19: (ids, s) => renderPillars(ids, s.pillars),
  P20: (ids, s) => renderGrid(ids, s.items),
  P21: (ids, s) => renderTable(ids, s.matrix),
  P22: (ids, s) => renderBullets(ids, s.items, true),
  P23: (ids, s) => renderBullets(ids, s.items, false),
  P24: (ids, s) => renderSteps(ids, s.steps),
};

/**
 * Renders the content region for a non-P11 pattern using the caller's shape
 * allocator (so IDs never collide with the title/source/tagline shapes).
 * P7 (divider) and P8 (quote) produce their own full-region layout; all others
 * render the block between the action title and the source/tagline zones.
 */
export function renderContentRegion(pattern: string, rawSpec: unknown, ids: ShapeIdAllocator): ContentLayoutResult {
  const renderer = RENDERS[pattern];
  if (!renderer) {
    return renderBullets(ids, (rawSpec as PatternContent)?.items);
  }
  return renderer(ids, rawSpec as PatternContent);
}
