import { GoogleGenAI, Type } from "@google/genai";
import type { AiResultSource, AiTaskResult } from "@/lib/ai/types";

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

function isTruthy(value: string | undefined, fallback = true) {
  if (value == null) return fallback;
  return !["0", "false", "off", "no"].includes(value.toLowerCase());
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

  const sources = row.sources
    .map((source) => {
      if (!source || typeof source !== "object") return null;

      const item = source as Record<string, unknown>;

      return {
        title: typeof item.title === "string" ? item.title.trim() : "",
        url: typeof item.url === "string" ? item.url.trim() : "",
        note: typeof item.note === "string" ? item.note.trim() : "",
      };
    })
    .filter(Boolean) as AiResultSource[];

  return {
    title: row.title.trim(),
    summary: row.summary.trim(),
    body: row.body.trim(),
    confidence: Math.max(0, Math.min(100, Math.round(row.confidence))),
    needs_human_review: row.needs_human_review,
    sources,
  };
}

function groundingSources(response: any): AiResultSource[] {
  const metadata = response?.candidates?.[0]?.groundingMetadata;
  const chunks = Array.isArray(metadata?.groundingChunks)
    ? metadata.groundingChunks
    : [];

  const rows: AiResultSource[] = [];

  for (const chunk of chunks) {
    const web = chunk?.web;
    const url = typeof web?.uri === "string" ? web.uri.trim() : "";
    if (!url) continue;

    rows.push({
      title:
        typeof web?.title === "string" && web.title.trim()
          ? web.title.trim()
          : "Google Search 확인 출처",
      url,
      note: "Gemini Google Search grounding으로 실제 확인한 출처",
    });
  }

  const unique = new Map<string, AiResultSource>();
  for (const row of rows) unique.set(row.url, row);

  return [...unique.values()];
}

function mergeSources(
  modelSources: AiResultSource[],
  verifiedSources: AiResultSource[],
) {
  const merged = new Map<string, AiResultSource>();

  for (const source of verifiedSources) {
    if (source.url) merged.set(source.url, source);
  }

  for (const source of modelSources) {
    if (!source.url) continue;

    if (!merged.has(source.url)) {
      merged.set(source.url, source);
    }
  }

  return [...merged.values()];
}

function retryableGeminiError(error: unknown) {
  const message =
    error instanceof Error ? error.message : String(error ?? "");

  return (
    message.includes('"code":429') ||
    message.includes('"code":503') ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.includes("UNAVAILABLE") ||
    message.toLowerCase().includes("high demand")
  );
}

async function withRetry<T>(fn: () => Promise<T>) {
  const delays = [0, 1500, 3500];

  let lastError: unknown;

  for (let i = 0; i < delays.length; i++) {
    if (delays[i]) {
      await new Promise((resolve) => setTimeout(resolve, delays[i]));
    }

    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!retryableGeminiError(error) || i === delays.length - 1) {
        throw error;
      }
    }
  }

  throw lastError;
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

  const normalModel =
    process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

  // 무료 등급에서 실시간 Google Search grounding을 사용할 수 있는
  // 안정 모델을 연구/뉴스 업무에 별도로 사용합니다.
  const researchModel =
    process.env.GEMINI_RESEARCH_MODEL || "gemini-2.5-flash-lite";

  const searchEnabled =
    useWebSearch &&
    isTruthy(process.env.GEMINI_ENABLE_SEARCH, true);

  const model = searchEnabled ? researchModel : normalModel;

  const maxOutputTokens = boundedInteger(
    process.env.GEMINI_MAX_OUTPUT_TOKENS,
    7000,
    1000,
    20000,
  );

  const ai = new GoogleGenAI({ apiKey });

  const response = await withRetry(() =>
    ai.models.generateContent({
      model,
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        temperature: searchEnabled ? 0.2 : 0.35,
        maxOutputTokens,
        tools: searchEnabled ? [{ googleSearch: {} }] : undefined,
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
              description:
                "대표 또는 다음 직원이 빠르게 읽을 수 있는 핵심 요약",
            },
            body: {
              type: Type.STRING,
              description:
                "현재 업무를 실제로 수행한 충분한 분량의 실무 결과 본문",
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
                "실제로 확인한 출처만 기록. 검색을 하지 않았다면 빈 배열",
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
    }),
  );

  const raw = response.text?.trim();

  if (!raw) {
    throw new Error("Gemini 응답에 결과 텍스트가 없습니다.");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      "Gemini Structured Output을 JSON으로 해석하지 못했습니다.",
    );
  }

  const result = validateResult(parsed);
  const verified = searchEnabled ? groundingSources(response) : [];

  if (searchEnabled) {
    result.sources = mergeSources(result.sources, verified);

    if (!result.sources.length) {
      result.needs_human_review = true;
      result.summary =
        `[실시간 검색 결과 검증 필요] ${result.summary}`.trim();
    }
  }

  return {
    provider: "gemini",
    model,
    responseId: null,
    usage: response.usageMetadata ?? null,
    result,
    usedWebSearch: searchEnabled,
    requestedWebSearch: Boolean(useWebSearch),
  };
}
