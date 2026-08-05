/**
 * renderer.ts
 *
 * Turns validated pattern specs into OOXML body fragments.
 * - P11 uses the deterministic Pyramid renderer.
 * - P7 is a full-region layer divider.
 * - Every other pattern renders real content via patterns/content_layouts.ts.
 */

import { renderPattern11Pyramid } from "../patterns/p11_pyramid.js";
import { renderContentRegion } from "../patterns/content_layouts.js";
import { renderFilledTextBox, renderBulletListBox } from "../templates/common.js";
import { ShapeIdAllocator } from "../ids.js";
import { BRAND } from "../palette.js";
import { ZONES, resolveActionTitleFit } from "../units.js";
import type { SlideSpec, RenderedSlide, SlidePattern } from "./types.js";

export function renderSlides(slideNumberBase: number, specs: SlideSpec[]): RenderedSlide[] {
  return specs.map((slideSpec, i) => {
    const slideNumber = slideNumberBase + i;
    if (slideSpec.pattern === "P11") {
      const rendered = renderPattern11Pyramid(slideSpec.spec, slideNumber);
      return {
        slideNumber,
        pattern: "P11",
        title: (slideSpec.spec as { governingThought: string }).governingThought,
        bodyXml: rendered.bodyXml,
        shapeIds: [
          rendered.shapeIds.top,
          ...rendered.shapeIds.middle,
          ...rendered.shapeIds.bottom,
          ...rendered.shapeIds.connectors,
        ],
      };
    }
    return renderContentSlide(slideNumber, slideSpec.pattern, slideSpec.spec);
  });
}

interface ContentSpec {
  title: string;
  source?: string;
  takeaway?: string;
}

function renderContentSlide(slideNumber: number, pattern: SlidePattern, rawSpec: unknown): RenderedSlide {
  const ids = new ShapeIdAllocator(slideNumber);
  const spec = rawSpec as ContentSpec;
  const pieces: string[] = [];
  const usedIds: number[] = [];

  if (pattern === "P7") {
    const divider = renderContentRegion(pattern, rawSpec, ids);
    pieces.push(divider.bodyXml);
    usedIds.push(...divider.shapeIds);
    return {
      slideNumber,
      pattern,
      title: spec.title,
      source: spec.source,
      takeaway: spec.takeaway,
      bodyXml: pieces.join("\n"),
      shapeIds: usedIds,
    };
  }

  const titleFit = resolveActionTitleFit(spec.title);
  const titleFont = titleFit.ok ? titleFit.fontSizePt : 20;
  const titleId = ids.alloc();
  usedIds.push(titleId);
  pieces.push(
    renderFilledTextBox({
      shapeId: titleId,
      name: "ActionTitle",
      rect: { x: 230400, y: 0, cx: 8683200, cy: ZONES.title.cyActionTitle },
      text: spec.title,
      fontSizePt: titleFont,
      bold: true,
      textColorHex: BRAND.navyDam,
      align: "l",
      anchor: "ctr",
    })
  );

  const content = renderContentRegion(pattern, rawSpec, ids);
  pieces.push(content.bodyXml);
  usedIds.push(...content.shapeIds);

  if (spec.source) {
    const srcId = ids.alloc();
    usedIds.push(srcId);
    pieces.push(
      renderFilledTextBox({
        shapeId: srcId,
        name: "SourceLine",
        rect: { x: 230400, y: ZONES.source.y, cx: 6048000, cy: ZONES.source.cy },
        text: `Nguồn: ${spec.source}`,
        fontSizePt: 9,
        bold: false,
        italic: true,
        textColorHex: BRAND.gray,
        align: "l",
        anchor: "b",
      })
    );
  }

  if (spec.takeaway) {
    const boxId = ids.alloc();
    const textId = ids.alloc();
    usedIds.push(boxId, textId);
    pieces.push(renderTakeawayBox(boxId, textId, spec.takeaway));
  }

  return {
    slideNumber,
    pattern,
    title: spec.title,
    source: spec.source,
    takeaway: spec.takeaway,
    bodyXml: pieces.join("\n"),
    shapeIds: usedIds,
  };
}

function renderTakeawayBox(boxId: number, textId: number, text: string): string {
  const box = renderFilledTextBox({
    shapeId: boxId,
    name: "TaglineBox",
    rect: { x: 457200, y: ZONES.tagline.y, cx: 8229600, cy: ZONES.tagline.cy },
    text: "",
    fontSizePt: 1,
    textColorHex: BRAND.navyDam,
    fillHex: BRAND.xanhDaTroi,
    roundedCornerAdj: 4500,
    align: "l",
    anchor: "ctr",
  });
  const txt = renderFilledTextBox({
    shapeId: textId,
    name: "TaglineText",
    rect: { x: 571200, y: 5904000, cx: 8001600, cy: 288000 },
    text,
    fontSizePt: 13,
    bold: true,
    textColorHex: BRAND.navyDam,
    align: "l",
    anchor: "ctr",
  });
  return `${box}\n${txt}`;
}
