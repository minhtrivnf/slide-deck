/**
 * pattern_registry.ts
 *
 * Single registry mapping every pattern (P1–P24) to its Zod schema and the
 * prompt guidance that tells the specs LLM which fields to fill. Used by
 * both `specs.ts` (generation) and `revise.ts` (validation), so the two can
 * never drift — a pattern validated here is generated with the same schema.
 */

import { z } from "zod";
import {
  Pattern1StatCalloutSpecSchema,
  Pattern3DataTableSpecSchema,
  Pattern4ProcessFlowSpecSchema,
  Pattern5IconGridSpecSchema,
  Pattern6SwotSpecSchema,
  Pattern7LayerDividerSpecSchema,
  Pattern8QuoteSpecSchema,
  Pattern9BarChartSpecSchema,
  Pattern10ExecSummarySpecSchema,
  Pattern11PyramidSpecSchema,
  Pattern12WaterfallSpecSchema,
  Pattern13BcgMatrixSpecSchema,
  Pattern14HarveySpecSchema,
  Pattern15HeatMapSpecSchema,
  Pattern16DriverTreeSpecSchema,
  Pattern17RoadmapSpecSchema,
  Pattern18MaturityRadarSpecSchema,
  Pattern19ThreeHorizonSpecSchema,
  Pattern20EcosystemSpecSchema,
  Pattern21KpiScorecardSpecSchema,
  Pattern22AgendaSpecSchema,
  Pattern23SourceMethodSpecSchema,
  Pattern24BuildSpecSchema,
} from "../types.js";

export const PATTERN_SCHEMAS: Record<string, z.ZodType> = {
  P1: Pattern1StatCalloutSpecSchema,
  P2: Pattern1StatCalloutSpecSchema, // P1 & P2 share the stat-callout schema
  P3: Pattern3DataTableSpecSchema,
  P4: Pattern4ProcessFlowSpecSchema,
  P5: Pattern5IconGridSpecSchema,
  P6: Pattern6SwotSpecSchema,
  P7: Pattern7LayerDividerSpecSchema,
  P8: Pattern8QuoteSpecSchema,
  P9: Pattern9BarChartSpecSchema,
  P10: Pattern10ExecSummarySpecSchema,
  P11: Pattern11PyramidSpecSchema,
  P12: Pattern12WaterfallSpecSchema,
  P13: Pattern13BcgMatrixSpecSchema,
  P14: Pattern14HarveySpecSchema,
  P15: Pattern15HeatMapSpecSchema,
  P16: Pattern16DriverTreeSpecSchema,
  P17: Pattern17RoadmapSpecSchema,
  P18: Pattern18MaturityRadarSpecSchema,
  P19: Pattern19ThreeHorizonSpecSchema,
  P20: Pattern20EcosystemSpecSchema,
  P21: Pattern21KpiScorecardSpecSchema,
  P22: Pattern22AgendaSpecSchema,
  P23: Pattern23SourceMethodSpecSchema,
  P24: Pattern24BuildSpecSchema,
};

/** Pattern-specific guidance telling the LLM which fields to fill.
 *
 * Char budgets below are GEOMETRY-DERIVED (box width ÷ rendered char width at
 * the smallest font the renderer allows, with the VNF width model). They are
 * what the fixed layout can actually hold on ONE line — exceeding them is what
 * makes a build fail. Treat every budget as a hard limit: shorter is always
 * safer, never longer.
 */
