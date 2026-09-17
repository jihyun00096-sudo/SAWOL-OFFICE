import type {
  ArtifactFormat,
  ArtifactKind,
  ArtifactPlan,
  ArtifactPlanItem,
} from "@/lib/artifacts/types";
import type { SawolAiContext } from "@/lib/ai/types";

function textOf(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function sourceTextFromContext(context: SawolAiContext) {
  const root = context.rootTask ?? {};
  const task = context.task ?? {};

  return [
    textOf(root.title),
    textOf(root.description),
    textOf(task.title),
    textOf(task.description),
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
}

function includesAny(text: string, signals: string[]) {
  return signals.some((signal) => text.includes(signal));
}

function hasRegex(text: string, pattern: RegExp) {
  return pattern.test(text);
}

function item(args: {
  id: string;
  kind: ArtifactKind;
  format: ArtifactFormat;
  label: string;
  generator: ArtifactPlanItem["generator"];
  reason: string;
}): ArtifactPlanItem {
  return {
    ...args,
    quantity: 1,
    required: true,
  };
}

export function planArtifactsFromText(sourceText: string): ArtifactPlan {
  const text = sourceText.toLowerCase();
  const items: ArtifactPlanItem[] = [];

  const wantsXlsx =
    includesAny(text, [
      "엑셀",
      "xlsx",
      "스프레드시트",
      "excel",
      "엑셀파일",
      "엑셀 파일",
    ]) ||
    hasRegex(text, /표로\s*정리.*(?:파일|엑셀)/);

  const wantsCsv = includesAny(text, ["csv", "csv파일", "csv 파일"]);

  if (wantsXlsx) {
    items.push(
      item({
        id: "spreadsheet-xlsx",
        kind: "SPREADSHEET",
        format: "xlsx",
        label: "Excel 통합문서",
        generator: "spreadsheet",
        reason: "대표 요청에서 Excel/XLSX/스프레드시트 산출물을 확인했습니다.",
      }),
    );
  }

  if (wantsCsv) {
    items.push(
      item({
        id: "spreadsheet-csv",
        kind: "SPREADSHEET",
        format: "csv",
        label: "CSV 데이터 파일",
        generator: "spreadsheet",
        reason: "대표 요청에서 CSV 산출물을 확인했습니다.",
      }),
    );
  }

  const wantsHwp =
    includesAny(text, ["hwp", "한컴", "한글파일", "한글 파일", "한글문서", "한글 문서"]);

  const wantsDocx =
    includesAny(text, ["docx", "워드", "word 파일", "word문서", "word 문서"]) ||
    (!wantsHwp &&
      includesAny(text, ["문서파일", "문서 파일"]) &&
      !includesAny(text, ["pdf", "ppt", "엑셀", "xlsx"]));

  if (wantsHwp) {
    items.push(
      item({
        id: "document-hwp",
        kind: "DOCUMENT",
        format: "hwp",
        label: "한글 문서",
        generator: "document",
        reason: "대표 요청에서 HWP/한컴 한글 문서를 확인했습니다.",
      }),
    );
  } else if (wantsDocx) {
    items.push(
      item({
        id: "document-docx",
        kind: "DOCUMENT",
        format: "docx",
        label: "Word 문서",
        generator: "document",
        reason: "대표 요청에서 Word/DOCX 문서를 확인했습니다.",
      }),
    );
  }

  if (includesAny(text, ["pdf", "pdf파일", "pdf 파일", "pdf로"])) {
    items.push(
      item({
        id: "document-pdf",
        kind: "PDF",
        format: "pdf",
        label: "PDF 문서",
        generator: "pdf",
        reason: "대표 요청에서 PDF 산출물을 확인했습니다.",
      }),
    );
  }

  if (
    includesAny(text, [
      "ppt",
      "pptx",
      "파워포인트",
      "프레젠테이션",
      "슬라이드",
      "발표자료",
      "발표 자료",
    ])
  ) {
    items.push(
      item({
        id: "presentation-pptx",
        kind: "PRESENTATION",
        format: "pptx",
        label: "PowerPoint",
        generator: "presentation",
        reason: "대표 요청에서 프레젠테이션/PPT 산출물을 확인했습니다.",
      }),
    );
  }

  const wantsImage =
    includesAny(text, [
      "이미지",
      "사진",
      "일러스트",
      "썸네일",
      "포스터",
      "배너",
      "카드뉴스",
      "인포그래픽",
      "로고",
      "그림",
      "png",
      "jpg",
      "jpeg",
    ]) ||
    (
      includesAny(text, [
        "카메라",
        "촬영",
        "찍은 것처럼",
        "찍은거처럼",
        "찍어줘",
        "스냅샷",
        "실사",
      ]) &&
      includesAny(text, ["만들", "생성", "제작", "찍어"])
    );

  if (wantsImage) {
    items.push(
      item({
        id: "image-primary",
        kind: "IMAGE",
        format: "png",
        label: "이미지",
        generator: "image",
        reason: "대표 요청에서 이미지/사진/시각 산출물을 확인했습니다.",
      }),
    );
  }

  const wantsCode =
    includesAny(text, [
      "코드파일",
      "코드 파일",
      "소스코드",
      "프로젝트 파일",
      "github",
      "깃허브",
      "사이트 수정",
      "웹사이트 수정",
      "기능 개발",
      "코딩",
    ]) &&
    includesAny(text, ["파일", "수정", "개발", "코드", "프로젝트", "사이트"]);

  if (wantsCode) {
    items.push(
      item({
        id: "code-project",
        kind: "CODE",
        format: "code",
        label: "코드/프로젝트 산출물",
        generator: "code",
        reason: "대표 요청에서 코드 또는 프로젝트 수정 산출물을 확인했습니다.",
      }),
    );
  }

  if (
    includesAny(text, ["json 파일", "json파일", "json으로", "json 데이터"])
  ) {
    items.push(
      item({
        id: "data-json",
        kind: "DATA",
        format: "json",
        label: "JSON 데이터",
        generator: "data",
        reason: "대표 요청에서 JSON 데이터 산출물을 확인했습니다.",
      }),
    );
  }

  if (
    includesAny(text, ["zip", "압축파일", "압축 파일", "zip파일", "zip 파일"])
  ) {
    items.push(
      item({
        id: "archive-zip",
        kind: "ARCHIVE",
        format: "zip",
        label: "ZIP 압축파일",
        generator: "archive",
        reason: "대표 요청에서 ZIP/압축 산출물을 확인했습니다.",
      }),
    );
  }

  if (includesAny(text, ["markdown", "마크다운", "md 파일", "md파일"])) {
    items.push(
      item({
        id: "text-markdown",
        kind: "TEXT",
        format: "md",
        label: "Markdown 문서",
        generator: "text",
        reason: "대표 요청에서 Markdown/MD 파일 산출물을 확인했습니다.",
      }),
    );
  }

  if (includesAny(text, ["txt 파일", "txt파일", "텍스트 파일", "텍스트파일"])) {
    items.push(
      item({
        id: "text-plain",
        kind: "TEXT",
        format: "txt",
        label: "텍스트 파일",
        generator: "text",
        reason: "대표 요청에서 TXT 텍스트 파일 산출물을 확인했습니다.",
      }),
    );
  }

  if (!items.length) {
    items.push(
      item({
        id: "text-default",
        kind: "TEXT",
        format: "md",
        label: "텍스트 결과",
        generator: "text",
        reason: "별도 파일 형식이 지정되지 않아 일반 텍스트 결과로 계획했습니다.",
      }),
    );
  }

  const priority: ArtifactKind[] = [
    "SPREADSHEET",
    "DOCUMENT",
    "PDF",
    "PRESENTATION",
    "IMAGE",
    "CODE",
    "DATA",
    "ARCHIVE",
    "TEXT",
  ];

  const primaryKind =
    priority.find((kind) => items.some((entry) => entry.kind === kind)) ??
    items[0].kind;

  return {
    version: "27.0",
    sourceText,
    items,
    isMultiArtifact: items.length > 1,
    primaryKind,
  };
}

export function planArtifactsForContext(context: SawolAiContext) {
  return planArtifactsFromText(sourceTextFromContext(context));
}
