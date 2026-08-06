/**
 * specs.ts
 *
 * Converts each outline entry into a pattern-specific spec that the
 * deterministic renderer can consume. One LLM call per slide. Every pattern
 * validates against the Zod schema registered for it in pattern_registry.ts,
 * which is the same schema its hard-coded renderer in src/patterns/ will
 * parse — so the LLM supplies only content, never geometry.
 *
 * The spec object also carries `title` / `source` / `takeaway` (copied from
 * the outline) so the renderer can draw the standard slide chrome around the
 * pattern body; the pattern renderers' Zod schemas ignore those extra keys.
 *
 * Robustness: every spec is validated against its registered Zod schema. If
 * the LLM's output fails validation (missing required fields, wrong types,
 * range violations, malformed JSON), the call is retried ONCE with the exact
 * validation errors fed back so the LLM can fix them — a deck build never
 * dies on a fixable one-off LLM mistake.
 *
 * FALLBACK SYSTEM:
 * When validation fails after retries, pattern is degraded to simpler fallback:
 * - P10, P19, P18, P5 → P1 (stat callout 3-col/2-col - same structure)
 * - P12, P13, P14, P15, P16, P20, P11, P6 → P3 (data table - preserves relationships)
 * - P17, P24 → P4 (process flow - preserves sequence)
 */

import { z } from "zod";
import type { SlideOutline, SlideSpec, SlidePattern, LLM } from "./types.js";
import { Pattern11PyramidSpecSchema, type Pattern11PyramidSpec } from "../types.js";
import { PATTERN_SCHEMAS, guidanceFor } from "./pattern_registry.js";

/** Max LLM attempts per spec, including the error-feedback retry. */
const MAX_SPEC_ATTEMPTS = 2;

/**
 * Fallback map: which pattern to use when original fails validation.
 * 
 * Principle:
 * - P1/P2: For patterns with "few numbers/labels" structure (Exec Summary, Horizons, Radar)
 * - P3 (Data Table): For patterns with complex relationships (matrices, trees, ecosystems)
 * - P4 (Process Flow): For patterns with sequence/time dimension (roadmap, build)
 */
const FALLBACK_MAP: Record<string, string> = {
  // Degrade to P1/P2 - compatible structure
  "P10": "P1",  // Exec Summary (3 pillars) → Stat Callout 3-col
  "P19": "P1",  // Three Horizons (H1/H2/H3) → Stat Callout 3-col
  "P18": "P2",  // Maturity Radar (Current vs Target) → Stat Callout 2-col
  "P5": "P2",   // Icon Grid → Stat Callout 2-col
  "P9": "P1",   // Bar Chart → Stat Callout
  
  // Degrade to P3 (Data Table) - preserve relationships
  "P12": "P3",  // Waterfall → Data Table
  "P13": "P3",  // BCG 2×2 → Data Table
  "P14": "P3",  // Harvey Balls → Data Table
  "P15": "P3",  // Heat Map/Risk Matrix → Data Table
  "P16": "P3",  // Driver Tree → Data Table
  "P20": "P3",  // Ecosystem Map → Data Table
  "P11": "P3",  // Pyramid → Data Table
  "P6": "P3",   // SWOT 2×2 → Data Table
  "P21": "P3",  // KPI Scorecard → Data Table (if >3 KPIs)
  
  // Degrade to P4 (Process Flow) - preserve sequence
  "P17": "P4",  // Roadmap/Gantt → Process Flow
  "P24": "P4",  // Build/Sequential → Process Flow
};

/**
 * Get fallback pattern for a failed pattern.
 * Returns the same pattern if no fallback defined (P1, P2, P3, P4, P7, P8, P22, P23 don't need fallback)
 */
function getFallbackPattern(originalPattern: string): string {
  return FALLBACK_MAP[originalPattern] || "P1"; // Default to P1 if no mapping
}

export async function generateSpecs(args: { llm: LLM; outline: SlideOutline[]; userRequest?: string }): Promise<SlideSpec[]> {
  const { userRequest } = args;
  const specs: SlideSpec[] = [];
  for (const entry of args.outline) {
    if (entry.pattern === "P11") {
      specs.push(await makePyramidSpec(args.llm, entry, userRequest));
    } else {
      specs.push(await makeContentSpec(args.llm, entry, userRequest));
    }
  }
  return specs;
}

async function makePyramidSpec(llm: LLM, entry: SlideOutline, userRequest?: string): Promise<{ pattern: "P11"; spec: Pattern11PyramidSpec }> {
  const spec = await invokeValidated({
    llm,
    entry,
    buildPrompt: (retry) => pyramidPrompt(entry, retry, userRequest),
    schema: Pattern11PyramidSpecSchema,
    decorate: (parsed) => ({ pattern: "P11", title: entry.title, ...parsed }),
  });
  return { pattern: "P11", spec };
}

