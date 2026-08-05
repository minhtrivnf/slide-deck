/**
 * pattern_spec.ts
 *
 * Structured content spec for every non-P11 pattern. The specs LLM fills in
 * only the fields each pattern needs (stats, bars, steps, quadrants, pillars,
 * quote, matrix, items) and the renderers in patterns/content_layouts.ts lay
 * them out. P11 keeps its own Pattern11PyramidSpec.
 */

import { z } from "zod";
import type { SlidePattern } from "./types.js";

export const PatternContentSchema = z.object({
  title: z.string(),
  source: z.string().optional(),
  takeaway: z.string().optional(),
  /** Generic bullet points — grids, lists, agenda, source/method slides. */
  items: z.array(z.string()).optional(),
  /** Big-number callouts (P1, P2, P14, P18). */
  stats: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
        note: z.string().optional(),
      })
    )
    .optional(),
  /** Horizontal bars (P9, P12). */
  bars: z
    .array(z.object({ label: z.string(), value: z.number() }))
    .optional(),
  /** Ordered steps — process flows, roadmaps, build reveals (P4, P17, P24). */
  steps: z
    .array(z.object({ title: z.string(), detail: z.string().optional() }))
    .optional(),
  /** Quadrants — SWOT / BCG (P6, P13). Exactly 4. */
  quadrants: z
    .array(z.object({ label: z.string(), points: z.array(z.string()) }))
    .optional(),
  /** Pillar columns — executive summary, horizons (P10, P19). */
  pillars: z
    .array(z.object({ title: z.string(), points: z.array(z.string()) }))
    .optional(),
  /** Big quote text (P8). */
  quote: z.string().optional(),
  quoteSource: z.string().optional(),
  /** Grid of cells — tables, heat maps (P3, P15, P21). */
  matrix: z.array(z.array(z.string())).optional(),
});

export type PatternContent = z.infer<typeof PatternContentSchema>;

/** Union of everything a renderer can consume for one slide. */
export type AnyContentSpec = PatternContent | { governingThought: string; arguments: unknown[] };
