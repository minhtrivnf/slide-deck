/**
 * revise.ts
 *
 * Handles a feedback turn in the chat loop ("bổ sung nội dung A cho slide 2").
 * The LLM sees the current outline + specs + the user's feedback and returns
 * the FULL updated specs array. Re-rendering + repacking then regenerates the
 * deck, so the user can iterate conversationally instead of restarting.
 */

import type { LLM, SlideSpec } from "./types.js";
import { Pattern11PyramidSpecSchema } from "../types.js";
import { PatternContentSchema } from "./pattern_spec.js";

export async function reviseSpecs(args: {
  llm: LLM;
  outline: unknown;
  specs: SlideSpec[];
  feedback: string;
  summary?: string;
}): Promise<SlideSpec[]> {
  const { llm, specs, feedback, summary } = args;
  const current = JSON.stringify(specs, null, 2);

  const prompt = `You are updating an existing VNF slide deck based on a user's feedback.

CURRENT SLIDES (specs JSON array — slide order matters, slide numbers start at 3):
${current}

${summary ? `REPORT CONTENT BRIEF (use it as source material to enrich slides when the feedback asks for more content):
${summary.slice(0, 15000)}
` : ""}

USER FEEDBACK:
${feedback}

Rules:
- Edit the relevant slide spec(s) to address the feedback. Reference slides by their pattern and content.
- When the feedback asks to enrich/add content, expand bullets, evidence and lists with REAL facts and numbers from the REPORT CONTENT BRIEF — never invent data.
- LANGUAGE: keep all text in the same language as the existing slides (Vietnamese if the deck is Vietnamese).
- Keep the same slide count and patterns UNLESS the feedback explicitly asks to add or remove a slide.
- Preserve every field the renderer needs. A P11 spec must keep pattern "P11", governingThought, and exactly 3 arguments (each with 2-5 evidence bullets, max 120 chars each).
- Keep titles within 100 characters.
- Output a JSON array ONLY, no markdown fences, no explanation — the FULL updated specs array.`;

  const raw = await llm.invoke(prompt);
  const jsonText = stripCodeFences(raw).match(/\[[\s\S]*\]/)?.[0] ?? raw;
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    throw new Error(`Revision LLM output is not valid JSON: ${(e as Error).message}\n${raw.slice(0, 500)}`);
  }
  if (!Array.isArray(parsed)) throw new Error("Revision LLM output is not a JSON array");

  // Tolerant merge: a slide that fails validation keeps its previous version
  // instead of failing the whole revision turn; invalid extra slides are dropped.
  const merged: SlideSpec[] = [];
  parsed.forEach((entry, i) => {
    try {
      merged.push(validateSpec(entry));
    } catch {
      if (i < specs.length) merged.push(specs[i]);
    }
  });
  return merged;
}

function validateSpec(entry: unknown): SlideSpec {
  if (!entry || typeof entry !== "object") throw new Error("Revised spec is not an object");
  const { pattern, spec } = entry as { pattern?: unknown; spec?: unknown };
  if (typeof pattern !== "string" || !pattern.startsWith("P")) throw new Error(`Revised spec has invalid pattern: ${String(pattern)}`);
  if (spec === undefined || spec === null) throw new Error(`Revised spec for ${pattern} is missing the "spec" object`);
  if (pattern === "P11") {
    Pattern11PyramidSpecSchema.parse(spec);
  } else {
    PatternContentSchema.parse(spec);
  }
  return { pattern: pattern as SlideSpec["pattern"], spec } as SlideSpec;
}

/** Strips markdown code fences (```json / ```) that some LLMs add around JSON. */
function stripCodeFences(text: string): string {
  return text.replace(/```[a-zA-Z]*\n?/g, "").trim();
}
