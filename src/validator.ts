/**
 * validator.ts
 *
 * 1:1 TypeScript port of scripts/validate_pptx_unpacked.py (Gate A).
 * Ported (not just wrapped) so it can run in-process inside the same
 * agent-loop tool that renders and assembles slides, giving the LM
 * immediate feedback without a separate python subprocess round-trip.
 *
 * Checks, unchanged from the original:
 *   1. No duplicate <p:cNvPr id="N"> shape IDs within any single slide
 *   2. Every slideN.xml has a matching _rels/slideN.xml.rels
 *   3. No duplicate <Relationship Id="rIdN"> in presentation.xml.rels
 *   4. No duplicate <p:sldId> in presentation.xml, and all sldId >= 256,
 *      and every sldId's r:id resolves in presentation.xml.rels
 *   5. Every *.rels file: relationship targets exist on disk, and no
 *      duplicate rIds within that file
 *   6. [Content_Types].xml exists and is well-formed
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, basename, relative, normalize } from "node:path";
import { DOMParser, type Document, type Element } from "@xmldom/xmldom";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  slideCount: number;
}

function localName(tagName: string): string {
  // Mirrors Python's `el.tag.rpartition('}')[2]` for namespaced tags like
  // "{http://.../main}cNvPr" -> "cNvPr". xmldom keeps tagName as e.g.
  // "p:cNvPr" or "cNvPr" depending on how it's serialized, so handle both.
  const colonIdx = tagName.lastIndexOf(":");
  return colonIdx === -1 ? tagName : tagName.slice(colonIdx + 1);
}

function findDuplicates<T>(items: T[]): T[] {
  const counts = new Map<T, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1).map(([item]) => item);
}

function parseXmlFile(path: string): Document {
  const xml = readFileSync(path, "utf-8");
  const doc = new DOMParser({
    onError: (level, msg) => {
      if (level !== "warning") throw new Error(msg);
    },
  }).parseFromString(xml, "application/xml");
  return doc;
}

/** Direct child elements of a document's root element (e.g. each `<Relationship>` in a .rels file). */
function rootChildElements(doc: Document): Element[] {
  const root = doc.documentElement;
  if (!root) return [];
  const out: Element[] = [];
  for (let i = 0; i < root.childNodes.length; i++) {
    const child = root.childNodes.item(i);
    if (child && child.nodeType === 1) out.push(child as unknown as Element);
  }
  return out;
}

/** Walks every descendant element of a document (document order). */
function* walkElements(doc: Document): Generator<Element> {
  const stack: Element[] = [doc.documentElement as unknown as Element];
  while (stack.length) {
    const el = stack.shift()!;
    yield el;
    const children = el.childNodes;
    for (let i = 0; i < children.length; i++) {
      const child = children.item(i);
      if (child && child.nodeType === 1 /* ELEMENT_NODE */) {
        stack.splice(i, 0, child as unknown as Element);
      }
    }
  }
}

