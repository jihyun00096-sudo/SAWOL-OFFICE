import type { SawolAiContext } from "@/lib/ai/types";
import {
  buildSawolSystemPrompt,
  buildSawolUserPrompt,
} from "@/lib/ai/sawol-context";
import { runMockTask } from "@/lib/ai/mock";
import { runOpenAiTask } from "@/lib/ai/openai";
import { runGeminiTask } from "@/lib/ai/gemini";
import { generateGeminiImageAsset } from "@/lib/ai/gemini-image";
import { shouldGenerateImageForContext } from "@/lib/ai/image-policy";

export type AiProviderName = "mock" | "openai" | "gemini";

export function getAiProviderName(): AiProviderName {
  const value = (
    process.env.SAWOL_AI_PROVIDER ||
    process.env.AI_PROVIDER ||
    "mock"
  ).toLowerCase();

  if (value === "openai") return "openai";
  if (value === "gemini") return "gemini";
  return "mock";
}

export function getAiProviderDisplayName(provider: AiProviderName) {
  if (provider === "openai") return "OpenAI";
  if (provider === "gemini") return "Gemini AI";
  return "무료 Mock AI";
}

export function isAiProviderConfigured(provider: AiProviderName) {
  if (provider === "mock") return true;
  if (provider === "gemini") return Boolean(process.env.GEMINI_API_KEY);
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function executeAiTask({
  context,
  useWebSearch,
}: {
  context: SawolAiContext;
  useWebSearch: boolean;
}) {
  const provider = getAiProviderName();
  const systemPrompt = buildSawolSystemPrompt(context);
  const userPrompt = buildSawolUserPrompt(context);

  if (provider === "mock") {
    return runMockTask({ context });
  }

  if (provider === "gemini") {
    const response = await runGeminiTask({
      systemPrompt,
      userPrompt,
      useWebSearch,
    });

    if (shouldGenerateImageForContext(context)) {
      response.result.asset = await generateGeminiImageAsset({
        context,
        result: response.result,
      });
    }

    return response;
  }

  return runOpenAiTask({
    systemPrompt,
    userPrompt,
    useWebSearch,
  });
}
