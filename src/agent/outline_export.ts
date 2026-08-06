/**
 * outline_export.ts
 *
 * Exports the generated outline to a markdown file for user review.
 * Saves to a dedicated output directory.
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { SlideOutline } from "./types.js";

/**
 * Exports outline to markdown file in the output directory.
 * Creates output dir relative to the source document's directory.
 */
export async function exportOutlineToMarkdown(
  outline: SlideOutline[],
  deckTitle: string,
  sourceDocDir: string
): Promise<string> {
  // Save to output/ subdirectory in the same location as the source document
  const outputDir = join(sourceDocDir, "output");
  await mkdir(outputDir, { recursive: true });
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
  const filename = `outline-${timestamp}.md`;
  const filepath = join(outputDir, filename);

  // Build markdown content
  const lines: string[] = [];

  lines.push(`# ${deckTitle}`);
  lines.push("");
  lines.push(`**Generated:** ${new Date().toLocaleString()}`);
  lines.push(`**Total slides:** ${outline.length}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Add each slide
  for (const slide of outline) {
    lines.push(`## Slide ${slide.slideNumber} — [${slide.pattern}] ${slide.title}`);
    lines.push("");

    if (slide.source) {
      lines.push(`**Source:** ${slide.source}`);
      lines.push("");
    }

    if (slide.takeaway) {
      lines.push(`**Takeaway:** ${slide.takeaway}`);
      lines.push("");
    }

    if (slide.contentNotes) {
      lines.push(`**Content notes:**`);
      lines.push(slide.contentNotes);
      lines.push("");
    }

    lines.push("---");
    lines.push("");
  }

  const content = lines.join("\n");
  await writeFile(filepath, content, "utf-8");
  return filepath;
}