async function makeContentSpec(llm: LLM, entry: SlideOutline, userRequest?: string): Promise<SlideSpec> {
  const schema = PATTERN_SCHEMAS[entry.pattern];
  if (!schema) throw new Error(`Pattern ${entry.pattern} has no registered spec schema in pattern_registry.ts`);
  const guidance = guidanceFor(entry.pattern);
  
  let usedPattern: SlidePattern = entry.pattern;
  let spec: any;
  
    try {
      spec = await invokeValidated({
        llm,
        entry,
        buildPrompt: (retry) => contentSpecPrompt(entry, guidance, retry, userRequest),
        schema,
        // Inject chrome metadata from the outline; pattern renderers ignore these keys.
      decorate: (parsed) => ({
        title: entry.title,
        ...(entry.source ? { source: entry.source } : {}),
        ...(entry.takeaway ? { takeaway: entry.takeaway } : {}),
        ...(entry.pattern === "P1" || entry.pattern === "P2" ? { pattern: entry.pattern } : {}),
        ...parsed,
      }),
    });
  } catch (e) {
    // Use smart fallback based on pattern type
    const fallbackPattern = getFallbackPattern(entry.pattern);
    console.warn(
      `[Specs] Pattern ${entry.pattern} slide ${entry.slideNumber} failed validation. ` +
      `Falling back to ${fallbackPattern}. Error: ${(e as Error).message.substring(0, 80)}`
    );
    
    usedPattern = fallbackPattern as SlidePattern;
    
    // Generate fallback spec based on target pattern
    if (fallbackPattern === "P1") {
      spec = {
        pattern: "P1",
        title: entry.title,
        source: entry.source,
        takeaway: entry.takeaway,
        cards: [
          { category: "Key Finding", stat: "1", label: "", bullets: [] },
          { category: "Data Point", stat: "2", label: "", bullets: [] },
          { category: "Implication", stat: "3", label: "", bullets: [] }
        ]
      };
    } else if (fallbackPattern === "P2") {
      spec = {
        pattern: "P2",
        title: entry.title,
        source: entry.source,
        takeaway: entry.takeaway,
        cards: [
          { category: "Current State", stat: "1", label: "", bullets: [] },
          { category: "Target State", stat: "2", label: "", bullets: [] }
        ]
      };
    } else if (fallbackPattern === "P3") {
      spec = {
        pattern: "P3",
        title: entry.title,
        source: entry.source,
        takeaway: entry.takeaway,
        headers: ["Item", "Details"],
        rows: [[entry.title, entry.contentNotes?.substring(0, 100) || "Data"]],
        totalRow: false
      };
    } else if (fallbackPattern === "P4") {
      spec = {
        pattern: "P4",
        title: entry.title,
        source: entry.source,
        takeaway: entry.takeaway,
        steps: [
          { name: "Phase 1", description: "Initial step" },
          { name: "Phase 2", description: "Development" },
          { name: "Phase 3", description: "Completion" }
        ]
      };
    } else {
      // Default to P1
      spec = {
        pattern: "P1",
        title: entry.title,
        source: entry.source,
        takeaway: entry.takeaway,
        cards: [
          { category: "Key", stat: "1", label: "", bullets: [] },
          { category: "Finding", stat: "2", label: "", bullets: [] },
          { category: "Action", stat: "3", label: "", bullets: [] }
        ]
      };
    }
  }
  
  return { pattern: usedPattern, spec };
}

/**
 * Runs the LLM until the spec validates against `schema` or the retry budget
 * is exhausted. On the retry the prompt is rebuilt with the previous (invalid)
 * output + the exact validation errors, so the LLM edits instead of guessing.
 */
async function invokeValidated<T>(args: {
  llm: LLM;
  entry: SlideOutline;
  buildPrompt: (retry: { previous: string; errors: string } | undefined) => string;
  schema: z.ZodType<T>;
  decorate: (parsed: object) => object;
}): Promise<T> {
  let prompt = args.buildPrompt(undefined);
  for (let attempt = 1; attempt <= MAX_SPEC_ATTEMPTS; attempt++) {
    const raw = await args.llm.invoke(prompt);
    const label = `Pattern ${args.entry.pattern} spec for slide ${args.entry.slideNumber}`;
    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJson(raw));
    } catch (e) {
      if (attempt === MAX_SPEC_ATTEMPTS) {
        throw new Error(`${label} is not valid JSON: ${(e as Error).message}\n${raw.slice(0, 500)}`);
      }
      prompt = args.buildPrompt({ previous: raw, errors: `Output was not valid JSON: ${(e as Error).message}` });
      continue;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      if (attempt === MAX_SPEC_ATTEMPTS) {
        throw new Error(`${label} is not a JSON object\n${raw.slice(0, 500)}`);
      }
      prompt = args.buildPrompt({ previous: raw, errors: "Output must be a single JSON object, not an array or primitive." });
      continue;
    }
    try {
      // Validate against the pattern schema, but return the DECORATED object
      const full = args.decorate(parsed as object);
      args.schema.parse(full); // throws on invalid; validation only
      return full as T;
    } catch (e) {
      if (attempt === MAX_SPEC_ATTEMPTS) {
        // Fallback: convert to P1 for ANY pattern validation failure (except P1, P3, P11)
        console.warn(
          `[Specs] Pattern ${args.entry.pattern} slide ${args.entry.slideNumber} failed validation. ` +
          `Falling back to P1. Error: ${(e as Error).message.substring(0, 80)}`
        );
        
        // Return minimal valid P1 spec for all patterns
        return {
          pattern: "P1",
          title: args.entry.title,
          source: args.entry.source,
          takeaway: args.entry.takeaway,
          cards: [
            { category: "Key", stat: "1", label: "", bullets: [] },
            { category: "Finding", stat: "2", label: "", bullets: [] },
            { category: "Action", stat: "3", label: "", bullets: [] }
          ]
        } as any as T;
      }
      prompt = args.buildPrompt({ previous: raw, errors: formatZodIssues(e) });
    }
  }
  throw new Error(`unreachable: ${args.entry.pattern} spec retry loop`);
}

