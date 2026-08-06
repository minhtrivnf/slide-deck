/**
 * types.ts
 *
 * Zod schemas define the contract between the LM (which produces JSON)
 * and the pattern renderers (which produce XML). Validating here means a
 * malformed slide spec fails fast with a readable message *before* any
 * XML is generated — instead of surfacing later as a Gate A/B failure or,
 * worse, a silent layout bug only Gate C (visual spot-check) catches.
 *
 * Every pattern (P1–P24) has its own schema here; each hard-coded
 * renderer in src/patterns/ parses its spec through its schema.
 */

import { z } from "zod";

export const HexColorSchema = z
  .string()
  .regex(/^[0-9A-Fa-f]{6}$/, "must be a 6-digit hex color without '#' (e.g. \"002060\")");

// ---------------------------------------------------------------------------
// Shared enums
// ---------------------------------------------------------------------------

/** Semantic status, mirrored from palette.ts (dark/light pairs). */
export const SemanticStatusSchema = z.enum(["success", "warning", "danger", "info", "neutral"]);
export type SemanticStatusName = z.infer<typeof SemanticStatusSchema>;

/** Trend direction used by KPI tiles and driver-tree deltas. */
export const TrendDirectionSchema = z.enum(["up", "down", "flat"]);

// ---------------------------------------------------------------------------
// Pattern 1 & 2 — Stat Callout (3-col / 2-col)
// ---------------------------------------------------------------------------

export const StatCardSchema = z.object({
  category: z.string().min(1).max(40),
  stat: z.string().min(1).max(40),
  label: z.string().min(1).max(60),
  bullets: z.array(z.string().min(1).max(120)).max(4),
  accentColorHex: HexColorSchema.optional(),
});

export const Pattern1StatCalloutSpecSchema = z.object({
  pattern: z.enum(["P1", "P2"]),
  cards: z.array(StatCardSchema).min(1).max(3),
});

export type Pattern1StatCalloutSpec = z.infer<typeof Pattern1StatCalloutSpecSchema>;

// ---------------------------------------------------------------------------
// Pattern 3 — Data Table
// ---------------------------------------------------------------------------

export const Pattern3DataTableSpecSchema = z.object({
  headers: z.array(z.string().min(1).max(60)).min(1).max(8),
  rows: z.array(z.array(z.string().max(120)).min(1).max(8)).min(1).max(24),
  totalRow: z.boolean().optional(),
});

export type Pattern3DataTableSpec = z.infer<typeof Pattern3DataTableSpecSchema>;

// ---------------------------------------------------------------------------
// Pattern 4 — Process Flow / Timeline
// ---------------------------------------------------------------------------

export const Pattern4ProcessFlowSpecSchema = z.object({
  steps: z
    .array(
      z.object({
        name: z.string().min(1).max(60),
        description: z.string().min(1).max(160),
      })
    )
    .min(1)
    .max(4),
});

export type Pattern4ProcessFlowSpec = z.infer<typeof Pattern4ProcessFlowSpecSchema>;

// ---------------------------------------------------------------------------
// Pattern 5 — Icon Grid (2×2)
// ---------------------------------------------------------------------------

export const Pattern5IconGridSpecSchema = z.object({
  items: z
    .array(
      z.object({
        icon: z.string().min(1).max(4),
        label: z.string().min(1).max(40),
        description: z.string().max(120).optional(),
      })
    )
    .length(4),
});

export type Pattern5IconGridSpec = z.infer<typeof Pattern5IconGridSpecSchema>;

// ---------------------------------------------------------------------------
// Pattern 6 — Comparison Matrix (SWOT)
// ---------------------------------------------------------------------------

export const Pattern6SwotSpecSchema = z.object({
  quadrants: z
    .array(
      z.object({
        label: z.string().max(60).optional(),
        bullets: z.array(z.string().min(1).max(140)).min(1).max(6),
      })
    )
    .length(4),
});

export type Pattern6SwotSpec = z.infer<typeof Pattern6SwotSpecSchema>;

// ---------------------------------------------------------------------------
// Pattern 7 — Layer Divider
// ---------------------------------------------------------------------------

export const Pattern7LayerDividerSpecSchema = z.object({
  layerNumber: z.coerce.number().int().min(1).max(99),
  layerName: z.string().min(1).max(80),
});

export type Pattern7LayerDividerSpec = z.infer<typeof Pattern7LayerDividerSpecSchema>;

