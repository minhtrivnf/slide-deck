/**
 * summarize.ts
 *
 * Wrapper that calls the summarizer sub-agent to read and summarize reports.
 * The sub-agent is invoked with the full report text and user request,
 * and returns a comprehensive brief ready for outline generation.
 *
 * Uses the summary LLM (cheap model like ministral-3b) configured via
 * AI_SUMMARY_KEY / MODEL_SUMMARY, or falls back to main LLM if not set.
 */

import type { LLM } from "./types.js";
import { getSummaryLLM, getLLM } from "./context.js";
import { invokeSummarizerAgent } from "./summarizer_agent.js";

export async function summarizeReport(args: {
    llm: LLM;
    reportText: string;
    userRequest?: string;
  }): Promise<string> {
    const { reportText, userRequest } = args;
    
    // Use summary LLM if available, otherwise fall back to main LLM
    const summaryLLM = getSummaryLLM() || getLLM();
    
    // Invoke the summarizer sub-agent
    console.log("[Summarize] Invoking summarizer sub-agent...");
    const summary = await invokeSummarizerAgent(summaryLLM, reportText, userRequest);
    console.log("[Summarize] Sub-agent completed, brief ready for outline generation");
    
    return summary;
}
