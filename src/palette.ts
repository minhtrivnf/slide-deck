/**
 * palette.ts
 *
 * VNF brand + consultancy-extension color tokens (from slide_specs.md).
 * The LM should never hand-write a hex value in slide XML — it should
 * reference a token name here. This also makes "does this pairing violate
 * brand rules" a lookup instead of a judgement call (e.g. the documented
 * rule "never mix families, red dark + amber light").
 */

export type HexColor = string; // 6-digit hex, no '#', e.g. "002060"

// ---------------------------------------------------------------------------
// Brand palette (15-color)
// ---------------------------------------------------------------------------

export const BRAND = {
  navyChinh: "1F497D",
  navyDam: "002060",
  navyTram: "002F69",
  doChinh: "953735",
  doCritical: "C00000",
  xanhDaTroi: "D6F1FC",
  xanhSang: "0070C0",
  nauOlive: "615424",
  nauVang: "A99786",
  vangHoPhach: "E6AF00",
  vangTuoi: "FFFF00",
  xanhLa: "598C48",
  camDat: "C36518",
  bodyText: "2C2C2C",
  subtleBody: "595959",
  gray: "888888",
  lightGrayRule: "D9D9D9",
  white: "FFFFFF",
} as const satisfies Record<string, HexColor>;

export type BrandToken = keyof typeof BRAND;

// ---------------------------------------------------------------------------
// Semantic status pairs (dark fill + light background)
//
// Rule (slide_specs.md): "Always pair a dark fill with its matching light
// background. Never mix families." Encoding as pairs makes that rule
// structurally impossible to violate.
// ---------------------------------------------------------------------------

export type SemanticStatus = "success" | "warning" | "danger" | "info" | "neutral";

export const SEMANTIC: Record<SemanticStatus, { dark: HexColor; light: HexColor }> = {
  success: { dark: "2E7D32", light: "E8F5E9" },
  warning: { dark: "C97A00", light: "FFF4E0" },
  danger: { dark: "C00000", light: "FCE4E4" },
  info: { dark: "0070C0", light: "D6F1FC" },
  neutral: { dark: "595959", light: "F2F2F2" },
};

// ---------------------------------------------------------------------------
// Categorical chart palette (8 colors, ordered — series 1 first)
// ---------------------------------------------------------------------------

export const CATEGORICAL_8: readonly HexColor[] = [
  BRAND.navyDam, // 1
  BRAND.xanhSang, // 2
  BRAND.doChinh, // 3
  BRAND.xanhLa, // 4
  BRAND.vangHoPhach, // 5
  BRAND.camDat, // 6
  BRAND.nauVang, // 7
  BRAND.navyTram, // 8
] as const;

/** Returns the categorical color for a 0-indexed series, cycling if needed. */
export function categoricalColor(seriesIndex: number): HexColor {
  return CATEGORICAL_8[seriesIndex % CATEGORICAL_8.length];
}

// ---------------------------------------------------------------------------
// Sequential ramp (5 steps, light -> dark) for heat maps / choropleth
// ---------------------------------------------------------------------------

export const SEQUENTIAL_5: readonly HexColor[] = [
  "EAF2FA", // 1 lightest - lowest value
  "BFD8EC", // 2
  "7FB1D9", // 3
  "2E7BBF", // 4
  BRAND.navyDam, // 5 darkest - highest value
] as const;

/** Text color to use on a sequential-ramp cell (rule: white when step >= 3). */
export function textColorForSequentialStep(step1to5: number): HexColor {
  if (step1to5 < 1 || step1to5 > 5) {
    throw new Error(`textColorForSequentialStep: step must be 1-5, got ${step1to5}`);
  }
  return step1to5 >= 3 ? BRAND.white : BRAND.navyDam;
}

// ---------------------------------------------------------------------------
// Harvey Ball glyphs (5-step fill scale) and misc trend/check glyphs
// ---------------------------------------------------------------------------

export const HARVEY_BALLS = ["○", "◔", "◑", "◕", "●"] as const;

/** 0 = empty, 4 = full. */
export function harveyBall(fillLevel0to4: number): string {
  if (fillLevel0to4 < 0 || fillLevel0to4 > 4) {
    throw new Error(`harveyBall: fillLevel must be 0-4, got ${fillLevel0to4}`);
  }
  return HARVEY_BALLS[fillLevel0to4];
}

export const GLYPHS = {
  trendUp: "▲",
  trendFlat: "◆",
  trendDown: "▼",
  check: "✓",
  cross: "✗",
  arrow: "→",
} as const;