// ---------------------------------------------------------------------------
// Pattern 8 — Quote Highlight
// ---------------------------------------------------------------------------

export const Pattern8QuoteSpecSchema = z.object({
  quote: z.string().min(1).max(220),
  attribution: z.string().min(1).max(80),
});

export type Pattern8QuoteSpec = z.infer<typeof Pattern8QuoteSpecSchema>;

// ---------------------------------------------------------------------------
// Pattern 9 — Bar Chart
// ---------------------------------------------------------------------------

export const Pattern9BarChartSpecSchema = z.object({
  bars: z
    .array(
      z.object({
        label: z.string().min(1).max(40),
        value: z.coerce.number().positive(),
        valueLabel: z.string().max(40).optional(),
        accentColorHex: HexColorSchema.optional(),
      })
    )
    .min(1)
    .max(12),
  unitNote: z.string().max(80).optional(),
});

export type Pattern9BarChartSpec = z.infer<typeof Pattern9BarChartSpecSchema>;

// ---------------------------------------------------------------------------
// Pattern 10 — Executive Summary (Action Title + 3 Pillars)
// ---------------------------------------------------------------------------

export const Pattern10ExecSummarySpecSchema = z.object({
  actionTitle: z.string().min(1).max(120),
  pillars: z
    .array(
      z.object({
        heading: z.string().min(1).max(60),
        bullets: z.array(z.string().min(1).max(120)).min(1).max(4),
      })
    )
    .length(3),
  takeaway: z.string().min(1).max(160),
  takeawayPrefix: z.string().max(20).optional(),
});

export type Pattern10ExecSummarySpec = z.infer<typeof Pattern10ExecSummarySpecSchema>;

// ---------------------------------------------------------------------------
// Pattern 11 — Pyramid Principle (Minto)
// ---------------------------------------------------------------------------

/** One of the 3 MECE supporting arguments, with its evidence bullets. */
export const PyramidArgumentSchema = z.object({
  /** Bold short label inside the middle-tier box, e.g. "Market pull". */
  label: z.string().min(1).max(60),
  /** 2-5 evidence bullets shown in the bottom-tier box under this argument. */
  evidence: z.array(z.string().min(1).max(120)).min(2).max(5),
});

export const Pattern11PyramidSpecSchema = z.object({
  pattern: z.literal("P11"),
  /**
   * The governing thought (the "answer first"). Reuses the same 80/100/>100
   * char thresholds as the action-title rule, since it sits in a box sized
   * for a single sentence — see units.ts `resolveActionTitleFit`.
   */
  governingThought: z.string().min(1).max(160),
  /** Exactly 3 — the pyramid principle requires MECE, 3-argument structure. */
  arguments: z.array(PyramidArgumentSchema).length(3),
});

export type PyramidArgument = z.infer<typeof PyramidArgumentSchema>;
export type Pattern11PyramidSpec = z.infer<typeof Pattern11PyramidSpecSchema>;

/**
 * Parses and validates a raw (e.g. LM-produced) object as a Pattern 11 spec.
 * Throws a ZodError with a field-level message on failure.
 */
export function parsePattern11Spec(raw: unknown): Pattern11PyramidSpec {
  return Pattern11PyramidSpecSchema.parse(raw);
}

// ---------------------------------------------------------------------------
// Pattern 12 — Waterfall / Bridge
// ---------------------------------------------------------------------------

export const Pattern12WaterfallSpecSchema = z.object({
  start: z.object({
    value: z.coerce.number().positive(),
    label: z.string().min(1).max(40),
  }),
  drivers: z
    .array(
      z.object({
        label: z.string().min(1).max(40),
        delta: z.coerce.number(), // Allow both positive and negative deltas for waterfall
      })
    )
    .min(1)
    .max(6),
  end: z
    .object({
      value: z.coerce.number().positive(),
      label: z.string().min(1).max(40),
    })
    .optional(),
  unit: z.string().max(10).optional(),
});

export type Pattern12WaterfallSpec = z.infer<typeof Pattern12WaterfallSpecSchema>;

// ---------------------------------------------------------------------------
// Pattern 13 — BCG 2×2 Matrix
// ---------------------------------------------------------------------------

export const BcgBubbleSizeSchema = z.enum(["s", "m", "l"]);

