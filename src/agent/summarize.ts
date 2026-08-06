/**
 * summarize.ts
 *
 * Distills the full report text into a structured, dense brief that the
 * outliner can consume. This is the explicit "đọc → tóm tắt nội dung" step:
 * the raw report can be arbitrarily long, so we pay one LLM call to compress
 * it (preserving every important number/finding) before outlining — instead
 * of silently truncating the raw text and losing the tail of the document.
 */

import type { LLM } from "./types.js";

export async function summarizeReport(args: {
   llm: LLM;
   reportText: string;
   userRequest?: string;
   /** Hard cap on the report slice passed to the summarizer. */
   maxChars?: number;
 }): Promise<string> {
   const { llm, reportText, userRequest, maxChars = 120000 } = args;
  const truncated = reportText.slice(0, maxChars);
  const prompt = `You are a McKinsey/BCG-grade presentation consultant. Distill the following report into a dense, structured brief that a slide-outliner will use to build a VNF-branded deck.

USER REQUEST: ${userRequest ?? "Create a clear, insight-driven slide deck from the report."}

REPORT:
---
${truncated}
${reportText.length > truncated.length ? "\n[Report truncated for length]" : ""}
---

Produce a Markdown brief with these sections:
1. **Executive summary** — the report's central thesis in 2-3 sentences.
2. **Key findings & data** — bullet list of the most decision-relevant facts; keep every important number, figure and quote exact.
3. **Structure** — main sections and what each establishes.
4. **Risks / gaps / recommendations** — what the report flags.
5. **Suggested storyline** — 3-6 candidate conclusion-first action titles in priority order.

Be dense and factual. Do not invent data. Never soften a number you cannot source.

LANGUAGE RULE (CRITICAL):
- FIRST: detect the dominant language of the source report above (Vietnamese, English, etc.)
- SECOND: write the ENTIRE brief — every heading, bullet, action title, and section — in that SAME language.
- Keep numbers, units, proper nouns and quoted terms exactly as they appear in the report.
- NEVER translate the content. If the report is Vietnamese, the brief must be 100% Vietnamese. If the report is English, the brief must be 100% English.`;
  return llm.invoke(prompt);
}
