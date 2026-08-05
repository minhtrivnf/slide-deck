import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cmToEmu,
  gridSpan,
  assertNoMasterBandCollision,
  resolveActionTitleFit,
  ZONES,
} from "../src/units.js";
import { categoricalColor, textColorForSequentialStep, harveyBall, SEMANTIC } from "../src/palette.js";
import { ShapeIdAllocator, RidAllocator, SldIdAllocator } from "../src/ids.js";
import { connectorGeom } from "../src/geometry/connectors.js";

test("cmToEmu matches documented EMU conversions", () => {
  assert.equal(cmToEmu(25.4), 9144000); // slide width
  assert.equal(cmToEmu(19.05), 6858000); // slide height
  assert.equal(cmToEmu(1.27), 457200); // safe margin
});

test("gridSpan(1,12) spans the full safe-margin width", () => {
  const { x, cx } = gridSpan(1, 12);
  assert.equal(x, cmToEmu(1.27));
  // 12 columns * 1.91cm + 11 gutters * 0.32cm
  assert.equal(cx, Math.round(12 * cmToEmu(1.91) + 11 * cmToEmu(0.32)));
});

test("gridSpan rejects out-of-range columns", () => {
  assert.throws(() => gridSpan(0, 5));
  assert.throws(() => gridSpan(5, 13));
  assert.throws(() => gridSpan(6, 5));
});

test("assertNoMasterBandCollision catches the documented source-line regression", () => {
  // The v2.1 bug: source line placed below the tagline, at ~17.9cm.
  assert.throws(() => assertNoMasterBandCollision(cmToEmu(17.9), cmToEmu(0.5)));
  // The v2.2 fix: source line above the tagline, at 15.1cm, must pass.
  assert.doesNotThrow(() => assertNoMasterBandCollision(ZONES.source.y, ZONES.source.cy));
  assert.doesNotThrow(() => assertNoMasterBandCollision(ZONES.tagline.y, ZONES.tagline.cy));
});

test("resolveActionTitleFit follows the 80/100 char rule", () => {
  assert.deepEqual(resolveActionTitleFit("a".repeat(80)), { fontSizePt: 24, ok: true });
  assert.deepEqual(resolveActionTitleFit("a".repeat(100)), { fontSizePt: 20, ok: true });
  const tooLong = resolveActionTitleFit("a".repeat(101));
  assert.equal(tooLong.ok, false);
});

test("categoricalColor cycles through the 8-color palette", () => {
  assert.equal(categoricalColor(0), "002060");
  assert.equal(categoricalColor(8), categoricalColor(0)); // wraps
});

test("textColorForSequentialStep: white at step>=3, navy below", () => {
  assert.equal(textColorForSequentialStep(1), "002060");
  assert.equal(textColorForSequentialStep(2), "002060");
  assert.equal(textColorForSequentialStep(3), "FFFFFF");
  assert.equal(textColorForSequentialStep(5), "FFFFFF");
});

test("harveyBall and SEMANTIC pairs are internally consistent", () => {
  assert.equal(harveyBall(0), "○");
  assert.equal(harveyBall(4), "●");
  assert.equal(SEMANTIC.danger.dark, "C00000");
});

test("ShapeIdAllocator follows base_id = (slide-1)*100+1 and never repeats", () => {
  const a = new ShapeIdAllocator(3); // slide 3 -> base 201
  assert.equal(a.alloc(), 201);
  assert.equal(a.alloc(), 202);
  const many = a.allocMany(3);
  assert.deepEqual(many, [203, 204, 205]);
});

test("RidAllocator avoids ids reserved from a cloned template", () => {
  const r = new RidAllocator();
  r.reserve(["rId1", "rId2", "rId5"]);
  const first = r.alloc();
  const second = r.alloc();
  assert.notEqual(first, "rId1");
  assert.notEqual(first, "rId2");
  assert.notEqual(first, "rId5");
  assert.notEqual(first, second);
});

test("SldIdAllocator never issues below 256, honors reserved ids", () => {
  const s = new SldIdAllocator();
  s.reserve([256, 257]);
  const next = s.alloc();
  assert.ok(next >= 256);
  assert.notEqual(next, 256);
  assert.notEqual(next, 257);
});

test("connectorGeom: down-left diagonal from a centered top box requires flipH", () => {
  // Mirrors the exact documented Pattern 11 bug: top-box bottom-center to
  // a lower-left box's top-center is a right-to-left line -> flipH must be true.
  const top = { x: 4000000, y: 1000000 }; // top box bottom-center
  const lowerLeft = { x: 1000000, y: 2500000 }; // lower-left box top-center
  const geom = connectorGeom(top, lowerLeft);
  assert.equal(geom.flipH, true);
  assert.equal(geom.flipV, false);
  assert.equal(geom.off.x, 1000000);
  assert.equal(geom.ext.cx, 3000000);
});

test("connectorGeom: down-right diagonal requires no flip", () => {
  const top = { x: 4000000, y: 1000000 };
  const lowerRight = { x: 7000000, y: 2500000 };
  const geom = connectorGeom(top, lowerRight);
  assert.equal(geom.flipH, false);
  assert.equal(geom.off.x, 4000000);
});
