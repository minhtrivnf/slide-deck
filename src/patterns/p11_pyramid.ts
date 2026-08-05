/**
 * patterns/p11_pyramid.ts
 *
 * Renders Pattern 11 (Pyramid Principle / Minto) — the pattern the skill
 * changelog singles out for the "wrong-direction connector" bug. All
 * geometry below is transcribed verbatim from the worked example in
 * references/slide_patterns.md ("Connector Geometry (CRITICAL — fixes
 * wrong-direction bug)") and cross-checked against connectorGeom() in a
 * regression test — see test/pattern11.test.ts.
 *
 * The LM's job for this pattern is now just: supply a governing thought
 * and 3 arguments (each with 1-3 evidence bullets) as a Pattern11PyramidSpec.
 * It never touches a coordinate, a shape id, or a flip flag.
 */

import { ShapeIdAllocator } from "../ids.js";
import { connectorGeom, renderStraightConnector, CXN_IDX, type Point } from "../geometry/connectors.js";
import { renderFilledTextBox, renderBulletListBox, type Rect } from "../templates/common.js";
import { BRAND } from "../palette.js";
import { Pattern11PyramidSpecSchema, type Pattern11PyramidSpec } from "../types.js";

// Geometry transcribed from slide_patterns.md Pattern 11 (v2.2 — top tier widened).
const TOP_BOX: Rect = { x: 1828800, y: 1224000, cx: 5486400, cy: 1080000 };
const MIDDLE_X = [457200, 3327400, 6197600] as const;
const MIDDLE_Y = 2592000;
const MIDDLE_CX = 2641600;
const MIDDLE_CY = 720000;
const BOTTOM_Y = 3456000;
const BOTTOM_CY = 1944000;
const CONNECTOR_COLOR = "888888";
const CONNECTOR_WEIGHT_EMU = 9525;

export interface RenderedPattern11 {
  /** Concatenated `<p:sp>`/`<p:cxnSp>` XML fragments, in z-order (boxes first, connectors on top). */
  bodyXml: string;
  /** All shape ids used, for uniqueness assertions in tests / Gate A. */
  shapeIds: { top: number; middle: number[]; bottom: number[]; connectors: number[] };
}

/**
 * Renders the Pyramid pattern's shapes for a single slide.
 *
 * @param rawSpec  Unvalidated spec (typically produced by the LM as JSON) —
 *                 parsed and validated against Pattern11PyramidSpecSchema here,
 *                 so a malformed spec throws before any XML is generated.
 * @param slideNumber  1-indexed slide number, used to seed the shape-id
 *                     allocator per the documented base_id formula.
 */
export function renderPattern11Pyramid(rawSpec: unknown, slideNumber: number): RenderedPattern11 {
  const spec: Pattern11PyramidSpec = Pattern11PyramidSpecSchema.parse(rawSpec);
  const ids = new ShapeIdAllocator(slideNumber);

  const topId = ids.alloc();
  const middleIds = ids.allocMany(3);
  const bottomIds = ids.allocMany(3);
  const connectorIds = ids.allocMany(3);

  const topBoxXml = renderFilledTextBox({
    shapeId: topId,
    name: "PyramidTop",
    rect: TOP_BOX,
    text: spec.governingThought,
    fontSizePt: 16,
    bold: true,
    textColorHex: BRAND.white,
    fillHex: BRAND.navyDam,
    align: "ctr",
    anchor: "ctr",
  });

  const middleBoxesXml = spec.arguments
    .map((arg, i) =>
      renderFilledTextBox({
        shapeId: middleIds[i],
        name: `PyramidArg${i + 1}`,
        rect: { x: MIDDLE_X[i], y: MIDDLE_Y, cx: MIDDLE_CX, cy: MIDDLE_CY },
        text: arg.label,
        fontSizePt: 14,
        bold: true,
        textColorHex: BRAND.white,
        fillHex: BRAND.xanhSang,
        align: "ctr",
        anchor: "ctr",
      })
    )
    .join("\n");

  const bottomBoxesXml = spec.arguments
    .map((arg, i) =>
      renderBulletListBox({
        shapeId: bottomIds[i],
        name: `PyramidEvidence${i + 1}`,
        rect: { x: MIDDLE_X[i], y: BOTTOM_Y, cx: MIDDLE_CX, cy: BOTTOM_CY },
        bullets: arg.evidence,
      })
    )
    .join("\n");

  // Anchor points, computed rather than transcribed, so they can never
  // drift from the boxes actually rendered above.
  const topBottomCenter: Point = { x: TOP_BOX.x + TOP_BOX.cx / 2, y: TOP_BOX.y + TOP_BOX.cy };
  const middleTopCenters: Point[] = MIDDLE_X.map((x) => ({ x: x + MIDDLE_CX / 2, y: MIDDLE_Y }));

  const connectorsXml = middleTopCenters
    .map((toPoint, i) =>
      renderStraightConnector({
        connectorShapeId: connectorIds[i],
        name: `PyramidConn${i + 1}`,
        from: { ...topBottomCenter, site: { shapeId: topId, idx: CXN_IDX.bottom } },
        to: { ...toPoint, site: { shapeId: middleIds[i], idx: CXN_IDX.top } },
        colorHex: CONNECTOR_COLOR,
        weightEmu: CONNECTOR_WEIGHT_EMU,
      })
    )
    .join("\n");

  return {
    bodyXml: [topBoxXml, middleBoxesXml, bottomBoxesXml, connectorsXml].join("\n"),
    shapeIds: { top: topId, middle: middleIds, bottom: bottomIds, connectors: connectorIds },
  };
}

// Re-exported for tests that want to assert the anchor math independently
// of the full render (e.g. against the worked numeric example in the doc).
export const __internal = { TOP_BOX, MIDDLE_X, MIDDLE_Y, MIDDLE_CX, connectorGeom };
