/**
 * types.ts
 *
 * Shared types for the VNF LangGraph agent that turns a Word report into a
 * VNF slide deck. The state keeps the raw report text, the LLM-derived
 * outline/specs, rendered XML fragments, and any errors so the graph can
 * retry or surface a clear failure.
 */

import type { Pattern11PyramidSpec } from "../types.js";

export type SlidePattern =
  | "P11" // Pyramid Principle (implemented)
  | "P1" | "P2" | "P3" | "P4" | "P5" | "P6" | "P7" | "P8" | "P9"
  | "P10" | "P12" | "P13" | "P14" | "P15" | "P16" | "P17" | "P18"
  | "P19" | "P20" | "P21" | "P22" | "P23" | "P24";

/** One slide in the agent-generated outline. */
export interface SlideOutline {
  slideNumber: number;
  pattern: SlidePattern;
  /** Conclusion-first headline (action title) or short title for dividers. */
  title: string;
  /** Optional source citation for data-driven slides. */
  source?: string;
  /** Zone 4 takeaway implication. */
  takeaway?: string;
  /** Free-form notes the LLM can use to drive pattern-specific content. */
  contentNotes: string;
}

/** Discriminated union of pattern-specific specs. */
export type SlideSpec =
  | { pattern: "P11"; spec: Pattern11PyramidSpec }
  | { pattern: Exclude<SlidePattern, "P11">; spec: unknown };

/** A rendered slide plus metadata for assembly. */
export interface RenderedSlide {
  slideNumber: number;
  pattern: SlidePattern;
  title: string;
  source?: string;
  takeaway?: string;
  bodyXml: string;
  shapeIds: number[];
}

/** LangGraph agent state. */
export interface AgentState {
  /** Absolute path to the input .docx file. */
  docxPath: string;
  /** Working directory where the unpacked pptx and output will live. */
  workDir: string;
  /** Deck title (from report title or user). */
  deckTitle?: string;
  /** Maximum number of content slides to generate. */
  maxSlides?: number;
  /** Absolute path for the final .pptx (defaults to <workDir>/deck.pptx). */
  outputPptxPath?: string;
  /** Free-form user request ("make a deck emphasizing safety risks"). */
  userRequest?: string;
  /** Latest user feedback for a revision turn (drives the revise node). */
  feedback?: string;
  /** Conversation history for auditability of revision turns. */
  messages: ChatMessage[];
  /** ReAct loop iteration counter (bounds runaway loops). */
  step?: number;
  /** Plain-text/Markdown extracted from the Word report. */
  reportText?: string;
  /** Embedded media filenames found in the .docx. */
  mediaFiles?: string[];
  /** LLM-distilled brief used to drive outline generation. */
  summary?: string;
  /** Error that should stop or retry the workflow. */
  error?: string;
   /** Generated outline. */
   outline?: SlideOutline[];
   /** Path to exported outline markdown file. */
   outlineExportPath?: string;
   /** Pattern specs produced from the outline. */
   specs?: SlideSpec[];
  /** Rendered slides (XML fragments). */
  renderedSlides?: RenderedSlide[];
  /** Gate A validation result after assembly. */
  validationOk?: boolean;
  /** Gate A validation messages. */
  validationMessages?: string[];
}

/** Minimal LLM contract expected by the agent. */
export interface LLM {
  invoke(prompt: string): Promise<string>;
  /**
   * Native tool-calling invocation. `tools` is an optional array of JSON-Schema
   * tool definitions; when present the LLM may return structured `toolCalls`
   * instead of plain text. Implementations without native tool support can
   * fall back to `invoke` semantics (return content, no toolCalls).
   */
  invokeMessages(messages: ChatMessage[], tools?: LLMTool[]): Promise<LLMInvokeResult>;
}

/** One structured tool invocation returned by the LLM. */
export interface ToolCall {
  id: string;
  name: string;
  /** JSON-encoded arguments string. */
  arguments: string;
}

/** A conversation message sent to / produced by the LLM. */
export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  /** Present on assistant messages that request tool calls. */
  toolCalls?: ToolCall[];
  /** Present on tool messages; must match the originating tool call id. */
  toolCallId?: string;
}

/** A JSON-Schema tool definition exposed to the LLM. */
export interface LLMTool {
  name: string;
  description: string;
  /** JSON Schema (draft-07 style) for the arguments object. */
  parameters: Record<string, unknown>;
}

/** Result of an LLM tool-calling turn. */
export interface LLMInvokeResult {
  content: string;
  toolCalls?: ToolCall[];
}

export interface BuildDeckOptions {
  docxPath: string;
  workDir: string;
  deckTitle?: string;
  llm: LLM;
  /** Free-form user request that guides summarization + outlining. */
  userRequest?: string;
  /** Absolute path for the final .pptx. Defaults to <workDir>/deck.pptx. */
  outputPptxPath?: string;
  /** Hard cap on slides (content decides the actual count). Default 20. */
  maxSlides?: number;
}
