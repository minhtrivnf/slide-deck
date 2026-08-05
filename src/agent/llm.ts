/**
 * llm.ts
 *
 * Minimal OpenAI-compatible HTTP LLM adapter (used with Mistral's
 * /v1/chat/completions endpoint, configured via .env):
 *   AI_API_URL  e.g. https://api.mistral.ai/v1/
 *   AI_API_KEY  the API key (Authorization: Bearer)
 *   MODEL       e.g. mistral-large-2512
 *
 * Implements the `LLM` interface from types.ts so the LangGraph agent
 * can call it for outline + pattern-spec generation.
 */

import type { ChatMessage, LLM, LLMTool, ToolCall } from "./types.js";

export interface LLMConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
  /** Optional base URL ending in `/` — the path `chat/completions` is appended. */
}

/** Creates an LLM backed by an OpenAI-compatible chat-completions API. */
export function createHttpLLM(config: LLMConfig): LLM {
  const base = config.apiUrl.replace(/\/+$/, "");
  return {
    async invoke(prompt: string): Promise<string> {
      const res = await invokeChat(base, config, {
        model: config.model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      });
      const content = res.choices?.[0]?.message?.content;
      if (typeof content !== "string") {
        throw new Error(`LLM API returned no text content: ${JSON.stringify(res).slice(0, 500)}`);
      }
      return content;
    },

    async invokeMessages(messages: ChatMessage[], tools?: LLMTool[]): Promise<{ content: string; toolCalls?: ToolCall[] }> {
      const body: Record<string, unknown> = {
        model: config.model,
        messages: messages.map(serializeMessage),
        temperature: 0.2,
      };
      if (tools && tools.length > 0) {
        body.tools = tools.map((t) => ({
          type: "function",
          function: { name: t.name, description: t.description, parameters: t.parameters },
        }));
        body.tool_choice = "auto";
      }

      const res = await invokeChat(base, config, body);
      const message = res.choices?.[0]?.message;
      if (!message) {
        throw new Error(`LLM API returned no message: ${JSON.stringify(res).slice(0, 500)}`);
      }
      const content = typeof message.content === "string" ? message.content : "";
      const toolCalls: ToolCall[] | undefined = Array.isArray(message.tool_calls)
        ? message.tool_calls
            .filter((tc: any) => tc?.type === "function")
            .map((tc: any) => ({
              id: tc.id ?? `call_${tc.function?.name ?? "unknown"}`,
              name: tc.function?.name ?? "unknown",
              arguments: typeof tc.function?.arguments === "string" ? tc.function.arguments : JSON.stringify(tc.function?.arguments ?? {}),
            }))
        : undefined;
      return { content, toolCalls };
    },
  };
}

async function invokeChat(base: string, config: LLMConfig, body: Record<string, unknown>): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`LLM API error ${res.status}: ${errBody.slice(0, 500)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

/** Converts our ChatMessage into the wire format for OpenAI-compatible APIs. */
function serializeMessage(msg: ChatMessage): Record<string, unknown> {
  switch (msg.role) {
    case "system":
    case "user":
      return { role: msg.role, content: msg.content };
    case "tool":
      return { role: "tool", tool_call_id: msg.toolCallId, content: msg.content };
    case "assistant":
    default: {
      const out: Record<string, unknown> = { role: "assistant", content: msg.content || null };
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        out.tool_calls = msg.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: tc.arguments },
        }));
      }
      return out;
    }
  }
}
