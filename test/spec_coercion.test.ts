import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Pattern7LayerDividerSpecSchema,
  Pattern9BarChartSpecSchema,
  Pattern12WaterfallSpecSchema,
  Pattern13BcgMatrixSpecSchema,
  Pattern14HarveySpecSchema,
  Pattern15HeatMapSpecSchema,
  Pattern17RoadmapSpecSchema,
  Pattern18MaturityRadarSpecSchema,
  Pattern22AgendaSpecSchema,
  Pattern24BuildSpecSchema,
} from "../src/types.js";

test("P17 roadmap coerce string fromQ/toQ into integers (the 2026 deck failure)", () => {
  const parsed = Pattern17RoadmapSpecSchema.parse({
    quarters: ["Q1'26", "Q2'26", "Q3'26", "Q4'26"],
    workstreams: [
      {
        name: "Hạ tầng",
        bars: [
          { fromQ: "0", toQ: "1" },
          { fromQ: "1", toQ: "2" },
        ],
        milestones: [{ atQ: "1", label: "Go-live" }],
      },
    ],
    todayQ: "0",
  });
  assert.equal(parsed.workstreams[0].bars[0].fromQ, 0);
  assert.equal(parsed.workstreams[0].bars[1].toQ, 2);
  assert.equal(parsed.workstreams[0].milestones[0].atQ, 1);
  assert.equal(parsed.todayQ, 0);
});

test("numeric spec fields coerce numeric strings across all numeric patterns", () => {
  assert.equal(Pattern7LayerDividerSpecSchema.parse({ layerNumber: "2", layerName: "Hiện trạng" }).layerNumber, 2);
  assert.equal(Pattern9BarChartSpecSchema.parse({ bars: [{ label: "Miền Bắc", value: "38" }] }).bars[0].value, 38);
  assert.equal(
    Pattern12WaterfallSpecSchema.parse({ start: { value: "100", label: "Năm 2025" }, drivers: [{ label: "Giá", delta: "12" }] }).drivers[0].delta,
    12
  );
  assert.equal(Pattern13BcgMatrixSpecSchema.parse({ xAxisLabel: "x", yAxisLabel: "y", quadrantLabels: ["a", "b", "c", "d"], bubbles: [{ x: "0.7", y: 0.3, size: "m", label: "Cao cấp" }] }).bubbles[0].x, 0.7);
  assert.equal(Pattern14HarveySpecSchema.parse({ polarity: "positive", options: ["A", "B"], criteria: [{ name: "Chi phí", levels: ["3", 2] }] }).criteria[0].levels[0], 3);
  assert.equal(Pattern15HeatMapSpecSchema.parse({ palette: "risk", xTicks: ["T1", "T2"], yTicks: ["T3", "T4"], cells: [{ row: "0", col: "1", step: "4" }] }).cells[0].step, 4);
  assert.equal(Pattern18MaturityRadarSpecSchema.parse({ axes: [{ name: "Bảo mật", current: "3", target: 4 }, { name: "Khả dụng", current: 2, target: 5 }, { name: "Hiệu năng", current: 1, target: 3 }], bullets: [] }).axes[0].current, 3);
  assert.equal(Pattern22AgendaSpecSchema.parse({ items: [{ title: "Tổng quan", page: "3" }] }).items[0].page, 3);
  assert.equal(Pattern24BuildSpecSchema.parse({ stages: ["A", "B", "C"], focusIndex: "2", detail: { heading: "Tổng hợp", bullets: ["b"] } }).focusIndex, 2);
});

test("numeric coercion still rejects non-numeric strings", () => {
  assert.throws(() =>
    Pattern17RoadmapSpecSchema.parse({
      quarters: ["Q1"],
      workstreams: [{ name: "w", bars: [{ fromQ: "Q1", toQ: 1 }], milestones: [] }],
    })
  );
});
