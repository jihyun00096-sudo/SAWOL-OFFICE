import { GoogleGenAI, Type } from "@google/genai";
import type { AiResultSource, AiTaskResult } from "@/lib/ai/types";
import { fetchFreeResearchSources, type FreeResearchSource } from "@/lib/ai/free-web-research";
import { getConfiguredGeminiModel } from "@/lib/ai/gemini-config";

export type GeminiRunOptions = {
  systemPrompt: string;
  userPrompt: string;
  useWebSearch: boolean;
};

function boundedInteger(value: string | undefined, fallback: number, min: number, max: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.round(number))) : fallback;
}

function validateResult(value: unknown): AiTaskResult {
  if (!value || typeof value !== "object") throw new Error("Gemini 결과가 JSON 객체가 아닙니다.");
  const row = value as Record<string, unknown>;
  if (
    typeof row.title !== "string" || typeof row.summary !== "string" || typeof row.body !== "string" ||
    typeof row.confidence !== "number" || typeof row.needs_human_review !== "boolean" || !Array.isArray(row.sources)
  ) throw new Error("Gemini 결과 구조가 SAWOL OFFICE Schema와 다릅니다.");

  return {
    title: row.title.trim(),
    summary: row.summary.trim(),
    body: row.body.trim(),
    confidence: Math.max(0, Math.min(100, Math.round(row.confidence))),
    needs_human_review: row.needs_human_review,
    sources: (row.sources as any[]).map((source) => ({
      title: typeof source?.title === "string" ? source.title.trim() : "",
      url: typeof source?.url === "string" ? source.url.trim() : "",
      note: typeof source?.note === "string" ? source.note.trim() : "",
    })).filter((source) => source.title && source.url),
  };
}

function retryable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes('"code":429') || message.includes('"code":503') || message.includes("RESOURCE_EXHAUSTED") || message.includes("UNAVAILABLE") || message.toLowerCase().includes("high demand");
}

async function withRetry<T>(fn: () => Promise<T>) {
  const delays = [0, 1800, 4200];
  let lastError: unknown;
  for (let index = 0; index < delays.length; index += 1) {
    if (delays[index]) await new Promise((resolve) => setTimeout(resolve, delays[index]));
    try { return await fn(); } catch (error) {
      lastError = error;
      if (!retryable(error) || index === delays.length - 1) throw error;
    }
  }
  throw lastError;
}

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    summary: { type: Type.STRING },
    body: { type: Type.STRING },
    confidence: { type: Type.INTEGER },
    needs_human_review: { type: Type.BOOLEAN },
    sources: {
      type: Type.ARRAY,
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
  required: ["title", "summary", "body", "confidence", "needs_human_review", "sources"],
};

function researchContext(rows: FreeResearchSource[]) {
  return `[검증 검색 근거]\n아래 자료는 SAWOL OFFICE가 이번 실행에서 새로 수집한 자료입니다.\n목록에 없는 기사·링크·언론사를 만들지 마세요.\n\n${rows.map((row, index) => `${index + 1}. ${row.title}\n- 매체: ${row.source}\n- 발행: ${row.published_at || "확인 필요"}\n- 도메인: ${row.domain || "확인 필요"}\n- 링크: ${row.url}\n- 확인 가능한 요약/메타정보: ${row.excerpt || "제목과 발행정보만 확인됨"}`).join("\n\n")}`;
}

async function generateJson(ai: GoogleGenAI, model: string, contents: string, systemInstruction: string, temperature: number, maxOutputTokens: number) {
  const response = await withRetry(() => ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction,
      temperature,
      maxOutputTokens,
      responseMimeType: "application/json",
      responseSchema,
    },
  }));
  const raw = response.text?.trim();
  if (!raw) throw new Error("Gemini 응답에 결과 텍스트가 없습니다.");
  try {
    return { result: validateResult(JSON.parse(raw)), usage: response.usageMetadata ?? null };
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("Gemini Structured Output을 JSON으로 해석하지 못했습니다.");
    throw error;
  }
}

function sanitizeSources(modelSources: AiResultSource[], rows: FreeResearchSource[], exactCount: number | null) {
  if (!rows.length) return modelSources;
  const byUrl = new Map(rows.map((row) => [row.url, row]));
  const chosen: AiResultSource[] = [];
  const seen = new Set<string>();

  for (const source of modelSources) {
    const row = byUrl.get(source.url);
    if (!row || seen.has(row.url)) continue;
    seen.add(row.url);
    chosen.push({ title: row.title, url: row.url, note: `${row.source} · ${row.published_at || "발행일 확인 필요"}` });
  }

  if (!chosen.length) {
    chosen.push(...rows.map((row) => ({ title: row.title, url: row.url, note: `${row.source} · ${row.published_at || "발행일 확인 필요"}` })));
  }

  return chosen.slice(0, exactCount ?? 8);
}

