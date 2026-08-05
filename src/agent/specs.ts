/**
 * specs.ts
 *
 * Converts each outline entry into a pattern-specific spec that the
 * deterministic renderer can consume. One LLM call per slide: P11 gets the
 * Pyramid schema; every other pattern gets a flexible PatternContent object
 * (stats / bars / steps / quadrants / pillars / quote / matrix / items) that
 * the renderers in patterns/content_layouts.ts turn into real slide content.
 */

import type { SlideOutline, SlideSpec, SlidePattern, LLM } from "./types.js";
import { Pattern11PyramidSpecSchema, type Pattern11PyramidSpec } from "../types.js";
import { PatternContentSchema } from "./pattern_spec.js";

/** Pattern-specific guidance telling the LLM which fields to fill. */
const PATTERN_GUIDANCE: Record<string, string> = {
  P1: "3-column stat callout — use stats (exactly 3): label, value, note.",
  P2: "2-column stat callout — use stats (exactly 2): label, value, note.",
  P3: "Data table — use matrix (first row = column headers, then data rows).",
  P4: "Process flow — use steps (ordered, 3-6) with title + short detail.",
  P5: "Icon grid 2x2 — use items (up to 4 concise labels).",
  P6: "SWOT comparison matrix — use quadrants (exactly 4, order: S/W/O/T).",
  P7: "Layer divider — just title; optionally items (one-line subtitle).",
  P8: "Quote highlight — use quote (exact wording) + quoteSource.",
  P9: "Bar chart — use bars (4-6): label + numeric value.",
  P10: "Executive summary — use pillars (exactly 3): title + points.",
  P12: "Waterfall / bridge — use bars (ordered segments, value = signed delta).",
  P13: "BCG 2x2 matrix — use quadrants (exactly 4): label + points.",
  P14: "Harvey ball comparison — use stats (score) with note as the label.",
  P15: "Heat map / risk matrix — use matrix (cells; first row/col = labels).",
  P16: "Driver tree — use steps (root then branches) with title + detail.",
  P17: "Roadmap / timeline — use steps (phases in order) with title + detail.",
  P18: "Maturity radar — use stats (one per axis: label = axis, value = score 0-100).",
  P19: "Three-horizon — use pillars (exactly 3 horizons): title + points.",
  P20: "Ecosystem / stakeholder map — use items (central entity + actors).",
  P21: "KPI scorecard — use matrix (first row = headers, rows = KPIs + status).",
  P22: "Agenda / ToC — use items (ordered section list).",
  P23: "Source / methodology — use items (sources & methods list).",
  P24: "Build / sequential reveal — use steps (3-5 ordered).",
};

export async function generateSpecs(args: { llm: LLM; outline: SlideOutline[] }): Promise<SlideSpec[]> {
  const specs: SlideSpec[] = [];
  for (const entry of args.outline) {
    if (entry.pattern === "P11") {
      specs.push(await makePyramidSpec(args.llm, entry));
    } else {
      specs.push(await makeContentSpec(args.llm, entry));
    }
  }
  return specs;
}

async function makePyramidSpec(llm: LLM, entry: SlideOutline): Promise<{ pattern: "P11"; spec: Pattern11PyramidSpec }> {
  const prompt = pyramidPrompt(entry);
  const raw = await llm.invoke(prompt);
  const parsed = JSON.parse(extractJson(raw)) as object;
  const spec = Pattern11PyramidSpecSchema.parse({ pattern: "P11", ...parsed });
  return { pattern: "P11", spec };
}

async function makeContentSpec(llm: LLM, entry: SlideOutline): Promise<SlideSpec> {
  const guidance = PATTERN_GUIDANCE[entry.pattern] ?? "General content slide — use items (bullets).";
  const prompt = `You are building a VNF slide for pattern ${entry.pattern}.

Action title: ${entry.title}
Source: ${entry.source ?? "n/a"}
Takeaway: ${entry.takeaway ?? "n/a"}

Content notes (from the report):
${entry.contentNotes}

Pattern guidance:
${guidance}

Convert this into a strict JSON object matching this schema (fill ONLY the fields that this pattern needs; leave the rest out):
{
  "title": "<same as the action title>",
  "source": "<source citation or omit>",
  "takeaway": "<Zone 4 so-what implication or omit>",
  "items": ["bullet 1", "bullet 2"],
  "stats": [{ "label": "short label", "value": "big number", "note": "context (optional)" }],
  "bars": [{ "label": "category", "value": 42 }],
  "steps": [{ "title": "step name", "detail": "one-line detail (optional)" }],
  "quadrants": [{ "label": "quadrant name", "points": ["bullet"] }],
  "pillars": [{ "title": "pillar name", "points": ["bullet"] }],
  "quote": "exact quotation",
  "quoteSource": "who said it / where",
  "matrix": [["header1", "header2"], ["cell", "cell"]]
}

Rules:
- LANGUAGE: write every field in the SAME LANGUAGE as the action title and content notes. If they are Vietnamese, all text must be Vietnamese (keep numbers, units and proper nouns as-is).
- Never invent numbers or facts not present in the content notes.
- Keep every string concise (labels < 40 chars, bullets < 120 chars, total under 700 chars).
- Output JSON only, no markdown fences, no commentary.`;

  const raw = await llm.invoke(prompt);
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch (e) {
    throw new Error(`Pattern ${entry.pattern} spec for slide ${entry.slideNumber} is not valid JSON: ${(e as Error).message}\n${raw.slice(0, 500)}`);
  }
  const spec = PatternContentSchema.parse(parsed);
  return { pattern: entry.pattern as Exclude<SlidePattern, "P11">, spec };
}

function pyramidPrompt(entry: SlideOutline): string {
  return `You are building a VNF Pyramid Principle slide (Pattern 11).

Action title: ${entry.title}
Source: ${entry.source ?? "n/a"}
Takeaway: ${entry.takeaway ?? "n/a"}

Content notes:
${entry.contentNotes}

Convert this into a strict JSON object matching this Zod schema:
{
  "pattern": "P11",
  "governingThought": "one sentence answer-first (max 160 chars)",
  "arguments": [
    { "label": "short argument label (max 60 chars)", "evidence": ["bullet 1 (max 120 chars)", "bullet 2", "bullet 3", "bullet 4"] },
    { "label": "...", "evidence": ["..."] },
    { "label": "...", "evidence": ["..."] }
  ]
}

Rules:
- governingThought should be a clear answer to the action title.
- LANGUAGE: write everything in the SAME LANGUAGE as the action title and content notes (Vietnamese if they are Vietnamese).
- Exactly 3 arguments, mutually exclusive and collectively exhaustive.
- 2-5 evidence bullets per argument (max 120 chars each) — use the full range so the slide is substantive.
- Output JSON only, no markdown fences, no commentary.`;
}

function extractJson(text: string): string {
  const m = text.match(/\{[\s\S]*\}/);
  return m ? m[0] : text;
}

export function specForPattern(pattern: SlidePattern): string {
  switch (pattern) {
    case "P11":
      return "Pyramid Principle — expects Pattern11PyramidSpec";
    default:
      return `${pattern} — expects PatternContent (items/stats/bars/steps/quadrants/pillars/quote/matrix)`;
  }
}