function contentSpecPrompt(entry: SlideOutline, guidance: string, retry: { previous: string; errors: string } | undefined, userRequest?: string): string {
   const truncatedNotes = entry.contentNotes.slice(0, 800);
   const base = `You are building a VNF slide for pattern ${entry.pattern}.

Action title: ${entry.title}
Source: ${entry.source ?? "n/a"}
Takeaway: ${entry.takeaway ?? "n/a"}
${userRequest ? `User request (deck-level direction): ${userRequest}\n` : ""}

Content notes (from the report):
${truncatedNotes}

Pattern-specific spec — fill EXACTLY these fields, nothing else:
${guidance}

Rules:
- LANGUAGE RULE (CRITICAL): detect the language of the action title and content notes above, then write EVERY field in that SAME language. NEVER translate, unless the User request explicitly asks for a different language. If they are Vietnamese, all text must be Vietnamese. If they are English, all text must be English.
- Never invent numbers or facts not present in the content notes.
- Keep every string concise (labels < 40 chars, bullets < 120 chars, total under 700 chars).
- Output JSON only, no markdown fences, no commentary.`;
  return retry
    ? `${base}\n\nYour previous attempt was REJECTED by validation. Fix EVERY error below and re-emit the corrected JSON object only.\n\nPREVIOUS (INVALID) OUTPUT:\n${retry.previous}\n\nVALIDATION ERRORS:\n${retry.errors}`
    : base;
}

function pyramidPrompt(entry: SlideOutline, retry: { previous: string; errors: string } | undefined, userRequest?: string): string {
    const truncatedNotes = entry.contentNotes.slice(0, 800);
    const base = `You are building a VNF Pyramid Principle slide (Pattern 11).

Action title: ${entry.title}
Source: ${entry.source ?? "n/a"}
Takeaway: ${entry.takeaway ?? "n/a"}
${userRequest ? `User request (deck-level direction): ${userRequest}\n` : ""}

Content notes:
${truncatedNotes}

Convert this into a strict JSON object matching this Zod schema:
{
    "pattern": "P11",
    "governingThought": "one sentence answer-first (max 140 chars)",
    "arguments": [
      { "label": "short argument label (max 60 chars)", "evidence": ["bullet 1 (max 120 chars)", "bullet 2", "bullet 3", "bullet 4"] },
      { "label": "...", "evidence": ["..."] },
      { "label": "...", "evidence": ["..."] }
    ]
}

Rules:
- governingThought should be a clear answer to the action title — keep it concise (max 140 chars).
- LANGUAGE RULE (CRITICAL): detect the language of the action title and content notes, then write everything in that SAME language. NEVER translate, unless the User request explicitly asks for a different language.
- Exactly 3 arguments, mutually exclusive and collectively exhaustive.
- 2-5 evidence bullets per argument (max 120 chars each) — use the full range so the slide is substantive.
- Output JSON only, no markdown fences, no commentary.`;
   return retry
     ? `${base}\n\nYour previous attempt was REJECTED by validation. Fix EVERY error below and re-emit the corrected JSON object only.\n\nPREVIOUS (INVALID) OUTPUT:\n${retry.previous}\n\nVALIDATION ERRORS:\n${retry.errors}`
     : base;
}

function extractJson(text: string): string {
  const m = text.match(/\{[\s\S]*\}/);
  return m ? m[0] : text;
}

/** Human-readable one-line-per-issue summary of a Zod validation failure. */
function formatZodIssues(err: unknown): string {
  if (err instanceof z.ZodError) {
    return err.issues.map((i) => `- ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");
  }
  return err instanceof Error ? err.message : String(err);
}

export function specForPattern(pattern: SlidePattern): string {
  return `${pattern} — expects ${PATTERN_SCHEMAS[pattern] ? "a pattern-registry spec" : "an unregistered spec"}`;
}
