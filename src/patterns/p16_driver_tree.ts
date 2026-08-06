/**
 * patterns/p16_driver_tree.ts
 *
 * Renders Pattern 16 (Driver Tree / Decomposition): root node on the left
 * → 2–3 L2 branches → optional L3 children, joined by L-shaped
 * `bentConnector3` elbow connectors anchored to shape connection sites.
 *
 * Geometry from slide_patterns.md P16: root (457200, 3060000,
 * 1900000 × 720000); L2 x=2900000, y ∈ {1620000, 3060000, 4500000} (3
 * fixed slots, used in order); L3 x=5300000, 1900000×540000, positioned
 * relative to their parent (centered stack).
 *
 * Node content per slide_templates.md P16: name 10pt + value 14pt bold +
 * delta arrow ▲▼◆ with semantic color. Root navy/white, L2 blue/white,
 * L3 white/dark.
 */

import { ShapeIdAllocator } from "../ids.js";
import { CXN_IDX, renderConnector } from "../geometry/connectors.js";
import { BRAND, GLYPHS, SEMANTIC } from "../palette.js";
import { escapeXmlText } from "../xml.js";
import type { Rect } from "../templates/common.js";
import { Pattern16DriverTreeSpecSchema, type DriverNode, type Pattern16DriverTreeSpec } from "../types.js";

const ROOT_RECT: Rect = { x: 457200, y: 3060000, cx: 1900000, cy: 720000 };
const L2_X = 2900000;
const L2_YS = [1620000, 3060000, 4500000] as const;
const L2_CX = 1900000;
const L2_CY = 720000;
const L3_X = 5300000;
const L3_CX = 1900000;
const L3_CY = 540000;
const L3_STACK_GAP = 108000;

export interface RenderedDriverTree {
  bodyXml: string;
  shapeIds: number[];
}

function deltaGlyph(d: NonNullable<DriverNode["delta"]>): { glyph: string; colorHex: string } {
  if (d.direction === "up") return { glyph: GLYPHS.trendUp, colorHex: SEMANTIC.success.dark };
  if (d.direction === "down") return { glyph: GLYPHS.trendDown, colorHex: SEMANTIC.danger.dark };
  return { glyph: GLYPHS.trendFlat, colorHex: SEMANTIC.neutral.dark };
}

function nodeXml(shapeId: number, name: string, rect: Rect, node: DriverNode, level: "root" | "l2" | "l3"): string {
  const fillHex = level === "root" ? BRAND.navyDam : level === "l2" ? BRAND.xanhSang : BRAND.white;
  const textHex = level === "l3" ? BRAND.bodyText : BRAND.white;
  const lineHex = level === "l3" ? BRAND.navyDam : fillHex;
  const deltaRun = node.delta
    ? (() => {
        const dg = deltaGlyph(node.delta);
        return `<a:r><a:rPr lang="en-US" sz="1100" b="1" dirty="0"><a:solidFill><a:srgbClr val="${dg.colorHex}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t> ${escapeXmlText(dg.glyph)} ${escapeXmlText(node.delta.text)}</a:t></a:r>`;
      })()
    : "";
  return `<p:sp>
  <p:nvSpPr><p:cNvPr id="${shapeId}" name="${escapeXmlText(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${rect.x}" y="${rect.y}"/><a:ext cx="${rect.cx}" cy="${rect.cy}"/></a:xfrm>
    <a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 6000"/></a:avLst></a:prstGeom>
    <a:solidFill><a:srgbClr val="${fillHex}"/></a:solidFill>
    <a:ln w="9525"><a:solidFill><a:srgbClr val="${lineHex}"/></a:solidFill></a:ln>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" anchor="ctr" lIns="68580" tIns="22860" rIns="68580" bIns="22860"><a:normAutofit fontScale="100000" lnSpcReduction="0"/></a:bodyPr>
    <a:lstStyle/>
    <a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" sz="1000" dirty="0"><a:solidFill><a:srgbClr val="${textHex}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${escapeXmlText(node.name)}</a:t></a:r></a:p>
    <a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" sz="1400" b="1" dirty="0"><a:solidFill><a:srgbClr val="${textHex}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${escapeXmlText(node.value)}</a:t></a:r>${deltaRun}</a:p>
  </p:txBody>
</p:sp>`;
}

