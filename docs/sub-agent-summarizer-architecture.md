# Sub-Agent Summarizer Architecture

## Overview

Kiến trúc Map-Reduce cho việc tóm tắt báo cáo lớn, giải quyết vấn đề mất dữ liệu khi truncate.

---

## Problem Statement

### Current Issue

```
File 2000k lines (~2MB text)
       │
       ▼
  truncate(60,000 chars)  ← Mất 95%+ dữ liệu
       │
       ▼
  LLM Summarize
       │
       ▼
  Brief 60k chars (3% of original)
       │
       ▼
  Outline: ~10 slides, nội dung thưa, thiếu data
```

### Root Cause

| Problem | Current Value | Impact |
|---------|---------------|--------|
| `maxChars` limit | 60,000 | Mất 95% dữ liệu với file lớn |
| Single LLM call | 1 summary | Không process được context dài |
| No chunking | Truncate | Data tail bị loại bỏ hoàn toàn |

---

## Proposed Solution: Map-Reduce Architecture

### High-Level Flow

```
                    ┌─────────────────────────────────┐
                    │         ARCHITECTURE OVERVIEW    │
                    └─────────────────────────────────┘

File 2000k lines (2MB)
       │
       ▼
┌──────────────────┐
│    CHUNKER       │  Deterministic splitting
│    (no LLM)      │  15k chars + 2k overlap
└──────────────────┘
       │
       ▼
┌──────────────────┐
│   MAP PHASE      │  N chunks → N sub-agent calls
│   (parallel)     │  Extract: findings, metrics, risks
└──────────────────┘
       │
       ▼
┌──────────────────┐
│   REDUCE PHASE   │  Merge N summaries → 1 brief
│   (1 LLM call)   │  Synthesize, deduplicate
└──────────────────┘
       │
       ▼
┌──────────────────┐
│  COMPREHENSIVE   │  10-15k chars, full data
│  BRIEF           │  Supports 30-50 rich slides
└──────────────────┘
```

---

## Component Details

### 1. Chunker (Deterministic)

**File**: `src/agent/chunker.ts`

**Purpose**: Split large text into overlapping chunks without LLM.

**Algorithm**:

```
Input:  text (2,000,000 chars)
        chunkSize = 15,000 chars
        overlap = 2,000 chars

Output: chunks[] (~134 chunks for 2MB file)

Logic:
  start = 0
  while start < text.length:
    end = min(start + chunkSize, text.length)
    
    # Try natural break point
    actualEnd = findNaturalBreak(text[start:end])
    
    chunks.push({
      index: chunkIndex,
      content: text[start:start+actualEnd],
      startOffset: start,
      endOffset: start + actualEnd
    })
    
    start = start + actualEnd - overlap  # preserve context
    chunkIndex++
```

**Natural Break Points** (priority order):

1. Paragraph break (`\n\n`) - prefer if >80% of chunk
2. Sentence end (`. `) - prefer if >80% of chunk  
3. Section header (`\n## `) - prefer if >70% of chunk
4. Fallback: use full chunk size

**Interface**:

```typescript
interface Chunk {
  index: number;
  content: string;
  charCount: number;
  startOffset: number;
  endOffset: number;
}
```

---

### 2. Map Phase (Parallel Sub-Agents)

**File**: `src/agent/map_reduce.ts`

**Purpose**: Extract detailed facts from each chunk in parallel.

**Prompt Strategy**:

```typescript
const MAP_PROMPT = `
Extract ALL key facts, numbers, findings from this chunk.

CHUNK {chunkIndex} of {totalChunks}:
---
{chunkContent}
---

Output JSON with:
- keyFindings[]: specific findings with exact data
- metrics[]: all numbers/KPIs with context
- risks[]: identified risks
- opportunities[]: identified opportunities
- recommendations[]: all recommendations
- entities[]: companies, people, places
- timeline[]: dates, deadlines

CRITICAL: Extract EVERY number, percentage, date. Do NOT summarize.
`;
```

**Parallel Execution**:

```typescript
// Process chunks in parallel batches
const CONCURRENCY = 3;  // Limit parallel LLM calls

for (let i = 0; i < chunks.length; i += CONCURRENCY) {
  const batch = chunks.slice(i, i + CONCURRENCY);
  const results = await Promise.all(
    batch.map(chunk => mapChunk(llm, chunk, chunks.length))
  );
  chunkSummaries.push(...results);
}
```

**Output Format**:

