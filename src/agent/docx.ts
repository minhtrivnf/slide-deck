/**
 * docx.ts
 *
 * Extract plain text/markdown from a .docx or .md file.
 * For .docx: Uses `mammoth` to extract text/markdown.
 * For .md: Reads file directly as markdown.
 */

import { basename, extname } from "node:path";
import mammoth from "mammoth";

export interface ExtractedReport {
  markdown: string;
  text: string;
  mediaFiles: string[];
}

/**
 * Reads a .docx or .md file, returns markdown + plain text.
 * Detects file type by extension.
 */
export async function extractReport(filePath: string): Promise<ExtractedReport> {
  const fs = await import("node:fs/promises");
  const ext = extname(filePath).toLowerCase();

  if (ext === ".md") {
    return extractReportFromMarkdown(filePath);
  } else if (ext === ".docx") {
    return extractReportFromDocx(filePath);
  } else {
    throw new Error(`Unsupported file format: ${ext}. Supported: .docx, .md`);
  }
}

/**
 * Reads a .md file, returns markdown as-is + plain text.
 */
async function extractReportFromMarkdown(mdPath: string): Promise<ExtractedReport> {
  const fs = await import("node:fs/promises");
  const markdown = await fs.readFile(mdPath, "utf-8");

  return {
    markdown,
    text: markdown.replace(/\n/g, " ").replace(/\s+/g, " ").trim(),
    mediaFiles: [], // MD files don't embed media like DOCX
  };
}

/**
 * Reads a .docx file, returns markdown + plain text, and lists any embedded
 * media files by inspecting the ZIP structure.
 */
async function extractReportFromDocx(docxPath: string): Promise<ExtractedReport> {
  const fs = await import("node:fs/promises");
  const buffer = await fs.readFile(docxPath);

  const [result, mediaFiles] = await Promise.all([
    mammoth.extractRawText({ buffer }),
    listMediaFiles(buffer),
  ]);

  return {
    markdown: result.value,
    text: result.value.replace(/\n/g, " ").replace(/\s+/g, " ").trim(),
    mediaFiles,
  };
}

async function listMediaFiles(buffer: Buffer): Promise<string[]> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  return Object.keys(zip.files)
    .filter((name) => name.startsWith("word/media/") && !zip.files[name].dir)
    .map((name) => basename(name));
}
