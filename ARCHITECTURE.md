# VNF Slide-Deck Generator — Giải thích toàn bộ code & luồng hoạt động

Tài liệu này giải thích toàn bộ codebase hiện tại (`vnf-pptx-toolkit-phase1-2`) và luồng chạy từ khi user nhắn tin đến khi ra file `.pptx`.

---

## 1. Tổng quan

Ứng dụng chuyển một file **Word (.docx)** thành **PowerPoint (.pptx)** theo chuẩn thương hiệu VNF (consultancy grade: action title, pyramid principle, so-what takeaway, source line). Được port từ skill `vnf-slidedeck-generator` (zip) sang TypeScript + LangGraph.

**Nguyên tắc thiết kế (quan trọng):**

- **LLM chỉ làm việc có "phán đoán"** (hiểu yêu cầu, tóm tắt, chọn cấu trúc, viết nội dung).
- **Mọi thứ "cơ học" là code deterministic** (hình học EMU, màu, ID, nối connector, validate XML) — để LLM không bao giờ tự bịa toạ độ hay ID trùng.

**Tech stack:**

| Thành phần | Công nghệ |
|---|---|
| Ngôn ngữ | TypeScript (ESM), Node ≥ 20 |
| Orchestration | `@langchain/langgraph` (StateGraph) |
| LLM | OpenAI-compatible HTTP adapter (Mistral, cấu hình qua `.env`) |
| Đọc docx | `mammoth` + `jszip` |
| Xử lý XML | `@xmldom/xmldom` |
| Validate dữ liệu LLM | `zod` |

---

## 2. Kiến trúc tổng thể & luồng chạy

### 2.1 Sơ đồ pipeline

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

### 2.2 Các node trong graph

| Node | Loại | Việc làm | Ghi chú |
|---|---|---|---|
| `extract` | deterministic | Đọc `.docx` → `reportText` + `mediaFiles` | dùng mammoth |
| `summarize` | **LLM** | Tóm tắt report (≤60.000 ký tự) thành brief 5 mục | bước này tránh mất nội dung cuối báo cáo |
| `buildOutline` | **LLM** | Brief → mảng `SlideOutline[]` (chọn pattern, action title, source, takeaway, contentNotes) | số slide do nội dung quyết định |
| `buildSpecs` | **LLM** | Mỗi outline entry → 1 `SlideSpec` có cấu trúc (P11 dùng schema riêng, còn lại `PatternContent`) | validate bằng Zod, lỗi → ném |
| `revise` | **LLM** | Feedback của user + brief → mảng specs **đầy đủ** mới | slide lỗi giữ bản cũ (tolerant) |
| `render` | deterministic | Specs → XML body của từng slide | `renderSlides` |
| `pack` | deterministic | Unpack template, chèn slide, cập nhật rels/`[Content_Types]`, Gate A, đóng zip | `DeckAssembler` |

**Điểm khởi đầu (START):**
- `state.feedback` có giá trị → đi thẳng `revise` (turn phản hồi).
- ngược lại → `extract` (build lần đầu).

**Mọi node đều bọc `withErrorHandling`**: nếu node lỗi → set `state.error` → conditional edge `route()` trả về `END`.

### 2.3 Số lần gọi LLM cho 1 deck

```
intake (1) + summarize (1) + outline (1) + specs (N slide)   →  deck lần đầu
revise (1)                                                  →  mỗi lượt feedback
```

---

## 3. Từng file — giải thích chi tiết

### 3.1 `src/cli.ts` — giao diện hội thoại

Entry point (`node dist/src/cli.js`, script `npm run dev`).

1. **`loadEnv()`** — đọc `.env`, bắt buộc có `AI_API_URL`, `AI_API_KEY`, `MODEL`.
2. **Chọn đường vào:**
   - `npm run dev -- <path.docx>` → dùng thẳng path (không hỏi gì).
   - TTY (chạy tay) → **`chatIntake(llm)`**: agent (LLM) tự hiểu tin nhắn tự nhiên của user — file nào, yêu cầu gì. Không bắt cú pháp.
   - Piped stdin → `scriptedMode()`: dòng 1 = path, dòng 2 = yêu cầu.
