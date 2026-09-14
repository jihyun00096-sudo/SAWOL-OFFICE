import { GoogleGenAI } from "@google/genai";
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
    "- 대표 원문의 문구, 대상, 색상, 분위기, 형식 조건을 우선합니다.",
    "- 이미지 안에 글자가 필요하면 한글을 정확하고 읽기 쉽게 배치합니다.",
    "- 임의의 브랜드명, 수치, 인물, 로고, 사실을 추가하지 않습니다.",
    "- 최종 사용 가능한 완성 이미지 1장을 생성합니다.",
  ].join("\n");
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

  const model = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";
  const imageSize = boundedImageSize(process.env.GEMINI_IMAGE_SIZE);
  const aspectRatio = detectImageAspectRatio(context);
  const prompt = buildImagePrompt(context, result);

  const ai = new GoogleGenAI({ apiKey });

  // @google/genai의 Interactions API를 사용합니다.
  // SDK 버전별 타입 정의 차이를 피하기 위해 런타임 객체를 좁혀 사용합니다.
  const interactions = (ai as any).interactions;
  if (!interactions?.create) {
    throw new Error(
      "@google/genai 버전이 Gemini 이미지 Interactions API를 지원하지 않습니다.",
    );
  }

  const interaction = await interactions.create({
    model,
    input: prompt,
    response_format: {
      type: "image",
      aspect_ratio: aspectRatio,
      image_size: imageSize,
    },
  });

  const generatedImage = interaction?.output_image;
  const data = generatedImage?.data;

  if (!data || typeof data !== "string") {
    throw new Error("Gemini 이미지 응답에 실제 이미지 데이터가 없습니다.");
  }

  return {
    kind: "IMAGE",
    dataBase64: data,
    url: null,
    storagePath: null,
    mimeType:
      generatedImage?.mime_type ||
      generatedImage?.mimeType ||
      "image/png",
    prompt,
    model,
    aspectRatio,
    imageSize,
  };
}