export const Pattern13BcgMatrixSpecSchema = z.object({
  xAxisLabel: z.string().min(1).max(60),
  yAxisLabel: z.string().min(1).max(60),
  quadrantLabels: z.array(z.string().min(1).max(40)).length(4),
  bubbles: z
    .array(
      z.object({
        x: z.coerce.number().min(0).max(1),
        y: z.coerce.number().min(0).max(1),
        size: BcgBubbleSizeSchema,
        label: z.string().min(1).max(40),
      })
    )
    .max(12),
});

export type Pattern13BcgMatrixSpec = z.infer<typeof Pattern13BcgMatrixSpecSchema>;

// ---------------------------------------------------------------------------
// Pattern 14 — Harvey Ball Comparison
// ---------------------------------------------------------------------------

export const Pattern14HarveySpecSchema = z.object({
  polarity: z.enum(["positive", "neutral"]),
  options: z.array(z.string().min(1).max(40)).min(2).max(6),
  criteria: z
    .array(
      z.object({
        name: z.string().min(1).max(60),
        levels: z.array(z.coerce.number().int().min(0).max(4)).min(1).max(6),
      })
    )
    .min(1)
    .max(8),
  weightedScores: z.array(z.string().min(1).max(12)).optional(),
});

export type Pattern14HarveySpec = z.infer<typeof Pattern14HarveySpecSchema>;

// ---------------------------------------------------------------------------
// Pattern 15 — Heat Map / Risk Matrix
// ---------------------------------------------------------------------------

export const Pattern15HeatMapSpecSchema = z.object({
  palette: z.enum(["sequential", "risk"]),
  xTicks: z.array(z.string().min(1).max(30)).min(2).max(8),
  yTicks: z.array(z.string().min(1).max(30)).min(2).max(8),
  cells: z
    .array(
      z.object({
        row: z.coerce.number().int().min(0),
        col: z.coerce.number().int().min(0),
        step: z.coerce.number().int().min(1).max(5),
        label: z.string().max(20).optional(),
      })
    )
    .min(1)
    .max(64),
  xAxisLabel: z.string().max(60).optional(),
  yAxisLabel: z.string().max(60).optional(),
});

export type Pattern15HeatMapSpec = z.infer<typeof Pattern15HeatMapSpecSchema>;

// ---------------------------------------------------------------------------
// Pattern 16 — Driver Tree
// ---------------------------------------------------------------------------

export const DriverNodeSchema = z.object({
  name: z.string().min(1).max(40),
  value: z.string().min(1).max(40),
  delta: z
    .object({
      direction: TrendDirectionSchema,
      text: z.string().min(1).max(20),
    })
    .optional(),
});

export type DriverNode = z.infer<typeof DriverNodeSchema>;

export const Pattern16DriverTreeSpecSchema = z.object({
  root: DriverNodeSchema,
  branches: z
    .array(
      z.object({
        node: DriverNodeSchema,
        children: z.array(DriverNodeSchema).min(0).max(3),
      })
    )
    .min(1)
    .max(3),
});

export type Pattern16DriverTreeSpec = z.infer<typeof Pattern16DriverTreeSpecSchema>;

// ---------------------------------------------------------------------------
// Pattern 17 — Roadmap / Gantt
// ---------------------------------------------------------------------------

export const Pattern17RoadmapSpecSchema = z.object({
  quarters: z.array(z.string().min(1).max(16)).min(2).max(12),
  workstreams: z
    .array(
      z.object({
        name: z.string().min(1).max(40),
        bars: z
          .array(
            z.object({
              fromQ: z.coerce.number().int().min(0),
              toQ: z.coerce.number().int().min(0),
              label: z.string().max(40).optional(),
            })
          )
          .min(0)
          .max(12),
        milestones: z
          .array(
            z.object({
              atQ: z.coerce.number().int().min(0),
              frac: z.coerce.number().min(0).max(0.99).optional(),
              label: z.string().max(40).optional(),
            })
          )
          .min(0)
          .max(12),
      })
    )
    .min(1)
    .max(8),
  todayQ: z.coerce.number().int().min(0).optional(),
});

export type Pattern17RoadmapSpec = z.infer<typeof Pattern17RoadmapSpecSchema>;

// ---------------------------------------------------------------------------
// Pattern 18 — Maturity Radar
// ---------------------------------------------------------------------------

