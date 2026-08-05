/**
 * context.ts
 *
 * Process-wide holder for the LLM instance used by LLM-backed tools
 * (generate_outline / generate_specs). Kept separate from graph.ts so the
 * tool registry can use it without a circular import.
 */

import type { LLM } from "./types.js";

let globalLLM: LLM | undefined;

export function setLLM(llm: LLM): void {
  globalLLM = llm;
}

export function getLLM(): LLM {
  if (!globalLLM) throw new Error("No LLM configured. Call setLLM() before running the graph.");
  return globalLLM;
}