export function validateUnpacked(unpackedDir: string): ValidationResult {
  const errors: string[] = [];

  // ---- 1. Per-slide shape ID uniqueness ----
  const slidesDir = join(unpackedDir, "ppt", "slides");
  let slideFiles: string[] = [];
  if (existsSync(slidesDir) && statSync(slidesDir).isDirectory()) {
    slideFiles = readdirSync(slidesDir)
      .filter((f) => f.endsWith(".xml"))
      .sort();

    for (const fn of slideFiles) {
      const path = join(slidesDir, fn);
      let doc: Document;
      try {
        doc = parseXmlFile(path);
      } catch (e) {
        errors.push(`${fn}: malformed XML — ${(e as Error).message}`);
        continue;
      }
      const ids: string[] = [];
      for (const el of walkElements(doc)) {
        if (localName(el.tagName) === "cNvPr") {
          const id = el.getAttribute("id");
          if (id !== null && id !== "") ids.push(id);
        }
      }
      const dups = findDuplicates(ids);
      if (dups.length) errors.push(`${fn}: duplicate cNvPr ids ${JSON.stringify(dups)}`);
    }
  }

  // ---- 2. Every slideN.xml has a matching _rels/slideN.xml.rels ----
  const slideRelsDir = join(slidesDir, "_rels");
  if (slideFiles.length) {
    if (!existsSync(slideRelsDir)) {
      errors.push("missing directory: ppt/slides/_rels (slides have no relationship files)");
    } else {
      for (const fn of slideFiles) {
        const relsFn = `${fn}.rels`;
        if (!existsSync(join(slideRelsDir, relsFn))) {
          errors.push(`missing rels file: ppt/slides/_rels/${relsFn}`);
        }
      }
    }
  }

  // ---- 3. presentation.xml.rels — duplicate rIds ----
  const presRelsPath = join(unpackedDir, "ppt", "_rels", "presentation.xml.rels");
  let knownRids = new Set<string>();
  if (existsSync(presRelsPath)) {
    try {
      const doc = parseXmlFile(presRelsPath);
      const relEls = rootChildElements(doc);
      const rids = relEls.map((r) => r.getAttribute("Id")).filter((id): id is string => !!id);
      knownRids = new Set(rids);
      const dups = findDuplicates(rids);
      if (dups.length) errors.push(`presentation.xml.rels: duplicate rIds ${JSON.stringify(dups)}`);
    } catch (e) {
      errors.push(`presentation.xml.rels: malformed XML — ${(e as Error).message}`);
    }
  }

  // ---- 4. presentation.xml — duplicate sldIds, sldId >= 256, rId resolves ----
  const presPath = join(unpackedDir, "ppt", "presentation.xml");
  if (existsSync(presPath)) {
    try {
      const doc = parseXmlFile(presPath);
      const sldIdEls = [...walkElements(doc)].filter((el) => localName(el.tagName) === "sldId");
      const sldIds = sldIdEls.map((el) => el.getAttribute("id")).filter((id): id is string => !!id);
      const dups = findDuplicates(sldIds);
      if (dups.length) errors.push(`presentation.xml: duplicate sldId ${JSON.stringify(dups)}`);

      for (const sid of sldIds) {
        const n = Number(sid);
        if (!Number.isFinite(n) || !Number.isInteger(n)) {
          errors.push(`presentation.xml: non-integer sldId=${JSON.stringify(sid)}`);
        } else if (n < 256) {
          errors.push(`presentation.xml: sldId=${sid} is < 256 (PowerPoint reserves IDs below 256)`);
        }
      }

      if (existsSync(presRelsPath)) {
        for (const el of sldIdEls) {
          // r:id attribute — namespace-qualified. xmldom exposes it via
          // getAttributeNS or as a plain "r:id" attribute name depending
          // on parser mode; check both for robustness.
          const rid =
            el.getAttributeNS?.("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") ||
            el.getAttribute("r:id");
          if (rid && !knownRids.has(rid)) {
            errors.push(`presentation.xml: sldId references rId=${rid} but it's not in presentation.xml.rels`);
          }
        }
      }
    } catch (e) {
      errors.push(`presentation.xml: malformed XML — ${(e as Error).message}`);
    }
  }

  // ---- 5. All *.rels files: targets exist on disk + no duplicate rIds ----
  for (const relsPath of walkFiles(unpackedDir)) {
    if (!relsPath.endsWith(".rels")) continue;
    let relEls: Element[];
    try {
      const doc = parseXmlFile(relsPath);
      relEls = rootChildElements(doc);
    } catch (e) {
      errors.push(`${relative(unpackedDir, relsPath)}: malformed XML — ${(e as Error).message}`);
      continue;
    }

    // Rels file at .../foo/_rels/bar.xml.rels describes part .../foo/bar.xml,
    // so targets are resolved relative to .../foo/ — match the original's
    // exact-directory-name check to avoid substring false positives.
    const partDir =
      basename(dirname(relsPath)) === "_rels" ? dirname(dirname(relsPath)) : dirname(relsPath);

    for (const r of relEls) {
      const tgt = r.getAttribute("Target");
      const mode = r.getAttribute("TargetMode");
      if (!tgt || mode === "External" || /^(https?:\/\/|#)/.test(tgt)) continue;
      const resolved = normalize(join(partDir, tgt));
      if (!existsSync(resolved)) {
        errors.push(`${relative(unpackedDir, relsPath)}: target does not exist — ${tgt}`);
      }
    }

    const rids = relEls.map((r) => r.getAttribute("Id")).filter((id): id is string => !!id);
    const dups = findDuplicates(rids);
    if (dups.length) {
      errors.push(`${relative(unpackedDir, relsPath)}: duplicate rIds ${JSON.stringify(dups)}`);
    }
  }

  // ---- 6. [Content_Types].xml present and parseable ----
  const ctPath = join(unpackedDir, "[Content_Types].xml");
  if (!existsSync(ctPath)) {
    errors.push("[Content_Types].xml is missing");
  } else {
    try {
      parseXmlFile(ctPath);
    } catch (e) {
      errors.push(`[Content_Types].xml: malformed XML — ${(e as Error).message}`);
    }
  }

  return { ok: errors.length === 0, errors, slideCount: slideFiles.length };
}

/** Recursively yields every file path under `dir`. */
function* walkFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkFiles(full);
    } else {
      yield full;
    }
  }
}

/** CLI entry point, mirrors `python validate_pptx_unpacked.py <dir>`. */
export function validateUnpackedCli(unpackedDir: string): number {
  const result = validateUnpacked(unpackedDir);
  if (!result.ok) {
    console.log(`VALIDATION FAILED (${result.errors.length} issue${result.errors.length !== 1 ? "s" : ""}):`);
    for (const e of result.errors) console.log(`  - ${e}`);
    return 1;
  }
  console.log(`OK: ${result.slideCount} slide(s) validated, no integrity issues.`);
  return 0;
}