export const Pattern18MaturityRadarSpecSchema = z.object({
  axes: z
    .array(
      z.object({
        name: z.string().min(1).max(30),
        current: z.coerce.number().min(0).max(5),
        target: z.coerce.number().min(0).max(5),
      })
    )
    .min(3)
    .max(12),
  bullets: z.array(z.string().min(1).max(160)).min(0).max(6),
});

export type Pattern18MaturityRadarSpec = z.infer<typeof Pattern18MaturityRadarSpecSchema>;

// ---------------------------------------------------------------------------
// Pattern 19 — Three-Horizon
// ---------------------------------------------------------------------------

export const Pattern19ThreeHorizonSpecSchema = z.object({
  xAxisLabel: z.string().min(1).max(60),
  yAxisLabel: z.string().min(1).max(60),
  horizons: z
    .array(
      z.object({
        timeframe: z.string().min(1).max(40),
        theme: z.string().min(1).max(80),
        initiatives: z.array(z.string().min(1).max(120)).min(1).max(5),
      })
    )
    .length(3),
});

export type Pattern19ThreeHorizonSpec = z.infer<typeof Pattern19ThreeHorizonSpecSchema>;

// ---------------------------------------------------------------------------
// Pattern 20 — Ecosystem / Stakeholder Map
// ---------------------------------------------------------------------------

export const Pattern20EcosystemSpecSchema = z.object({
  center: z.string().min(1).max(60),
  inner: z.array(z.string().min(1).max(40)).min(0).max(4),
  outer: z.array(z.string().min(1).max(40)).min(0).max(8),
  quadrantLabels: z
    .object({
      topLeft: z.string().max(40).optional(),
      topRight: z.string().max(40).optional(),
      bottomLeft: z.string().max(40).optional(),
      bottomRight: z.string().max(40).optional(),
    })
    .optional(),
});

export type Pattern20EcosystemSpec = z.infer<typeof Pattern20EcosystemSpecSchema>;

// ---------------------------------------------------------------------------
// Pattern 21 — KPI Scorecard
// ---------------------------------------------------------------------------

export const KpiTileSchema = z.object({
  name: z.string().min(1).max(40),
  value: z.string().min(1).max(30),
  target: z.string().max(30).optional(),
  delta: z.string().max(30).optional(),
  trend: TrendDirectionSchema,
  status: SemanticStatusSchema,
});

export type KpiTile = z.infer<typeof KpiTileSchema>;

export const Pattern21KpiScorecardSpecSchema = z.object({
  kpis: z.array(KpiTileSchema).min(2).max(8),
});

export type Pattern21KpiScorecardSpec = z.infer<typeof Pattern21KpiScorecardSpecSchema>;

// ---------------------------------------------------------------------------
// Pattern 22 — Agenda / ToC
// ---------------------------------------------------------------------------

export const Pattern22AgendaSpecSchema = z.object({
  items: z
    .array(
      z.object({
        title: z.string().min(1).max(80),
        page: z.coerce.number().int().min(1).optional(),
        highlighted: z.boolean().optional(),
      })
    )
    .min(1)
    .max(10),
});

export type Pattern22AgendaSpec = z.infer<typeof Pattern22AgendaSpecSchema>;

// ---------------------------------------------------------------------------
// Pattern 23 — Source / Methodology
// ---------------------------------------------------------------------------

export const SourceMethodColumnSchema = z.object({
  header: z.string().min(1).max(40),
  items: z.array(z.string().min(1).max(160)).min(1).max(8),
});

export type SourceMethodColumn = z.infer<typeof SourceMethodColumnSchema>;

export const Pattern23SourceMethodSpecSchema = z.object({
  sources: SourceMethodColumnSchema,
  methodology: SourceMethodColumnSchema,
  assumptions: SourceMethodColumnSchema,
});

export type Pattern23SourceMethodSpec = z.infer<typeof Pattern23SourceMethodSpecSchema>;

// ---------------------------------------------------------------------------
// Pattern 24 — Build / Sequential Reveal
// ---------------------------------------------------------------------------

export const Pattern24BuildSpecSchema = z.object({
  stages: z.array(z.string().min(1).max(60)).min(3).max(5),
  focusIndex: z.coerce.number().int().min(0),
  detail: z.object({
    heading: z.string().min(1).max(80),
    bullets: z.array(z.string().min(1).max(160)).min(1).max(6),
  }),
});

export type Pattern24BuildSpec = z.infer<typeof Pattern24BuildSpecSchema>;
