/**
 * layer_outliner.ts (v2 - Dynamic Layers + Executive Summary)
 *
 * Generates layer outlines dynamically based on brief content depth.
 * Includes dedicated Executive Summary (4-5 slides).
 * Allocates slides per field based on data complexity.
 */

import type { LLM, SlideOutline } from "./types.js";

export interface LayerOutlineResult {
  layer: number;
  layerName: string;
  slides: SlideOutline[];
  thesis: string;
}

export interface MasterOutlineResult {
  deckTitle: string;
  totalSlides: number;
  layers: LayerOutlineResult[];
  slides: SlideOutline[];
}

// Dynamic layer definitions - can be 5-7 depending on content
const LAYER_TEMPLATES = {
  1: { name: "Science", description: "Scientific foundation, mechanisms, evidence", minSlides: 5, maxSlides: 8 },
  2: { name: "Technology", description: "Technology solutions, readiness, comparisons", minSlides: 8, maxSlides: 12 },
  3: { name: "Industrial", description: "Real-world deployment, players, supply chain", minSlides: 6, maxSlides: 10 },
  4: { name: "Market", description: "Market size, segments, commercial dynamics", minSlides: 5, maxSlides: 8 },
  5: { name: "Strategic", description: "Opportunities, risks, strategy, analysis", minSlides: 5, maxSlides: 8 },
  6: { name: "Architecture", description: "Strategic framework, platforms, capability", minSlides: 5, maxSlides: 8 },
  7: { name: "Applied Strategy", description: "Action plan, roadmap, KPIs, risks, mitigation", minSlides: 12, maxSlides: 18 },
};

/**
 * Analyze brief to determine:
 * - Number of layers needed (5-7)
 * - Slide allocation per layer (based on content density)
 * - Total slide count (55-80)
 */
