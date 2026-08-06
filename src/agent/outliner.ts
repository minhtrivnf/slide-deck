/**
 * outliner.ts (v2)
 *
 * Uses an LLM to turn the extracted report text into a structured outline
 * following the VNF 5-Layer Framework (Science → Technology → Industrial → Market → Strategic).
 *
 * Output: Master outline + 5 layer files with full slide specifications.
 * Each slide includes: objective, action title, kicker, content, source citation, pattern, takeaway.
 */

import type { LLM, SlideOutline, SlidePattern } from "./types.js";
import { fitTitle } from "../units.js";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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

  // Post-process: replace any P12 with P6 (SWOT) since P12 renderer doesn't exist
  const finalSlides = processed.map((slide) => {
    // P12 was removed from SlidePattern type, but just in case it slips through validation
    if ((slide.pattern as any) === "P12") {
      console.warn(`[Outline] Slide ${slide.slideNumber}: P12 not supported, replacing with P6 (SWOT)`);
      return {
        ...slide,
        pattern: "P6" as SlidePattern,
        contentNotes: `SWOT analysis: ${slide.contentNotes}`
      };
    }
    return slide;
  });

  return { slides: finalSlides, deckTitle: generatedTitle };
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

/** Strips markdown code fences (```json / ```) that some LLMs add around JSON, and any preamble before the first brace. */
function stripCodeFences(text: string): string {
  // First remove markdown code fence markers
  let cleaned = text.replace(/```[a-zA-Z]*\n?/g, "").trim();
  
  // Remove any preamble text before the first { (in case LLM adds commentary before JSON)
  const braceIndex = cleaned.indexOf("{");
  if (braceIndex > 0) {
    cleaned = cleaned.substring(braceIndex);
  }
  
  return cleaned.trim();
}

function buildOutlinePrompt(reportText: string, deckTitle: string, userRequest: string | undefined, maxSlides: number): string {
    const truncated = reportText.slice(0, 50000);
    
    // Load outline guide - try multiple paths
    let outlineGuide = "";
    const possiblePaths = [
      join(dirname(fileURLToPath(import.meta.url)), "..", "..", "assets", "outline_guide.md"),
      join(process.cwd(), "assets", "outline_guide.md"),
      join(process.cwd(), "vnf-pptx-toolkit-phase1-2", "assets", "outline_guide.md"),
    ];
    
    for (const guidePath of possiblePaths) {
      try {
        outlineGuide = readFileSync(guidePath, "utf-8").slice(0, 12000); // First 12k chars
        console.log(`[Outliner] Loaded outline_guide.md from: ${guidePath}`);
        break;
      } catch (e) {
        // Try next path
      }
    }
    
    if (!outlineGuide) {
      console.warn(`[Outliner] Could not load outline_guide.md from any path`);
    }

   return `You are a McKinsey/BCG-grade presentation consultant. Turn the following content brief into a VNF-branded slide deck outline following the 5-LAYER FRAMEWORK.

INITIAL DECK TITLE (may refine): ${deckTitle}
USER REQUEST: ${userRequest ?? "Create a clear, insight-driven deck from the report."}

CONTENT BRIEF:
---
${truncated}
${reportText.length > truncated.length ? "\n[Brief truncated for length]" : ""}
---

${outlineGuide ? `\n## VNF 5-LAYER OUTLINE FRAMEWORK (Reference)\n${outlineGuide}\n---\n` : ""}

INSTRUCTIONS:

1. **Structure**: Organize slides into 5 LAYERS (Science → Technology → Industrial → Market → Strategic)
   - Layer 1 (Science): Foundation, mechanisms, scientific evidence
   - Layer 2 (Technology): Technology solutions, readiness levels, comparisons
   - Layer 3 (Industrial): Real-world deployment, players, supply chain
   - Layer 4 (Market): Market size, growth, segments, commercial dynamics
   - Layer 5 (Strategic): Opportunities, risks, strategy, action plan

2. **Per Slide**: Each slide entry MUST include:
   - slideNumber: integer
   - layer: "1"|"2"|"3"|"4"|"5"
   - pattern: P1-P24 from slide_patterns.md
   - actionTitle: Descriptive sentence stating conclusion (≤140 chars, not a topic)
   - kicker: UPPERCASE eyebrow (e.g., "SCIENCE · MECHANISM")
   - objective: One sentence - what audience learns/decides
   - contentNotes: Specific data, findings, quotes from report
   - source: "Source: <publisher> <year>" (required for data slides)
   - takeaway: Zone 4 implication (10-20 words, NOT restatement of title)

3. **Quality Rules**:
   - NO generic titles like "Overview of X" or "Market Analysis" — every title is a conclusion
   - Every analytical slide has a SPECIFIC takeaway implying action/decision
   - Slide counts per layer: Science 5-8 / Tech 6-10 / Industrial 5-8 / Market 8-12 / Strategic 12-18
   - Total: ~45-60 slides (content-driven, not arbitrary)
   - Varied patterns — no two consecutive slides same pattern
   - Each layer: ≥1 structural pattern (P10/P11/P12/P13/P16/P17/P19)

4. **LANGUAGE RULE (CRITICAL)**:
   - Detect the dominant language of the CONTENT BRIEF
   - Write EVERY field (actionTitle, kicker, takeaway, contentNotes, source) in that SAME language
   - NEVER translate. If brief is Vietnamese, all output Vietnamese. If English, all English.

5. **Output Format**: Single JSON object:
\`\`\`json
{
  "deckTitle": "Refined title reflecting report's main topic",
  "totalSlides": 50,
  "layerSummary": {
    "1": {"name": "Science", "slides": 6, "thesis": "..."},
    "2": {"name": "Technology", "slides": 8, "thesis": "..."},
    "3": {"name": "Industrial", "slides": 7, "thesis": "..."},
    "4": {"name": "Market", "slides": 10, "thesis": "..."},
    "5": {"name": "Strategic", "slides": 15, "thesis": "..."}
  },
  "slides": [
    {
      "slideNumber": 2,
      "layer": "1",
      "pattern": "P11",
      "actionTitle": "Nano-minerals overcome bioavailability gaps that inorganic salts cannot address",
      "kicker": "SCIENCE · BIOAVAILABILITY",
      "objective": "Establish why nano-minerals matter scientifically",
      "contentNotes": "3 MECE arguments: (1) Bioavailability — nano-forms absorb 3-5x better; (2) Excretion reduction — 40% less waste; (3) Immune modulation — enhanced immune response. Evidence per argument.",
      "source": "Source: Eissa et al. 2023; Mohammady et al. 2021",
      "takeaway": "Targeting bioavailability mechanism, not volume, unlocks productivity gains.",
      "transition": "With scientific foundation established, let's examine technology solutions"
    },
    ...
  ]
}
\`\`\`

EXAMPLE SKELETON (fill with actual report data):
- Slide 2 (Layer 1): Opening thesis on science
- Slides 3-7 (Layer 1): Evidence, mechanisms, findings
- Slide 8 (Layer 2): Technology landscape
- Slides 9-15 (Layer 2): Technology comparisons, TRL, leading solutions
- Slides 16-22 (Layer 3): Industry players, supply chain, applications
- Slides 23-32 (Layer 4): Market size $X-Y by 20XX, CAGR Z%, segments, competitive dynamics
- Slides 33-47 (Layer 5): Strategic opportunities, risk matrix, recommended actions, roadmap

Output JSON only, no markdown fences, no commentary.`;
}
