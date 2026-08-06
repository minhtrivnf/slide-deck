/**
 * context.ts
 *
 * Process-wide holder for LLM instances:
 * - globalLLM: Main LLM for outline, specs, revise (expensive, high quality)
 * - summaryLLM: Summary LLM for sub-agent (cheap, e.g., ministral-3b)
 *
 * Kept separate from graph.ts to avoid circular imports.
 */

import type { LLM } from "./types.js";

let globalLLM: LLM | undefined;
let summaryLLM: LLM | undefined;

export function setLLM(llm: LLM): void {
   globalLLM = llm;
 }
 
 export function getLLM(): LLM {
   if (!globalLLM) throw new Error("No LLM configured. Call setLLM() before running the graph.");
   return globalLLM;
 }

 export function setSummaryLLM(llm: LLM | undefined): void {
   summaryLLM = llm;
 }
 
 export function getSummaryLLM(): LLM | undefined {
   return summaryLLM;
 }
