/**
 * outliner.ts
 *
 * Uses an LLM to turn the extracted report text into a structured outline.
 * The prompt is engineered to follow VNF consultancy conventions and to output
 * JSON that the renderer can consume directly.
 */

import type { LLM, SlideOutline, SlidePattern } from "./types.js";
import { resolveActionTitleFit } from "../units.js";

const PATTERN_DESCRIPTIONS = `
P1  Stat Callout 3-col        — 3 key metrics
P2  Stat Callout 2-col        — 2 contrasting findings
P3  Data Table               — structured data
P4  Process Flow             — sequence
P5  Icon Grid 2x2            — categories
P6  Comparison Matrix (SWOT) — 2x2 trade-offs
P7  Layer Divider            — section break
P8  Quote Highlight          — key statement
P9  Bar Chart                — comparison
P10 Executive Summary        — action title + 3 pillars
P11 Pyramid Principle        — governing thought + 3 MECE args + evidence
P12 Waterfall / Bridge       — delta decomposition
P13 BCG 2x2 Matrix           — strategic positioning
P14 Harvey Balls             — multi-criteria scoring
P15 Heat Map / Risk Matrix   — likelihood x impact
P16 Driver Tree              — metric decomposition
P17 Roadmap / Gantt          — multi-track plan
P18 Maturity Radar           — capability gap
P19 Three-Horizon            — strategic time-phasing
P20 Ecosystem / Stakeholder  — central entity + actors
P21 KPI Scorecard            — multi-metric status
P22 Agenda / ToC             — navigation
P23 Source / Methodology     — data caveats
P24 Build / Sequential Reveal— 3-5 step framework
`;

/**
 * Generates a compact outline from report text. If the report is long,
 * summarize first to keep the LLM call focused.
 */
export async function generateOutline(args: {
  llm: LLM;
  reportText: string;
  deckTitle?: string;
  userRequest?: string;
  /** Hard cap on slides; the outline count is decided from content, up to this. Defaults to 20. */
  maxSlides?: number;
}): Promise<SlideOutline[]> {
  const { llm, reportText, deckTitle = "VNF Report Deck", userRequest, maxSlides = 20 } = args;
  const prompt = buildOutlinePrompt(reportText, deckTitle, userRequest, maxSlides);
  const raw = await llm.invoke(prompt);

  const jsonMatch = stripCodeFences(raw).match(/\[[\s\S]*\]/);
  const jsonText = jsonMatch ? jsonMatch[0] : raw;
  let parsed: Array<Record<string, unknown>>;
  try {
    parsed = JSON.parse(jsonText) as Array<Record<string, unknown>>;
  } catch (e) {
    throw new Error(`Outline LLM output is not valid JSON: ${(e as Error).message}\n${raw.slice(0, 500)}`);
  }

  return parsed
    .filter(
      (o): o is OutlineCandidate =>
        typeof o.slideNumber === "number" &&
        typeof o.title === "string" &&
        typeof o.pattern === "string" &&
        typeof o.contentNotes !== "undefined"
    )
    .slice(0, maxSlides)
    .map((o, i) => {
      const slideNumber = i + 3; // cover=1, layout placeholder=2, new slides start at 3
      const title = o.title.slice(0, 140);
      const fit = resolveActionTitleFit(title);
      if (!fit.ok) {
        throw new Error(`Slide ${slideNumber} title too long: ${fit.reason}`);
      }
      const contentNotes =
        typeof o.contentNotes === "string"
          ? o.contentNotes
          : safeStringifyNotes(o.contentNotes);
      return {
        ...o,
        slideNumber,
        pattern: o.pattern as SlidePattern,
        title,
        contentNotes,
      };
    });
}

/** Coerces an LLM-emitted object/array contentNotes into a plain string. */
function safeStringifyNotes(notes: unknown): string {
  try {
    return JSON.stringify(notes).slice(0, 600);
  } catch {
    return String(notes).slice(0, 600);
  }
}

/** A parsed outline row: required fields present, contentNotes coerced from any shape. */
type OutlineCandidate = Pick<SlideOutline, "slideNumber" | "title" | "pattern"> & {
  contentNotes: unknown;
  source?: string;
  takeaway?: string;
};

/** Strips markdown code fences (```json / ```) that some LLMs add around JSON. */
function stripCodeFences(text: string): string {
  return text.replace(/```[a-zA-Z]*\n?/g, "").trim();
}

function buildOutlinePrompt(reportText: string, deckTitle: string, userRequest: string | undefined, maxSlides: number): string {
  const truncated = reportText.slice(0, 12000);
  return `You are a McKinsey/BCG-grade presentation consultant. Turn the following content brief into a VNF-branded slide deck outline.

DECK TITLE: ${deckTitle}
USER REQUEST: ${userRequest ?? "Create a clear, insight-driven deck from the report."}

CONTENT BRIEF:
---
${truncated}
${reportText.length > truncated.length ? "\n[Brief truncated for length]" : ""}
---

Available patterns:
${PATTERN_DESCRIPTIONS}

Rules:
- Determine the number of content slides from the content itself — no fixed count. A short report may need 3-4, a dense one up to ${maxSlides}. Let the storyline decide.
- LANGUAGE: write every title, source line, takeaway and contentNotes in the SAME LANGUAGE as the source report. If the report is Vietnamese, everything must be Vietnamese (keep numbers and proper nouns as-is).
- Slide numbers start at 3 (slide 1 is the cover, slide 2 is a layout placeholder).
- Each slide must use ONE pattern.
- Action titles must be a complete sentence stating the conclusion (max 100 chars, ideally ≤80).
- Include a source citation when the slide uses data from the report.
- Include a takeaway implication for every analytical slide.
- Prefer P11 (Pyramid Principle) at least once if the report contains a central thesis with supporting arguments.

Output a JSON array only, no markdown fences, no explanation. Each element:
{
  "slideNumber": 3,
  "pattern": "P11",
  "title": "Vietnam's under-40% survival rate is the binding economic constraint",
  "source": "Source: FAO 2024",
  "takeaway": "Improve hatchery survival before expanding capacity.",
  "contentNotes": "3 MECE arguments: genetics, feed, biosecurity. Evidence bullets per argument."
}

Rules for "contentNotes":
- contentNotes MUST be a single plain STRING (free-form notes that guide the slide builder).
- NEVER make contentNotes a nested object or array.
- Keep it under 600 characters.
`;
}
