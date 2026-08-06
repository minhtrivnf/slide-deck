/**
 * graph.ts
 *
 * Linear, LLM-at-the-judgement-points pipeline for converting a Word report
 * into a VNF slide deck, plus a conversational feedback loop:
 *
 *   First build:
 *     START → extract → summarize → outline → specs → render → pack → END
 *
 *   Feedback turn (user chats "add content A to slide 2"):
 *     START → revise → render → pack → END
 *
 * LLM is called exactly once per judgement step (summarize, outline, specs,
 * revise); extract/render/pack are deterministic. The user can iterate
 * indefinitely: reviseDeck() re-runs the graph with the previous state, so
 * every turn keeps the summary/outline/specs and only re-renders + repacks.
 *
 * Any node failure sets state.error and routes to END.
 */

import { join } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { StateGraph, START, END } from "@langchain/langgraph";
import { setLLM, getLLM } from "./context.js";
import { extractReport } from "./docx.js";
import { summarizeReport } from "./summarize.js";
import { generateOutline } from "./outliner.js";
import { generateSpecs } from "./specs.js";
import { reviseSpecs } from "./revise.js";
import { renderSlides } from "./renderer.js";
import { DeckAssembler } from "./assembler.js";
import type { AgentState, BuildDeckOptions, ChatMessage } from "./types.js";

const TEMPLATE_PATH = fileURLToPath(new URL("../../assets/vnf_slide_template.pptx", import.meta.url));
const PROJECT_ROOT = fileURLToPath(new URL("../..", import.meta.url));

export function resolveTemplatePath(): string {
  if (existsSync(TEMPLATE_PATH)) return TEMPLATE_PATH;
  const fromProjectRoot = join(PROJECT_ROOT, "assets", "vnf_slide_template.pptx");
  if (existsSync(fromProjectRoot)) return fromProjectRoot;
  const cwdFallback = join(process.cwd(), "assets", "vnf_slide_template.pptx");
  if (existsSync(cwdFallback)) return cwdFallback;
  throw new Error(`VNF slide template not found at ${TEMPLATE_PATH}, ${fromProjectRoot}, or ${cwdFallback}`);
}

const app = new StateGraph<any>({
  channels: {
    docxPath: null as any,
    workDir: null as any,
    deckTitle: null as any,
    maxSlides: null as any,
    outputPptxPath: null as any,
    userRequest: null as any,
    feedback: null as any,
    messages: null as any,
    reportText: null as any,
    mediaFiles: null as any,
    summary: null as any,
    error: null as any,
    outline: null as any,
    specs: null as any,
    renderedSlides: null as any,
    validationOk: null as any,
    validationMessages: null as any,
  },
})
  .addNode("extract", withErrorHandling("extract", extractNode))
  .addNode("summarize", withErrorHandling("summarize", summarizeNode))
  .addNode("buildOutline", withErrorHandling("buildOutline", outlineNode))
  .addNode("buildSpecs", withErrorHandling("buildSpecs", specsNode))
  .addNode("revise", withErrorHandling("revise", reviseNode))
  .addNode("render", withErrorHandling("render", renderNode))
  .addNode("pack", withErrorHandling("pack", packNode))
  .addConditionalEdges(START, (state: any) => (state?.feedback ? "revise" : "extract"))
  .addConditionalEdges("extract", route("summarize"))
  .addConditionalEdges("summarize", route("buildOutline"))
  .addConditionalEdges("buildOutline", route("buildSpecs"))
  .addConditionalEdges("buildSpecs", route("render"))
  .addConditionalEdges("revise", route("render"))
  .addConditionalEdges("render", route("pack"))
  .addEdge("pack", END)
  .compile();

function withErrorHandling(nodeName: string, nodeFn: (state: AgentState) => Promise<Partial<AgentState>>): (state: AgentState) => Promise<Partial<AgentState>> {
  return async (state) => {
    try {
      return await nodeFn(state);
    } catch (err: any) {
      return { error: `[${nodeName}] ${err?.message ?? String(err)}` };
    }
  };
}

/** Conditional edge helper: on error stop, otherwise continue to `next`. */
function route(next: string) {
  return (state: any) => (state.error ? END : next);
}

