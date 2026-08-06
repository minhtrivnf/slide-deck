# Slide Deck Outline Generator — Detailed Guide (v2 — Consultancy Grade)

## Purpose

This guide explains how to turn a research/policy report into a structured ~55–65 slide outline following the VNF Deep-Tech Framework, applied through a **consultancy storyline** (BCG / McKinsey / Bain / Roland Berger conventions).

**v2 changes**:
- Outline now specifies **action titles** (descriptive sentences) in addition to short headlines.
- Per-slide entry adds **kicker** (eyebrow context), **source citation**, **so-what takeaway**, and an optional **media asset reference** (when the report contains charts/images extracted in Step 1).
- Presentation-style menu expanded from 9 → 24 patterns (see `slide_patterns.md`).
- Layer-level guidance updated to recommend the structural patterns (waterfall, BCG 2×2, driver tree, roadmap, three-horizon, KPI scorecard, Harvey Balls, heat map).
- New QA checks for action-title quality, MECE structure, and "so what" takeaways.
- Reading tool is **agent-chosen** (see `SKILL.md` Step 1) — the outline writer should expect that media has been extracted to `extracted_media/` and reference those filenames in the per-slide entry where relevant.

---

## VNF Design Standards (Reference)

When creating outlines, keep these constraints in mind for slide-building downstream:

| Standard | Value | Impact on Outline |
|----------|-------|-------------------|
| **Font** | Calibri (all text) | Text content must fit Calibri's character width |
| **Aspect Ratio** | 4:3 (25.40 × 19.05 cm) | Design for horizontal layout, not widescreen |
| **Color Palette** | VNF 15-color brand + semantic status tokens | Encode meaning in color, not just decoration |
| **Action Title** | 24pt bold Navy đậm `002060` | Descriptive sentence stating the conclusion (≤140 chars / 1–2 lines) |
| **Short Title** | 20pt bold Navy đậm `002060` | Topic name (3–5 words), used on layer dividers and ToC |
| **Kicker** | 10pt UPPERCASE Đỏ chính `953735` | Eyebrow above action title — category context |
| **Body Text** | 13pt Calibri | 3–5 bullets per slide max |
| **Tagline / Takeaway** | Blue box, 13pt bold Navy on `D6F1FC` | Zone 4 — the "so what" implication |
| **Source line** | 9pt italic Gray `888888` | Zone 3 — required when citing data |
| **Footer** | Automatic from slide master | Do NOT specify footer content in outline |

**Key Takeaway**: Outlines specify content that fits VNF's visual constraints AND tells a consultancy storyline — concise, MECE, conclusion-first.

---

## Core Principle

The outline is not a table of contents — it is a **narrative architecture**. Each layer tells a progressively deeper story: from raw science → technology → industry → market → strategy → architecture → action. A reader moving through all 7 layers should gain a complete, expert-level understanding.

Every slide must earn its place by delivering one specific insight. Vague slides waste the audience's time.

### The Consultancy Storyline (NEW — Read This First)

Three principles drive every outline entry:

#### 1. Action Titles, Not Topic Titles

Replace topic titles ("Market Analysis") with **descriptive sentences that state the conclusion** ("Asia-Pacific demand will outpace global growth by 2.4× through 2030, driven by aquaculture").

The CEO should be able to read only the action titles in sequence and reconstruct your argument. **If you can't write the slide as a finding, you don't have a finding yet.**

- Action titles go on insight slides (most slides).
- Short titles still belong on layer dividers, agenda, and source/methodology slides.

#### 2. Pyramid Principle (Minto)

Every slide answers a question. Lead with the answer (the governing thought), then support it with 3 mutually exclusive, collectively exhaustive (MECE) arguments, each with evidence.

- The deck overall is a pyramid. So is each slide.
- The action title = governing thought.
- The 3 cards / pillars / bars / cells = the supporting MECE arguments.

#### 3. "So What" Takeaways

Every analytical slide ends with a **takeaway** in Zone 4 — a blue box with the **implication for the reader**, not a restatement of the title.

- Bad: "Margins are down 8%."
- Good: "If we don't lock supplier contracts before Q3, EBITDA will miss by 12pp."

