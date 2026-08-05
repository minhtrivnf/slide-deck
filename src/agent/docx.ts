/**
 * docx.ts
 *
 * Extract plain text/markdown from a .docx file and optionally list embedded
 * media assets. Uses `mammoth` (already available after npm install).
 */

import { basename } from "node:path";
import mammoth from "mammoth";

export interface ExtractedReport {
  markdown: string;
  text: string;
  mediaFiles: string[];
}

/**
 * Reads a .docx file, returns markdown + plain text, and lists any embedded
 * media files by inspecting the ZIP structure.
 */
export async function extractReport(docxPath: string): Promise<ExtractedReport> {
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
