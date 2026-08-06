/**
 * revise.ts
 *
 * Handles a feedback turn in the chat loop. It is intentionally narrow:
 * the user asks to change a specific slide, so we only let the LLM edit
 * that slide. Every other slide is restored from the previous specs,
 * guaranteeing the rest of the deck is bit-for-bit unchanged.
 *
 * Revision flow:
 *   1. Parse which slide(s) the user mentions (slide number, pattern or title).
 *   2. Send a focused prompt containing ONLY the target slide(s) plus a
 *      short neighbour context so the LLM has orientation.
 *   3. Restore every non-target slide from the previous spec array.
 *   4. Tolerant merge: if the LLM's revised target slide fails validation,
 *      keep the previous version for that slide and continue.
 */

import type { LLM, SlideSpec, SlideOutline } from "./types.js";
import { PATTERN_SCHEMAS } from "./pattern_registry.js";

export async function reviseSpecs(args: {
  llm: LLM;
  outline: SlideOutline[] | undefined;
  specs: SlideSpec[];
  feedback: string;
  summary?: string;
}): Promise<SlideSpec[]> {
  const { llm, specs, feedback, summary, outline } = args;

  const targetIndices = new Set(resolveTargetSlideIndices(feedback, specs, outline ?? []));
  if (targetIndices.size === 0) {
    console.warn(`[Revise] No explicit slide target found in feedback. Treating as global edit request.`);
    // Fall back to old behaviour only when the user does not name a slide at all.
    return reviseAllSpecs({ llm, specs, feedback, summary });
  }

  console.log(`[Revise] Target slide indices: ${[...targetIndices].map((i) => i + 1).join(", ")}`);

  const focusedPrompt = buildFocusedRevisionPrompt({
    feedback,
    summary,
    specs,
    outline: outline ?? [],
    targetIndices,
  });

  const raw = await llm.invoke(focusedPrompt);
  const jsonText = stripCodeFences(raw).match(/\[[\s\S]*\]/)?.[0] ?? raw;
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    throw new Error(`Revision LLM output is not valid JSON: ${(e as Error).message}\n${raw.slice(0, 500)}`);
  }
  if (!Array.isArray(parsed)) throw new Error("Revision LLM output is not a JSON array");

  // Build a map of the LLM's revised specs keyed by slide index. The LLM is
  // asked to return one entry per target slide, in the same order as the
  // targets we gave it. If it returns fewer/more items, match by index.
  const revisedByIndex = new Map<number, unknown>();
  const targetArr = [...targetIndices].sort((a, b) => a - b);
  parsed.forEach((entry, i) => {
    const idx = targetArr[i] ?? targetArr[0]; // fallback to first target if count mismatches
    if (idx !== undefined) revisedByIndex.set(idx, entry);
  });

  // Tolerant merge: every non-target slide is restored from the previous
  // array. Target slides that fail validation also keep the previous version.
  const merged: SlideSpec[] = [];
  for (let i = 0; i < specs.length; i++) {
    if (!targetIndices.has(i)) {
      merged.push(specs[i]);
      continue;
    }
    const revised = revisedByIndex.get(i);
    if (revised === undefined) {
      merged.push(specs[i]);
      continue;
    }
    try {
      merged.push(validateSpec(revised));
    } catch (err) {
      console.warn(
        `[Revise] Slide ${i + 1} revision failed validation (${(err as Error).message}). Keeping previous version.`
      );
      merged.push(specs[i]);
    }
  }
  // Hard restore: any non-target slide that somehow differs from the previous
  // version is forced back to its original spec. This prevents a misbehaving LLM
  // from silently rewriting neighbouring slides even if it ignored the prompt.
  const restored: SlideSpec[] = merged.map((spec, i) => {
    if (targetIndices.has(i)) return spec;
    if (deepEqual(spec, specs[i])) return spec;
    console.warn(`[Revise] Slide ${i + 1} was modified despite not being a target; restoring previous version.`);
    return specs[i];
  });

  return restored;
}

