# VNF Slide-Deck Generator

Công cụ tự động chuyển đổi file **Word (.docx)** thành **PowerPoint (.pptx)** theo chuẩn thương hiệu VNF, sử dụng AI Agent kết hợp LangGraph để orchestration pipeline.

## Tổng quan

Dự án triển khai một **AI agent loop** đọc báo cáo Word, tóm tắt nội dung, tạo outline slide, sinh chi tiết spec cho từng pattern, render XML, và đóng gói thành file .pptx hoàn chỉnh.

**Nguyên tắc thiết kế cốt lõi:**

- **LLM chỉ xử lý "phán đoán"**: hiểu yêu cầu, tóm tắt, chọn cấu trúc slide, viết nội dung
- **Mọi thao tác "cơ học" là code deterministic**: hình học EMU, màu sắc, ID, nối connector, validate XML — LLM không bao giờ tự bịa toạ độ hay ID trùng

**Tech Stack:**

| Thành phần | Công nghệ |
|---|---|
| Ngôn ngữ | TypeScript (ESM), Node ≥ 20 |
| Orchestration | `@langchain/langgraph` (StateGraph) |
| LLM | OpenAI-compatible HTTP adapter (Mistral, cấu hình qua `.env`) |
| Đọc docx | `mammoth` + `jszip` |
| Xử lý XML | `@xmldom/xmldom` |
| Validate dữ liệu LLM | `zod` |

---

## Kiến trúc tổng thể

### Pipeline (Sơ đồ luồng)

```
┌──────────┐    natural message
│  User    │──────────────────────────────┐
└──────────┘                              ▼
CLI (src/cli.ts)                    ┌─────────────┐
  │  load .env                      │  chatIntake │  LLM#1: hiểu tin nhắn
  │  tạo file tên mới               └─────────────┘  → docxPath + userRequest
  │                                      │
  └── buildDeck(...)  ────────────────────┘
                    │
        LangGraph StateGraph (src/agent/graph.ts)
                    │
   START ──► extract ──► summarize ──► buildOutline ──► buildSpecs ──► render ──► pack ──► END
            (mammoth)    (LLM#2)        (LLM#3)         (LLM/slide)   (deterministic) (jszip+GateA)

   Vòng phản hồi (user nhắn thêm/sửa):
   START ──► revise ──► render ──► pack ──► END
             (LLM)      (deterministic)
```

### Số lần gọi LLM

```
intake (1) + summarize (1) + outline (N layers) + specs (N slides)  →  deck lần đầu
revise (1)                                                          →  mỗi lượt feedback
```

---

## Giải thích các Node trong Graph

### 1. Extract (Deterministic)

- **File**: `src/agent/docx.ts`
- **Chức năng**: Đọc file .docx bằng mammoth, trích xuất text thô và liệt kê media files
- **Input**: `docxPath`
- **Output**: `reportText`, `mediaFiles`

### 2. Summarize (LLM)

- **File**: `src/agent/summarize.ts` + `src/agent/summarizer_agent.ts`
- **Chức năng**: Tóm tắt báo cáo thành brief 5-9 mục chuẩn bị cho outline generation
- **LLM sử dụng**: Có thể dùng model rẻ hơn (AI_SUMMARY_KEY / MODEL_SUMMARY) để tiết kiệm chi phí
- **Output**: Brief Markdown 5-9 mục (Executive Summary, Key Findings, Quantitative Summary, Sections & Themes, Risks, Opportunities, Entities, Timeline, Narrative Arc)

### 3. Build Outline (LLM)

- **File**: `src/agent/layer_outliner.ts`
- **Chức năng**: Phân tích brief để xác định số layer (5-7) và phân bổ slide theo nội dung
- **Cấu trúc Output**:
  - Cover (slide 1)
  - Agenda (slide 2)
  - Executive Summary (slide 3-7): 5 slide cố định với P10, P1 pattern
  - Layers (slide 8+): Mỗi layer 5-18 slide tùy độ phức tạp

**Phân tích brief tự động:**
- Đếm bảng, số liệu, section để ước tính content density
- 5-7 layers tùy độ phức tạp
- Tổng 55-80 slide

### 4. Build Specs (LLM)

- **File**: `src/agent/specs.ts`
- **Chức năng**: Chuyển outline thành pattern-specific spec cho từng slide
- **Kỹ thuật**: Mỗi slide gọi LLM riêng, validate bằng Zod schema
- **Fallback system**: Khi validation thất bại → chuyển sang pattern đơn giản hơn
- **Retry**: Tối đa 2 lần mỗi spec (lần 2 gửi lỗi validation để LLM sửa)

### 5. Revise (LLM)

- **File**: `src/agent/revise.ts`
- **Chức năng**: Xử lý vòng phản hồi "bổ sung nội dung A cho slide B"
- **Kỹ thuật**: Tolerant merge — slide lỗi giữ bản cũ, không chết cả turn

