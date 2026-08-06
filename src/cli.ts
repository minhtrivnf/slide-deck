#!/usr/bin/env node
/**
 * cli.ts
 *
 * Interactive CLI for the VNF slide-deck generator agent.
 *
 * Usage:
 *   npm run dev                          # chat: agent understands your message
 *   npm run dev -- <path.docx>           # direct path, builds immediately
 *
 * Interactive mode (TTY) is a real conversation: the agent (LLM) reads your
 * natural message, figures out which .docx you mean and what deck you want.
 * After the deck is built you can keep chatting to revise it (Enter = done).
 *
 * Scripted mode (stdin piped, one value per line) reads:
 *   line 1: .docx path
 *   line 2: request (optional)
 *
 * Loads LLM credentials from .env (AI_API_URL / AI_API_KEY / MODEL),
 * runs the pipeline (read docx → summarize → outline → specs → render → pack),
 * and writes the resulting .pptx next to the source document.
 */

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDeck, reviseDeck } from "./agent/graph.js";
import { createHttpLLM } from "./agent/llm.js";
import { scanDocx, understandIntent } from "./agent/intake.js";
import type { AgentState, LLM } from "./agent/types.js";

const PROJECT_ROOT = fileURLToPath(new URL("../..", import.meta.url));

interface EnvConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
}