/** Resolve zero-based slide indices from the user's feedback. */
function resolveTargetSlideIndices(
  feedback: string,
  specs: SlideSpec[],
  outline: SlideOutline[]
): number[] {
  const normalized = feedback.toLowerCase();
  const indices = new Set<number>();

  // Explicit "slide N", "slide số N", "trang N", "slide thứ N"
  const slideNumberMatches = [
    ...normalized.matchAll(/(?:slide|trang|page|slide thứ|trang số)\s*(?:số?\s*)?(\d+)/g),
    ...normalized.matchAll(/\bslide\s*(\d+)\b/g),
  ];
  for (const m of slideNumberMatches) {
    const n = parseInt(m[1], 10);
    if (n >= 2 && n - 2 < specs.length) indices.add(n - 2); // slide 2 -> index 0 (Agenda)
  }

  // If the user explicitly named a slide number, trust that and stop. Title/pattern
  // keyword matching is too noisy and can pull in unrelated slides (e.g. "chi tiết"
  // appears in many titles).
  if (indices.size > 0) return [...indices].sort((a, b) => a - b);

  // Pattern references like [P11], pattern P11, P11 slide
  const patternMatches = [...normalized.matchAll(/\b(p\d{1,2})\b/g)];
  for (const m of patternMatches) {
    const p = m[1].toUpperCase() as SlideSpec["pattern"];
    specs.forEach((s, i) => {
      if (s.pattern === p) indices.add(i);
    });
  }

  // Title keyword matching: strip noise but keep language-change words because
  // "chuyển slide X sang tiếng Anh" has no meaningful topic keyword otherwise.
  const languageChangeWords = /\b(english|tiếng anh|tiếng việt|vietnamese|sang tiếng|switch to|translate to|make.*english|make.*vietnamese)\b/g;
  const hasLanguageChange = languageChangeWords.test(normalized);

  const titleKeywords = normalized
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w) && !(hasLanguageChange && LANGUAGE_WORDS.has(w)));
  for (const keyword of titleKeywords) {
    outline.forEach((o, i) => {
      if (o?.title?.toLowerCase().includes(keyword)) indices.add(i);
    });
  }

  return [...indices].sort((a, b) => a - b);
}

const STOP_WORDS = new Set([
  "bổ", "sung", "nội", "dung", "cho", "thêm", "vào", "sửa", "chỉnh", "slide",
  "trang", "của", "các", "những", "theo", "hãy", "làm", "đổi", "thay", "update",
  "thêm", "vào", "bỏ", "xóa", "điều", "này", "kia", "thế", "này", "hơn", "mới",
  "cần", "phải", "nên", "được", "và", "hoặc", "với", "của", "trên", "dưới",
  "add", "content", "for", "to", "the", "update", "change", "edit", "modify",
  "please", "can", "you", "this", "that", "these", "those", "in", "on", "and",
  "or", "with", "of", "about", "more", "less", "some", "any", "all", "from",
]);

const LANGUAGE_WORDS = new Set([
  "english", "tiếng", "anh", "việt", "vietnamese", "sang", "switch", "translate", "make",
]);