function analyzeBriefStructure(brief: string): {
  numLayers: number;
  layersToUse: number[];
  slideAllocation: Record<number, number>;
  totalSlides: number;
} {
  // Simple heuristic: count sections, data tables, metrics to estimate complexity
  const tableCount = (brief.match(/\|---/g) || []).length;
  const metricCount = (brief.match(/\$\d+|% |M |B |K /g) || []).length;
  const sectionCount = (brief.match(/### /g) || []).length;

  // Estimate content density
  const contentDensity = (tableCount * 2 + metricCount * 0.5 + sectionCount) / brief.length;

  // Determine number of layers (5-7 based on density)
  let numLayers = 5;
  if (contentDensity > 0.02) numLayers = 6; // More complex → 6 layers
  if (contentDensity > 0.03) numLayers = 7; // Very complex → 7 layers

  const layersToUse = Object.keys(LAYER_TEMPLATES)
    .slice(0, numLayers)
    .map(Number);

  // Allocate slides per layer based on data complexity
  const slideAllocation: Record<number, number> = {};
  for (const layer of layersToUse) {
    const template = LAYER_TEMPLATES[layer as keyof typeof LAYER_TEMPLATES];
    // Scale allocation based on contentDensity
    const scaleFactor = Math.min(1.5, 1 + contentDensity * 20);
    const allocSlides = Math.round(
      template.minSlides + (template.maxSlides - template.minSlides) * scaleFactor
    );
    slideAllocation[layer] = allocSlides;
  }

  // Executive Summary: 4-5 slides (fixed)
  const execSummarySlides = 5;

  // Calculate total
  const layerSlides = Object.values(slideAllocation).reduce((a, b) => a + b, 0);
  const totalSlides = 2 + execSummarySlides + layerSlides; // Cover + Disclaimer + Exec Summary + Layers

  return {
    numLayers,
    layersToUse,
    slideAllocation,
    totalSlides,
  };
}

/**
 * Create agenda/TOC slide - overview of all layers
 */
function generateAgendaSlide(layers: LayerOutlineResult[], startSlideNum: number): SlideOutline {
  const agendaItems = layers
    .map((layer) => `${layer.layerName} (${layer.slides.length} slides): ${layer.thesis}`)
    .join(" | ");

  return {
    slideNumber: startSlideNum,
    pattern: "P22",
    title: "Agenda: Structure and Storyline",
    source: undefined,
    takeaway: undefined,
    contentNotes: `Overview of ${layers.length} layers:\n${agendaItems}`,
  };
}

/**
 * Generate Executive Summary outline (4-5 slides)
 */
function generateExecutiveSummary(brief: string): SlideOutline[] {
  // Extract key insights from brief
  const lines = brief.split("\n").slice(0, 100);
  
  return [
    {
      slideNumber: 3,
      pattern: "P10",
      title: "Strategic verdict: Market opportunity + recommended action",
      source: undefined,
      takeaway: "Direction for organization",
      contentNotes: "Extract from brief: executive thesis + 3 pillars",
    },
    {
      slideNumber: 4,
      pattern: "P1",
      title: "Market size and growth trajectory",
      source: "Source: Market analysis",
      takeaway: "Scale of opportunity drives investment case",
      contentNotes: "3 metrics: TAM (current/2030), CAGR, addressable segment",
    },
    {
      slideNumber: 5,
      pattern: "P1",
      title: "Top 3 opportunities for capture",
      source: "Source: Strategic analysis",
      takeaway: "Prioritize highest-leverage plays first",
      contentNotes: "3 opportunity cards: market gap, competitive advantage, timeline",
    },
    {
      slideNumber: 6,
      pattern: "P1",
      title: "Top 3 risks requiring mitigation",
      source: "Source: Risk assessment",
      takeaway: "De-risk before scaling commitment",
      contentNotes: "3 risk cards: regulatory, technical, market",
    },
    {
      slideNumber: 7,
      pattern: "P10",
      title: "Recommended next steps: phased roadmap",
      source: "Source: Strategic roadmap",
      takeaway: "Phase 1: Validate, Phase 2: Pilot, Phase 3: Scale",
      contentNotes: "3 phases: timeline, budget, key milestones",
    },
  ];
}

/**
 * Create prompt for one layer (with flexible field counts)
 */
function createDynamicLayerPrompt(
  brief: string,
  deckTitle: string,
  layerNum: number,
  layerName: string,
  numSlides: number,
  description: string
): string {
  return `You are a McKinsey/BCG-grade presentation consultant. Generate a detailed outline for Layer ${layerNum} (${layerName}) of a ${numSlides}-slide presentation.

DECK TITLE: ${deckTitle}

LAYER ${layerNum}: ${layerName.toUpperCase()}
- Target slides: ${numSlides}
- Goal: ${description}

CONTENT BRIEF (from report):
---
${brief.slice(0, 50000)}
---

INSTRUCTIONS:

Generate Layer ${layerNum} with EXACTLY ${numSlides} slides:

1. **Data-Rich**: Every slide is SPECIFIC, with concrete numbers/quotes from brief
2. **Varied patterns**: No two consecutive slides use same pattern (P1-P24)
3. **Action titles**: Conclusion-first, NOT topics (e.g., "Nano-minerals deliver 1.5-3x growth" not "Technology comparison")
4. **Kickers**: UPPERCASE eyebrow (e.g., "LAYER ${layerNum} · FIELD NAME")
5. **Takeaways**: Zone 4 implication (10-20 words), not title restatement
6. **Sources**: Required for all data slides

OUTPUT - Valid JSON only (no markdown fences):
\`\`\`json
{
  "layerNumber": ${layerNum},
  "layerName": "${layerName}",
  "layerThesis": "One-sentence statement of layer's argument",
  "numSlides": ${numSlides},
  "slides": [
    {
      "slideNumber": [starting number],
      "layer": ${layerNum},
      "pattern": "P11",
      "actionTitle": "Finding stated as conclusion",
      "kicker": "LAYER ${layerNum} · TOPIC",
      "objective": "What audience learns",
      "contentNotes": "Specific data: numbers, quotes, findings",
      "source": "Source: Author Year",
      "takeaway": "Implication for reader"
    },
    ... exactly ${numSlides - 1} more slides
  ]
}
\`\`\`

LANGUAGE: Detect language of brief, write ENTIRE output in that language. NEVER translate.

Generate exactly ${numSlides} slides. Valid JSON only.`;
}

/**
 * Generate one layer outline
 */
async function generateDynamicLayerOutline(
  llm: LLM,
  brief: string,
  deckTitle: string,
  layerNum: number,
  layerName: string,
  numSlides: number,
  description: string,
  startSlideNumber: number
): Promise<LayerOutlineResult> {
  const prompt = createDynamicLayerPrompt(brief, deckTitle, layerNum, layerName, numSlides, description);
  
  console.log(`[LayerOutliner] Generating Layer ${layerNum} (${layerName}) - ${numSlides} slides...`);
  
  const raw = await llm.invoke(prompt);

  try {
    const cleaned = raw.replace(/```[a-zA-Z]*\n?/g, "").trim();
    const braceIndex = cleaned.indexOf("{");
    const jsonStr = braceIndex >= 0 ? cleaned.substring(braceIndex) : cleaned;
    const parsed = JSON.parse(jsonStr);

    const slides: SlideOutline[] = (parsed.slides || []).map((slide: any, i: number) => ({
      slideNumber: startSlideNumber + i,
      pattern: slide.pattern || "P1",
      title: slide.actionTitle || slide.title || `Slide ${startSlideNumber + i}`,
      source: slide.source,
      takeaway: slide.takeaway,
      contentNotes: slide.contentNotes || "",
    }));

    console.log(`[LayerOutliner] Layer ${layerNum} generated: ${slides.length} slides`);

    return {
      layer: layerNum,
      layerName,
      slides,
      thesis: parsed.layerThesis || "Layer thesis",
    };
  } catch (e) {
    console.error(`[LayerOutliner] Layer ${layerNum} failed: ${(e as Error).message}`);
    throw e;
  }
}

/**
 * Generate all layers in parallel (dynamic count + allocation)
 * Also generates deck title via LLM and creates Agenda slide
 */
export async function generateDynamicLayerOutlines(
  llm: LLM,
  brief: string,
  deckTitleHint: string
): Promise<MasterOutlineResult> {
  console.log("[LayerOutliner] Analyzing brief structure...");
  
  const analysis = analyzeBriefStructure(brief);
  console.log(
    `[LayerOutliner] Detected ${analysis.numLayers} layers, ${analysis.totalSlides} total slides`
  );

  // Generate deck title from LLM (don't use file name)
  const titlePrompt = `Based on this report brief, generate a concise, professional deck title (≤80 chars) that captures the main topic/opportunity:

${brief.slice(0, 5000)}

Return ONLY the title, nothing else.`;

  const deckTitle = await llm.invoke(titlePrompt);
  console.log(`[LayerOutliner] Generated deck title: ${deckTitle.trim()}`);

  // Generate Executive Summary
  const execSummary = generateExecutiveSummary(brief);
  let currentSlideNum = 7; // After cover (1), agenda (2), exec summary (3-7)

  // Generate all layers in parallel
  const layerPromises = analysis.layersToUse.map((layerNum) => {
    const template = LAYER_TEMPLATES[layerNum as keyof typeof LAYER_TEMPLATES];
    const numSlides = analysis.slideAllocation[layerNum];
    return generateDynamicLayerOutline(
      llm,
      brief,
      deckTitle.trim(),
      layerNum,
      template.name,
      numSlides,
      template.description,
      currentSlideNum
    ).then((result) => {
      currentSlideNum += numSlides;
      return result;
    });
  });

  const layerResults = await Promise.all(layerPromises);

  console.log(`[LayerOutliner] All layers generated`);

  // Build final outline: Cover (1) + Agenda (2) + Exec Summary (3-7) + Layer Dividers + Layers (8+)
  const agendaSlide = generateAgendaSlide(layerResults, 2);
  
  const allSlides: SlideOutline[] = [agendaSlide, ...execSummary];
  let slideNum = 7;
  
  for (const layer of layerResults) {
    // Insert a Pattern 7 layer divider slide before each layer's content slides
    slideNum++;
    allSlides.push({
      slideNumber: slideNum,
      pattern: "P7",
      title: `LAYER ${layer.layer} — ${layer.layerName.toUpperCase()}`,
      contentNotes: `Layer divider for layer ${layer.layer}: ${layer.layerName}`,
      source: undefined,
      takeaway: layer.thesis,
    });

    for (const slide of layer.slides) {
      slideNum++;
      allSlides.push({
        ...slide,
        slideNumber: slideNum,
      });
    }
  }

  return {
    deckTitle: deckTitle.trim(),
    totalSlides: allSlides.length + 1, // +1 for cover
    layers: layerResults,
    slides: allSlides,
  };
}

