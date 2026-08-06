/**
 * patterns/p7_layer_divider.ts
 *
 * Renders Pattern 7 (Layer Divider) — full-slide navy background with a
 * centered "LAYER N" / layer name pair. Geometry from
 * slide_templates.md "Layer Divider (Pattern 7)"; the background rect
 * reuses SLIDE.widthEmu/heightEmu from units.ts (the same 9144000 x
 * 6858000 the template hardcodes), so the two can never drift apart.
 */


import { ShapeIdAllocator } from "../ids.js";
import { BRAND } from "../palette.js";
import { fitLabel, pxForEmu, SLIDE } from "../units.js";
import { escapeXmlText } from "../xml.js";
import { renderRect } from "../templates/common.js";
import { Pattern7LayerDividerSpecSchema, type Pattern7LayerDividerSpec } from "../types.js";

const TITLE_RECT = { x: 457200, y: 2743200, cx: 8229600, cy: 1371600 };

export interface RenderedLayerDivider {
  bodyXml: string;
  shapeIds: { background: number; title: number };
}

export function renderPattern7LayerDivider(rawSpec: unknown, slideNumber: number): RenderedLayerDivider {
  const spec: Pattern7LayerDividerSpec = Pattern7LayerDividerSpecSchema.parse(rawSpec);
  const ids = new ShapeIdAllocator(slideNumber);

  const bgId = ids.alloc();
  const titleId = ids.alloc();
  const titleFit = fitLabel(spec.layerName, pxForEmu(TITLE_RECT.cx), [28, 24, 20]);

  const backgroundXml = renderRect({
    shapeId: bgId,
    name: "Background",
    rect: { x: 0, y: 0, cx: SLIDE.widthEmu, cy: SLIDE.heightEmu },
    fillHex: BRAND.navyDam,
  });

  const titleXml = `<p:sp>
  <p:nvSpPr>
    <p:cNvPr id="${titleId}" name="LayerTitle"/>
    <p:cNvSpPr txBox="1"/>
    <p:nvPr/>
  </p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${TITLE_RECT.x}" y="${TITLE_RECT.y}"/><a:ext cx="${TITLE_RECT.cx}" cy="${TITLE_RECT.cy}"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
    <a:noFill/>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" anchor="ctr"/>
    <a:lstStyle/>
    <a:p>
      <a:pPr algn="ctr"/>
      <a:r><a:rPr lang="en-US" sz="4000" b="1" dirty="0"><a:solidFill><a:srgbClr val="${BRAND.white}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${escapeXmlText(`LAYER ${spec.layerNumber}`)}</a:t></a:r>
    </a:p>
    <a:p>
      <a:pPr algn="ctr"><a:spcBef><a:spcPts val="400"/></a:spcBef></a:pPr>
      <a:r><a:rPr lang="en-US" sz="${titleFit.fontSizePt * 100}" b="1" dirty="0"><a:solidFill><a:srgbClr val="${BRAND.white}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${escapeXmlText(titleFit.text)}</a:t></a:r>
    </a:p>
  </p:txBody>
</p:sp>`;

  return { bodyXml: [backgroundXml, titleXml].join("\n"), shapeIds: { background: bgId, title: titleId } };
}

export const __internalP7 = { TITLE_RECT };