// ---------------------------------------------------------------------------
// Build-path nodes (first run)
// ---------------------------------------------------------------------------

async function extractNode(state: AgentState): Promise<Partial<AgentState>> {
  const extracted = await extractReport(state.docxPath);
  return { reportText: extracted.text, mediaFiles: extracted.mediaFiles };
}

async function summarizeNode(state: AgentState): Promise<Partial<AgentState>> {
  const summary = await summarizeReport({
    llm: getLLM(),
    reportText: state.reportText!,
    userRequest: state.userRequest,
  });
  return { summary };
}

async function outlineNode(state: AgentState): Promise<Partial<AgentState>> {
  const result = await generateOutline({
    llm: getLLM(),
    reportText: state.summary ?? state.reportText!,
    deckTitle: state.deckTitle,
    userRequest: state.userRequest,
    maxSlides: state.maxSlides,
  });
  return { outline: result.slides, deckTitle: result.deckTitle };
}

async function specsNode(state: AgentState): Promise<Partial<AgentState>> {
  const specs = await generateSpecs({ llm: getLLM(), outline: state.outline! });
  return { specs };
}

// ---------------------------------------------------------------------------
// Feedback-path node (revision turns)
// ---------------------------------------------------------------------------

async function reviseNode(state: AgentState): Promise<Partial<AgentState>> {
  const specs = await reviseSpecs({
    llm: getLLM(),
    outline: state.outline,
    specs: state.specs!,
    feedback: state.feedback!,
    summary: state.summary,
  });
  return { specs, feedback: undefined };
}

// ---------------------------------------------------------------------------
// Shared deterministic nodes
// ---------------------------------------------------------------------------

async function renderNode(state: AgentState): Promise<Partial<AgentState>> {
  const renderedSlides = renderSlides(2, state.specs!);
  return { renderedSlides };
}

async function packNode(state: AgentState): Promise<Partial<AgentState>> {
  const outputPath = state.outputPptxPath ?? join(state.workDir, "deck.pptx");
  const assembler = new DeckAssembler(resolveTemplatePath(), state.workDir);
  await assembler.init();
  await assembler.setCoverTitle(state.deckTitle ?? "VNF Report Deck");
  for (const slide of state.renderedSlides!) {
    await assembler.addSlide(slide.slideNumber, slide.bodyXml);
  }
  await assembler.pack(outputPath);
  const validation = assembler.getValidationResult();
  return {
    outputPptxPath: outputPath,
    validationOk: validation.ok,
    validationMessages: validation.errors,
  };
}

export { setLLM };

/** First build: docx → extract → summarize → outline → specs → render → pack. */
export async function buildDeck(options: BuildDeckOptions): Promise<AgentState> {
  setLLM(options.llm);
  const initialState: any = {
    docxPath: options.docxPath,
    workDir: options.workDir,
    deckTitle: options.deckTitle ?? "VNF Report Deck",
    maxSlides: options.maxSlides ?? 20,
    outputPptxPath: options.outputPptxPath,
    userRequest: options.userRequest,
    feedback: undefined,
    messages: [{ role: "user", content: options.userRequest ?? `Tạo slide deck từ báo cáo tại ${options.docxPath}` }],
    reportText: undefined,
    mediaFiles: undefined,
    summary: undefined,
    error: undefined,
    outline: undefined,
    specs: undefined,
    renderedSlides: undefined,
    validationOk: undefined,
    validationMessages: undefined,
  };
  return app.invoke(initialState) as Promise<AgentState>;
}

/**
 * Feedback turn: reuse the previous state, patch the specs via the LLM, and
 * re-render + repack so the deck reflects the new request.
 */
export async function reviseDeck(prevState: AgentState, feedback: string, outputPptxPath?: string): Promise<AgentState> {
  const nextState: any = {
    ...prevState,
    feedback,
    error: undefined,
    validationOk: undefined,
    validationMessages: undefined,
    outputPptxPath: outputPptxPath ?? join(prevState.workDir, "deck.pptx"),
    messages: [...(prevState.messages ?? []), { role: "user", content: feedback } as ChatMessage],
  };
  return app.invoke(nextState) as Promise<AgentState>;
}