The agent MUST create the Zone 4 tagline. The slide master does NOT do this.

---

### Content-Driven Slide Allocation

**CRITICAL**: Slide counts are determined by **content importance and depth**, NOT by fixed numbers per layer.

**Guiding Principles**:
- Allocate slides based on meaning — more important topics get more slides
- Depth over uniformity — a complex field may need 12 slides; a simple field may need 3
- Quality over quantity — never add filler slides to meet a target
- Strategic emphasis — layers with higher strategic value receive more slides
- Report-driven — let source-report depth guide allocation

**Example Allocation Logic**:
- Extensive market data → Market Layer gets 12–15 slides
- Nascent technology → Technology Layer 4–6 slides
- Detailed strategic recommendations → Strategic layers 15–20 slides combined
- Well-established science → Science Layer 5–7 slides

**Target Range**: ~55–65 total slides, but quality first.

---

## Multi-File Outline Architecture

Generate the outline as **6 separate files**:

```
outlines/
├── outline-master.md          # Overview, metadata, cross-layer connections
├── outline-layer-1.md         # Science Layer (Fields 1-4)
├── outline-layer-2.md         # Technology Layer (Fields 5-8)
├── outline-layer-3.md         # Industrial Layer (Fields 9-12)
├── outline-layer-4.md         # Market Layer (Fields 13-16)
└── outline-layer-5.md         # Strategic + Architecture + Applied (Fields 17-31)
```

| Benefit | Description |
|---------|-------------|
| Speed | Each layer file generated independently |
| Context efficiency | Load only the layer being worked on |
| Parallel processing | Multiple layers in parallel |
| Easier QA | Review one layer at a time |
| Modular updates | Revise one layer without affecting others |

---

## Outline Generation Workflow

### Phase 1: Create Master File

Generate `outline-master.md` first.

**Template**:
```markdown
# Slide Deck Outline: [Report Title]

## Metadata
- Source Report: [filename]
- Total Slides: [Target ~55–65, content-depth driven]
- Generated: [Date]
- Report Summary: [2–3 sentences]
- Storyline Thesis: [One sentence — the governing thought of the entire deck, written as an action title]

## Layer Overview

| Layer | Name | Fields | Slides | File | Anchor Pattern |
|-------|------|--------|--------|------|----------------|
| 1 | Science | 1–4 | [N] | outline-layer-1.md | Driver tree (P16) or Pyramid (P11) |
| 2 | Technology | 5–8 | [N] | outline-layer-2.md | Harvey Balls (P14) or BCG 2×2 (P13) |
| 3 | Industrial | 9–12 | [N] | outline-layer-3.md | Ecosystem (P20) or Roadmap (P17) |
| 4 | Market | 13–16 | [N] | outline-layer-4.md | Waterfall (P12) or Heat map (P15) |
| 5 | Strategic | 17–20 | [N] | outline-layer-5.md | SWOT (P6) + Maturity radar (P18) |
| 6 | Strategic Architecture | 21–26 | [N] | outline-layer-5.md | Three-horizon (P19) + Pyramid (P11) |
| 7 | Applied Strategy | 27–31 | [N] | outline-layer-5.md | Roadmap (P17) + KPI scorecard (P21) |

## Cross-Layer Narrative Arc

1. Science → Technology: [How scientific understanding enables solutions]
2. Technology → Industrial: [How technologies are deployed in industry]
3. Industrial → Market: [How industrial activity creates market opportunity]
4. Market → Strategic: [How market dynamics reveal strategic opportunities]
5. Strategic → Architecture: [How strategy translates to a framework]
6. Architecture → Applied: [How framework becomes concrete actions]

## Key Themes from Report
- [Theme 1]: [Brief description]
- [Theme 2]: [Brief description]
- [Theme 3]: [Brief description]

## Critical Data Points
- [Stat 1]: [Value, context, source]
- [Stat 2]: [Value, context, source]
- [Stat 3]: [Value, context, source]

## Deck Storyline (Action-Title Skim)
The deck should read coherently if you only skim the action titles. Capture the action-title sequence here:
1. [Cover / agenda]
2. [Layer 1 thesis action title]
3. ...
```