3. **Tạo tên file duy nhất** mỗi lần chạy:
   - `runId = stamp()` (ví dụ `20260805-143012`)
   - `workDir = .vnf-deck-<base>-<runId>` — thư mục unpack tạm.
   - `outputPptxPath = uniqueOutputPath(dir, base, "slides")` — `<base>-slides-<stamp>.pptx`.
   - → tránh EBUSY khi file cũ đang mở trong PowerPoint, tránh ghi đè.
4. **`buildDeck({ docxPath, workDir, deckTitle, outputPptxPath, userRequest, llm })`**.
5. **`printResult()`** — in số slide, đường dẫn, Gate A, outline.
6. **Vòng lặp feedback (TTY):** hỏi "Bạn muốn bổ sung / sửa gì không?", gọi `reviseDeck(current, feedback, nextOut)` với **tên file mới mỗi lượt**; Enter trống → kết thúc.

### 3.2 `src/agent/graph.ts` — pipeline LangGraph

- Khai báo **7 node** + **các channel (state)**: `docxPath`, `workDir`, `deckTitle`, `maxSlides`, `outputPptxPath`, `userRequest`, `feedback`, `messages`, `reportText`, `mediaFiles`, `summary`, `error`, `outline`, `specs`, `renderedSlides`, `validationOk`, `validationMessages`.
  - **Lưu ý bug đã gặp:** node không được trùng tên channel — node `outline`/`specs` bị đổi thành `buildOutline`/`buildSpecs`.
- **`resolveTemplatePath()`** — tìm template `assets/vnf_slide_template.pptx` theo nhiều vị trí fallback.
- **`buildDeck(options)`** — `setLLM()` + khởi tạo state + `app.invoke(initialState)`.
- **`reviseDeck(prevState, feedback, outputPptxPath?)`** — giữ nguyên state cũ, chỉ thêm `feedback` + đổi `outputPptxPath` (file mới), invoke lại graph (đi từ `revise`).
- **`setLLM`/`getLLM`** — lưu LLM process-wide (context.ts) để tránh circular import.

Các node quan trọng:
- `outlineNode` dùng `state.summary ?? state.reportText` làm input cho outliner (ưu tiên brief đã tóm tắt).
- `renderNode` gọi `renderSlides(3, state.specs!)` — bắt đầu đánh số slide từ 3 (1=cover, 2=layout placeholder của template).
- `packNode` dựng `DeckAssembler`, set cover title, thêm từng slide, đóng gói, lấy kết quả Gate A.

### 3.3 `src/agent/intake.ts` — hiểu tin nhắn tự nhiên

- **`scanDocx(roots, limit=15)`** — quét đệ quy (tối đa 4 cấp) tìm `*.docx`, sắp theo ngày sửa gần nhất.
- **`understandIntent(llm, { userMessage, availableDocs })`** — gửi prompt cho LLM kèm danh sách file tìm thấy, yêu cầu trả JSON `{ docxPath, userRequest, message }`:
  - đường dẫn rõ ràng → dùng luôn;
  - "file này / file mới nhất / báo cáo X" → LLM khớp với danh sách;
  - không xác định được → `needDocx: true` → CLI hỏi lại (tự nhiên, không bắt cú pháp).
- Là "câu chuyện" được agent hiểu, thay vì regex bắt ký tự `path | request`.

### 3.4 `src/agent/docx.ts` — đọc file Word

- `extractReport(docxPath)` dùng **mammoth** `extractRawText` → `markdown` (text thô), `text` (dẹp thành 1 dòng cho gọn), và `mediaFiles` (liệt kê `word/media/*` trong zip bằng jszip).

### 3.5 `src/agent/summarize.ts` — tóm tắt nội dung (LLM)

- `summarizeReport({ llm, reportText, userRequest, maxChars=60000 })` — cắt report tối đa 60.000 ký tự, yêu cầu LLM xuất brief Markdown 5 mục: Executive summary, Key findings & data, Structure, Risks/gaps/recommendations, Suggested storyline.
- **Chỉ thị ngôn ngữ:** brief phải viết **cùng ngôn ngữ với file nguồn** (docx tiếng Việt → brief tiếng Việt).

