/**
 * outliner.ts
 *
 * Uses an LLM to turn the extracted report text into a structured outline.
 * The prompt is engineered to follow VNF consultancy conventions and to output
 * JSON that the renderer can consume directly.
 */

import type { LLM, SlideOutline, SlidePattern } from "./types.js";
import { fitTitle } from "../units.js";

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
 * summarize first to keep the LLM call focused. Returns both the outline
 * slides and a generated deck title.
 */
export async function generateOutline(args: {
  llm: LLM;
  reportText: string;
  deckTitle?: string;
  userRequest?: string;
  /** Hard cap on slides; the outline count is decided from content, up to this. Defaults to 20. */
  maxSlides?: number;
}): Promise<{ slides: SlideOutline[]; deckTitle: string }> {
  const { llm, reportText, deckTitle = "VNF Report Deck", userRequest, maxSlides = 50 } = args;
  const prompt = buildOutlinePrompt(reportText, deckTitle, userRequest, maxSlides);
  const raw = await llm.invoke(prompt);

  let fullOutput: { deckTitle?: string; slides?: Array<Record<string, unknown>> };
  try {
    const cleaned = stripCodeFences(raw).trim();
    fullOutput = JSON.parse(cleaned) as any;
    // If LLM returned just an array (old format), wrap it
    if (Array.isArray(fullOutput)) {
      fullOutput = { slides: fullOutput };
    }
  } catch (e) {
    throw new Error(`Outline LLM output is not valid JSON: ${(e as Error).message}\n${raw.slice(0, 500)}`);
  }

  const slides = (fullOutput.slides || []) as Array<Record<string, unknown>>;
  const generatedTitle = (fullOutput.deckTitle as string) || deckTitle;

  // Filter and process LLM-generated slides
  const processedFromLLM = slides
    .filter(
      (o): o is OutlineCandidate =>
        typeof o.slideNumber === "number" &&
        typeof o.title === "string" &&
        typeof o.pattern === "string" &&
        typeof o.contentNotes !== "undefined"
    )
    .slice(0, maxSlides - 1) // Reserve 1 slot for P22 (Agenda)
    .map((o, i) => {
      const slideNumber = i + 3; // slide 2 is P22, content starts at 3
      const rawTitle = o.title.slice(0, 140).trim();
      const title = rawTitle ? fitTitle(rawTitle) : `Slide ${slideNumber}`;
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

  // Prepend P22 (Agenda) as the first content slide (slide 2)
  const agendaItems = processedFromLLM
    .map((s, i) => `- Slide ${s.slideNumber}: [${s.pattern}] ${s.title}`)
    .join("\n");
  
  const agendaSlide: SlideOutline = {
    slideNumber: 2,
    pattern: "P22",
    title: "Agenda",
    contentNotes: `Create agenda items from this outline:
${agendaItems}

Generate "items" array with title from each slide title above. Auto-number pages sequentially starting from 3 (page = slide_number). Set highlighted=true for key strategic slides (P11, P10, major P1/P9 slides).`,
    source: undefined,
    takeaway: undefined,
  };

  const processed = [agendaSlide, ...processedFromLLM];

  return { slides: processed, deckTitle: generatedTitle };
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
   const truncated = reportText.slice(0, 50000);
  return `You are a McKinsey/BCG-grade presentation consultant. Turn the following content brief into a VNF-branded slide deck outline.

INITIAL DECK TITLE (may refine): ${deckTitle}
USER REQUEST: ${userRequest ?? "Create a clear, insight-driven deck from the report."}

CONTENT BRIEF:
---
${truncated}
${reportText.length > truncated.length ? "\n[Brief truncated for length]" : ""}
---

Available patterns:
${PATTERN_DESCRIPTIONS}

Rules:
- **Maximize slide count AND richness**: aim for ${Math.max(maxSlides - 2, 8)}-${maxSlides} content slides. Each slide must be **substantive and full of detail**, not sparse.
  - CRITICAL: Create slides that are SPECIFIC and DATA-RICH, not vague summaries
  - Do NOT create empty/light slides — every slide must have meaningful content
  - A metric slide (P1/P2) needs all 3 stats + descriptive labels + insight bullets
  - A chart slide (P9/P12) needs multiple data series or bars (not just 1-2)
  - A narrative slide (P11/P10) needs full argument depth, not vague placeholders
  - Break large topics into multiple rich slides (e.g., "Market analysis" could be 3 slides: market size + growth trend + competitive landscape, each with full detail)
  - Extract EVERY key finding, metric, quote, and insight from the brief — don't leave details on the table
  - Aim for 15-20 slides minimum when the brief contains substantial content
- LANGUAGE RULE (CRITICAL):
  - FIRST: detect the dominant language of the CONTENT BRIEF above (Vietnamese, English, etc.)
  - SECOND: write every title, source line, takeaway, and contentNotes in that SAME language.
  - NEVER translate. If the brief is Vietnamese, everything must be Vietnamese. If the brief is English, everything must be English.
  - Keep numbers, units, proper nouns and quoted terms as-is.
- Slide numbers start at 2 (slide 1 is the cover).
- Each slide must use ONE pattern.
- Action titles must be a complete sentence stating the conclusion (max 100 chars, ideally ≤80). NEVER empty — always propose a short, meaningful, specific slide title even if the source text is vague.
- Include a source citation when the slide uses data from the report.
- Include a takeaway implication for every analytical slide.
- Prefer P11 (Pyramid Principle) at least once if the report contains a central thesis with supporting arguments.

Output a JSON object with TWO fields:
1. "deckTitle": a crisp, specific title for this deck (max 80 chars, reflecting the report's main topic)
2. "slides": an array of slide objects

{
  "deckTitle": "Vietnam Food Safety Compliance Roadmap 2026",
  "slides": [
    {
      "slideNumber": 2,
      "pattern": "P11",
      "title": "Vietnam's under-40% survival rate is the binding economic constraint",
      "source": "Source: FAO 2024",
      "takeaway": "Improve hatchery survival before expanding capacity.",
      "contentNotes": "3 MECE arguments: genetics, feed, biosecurity. Evidence bullets per argument."
    },
    {
      "slideNumber": 3,
      "pattern": "P9",
      "title": "Factory output ranges 100–400 tonnes/hour across our sites",
      "source": "Source: VNF operations Q2 2026",
      "takeaway": "Standardize processes to narrow variance and improve predictability.",
      "contentNotes": "Bars: Factory1 (150t/h), Factory2 (280t/h), Factory3 (100t/h). Include range."
    },
    {
      "slideNumber": 4,
      "pattern": "P1",
      "title": "Three priorities drive our roadmap: cost, quality, speed",
      "source": "Source: Strategy workshop Q3 2026",
      "takeaway": "Balance these pillars to unlock competitive advantage.",
      "contentNotes": "3 cards: Cost (reduce COGS 15%), Quality (achieve ISO cert), Speed (cut lead time 20%)."
    }
  ]
}

Rules for "contentNotes":
- contentNotes MUST be a single plain STRING (free-form notes that guide the slide builder).
- NEVER make contentNotes a nested object or array.
- Keep it under 600 characters.
`;
}
