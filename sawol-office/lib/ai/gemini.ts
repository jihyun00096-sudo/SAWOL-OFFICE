import { GoogleGenAI, Type } from "@google/genai";
import type { AiTaskResult } from "@/lib/ai/types";

type GeminiRunOptions = {
  systemPrompt: string;
  userPrompt: string;
  useWebSearch: boolean;
};

function boundedInteger(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function validateResult(value: unknown): AiTaskResult {
  if (!value || typeof value !== "object") {
    throw new Error("Gemini 결과가 JSON 객체가 아닙니다.");
  }

  const row = value as Record<string, unknown>;

  if (
    typeof row.title !== "string" ||
    typeof row.summary !== "string" ||
    typeof row.body !== "string" ||
    typeof row.confidence !== "number" ||
    typeof row.needs_human_review !== "boolean" ||
    !Array.isArray(row.sources)
  ) {
    throw new Error("Gemini 결과 구조가 SAWOL OFFICE Schema와 다릅니다.");
  }

  const sources = row.sources.map((source) => {
    if (!source || typeof source !== "object") {
      throw new Error("Gemini 출처 구조가 올바르지 않습니다.");
    }

    const item = source as Record<string, unknown>;

    return {
      title: typeof item.title === "string" ? item.title.trim() : "",
      url: typeof item.url === "string" ? item.url.trim() : "",
      note: typeof item.note === "string" ? item.note.trim() : "",
    };
  });

  return {
    title: row.title.trim(),
    summary: row.summary.trim(),
    body: row.body.trim(),
    confidence: Math.max(0, Math.min(100, Math.round(row.confidence))),
    needs_human_review: row.needs_human_review,
    sources,
  };
}

export async function runGeminiTask({
  systemPrompt,
  userPrompt,
  useWebSearch,
}: GeminiRunOptions) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY가 설정되어 있지 않습니다. .env.local을 확인해주세요.",
    );
  }

  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const maxOutputTokens = boundedInteger(
    process.env.GEMINI_MAX_OUTPUT_TOKENS,
    7000,
    1000,
    20000,
  );

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model,
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.35,
      maxOutputTokens,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: "대표가 결과를 바로 식별할 수 있는 결과 제목",
          },
          summary: {
            type: Type.STRING,
            description: "대표 또는 다음 직원이 빠르게 읽을 수 있는 핵심 요약",
          },
          body: {
            type: Type.STRING,
            description: "현재 업무를 실제로 수행한 충분한 분량의 실무 결과 본문",
          },
          confidence: {
            type: Type.INTEGER,
            description: "결과 자체에 대한 0~100 정수 신뢰도",
          },
          needs_human_review: {
            type: Type.BOOLEAN,
            description: "대표 또는 사람의 확인이 필요하면 true",
          },
          sources: {
            type: Type.ARRAY,
            description:
              "실제로 확인한 출처만 기록. 웹 검색을 하지 않았다면 빈 배열",
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                url: { type: Type.STRING },
                note: { type: Type.STRING },
              },
              required: ["title", "url", "note"],
            },
          },
        },
        required: [
          "title",
          "summary",
          "body",
          "confidence",
          "needs_human_review",
          "sources",
        ],
      },
    },
  });

  const raw = response.text?.trim();

  if (!raw) {
    throw new Error("Gemini 응답에 결과 텍스트가 없습니다.");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Gemini Structured Output을 JSON으로 해석하지 못했습니다.");
  }

  return {
    provider: "gemini",
    model,
    responseId: null,
    usage: response.usageMetadata ?? null,
    result: validateResult(parsed),

    // 현재 SAWOL OFFICE 무료 Gemini 테스트에서는 Google Search grounding을
    // 의도적으로 사용하지 않는다. 무료 등급에서 최신 외부 사실 조회가 필요한
    // RESEARCH 업무는 결과 본문에 한계를 표시하고 별도 검증해야 한다.
    usedWebSearch: false,
    requestedWebSearch: Boolean(useWebSearch),
  };
}
