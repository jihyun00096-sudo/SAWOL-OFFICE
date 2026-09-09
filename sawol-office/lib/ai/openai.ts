import type { AiTaskResult } from "@/lib/ai/types";

type OpenAiRunOptions = {
  systemPrompt: string;
  userPrompt: string;
  useWebSearch: boolean;
};

type OpenAiResponse = {
  id?: string;
  status?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  usage?: Record<string, unknown>;
  error?: {
    message?: string;
    type?: string;
    code?: string;
  } | null;
};

function envBoolean(value: string | undefined, fallback: boolean) {
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

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

function extractOutputText(response: OpenAiResponse) {
  const texts: string[] = [];

  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (
        content.type === "output_text" &&
        typeof content.text === "string"
      ) {
        texts.push(content.text);
      }
    }
  }

  return texts.join("\n").trim();
}

function validateResult(value: unknown): AiTaskResult {
  if (!value || typeof value !== "object") {
    throw new Error("AI 결과가 JSON 객체가 아닙니다.");
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
    throw new Error("AI 결과 구조가 예상한 Schema와 다릅니다.");
  }

  const sources = row.sources.map((source) => {
    if (!source || typeof source !== "object") {
      throw new Error("AI 출처 구조가 올바르지 않습니다.");
    }

    const item = source as Record<string, unknown>;

    return {
      title: typeof item.title === "string" ? item.title : "",
      url: typeof item.url === "string" ? item.url : "",
      note: typeof item.note === "string" ? item.note : "",
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

export async function runOpenAiTask({
  systemPrompt,
  userPrompt,
  useWebSearch,
}: OpenAiRunOptions) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY가 설정되어 있지 않습니다. SAWOL_AI_PROVIDER=mock으로 테스트하거나 API Key를 설정해주세요.",
    );
  }

  const model = process.env.OPENAI_MODEL || "gpt-5.6-luna";
  const reasoningEffort =
    process.env.OPENAI_REASONING_EFFORT || "medium";
  const maxOutputTokens = boundedInteger(
    process.env.OPENAI_MAX_OUTPUT_TOKENS,
    5000,
    1000,
    20000,
  );

  const webSearchEnabled = envBoolean(
    process.env.OPENAI_ENABLE_WEB_SEARCH,
    true,
  );

  const requestBody: Record<string, unknown> = {
    model,
    store: false,
    reasoning: {
      effort: reasoningEffort,
    },
    max_output_tokens: maxOutputTokens,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: systemPrompt }],
      },
      {
        role: "user",
        content: [{ type: "input_text", text: userPrompt }],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "sawol_task_result",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            summary: { type: "string" },
            body: { type: "string" },
            confidence: {
              type: "integer",
              minimum: 0,
              maximum: 100,
            },
            needs_human_review: { type: "boolean" },
            sources: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  title: { type: "string" },
                  url: { type: "string" },
                  note: { type: "string" },
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
    },
  };

  if (useWebSearch && webSearchEnabled) {
    requestBody.tools = [{ type: "web_search" }];
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 150_000);

  let response: Response;

  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  const rawText = await response.text();

  if (!response.ok) {
    let detail = rawText;

    try {
      const parsed = JSON.parse(rawText);
      detail =
        parsed?.error?.message ||
        parsed?.error?.type ||
        `HTTP ${response.status}`;
    } catch {
      // keep raw text
    }

    throw new Error(
      `OpenAI API 호출 실패 (${response.status}): ${String(detail).slice(0, 500)}`,
    );
  }

  const parsedResponse = JSON.parse(rawText) as OpenAiResponse;
  const outputText = extractOutputText(parsedResponse);

  if (!outputText) {
    throw new Error("OpenAI 응답에 결과 텍스트가 없습니다.");
  }

  let structured: unknown;

  try {
    structured = JSON.parse(outputText);
  } catch {
    throw new Error("OpenAI Structured Output을 JSON으로 해석하지 못했습니다.");
  }

  return {
    provider: "openai",
    model,
    responseId: parsedResponse.id ?? null,
    usage: parsedResponse.usage ?? null,
    result: validateResult(structured),
    usedWebSearch: Boolean(useWebSearch && webSearchEnabled),
  };
}