```typescript
interface ChunkSummaryResult {
  chunkIndex: number;
  keyFindings: Array<{
    finding: string;      // "Revenue grew 15% YoY"
    data: string;         // "$2.5B → $2.875B"
    source: string;       // "Section 3.2, paragraph 2"
    importance: 'critical' | 'high' | 'medium' | 'low';
  }>;
  metrics: Array<{
    name: string;         // "Revenue"
    value: string;        // "$2.875B"
    context: string;      // "vs $2.5B last year"
    trend: 'up' | 'down' | 'stable' | 'unknown';
  }>;
  quotes: string[];       // ["Exact quote from text"]
  risks: string[];        // ["Risk 1", "Risk 2"]
  opportunities: string[];
  recommendations: string[];
  entities: string[];     // ["Company A", "John Smith"]
  timeline: string[];     // ["Q3 2026", "March deadline"]
}
```

---

### 3. Reduce Phase (Single LLM Call)

**File**: `src/agent/map_reduce.ts`

**Purpose**: Merge all chunk summaries into one comprehensive brief.

**Input Preparation**:

```typescript
// Deduplicate and sort
const allFindings = chunkSummaries
  .flatMap(s => s.keyFindings)
  .sort((a, b) => importanceOrder[a.importance] - importanceOrder[b.importance]);

const allMetrics = chunkSummaries.flatMap(s => s.metrics);
const allEntities = [...new Set(chunkSummaries.flatMap(s => s.entities))];
```

**Prompt Strategy**:

```typescript
const REDUCE_PROMPT = `
Synthesize {N} chunk summaries into ONE comprehensive brief.
Goal: Support a 30-50 slide deck with FULL data.

MERGED DATA:
=== FINDINGS ({count}) ===
{sorted_findings}

=== METRICS ({count}) ===
{all_metrics}

=== RISKS/OPPS/RECS ===
...

OUTPUT: Markdown brief with sections:
1. Executive Summary (3-5 sentences)
2. Key Findings & Data (30-50 bullets, grouped by theme)
3. Quantitative Summary (all metrics by category)
4. Structure (main sections/themes)
5. Risks & Challenges
6. Opportunities & Recommendations
7. Entities & Stakeholders
8. Timeline & Milestones
9. Suggested Storyline (5-8 action titles)

CRITICAL: Preserve EVERY number. Group by THEME not chunk.
`;
```

**Output**: Markdown brief (~10-15k chars)

---

## Updated Pipeline

### Before vs After

```
BEFORE (Current):
  extract → summarize(60k) → outline → specs → render → pack
              ↑ Data loss

AFTER (Proposed):
  extract → map(N chunks) → reduce → outline → specs → render → pack
              ↑ Full data preserved
```

### Graph Definition

```typescript
const app = new StateGraph<AgentState>({
  channels: {
    // ... existing channels
    fullReportText: null,
    chunkSummaries: null,
  },
})
  .addNode("extract", extractNode)
  .addNode("map", mapNode)           // NEW
  .addNode("reduce", reduceNode)     // NEW
  .addNode("buildOutline", outlineNode)
  .addNode("buildSpecs", specsNode)
  .addNode("render", renderNode)
  .addNode("pack", packNode)
  // Edges
  .addConditionalEdges(START, (state) => 
    state?.feedback ? "revise" : "extract"
  )
  .addConditionalEdges("extract", () => "map")      // UPDATED
  .addConditionalEdges("map", () => "reduce")        // NEW
  .addConditionalEdges("reduce", () => "buildOutline") // UPDATED
  // ... rest unchanged
```

---

## Cost & Performance Analysis

### Token Usage

| Metric | Current | Proposed |
|--------|---------|----------|
| Input tokens | ~15k (truncated) | ~2M (full text) |
| Output tokens | ~2k (sparse brief) | ~15k (rich brief) |
| LLM calls | 1 | N chunks + 1 reduce |
| Cost per 2MB file | ~$0.01 | ~$0.10-0.20 |

### Latency

| Metric | Current | Proposed |
|--------|---------|----------|
| Summarize time | ~10s | ~30-60s |
| Parallel speedup | N/A | 3x (concurrency=3) |
| Total pipeline | ~60s | ~90-120s |

### Quality Impact

| Metric | Current | Proposed |
|--------|---------|----------|
| Data coverage | ~3% | ~95%+ |
| Slide count | ~10 | ~30-50 |
| Content richness | Sparse | Data-rich |
| Number accuracy | Partial | Complete |

---

## Implementation Details

### File Structure

```
src/agent/
├── chunker.ts          # NEW: Text chunking logic
├── map_reduce.ts       # NEW: Map-Reduce implementation
├── graph.ts            # UPDATED: New pipeline
├── summarize.ts        # DEPRECATED: Keep for fallback
└── ... (existing files)
```

### Configuration Options

```typescript
interface MapReduceConfig {
  chunkSize: number;      // Default: 15,000 chars
  overlap: number;        // Default: 2,000 chars
  concurrency: number;    // Default: 3 parallel calls
  maxChunks: number;      // Default: 50 (safety limit)
  cacheEnabled: boolean;  // Default: true
}
```

### Error Handling