export const PATTERN_GUIDANCE: Record<string, string> = {
  P1: `3-column stat callout. Fill: "cards" = exactly 3 objects. EXAMPLE: "cards": [{category: "Revenue", stat: "$2.5B", label: "2025 actual", bullets: ["Up 15% YoY", "Record high"]}, {...}, {...}]. Include "pattern":"P1". Each object: {category, stat (number/short), label, bullets:[1-4 strings], accentColorHex optional}. BUDGETS: category/label ≤ 30 chars, stat ≤ 12 chars, each bullet ≤ 60 chars.`,
  P2: `2-column stat callout. Fill: "cards" = exactly 2 objects. EXAMPLE: "cards": [{category: "Growth", stat: "+35%", label: "vs baseline", bullets: ["Fastest region", "Market leading"]}, {...}]. Include "pattern":"P2". Each object: {category, stat, label, bullets:[1-4 strings], accentColorHex optional}. BUDGETS: category/label ≤ 40 chars, stat ≤ 20 chars, each bullet ≤ 60 chars.`,
  P3: `Data table. Fill: "headers" = string array; "rows" = array of arrays (one string[] per row, same length as headers); "totalRow" = true if the last row is a totals row. BUDGETS: header cell ≤ 20 chars, data cell ≤ 30 chars (cells wrap, but keep short).`,
  P4: `Process flow / timeline. Fill: "steps" = 2-4 ordered objects {name, description}. BUDGETS: step name ≤ 18 chars (one line), description ≤ 60 chars.`,
  P5: `Icon grid 2x2. Fill: "items" = exactly 4 objects {icon (short glyph, 1-4 chars), label, description optional}. BUDGETS: label ≤ 15 chars (one line), description ≤ 45 chars.`,
  P6: `SWOT matrix. Fill: "quadrants" = exactly 4 objects in order S/W/O/T. Each object: {label (optional), bullets: [1-6 strings]}. EXAMPLE: "quadrants": [{label: "Strengths", bullets: ["Brand recognition", "Vertical integration"]}, {label: "Weaknesses", bullets: ["High costs", ...]}, {label: "Opportunities", bullets: [...]}, {label: "Threats", bullets: [...]}]. BUDGETS: quadrant label ≤ 20 chars, each bullet ≤ 60 chars (wraps in box).`,
  P7: `Layer divider (section break). Fill: "layerNumber" (JSON integer), "layerName" (string). EXAMPLE: {"layerNumber": 1, "layerName": "Market Analysis"}. BUDGET: layerName ≤ 60 chars (one line at 20pt).`,
  P8: `Quote highlight. Fill: "quote" (exact quotation), "attribution" (who said it / where). EXAMPLE: {"quote": "Innovation distinguishes between a leader and a follower.", "attribution": "Steve Jobs, Apple CEO"}. BUDGETS: quote ≤ 200 chars (wraps), attribution ≤ 80 chars.`,
  P9: `Bar chart. Fill: "bars" = 4-6 objects. EXAMPLE: "bars": [{label: "Factory A", value: 250, valueLabel: "250t/h"}, {label: "Factory B", value: 180}, ...]. Each object: {label, value (JSON number, NOT string), valueLabel optional, accentColorHex optional}; "unitNote" optional (e.g. "tonnes/hour"). BUDGETS: bar label ≤ 18 chars (one line), valueLabel ≤ 12 chars, unitNote ≤ 30 chars.`,
  P10: `Executive summary. Fill: "actionTitle" (one-sentence conclusion), "pillars" (exactly 3 objects), "takeaway" (Zone 4 so-what), "takeawayPrefix" optional. EXAMPLE: {
  "actionTitle": "Vietnam's food safety sector offers 3x growth potential",
  "pillars": [
    {"heading": "Market demand", "bullets": ["Growing 15% YoY", "Premium segment expanding"]},
    {"heading": "Regulatory push", "bullets": ["New compliance requirements", "Government incentives"]},
    {"heading": "Capability gaps", "bullets": ["Technology adoption low", "Skills shortage"]}
  ],
  "takeaway": "Focus on technology and training to capture market opportunity",
  "takeawayPrefix": "Kết luận:"
}
ActionTitle ≤ 70 chars, pillar heading ≤ 20 chars, each bullet ≤ 60 chars (wraps), takeaway ≤ 160 chars (wraps).`,
  P12: `Waterfall / bridge chart. Fill required: "start" (object), "drivers" (array 1-6), optional: "end", "unit". 
FULL EXAMPLE: {
  "start": {"value": 100, "label": "Base Revenue"},
  "drivers": [
    {"label": "Price increase", "delta": 15},
    {"label": "Volume growth", "delta": 20},
    {"label": "Churn impact", "delta": -8}
  ],
  "end": {"value": 127, "label": "Final Revenue"},
  "unit": "%"
}
Each driver label ≤ 14 chars. Start/end label ≤ 12 chars. Values/deltas are JSON numbers, NOT strings.`,
  P13: `BCG 2x2 matrix. Fill: "xAxisLabel", "yAxisLabel"; "quadrantLabels" = exactly 4 strings (order TL/TR/BL/BR); "bubbles" = 1-12 objects {x: 0.3, y: 0.7, size: "s"|"m"|"l", label: "name"}. EXAMPLE: "bubbles": [{x: 0.8, y: 0.9, size: "l", label: "Leader"}, ...]. x/y are JSON numbers 0-1. BUDGETS: axis/quadrant label ≤ 20 chars, bubble label ≤ 14 chars.`,
  P14: `Harvey ball comparison. Fill: "polarity" = "positive"|"neutral"; "options" = 2-6 strings (rows); "criteria" = objects {name, levels: [0,1,2,3,4]} per option (JSON integers); "weightedScores" optional. EXAMPLE: "criteria": [{name: "Price", levels: [3,2,4,2]}, {name: "Quality", levels: [4,3,3,4]}, ...]. BUDGETS: option ≤ 20 chars, criterion name ≤ 16 chars, score ≤ 8 chars.`,
  P15: `Heat map / risk matrix. Fill: "palette" = "sequential"|"risk"; "xTicks", "yTicks" = label arrays; "cells" = 1-20 objects {row (0-based int), col (0-based int), step (1-5 JSON integer), label optional}; "xAxisLabel", "yAxisLabel" optional. EXAMPLE: {"palette": "risk", "xTicks": ["Low", "Medium", "High"], "yTicks": ["Low", "Medium", "High"], "cells": [{"row": 0, "col": 2, "step": 5, "label": "Critical"}, {"row": 1, "col": 1, "step": 3}], "xAxisLabel": "Impact", "yAxisLabel": "Likelihood"}. BUDGETS: tick ≤ 10 chars, cell label ≤ 6 chars, axis label ≤ 20 chars.`,
  P16: `Driver tree / cascade. Fill: "root" (object), "branches" (array 1-3). Each node must have "name" AND "value" (both required strings). FULL EXAMPLE: {
  "root": {"name": "Revenue", "value": "$100M", "delta": {"direction": "up", "text": "+15%"}},
  "branches": [
    {
      "node": {"name": "Volume", "value": "+8%"},
      "children": [
        {"name": "Units sold", "value": "+5%"},
        {"name": "Mix shift", "value": "+3%"}
      ]
    },
    {
      "node": {"name": "Price", "value": "+7%"},
      "children": []
    }
  ]
}
Node fields: "name" (required, ≤16 chars), "value" (required string, ≤14 chars), "delta" optional {direction: "up"|"down"|"flat", text: ≤12 chars}. Every child node MUST have both name and value.`,
  P17: `Roadmap / Gantt. Fill: "quarters" (2-12 strings), "workstreams" (array), "todayQ" optional. FULL EXAMPLE: {
  "quarters": ["Q1'24", "Q2'24", "Q3'24", "Q4'24"],
  "workstreams": [
    {
      "name": "Product launch",
      "bars": [{"fromQ": 0, "toQ": 2, "label": "Development"}],
      "milestones": [{"atQ": 2, "label": "Beta"}]
    },
    {
      "name": "Marketing",
      "bars": [{"fromQ": 1, "toQ": 3, "label": "Campaign"}],
      "milestones": []
    }
  ],
  "todayQ": 1
}
IMPORTANT: fromQ/toQ/atQ/todayQ are INTEGER quarter indices (0-based). MUST be JSON numbers, NOT strings. Quarter tick ≤ 8 chars, workstream name ≤ 24 chars, bar label ≤ 20 chars, milestone label ≤ 12 chars.`,
  P18: `Maturity radar. Fill: "axes" (array 3-12 objects), "bullets" (array 0-6 strings). EXAMPLE: {
  "axes": [
    {"name": "Data quality", "current": 2, "target": 4},
    {"name": "Automation", "current": 3, "target": 5},
    {"name": "Governance", "current": 1, "target": 3}
  ],
  "bullets": ["Focus on data cleansing in H2", "Invest in RPA for process automation"]
}
Axis name ≤ 16 chars. Current/target are JSON integers 0-5. Each bullet ≤ 80 chars.`,
  P19: `Three-horizon framework. Fill: "xAxisLabel", "yAxisLabel"; "horizons" (exactly 3 objects). EXAMPLE: {
  "xAxisLabel": "Time to market",
  "yAxisLabel": "Investment level",
  "horizons": [
    {"timeframe": "0–12 months", "theme": "Optimize core", "initiatives": ["Cost reduction", "Efficiency"]},
    {"timeframe": "1–3 years", "theme": "Build adjacencies", "initiatives": ["New market entry"]},
    {"timeframe": "3+ years", "theme": "Create the future", "initiatives": ["Venture exploration"]}
  ]
}
Timeframe ≤ 24 chars, theme ≤ 40 chars, initiative ≤ 60 chars (wraps).`,
  P20: `Ecosystem / stakeholder map. Fill: "center" (string), "inner" (0-4 strings), "outer" (0-8 strings), "quadrantLabels" optional. EXAMPLE: {
  "center": "Your company",
  "inner": ["Customers", "Partners", "Regulators"],
  "outer": ["Competitors", "New entrants", "Suppliers", "Media"],
  "quadrantLabels": {"topLeft": "Influence", "topRight": "Impact", "bottomLeft": "Monitor", "bottomRight": "Engage"}
}
Center ≤ 30 chars, actor ≤ 18 chars, quadrant label ≤ 16 chars.`,
  P21: `KPI scorecard. Fill: "kpis" = 4-8 objects {name, value, target optional, delta optional, trend: "up"|"down"|"flat", status: "success"|"warning"|"danger"|"info"|"neutral"}. EXAMPLE: "kpis": [{name: "Revenue", value: "$2.5B", target: "$2.3B", trend: "up", status: "success"}, ...]. BUDGETS (one line): name ≤ 22 chars, value ≤ 12 chars, target ≤ 20 chars, delta ≤ 20 chars.`,
  P22: `Agenda / Table of Contents. Fill: "items" = 1-10 ordered objects. EXAMPLE: "items": [{title: "Market overview", page: 3, highlighted: false}, {title: "Strategy roadmap", page: 5, highlighted: true}, {title: "Financial forecast", page: 7}, ...]. Each object: {title (string, max 80 chars), page (JSON integer, auto-numbered if not provided), highlighted (boolean optional, true = emphasized in ToC)}. BUDGET: item title ≤ 40 chars (wraps).`,
  P23: `Source / methodology / assumptions. Fill: THREE columns, each with "header" (string) + "items" (array 1-8 strings). FULL EXAMPLE: {
  "sources": {
    "header": "Data sources",
    "items": ["World Bank 2024 report", "Industry survey Q3", "Internal sales data"]
  },
  "methodology": {
    "header": "Methodology",
    "items": ["Quantitative analysis", "Expert interviews", "Market modeling"]
  },
  "assumptions": {
    "header": "Key assumptions",
    "items": ["GDP growth 5%", "No regulatory changes", "Stable exchange rate"]
  }
}
Column header ≤ 30 chars, each item ≤ 90 chars (wraps).`,
  P24: `Build / sequential reveal. Fill: "stages" (3-5 strings), "focusIndex" (JSON integer 0-based), "detail" object. EXAMPLE: {
  "stages": ["Assess", "Design", "Implement", "Monitor"],
  "focusIndex": 2,
  "detail": {
    "heading": "Implementation phase",
    "bullets": ["Deploy pilot in 2 regions", "Train 50 staff", "Establish feedback loop"]
  }
}
Stage name ≤ 20 chars (no "Giai đoạn N:" prefix). Detail heading ≤ 40 chars, each bullet ≤ 90 chars (wraps).`,
};

/** Returns the guidance for a pattern, or a generic fallback. */
export function guidanceFor(pattern: string): string {
  return PATTERN_GUIDANCE[pattern] ?? "General content slide — provide concise, fact-based content in the same language as the report.";
}
