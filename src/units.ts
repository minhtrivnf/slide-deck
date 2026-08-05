/**
 * units.ts
 *
 * Single source of truth for VNF slide geometry constants (from
 * references/slide_specs.md). Every value here was previously computed
 * by hand (in the LM's head) on every slide. Centralizing it means the
 * LM never states an EMU coordinate again — it states semantic
 * positions ("zone 4", "column 3 through 6") and this module resolves
 * them.
 */

// ---------------------------------------------------------------------------
// Base unit conversions
// ---------------------------------------------------------------------------

/** English Metric Units per centimeter. */
export const EMU_PER_CM = 360000;
/** English Metric Units per inch. */
export const EMU_PER_INCH = 914400;
/** English Metric Units per point. */
export const EMU_PER_PT = 12700;

export function cmToEmu(cm: number): number {
  return Math.round(cm * EMU_PER_CM);
}

export function inchToEmu(inch: number): number {
  return Math.round(inch * EMU_PER_INCH);
}

export function ptToEmu(pt: number): number {
  return Math.round(pt * EMU_PER_PT);
}

export function emuToCm(emu: number): number {
  return emu / EMU_PER_CM;
}

// ---------------------------------------------------------------------------
// Slide canvas (VNF 4:3 standard)
// ---------------------------------------------------------------------------

export const SLIDE = {
  /** 25.40 cm */
  widthEmu: cmToEmu(25.4),
  /** 19.05 cm */
  heightEmu: cmToEmu(19.05),
  /** 1.27 cm on all sides */
  safeMarginEmu: cmToEmu(1.27),
} as const;

// ---------------------------------------------------------------------------
// 12-column grid (1.91 cm column, 0.32 cm gutter)
// ---------------------------------------------------------------------------

export const GRID = {
  columns: 12,
  columnWidthEmu: cmToEmu(1.91),
  gutterEmu: cmToEmu(0.32),
  marginEmu: SLIDE.safeMarginEmu,
} as const;

/**
 * Resolves the x-offset and width (in EMU) for a span of grid columns.
 * Columns are 1-indexed and inclusive, matching how a person would say
 * "columns 3 to 6".
 *
 * @example gridSpan(1, 12) // full-width content row inside the safe margin
 * @example gridSpan(7, 12) // right half of the slide
 */
export function gridSpan(fromCol: number, toCol: number): { x: number; cx: number } {
  if (fromCol < 1 || toCol < fromCol || toCol > GRID.columns) {
    throw new Error(
      `gridSpan: invalid column range [${fromCol}, ${toCol}] for a ${GRID.columns}-column grid`
    );
  }
  const colStep = GRID.columnWidthEmu + GRID.gutterEmu;
  const x = GRID.marginEmu + (fromCol - 1) * colStep;
  const spanCols = toCol - fromCol + 1;
  const cx = spanCols * GRID.columnWidthEmu + (spanCols - 1) * GRID.gutterEmu;
  return { x, cx };
}

// ---------------------------------------------------------------------------
// Vertical zones (from slide_specs.md "Zone Rules")
//
// Bottom-stack order (top -> bottom): Content -> Source -> Tagline -> Footer.
// The 17.5-18.2cm band is reserved for master decorations; nothing must be
// placed there by generated slide XML.
// ---------------------------------------------------------------------------

export const ZONES = {
  title: { y: 0, cyActionTitle: cmToEmu(3.0), cyShortTitle: cmToEmu(2.0) },
  content: { yStart: cmToEmu(3.4), yEnd: cmToEmu(15.0) },
  source: { y: cmToEmu(15.1), cy: cmToEmu(0.5) },
  tagline: { y: cmToEmu(16.2), cy: cmToEmu(1.2) },
  /** Reserved for the slide master. Never place shapes with y in this band. */
  masterReservedBand: { yStart: cmToEmu(17.5), yEnd: cmToEmu(18.2) },
  footer: { y: cmToEmu(18.21), cy: cmToEmu(0.85) },
} as const;

/**
 * Guards against the exact regression class documented in the skill
 * (source line / tagline colliding with the master's footer separator).
 * Throws if a shape's vertical extent intrudes into the reserved band.
 */
export function assertNoMasterBandCollision(yEmu: number, cyEmu: number): void {
  const shapeBottom = yEmu + cyEmu;
  const { yStart, yEnd } = ZONES.masterReservedBand;
  const intrudes = yEmu < yEnd && shapeBottom > yStart;
  if (intrudes) {
    throw new Error(
      `Shape at y=${yEmu} cy=${cyEmu} intrudes into the master-reserved band ` +
        `[${yStart}, ${yEnd}] (17.5-18.2cm). Move it above ${yStart} or remove it.`
    );
  }
}

// ---------------------------------------------------------------------------
// Title length rules (v2.2, strict — see slide_specs.md "ZONE 1 - TITLE")
// ---------------------------------------------------------------------------

export type TitleFit = { fontSizePt: 24 | 20; wraps: false } | { fontSizePt: never; wraps: true };

/**
 * Resolves the correct font size for an action title given its character
 * count, or flags that the title must be rewritten shorter. This replaces
 * the LM manually deciding "is this 80 or 100 chars" — a frequent source
 * of the 2-line-wrap regression.
 */
export function resolveActionTitleFit(title: string): { fontSizePt: 24 | 20; ok: true } | { ok: false; reason: string } {
  const len = title.length;
  if (len <= 80) return { fontSizePt: 24, ok: true };
  if (len <= 100) return { fontSizePt: 20, ok: true };
  return {
    ok: false,
    reason: `Action title is ${len} chars (>100). Rewrite shorter instead of wrapping — see slide_specs.md.`,
  };
}
