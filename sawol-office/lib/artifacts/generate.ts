import { GoogleGenAI } from "@google/genai";
import ExcelJS from "exceljs";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { getConfiguredGeminiModel } from "@/lib/ai/gemini-config";
import type { AiTaskResult, SawolAiContext } from "@/lib/ai/types";
import type {
  ArtifactPlan,
  GeneratedArtifact,
} from "@/lib/artifacts/types";

type SheetSpec = {
  name: string;
  columns: string[];
  rows: string[][];
};

type ReportSection = {
  heading: string;
  paragraphs: string[];
  bullets: string[];
};

type FileContentSpec = {
  workbook_title: string;
  sheets: SheetSpec[];
  report_title: string;
  report_subtitle: string;
  executive_summary: string;
  sections: ReportSection[];
  sources: Array<{
    title: string;
    url: string;
    note: string;
  }>;
  limitations: string[];
};

const KOREAN_FONT_URL =
  "https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main/Sans/OTF/Korean/NotoSansCJKkr-Regular.otf";

let fontCache: Uint8Array | null = null;

function textOf(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function metadataText(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function originalRequest(context: SawolAiContext) {
  const root = context.rootTask ?? {};
  const task = context.task ?? {};

  return [
    textOf(root.title) || textOf(task.title),
    textOf(root.description) || textOf(task.description),
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
}

function handoffEvidence(context: SawolAiContext) {
  return (context.handoffs ?? [])
    .map((handoff, index) => {
      const title = textOf(handoff.title);
      const summary = textOf(handoff.summary);
      const content = textOf(handoff.content);

      return [
        `[선행 결과 ${index + 1}]`,
        title ? `제목: ${title}` : "",
        summary ? `요약: ${summary}` : "",
        content ? `내용:\n${content}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

function sourceEvidence(result: AiTaskResult) {
  return (result.sources ?? [])
    .map((source, index) =>
      [
        `[출처 ${index + 1}]`,
        `제목: ${source.title}`,
        `URL: ${source.url}`,
        source.note ? `메모: ${source.note}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
}

function cleanJson(text: string) {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
}

function safeSheetName(name: string, index: number) {
  const normalized = name.replace(/[\\/*?:[\]]/g, " ").trim();
  return (normalized || `Sheet ${index + 1}`).slice(0, 31);
}

function safeFileStem(value: string) {
  const normalized = value
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "");

  return (normalized || "SAWOL_OFFICE_결과").slice(0, 80);
}

function toStringCell(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return metadataText(value);
}

function normalizeSpec(raw: unknown): FileContentSpec {
  const value =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const sheetsRaw = Array.isArray(value.sheets) ? value.sheets : [];
  const sectionsRaw = Array.isArray(value.sections) ? value.sections : [];
  const sourcesRaw = Array.isArray(value.sources) ? value.sources : [];
  const limitationsRaw = Array.isArray(value.limitations)
    ? value.limitations
    : [];

  const sheets: SheetSpec[] = sheetsRaw
    .map((row, index) => {
      const sheet =
        row && typeof row === "object" && !Array.isArray(row)
          ? (row as Record<string, unknown>)
          : {};

      const columns = Array.isArray(sheet.columns)
        ? sheet.columns.map(toStringCell).filter(Boolean).slice(0, 30)
        : [];

      const rows = Array.isArray(sheet.rows)
        ? sheet.rows
            .map((data) =>
              Array.isArray(data)
                ? data.slice(0, columns.length || 30).map(toStringCell)
                : [],
            )
            .filter((data) => data.length)
            .slice(0, 2000)
        : [];

      if (!columns.length) return null;

      return {
        name: safeSheetName(textOf(sheet.name), index),
        columns,
        rows,
      };
    })
    .filter(Boolean) as SheetSpec[];

  const sections: ReportSection[] = sectionsRaw
    .map((row) => {
      const section =
        row && typeof row === "object" && !Array.isArray(row)
          ? (row as Record<string, unknown>)
          : {};

      return {
        heading: textOf(section.heading),
        paragraphs: Array.isArray(section.paragraphs)
          ? section.paragraphs.map(toStringCell).filter(Boolean).slice(0, 8)
          : [],
        bullets: Array.isArray(section.bullets)
          ? section.bullets.map(toStringCell).filter(Boolean).slice(0, 12)
          : [],
      };
    })
    .filter(
      (section) =>
        section.heading || section.paragraphs.length || section.bullets.length,
    )
    .slice(0, 12);

  const sources = sourcesRaw
    .map((row) => {
      const source =
        row && typeof row === "object" && !Array.isArray(row)
          ? (row as Record<string, unknown>)
          : {};

      return {
        title: textOf(source.title),
        url: textOf(source.url),
        note: textOf(source.note),
      };
    })
    .filter((source) => source.title || source.url)
    .slice(0, 60);

  return {
    workbook_title: textOf(value.workbook_title) || "SAWOL OFFICE 데이터",
    sheets,
    report_title: textOf(value.report_title) || "SAWOL OFFICE 대표 보고서",
    report_subtitle: textOf(value.report_subtitle),
    executive_summary: textOf(value.executive_summary),
    sections,
    sources,
    limitations: limitationsRaw
      .map(toStringCell)
      .filter(Boolean)
      .slice(0, 12),
  };
}

async function buildContentSpec({
  context,
  result,
  needsSpreadsheet,
  needsPdf,
}: {
  context: SawolAiContext;
  result: AiTaskResult;
  needsSpreadsheet: boolean;
  needsPdf: boolean;
}) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "ARTIFACT_GEMINI_NOT_CONFIGURED: Excel/PDF 제작용 구조화를 위해 GEMINI_API_KEY가 필요합니다.",
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = getConfiguredGeminiModel();

  const request = originalRequest(context);
  const handoffs = handoffEvidence(context);
  const sources = sourceEvidence(result);

  const prompt = [
    "당신은 SAWOL OFFICE의 파일 제작 편집자입니다.",
    "대표 원문과 이미 완료된 AI 조사/협업 결과만 사용해서 실제 Excel/PDF 파일에 들어갈 구조를 만드세요.",
    "",
    "[대표 원문]",
    request || "-",
    "",
    "[선행 협업 결과]",
    handoffs || "-",
    "",
    "[최종 AI 결과]",
    result.body || result.summary || "-",
    "",
    "[확인된 출처]",
    sources || "-",
    "",
    "[필수 원칙]",
    "- 확인되지 않은 숫자, 주소, 사업명, 상태, URL을 새로 만들지 마세요.",
    "- 자료가 부족하면 임의로 채우지 말고 limitations에 부족한 점을 명시하세요.",
    "- URL은 위 입력에 실제 존재하는 URL만 사용하세요.",
    "- Excel은 실무자가 바로 열어 볼 수 있도록 컬럼명과 행 데이터를 구성하세요.",
    "- PDF는 대표가 바로 읽을 수 있는 요약/섹션/출처 구조로 구성하세요.",
    "- JSON 문자열 안에서만 답하세요. Markdown code fence를 쓰지 마세요.",
    "",
    `[Excel 필요: ${needsSpreadsheet ? "예" : "아니오"}]`,
    `[PDF 필요: ${needsPdf ? "예" : "아니오"}]`,
    "",
    "[반환 JSON 형식]",
    "{",
    '  "workbook_title": "문자열",',
    '  "sheets": [',
    '    { "name": "시트명", "columns": ["열1","열2"], "rows": [["값1","값2"]] }',
    "  ],",
    '  "report_title": "문자열",',
    '  "report_subtitle": "문자열",',
    '  "executive_summary": "문자열",',
    '  "sections": [',
    '    { "heading": "소제목", "paragraphs": ["문단"], "bullets": ["항목"] }',
    "  ],",
    '  "sources": [',
    '    { "title": "출처명", "url": "URL", "note": "무엇을 확인했는지" }',
    "  ],",
    '  "limitations": ["확인하지 못한 사항"]',
    "}",
  ].join("\n");

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      temperature: 0.05,
      maxOutputTokens: 8000,
      responseMimeType: "application/json",
    },
  });

  const responseText = response.text?.trim();

  if (!responseText) {
    throw new Error(
      "ARTIFACT_SPEC_EMPTY: Excel/PDF 제작 구조가 비어 있습니다.",
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(cleanJson(responseText));
  } catch {
    throw new Error(
      "ARTIFACT_SPEC_JSON_INVALID: Excel/PDF 제작 구조를 JSON으로 해석하지 못했습니다.",
    );
  }

  return {
    spec: normalizeSpec(parsed),
    model,
  };
}

async function createWorkbookBuffer(spec: FileContentSpec) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SAWOL OFFICE";
  workbook.company = "SAWOL OFFICE";
  workbook.created = new Date();

  const sheets =
    spec.sheets.length > 0
      ? spec.sheets
      : [
          {
            name: "결과",
            columns: ["항목", "내용"],
            rows: [
              ["요약", spec.executive_summary || "확인된 데이터가 부족합니다."],
            ],
          },
        ];

  for (const [sheetIndex, sheetSpec] of sheets.entries()) {
    const worksheet = workbook.addWorksheet(
      safeSheetName(sheetSpec.name, sheetIndex),
      {
        views: [{ state: "frozen", ySplit: 1 }],
      },
    );

    worksheet.columns = sheetSpec.columns.map((header, index) => ({
      header,
      key: `col_${index}`,
      width: Math.min(45, Math.max(12, header.length * 1.7 + 4)),
    }));

    for (const row of sheetSpec.rows) {
      worksheet.addRow(
        sheetSpec.columns.reduce<Record<string, string>>(
          (acc, _header, index) => {
            acc[`col_${index}`] = row[index] ?? "";
            return acc;
          },
          {},
        ),
      );
    }

    const header = worksheet.getRow(1);
    header.height = 26;
    header.font = {
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    header.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF3157D5" },
    };
    header.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };

    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: Math.max(1, worksheet.rowCount), column: sheetSpec.columns.length },
    };

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.alignment = {
          vertical: "top",
          wrapText: true,
        };
      }

      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFE5E7EB" } },
          left: { style: "thin", color: { argb: "FFE5E7EB" } },
          bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
          right: { style: "thin", color: { argb: "FFE5E7EB" } },
        };
      });
    });
  }

  if (spec.sources.length) {
    const existingNames = new Set(
      workbook.worksheets.map((worksheet) => worksheet.name),
    );
    let name = "출처";
    if (existingNames.has(name)) name = "출처_목록";

    const sheet = workbook.addWorksheet(name, {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    sheet.columns = [
      { header: "출처명", key: "title", width: 34 },
      { header: "URL", key: "url", width: 60 },
      { header: "확인 내용", key: "note", width: 50 },
    ];

    spec.sources.forEach((source) => sheet.addRow(source));

    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF3157D5" },
    };

    sheet.eachRow((row) => {
      row.alignment = { vertical: "top", wrapText: true };
    });
  }

  if (spec.limitations.length) {
    const sheet = workbook.addWorksheet("확인 필요");
    sheet.columns = [
      { header: "구분", key: "type", width: 18 },
      { header: "내용", key: "content", width: 90 },
    ];
    spec.limitations.forEach((content) =>
      sheet.addRow({ type: "자료 한계", content }),
    );
    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF9A7020" },
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

async function fetchKoreanFont() {
  if (fontCache) return fontCache;

  const response = await fetch(KOREAN_FONT_URL, {
    cache: "force-cache",
  });

  if (!response.ok) {
    throw new Error(
      `PDF_FONT_DOWNLOAD_FAILED: 한글 PDF 폰트를 불러오지 못했습니다. HTTP ${response.status}`,
    );
  }

  fontCache = new Uint8Array(await response.arrayBuffer());
  return fontCache;
}

function wrapPdfText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
) {
  const source = text.replace(/\s+/g, " ").trim();
  if (!source) return [""];

  const words = source.split(" ");
  const lines: string[] = [];
  let line = "";

  const pushLongWord = (word: string) => {
    let buffer = "";

    for (const char of Array.from(word)) {
      const candidate = buffer + char;

      if (
        buffer &&
        font.widthOfTextAtSize(candidate, size) > maxWidth
      ) {
        lines.push(buffer);
        buffer = char;
      } else {
        buffer = candidate;
      }
    }

    return buffer;
  };

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;

    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      continue;
    }

    if (line) lines.push(line);

    if (font.widthOfTextAtSize(word, size) > maxWidth) {
      line = pushLongWord(word);
    } else {
      line = word;
    }
  }

  if (line) lines.push(line);
  return lines;
}

async function createPdfBuffer(spec: FileContentSpec) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  const fontBytes = await fetchKoreanFont();
  const font = await pdf.embedFont(fontBytes, {
    subset: true,
  });

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;

  let page: PDFPage = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - 54;

  const ensure = (height: number) => {
    if (y - height >= 54) return;

    page = pdf.addPage([pageWidth, pageHeight]);
    y = pageHeight - 54;
  };

  const drawLines = (
    lines: string[],
    options: {
      size: number;
      lineHeight: number;
      color?: ReturnType<typeof rgb>;
      indent?: number;
      gapAfter?: number;
    },
  ) => {
    for (const line of lines) {
      ensure(options.lineHeight + 6);
      page.drawText(line, {
        x: margin + (options.indent ?? 0),
        y,
        size: options.size,
        font,
        color: options.color ?? rgb(0.18, 0.2, 0.24),
      });
      y -= options.lineHeight;
    }

    y -= options.gapAfter ?? 0;
  };

  drawLines(
    wrapPdfText(spec.report_title, font, 22, contentWidth),
    {
      size: 22,
      lineHeight: 31,
      color: rgb(0.07, 0.1, 0.16),
      gapAfter: 8,
    },
  );

  if (spec.report_subtitle) {
    drawLines(
      wrapPdfText(spec.report_subtitle, font, 10, contentWidth),
      {
        size: 10,
        lineHeight: 16,
        color: rgb(0.42, 0.45, 0.5),
        gapAfter: 18,
      },
    );
  } else {
    y -= 10;
  }

  if (spec.executive_summary) {
    drawLines(["요약"], {
      size: 13,
      lineHeight: 20,
      color: rgb(0.19, 0.34, 0.84),
      gapAfter: 4,
    });
    drawLines(
      wrapPdfText(spec.executive_summary, font, 10.5, contentWidth),
      {
        size: 10.5,
        lineHeight: 18,
        gapAfter: 16,
      },
    );
  }

  for (const section of spec.sections) {
    ensure(70);

    if (section.heading) {
      drawLines(
        wrapPdfText(section.heading, font, 14, contentWidth),
        {
          size: 14,
          lineHeight: 21,
          color: rgb(0.08, 0.11, 0.17),
          gapAfter: 5,
        },
      );
    }

    for (const paragraph of section.paragraphs) {
      drawLines(
        wrapPdfText(paragraph, font, 10, contentWidth),
        {
          size: 10,
          lineHeight: 17,
          gapAfter: 8,
        },
      );
    }

    for (const bullet of section.bullets) {
      const bulletLines = wrapPdfText(
        `• ${bullet}`,
        font,
        10,
        contentWidth - 12,
      );
      drawLines(bulletLines, {
        size: 10,
        lineHeight: 17,
        indent: 8,
        gapAfter: 4,
      });
    }

    y -= 6;
  }

  if (spec.limitations.length) {
    ensure(80);
    drawLines(["확인 필요 / 자료 한계"], {
      size: 13,
      lineHeight: 20,
      color: rgb(0.61, 0.44, 0.12),
      gapAfter: 4,
    });

    for (const limitation of spec.limitations) {
      drawLines(
        wrapPdfText(`• ${limitation}`, font, 9.5, contentWidth - 12),
        {
          size: 9.5,
          lineHeight: 16,
          indent: 8,
          gapAfter: 3,
        },
      );
    }

    y -= 8;
  }

  if (spec.sources.length) {
    ensure(80);
    drawLines(["출처"], {
      size: 13,
      lineHeight: 20,
      color: rgb(0.19, 0.34, 0.84),
      gapAfter: 5,
    });

    spec.sources.forEach((source, index) => {
      const title = `${index + 1}. ${source.title || "출처"}`;

      drawLines(
        wrapPdfText(title, font, 9, contentWidth),
        {
          size: 9,
          lineHeight: 15,
          color: rgb(0.2, 0.22, 0.26),
          gapAfter: 1,
        },
      );

      if (source.note) {
        drawLines(
          wrapPdfText(source.note, font, 8, contentWidth),
          {
            size: 8,
            lineHeight: 13,
            color: rgb(0.4, 0.43, 0.48),
            gapAfter: 1,
          },
        );
      }

      if (source.url) {
        drawLines(
          wrapPdfText(source.url, font, 7.2, contentWidth),
          {
            size: 7.2,
            lineHeight: 12,
            color: rgb(0.19, 0.34, 0.84),
            gapAfter: 5,
          },
        );
      }
    });
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

export function shouldGenerateFileArtifacts(
  context: SawolAiContext,
  plan: ArtifactPlan,
) {
  const task = context.task ?? {};
  const workflowId = textOf(task.workflow_id);
  const parentTaskId = textOf(task.parent_task_id);
  const stepKey = textOf(task.workflow_step_key).toLowerCase();

  const supported = plan.items.some((entry) =>
    ["SPREADSHEET", "PDF"].includes(entry.kind),
  );

  if (!supported) return false;

  if (!workflowId) return true;

  if (!parentTaskId) {
    return false;
  }

  return stepKey === "final";
}

export async function generateRequestedFileArtifacts({
  context,
  result,
  plan,
}: {
  context: SawolAiContext;
  result: AiTaskResult;
  plan: ArtifactPlan;
}): Promise<GeneratedArtifact[]> {
  if (!shouldGenerateFileArtifacts(context, plan)) {
    return [];
  }

  const wantsSpreadsheet = plan.items.some(
    (entry) => entry.kind === "SPREADSHEET",
  );
  const wantsPdf = plan.items.some((entry) => entry.kind === "PDF");

  if (!wantsSpreadsheet && !wantsPdf) return [];

  const { spec, model } = await buildContentSpec({
    context,
    result,
    needsSpreadsheet: wantsSpreadsheet,
    needsPdf: wantsPdf,
  });

  const request = originalRequest(context);
  const stem = safeFileStem(
    request.split("\n")[0] ||
      spec.report_title ||
      spec.workbook_title ||
      "SAWOL_OFFICE_결과",
  );

  const artifacts: GeneratedArtifact[] = [];

  if (wantsSpreadsheet) {
    const buffer = await createWorkbookBuffer(spec);

    artifacts.push({
      id: `xlsx-${Date.now()}`,
      kind: "SPREADSHEET",
      format: "xlsx",
      label: spec.workbook_title || "Excel 통합문서",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileName: `${stem}.xlsx`,
      sizeBytes: buffer.byteLength,
      dataBase64: buffer.toString("base64"),
      metadata: {
        generator: "exceljs",
        planner_model: model,
        sheets: spec.sheets.map((sheet) => ({
          name: sheet.name,
          row_count: sheet.rows.length,
          column_count: sheet.columns.length,
        })),
      },
    });
  }

  if (wantsPdf) {
    const buffer = await createPdfBuffer(spec);

    artifacts.push({
      id: `pdf-${Date.now()}`,
      kind: "PDF",
      format: "pdf",
      label: spec.report_title || "대표 보고서",
      mimeType: "application/pdf",
      fileName: `${stem}_대표보고.pdf`,
      sizeBytes: buffer.byteLength,
      dataBase64: buffer.toString("base64"),
      metadata: {
        generator: "pdf-lib",
        planner_model: model,
        section_count: spec.sections.length,
        source_count: spec.sources.length,
      },
    });
  }

  return artifacts;
}