### Phase 2: Generate Layer Files

Each layer file is self-contained with its own QA section. See "Layer File Template" below.

### Phase 3: QA Each Layer

Run the layer-level QA checklist before slide building.

### Phase 4: Final Integration

Verify cross-layer transitions and update `outline-master.md` with adjustments. **Re-read the action-title skim end-to-end** — if it doesn't read like a coherent argument, fix the outline before building slides.

---

## Slide Allocation Methodology

### Step 1: Assess Content Depth in Source Report

For each layer evaluate:
- Volume — how many pages/sections does the report dedicate?
- Complexity — how technical or nuanced?
- Data richness — how many data points, charts, findings?
- Strategic importance — how critical to the overall narrative?

### Step 2: Apply Importance Weighting

| Importance | Slide Allocation | When to Use |
|------------|------------------|-------------|
| Critical | 12–18 slides | Core topic, extensive data, high strategic value |
| High | 8–12 slides | Important topic, substantial content |
| Medium | 5–8 slides | Necessary context, moderate detail |
| Low | 3–5 slides | Supporting info, well-established facts |

### Step 3: Balance Across Layers

- Early layers (Science, Technology): foundation without over-explaining
- Middle layers (Industrial, Market): build evidence and context
- Late layers (Strategic, Architecture, Applied): actionable insights — often deserve more slides

### Allocation Scenarios

**Scenario A — Emerging Technology Report**: Science 6 / Tech 14 / Industrial 5 / Market 8 / Strategic 10 / Architecture 8 / Applied 7 = **58 slides**

**Scenario B — Market-Focused Report**: Science 4 / Tech 6 / Industrial 10 / Market 16 / Strategic 12 / Architecture 6 / Applied 8 = **62 slides**

**Scenario C — Strategic Transformation Report**: Science 5 / Tech 7 / Industrial 6 / Market 9 / Strategic 14 / Architecture 12 / Applied 10 = **63 slides**

### Red Flags

- ❌ All layers exactly the same slide count → arbitrary
- ❌ Filler "Overview of X" slides without specific insight
- ❌ Critical findings crammed into 1–2 slides
- ❌ Repetitive slides saying the same thing in different ways
- ❌ Unbalanced narrative — 20 slides on science, 3 on strategy

### Green Flags

- ✅ Slide counts vary by layer (natural distribution)
- ✅ Every slide has a specific insight (no generic "overview" slides)
- ✅ Strategic layers well-developed (action gets adequate space)
- ✅ Proportional to report depth
- ✅ Narrative flows naturally — no abrupt jumps

---

## The 7-Layer Structure (with v2 Pattern Recommendations)

### Layer 1 — Science Layer (Fields 1–4)

**Goal**: Establish the scientific foundation. What is the phenomenon? Why does it matter?

- Field 1: Core scientific mechanism
- Field 2: Quantitative significance and scale
- Field 3: Influencing factors and variables
- Field 4: Current understanding and knowledge gaps

**Tone**: Objective, data-driven, educational.

**Recommended patterns** (in priority order):
- **Pattern 16 (Driver tree)** for decomposing the mechanism into causal levers
- **Pattern 11 (Pyramid)** for structuring "what we know vs gaps"
- Pattern 4 (Process flow) for biological/chemical sequences
- Pattern 1 (Stat callout 3-col) for headline science metrics
- Pattern 8 (Quote highlight) for landmark scientific findings

**VNF Design Notes**: Use Calibri throughout. Diagrams use Navy for titles, Xanh sáng `0070C0` for processes, Đỏ chính `953735` for emphasis.

---

### Layer 2 — Technology Layer (Fields 5–8)

**Goal**: Show what technologies exist to address or leverage the phenomenon.

- Field 5: Technology landscape overview
- Field 6: Leading technologies in detail
- Field 7: Emerging/experimental technologies
- Field 8: Technology readiness and limitations (TRL)

**Tone**: Technical but accessible. Evidence of what works.