export function renderPattern16DriverTree(rawSpec: unknown, slideNumber: number): RenderedDriverTree {
  const spec: Pattern16DriverTreeSpec = Pattern16DriverTreeSpecSchema.parse(rawSpec);
  if (spec.branches.length > L2_YS.length) {
    throw new Error(`P16 supports at most ${L2_YS.length} L2 branches (fixed y slots), got ${spec.branches.length}`);
  }

  const ids = new ShapeIdAllocator(slideNumber);
  const allIds: number[] = [];
  const parts: string[] = [];
  const connectors: string[] = [];

  const rootId = ids.alloc();
  allIds.push(rootId);
  parts.push(nodeXml(rootId, "DriverRoot", ROOT_RECT, spec.root, "root"));

  spec.branches.forEach((branch, i) => {
    const rect: Rect = { x: L2_X, y: L2_YS[i], cx: L2_CX, cy: L2_CY };
    const l2Id = ids.alloc();
    allIds.push(l2Id);
    parts.push(nodeXml(l2Id, `DriverL2_${i + 1}`, rect, branch.node, "l2"));

    // L3 children as a centered stack next to their parent
    const stackH = branch.children.length * L3_CY + Math.max(0, branch.children.length - 1) * L3_STACK_GAP;
    const parentCenter = rect.y + rect.cy / 2;
    const stackTop = parentCenter - stackH / 2;
    const childIds: { id: number; centerY: number }[] = branch.children.map((child, k) => {
      const childRect: Rect = { x: L3_X, y: Math.round(stackTop + k * (L3_CY + L3_STACK_GAP)), cx: L3_CX, cy: L3_CY };
      const id = ids.alloc();
      allIds.push(id);
      parts.push(nodeXml(id, `DriverL3_${i + 1}_${k + 1}`, childRect, child, "l3"));
      return { id, centerY: childRect.y + childRect.cy / 2 };
    });

    // Root → L2 elbow
    const c1 = ids.alloc();
    allIds.push(c1);
    connectors.push(
      renderConnector({
        connectorShapeId: c1,
        name: `BranchRoot_${i + 1}`,
        from: { x: ROOT_RECT.x + ROOT_RECT.cx, y: ROOT_RECT.y + ROOT_RECT.cy / 2, site: { shapeId: rootId, idx: CXN_IDX.right } },
        to: { x: rect.x, y: rect.y + rect.cy / 2, site: { shapeId: l2Id, idx: CXN_IDX.left } },
        colorHex: BRAND.gray,
        weightEmu: 9525,
        prst: "bentConnector3",
      })
    );
    // L2 → each L3 elbow
    childIds.forEach(({ id }, k) => {
      const cId = ids.alloc();
      allIds.push(cId);
      connectors.push(
        renderConnector({
          connectorShapeId: cId,
          name: `BranchL2_${i + 1}_${k + 1}`,
          from: { x: rect.x + rect.cx, y: rect.y + rect.cy / 2, site: { shapeId: l2Id, idx: CXN_IDX.right } },
          to: { x: L3_X, y: Math.round(stackTop + k * (L3_CY + L3_STACK_GAP)) + L3_CY / 2, site: { shapeId: id, idx: CXN_IDX.left } },
          colorHex: BRAND.gray,
          weightEmu: 9525,
          prst: "bentConnector3",
        })
      );
    });
  });

  return { bodyXml: [...parts, ...connectors].join("\n"), shapeIds: allIds };
}

export const __internalP16 = { ROOT_RECT, L2_X, L2_YS, L2_CX, L2_CY, L3_X, L3_CX, L3_CY };

