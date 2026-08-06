/**
 * geometry/connectors.ts
 *
 * Straight-line connector geometry for DrawingML `<p:cxnSp>` elements,
 * used by Pattern 11 (Pyramid), Pattern 16 (Driver Tree), and Pattern 20
 * (Ecosystem). This is the single documented source of the "wrong
 * direction" connector bug (v2.2 changelog: connectors going the wrong
 * way because `flipH` was set incorrectly by hand).
 *
 * The rule, restated precisely instead of "remember to flip it":
 *   off  = componentwise min(A, B)
 *   ext  = componentwise |B - A|
 *   flipH = true  iff B.x < A.x   (line runs right -> left)
 *   flipV = true  iff B.y < A.y   (line runs bottom -> top)
 *
 * A connector's bounding box is always anchored at `off` with size `ext`;
 * the flip flags tell the renderer which corner of that box each endpoint
 * actually is. Computing this from two arbitrary points removes the need
 * for the LM to reason about direction at all.
 */

import { escapeXmlAttr } from "../xml.js";

export interface Point {
  x: number;
  y: number;
}

export interface ConnectorGeom {
  off: Point;
  ext: { cx: number; cy: number };
  flipH: boolean;
  flipV: boolean;
}

/**
 * Computes the `<a:xfrm>` bounding box + flip flags for a straight
 * connector running from point `a` to point `b` (both in EMU).
 */
export function connectorGeom(a: Point, b: Point): ConnectorGeom {
  return {
    off: { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) },
    ext: { cx: Math.abs(b.x - a.x), cy: Math.abs(b.y - a.y) },
    flipH: b.x < a.x,
    flipV: b.y < a.y,
  };
}

/** A shape's connection-site anchor, e.g. { shapeId: 12, idx: 2 } for "bottom-center". */
export interface ConnectionSite {
  shapeId: number;
  /** DrawingML connection-site index (0=top, 1=left, 2=bottom, 3=right on a rect by convention). */
  idx: number;
}

/** DrawingML connection-site index for a rectangle: 0=top, 1=right, 2=bottom, 3=left
 *  (per references/slide_patterns.md Pattern 11 — verified against real doc example below). */
export const CXN_IDX = {
  top: 0,
  right: 1,
  bottom: 2,
  left: 3,
} as const;

/**
 * Renders the full `<p:cxnSp>` XML for a straight connector anchored to
 * two shapes via `<a:stCxn>`/`<a:endCxn>`, so the line stays attached if
 * shapes move (per the v2.2 fix). This is the only place `flipH`/`flipV`
 * should ever be written in generated slide XML.
 */
export function renderStraightConnector(params: {
  connectorShapeId: number;
  name: string;
  from: Point & { site: ConnectionSite };
  to: Point & { site: ConnectionSite };
  colorHex: string;
  weightEmu?: number;
}): string {
  const { connectorShapeId, name, from, to, colorHex, weightEmu = 12700 } = params;
  const g = connectorGeom(from, to);
  const flipAttrs = [g.flipH ? `flipH="1"` : "", g.flipV ? `flipV="1"` : ""].filter(Boolean).join(" ");
  return `<p:cxnSp>
  <p:nvCxnSpPr>
    <p:cNvPr id="${connectorShapeId}" name="${escapeXmlAttr(name)}"/>
    <p:cNvCxnSpPr>
      <a:stCxn id="${from.site.shapeId}" idx="${from.site.idx}"/>
      <a:endCxn id="${to.site.shapeId}" idx="${to.site.idx}"/>
    </p:cNvCxnSpPr>
    <p:nvPr/>
  </p:nvCxnSpPr>
  <p:spPr>
    <a:xfrm${flipAttrs ? " " + flipAttrs : ""}>
      <a:off x="${g.off.x}" y="${g.off.y}"/>
      <a:ext cx="${g.ext.cx}" cy="${g.ext.cy}"/>
    </a:xfrm>
    <a:prstGeom prst="line"><a:avLst/></a:prstGeom>
    <a:ln w="${weightEmu}"><a:solidFill><a:srgbClr val="${colorHex}"/></a:solidFill></a:ln>
  </p:spPr>
</p:cxnSp>`;
}

/**
 * General connector renderer used by the hard-coded pattern files.
 * Unlike `renderStraightConnector` it supports:
 *  - `prst` preset geometry ("line" default, "bentConnector3" for L-shaped
 *    tree/flow elbows);
 *  - `dash` dashed line style (grid separators, TODAY lines, waterfall
 *    connectors);
 *  - optional connection sites — when a site is omitted the connector is
 *    a free line pinned to absolute endpoints instead of to shapes.
 */
export function renderConnector(params: {
  connectorShapeId: number;
  name: string;
  from: Point & { site?: ConnectionSite };
  to: Point & { site?: ConnectionSite };
  colorHex: string;
  weightEmu?: number;
  dash?: "dash" | "sysDash";
  prst?: "line" | "bentConnector3";
}): string {
  const { connectorShapeId, name, from, to, colorHex, weightEmu = 12700, dash, prst = "line" } = params;
  const g = connectorGeom(from, to);
  const flipAttrs = [g.flipH ? `flipH="1"` : "", g.flipV ? `flipV="1"` : ""].filter(Boolean).join(" ");
  const cxn = from.site && to.site
    ? `<a:stCxn id="${from.site.shapeId}" idx="${from.site.idx}"/>
      <a:endCxn id="${to.site.shapeId}" idx="${to.site.idx}"/>`
    : "";
  const dashXml = dash ? `<a:prstDash val="${dash}"/>` : "";
  return `<p:cxnSp>
  <p:nvCxnSpPr>
    <p:cNvPr id="${connectorShapeId}" name="${escapeXmlAttr(name)}"/>
    <p:cNvCxnSpPr>
      ${cxn}
    </p:cNvCxnSpPr>
    <p:nvPr/>
  </p:nvCxnSpPr>
  <p:spPr>
    <a:xfrm${flipAttrs ? " " + flipAttrs : ""}>
      <a:off x="${g.off.x}" y="${g.off.y}"/>
      <a:ext cx="${g.ext.cx}" cy="${g.ext.cy}"/>
    </a:xfrm>
    <a:prstGeom prst="${prst}"><a:avLst/></a:prstGeom>
    <a:ln w="${weightEmu}">${dashXml}<a:solidFill><a:srgbClr val="${colorHex}"/></a:solidFill></a:ln>
  </p:spPr>
</p:cxnSp>`;
}

