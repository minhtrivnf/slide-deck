/**
 * renderer.ts
 *
 * Turns validated pattern specs into OOXML body fragments. Every pattern
 * (P1–P24) is rendered by its deterministic hard-coded renderer in
 * src/patterns/, so the LLM only supplies content and never geometry.
 *
 * Most patterns are wrapped in standard chrome: an action title on top, an
 * optional source line at the bottom, and an optional takeaway tagline box.
 * A few patterns are self-contained and render their own title / chrome:
 *   P7  full-bleed layer divider (background + title, no chrome)
 *   P10 executive summary (renders its own action title + tagline)
 *   P11 pyramid (own renderer)
 *   P22 agenda (renders its own "AGENDA" title)
 */

import { renderPattern1StatCards } from "../patterns/p1_stat_cards.js";
import { renderPattern3DataTable } from "../patterns/p3_data_table.js";
import { renderPattern4ProcessFlow } from "../patterns/p4_process.js";
import { renderPattern5IconGrid } from "../patterns/p5_icon_grid.js";
import { renderPattern6Swot } from "../patterns/p6_swot.js";
import { renderPattern7LayerDivider } from "../patterns/p7_layer_divider.js";
import { renderPattern8Quote } from "../patterns/p8_quote.js";
import { renderPattern9BarChart } from "../patterns/p9_bar_chart.js";
import { renderPattern10ExecSummary } from "../patterns/p10_exec_summary.js";
import { renderPattern11Pyramid } from "../patterns/p11_pyramid.js";
// import { renderPattern12Waterfall } from "../patterns/p12_waterfall.js";
import { renderPattern13BcgMatrix } from "../patterns/p13_bcg_matrix.js";
import { renderPattern14Harvey } from "../patterns/p14_harvey.js";
import { renderPattern15HeatMap } from "../patterns/p15_heatmap.js";
import { renderPattern16DriverTree } from "../patterns/p16_driver_tree.js";
import { renderPattern17Roadmap } from "../patterns/p17_roadmap.js";
import { renderPattern18MaturityRadar } from "../patterns/p18_maturity_radar.js";
import { renderPattern19ThreeHorizon } from "../patterns/p19_three_horizon.js";
import { renderPattern20Ecosystem } from "../patterns/p20_ecosystem.js";
import { renderPattern21KpiScorecard } from "../patterns/p21_kpi_scorecard.js";
import { renderPattern22Agenda } from "../patterns/p22_agenda.js";
import { renderPattern23SourceMethodology } from "../patterns/p23_source_methodology.js";
import { renderPattern24Build } from "../patterns/p24_build.js";
import { renderFilledTextBox } from "../templates/common.js";
import { ShapeIdAllocator } from "../ids.js";
import { BRAND } from "../palette.js";
import { ZONES, resolveActionTitleFit, fitTitle } from "../units.js";
import type { SlideSpec, RenderedSlide, SlidePattern } from "./types.js";

/** Common shape of every hard-coded pattern renderer result. */
interface PatternRenderResult {
  bodyXml: string;
  shapeIds: unknown;
}

type PatternRenderer = (rawSpec: unknown, slideNumber: number) => PatternRenderResult;

const PATTERN_RENDERERS: Record<SlidePattern, PatternRenderer> = {
  P1: renderPattern1StatCards,
  P2: renderPattern1StatCards, // same renderer; the spec's `pattern` field picks 2 vs 3 columns
  P3: renderPattern3DataTable,
  P4: renderPattern4ProcessFlow,
  P5: renderPattern5IconGrid,
  P6: renderPattern6Swot,
  P7: renderPattern7LayerDivider,
  P8: renderPattern8Quote,
  P9: renderPattern9BarChart,
  P10: renderPattern10ExecSummary,
  P11: renderPattern11Pyramid,
  // P12: renderPattern12Waterfall, // Removed: use P6, P15, P16 instead
  P13: renderPattern13BcgMatrix,
  P14: renderPattern14Harvey,
  P15: renderPattern15HeatMap,
  P16: renderPattern16DriverTree,
  P17: renderPattern17Roadmap,
  P18: renderPattern18MaturityRadar,
  P19: renderPattern19ThreeHorizon,
  P20: renderPattern20Ecosystem,
  P21: renderPattern21KpiScorecard,
  P22: renderPattern22Agenda,
  P23: renderPattern23SourceMethodology,
  P24: renderPattern24Build,
};

/** Patterns that draw their own title / chrome and get no wrapper. */
const SELF_CONTAINED: ReadonlySet<string> = new Set(["P7", "P10", "P11", "P22"]);

/** Chrome allocator base offset: far above any content id a hard-coded
 * renderer can allocate (content starts at (slide-1)*100+1). */
const CHROME_SLIDE_OFFSET = 100000;

