/**
 * summarizer_agent.ts
 *
 * Sub-agent (LangGraph) specialized for reading and summarizing reports.
 * This is invoked by the main agent as a tool.
 *
 * Input: reportText (full document)
 * Output: comprehensive brief ready for outline generation
 *
 * Uses AI_SUMMARY_KEY / MODEL_SUMMARY (cheaper model like ministral-3b)
 */

import { StateGraph, START, END } from "@langchain/langgraph";
import type { LLM } from "./types.js";

export interface SummarizerAgentState {
  reportText: string;
  userRequest?: string;
  summary?: string;
  error?: string;
}

/**
 * Generate the summarization prompt.
 * This is the core logic that produces a detailed, slide-ready brief.
 */
function createSummarizePrompt(reportText: string, userRequest?: string): string {
  return `You are a McKinsey/BCG-grade presentation consultant. Read the ENTIRE report below and produce a comprehensive, detailed brief that will support the creation of a 30-50 slide VNF-branded deck.

USER REQUEST: ${userRequest ?? "Create a clear, insight-driven slide deck from the report."}

COMPLETE REPORT:
---
${reportText}
---

Produce a comprehensive Markdown brief with these sections:

1. **Executive Summary** (3-5 sentences)
   - The report's core thesis and key business implications
   
2. **Key Findings & Data** (40-80 bullets, grouped by theme)
   - ALL important numbers, percentages, metrics, figures
   - Key statistics, trends, comparative data
   - Critical insights and decision-relevant facts
   - Keep every number EXACT as it appears in the report
   
3. **Quantitative Summary** (by category)
   - Financial metrics (revenue, costs, margins, growth rates, etc.)
   - Operational metrics (volume, capacity, efficiency, etc.)
   - Market data (size, share, growth, competitor benchmarks, etc.)
   - All units and currencies exactly as stated
   
4. **Main Sections & Themes**
   - How the report is organized
   - What each major section establishes
   - Key narrative flow
   
5. **Risks & Challenges** (grouped by category)
   - Major risks identified
   - Market threats
   - Operational challenges
   - Regulatory or compliance risks
   
6. **Opportunities & Recommendations** (grouped by priority)
   - Strategic opportunities
   - Actionable recommendations
   - Competitive advantages
   
7. **Key Entities & Stakeholders**
   - Companies, people, organizations mentioned
   - Roles and relationships
   
8. **Timeline & Milestones**
   - Important dates, deadlines, project phases
   - Historical context and future projections
   
9. **Suggested Narrative Arc** (5-8 conclusion-first action titles)
   - Compelling slide deck storylines in priority order
   - Each title should suggest a specific slide theme

CRITICAL RULES:
1. Use the ENTIRE report text — no data loss from truncation
2. Preserve EVERY number, percentage, date, proper noun exactly as written
3. Group findings thematically, not by report section
4. Be dense and factual — no filler or invented content
5. Support 30-50 rich slides with this brief
6. Organize data to flow naturally from insight → action

LANGUAGE RULE (CRITICAL):
- FIRST: Detect the dominant language of the source report above (Vietnamese, English, etc.)
- SECOND: Write the ENTIRE brief — every heading, bullet, action title, and section — in that SAME language
- Keep numbers, units, proper nouns and quoted terms exactly as they appear in the report
- NEVER translate the content. If the report is Vietnamese, the brief must be 100% Vietnamese. If the report is English, the brief must be 100% English.`;
}

/**
 * Summarize node: invoke LLM to produce brief.
 */
async function summarizeNode(
  state: SummarizerAgentState,
  llm: LLM
): Promise<Partial<SummarizerAgentState>> {
  try {
    const prompt = createSummarizePrompt(state.reportText, state.userRequest);
    const summary = await llm.invoke(prompt);
    return { summary };
  } catch (err: any) {
    return { error: `Summarization failed: ${err?.message ?? String(err)}` };
  }
}

/**
 * Create and compile the summarizer sub-agent graph.
 */
function compileSummarizerGraph(llm: LLM) {
  const app = new StateGraph<SummarizerAgentState>({
    channels: {
      reportText: null as any,
      userRequest: null as any,
      summary: null as any,
      error: null as any,
    },
  })
    .addNode("summarize", (state) => summarizeNode(state, llm))
    .addEdge(START, "summarize")
    .addEdge("summarize", END)
    .compile();

  return app;
}

/**
 * Main entry point: invoke the summarizer sub-agent.
 * 
 * @param llm Summary LLM (cheap, e.g., ministral-3b)
 * @param reportText Full report text to summarize
 * @param userRequest Optional user request to guide summarization
 * @returns Brief (or throws error if summarization fails)
 */
export async function invokeSummarizerAgent(
  llm: LLM,
  reportText: string,
  userRequest?: string
): Promise<string> {
  const graph = compileSummarizerGraph(llm);
  const initialState: SummarizerAgentState = {
    reportText,
    userRequest,
  };

  const result = (await graph.invoke(initialState as any)) as unknown as SummarizerAgentState;

  if (result.error) {
    throw new Error(result.error);
  }

  if (!result.summary) {
    throw new Error("Summarizer agent produced no output");
  }

  return result.summary;
}