### 3.6 `src/agent/outliner.ts` — lập outline (LLM)

- `generateOutline({ llm, reportText, deckTitle, userRequest, maxSlides=20 })`.
- Prompt liệt kê **24 pattern** (P1–P24), yêu cầu:
  - số slide do nội dung tự quyết (cap 20);
  - mỗi slide 1 pattern, action title là câu kết luận (≤100 ký tự);
  - **cùng ngôn ngữ với báo cáo**;
  - `contentNotes` là **chuỗi text phẳng** (bug đã sửa: LLM hay trả object/array → ép về string).
- **`stripCodeFences()`** — bóc ```json``` quanh JSON (bug đã sửa). Parse JSON rồi lọc/chuẩn hoá thành `SlideOutline[]`.

### 3.7 `src/agent/specs.ts` — sinh spec cho từng slide (LLM)

- `generateSpecs({ llm, outline })` — gọi LLM **mỗi slide**:
  - **P11** → prompt Pyramid, validate `Pattern11PyramidSpecSchema` (bắt buộc `pattern: "P11"` + `governingThought` + đúng 3 arguments; code tự inject `pattern` nếu LLM quên).
  - **còn lại** → `makeContentSpec` với bảng hướng dẫn `PATTERN_GUIDANCE` (P1 dùng `stats`, P3/P21 dùng `matrix`, P4/P17/P24 dùng `steps`, P6/P13 dùng `quadrants`, P8 dùng `quote`, P9/P12 dùng `bars`, P10/P19 dùng `pillars`, P22/P23 dùng `items`…), validate `PatternContentSchema`.
- **Chỉ thị ngôn ngữ** trong cả 2 prompt.

### 3.8 `src/agent/pattern_spec.ts` — schema nội dung chung

- `PatternContentSchema` (zod): `title`, `source`, `takeaway`, `items[]`, `stats[]`, `bars[]`, `steps[]`, `quadrants[]`, `pillars[]`, `quote`/`quoteSource`, `matrix[][]`. LLM chỉ điền field cần cho pattern đó.

### 3.9 `src/agent/revise.ts` — vòng phản hồi (LLM)

- `reviseSpecs({ llm, outline, specs, feedback, summary })` — prompt gồm:
  - specs hiện tại (JSON đầy đủ),
  - **REPORT CONTENT BRIEF** (summary) làm nguồn để "bổ sung nội dung" bằng dữ liệu thật,
  - feedback của user.
- LLM trả **toàn bộ mảng specs mới**. Tolerant merge: slide nào validate lỗi → **giữ bản cũ**, slide dư không hợp lệ → bỏ (không chết cả turn).

### 3.10 `src/agent/renderer.ts` — render slide (deterministic)

- `renderSlides(slideNumberBase=3, specs)` → `RenderedSlide[]`:
  - **P11** → `renderPattern11Pyramid` (thật, có connector).
  - **P7** (layer divider) → layout toàn vùng (title lớn giữa slide, không action-title ở trên).
  - **còn lại** → `renderContentSlide`: action title (y=0, font 24/20 theo quy tắc 80/100 ký tự) + vùng content (3.4→15cm) + source line (y=15.1cm) + tagline takeaway (y=16.2cm).
- **Dùng chung 1 `ShapeIdAllocator`** cho cả title + content → ID không trùng (bug đã sửa).

### 3.11 `src/patterns/content_layouts.ts` — bộ layout content (deterministic)

Bảng layout theo pattern (đều đọc từ `PatternContent`):

| Pattern | Layout | Field dùng |
|---|---|---|
| P1, P2 | Thẻ số liệu (card) | `stats` |
| P3, P21 | Bảng dữ liệu | `matrix` |
| P4, P16, P17, P24 | Dãy bước (steps) | `steps` |
| P5, P20 | Lưới 2×2 | `items` |
| P6, P13 | Ma trận 4 ô (SWOT/BCG) | `quadrants` |
| P7 | Divider (title lớn) | `title`/`items` |
| P8 | Quote lớn | `quote`/`quoteSource` |
| P9, P12 | Cột ngang (bar) | `bars` |
| P10, P19 | 3 cột trụ (pillar) | `pillars` |
| P14, P18 | Thẻ số (harvey/radar) | `stats` |
| P22, P23 | Danh sách đánh số / gạch đầu dòng | `items` |
| fallback | Gạch đầu dòng | `items` |