function renderWithFallback(
  slideNumber: number,
  pattern: SlidePattern,
  rawSpec: any,
  renderer: PatternRenderer
): { bodyXml: string; shapeIds: unknown; usedFallback?: boolean } {
  try {
    return { bodyXml: renderer(rawSpec, slideNumber).bodyXml, shapeIds: renderer(rawSpec, slideNumber).shapeIds };
  } catch (err) {
    console.warn(
      `[Renderer] Pattern ${pattern} slide ${slideNumber} failed: ${(err as Error).message}. ` +
      `Using fallback P3 (Data Table).`
    );
    
    // Fallback to P3 data table with title + content notes
    const fallbackSpec = {
      pattern: "P3",
      title: rawSpec?.title || rawSpec?.actionTitle || "Slide content",
      source: rawSpec?.source,
      takeaway: rawSpec?.takeaway,
      headers: ["Item", "Details"],
      rows: [
        ["Title", String(rawSpec?.title || rawSpec?.actionTitle || "N/A")],
        ["Key Finding", String(rawSpec?.contentNotes || rawSpec?.takeaway || "See content")]
      ],
      totalRow: false
    };
    
    return {
      bodyXml: renderPattern3DataTable(fallbackSpec, slideNumber).bodyXml,
      shapeIds: renderPattern3DataTable(fallbackSpec, slideNumber).shapeIds,
      usedFallback: true
    };
  }
}

export function renderSlides(slideNumberBase: number, specs: SlideSpec[]): RenderedSlide[] {
  return specs.map((slideSpec, i) => {
    const slideNumber = slideNumberBase + i;
    const renderer = PATTERN_RENDERERS[slideSpec.pattern];
    if (!renderer) {
      console.warn(`[Renderer] No renderer for ${slideSpec.pattern}, using P3 fallback`);
      return renderChromeSlide(slideNumber, "P3", slideSpec.spec, (s, n) => renderPattern3DataTable(s, n));
    }
    if (SELF_CONTAINED.has(slideSpec.pattern)) {
      const rendered = renderWithFallback(slideNumber, slideSpec.pattern, slideSpec.spec, renderer);
      return {
        slideNumber,
        pattern: slideSpec.pattern,
        title: selfContainedTitle(slideSpec.pattern, slideSpec.spec),
        takeaway: selfContainedTakeaway(slideSpec.pattern, slideSpec.spec),
        bodyXml: rendered.bodyXml,
        shapeIds: flattenShapeIds(rendered.shapeIds),
      };
    }
    return renderChromeSlide(slideNumber, slideSpec.pattern, slideSpec.spec, renderer);
  });
}

function renderChromeSlide(
  slideNumber: number,
  pattern: SlidePattern,
  rawSpec: unknown,
  renderer: PatternRenderer
): RenderedSlide {
  const spec = rawSpec as { title?: string; source?: string; takeaway?: string; actionTitle?: string };
  const pieces: string[] = [];
  const usedIds: number[] = [];

  // Chrome ids come from a far-offset base so they can never collide with the
  // ids each hard-coded renderer allocates internally from its own allocator.
  const chromeIds = new ShapeIdAllocator(slideNumber + CHROME_SLIDE_OFFSET);

  // Never render a wrapping title: deterministically trim any over-long title
  // to one line before sizing it (covers revision-produced specs too).
  const title = fitTitle(spec.title || spec.actionTitle || "");
  const titleFit = resolveActionTitleFit(title);
  const titleFont = titleFit.ok ? titleFit.fontSizePt : 20;
  const titleId = chromeIds.alloc();
  usedIds.push(titleId);
  pieces.push(
    renderFilledTextBox({
      shapeId: titleId,
      name: "ActionTitle",
      rect: { x: 230400, y: 0, cx: 8683200, cy: ZONES.title.cyActionTitle },
      text: title,
      fontSizePt: titleFont,
      bold: true,
      textColorHex: BRAND.navyDam,
      align: "l",
      anchor: "ctr",
    })
  );

  const content = renderWithFallback(slideNumber, pattern, rawSpec, renderer);
  pieces.push(content.bodyXml);
  usedIds.push(...flattenShapeIds(content.shapeIds));

  if (spec.source) {
    const srcId = chromeIds.alloc();
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
    const boxId = chromeIds.alloc();
    const textId = chromeIds.alloc();
    usedIds.push(boxId, textId);
    pieces.push(renderTakeawayBox(boxId, textId, spec.takeaway));
  }

  return {
    slideNumber,
    pattern,
    title,
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

/** Normalizes a renderer's shapeIds (number[], nested arrays, or an object
 * like P7's {background,title} / P11's {top,middle,bottom,connectors}). */
function flattenShapeIds(shapeIds: unknown): number[] {
  if (Array.isArray(shapeIds)) return shapeIds.flat().filter((n): n is number => typeof n === "number");
  if (shapeIds && typeof shapeIds === "object") {
    return Object.values(shapeIds as Record<string, unknown>).flat().filter((n): n is number => typeof n === "number");
  }
  return [];
}

function selfContainedTitle(pattern: SlidePattern, spec: unknown): string {
  const s = spec as Record<string, unknown>;
  switch (pattern) {
    case "P7":
      return typeof s.layerName === "string" ? s.layerName : "";
    case "P10":
      return typeof s.actionTitle === "string" ? s.actionTitle : "";
    case "P11":
      return typeof s.title === "string" ? s.title : "";
    case "P22":
      return "AGENDA";
    default:
      return "";
  }
}

function selfContainedTakeaway(pattern: SlidePattern, spec: unknown): string | undefined {
  if (pattern === "P10") {
    const takeaway = (spec as Record<string, unknown>).takeaway;
    return typeof takeaway === "string" ? takeaway : undefined;
  }
  return undefined;
}
