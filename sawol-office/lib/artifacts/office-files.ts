import { GoogleGenAI } from "@google/genai";
import { getConfiguredGeminiModel } from "@/lib/ai/gemini-config";
import type { AiTaskResult, SawolAiContext } from "@/lib/ai/types";
import type { ArtifactPlan, GeneratedArtifact } from "@/lib/artifacts/types";

type Section = { heading: string; paragraphs: string[]; bullets: string[] };
type TableSpec = { title: string; columns: string[]; rows: string[][] };
type SlideSpec = { title: string; subtitle: string; bullets: string[]; note: string };
type UniversalSpec = {
  title: string;
  subtitle: string;
  executive_summary: string;
  sections: Section[];
  tables: TableSpec[];
  slides: SlideSpec[];
  sources: Array<{ title: string; url: string; note: string }>;
  limitations: string[];
};

type ZipEntry = { name: string; data: Buffer };

function textOf(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function originalRequest(context: SawolAiContext) {
  const root = context.rootTask ?? {};
  const task = context.task ?? {};
  return [
    textOf(root.title) || textOf(task.title),
    textOf(root.description) || textOf(task.description),
  ].filter(Boolean).join("\n").trim();
}

function handoffEvidence(context: SawolAiContext) {
  return (context.handoffs ?? []).map((row, index) => {
    const title = textOf(row.title);
    const summary = textOf(row.summary);
    const content = textOf(row.content);
    return [`[선행 결과 ${index + 1}]`, title, summary, content].filter(Boolean).join("\n");
  }).filter(Boolean).join("\n\n");
}

function cleanJson(text: string) {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
}

function safeStem(value: string) {
  return (value.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, "_").replace(/^_+|_+$/g, "") || "SAWOL_OFFICE_결과").slice(0, 76);
}

function cell(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try { return JSON.stringify(value); } catch { return String(value); }
}

function normalize(raw: unknown): UniversalSpec {
  const value = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const sections = (Array.isArray(value.sections) ? value.sections : []).map((row) => {
    const v = row && typeof row === "object" && !Array.isArray(row) ? row as Record<string, unknown> : {};
    return {
      heading: textOf(v.heading),
      paragraphs: (Array.isArray(v.paragraphs) ? v.paragraphs : []).map(cell).filter(Boolean).slice(0, 10),
      bullets: (Array.isArray(v.bullets) ? v.bullets : []).map(cell).filter(Boolean).slice(0, 16),
    };
  }).filter((v) => v.heading || v.paragraphs.length || v.bullets.length).slice(0, 18);

  const tables = (Array.isArray(value.tables) ? value.tables : []).map((row) => {
    const v = row && typeof row === "object" && !Array.isArray(row) ? row as Record<string, unknown> : {};
    const columns = (Array.isArray(v.columns) ? v.columns : []).map(cell).filter(Boolean).slice(0, 24);
    const rows = (Array.isArray(v.rows) ? v.rows : []).map((r) => Array.isArray(r) ? r.slice(0, columns.length || 24).map(cell) : []).filter((r) => r.length).slice(0, 2000);
    return { title: textOf(v.title), columns, rows };
  }).filter((v) => v.columns.length).slice(0, 12);

  const slides = (Array.isArray(value.slides) ? value.slides : []).map((row) => {
    const v = row && typeof row === "object" && !Array.isArray(row) ? row as Record<string, unknown> : {};
    return {
      title: textOf(v.title),
      subtitle: textOf(v.subtitle),
      bullets: (Array.isArray(v.bullets) ? v.bullets : []).map(cell).filter(Boolean).slice(0, 7),
      note: textOf(v.note),
    };
  }).filter((v) => v.title || v.subtitle || v.bullets.length).slice(0, 20);

  const sources = (Array.isArray(value.sources) ? value.sources : []).map((row) => {
    const v = row && typeof row === "object" && !Array.isArray(row) ? row as Record<string, unknown> : {};
    return { title: textOf(v.title), url: textOf(v.url), note: textOf(v.note) };
  }).filter((v) => v.title || v.url).slice(0, 80);

  return {
    title: textOf(value.title) || "SAWOL OFFICE 결과 보고",
    subtitle: textOf(value.subtitle),
    executive_summary: textOf(value.executive_summary),
    sections,
    tables,
    slides,
    sources,
    limitations: (Array.isArray(value.limitations) ? value.limitations : []).map(cell).filter(Boolean).slice(0, 20),
  };
}