### 6. Render (Deterministic)

- **File**: `src/agent/renderer.ts` + `src/patterns/*.ts`
- **Chức năng**: Chuyển specs thành XML body fragments
- **Kỹ thuật**:
  - Chrome allocator (ID offset 100000) tránh trùng với content
  - Action title fit: 24pt/20pt theo estimated rendered width
  - Source line, tagline box

### 7. Pack (Deterministic)

- **File**: `src/agent/assembler.ts`
- **Chức năng**: Unpack template, inject slide XML, update rels/Content_Types, Gate A validation, đóng zip
- **Kỹ thuật**:
  - `SldIdAllocator` bắt đầu từ 256
  - `RidAllocator` reserve existing IDs
  - Gate A: 6 kiểm tra toàn vẹn

---

## Patterns (24 Pattern)

### Bảng tổng hợp

| Pattern | Tên | Mô tả | Field chính |
|---|---|---|---|
| **P1** | Stat Callout 3-col | 3 thẻ số liệu lớn | `stats` |
| **P2** | Stat Callout 2-col | 2 thẻ số liệu lớn | `stats` |
| **P3** | Data Table | Bảng dữ liệu | `matrix` |
| **P4** | Process Flow | Quy trình/timeline | `steps` |
| **P5** | Icon Grid 2×2 | Lưới 4 ô có icon | `items` |
| **P6** | SWOT Matrix | Ma trận 4 ô Strength/Weakness/Opportunity/Threat | `quadrants` |
| **P7** | Layer Divider | Trang phân vùng (title lớn) | `title` |
| **P8** | Quote Highlight | Trích dẫn lớn | `quote`, `quoteSource` |
| **P9** | Bar Chart | Biểu đồ cột ngang | `bars` |
| **P10** | Executive Summary | 3 trụ cột chính | `pillars` |
| **P11** | Pyramid Principle | 1 governing thought + 3 arguments + evidence | `governingThought`, `arguments` |
| **P12** | Waterfall/Bridge | Biểu đồ waterfall | `bars` (fallback từ P12 → P3) |
| **P13** | BCG 2×2 Matrix | Ma trận BCG 4 ô | `quadrants` |
| **P14** | Harvey Ball | So sánh bằng Harvey Ball | `stats` |
| **P15** | Heat Map | Ma trận nhiệt/rủi ro | `matrix` |
| **P16** | Driver Tree | Cây driver/cascade | `steps` |
| **P17** | Roadmap/Gantt | Lịch trình Gantt | `steps` |
| **P18** | Maturity Radar | Radar trưởng thành | `stats` |
| **P19** | Three Horizon | 3 Horizon framework | `pillars` |
| **P20** | Ecosystem Map | Bản đồ hệ sinh thái | `items` |
| **P21** | KPI Scorecard | Bảng điểm KPI | `matrix` |
| **P22** | Agenda | Mục lục | `items` (numbered) |
| **P23** | Source/Methodology | Nguồn/phương pháp | `items` |
| **P24** | Build/Sequential | Giai đoạn xây dựng | `steps` |

### Fallback Map

Khi LLM trả spec không hợp lệ, pattern tự chuyển sang pattern đơn giản hơn:

```
P10, P19, P18, P5  → P1 (Stat Callout)
P12, P13, P14, P15, P16, P20, P11, P6  → P3 (Data Table)
P17, P24  → P4 (Process Flow)
```

---

## Kỹ thuật quan trọng

### 1. ID Allocation Deterministic

- **File**: `src/ids.ts`
- `ShapeIdAllocator`: base_id = `(slide_number - 1) * 100 + 1` — ID không bao giờ trùng giữa các slide
- `RidAllocator`: reserve existing IDs từ template trước khi cấp mới
- `SldIdAllocator`: bắt đầu từ 256 (PowerPoint reserve < 256)

### 2. Geometry Model (EMU)

- **File**: `src/units.ts`
- Slide canvas: 25.40 × 19.05 cm (4:3)
- Grid 12 cột: 1.91cm/column, 0.32cm gutter
- Zones dọc:
  - Title: 0 - 3.0cm
  - Content: 3.4 - 15.0cm
  - Source: 15.1cm
  - Tagline: 16.2cm
  - Master Reserved: 17.5 - 18.2cm (không được đặt shape)

### 3. Action Title Fit

- **File**: `src/units.ts`
- **Kỹ thuật**: Ước tính rendered width của text theo Calibri advance widths
- 24pt nếu fit trong 880px,否则 20pt,否则 reject (phải viết lại ngắn hơn)
- `fitTitle()`: deterministic rewrite shorter với ellipsis

### 4. Brand Color System

