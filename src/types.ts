/**
 * types.ts
 *
 * Zod schemas define the contract between the LM (which produces JSON)
 * and the pattern renderers (which produce XML). Validating here means a
 * malformed slide spec fails fast with a readable message *before* any
 * XML is generated — instead of surfacing later as a Gate A/B failure or,
 * worse, a silent layout bug only Gate C (visual spot-check) catches.
 *
 * Only Pattern 11 (Pyramid) is modeled in Phase 2. Each additional
 * pattern gets its own schema here as it's ported.
 */

import { z } from "zod";

export const HexColorSchema = z
  .string()
  .regex(/^[0-9A-Fa-f]{6}$/, "must be a 6-digit hex color without '#' (e.g. \"002060\")");

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