Mọi layout nằm trong khung an toàn (content 3.4–15cm, không chạm band 17.5–18.2cm của master), dùng `categoricalColor`, `SEMANTIC` để tô màu brand.

### 3.12 `src/patterns/p11_pyramid.ts` — Pattern 11 (Pyramid)

- Geometry phiên âm từ `references/slide_patterns.md`: 1 box governing-thought trên (rộng 5486400 EMU), 3 box argument giữa, 3 box evidence dưới, 3 connector.
- **Connector**: `renderStraightConnector` dùng `connectorGeom` — `flipH`/`flipV` tính tự động, không để LLM tự quyết (nguồn gốc bug "wrong-direction").

### 3.13 `src/agent/assembler.ts` — đóng gói pptx

`DeckAssembler(templatePath, workDir)`:
1. **`init()`** — unpack template (jszip) ra `workDir`.
2. **`setCoverTitle()`** — thay `[Slide Title]` trong `slide1.xml` bằng title deck.
3. **`addSlide(slideNumber, bodyXml)`** — tạo `slideN.xml` (bọc `<p:spTree>` theo layout Content `slideLayout2`), viết `_rels/slideN.xml.rels`, đăng ký vào `presentation.xml` (sldId ≥ 256) + `presentation.xml.rels` (rId mới) + `[Content_Types].xml` (Override).
4. **`pack(outputPath)`** — chạy **Gate A** (`validateUnpacked`) trước khi đóng zip; lỗi → throw.

ID đều qua `SldIdAllocator`/`RidAllocator` → không thể trùng.

### 3.14 `src/agent/llm.ts` + `src/agent/context.ts` — LLM adapter

- `createHttpLLM({ apiUrl, apiKey, model })` — POST `${base}/chat/completions`, `Authorization: Bearer`, timeout 120s, temperature 0.2.
  - `invoke(prompt)` → text (dùng cho mọi bước hiện tại).
  - `invokeMessages(messages, tools?)` — hỗ trợ tool-calling (giữ lại từ kiến trúc ReAct cũ, hiện graph không dùng).
- `context.ts`: `setLLM`/`getLLM` process-wide.

### 3.15 Tầng "primitives" deterministic

| File | Nội dung |
|---|---|
| `src/units.ts` | Quy đổi EMU (`cmToEmu`, `ptToEmu`), lưới 12 cột (`gridSpan`), zone dọc (`ZONES`), luật title 80/100 ký tự (`resolveActionTitleFit`), chống chạm band master (`assertNoMasterBandCollision`) |
| `src/palette.ts` | `BRAND` (15 màu), `SEMANTIC` (5 cặp dark/light), `CATEGORICAL_8`, `SEQUENTIAL_5`, `harveyBall`, `GLYPHS` |
| `src/ids.ts` | `ShapeIdAllocator` (base = `(slide-1)*100+1`), `RidAllocator`, `SldIdAllocator` (bắt đầu 256) |
| `src/xml.ts` | `escapeXmlText` / `escapeXmlAttr` |
| `src/templates/common.ts` | `renderFilledTextBox` (hộp văn bản + fill/border/roundRect), `renderBulletListBox` (danh sách bullet) |
| `src/geometry/connectors.ts` | `connectorGeom(a,b)` (off/ext/flipH/flipV), `renderStraightConnector` với `<a:stCxn>/<a:endCxn>` |
| `src/validator.ts` | **Gate A** — port từ `validate_pptx_unpacked.py` |

### 3.16 `src/validator.ts` — Gate A (6 kiểm tra)

1. Không trùng `<p:cNvPr id>` trong từng slide.
2. Mỗi `slideN.xml` có `_rels/slideN.xml.rels`.
3. Không trùng `rId` trong `presentation.xml.rels`.
4. Không trùng `sldId`, mọi `sldId ≥ 256`, `r:id` phải resolve được.
5. Mọi file `.rels`: target tồn tại trên disk, không trùng rId.
6. `[Content_Types].xml` tồn tại và parse được.

