/**
 * intake.ts
 *
 * Conversational intake: the agent uses an LLM to understand the user's
 * free-text message — which .docx file they mean and what deck direction
 * they want — instead of forcing rigid input syntax like "path | request".
 */

import { existsSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import type { LLM } from "./types.js";

export interface IntakeResult {
  docxPath?: string;
  userRequest?: string;
  message?: string;
  needDocx?: boolean;
}

/** Recursively finds .docx and .md files under `roots`, most recently modified first. */
export function scanDocx(roots: string[], limit = 15): string[] {
   const found: Array<{ p: string; m: number }> = [];
   const walk = (dir: string, depth: number): void => {
     if (depth > 4) return;
     let entries;
     try {
       entries = readdirSync(dir, { withFileTypes: true });
     } catch {
       return;
     }
     for (const entry of entries) {
       const full = join(dir, entry.name);
       if (entry.isDirectory()) {
         walk(full, depth + 1);
       } else {
         const ext = extname(entry.name).toLowerCase();
         if (ext === ".docx" || ext === ".md") {
           try {
             found.push({ p: full, m: statSync(full).mtimeMs });
           } catch {
             /* ignore unreadable */
           }
         }
       }
     }
   };
   for (const root of roots) walk(resolve(root), 0);
   return found.sort((a, b) => b.m - a.m).slice(0, limit).map((f) => f.p);
}

/**
 * Asks the LLM to understand a natural-language message and extract the target
 * .docx (from an explicit path or by matching the provided file list) plus the
 * deck direction the user wants.
 */
export async function understandIntent(llm: LLM, args: { userMessage: string; availableDocs: string[] }): Promise<IntakeResult> {
  const { userMessage, availableDocs } = args;
  const fileList = availableDocs.length
    ? availableDocs.map((p, i) => `${i + 1}) ${p}`).join("\n")
    : "(không tìm thấy file nào — người dùng phải đưa đường dẫn cụ thể)";

   const prompt = `You are the intake engine of a VNF slide-deck generator. A user just sent a message. Understand it like a human would: figure out WHICH file (.docx or .md) they mean and WHAT deck they want.

USER MESSAGE:
"${userMessage}"

FILES FOUND ON DISK (.docx and .md, absolute paths, newest first):
${fileList}

Reply with JSON only (no markdown fences, no explanation):
{
   "docxPath": "<absolute path of the chosen file, or '' if unknown>",
   "userRequest": "<short deck direction (language, emphasis, audience...), or '' if none>",
   "message": "<short Vietnamese confirmation of what you understood>"
}

Rules:
- If the message names a file or says "file này / file mới nhất / báo cáo ...", pick the best match from the list (default to the newest).
- Support both .docx and .md file extensions - they are processed the same way.
- If the message contains an explicit path, return that path as-is even if not in the list.
- If you cannot determine any file, docxPath = "".
- userRequest is the deck direction only, e.g. "Deck tiếng Việt, nhấn mạnh an toàn lao động". Leave "" if the user just asked to make slides.`;

  const raw = stripCodeFences(await llm.invoke(prompt));
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  const rawPath = typeof parsed.docxPath === "string" && parsed.docxPath.trim() ? parsed.docxPath.trim() : "";
  const userRequest = typeof parsed.userRequest === "string" ? parsed.userRequest.trim() : "";
  const message = typeof parsed.message === "string" ? parsed.message.trim() : "";

  if (rawPath) {
    const resolved = resolve(process.cwd(), rawPath);
    if (existsSync(resolved)) {
      return { docxPath: resolved, userRequest: userRequest || undefined, message };
    }
  }
  return { userRequest: userRequest || undefined, message, needDocx: true };
}

/** Strips markdown code fences (```json / ```) that some LLMs add around JSON. */
function stripCodeFences(text: string): string {
  return text.replace(/```[a-zA-Z]*\n?/g, "").trim();
}