- **File**: `src/palette.ts`
- **BRAND**: 15 màu thương hiệu
- **SEMANTIC**: 5 cặp dark/light theo status (success/warning/danger/info/neutral)
- **CATEGORICAL_8**: 8 màu cho biểu đồ
- **SEQUENTIAL_5**: 5 step ramp cho heat map
- **DIVERGING_5**: 5 step ramp cho risk matrix

### 5. Gate A Validation

- **File**: `src/validator.ts`
- 6 kiểm tra toàn vẹn:
  1. Không trùng `<p:cNvPr id>` trong slide
  2. Mỗi slideN.xml có _rels/slideN.xml.rels
  3. Không trùng rId trong presentation.xml.rels
  4. Không trùng sldId, mọi sldId ≥ 256
  5. Mọi file .rels: target tồn tại trên disk
  6. [Content_Types].xml tồn tại và parse được

### 6. Tolerant Merge (Revise)

- **File**: `src/agent/revise.ts`
- Khi LLM trả specs mới trong revise:
  - Slide validate OK → dùng bản mới
  - Slide validate lỗi → giữ bản cũ
  - Slide dư không hợp lệ → bỏ

---

## Cấu trúc thư mục

```
vnf-pptx-toolkit-phase1-2/
├── src/
│   ├── agent/
│   │   ├── graph.ts              # LangGraph pipeline chính
│   │   ├── types.ts              # Types cho AgentState, SlideSpec, LLM
│   │   ├── context.ts            # Process-wide LLM holder
│   │   ├── llm.ts                # OpenAI-compatible HTTP adapter
│   │   ├── intake.ts             # Conversational intake (hiểu tin nhắn)
│   │   ├── docx.ts               # Đọc file Word
│   │   ├── summarize.ts          # Wrapper cho summarizer sub-agent
│   │   ├── summarizer_agent.ts   # Sub-agent tóm tắt báo cáo
│   │   ├── layer_outliner.ts     # Dynamic layer outline generation
│   │   ├── specs.ts              # Sinh pattern-specific specs
│   │   ├── pattern_spec.ts       # Schema nội dung chung (PatternContent)
│   │   ├── pattern_registry.ts   # Registry 24 patterns + guidance
│   │   ├── revise.ts             # Xử lý vòng phản hồi
│   │   ├── renderer.ts           # Render specs → XML
│   │   ├── assembler.ts          # Đóng gói pptx
│   │   └── outline_export.ts     # Export outline sang markdown
│   ├── patterns/
│   │   ├── content_layouts.ts    # 24 layout renderers
│   │   ├── p1_stat_cards.ts      # P1/P2 Stat Cards
│   │   ├── p3_data_table.ts      # P3 Data Table
│   │   ├── p4_process.ts         # P4 Process Flow
│   │   ├── p5_icon_grid.ts       # P5 Icon Grid
│   │   ├── p6_swot.ts            # P6 SWOT Matrix
│   │   ├── p7_layer_divider.ts   # P7 Layer Divider
│   │   ├── p8_quote.ts           # P8 Quote
│   │   ├── p9_bar_chart.ts       # P9 Bar Chart
│   │   ├── p10_exec_summary.ts   # P10 Executive Summary
│   │   ├── p11_pyramid.ts        # P11 Pyramid Principle
│   │   ├── p13_bcg_matrix.ts     # P13 BCG Matrix
│   │   ├── p14_harvey.ts         # P14 Harvey Ball
│   │   ├── p15_heatmap.ts        # P15 Heat Map
│   │   ├── p16_driver_tree.ts    # P16 Driver Tree
│   │   ├── p17_roadmap.ts        # P17 Roadmap/Gantt
│   │   ├── p18_maturity_radar.ts # P18 Maturity Radar
│   │   ├── p19_three_horizon.ts  # P19 Three Horizon
│   │   ├── p20_ecosystem.ts      # P20 Ecosystem Map
│   │   ├── p21_kpi_scorecard.ts  # P21 KPI Scorecard
│   │   ├── p22_agenda.ts         # P22 Agenda
│   │   ├── p23_source_methodology.ts # P23 Source/Methodology
│   │   └── p24_build.ts          # P24 Build/Sequential
│   ├── templates/
│   │   └── common.ts             # renderFilledTextBox, renderBulletListBox
│   ├── geometry/
│   │   └── connectors.ts         # Connector geometry cho P11
│   ├── cli.ts                    # Entry point CLI
│   ├── index.ts                  # Public API exports
│   ├── units.ts                  # EMU conversion, grid, zones
│   ├── palette.ts                # Brand colors, semantic colors
│   ├── ids.ts                    # Deterministic ID allocation
│   ├── xml.ts                    # XML escape utilities
│   ├── types.ts                  # Zod schemas cho P11
│   └── validator.ts              # Gate A validation
├── assets/
│   └── vnf_slide_template.pptx   # Template PowerPoint
├── test/
│   ├── smoke.test.ts             # Units, palette, ids, connectors
│   ├── pattern11.test.ts         # P11 schema, geometry, renderer
│   └── spec_coercion.test.ts     # Spec coercion tests
├── output/                       # Generated outlines (markdown)
├── package.json
└── tsconfig.json
```

