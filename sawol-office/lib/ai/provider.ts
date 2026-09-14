import type {
  AiTaskAsset,
  AiTaskResult,
  SawolAiContext,
} from "@/lib/ai/types";
import {
  buildSawolSystemPrompt,
  buildSawolUserPrompt,
} from "@/lib/ai/sawol-context";
import { runMockTask } from "@/lib/ai/mock";
import { runOpenAiTask } from "@/lib/ai/openai";
import { runGeminiTask } from "@/lib/ai/gemini";
import { generateCloudflareImageAsset } from "@/lib/ai/cloudflare-image";
import { shouldGenerateImageForContext } from "@/lib/ai/image-policy";

export type AiProviderName = "mock" | "openai" | "gemini";

function textOf(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function originalImageRequest(context: SawolAiContext) {
  const root = context.rootTask ?? {};
  const task = context.task ?? {};

  const title = textOf(root.title) || textOf(task.title) || "이미지 제작";
  const description = textOf(root.description) || textOf(task.description);

  return {
    title,
    description:
      description && description !== title ? description : "",
  };
}

function attachImagePromptSections(
  result: AiTaskResult,
  asset: AiTaskAsset,
): AiTaskResult {
  result.summary =
    "대표 원문을 직접 기준으로 이미지 전용 영어 프롬프트로 변환한 뒤 무료 이미지 모델에서 생성했습니다. 최종 적합성은 대표 확인이 필요합니다.";

  result.body = [
    "생성된 이미지가 이번 업무의 최종 산출물입니다.",
    "",
    "[대표 원문]",
    asset.sourcePrompt || "-",
    "",
    "[이미지 AI 전달 프롬프트]",
    asset.prompt || "-",
    asset.negativePrompt
      ? "\n[이미지 AI 억제 프롬프트]\n" + asset.negativePrompt
      : "",
    asset.translationProvider || asset.translationModel
      ? `\n[프롬프트 변환]\n${asset.translationProvider ?? "-"}${asset.translationModel ? ` · ${asset.translationModel}` : ""}`
      : "",
    "",
    "[검수 상태]",
    "자동 적합성 판정은 하지 않았습니다. 생성 이미지의 피사체·장소·색상·문구가 원문과 맞는지 대표 확인이 필요합니다.",
  ]
    .filter(Boolean)
    .join("\n");

  return result;
}

function buildDirectImageResult(
  context: SawolAiContext,
): AiTaskResult {
  const original = originalImageRequest(context);

  return {
    title: `${original.title} · 이미지 생성 결과`,
    summary:
      "대표 원문을 직접 기준으로 무료 이미지 모델에서 이미지를 생성했습니다. 이미지 내용 적합성은 대표 확인이 필요합니다.",
    body: [
      "생성된 이미지가 이번 업무의 최종 산출물입니다.",
      "",
      "[대표 원문]",
      original.title,
      original.description,
      "",
      "[검수 상태]",
      "자동 적합성 판정은 하지 않았습니다. 생성 이미지의 피사체·장소·색상·문구가 원문과 맞는지 대표 확인이 필요합니다.",
    ]
      .filter(Boolean)
      .join("\n"),
    confidence: 50,
    needs_human_review: true,
    sources: [],
  };
}

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
  // IMAGE PIPELINE:
  // 이미지 업무는 일반 텍스트 업무와 완전히 분리합니다.
  // 회사 기억/직원 문맥을 전달하지 않고 대표 원문만 이미지 전용 영어 프롬프트로 정리해 Cloudflare로 전달합니다.
  if (shouldGenerateImageForContext(context)) {
    const result = buildDirectImageResult(context);
    const asset = await generateCloudflareImageAsset({ context });

    result.asset = asset;
    attachImagePromptSections(result, asset);

    return {
      provider: "cloudflare",
      model: asset.model,
      responseId: null,
      usage: {
        mode: "FREE_ONLY_IMAGE",
        prompt_translation: {
          provider: asset.translationProvider,
          model: asset.translationModel,
        },
        billing_fallback: false,
      },
      result,
      usedWebSearch: false,
      requestedWebSearch: false,
    };
  }

  const provider = getAiProviderName();
  const systemPrompt = buildSawolSystemPrompt(context);
  const userPrompt = buildSawolUserPrompt(context);

  if (provider === "mock") {
    return runMockTask({ context });
  }

  if (provider === "gemini") {
    return runGeminiTask({
      systemPrompt,
      userPrompt,
      useWebSearch,
    });
  }

  return runOpenAiTask({
    systemPrompt,
    userPrompt,
    useWebSearch,
  });
}
