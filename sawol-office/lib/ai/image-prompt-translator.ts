import { GoogleGenAI, Type } from "@google/genai";
import { getConfiguredGeminiModel } from "@/lib/ai/gemini-config";

export type ImagePromptTranslation = {
  sourcePrompt: string;
  prompt: string;
  negativePrompt: string;
  translator: "gemini" | "heuristic";
  translationModel: string | null;
};

type TranslateOptions = {
  sourcePrompt: string;
  aspectRatio: string;
  explicitlyRequestsText: boolean;
  explicitlyForbidsText: boolean;
};

type TranslationResponse = {
  prompt_en: string;
  negative_prompt_en: string;
};

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    prompt_en: { type: Type.STRING },
    negative_prompt_en: { type: Type.STRING },
  },
  required: ["prompt_en", "negative_prompt_en"],
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

function retryable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    message.includes('"code":429') ||
    message.includes('"code":503') ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.includes("UNAVAILABLE") ||
    message.toLowerCase().includes("high demand")
  );
}

async function withRetry<T>(fn: () => Promise<T>) {
  const delays = [0, 1500, 3200];
  let lastError: unknown;

  for (let index = 0; index < delays.length; index += 1) {
    if (delays[index]) {
      await new Promise((resolve) => setTimeout(resolve, delays[index]));
    }

    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!retryable(error) || index === delays.length - 1) throw error;
    }
  }

  throw lastError;
}

function cleanLine(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function heuristicTranslation({
  sourcePrompt,
  aspectRatio,
  explicitlyRequestsText,
  explicitlyForbidsText,
}: TranslateOptions): ImagePromptTranslation {
  const prompt = [
    cleanLine(sourcePrompt) || "Create the requested image.",
    "Render only the subject, setting, mood, and style explicitly requested by the user.",
    "Keep the requested main subject clearly visible and dominant.",
    `Target composition: ${aspectRatio}.`,
    explicitlyForbidsText
      ? "No text, no letters, no signage, no watermark."
      : explicitlyRequestsText
        ? "Include only the exact text explicitly requested by the user."
        : "Do not add extra text or signage.",
  ].join(" ");

  const negativePrompt = [
    "wrong subject",
    "unrelated scene",
    "corporate office",
    "company branding",
    "logo",
    explicitlyForbidsText || !explicitlyRequestsText
      ? "text, letters, signage, watermark"
      : "invented text",
  ].join(", ");

  return {
    sourcePrompt,
    prompt,
    negativePrompt,
    translator: "heuristic",
    translationModel: null,
  };
}

function validateTranslation(value: unknown): TranslationResponse {
  if (!value || typeof value !== "object") {
    throw new Error("이미지 프롬프트 번역 결과가 JSON 객체가 아닙니다.");
  }

  const row = value as Record<string, unknown>;
  const prompt = typeof row.prompt_en === "string" ? row.prompt_en.trim() : "";
  const negativePrompt =
    typeof row.negative_prompt_en === "string"
      ? row.negative_prompt_en.trim()
      : "";

  if (!prompt) {
    throw new Error("이미지 프롬프트 번역 결과에 prompt_en이 없습니다.");
  }

  return {
    prompt_en: prompt,
    negative_prompt_en: negativePrompt,
  };
}

export async function translateImagePrompt(
  options: TranslateOptions,
): Promise<ImagePromptTranslation> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return heuristicTranslation(options);

  const model = getConfiguredGeminiModel();
  const ai = new GoogleGenAI({ apiKey });
  const maxOutputTokens = boundedInteger(
    process.env.GEMINI_MAX_OUTPUT_TOKENS,
    1200,
    300,
    3000,
  );

  const textRule = options.explicitlyForbidsText
    ? "The user explicitly forbids text. The English prompt must clearly say no text, no letters, no signage, no watermark."
    : options.explicitlyRequestsText
      ? "The user wants text. Mention that only the explicitly requested text may appear; do not invent any extra wording."
      : "The user did not ask for text. Avoid adding signage or extra wording. Keep the image text-light or text-free unless naturally unavoidable."

  const contents = [
    "Convert the following Korean image request into an English image-generation prompt.",
    "",
    "[ORIGINAL KOREAN REQUEST]",
    options.sourcePrompt,
    "",
    "[REQUIREMENTS]",
    "- Preserve only the user-requested visual meaning.",
    "- Keep the requested main subject, setting, style, mood, colors, and quantity.",
    "- Do not add office, company, branding, signage, people, animals, buildings, or objects unless the user requested them.",
    "- If the request is simple, keep the English prompt simple and direct.",
    `- Target aspect ratio: ${options.aspectRatio}.`,
    `- ${textRule}`,
    "",
    "Return JSON only.",
  ].join("\n");

  const systemInstruction = [
    "You are a prompt translator for image generation.",
    "Translate Korean user requests into concise, high-fidelity English prompts for a text-to-image model.",
    "Do not explain. Do not add unrelated concepts. Do not rewrite the request into a new idea.",
    "Return strict JSON with two fields: prompt_en and negative_prompt_en.",
    "The negative prompt should be short and only list likely failure modes or prohibited content.",
  ].join(" ");

  try {
    const response = await withRetry(() =>
      ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction,
          temperature: 0.1,
          maxOutputTokens,
          responseMimeType: "application/json",
          responseSchema,
        },
      }),
    );

    const raw = response.text?.trim();
    if (!raw) throw new Error("Gemini 번역 응답에 결과 텍스트가 없습니다.");

    const parsed = validateTranslation(JSON.parse(raw));

    return {
      sourcePrompt: options.sourcePrompt,
      prompt: cleanLine(parsed.prompt_en),
      negativePrompt: cleanLine(parsed.negative_prompt_en),
      translator: "gemini",
      translationModel: model,
    };
  } catch {
    return heuristicTranslation(options);
  }
}