**Recommended patterns**:
- **Pattern 14 (Harvey Balls)** for multi-criteria technology comparison (efficacy / cost / TRL / risk / fit)
- **Pattern 13 (BCG 2×2)** for positioning technologies on maturity × impact axes
- Pattern 3 (Data table) for TRL and efficacy comparison
- Pattern 4 (Process flow) for technology evolution timelines
- Pattern 1 (Stat callout) for hero metrics (% reduction, $ saved, etc.)

---

### Layer 3 — Industrial Layer (Fields 9–12)

**Goal**: Map the real-world industrial landscape.

- Field 9: Global industry players and ecosystem
- Field 10: Current industrial applications and case studies
- Field 11: Supply chain, production, infrastructure
- Field 12: Industrial challenges and constraints

**Tone**: Practical, concrete, grounded in real examples.

**Recommended patterns**:
- **Pattern 20 (Ecosystem map)** for stakeholder/player landscape
- **Pattern 17 (Roadmap / Gantt)** for industry development timeline
- Pattern 5 (Icon grid) for player categories
- Pattern 1 / 2 (Stat callout cards) for case studies
- Pattern 3 (Data table) for player comparison

---

### Layer 4 — Market Layer (Fields 13–16)

**Goal**: Quantify the economic opportunity and market dynamics.

- Field 13: Market size, value, growth trajectory
- Field 14: Key segments and customer types
- Field 15: Competitive landscape and pricing
- Field 16: Regulatory environment

**Tone**: Commercial and analytical. Numbers everywhere.

**Recommended patterns**:
- **Pattern 12 (Waterfall / Bridge)** for market sizing decomposition (TAM → SAM → SOM)
- **Pattern 15 (Heat map)** for geographic/segment intensity
- **Pattern 13 (BCG 2×2)** for competitive positioning
- Pattern 1 (Stat callout 3-col) for hero market metrics
- Pattern 9 (Bar chart) for market share / growth comparisons

---

### Layer 5 — Strategic Layer (Fields 17–20)

**Goal**: Identify strategic opportunities and risks.

- Field 17: Strategic opportunity analysis
- Field 18: Competitive advantage assessment
- Field 19: Risk landscape
- Field 20: Strategic fit

**Tone**: Analytical, forward-looking, directional.

**Recommended patterns**:
- **Pattern 18 (Maturity radar)** for capability current vs target state
- **Pattern 15 (Heat map / Risk matrix)** for likelihood × impact risk register
- Pattern 6 (SWOT 2×2) for opportunity / threat / strength / weakness
- Pattern 2 (Stat callout 2-col) for opportunity vs risk pairs
- **Pattern 11 (Pyramid)** for strategic argument

---

### Layer 6 — Strategic Architecture Layer (Fields 21–26)

**Goal**: Design the strategic framework — the "how".

- Field 21: Strategic vision and long-term objectives
- Field 22: Core strategic pillars
- Field 23: Partnership and ecosystem strategy
- Field 24: Investment and resource allocation
- Field 25: Innovation and R&D roadmap
- Field 26: Governance and decision-making

**Tone**: Architectural, structured, blueprint-like.

**Recommended patterns**:
- **Pattern 19 (Three horizons)** for time-phased growth platforms
- **Pattern 11 (Pyramid)** for strategic architecture (vision → pillars → initiatives)
- **Pattern 24 (Build / Sequential)** for revealing the framework progressively
- Pattern 5 (Icon grid) for strategic pillars
- Pattern 17 (Roadmap) for innovation roadmap

---

### Layer 7 — Applied Strategy Layer (Fields 27–31)

**Goal**: Translate strategy into concrete actionable plans.

- Field 27: Short-term action plan (0–12 mo)
- Field 28: Medium-term milestones (1–3 yr)
- Field 29: KPIs and success metrics
- Field 30: Implementation risks and mitigations
- Field 31: Summary and call to action

**Tone**: Action-oriented, specific, named.

**Recommended patterns**:
- **Pattern 17 (Roadmap / Gantt)** for the action plan
- **Pattern 21 (KPI Scorecard)** for the metrics dashboard
- **Pattern 10 (Executive summary)** for the closing recommendation slide
- Pattern 14 (Harvey Balls) for risk × mitigation × owner table
- Pattern 11 (Pyramid) for closing argument

