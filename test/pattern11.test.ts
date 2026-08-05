import { test } from "node:test";
import assert from "node:assert/strict";
import { connectorGeom } from "../src/geometry/connectors.js";
import { renderPattern11Pyramid, __internal } from "../src/patterns/p11_pyramid.js";
import { Pattern11PyramidSpecSchema } from "../src/types.js";

// The exact numeric worked example from references/slide_patterns.md,
// "Connector Geometry (CRITICAL — fixes wrong-direction bug)". If this
// test ever fails, either the transcribed geometry drifted or
// connectorGeom() regressed — both are exactly what it exists to catch.
test("connector 1 (top -> lower-left) matches the documented worked example exactly", () => {
  const top = { x: 4572000, y: 2304000 };
  const lowerLeft = { x: 1778000, y: 2592000 };
  const g = connectorGeom(top, lowerLeft);
  assert.deepEqual(g.off, { x: 1778000, y: 2304000 });
  assert.deepEqual(g.ext, { cx: 2794000, cy: 288000 });
  assert.equal(g.flipH, true, "diagonal down-left from a centered top box must set flipH");
  assert.equal(g.flipV, false);
});

test("connector 2 (top -> lower-middle) matches the documented worked example exactly", () => {
  const top = { x: 4572000, y: 2304000 };
  const lowerMid = { x: 4648200, y: 2592000 };
  const g = connectorGeom(top, lowerMid);
  assert.deepEqual(g.off, { x: 4572000, y: 2304000 });
  assert.deepEqual(g.ext, { cx: 76200, cy: 288000 });
  assert.equal(g.flipH, false);
});

test("connector 3 (top -> lower-right) matches the documented worked example exactly", () => {
  const top = { x: 4572000, y: 2304000 };
  const lowerRight = { x: 7518400, y: 2592000 };
  const g = connectorGeom(top, lowerRight);
  assert.deepEqual(g.off, { x: 4572000, y: 2304000 });
  assert.deepEqual(g.ext, { cx: 2946400, cy: 288000 });
  assert.equal(g.flipH, false);
});

test("renderer's own anchor-point math reproduces the same 3 points the doc hand-computed", () => {
  const topBottomCenter = { x: __internal.TOP_BOX.x + __internal.TOP_BOX.cx / 2, y: __internal.TOP_BOX.y + __internal.TOP_BOX.cy };
  assert.deepEqual(topBottomCenter, { x: 4572000, y: 2304000 });

  const middleTopCenters = __internal.MIDDLE_X.map((x) => ({ x: x + __internal.MIDDLE_CX / 2, y: __internal.MIDDLE_Y }));
  assert.deepEqual(middleTopCenters, [
    { x: 1778000, y: 2592000 },
    { x: 4648200, y: 2592000 },
    { x: 7518400, y: 2592000 },
  ]);
});

const VALID_SPEC = {
  pattern: "P11" as const,
  governingThought: "Vietnam's <40% survival rate is the single most binding economic constraint",
  arguments: [
    { label: "Market pull", evidence: ["Demand up 3x since 2020", "APAC leads growth"] },
    { label: "Capital access", evidence: ["VC funding doubled", "New credit guarantee scheme"] },
    { label: "Talent supply", evidence: ["STEM grads up 12%", "Return-migration rising"] },
  ],
};

test("Pattern11PyramidSpecSchema accepts a well-formed spec and rejects a malformed one", () => {
  assert.doesNotThrow(() => Pattern11PyramidSpecSchema.parse(VALID_SPEC));
  assert.throws(() => Pattern11PyramidSpecSchema.parse({ ...VALID_SPEC, arguments: VALID_SPEC.arguments.slice(0, 2) }));
  assert.throws(() => Pattern11PyramidSpecSchema.parse({ ...VALID_SPEC, governingThought: "" }));
});

test("renderPattern11Pyramid produces exactly 10 shapes with unique, slide-scoped ids", () => {
  const result = renderPattern11Pyramid(VALID_SPEC, 5); // slide 5 -> base id 401
  const allIds = [result.shapeIds.top, ...result.shapeIds.middle, ...result.shapeIds.bottom, ...result.shapeIds.connectors];
  assert.equal(allIds.length, 10); // 1 top + 3 middle + 3 bottom + 3 connectors
  assert.equal(new Set(allIds).size, 10, "all shape ids must be unique");
  assert.equal(Math.min(...allIds), 401); // (5-1)*100+1
  assert.match(result.bodyXml, /PyramidTop/);
  assert.match(result.bodyXml, /flipH="1"/); // connector 1 must flip
});

test("renderPattern11Pyramid rejects a malformed spec before generating any XML", () => {
  assert.throws(() => renderPattern11Pyramid({ pattern: "P11", governingThought: "x", arguments: [] }, 1));
});
