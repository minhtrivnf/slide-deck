/**
 * patterns/p3_data_table.ts
 *
 * Renders Pattern 3 (Data Table) as a real DrawingML `<a:tbl>` inside a
 * `<p:graphicFrame>` — not stacked rects — so the deck gets true table
 * semantics (selectable/resizable in PowerPoint).
 *
 * Geometry from slide_patterns.md P3: frame (457200, 1651000,
 * 8229600 × 4000000), header row 400000, data rows 350000. Column widths
 * are distributed uniformly (doc's 4-col split 2000000×3 + 2229600 is the
 * uniform distribution of 8229600/4 within rounding).
 *
 * Styling per slide_specs.md table rules: header row navy `002060` fill +
 * white bold 12pt; data rows alternate `F5F5FF`/`FFFFFF`, 11pt body text;
 * optional totalRow gets white bold on `0070C0`.
 */

import { ShapeIdAllocator } from "../ids.js";
import { BRAND } from "../palette.js";
import { escapeXmlText } from "../xml.js";
import { Pattern3DataTableSpecSchema, type Pattern3DataTableSpec } from "../types.js";

const TABLE_X = 457200;
const TABLE_Y = 1651000;
const TABLE_CX = 8229600;
const HEADER_H = 400000;
const ROW_H = 350000;

export interface RenderedDataTable {
  bodyXml: string;
  shapeIds: number[];
}

function tc(text: string, opts: { bold?: boolean; white?: boolean; fillHex: string }): string {
  const { bold = false, white = false, fillHex } = opts;
  return `<a:tc>
      <a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="l"/><a:r><a:rPr lang="en-US" sz="${bold ? 1200 : 1100}" b="${bold ? 1 : 0}" dirty="0"><a:solidFill><a:srgbClr val="${white ? BRAND.white : BRAND.bodyText}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${escapeXmlText(text)}</a:t></a:r></a:p></a:txBody>
      <a:tcPr marL="91440" marR="45720" marT="22860" marB="22860" anchor="ctr"><a:solidFill><a:srgbClr val="${fillHex}"/></a:solidFill></a:tcPr>
    </a:tc>`;
}

export function renderPattern3DataTable(rawSpec: unknown, slideNumber: number): RenderedDataTable {
  const spec: Pattern3DataTableSpec = Pattern3DataTableSpecSchema.parse(rawSpec);
  const ids = new ShapeIdAllocator(slideNumber);

  const nCols = spec.headers.length;
  spec.rows.forEach((row, i) => {
    if (row.length !== nCols) {
      throw new Error(`P3 row ${i} has ${row.length} cells but table has ${nCols} headers`);
    }
  });
  const colW = Math.floor(TABLE_CX / nCols);

  const headerRow = `    <a:tr h="${HEADER_H}">
    ${spec.headers.map((h) => tc(h, { bold: true, white: true, fillHex: BRAND.navyDam })).join("\n    ")}
  </a:tr>`;

  const dataRows = spec.rows
    .map((row, i) => {
      const isTotal = spec.totalRow && i === spec.rows.length - 1;
      const fill = isTotal ? BRAND.xanhSang : i % 2 === 0 ? "F5F5FF" : BRAND.white;
      return `    <a:tr h="${ROW_H}">
    ${row.map((c) => tc(c, { bold: isTotal, white: isTotal, fillHex: fill })).join("\n    ")}
  </a:tr>`;
    })
    .join("\n");

  const tableId = ids.alloc();
  const bodyXml = `<p:graphicFrame>
  <p:nvGraphicFramePr>
    <p:cNvPr id="${tableId}" name="DataTable"/>
    <p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr>
    <p:nvPr/>
  </p:nvGraphicFramePr>
  <p:xfrm><a:off x="${TABLE_X}" y="${TABLE_Y}"/><a:ext cx="${TABLE_CX}" cy="${HEADER_H + spec.rows.length * ROW_H}"/></p:xfrm>
  <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">
    <a:tbl>
      <a:tblPr firstRow="0" bandRow="0"/>
      <a:tblGrid>${Array.from({ length: nCols }, (_, i) => `<a:gridCol w="${i === nCols - 1 ? TABLE_CX - colW * (nCols - 1) : colW}"/>`).join("")}</a:tblGrid>
${headerRow}
${dataRows}
    </a:tbl>
  </a:graphicData></a:graphic>
</p:graphicFrame>`;

  return { bodyXml, shapeIds: [tableId] };
}

export const __internalP3 = { TABLE_X, TABLE_Y, TABLE_CX, HEADER_H, ROW_H };