### 3.17 `src/types.ts` — schema P11

- `Pattern11PyramidSpecSchema`: `pattern: literal("P11")`, `governingThought` (1–160 ký tự), `arguments` **đúng 3**, mỗi argument: `label` (≤60) + `evidence` (**2–5** bullet, mỗi bullet ≤120).

### 3.18 `src/index.ts`

Export toàn bộ public API (units, palette, ids, xml, types, connectors, common, p11, validator, graph, agent types) — dùng khi import package từ bên ngoài.

---

## 4. Data model chính (`src/agent/types.ts`)

```ts
interface SlideOutline {            // 1 dòng outline
  slideNumber: number;
  pattern: SlidePattern;            // "P11" | "P1".."P24"
  title: string;                    // action title
  source?: string; takeaway?: string;
  contentNotes: string;             // text phẳng
}

type SlideSpec =
  | { pattern: "P11"; spec: Pattern11PyramidSpec }
  | { pattern: Exclude<SlidePattern,"P11">; spec: PatternContent };

interface RenderedSlide {           // đầu ra của render
  slideNumber: number; pattern: SlidePattern; title: string;
  source?; takeaway?; bodyXml: string; shapeIds: number[];
}

interface AgentState {              // state graph
  docxPath; workDir; deckTitle?; maxSlides?; outputPptxPath?;
  userRequest?; feedback?; messages: ChatMessage[];
  reportText?; mediaFiles?; summary?; error?;
  outline?; specs?; renderedSlides?;
  validationOk?; validationMessages?;
}
```

`LLM` interface: `invoke(prompt)` + `invokeMessages(...)` (tool-calling).

---

## 5. Luồng dữ liệu chi tiết (end-to-end)

```
User: "làm slide từ file báo cáo trong D:\VNF"
  │
  ▼  chatIntake (LLM)
{ docxPath: "D:\VNF\report-2026-07-25-1784960730069.docx", userRequest: "..." }
  │
  ▼  buildDeck
extract  →  { reportText, mediaFiles }
summarize→  { summary }              (tiếng Việt, 5 mục)
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

## 6. Testing

- `npm test` → `node --test dist/test/*.test.js` (hiện **20/20**):
  - `test/smoke.test.ts` — units, palette, ids, connector geometry, title-fit.
  - `test/pattern11.test.ts` — hình học connector Pyramid khớp ví dụ số trong doc, schema P11 accept/reject, renderer 10 shape ID duy nhất.
- **Gate A** chạy ngay trong `pack()` — deck hỏng không thể được sinh ra.
- Gate B (python-pptx / LibreOffice) chưa cài trên máy — user mở PowerPoint kiểm tra.

---

## 7. Cấu hình & lệnh

`.env` (đã có):
```
AI_API_URL=https://api.mistral.ai/v1/
AI_API_KEY=...
MODEL=codestral-2508
```

| Lệnh | Ý nghĩa |
|---|---|
| `npm run build` | compile TS → `dist/` |
| `npm run dev` | build + chạy CLI interactive (chat) |
| `npm run dev -- <path.docx>` | build deck ngay, không hỏi |
| `npm test` | chạy 20 unit tests |

---

## 8. Các bug đã gặp và đã sửa (tham khảo lịch sử)

1. **LLM trả JSON bọc ```json** → `stripCodeFences`.
2. **`contentNotes` là object** → ép về string (`safeStringifyNotes`).
3. **Node LangGraph trùng tên channel** (`outline`, `specs`) → đổi thành `buildOutline`/`buildSpecs`.
4. **P11 thiếu `pattern` field** → prompt thêm + tự inject `pattern: "P11"`.
5. **Revise thêm >3 evidence** → nới schema lên 2–5 bullet/≤120 ký tự + tolerant merge.
6. **EBUSY file đang mở** → mỗi lần chạy/revise tạo file tên mới (timestamp).
7. **ID trùng giữa title và content** → dùng chung 1 `ShapeIdAllocator`.