function sourceMatches(url: string, allowedDomains: string[]) {
  if (!allowedDomains.length) return true;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return allowedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch { return false; }
}

function hasFeedback(userPrompt: string) {
  return !userPrompt.includes("현재 반려 피드백 없음");
}

function isFinalWorkflowStep(userPrompt: string) {
  return /"workflow_step_key"\s*:\s*"final"/i.test(userPrompt);
}

export async function runGeminiTask({ systemPrompt, userPrompt, useWebSearch }: GeminiRunOptions) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY가 설정되어 있지 않습니다. .env.local을 확인해주세요.");

  const model = getConfiguredGeminiModel();
  const maxOutputTokens = boundedInteger(process.env.GEMINI_MAX_OUTPUT_TOKENS, 9000, 1500, 24000);
  const ai = new GoogleGenAI({ apiKey });

  const search = useWebSearch ? await fetchFreeResearchSources(userPrompt, 12) : { rows: [], requirements: null };
  const rows = search.rows;
  const requirements = search.requirements;

  if (useWebSearch && !rows.length) throw new Error("최신 정보가 필요한 업무인데 검증 가능한 자료를 가져오지 못했습니다. 근거 없는 결과는 제출하지 않았습니다.");

  const groundedPrompt = rows.length ? `${userPrompt}\n\n${researchContext(rows)}` : userPrompt;
  const first = await generateJson(ai, model, groundedPrompt, systemPrompt, useWebSearch ? 0.08 : 0.22, maxOutputTokens);
  let result = first.result;
  let usage: unknown = first.usage;

  const needsSecondPass = useWebSearch || hasFeedback(userPrompt) || isFinalWorkflowStep(userPrompt);
  if (needsSecondPass) {
    const reviewPrompt = `${userPrompt}\n\n${rows.length ? researchContext(rows) : ""}\n\n[1차 직원 결과]\n${JSON.stringify(result, null, 2)}\n\n[최종 검수 지시]\n- 대표 원문의 수량, 출처, 날짜, 형식, 대상, 금지조건을 하나씩 대조하세요.\n- 반려 재작업이면 기존 답을 말만 바꾸지 말고 반려 사유가 실제로 해결됐는지 확인하세요.\n- 다시 조사/재조사/출처/근거/뉴스/기사 관련 반려라면 이번 실행의 새 검색 근거만 사용하세요.\n- 협업 최종 단계라면 앞 직원 결과를 짧게 요약하지 말고 대표가 요구한 최종 산출물을 완성형으로 다시 구성하세요.\n- 검증되지 않은 사실이나 링크는 삭제하세요.\n- 요구사항을 충족하지 못하면 자신 있게 채우지 말고 needs_human_review=true로 표시하세요.\n같은 JSON Schema로 최종본만 반환하세요.`;

    const second = await generateJson(ai, model, reviewPrompt, "당신은 SAWOL OFFICE의 최종 품질검수자입니다. 속도보다 대표 원문 준수, 사실성, 완성도를 우선합니다. 이전 답을 그대로 통과시키지 말고 실제로 대조 검수하세요.", 0.03, maxOutputTokens);
    result = second.result;
    usage = { first_pass: first.usage, quality_pass: second.usage, quality_mode: "TWO_PASS" };
  }

  result.sources = sanitizeSources(result.sources, rows, requirements?.requestedCount ?? null);

  if (requirements?.allowedDomains?.length) {
    const invalid = result.sources.filter((source) => !sourceMatches(source.url, requirements.allowedDomains));
    if (invalid.length) throw new Error(`${requirements.sourceLabel ?? "지정 출처"}가 아닌 링크가 포함되어 결과 제출을 중단했습니다.`);
  }

  if (requirements?.requestedCount && result.sources.length < requirements.requestedCount) {
    throw new Error(`대표가 검증된 출처 ${requirements.requestedCount}개를 요청했지만 ${result.sources.length}개만 확인되었습니다. 다른 출처를 임의로 채우지 않았습니다.`);
  }

  if (useWebSearch && !result.sources.length) result.needs_human_review = true;

  return {
    provider: "gemini",
    model,
    responseId: null,
    usage,
    result,
    usedWebSearch: rows.length > 0,
    requestedWebSearch: Boolean(useWebSearch),
  };
}
