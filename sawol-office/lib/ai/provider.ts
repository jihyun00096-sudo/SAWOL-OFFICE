import type { SawolAiContext } from "@/lib/ai/types";
import { buildSawolSystemPrompt, buildSawolUserPrompt } from "@/lib/ai/sawol-context";
import { runMockTask } from "@/lib/ai/mock";
import { runOpenAiTask } from "@/lib/ai/openai";

export type AiProviderName = "mock" | "openai";

export function getAiProviderName(): AiProviderName {
  const value = (process.env.SAWOL_AI_PROVIDER || "mock").toLowerCase();

  if (value === "openai") return "openai";
  return "mock";
}

export function getAiProviderDisplayName(provider: AiProviderName) {
  return provider === "openai" ? "OpenAI" : "무료 Mock AI";
}

export function isAiProviderConfigured(provider: AiProviderName) {
  if (provider === "mock") return true;
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

  if (provider === "mock") {
    return runMockTask({ context });
  }

  return runOpenAiTask({
    systemPrompt: buildSawolSystemPrompt(context),
    userPrompt: buildSawolUserPrompt(context),
    useWebSearch,
  });
}