async function buildSpec(context: SawolAiContext, result: AiTaskResult, plan: ArtifactPlan) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("ARTIFACT_GEMINI_NOT_CONFIGURED: 범용 파일 제작용 GEMINI_API_KEY가 필요합니다.");
  const ai = new GoogleGenAI({ apiKey });
  const model = getConfiguredGeminiModel();
  const requested = plan.items.map((item) => `${item.kind}/${item.format}`).join(", ");
  const sources = (result.sources ?? []).map((source, i) => `[출처 ${i + 1}] ${source.title}\n${source.url}\n${source.note || ""}`).join("\n\n");
  const prompt = [
    "당신은 SAWOL OFFICE의 범용 산출물 편집자입니다.",
    "대표 원문, 선행 협업 결과, 최종 AI 결과와 확인된 출처만 재구성하세요.",
    "새 사실·숫자·URL을 만들지 마세요. 자료가 부족하면 limitations에 명시하세요.",
    `요청 산출물: ${requested}`,
    "",
    "[대표 원문]", originalRequest(context) || "-",
    "", "[선행 협업 결과]", handoffEvidence(context) || "-",
    "", "[최종 AI 결과]", result.body || result.summary || "-",
    "", "[확인된 출처]", sources || "-",
    "",
    "JSON만 반환하세요.",
    '{"title":"","subtitle":"","executive_summary":"","sections":[{"heading":"","paragraphs":[""],"bullets":[""]}],"tables":[{"title":"","columns":[""],"rows":[[""]]}],"slides":[{"title":"","subtitle":"","bullets":[""],"note":""}],"sources":[{"title":"","url":"","note":""}],"limitations":[""]}',
  ].join("\n");
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: { temperature: 0.05, maxOutputTokens: 10000, responseMimeType: "application/json" },
  });
  const raw = response.text?.trim();
  if (!raw) throw new Error("ARTIFACT_SPEC_EMPTY: 범용 산출물 구조가 비어 있습니다.");
  let parsed: unknown;
  try { parsed = JSON.parse(cleanJson(raw)); } catch { throw new Error("ARTIFACT_SPEC_JSON_INVALID: 범용 산출물 JSON 해석에 실패했습니다."); }
  return { spec: normalize(parsed), model };
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

function zipStore(entries: ZipEntry[]) {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  const { time, day } = dosDateTime();
  for (const entry of entries) {
    const name = Buffer.from(entry.name.replace(/\\/g, "/"), "utf8");
    const data = entry.data;
    const crc = crc32(data);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(0, 8);
    local.writeUInt16LE(time, 10); local.writeUInt16LE(day, 12); local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28); name.copy(local, 30);
    locals.push(local, data);
    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(0, 10);
    central.writeUInt16LE(time, 12); central.writeUInt16LE(day, 14); central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28); central.writeUInt16LE(0, 30); central.writeUInt16LE(0, 32); central.writeUInt16LE(0, 34); central.writeUInt16LE(0, 36); central.writeUInt32LE(0, 38); central.writeUInt32LE(offset, 42); name.copy(central, 46);
    centrals.push(central); offset += local.length + data.length;
  }
  const centralSize = centrals.reduce((sum, b) => sum + b.length, 0);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16); end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, ...centrals, end]);
}

function xml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function markdown(spec: UniversalSpec) {
  const lines = [`# ${spec.title}`];
  if (spec.subtitle) lines.push("", spec.subtitle);
  if (spec.executive_summary) lines.push("", "## 요약", "", spec.executive_summary);
  for (const section of spec.sections) {
    lines.push("", `## ${section.heading || "내용"}`);
    for (const p of section.paragraphs) lines.push("", p);
    for (const b of section.bullets) lines.push(`- ${b}`);
  }
  if (spec.limitations.length) lines.push("", "## 확인 필요", ...spec.limitations.map((v) => `- ${v}`));
  if (spec.sources.length) lines.push("", "## 출처", ...spec.sources.map((v, i) => `${i + 1}. ${v.title || "출처"}${v.note ? ` — ${v.note}` : ""}\n   ${v.url}`));
  return lines.join("\n").trim() + "\n";
}

function csvEscape(value: string) { return `"${value.replace(/"/g, '""')}"`; }
function csvFromSpec(spec: UniversalSpec) {
  const table = spec.tables[0];
  if (!table) return `항목,내용\n${csvEscape("요약")},${csvEscape(spec.executive_summary || "확인된 표 데이터가 없습니다.")}\n`;
  return [table.columns.map(csvEscape).join(","), ...table.rows.map((row) => table.columns.map((_, i) => csvEscape(row[i] ?? "")).join(","))].join("\r\n") + "\r\n";
}