---

## Field-Level Elements

Each field in the outline must include:

### Field Title (10–15 words)
Concise summary or core idea — appears as a consistent headline element across slides in the field.

**Examples**:
- Field 1: "Methane Formation in Ruminants Through Enteric Fermentation"
- Field 13: "Global Market Opportunity Exceeding $2.5 Billion by 2030"
- Field 27: "Immediate Actions to Capture First-Mover Advantage"

### Field Tagline / Takeaway (10–20 words)
A "so what" implication that appears in a **blue box at the bottom of the content area (Zone 4)** on the final slide of the field.

**CRITICAL DISTINCTION**:
- **Tagline (Zone 4)**: Blue box with summary/conclusion — **Agent MUST create**
- **Source line (Zone 3)**: Italic gray "Source: ..." line for data slides — **Agent MUST create when citing data**
- **Footer (Zone 5)**: Section / CONFIDENTIAL / page number — **Automatic from slide master**

**Examples (good takeaways state implications, not facts)**:
- Field 1: "Targeting the methanogen pathway, not the microbiome broadly, is the only intervention with proven scale economics."
- Field 13: "Asia-Pacific aquaculture demand requires committing to a regional manufacturing footprint by 2027 to capture share."
- Field 27: "Six initiatives launched in Q1 build the foundation needed for the H2 commercial pivot."

---

## Layer File Template

```markdown
# [Layer Name] — Outline

## Layer Metadata
- Layer Number: [N]
- Fields: [X-Y]
- Target Slides: [Determined by content depth]
- Source Sections: [Which sections of the report]
- Allocation Rationale: [1–2 sentences]
- Anchor Pattern: [Which structural pattern frames this layer — e.g., P12 Waterfall, P19 Three-horizon]

## Layer Goal
[One sentence describing what this layer accomplishes]

## Layer Tone
[Intended tone and audience mindset]

## Layer Action-Title Skim
List the action titles in sequence — should read as a coherent argument:
1. [Action title slide N]
2. [Action title slide N+1]
...

---

## Field [N]: [Field Topic]

**Field Title**: [10–15 words — summary or core idea]

### Slide [number]
- **Objective**: [One sentence — what the audience learns or decides]
- **Action Title**: [Descriptive sentence stating the conclusion, ≤140 chars / 1–2 lines. Use this on insight slides.]
- **Short Headline (alt)**: [3–5 word topic — only when action title is inappropriate (layer divider, agenda, source slide).]
- **Kicker**: [UPPERCASE eyebrow — e.g., "SCIENCE · METHANE FORMATION"]
- **Content from report**: [Quote or paraphrase the specific data, finding, or section. Be specific — cite figures, percentages, mechanisms, conclusions.]
- **Media asset (optional)**: [If the report contained reusable charts/images extracted to `extracted_media/` in Step 1, name the file here — e.g., `extracted_media/image3.png` (chart of regional emissions). Slide builder will place it instead of regenerating.]
- **Source citation**: ["Source: <publisher> <year>; team analysis" — REQUIRED when slide uses third-party data, charts, or quoted statistics. Omit only on conceptual / process / SWOT slides.]
- **Presentation pattern**: [Pick from `slide_patterns.md` — Patterns 1–24. Examples: P10 (Exec summary) | P11 (Pyramid) | P12 (Waterfall) | P13 (BCG 2×2) | P14 (Harvey Balls) | P15 (Heat map) | P16 (Driver tree) | P17 (Roadmap) | P18 (Maturity radar) | P19 (Three horizons) | P20 (Ecosystem) | P21 (KPI scorecard) | P22 (Agenda) | P23 (Source/Method) | P24 (Build) | P1–P9 (foundational).]
- **So-what takeaway**: [10–20 words — IMPLICATION for the reader, in the blue box at Zone 4. Not a restatement of the action title.]
- **Transition to next**: [How this slide connects to the next]

### Slide [number+1]
...

**Field Tagline**: [10–20 words — closing takeaway for the field, sits in Zone 4 of the field's final slide]

---

## Field [N+1]: [Field Topic]
...

---

## Layer QA Checklist
- [ ] All fields in this layer represented
- [ ] Slide count justified by content depth (not arbitrary)
- [ ] Each field has a Field Title (10–15 words)
- [ ] Each field has a Field Tagline (10–20 words) on its final slide
- [ ] Field Tagline is content for Zone 4 (blue box), NOT footer
- [ ] Each insight slide has an Action Title (descriptive sentence)
- [ ] Each insight slide has a Kicker (UPPERCASE category)
- [ ] Source citation specified for every data-driven slide
- [ ] So-what takeaway specified for every analytical slide (not just title restatement)
- [ ] Action titles read as a coherent argument when skimmed in sequence
- [ ] Each slide has a distinct objective
- [ ] No filler slides
- [ ] Presentation patterns are varied — no two consecutive slides use the same pattern
- [ ] Layer includes ≥1 structural pattern (P10/P11/P12/P13/P16/P17/P19) and ≥3 evidence patterns
- [ ] Headlines are specific, not generic
- [ ] Content from report is cited concretely
- [ ] Transitions documented
- [ ] Layer follows narrative arc (setup → development → climax → resolution)

## Layer Storyline Summary
[One sentence summarizing the narrative journey of this layer]

## Connection to Next Layer
[How this layer connects to the next layer in the sequence]
```