function findEnvFile(): string {
  const candidates = [
    join(PROJECT_ROOT, ".env"),
    join(process.cwd(), ".env"),
    join(dirname(process.argv[1]), "..", "..", ".env"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(
    "Cannot find .env. Create one at the project root with AI_API_URL, AI_API_KEY, MODEL."
  );
}

function loadEnv(): EnvConfig {
  const envFile = findEnvFile();
  const content = readFileSync(envFile, "utf-8");
  const vars: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  const missing = ["AI_API_URL", "AI_API_KEY", "MODEL"].filter((k) => !vars[k]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars in ${envFile}: ${missing.join(", ")}`);
  }
  return { apiUrl: vars.AI_API_URL, apiKey: vars.AI_API_KEY, model: vars.MODEL };
}

/** Strips UTF-8 BOM and surrounding whitespace. */
function clean(s: string): string {
  return s.replace(/^\uFEFF/, "").trim();
}

function validateDocxPath(raw: string): { ok: true; path: string } | { ok: false; reason: string } {
  const abs = resolve(process.cwd(), clean(raw));
  if (!existsSync(abs)) return { ok: false, reason: `File không tồn tại: ${abs}` };
  const ext = extname(abs).toLowerCase();
  if (ext !== ".docx" && ext !== ".md") return { ok: false, reason: "File phải có đuôi .docx hoặc .md" };
  return { ok: true, path: abs };
}

/**
 * Conversational intake: the agent (LLM) understands the user's natural
 * message — which file (.docx or .md) and what direction — no rigid syntax required.
 */
async function chatIntake(llm: LLM): Promise<{ docxPath: string; request: string }> {
  const rl = createInterface({ input, output });
  console.log("=== VNF Slide Deck Generator ===");
  console.log("Nhắn tin tự nhiên, tôi sẽ hiểu bạn muốn dùng file nào và tạo deck gì.\n");
  console.log("  VD:  làm slide từ báo cáo ở D:\\VNF\\report.docx");
  console.log("  VD:  tạo deck từ file outline.md");
  console.log("  VD:  tạo deck tiếng Việt nhấn mạnh an toàn, dùng file mới nhất\n");

  for (;;) {
    const message = clean(await rl.question("  Bạn: "));
    if (!message) continue;

    const availableDocs = scanDocx([process.cwd()]);
    const intake = await understandIntent(llm, { userMessage: message, availableDocs });
    if (intake.message) console.log(`  [AGENT] ${intake.message}`);

    if (intake.docxPath) {
      rl.close();
      return { docxPath: intake.docxPath, request: intake.userRequest ?? "" };
    }
    console.log("  [AGENT] Tôi chưa xác định được file. Bạn đưa đường dẫn cụ thể (.docx hoặc .md), hoặc đặt file trong thư mục hiện tại rồi nhắn lại.\n");
  }
}

async function scriptedMode(): Promise<{ docxPath: string; request: string }> {
  const content = readFileSync(0, "utf8");
  const lines = content.split(/\r?\n/).map((l) => clean(l)).filter((l) => l.length > 0);

  const check = validateDocxPath(lines[0] ?? "");
  if (!check.ok) {
    console.error(`  ✗ ${check.reason}`);
    process.exit(1);
  }
  const request = lines[1] ?? "";
  return { docxPath: check.path, request };
}

async function main(): Promise<void> {
  let env: EnvConfig;
  try {
    env = loadEnv();
  } catch (err) {
    console.error(`  ✗ ${(err as Error).message}`);
    process.exit(1);
  }

  const isTTY = Boolean(input.isTTY);
  const llm = createHttpLLM(env);
  const argvPath = process.argv[2];

  let docxPath: string;
  let request: string;
  if (isTTY && argvPath) {
    const check = validateDocxPath(argvPath);
    if (!check.ok) {
      console.error(`  ✗ ${check.reason}`);
      process.exit(1);
    }
    docxPath = check.path;
    request = "";
  } else {
    const fromInput = isTTY ? await chatIntake(llm) : await scriptedMode();
    docxPath = fromInput.docxPath;
    request = fromInput.request;
  }

   const base = basename(docxPath, ".docx");
   const deckTitle = request ? request.slice(0, 120) : base;
   const runId = stamp();
   const workDir = join(dirname(docxPath), `.vnf-deck-${base}-${runId}`);
   
   // Output PPTX to docs/pptx folder in project root
   const projectRoot = dirname(dirname(docxPath)); // Go up to find project root or use docs folder
   const docsDir = join(projectRoot, "docs", "pptx");
   const outputPptxPath = uniqueOutputPath(docsDir, base, "slides");

  console.log(`  [AGENT] Đang tạo deck từ: ${docxPath}`);
  if (request) console.log(`  [AGENT] Yêu cầu: ${request}`);
  console.log(`  [AGENT] LLM: ${env.model}`);
  console.log(`  [AGENT] Đang đọc → tóm tắt → outline → dựng slide...`);
  console.log(`  [AGENT] Deck sẽ lưu tại: ${outputPptxPath}\n`);

  let current = await buildDeck({
    docxPath,
    workDir,
    deckTitle,
    outputPptxPath,
    userRequest: request,
    llm,
  });

  if (current.error) {
    console.error("\n✗ Không tạo được deck:");
    console.error(`  ${current.error}`);
    process.exit(1);
  }

  printResult(current);

  if (isTTY) {
    const rl = createInterface({ input, output });
    for (;;) {
      const feedback = clean(await rl.question(
        "\n  [AGENT] Bạn muốn bổ sung / sửa gì không? (VD: 'bổ sung nội dung an toàn lao động cho slide 3')\n  [AGENT] Gõ Enter trống để kết thúc.\n  Bạn: "
      ));
      if (!feedback) break;
      console.log("\n  [AGENT] Đang cập nhật slide theo yêu cầu...\n");
      const nextOut = uniqueOutputPath(dirname(docxPath), base, "slides");
      current = await reviseDeck(current, feedback, nextOut);
      if (current.error) {
        console.error(`  ✗ ${current.error}`);
        continue;
      }
      printResult(current);
    }
    rl.close();
    console.log("\n  [AGENT] Cảm ơn bạn! Deck đã sẵn sàng. Hẹn gặp lại!");
  }
}

/** Compact timestamp, e.g. 20260805-143012. */
function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** Returns a not-yet-existing `<base>-<label>-<stamp>.pptx` path in `dir`. */
function uniqueOutputPath(dir: string, base: string, label: string): string {
  const candidate = join(dir, `${base}-${label}-${stamp()}.pptx`);
  if (!existsSync(candidate)) return candidate;
  let i = 2;
  for (;;) {
    const next = join(dir, `${base}-${label}-${stamp()}-${i}.pptx`);
    if (!existsSync(next)) return next;
    i++;
  }
}

function printResult(result: AgentState): void {
  const contentCount = result.renderedSlides?.length ?? 0;
  console.log(`  [AGENT] Xong! Đã tạo ${contentCount} slide nội dung (tổng ${contentCount + 1} slide).`);
  console.log(`  [AGENT] File: ${result.outputPptxPath}`);
  console.log(`  [AGENT] Gate A validation: ${result.validationOk ? "OK" : "FAIL"}`);
  if (result.validationMessages?.length) {
    for (const m of result.validationMessages) console.log(`    - ${m}`);
  }
  if (result.outline?.length) {
    console.log("\n  [AGENT] Outline các slide:");
    for (const s of result.outline) {
      console.log(`    ${s.slideNumber}. [${s.pattern}] ${s.title}`);
    }
  } else {
    console.log("\n  ⚠ Không có slide nội dung nào được tạo. LLM có thể trả outline rỗng hoặc không hợp lệ.");
  }
}

main().catch((err) => {
  console.error(`\n✗ Lỗi không mong muốn: ${(err as Error).message}`);
  process.exit(1);
});