```typescript
// Chunk-level error handling
async function mapChunkWithRetry(
  llm: LLM, 
  chunk: Chunk, 
  totalChunks: number,
  maxRetries = 2
): Promise<ChunkSummaryResult> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await mapChunk(llm, chunk, totalChunks);
    } catch (error) {
      if (attempt === maxRetries) {
        // Return minimal summary on failure
        return createFallbackSummary(chunk);
      }
      await delay(1000 * attempt); // Exponential backoff
    }
  }
  throw new Error('Unreachable');
}
```

---

## Migration Strategy

### Phase 1: Foundation (Week 1)

- [ ] Create `src/agent/chunker.ts`
- [ ] Create `src/agent/map_reduce.ts`
- [ ] Add unit tests for chunker
- [ ] Add integration tests for map-reduce

### Phase 2: Integration (Week 2)

- [ ] Update `graph.ts` with new nodes
- [ ] Add feature flag `USE_MAP_REDUCE`
- [ ] Update state types
- [ ] Add logging/monitoring

### Phase 3: Validation (Week 3)

- [ ] A/B test with sample reports
- [ ] Compare slide quality (current vs new)
- [ ] Performance benchmarking
- [ ] Cost analysis

### Phase 4: Rollout (Week 4)

- [ ] Enable by default
- [ ] Deprecate old `summarize.ts`
- [ ] Update documentation
- [ ] Monitor production metrics

---

## Comparison Table

| Aspect | Current (Truncate) | Proposed (Map-Reduce) |
|--------|--------------------|-----------------------|
| **Data Loss** | 95%+ | ~5% |
| **LLM Calls** | 1 | N+1 |
| **Cost** | ~$0.01 | ~$0.10-0.20 |
| **Latency** | ~10s | ~30-60s |
| **Slides** | ~10 thin | ~30-50 rich |
| **Numbers** | Partial | Complete |
| **Scalability** | Fixed limit | Linear with chunks |
| **Complexity** | Low | Medium |

---

## Risk Assessment

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| LLM hallucination in map phase | Medium | High | Zod validation, retry |
| Chunk boundary context loss | Low | Medium | Overlap strategy |
| Parallel call failures | Medium | Medium | Retry with backoff |
| Exceed token limits | Low | High | Adaptive chunk size |

### Business Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Increased cost | High | Low | Cache, adaptive sizing |
| Longer latency | Medium | Low | Parallel execution |
| Quality regression | Low | High | A/B testing, monitoring |

---

## Success Metrics

### Quality Metrics

- **Data Coverage**: >90% of numbers/dates preserved
- **Slide Count**: 30-50 slides (vs current ~10)
- **Content Density**: >80% slides have 3+ data points
- **Action Titles**: 100% conclusion-first

### Performance Metrics

- **Latency**: <120s for 2MB file
- **Cost**: <$0.20 per 2MB file
- **Error Rate**: <1% chunk processing failures

### Business Metrics

- **User Satisfaction**: Reduced "thưa" complaints
- **Deck Quality**: More comprehensive, data-driven
- **Time to Deck**: Acceptable increase for better quality

---

## Appendix

### A. Chunk Size Optimization

```typescript
function calculateOptimalChunkSize(text: string): number {
  // Analyze content density
  const numbers = (text.match(/\d+/g) || []).length;
  const words = text.split(/\s+/).length;
  const density = numbers / words;
  
  // High-density data (financial reports): smaller chunks for precision
  if (density > 0.15) return 10_000;
  
  // Medium density (consulting reports): default
  if (density > 0.08) return 15_000;
  
  // Low density (narrative text): larger chunks for context
  return 20_000;
}
```

### B. Cache Strategy

```typescript
interface CacheEntry {
  hash: string;
  chunkSummaries: ChunkSummaryResult[];
  timestamp: number;
  ttlMs: number;  // 24 hours
}

async function getCachedSummaries(
  text: string
): Promise<ChunkSummaryResult[] | null> {
  const hash = computeHash(text);
  const cached = await cache.get(hash);
  
  if (cached && Date.now() - cached.timestamp < cached.ttlMs) {
    return cached.chunkSummaries;
  }
  
  return null;
}
```

### C. Monitoring & Logging

```typescript
// Log each phase
console.log(`[MAP] Processing ${chunks.length} chunks...`);
console.log(`[MAP] Batch ${i}/${batches.length}: ${results.length} chunks`);

// Track metrics
metrics.record('map_chunks', chunks.length);
metrics.record('map_duration_ms', mapDuration);
metrics.record('reduce_duration_ms', reduceDuration);
metrics.record('total_tokens', totalTokens);
```

---

## References

1. Map-Reduce Pattern: https://en.wikipedia.org/wiki/MapReduce
2. Text Chunking Strategies: https://www.pinecone.io/learn/chunking-strategies/
3. LLM Context Windows: https://platform.openai.com/docs/models