---

## Per-Slide Template (Quick Reference, v2)

```
### Slide [number]
- Objective: [One sentence — what the audience learns or decides]
- Action Title: [Descriptive sentence stating the conclusion, ≤140 chars]
- Short Headline (alt only): [3–5 words, layer dividers / agenda / source]
- Kicker: [UPPERCASE eyebrow — "LAYER · FIELD TOPIC"]
- Content from report: [Specific data, quote, finding, mechanism, %, etc.]
- Media asset (optional): [extracted_media/<filename> if reusing a chart/image from the report]
- Source citation: [Required for data slides — "Source: …"]
- Presentation pattern: [P1–P24 from slide_patterns.md]
- So-what takeaway: [Zone 4 implication, 10–20 words]
- Transition to next: [How this slide connects to the next]
```

---

## Quality Checks for the Outline

Before moving to slide building, verify:

- [ ] All 7 layers represented
- [ ] Total slides ~55–65 (flexible based on content)
- [ ] Slide allocation reflects content importance and depth
- [ ] No layer has filler slides
- [ ] Each field has a Field Title (10–15 words)
- [ ] Each field has a Field Tagline / Takeaway (10–20 words)
- [ ] Field Taglines are Zone 4 content (blue box), NOT footer text
- [ ] Each insight slide has an Action Title (descriptive sentence stating the conclusion)
- [ ] Each insight slide has a Kicker (UPPERCASE category)
- [ ] Source citations specified for every data-driven slide
- [ ] So-what takeaway specified for every analytical slide (implications, not restatements)
- [ ] Each slide has a distinct objective — no two slides duplicate
- [ ] Presentation patterns are varied — no pattern repeated 2+ times consecutively
- [ ] Each layer uses ≥1 structural pattern (P10/P11/P12/P13/P16/P17/P19)
- [ ] Headlines are specific, not generic ("Methane output drops 20% with 3-NOP" not "Reduction results")
- [ ] Content from report is cited concretely, not vaguely
- [ ] The outline tells a coherent science → strategy story
- [ ] More important / complex topics receive more slides
- [ ] **Action-title skim test**: skimming only the action titles in sequence reconstructs the deck's argument
- [ ] **Pyramid test**: each slide's action title is the answer to a question, supported by 3 MECE arguments below

---

## QA Phase: Storyline Coherence Check

After completing the outline, run this dedicated QA pass to ensure each layer tells a cohesive, connected story.

### Purpose

A well-structured layer should feel like a guided journey, not a collection of independent facts. Each slide should:
- Build upon the previous slide's insight
- Set up the next slide's question or topic
- Maintain a clear through-line

### QA Process

