import type { AiTaskAsset, AiTaskResult, SawolAiContext } from "@/lib/ai/types";
import { detectImageAspectRatio } from "@/lib/ai/image-policy";

function textOf(value: unknown) {
  return typeof value === "string" ? value : "";
}

function boundedImageSize(value: string | undefined) {
  const normalized = (value || "1K").toUpperCase();
  return ["1K", "2K", "4K"].includes(normalized) ? normalized : "1K";
}

function buildImagePrompt(context: SawolAiContext, result: AiTaskResult) {
  const task = context.task ?? {};
  const root = context.rootTask ?? {};
  const originalTitle = textOf(root.title) || textOf(task.title);
  const originalDescription =
    textOf(root.description) || textOf(task.description) || originalTitle;

  return [
    "SAWOL OFFICE의 실제 최종 이미지 산출물을 제작하세요.",
    "",
    "[대표 원문]",
    originalTitle,
    originalDescription,
    "",
    "[AI 직원이 정리한 최종 제작안]",
    result.body.slice(0, 7000),
    "",
    "[제작 원칙]",
    "- 대표 원문의 문구, 대상, 색상, 분위기, 형식 조건을 최우선으로 지킵니다.",
    "- 이미지 안에 글자가 필요하면 한글을 정확하고 읽기 쉽게 배치합니다.",
    "- 임의의 브랜드명, 수치, 인물, 로고, 사실을 추가하지 않습니다.",
    "- 최종 사용 가능한 완성 이미지 1장을 생성합니다.",
  ].join("\n");
}

type InteractionResponse = {
  output_image?: {
    data?: string;
    mime_type?: string;
    mimeType?: string;
  } | null;
  outputs?: Array<any>;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

function findOutputImage(payload: InteractionResponse) {
  if (payload?.output_image?.data) {
    return payload.output_image;
  }

  const stack = [...(payload?.outputs ?? [])];

  while (stack.length) {
    const item = stack.shift();
    if (!item || typeof item !== "object") continue;

    if (
      item.type === "image" &&
      typeof item.data === "string" &&
      item.data.length > 0
    ) {
      return item;
    }

    for (const value of Object.values(item)) {
      if (Array.isArray(value)) stack.push(...value);
      else if (value && typeof value === "object") stack.push(value);
    }
  }

  return null;
}

async function requestImage({
  apiKey,
  model,
  prompt,
  aspectRatio,
  imageSize,
}: {
  apiKey: string;
  model: string;
  prompt: string;
  aspectRatio: string;
  imageSize: string;
}) {
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/interactions",
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: prompt,
        response_format: {
          type: "image",
          mime_type: "image/png",
          aspect_ratio: aspectRatio,
          image_size: imageSize,
        },
      }),
      cache: "no-store",
    },
  );

  const payload = (await response.json().catch(() => null)) as
    | InteractionResponse
    | null;

  if (!response.ok) {
    const detail =
      payload?.error?.message ||
      `HTTP ${response.status}`;

    throw new Error(
      `Gemini image interaction failed (${model}): ${detail}`,
    );
  }

  const generatedImage = payload ? findOutputImage(payload) : null;

  if (!generatedImage?.data) {
    throw new Error(
      `Gemini image interaction returned no image (${model}).`,
    );
  }

  return {
    generatedImage,
    model,
  };
}

export async function generateGeminiImageAsset({
  context,
  result,
}: {
  context: SawolAiContext;
  result: AiTaskResult;
}): Promise<AiTaskAsset> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("이미지 생성에 필요한 GEMINI_API_KEY가 없습니다.");
  }

  const requestedModel =
    process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";

  const fallbackModel =
    process.env.GEMINI_IMAGE_FALLBACK_MODEL ||
    "gemini-2.5-flash-image";

  const imageSize = boundedImageSize(process.env.GEMINI_IMAGE_SIZE);
  const aspectRatio = detectImageAspectRatio(context);
  const prompt = buildImagePrompt(context, result);

  let generatedImage: any;
  let usedModel = requestedModel;

  try {
    const first = await requestImage({
      apiKey,
      model: requestedModel,
      prompt,
      aspectRatio,
      imageSize,
    });
    generatedImage = first.generatedImage;
    usedModel = first.model;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    const retryableModelError =
      /404|NOT_FOUND|not found|not supported/i.test(message);

    if (!retryableModelError || fallbackModel === requestedModel) {
      throw error;
    }

    const fallback = await requestImage({
      apiKey,
      model: fallbackModel,
      prompt,
      aspectRatio,
      imageSize: "1K",
    });

    generatedImage = fallback.generatedImage;
    usedModel = fallback.model;
  }

  return {
    kind: "IMAGE",
    dataBase64: generatedImage.data,
    url: null,
    storagePath: null,
    mimeType:
      generatedImage.mime_type ||
      generatedImage.mimeType ||
      "image/png",
    prompt,
    model: usedModel,
    aspectRatio,
    imageSize: usedModel === fallbackModel ? "1K" : imageSize,
  };
}