---

## Cấu hình

### File `.env`

```
AI_API_URL=https://api.mistral.ai/v1/
AI_API_KEY=your-api-key
MODEL=mistral-large-2512

# Optional: Summary LLM (cheaper model)
AI_SUMMARY_URL=https://api.mistral.ai/v1/
AI_SUMMARY_KEY=your-summary-key
MODEL_SUMMARY=ministral-3b
```

### Lệnh

| Lệnh | Ý nghĩa |
|---|---|
| `npm run build` | Compile TypeScript → `dist/` |
| `npm run dev` | Build + chạy CLI interactive (chat) |
| `npm run dev -- <path.docx>` | Build deck ngay từ file cụ thể |
| `npm test` | Chạy unit tests |

---

## Luồng dữ liệu chi tiết (End-to-End)

```
User: "làm slide từ file báo cáo trong D:\VNF"
  │
  ▼  chatIntake (LLM#1)
{ docxPath: "D:\VNF\report.docx", userRequest: "..." }
  │
  ▼  buildDeck
extract  →  { reportText, mediaFiles }
summarize→  { summary }              (brief tiếng Việt/Anh, 5-9 mục)
outline  →  { outline: [{slideNumber:3, pattern:"P1", title:"...", contentNotes:"..."}, ...] }
specs    →  { specs: [{pattern:"P1", spec:{stats:[...]}}, {pattern:"P11", spec:{governingThought,arguments}}...] }
render   →  { renderedSlides: [{slideNumber:3, bodyXml:"<p:sp>...</p:sp>...", shapeIds:[201,...]}] }
pack     →  Gate A OK → deck.pptx mới (tên timestamp)
  │
  ▼  printResult → hỏi feedback
User: "bổ sung nội dung an toàn lao động cho slide 3"
  │
  ▼  reviseDeck (dùng lại summary + specs cũ)
revise (LLM) → specs mới → render → pack → file mới
```

---

## Data Model

```typescript
interface SlideOutline {
  slideNumber: number;
  pattern: SlidePattern;           // "P11" | "P1".."P24"
  title: string;                   // action title (conclusion-first)
  source?: string;                 // source citation
  takeaway?: string;               // Zone 4 so-what
  contentNotes: string;            // text phẳng cho LLM
}

type SlideSpec =
  | { pattern: "P11"; spec: Pattern11PyramidSpec }
  | { pattern: Exclude<SlidePattern,"P11">; spec: PatternContent };

interface RenderedSlide {
  slideNumber: number;
  pattern: SlidePattern;
  title: string;
  source?: string;
  takeaway?: string;
  bodyXml: string;                 // OOXML body fragment
  shapeIds: number[];
}

interface AgentState {
  docxPath: string;
  workDir: string;
  deckTitle?: string;
  maxSlides?: number;
  outputPptxPath?: string;
  userRequest?: string;
  feedback?: string;
  messages: ChatMessage[];
  reportText?: string;
  mediaFiles?: string[];
  summary?: string;
  error?: string;
  outline?: SlideOutline[];
  specs?: SlideSpec[];
  renderedSlides?: RenderedSlide[];
  validationOk?: boolean;
  validationMessages?: string[];
}
```

---

## Các bug đã gặp và đã sửa

1. **LLM trả JSON bọc ```json** → `stripCodeFences()` xử lý
2. **`contentNotes` là object** → `safeStringifyNotes()` ép về string
3. **Node LangGraph trùng tên channel** (`outline`, `specs`) → đổi thành `buildOutline`/`buildSpecs`
4. **P11 thiếu `pattern` field** → prompt thêm + tự inject `pattern: "P11"`
5. **Revise thêm >3 evidence** → nới schema lên 2–5 bullet/≤120 ký tự + tolerant merge
6. **EBUSY file đang mở** → mỗi lần chạy/revise tạo file tên mới (timestamp)
7. **ID trùng giữa title và content** → dùng chung 1 `ShapeIdAllocator` (chrome offset 100000)

---

## Testing

```bash
npm test  # Chạy 20 unit tests
```

- `test/smoke.test.ts` — units, palette, ids, connector geometry, title-fit
- `test/pattern11.test.ts` — hình học connector Pyramid, schema P11 accept/reject, renderer 10 shape ID duy nhất
- **Gate A** chạy ngay trong `pack()` — deck hỏng không thể được sinh ra

---

## License

Private - VNF Internal Use Only