#### 1. Opening Slide Check
- Does the first slide clearly introduce what the layer will explore?
- Is the layer's purpose immediately clear?
- Does it create curiosity or establish relevance?
- (v2) Is the layer's first insight slide using **Pattern 10 (Executive summary)** to state the layer's thesis?

#### 2. Slide-to-Slide Connection Check

For each consecutive pair, verify the narrative link:

| Connection Type | Description |
|-----------------|-------------|
| Cause → Effect | "Because X happens, Y results" |
| Problem → Solution | "Given challenge X, here's approach Y" |
| Question → Answer | "We asked X, the data shows Y" |
| General → Specific | "Overall pattern X, specifically Y" |
| Before → After | "Current state X, future state Y" |
| Contrast | "While X is true, Y presents a different picture" |
| Evidence → Implication | "Data shows X, which means Y" |

#### 3. Transition Statement Check

For each slide transition, write a one-sentence bridge:

```
Slide N → Slide N+1 Bridge: "[What we learned from slide N] leads us to examine [what slide N+1 explores]."
```

If you cannot write a clear bridge, the slides may lack narrative connection.

#### 4. Field-Level Storyline Check

```
Field [N] Storyline: "Starting with [first slide topic], we explored [middle content], arriving at [final insight]."
```

#### 5. Layer-Level Narrative Arc Check

| Arc Stage | Position | Purpose |
|-----------|----------|---------|
| Setup | First 1–2 slides | Establish context, pose central question |
| Development | Middle slides | Build evidence, explore dimensions |
| Climax | Peak slide | Present most important finding |
| Resolution | Final 1–2 slides | Synthesize learnings, point to next layer |

#### 6. Cross-Layer Transition Check

| From | To | Bridge Statement |
|------|-----|------------------|
| Science | Technology | "With the scientific foundation established, what technologies can address this phenomenon?" |
| Technology | Industrial | "These technologies are now being deployed by industry players who…" |
| Industrial | Market | "This industrial activity creates a market opportunity worth…" |
| Market | Strategic | "Given this market landscape, where can our organization capture value?" |
| Strategic | Strategic Architecture | "To capture this value, we need a structured framework that…" |
| Strategic Architecture | Applied Strategy | "This framework translates into concrete actions we can take now." |

#### 7. Action-Title Skim Test (NEW — v2)

Read **only the action titles** in sequence, ignoring every other field. The result should read as a coherent argument:

```
[Cover title]
1. [Layer 1 action title slide 1]
2. [Layer 1 action title slide 2]
3. [Layer 1 action title slide 3]
...
```

Apply two checks:
- **Coherence**: Does it read like an argument someone could verbally summarize?
- **Conclusion-first**: Is each title a finding (a sentence stating something new), not a topic?

If the answer is no on either check, rewrite the failing titles before slide building.

#### 8. So-What Test (NEW — v2)

For each Zone 4 takeaway, ask:
- Does it state an **implication** for the reader (action, decision, consequence)?
- Or is it just restating the slide's title in different words?

If it's the latter, rewrite. Examples:
- ❌ "Margins are down 8% YoY" (restatement)
- ✅ "Locking supplier contracts before Q3 is now the highest-leverage cost action" (implication)

### QA Checklist Summary

- [ ] Each layer has a clear opening slide that sets context
- [ ] Every consecutive slide pair has an identifiable connection type
- [ ] Bridge statements written for all transitions
- [ ] Each field has a one-sentence storyline summary
- [ ] Each layer follows narrative arc (setup → development → climax → resolution)
- [ ] Cross-layer transitions explicit and logical
- [ ] No slide feels orphaned
- [ ] **Action-title skim reads as coherent argument**
- [ ] **Every analytical slide's takeaway states implication, not restatement**

### Red Flags to Watch For

- Topic jumps with no transition
- Repeated content across multiple slides
- Missing links — cannot explain why slide B follows slide A
- Orphan data — statistics not connected to storyline
- Broken chain — final slide doesn't resolve opening question
- Topic-style action titles ("Market Analysis", "Overview of Risks") — must be rewritten as conclusions
- Takeaways that restate the title — must be rewritten as implications
- Missing source line on a slide that quotes a statistic or shows a chart