/**
 * assembler.ts
 *
 * Unpacks the VNF template, injects rendered slide XML, updates rels,
 * presentation.xml and [Content_Types].xml, then repacks into a .pptx.
 * All ID allocation is deterministic so Gate A cannot fail on duplicates.
 */

import { existsSync } from "node:fs";
import { promises as fs, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { RidAllocator, SldIdAllocator } from "../ids.js";
import { escapeXmlText } from "../xml.js";
import { validateUnpacked } from "../validator.js";

const DRAWING_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PRES_NS = "http://schemas.openxmlformats.org/presentationml/2006/main";
const RELS_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const SLIDE_LAYOUT_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout";
const SLIDE_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide";

export class DeckAssembler {
  private readonly templatePath: string;
  private readonly workDir: string;
  private initialized = false;
  private nextSlideNumber = 2;

  constructor(templatePath: string, workDir: string) {
    this.templatePath = templatePath;
    this.workDir = workDir;
  }

  async init(): Promise<void> {
    if (!existsSync(this.workDir)) await fs.mkdir(this.workDir, { recursive: true });
    const zip = await JSZip.loadAsync(await fs.readFile(this.templatePath));
    for (const [name, entry] of Object.entries(zip.files)) {
      const isDir = entry.dir || name.endsWith("/");
      const outPath = join(this.workDir, name.replace(/\//g, "\\"));
      if (isDir) {
        await fs.mkdir(outPath, { recursive: true });
      } else {
        await fs.mkdir(dirname(outPath), { recursive: true });
        const content = await entry.async("nodebuffer");
        await fs.writeFile(outPath, content);
      }
    }
    this.initialized = true;
  }

  /** Replace the cover title text in slide1.xml. */
  async setCoverTitle(title: string): Promise<void> {
    this.assertInit();
    const slide1Path = join(this.workDir, "ppt", "slides", "slide1.xml");
    let xml = await fs.readFile(slide1Path, "utf-8");
    const safeTitle = escapeXmlText(title);
    // The bundled VNF cover uses literal "[Slide Title]"
    xml = xml.replace(/<a:t>\[Slide Title\]<\/a:t>/, `<a:t>${safeTitle}</a:t>`);
    await fs.writeFile(slide1Path, xml, "utf-8");
  }

  /**
   * Adds a new content slide after the cover.
   * @param slideNumber 1-indexed number. Must be >= 3 (1=cover, 2=unused layout placeholder).
   * @param bodyXml Rendered shape XML (no surrounding <p:spTree> wrapper).
   */
  async addSlide(slideNumber: number, bodyXml: string): Promise<void> {
    this.assertInit();
    if (slideNumber < this.nextSlideNumber) {
      throw new Error(`Slide numbers must increase. Got ${slideNumber}, expected >= ${this.nextSlideNumber}`);
    }
    this.nextSlideNumber = slideNumber + 1;

    const sldFile = `slide${slideNumber}.xml`;
    const slideDir = join(this.workDir, "ppt", "slides");
    const relsDir = join(slideDir, "_rels");

    await fs.mkdir(relsDir, { recursive: true });
    await fs.writeFile(join(slideDir, sldFile), buildSlideXml(bodyXml), "utf-8");
    await fs.writeFile(
      join(relsDir, `${sldFile}.rels`),
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${RELS_NS}">
  <Relationship Id="rId1" Type="${SLIDE_LAYOUT_TYPE}" Target="../slideLayouts/slideLayout2.xml"/>
</Relationships>`,
      "utf-8"
    );

    await this.registerSlideInPresentation(slideNumber);
    await this.addContentType(sldFile);
  }

  /** Validates the unpacked deck (Gate A) and repacks it. */
  async pack(outputPath: string): Promise<void> {
    this.assertInit();
    const result = validateUnpacked(this.workDir);
    if (!result.ok) {
      throw new Error(
        `Gate A validation failed:\n${result.errors.map((e) => `  - ${e}`).join("\n")}`
      );
    }
    const zip = await buildZipFromDir(this.workDir);
    const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    await fs.writeFile(outputPath, buf);
  }

  getValidationResult() {
    this.assertInit();
    return validateUnpacked(this.workDir);
  }

  private assertInit() {
    if (!this.initialized) throw new Error("DeckAssembler: call init() first");
  }

  private async registerSlideInPresentation(slideNumber: number): Promise<void> {
    const presPath = join(this.workDir, "ppt", "presentation.xml");
    const presRelsPath = join(this.workDir, "ppt", "_rels", "presentation.xml.rels");

    const presDoc: any = parseXml(presPath);
    const sldIdList = findFirstChild(presDoc.documentElement, "sldIdLst", PRES_NS);
    if (!sldIdList) throw new Error("presentation.xml: missing <p:sldIdLst>");

    const existingSldIds = [...childElements(sldIdList)].map((el: any) => Number(el.getAttribute("id")));
    const sldAllocator = new SldIdAllocator();
    sldAllocator.reserve(existingSldIds);
    const sldId = sldAllocator.alloc();

    const relsDoc: any = parseXml(presRelsPath);
    const relRoot = relsDoc.documentElement!;
    const existingRids = [...childElements(relRoot)]
      .map((el: any) => el.getAttribute("Id"))
      .filter((id): id is string => !!id);
    const ridAllocator = new RidAllocator();
    ridAllocator.reserve(existingRids);
    const rid = ridAllocator.alloc();

    const slideFile = `slides/slide${slideNumber}.xml`;
    const relEl = relsDoc.createElement("Relationship");
    relEl.setAttribute("Id", rid);
    relEl.setAttribute("Type", SLIDE_TYPE);
    relEl.setAttribute("Target", slideFile);
    relRoot.appendChild(relEl);
    await fs.writeFile(presRelsPath, serializeXml(relsDoc), "utf-8");

    const sldIdEl = presDoc.createElementNS(PRES_NS, "p:sldId");
    sldIdEl.setAttribute("id", String(sldId));
    sldIdEl.setAttributeNS(REL_NS, "r:id", rid);
    sldIdList.appendChild(sldIdEl);
    await fs.writeFile(presPath, serializeXml(presDoc), "utf-8");
  }

  private async addContentType(sldFile: string): Promise<void> {
    const ctPath = join(this.workDir, "[Content_Types].xml");
    const ctDoc: any = parseXml(ctPath);
    const root = ctDoc.documentElement!;
    const partName = `/ppt/slides/${sldFile}`;

    for (const child of childElements(root)) {
      const ln = localName(child.tagName);
      if (ln === "Override" && child.getAttribute("PartName") === partName) return;
    }

    const override = ctDoc.createElement("Override");
    override.setAttribute("PartName", partName);
    override.setAttribute("ContentType", "application/vnd.openxmlformats-officedocument.presentationml.slide+xml");
    root.appendChild(override);
    await fs.writeFile(ctPath, serializeXml(ctDoc), "utf-8");
  }
}

function buildSlideXml(bodyXml: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="${DRAWING_NS}" xmlns:r="${REL_NS}" xmlns:p="${PRES_NS}" showMasterSp="1" showMasterPhAnim="1">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm>
      </p:grpSpPr>
${bodyXml}
    </p:spTree>
  </p:cSld>
</p:sld>`;
}

async function buildZipFromDir(dir: string): Promise<JSZip> {
  const zip = new JSZip();
  await addDir(zip, dir, dir);
  return zip;
}

async function addDir(zip: JSZip, current: string, root: string): Promise<void> {
  const entries = await fs.readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(current, entry.name);
    const zipPath = relative(root, fullPath).replace(/\\/g, "/");
    if (entry.isDirectory()) {
      await addDir(zip, fullPath, root);
    } else {
      zip.file(zipPath, await fs.readFile(fullPath));
    }
  }
}

function serializeXml(doc: any): string {
  const xml = new XMLSerializer().serializeToString(doc);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${xml}`;
}

function stripXmlDeclaration(text: string): string {
  return text.replace(/^<\?xml[\s\S]*?\?>/, "").trimStart();
}

function parseXml(path: string): any {
  const text = stripXmlDeclaration(readFileSync(path, "utf-8"));
  return new DOMParser({
    onError: (level: string, msg: string) => {
      if (level !== "warning") throw new Error(msg);
    },
  }).parseFromString(text, "application/xml");
}

function findFirstChild(el: any, local: string, ns?: string): any | null {
  for (let i = 0; i < el.childNodes.length; i++) {
    const child = el.childNodes.item(i);
    if (child && child.nodeType === 1 && localName((child as any).tagName) === local) {
      if (!ns || child.namespaceURI === ns) return child;
    }
  }
  return null;
}

function childElements(el: any): any[] {
  const out: any[] = [];
  for (let i = 0; i < el.childNodes.length; i++) {
    const child = el.childNodes.item(i);
    if (child && child.nodeType === 1) out.push(child);
  }
  return out;
}

function localName(tagName: string): string {
  const idx = tagName.lastIndexOf(":");
  return idx === -1 ? tagName : tagName.slice(idx + 1);
}
