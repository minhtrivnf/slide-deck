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

// ---------------------------------------------------------------------------
// Title width model (empirically calibrated — replaces the skill's raw
// char-count rule, which proved optimistic: a 74-char Vietnamese title at
// 24pt wrapped over the master underline in rendered output).
//
// Mechanism: estimate the rendered line width of `title` in Calibri
// (advance-width buckets per character class, em fractions), convert to px
// at 96dpi for each candidate size, and accept the largest size whose
// estimated width fits the title box. Otherwise the title must be
// rewritten shorter — wrapping is never an option.
// ---------------------------------------------------------------------------

/** Approximate Calibri advance widths (em fractions). */
function charWidthEm(c: string): number {
  if (c === " " || c === "\u00A0") return 0.23;
  if ("iIljtfr.,;:'!|()[]{}".includes(c)) return 0.32;
  if ("mwMW—…→".includes(c)) return 0.85;
  if (/[\p{Lu}0-9%&×–]/u.test(c)) return 0.6;
  return 0.48; // lowercase + Vietnamese precomposed + misc
}

/** Calibration: estimated width × this ≈ measured render width (LibreOffice/Carlito). */
const WIDTH_CALIBRATION = 1.05;

/**
 * Estimated rendered width of `text` at `fontSizePt`, in px (96dpi).
 * Exported for single-line fit checks in pattern renderers (stats, KPI
 * values, labels) — the same width model as resolveActionTitleFit.
 */
export function textWidthPx(text: string, fontSizePt: number): number {
  return estimatedWidthPx(text, fontSizePt);
}

/**
 * Picks the LARGEST size from `sizes` (descending) whose estimated width
 * fits `maxWidthPx`, or throws with a message telling the caller exactly
 * how much it overflows even at the smallest size — so the LLM shortens
 * the text instead of shipping an invisible overflow.
 */
export function fitOneLine(text: string, maxWidthPx: number, sizes: number[]): number {
  for (const sz of [...sizes].sort((a, b) => b - a)) {
    if (estimatedWidthPx(text, sz) <= maxWidthPx) return sz;
  }
  const min = Math.min(...sizes.map((s) => s));
  throw new Error(
    `fitOneLine: "${text.slice(0, 40)}${text.length > 40 ? "…" : ""}" overflows at smallest size ${min}pt ` +
      `(estimated ${Math.round(estimatedWidthPx(text, min))}px > ${Math.round(maxWidthPx)}px) — rewrite shorter`
  );
}

export interface FitLabelResult {
  text: string;
  fontSizePt: number;
}

/**
 * Like fitOneLine but never throws: if even the smallest size overflows, the
 * text is trimmed to fit that size and marked with an ellipsis. Use this at
 * render time so an over-long label degrades gracefully instead of aborting
 * the deck — the prompts' char budgets keep the LLM from needing this.
 */
export function fitLabel(text: string, maxWidthPx: number, sizes: number[]): FitLabelResult {
  const ordered = [...sizes].sort((a, b) => b - a);
  for (const sz of ordered) {
    if (estimatedWidthPx(text, sz) <= maxWidthPx) return { text, fontSizePt: sz };
  }
  const min = Math.min(...ordered);
  const s = text.trim();
  let cut = s;
  while (cut.length > 1 && estimatedWidthPx(`${cut}${ELLIPSIS}`, min) > maxWidthPx) {
    cut = cut.slice(0, -1);
  }
  return { text: `${cut}${ELLIPSIS}`, fontSizePt: min };
}

/** Convenience: EMU box width → px budget for fitOneLine (0.4pt padding). */
export function pxForEmu(emu: number, paddingEmu = 9144): number {
  return emu / 9525 - paddingEmu / 9525;
}
/**
 * Usable one-line width in the standard title box (cx=8683200 EMU ≈ 912px)
 * minus safety margin. 880 chosen conservatively: a borderline string that
 * measured ~923px at 20pt must be rejected, not fitted.
 */
const TITLE_LIMIT_PX = 880;

function estimatedWidthPx(text: string, fontSizePt: number): number {
  let em = 0;
  for (const c of text) em += charWidthEm(c);
  return em * ((fontSizePt * 4) / 3) * WIDTH_CALIBRATION; // 1pt = 4/3 px em @96dpi
}

/**
 * Resolves the correct font size for an action title, or flags that the
 * title must be rewritten shorter. Returns 24pt / 20pt / reject based on
 * estimated rendered width — NOT raw char count.
 */
export function resolveActionTitleFit(title: string): { fontSizePt: 24 | 20; ok: true } | { ok: false; reason: string } {
  if (estimatedWidthPx(title, 24) <= TITLE_LIMIT_PX) return { fontSizePt: 24, ok: true };
  if (estimatedWidthPx(title, 20) <= TITLE_LIMIT_PX) return { fontSizePt: 20, ok: true };
  return {
    ok: false,
    reason: `Action title too long for one line even at 20pt (estimated ${Math.round(estimatedWidthPx(title, 20))}px > ${TITLE_LIMIT_PX}px). Rewrite shorter instead of wrapping.`,
  };
}

/**
 * Deterministic "rewrite shorter": guarantees `title` fits on one line at the
 * smallest accepted size (20pt), trimming to the previous word boundary and
 * marking the cut with an ellipsis. Falls back to character-trimming only for
 * a single over-long token. Returns the original title untouched when it
 * already fits, so callers can use this everywhere a too-long title would
 * otherwise abort the deck build.
 */
export function fitTitle(title: string, maxWidthPx: number = TITLE_LIMIT_PX): string {
  const t = title.trim();
  if (estimatedWidthPx(t, 20) <= maxWidthPx) return t;

  const words = t.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return "";

  const withEllipsis = (text: string) => `${text}${ELLIPSIS}`;
  let candidate = words.join(" ");
  while (words.length > 1 && estimatedWidthPx(withEllipsis(candidate), 20) > maxWidthPx) {
    words.pop();
    candidate = words.join(" ");
  }
  if (estimatedWidthPx(withEllipsis(candidate), 20) <= maxWidthPx) return withEllipsis(candidate);

  // A single token is still too wide: cut characters down to the budget.
  let s = candidate;
  while (s.length > 1 && estimatedWidthPx(withEllipsis(s), 20) > maxWidthPx) {
    s = s.slice(0, -1);
  }
  return withEllipsis(s);
}

const ELLIPSIS = "\u2026";