function docxParagraph(text: string, style?: string, bullet = false) {
  return `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/>${bullet ? '<w:ind w:left="360" w:hanging="180"/>' : ''}</w:pPr>` : bullet ? '<w:pPr><w:ind w:left="360" w:hanging="180"/></w:pPr>' : ''}<w:r><w:rPr><w:lang w:val="ko-KR"/></w:rPr><w:t xml:space="preserve">${xml(bullet ? `• ${text}` : text)}</w:t></w:r></w:p>`;
}

function createDocx(spec: UniversalSpec) {
  const body: string[] = [docxParagraph(spec.title, "Title")];
  if (spec.subtitle) body.push(docxParagraph(spec.subtitle, "Subtitle"));
  if (spec.executive_summary) { body.push(docxParagraph("요약", "Heading1"), docxParagraph(spec.executive_summary)); }
  for (const section of spec.sections) {
    body.push(docxParagraph(section.heading || "내용", "Heading1"));
    section.paragraphs.forEach((p) => body.push(docxParagraph(p)));
    section.bullets.forEach((b) => body.push(docxParagraph(b, undefined, true)));
  }
  if (spec.limitations.length) { body.push(docxParagraph("확인 필요", "Heading1")); spec.limitations.forEach((v) => body.push(docxParagraph(v, undefined, true))); }
  if (spec.sources.length) { body.push(docxParagraph("출처", "Heading1")); spec.sources.forEach((v, i) => body.push(docxParagraph(`${i + 1}. ${v.title || "출처"}${v.note ? ` — ${v.note}` : ""}\n${v.url}`))); }
  body.push('<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>');
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join("")}</w:body></w:document>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Malgun Gothic"/><w:sz w:val="20"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="36"/><w:color w:val="1F3A5F"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:rPr><w:sz w:val="22"/><w:color w:val="64748B"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="26"/><w:color w:val="3157D5"/></w:rPr></w:style></w:styles>`;
  return zipStore([
    { name: '[Content_Types].xml', data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`) },
    { name: '_rels/.rels', data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`) },
    { name: 'word/document.xml', data: Buffer.from(document) },
    { name: 'word/styles.xml', data: Buffer.from(styles) },
    { name: 'word/_rels/document.xml.rels', data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`) },
  ]);
}

function pptTextBox(text: string, x: number, y: number, cx: number, cy: number, size = 2200, bold = false, color = '26364A') {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${Math.floor(x+y+cx+cy)}" name="Text"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square"/><a:lstStyle/><a:p><a:r><a:rPr lang="ko-KR" sz="${size}" ${bold ? 'b="1"' : ''}><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></a:rPr><a:t>${xml(text)}</a:t></a:r><a:endParaRPr lang="ko-KR"/></a:p></p:txBody></p:sp>`;
}

function createPptx(spec: UniversalSpec) {
  const slides = spec.slides.length ? spec.slides : [
    { title: spec.title, subtitle: spec.subtitle, bullets: spec.executive_summary ? [spec.executive_summary] : [], note: '' },
    ...spec.sections.slice(0, 10).map((s) => ({ title: s.heading || '내용', subtitle: '', bullets: [...s.paragraphs.slice(0, 2), ...s.bullets].slice(0, 7), note: '' })),
  ];
  const slideXmls = slides.map((slide, index) => {
    const parts = [pptTextBox(slide.title || `슬라이드 ${index + 1}`, 685800, 457200, 10972800, 914400, 2800, true, '17324D')];
    if (slide.subtitle) parts.push(pptTextBox(slide.subtitle, 685800, 1371600, 10972800, 600000, 1500, false, '64748B'));
    slide.bullets.forEach((b, i) => parts.push(pptTextBox(`• ${b}`, 914400, 2057400 + i * 620000, 10400000, 520000, 1700, false, '334155')));
    if (slide.note) parts.push(pptTextBox(slide.note, 914400, 5943600, 10400000, 500000, 1100, false, '64748B'));
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${parts.join('')}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
  });
  const slideIds = slides.map((_, i) => `<p:sldId id="${256+i}" r:id="rId${i+2}"/>`).join('');
  const presRels = [`<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>`, ...slides.map((_,i)=>`<Relationship Id="rId${i+2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i+1}.xml"/>`)].join('');
  const overrides = slides.map((_,i)=>`<Override PartName="/ppt/slides/slide${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('');
  const entries: ZipEntry[] = [
    { name:'[Content_Types].xml', data:Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${overrides}</Types>`) },
    { name:'_rels/.rels', data:Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>`) },
    { name:'ppt/presentation.xml', data:Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slideIds}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`) },
    { name:'ppt/_rels/presentation.xml.rels', data:Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${presRels}</Relationships>`) },
    { name:'ppt/slideMasters/slideMaster1.xml', data:Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:clrMap accent1="3157D5" accent2="70B8FF" accent3="22C55E" accent4="F59E0B" accent5="64748B" accent6="94A3B8" bg1="FFFFFF" bg2="F8FAFC" folHlink="954F72" hlink="0563C1" tx1="172033" tx2="475569"/><p:sldLayoutIdLst><p:sldLayoutId id="1" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`) },
    { name:'ppt/slideMasters/_rels/slideMaster1.xml.rels', data:Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`) },
    { name:'ppt/slideLayouts/slideLayout1.xml', data:Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`) },
    { name:'ppt/slideLayouts/_rels/slideLayout1.xml.rels', data:Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`) },
    { name:'ppt/theme/theme1.xml', data:Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="SAWOL"><a:themeElements><a:clrScheme name="SAWOL"><a:dk1><a:srgbClr val="172033"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="334155"/></a:dk2><a:lt2><a:srgbClr val="F8FAFC"/></a:lt2><a:accent1><a:srgbClr val="3157D5"/></a:accent1><a:accent2><a:srgbClr val="70B8FF"/></a:accent2><a:accent3><a:srgbClr val="22C55E"/></a:accent3><a:accent4><a:srgbClr val="F59E0B"/></a:accent4><a:accent5><a:srgbClr val="64748B"/></a:accent5><a:accent6><a:srgbClr val="94A3B8"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="SAWOL"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface="Malgun Gothic"/><a:cs typeface="Arial"/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface="Malgun Gothic"/><a:cs typeface="Arial"/></a:minorFont></a:fontScheme><a:fmtScheme name="SAWOL"><a:fillStyleLst/><a:lnStyleLst/><a:effectStyleLst/><a:bgFillStyleLst/></a:fmtScheme></a:themeElements></a:theme>`) },
  ];
  slideXmls.forEach((content, i) => {
    entries.push({ name:`ppt/slides/slide${i+1}.xml`, data:Buffer.from(content) });
    entries.push({ name:`ppt/slides/_rels/slide${i+1}.xml.rels`, data:Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`) });
  });
  return zipStore(entries);
}

function extractCodeFiles(result: AiTaskResult) {
  const files: Array<{ name: string; data: Buffer }> = [];
  const body = result.body || "";
  const regex = /```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g;
  const ext: Record<string, string> = { ts:'ts',tsx:'tsx',js:'js',jsx:'jsx',py:'py',python:'py',json:'json',html:'html',css:'css',sql:'sql',sh:'sh',bash:'sh',md:'md',markdown:'md',yaml:'yml',yml:'yml' };
  let match: RegExpExecArray | null; let i = 1;
  while ((match = regex.exec(body)) && i <= 30) {
    const lang = (match[1] || 'txt').toLowerCase();
    files.push({ name:`code/snippet-${String(i).padStart(2,'0')}.${ext[lang] || 'txt'}`, data:Buffer.from(match[2].trimEnd() + '\n') }); i += 1;
  }
  return files;
}

function artifact(args: { id:string; kind:GeneratedArtifact['kind']; format:GeneratedArtifact['format']; label:string; mimeType:string; fileName:string; buffer:Buffer; model:string; generator:string }): GeneratedArtifact {
  return { id:args.id, kind:args.kind, format:args.format, label:args.label, mimeType:args.mimeType, fileName:args.fileName, sizeBytes:args.buffer.length, dataBase64:args.buffer.toString('base64'), metadata:{ generator:args.generator, planner_model:args.model } };
}

export function hasExtendedArtifactRequest(plan: ArtifactPlan) {
  return plan.items.some((item) =>
    (item.kind === 'SPREADSHEET' && item.format === 'csv') ||
    (item.kind === 'DOCUMENT' && item.format === 'docx') ||
    item.kind === 'PRESENTATION' || item.kind === 'DATA' || item.kind === 'ARCHIVE' || item.kind === 'CODE' ||
    (item.kind === 'TEXT' && /(?:txt|md)/.test(item.format))
  );
}

export async function generateExtendedArtifacts({ context, result, plan }: { context:SawolAiContext; result:AiTaskResult; plan:ArtifactPlan }): Promise<GeneratedArtifact[]> {
  const requested = plan.items.filter((item) =>
    (item.kind === 'SPREADSHEET' && item.format === 'csv') ||
    (item.kind === 'DOCUMENT' && item.format === 'docx') ||
    item.kind === 'PRESENTATION' || item.kind === 'DATA' || item.kind === 'ARCHIVE' || item.kind === 'CODE' ||
    (item.kind === 'TEXT' && /(?:txt|md)/.test(item.format))
  );
  if (!requested.length) return [];
  const { spec, model } = await buildSpec(context, result, plan);
  const stem = safeStem(originalRequest(context).split('\n')[0] || spec.title);
  const out: GeneratedArtifact[] = [];
  for (const item of requested) {
    if (item.kind === 'SPREADSHEET' && item.format === 'csv') {
      const buffer = Buffer.from('\ufeff' + csvFromSpec(spec), 'utf8');
      out.push(artifact({ id:`csv-${Date.now()}-${out.length}`, kind:'SPREADSHEET', format:'csv', label:item.label, mimeType:'text/csv; charset=utf-8', fileName:`${stem}.csv`, buffer, model, generator:'csv' }));
    } else if (item.kind === 'DOCUMENT' && item.format === 'docx') {
      const buffer = createDocx(spec);
      out.push(artifact({ id:`docx-${Date.now()}-${out.length}`, kind:'DOCUMENT', format:'docx', label:item.label, mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document', fileName:`${stem}.docx`, buffer, model, generator:'openxml-docx' }));
    } else if (item.kind === 'PRESENTATION') {
      const buffer = createPptx(spec);
      out.push(artifact({ id:`pptx-${Date.now()}-${out.length}`, kind:'PRESENTATION', format:'pptx', label:item.label, mimeType:'application/vnd.openxmlformats-officedocument.presentationml.presentation', fileName:`${stem}.pptx`, buffer, model, generator:'openxml-pptx' }));
    } else if (item.kind === 'DATA' && item.format === 'json') {
      const buffer = Buffer.from(JSON.stringify({ title:spec.title, summary:spec.executive_summary, sections:spec.sections, tables:spec.tables, sources:spec.sources, limitations:spec.limitations }, null, 2), 'utf8');
      out.push(artifact({ id:`json-${Date.now()}-${out.length}`, kind:'DATA', format:'json', label:item.label, mimeType:'application/json; charset=utf-8', fileName:`${stem}.json`, buffer, model, generator:'json' }));
    } else if (item.kind === 'TEXT') {
      const body = item.format === 'txt' ? markdown(spec).replace(/^#+\s*/gm, '').replace(/^[-*]\s+/gm, '• ') : markdown(spec);
      const buffer = Buffer.from(body, 'utf8');
      out.push(artifact({ id:`text-${Date.now()}-${out.length}`, kind:'TEXT', format:item.format, label:item.label, mimeType:'text/plain; charset=utf-8', fileName:`${stem}.${item.format}`, buffer, model, generator:item.format }));
    } else if (item.kind === 'CODE' || item.kind === 'ARCHIVE') {
      const entries: ZipEntry[] = [
        { name:'README.md', data:Buffer.from(`# ${spec.title}\n\nSAWOL OFFICE 자동 생성 산출물입니다.\n`) },
        { name:'result.md', data:Buffer.from(markdown(spec)) },
        { name:'sources.json', data:Buffer.from(JSON.stringify(spec.sources, null, 2)) },
      ];
      if (spec.tables[0]) entries.push({ name:'data.csv', data:Buffer.from('\ufeff' + csvFromSpec(spec), 'utf8') });
      if (item.kind === 'CODE') entries.push(...extractCodeFiles(result));
      const buffer = zipStore(entries);
      out.push(artifact({ id:`zip-${Date.now()}-${out.length}`, kind:item.kind, format:'zip', label:item.label, mimeType:'application/zip', fileName:`${stem}_${item.kind === 'CODE' ? 'code' : 'bundle'}.zip`, buffer, model, generator:item.kind === 'CODE' ? 'code-bundle' : 'archive' }));
    }
  }
  return out;
}