function buildFocusedRevisionPrompt(args: {
  feedback: string;
  summary?: string;
  specs: SlideSpec[];
  outline: SlideOutline[];
  targetIndices: Set<number>;
}): string {
  const { feedback, summary, specs, outline, targetIndices } = args;
  const targets = [...targetIndices].sort((a, b) => a - b);

  const targetEntries = targets.map((idx) => {
    const slideNumber = idx + 3;
    const out = outline[idx] ?? { slideNumber, title: "", contentNotes: "" };
    return {
      index: idx,
      slideNumber,
      pattern: specs[idx].pattern,
      title: out.title || "",
      contentNotes: out.contentNotes || "",
      spec: specs[idx].spec,
    };
  });

  // Include one slide before and after each target for context, but do NOT
  // include their full specs so the LLM is not tempted to rewrite them.
  const neighbourNumbers = new Set<number>();
  targets.forEach((idx) => {
    if (idx > 0) neighbourNumbers.add(idx - 1);
    if (idx < specs.length - 1) neighbourNumbers.add(idx + 1);
  });
  const neighbourSummaries = [...neighbourNumbers]
    .sort((a, b) => a - b)
    .map((idx) => {
      const out = outline[idx] ?? { slideNumber: idx + 3, title: "", pattern: specs[idx].pattern };
      return `- Slide ${out.slideNumber || idx + 3}: [${specs[idx].pattern}] ${out.title || ""}`;
    })
    .join("\n");

  const targetJson = JSON.stringify(targetEntries, null, 2);

  return `You are updating ONE OR MORE specific slides in an existing VNF slide deck.

USER FEEDBACK (ONLY this should drive changes):
${feedback}

${summary ? `REPORT CONTENT BRIEF (use only if the feedback asks for new facts from the report):
${summary.slice(0, 8000)}
` : ""}

TARGET SLIDE(S) TO EDIT — modify only these:
${targetJson}

NEIGHBOURING SLIDES (for context only — DO NOT change these):
${neighbourSummaries || "(none)"}

Rules:
- Edit ONLY the target slide(s) above to address the feedback.
- DO NOT change any other slide. The neighbouring slides are shown only for context.
- Keep the same pattern unless the feedback explicitly asks to change it.
- Preserve every field the renderer needs. A P11 spec must keep pattern "P11", governingThought, and exactly 3 arguments (each with 2-5 evidence bullets, max 120 chars each).
- Keep titles within 100 characters.
- Use real facts from the REPORT CONTENT BRIEF when the feedback asks to add content; never invent data.
- LANGUAGE RULE (CRITICAL): detect the language of the existing slide text, then keep all text in that SAME language. NEVER translate — EXCEPT when the user explicitly asks to change language (e.g., "make slide 10 English" / "chuyển slide 10 sang tiếng Anh"), in which case translate EVERY field of the target slide(s) to the requested language.
- Output a JSON array containing exactly the updated spec objects for the target slide(s), in the same order as the target slides listed above. No markdown fences, no explanation, no extra slides, no extra fields.`;
}

/** Fallback: old global revision behaviour when the user does not name a slide. */
async function reviseAllSpecs(args: {
  llm: LLM;
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
- LANGUAGE RULE (CRITICAL): detect the language of the existing slides above, then keep all text in that SAME language. NEVER translate.
- Keep the same slide count and patterns UNLESS the feedback explicitly asks to add or remove a slide.
- Preserve every field the renderer needs. A P11 spec must keep pattern "P11", governingThought, and exactly 3 arguments (each with 2-5 evidence bullets, max 120 chars each).
- Keep titles within 100 characters.
- LANGUAGE RULE (CRITICAL): detect the language of the existing slides above, then keep all text in that SAME language. NEVER translate — EXCEPT when the user explicitly asks to change language (e.g., "make all slides English" / "chuyển toàn bộ sang tiếng Anh"), in which case translate EVERY field of EVERY slide to the requested language.
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
  const schema = PATTERN_SCHEMAS[pattern];
  if (!schema) throw new Error(`Revised spec for ${pattern} has no registered schema in pattern_registry.ts`);
  schema.parse(spec);
  return { pattern: pattern as SlideSpec["pattern"], spec } as SlideSpec;
}

/** Deep equality check for plain JSON objects (specs, arrays, primitives). */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object" || a === null || b === null) return false;

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const keysA = Object.keys(aObj);
  const keysB = Object.keys(bObj);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(bObj, key)) return false;
    if (!deepEqual(aObj[key], bObj[key])) return false;
  }
  return true;
}

/** Strips markdown code fences (```json / ```) that some LLMs add around JSON. */
function stripCodeFences(text: string): string {
  return text.replace(/```[a-zA-Z]*\n?/g, "").trim();
}
