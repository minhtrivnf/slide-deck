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
 */

import { z } from "zod";
import type { SlideOutline, SlideSpec, SlidePattern, LLM } from "./types.js";
import { Pattern11PyramidSpecSchema, type Pattern11PyramidSpec } from "../types.js";
import { PATTERN_SCHEMAS, guidanceFor } from "./pattern_registry.js";

/** Max LLM attempts per spec, including the error-feedback retry. */
const MAX_SPEC_ATTEMPTS = 2;

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
  const spec = await invokeValidated({
    llm,
    entry,
    buildPrompt: (retry) => pyramidPrompt(entry, retry),
    schema: Pattern11PyramidSpecSchema,
    decorate: (parsed) => ({ pattern: "P11", title: entry.title, ...parsed }),
  });
  return { pattern: "P11", spec };
}

async function makeContentSpec(llm: LLM, entry: SlideOutline): Promise<SlideSpec> {
  const schema = PATTERN_SCHEMAS[entry.pattern];
  if (!schema) throw new Error(`Pattern ${entry.pattern} has no registered spec schema in pattern_registry.ts`);
  const guidance = guidanceFor(entry.pattern);
  const spec = await invokeValidated({
    llm,
    entry,
    buildPrompt: (retry) => contentSpecPrompt(entry, guidance, retry),
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
  return { pattern: entry.pattern as Exclude<SlidePattern, "P11">, spec };
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
      // (which also carries title/source/takeaway chrome). schema.parse()
      // strips unknown keys, so returning its result would wipe the chrome
      // metadata and render every slide header blank — validate, don't replace.
      const full = args.decorate(parsed as object);
      args.schema.parse(full); // throws on invalid; validation only
      return full as T;
    } catch (e) {
      if (attempt === MAX_SPEC_ATTEMPTS) {
        throw new Error(`${label} failed validation after ${MAX_SPEC_ATTEMPTS} attempts:\n${formatZodIssues(e)}`);
      }
      prompt = args.buildPrompt({ previous: raw, errors: formatZodIssues(e) });
    }
  }
  throw new Error(`unreachable: ${args.entry.pattern} spec retry loop`);
}

function contentSpecPrompt(entry: SlideOutline, guidance: string, retry: { previous: string; errors: string } | undefined): string {
   const truncatedNotes = entry.contentNotes.slice(0, 800);
   const base = `You are building a VNF slide for pattern ${entry.pattern}.

Action title: ${entry.title}
Source: ${entry.source ?? "n/a"}
Takeaway: ${entry.takeaway ?? "n/a"}

Content notes (from the report):
${truncatedNotes}

Pattern-specific spec — fill EXACTLY these fields, nothing else:
${guidance}

Rules:
- LANGUAGE RULE (CRITICAL): detect the language of the action title and content notes above, then write EVERY field in that SAME language. NEVER translate. If they are Vietnamese, all text must be Vietnamese. If they are English, all text must be English.
- Never invent numbers or facts not present in the content notes.
- Keep every string concise (labels < 40 chars, bullets < 120 chars, total under 700 chars).
- Output JSON only, no markdown fences, no commentary.`;
  return retry
    ? `${base}\n\nYour previous attempt was REJECTED by validation. Fix EVERY error below and re-emit the corrected JSON object only.\n\nPREVIOUS (INVALID) OUTPUT:\n${retry.previous}\n\nVALIDATION ERRORS:\n${retry.errors}`
    : base;
}

function pyramidPrompt(entry: SlideOutline, retry: { previous: string; errors: string } | undefined): string {
   const truncatedNotes = entry.contentNotes.slice(0, 800);
   const base = `You are building a VNF Pyramid Principle slide (Pattern 11).

Action title: ${entry.title}
Source: ${entry.source ?? "n/a"}
Takeaway: ${entry.takeaway ?? "n/a"}

Content notes:
${truncatedNotes}

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
- LANGUAGE RULE (CRITICAL): detect the language of the action title and content notes, then write everything in that SAME language. NEVER translate.
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
