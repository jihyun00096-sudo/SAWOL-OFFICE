import type { AiTaskAsset, AiTaskResult, SawolAiContext } from "@/lib/ai/types";
import { detectImageAspectRatio } from "@/lib/ai/image-policy";

const FREE_IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";

function textOf(value: unknown) {
  return typeof value === "string" ? value : "";
}

function buildImagePrompt(context: SawolAiContext, result: AiTaskResult) {
  const task = context.task ?? {};
  const root = context.rootTask ?? {};
  const originalTitle = textOf(root.title) || textOf(task.title);
  const originalDescription =
    textOf(root.description) || textOf(task.description) || originalTitle;
  const aspectRatio = detectImageAspectRatio(context);

  return [
    "Create the final image deliverable for SAWOL OFFICE.",
    "",
    "[Original request]",
    originalTitle,
    originalDescription,
    "",
    "[AI staff production brief]",
    result.body.slice(0, 6500),
    "",
    "[Rules]",
    "- Follow the original request first.",
    "- Do not invent brands, logos, people, numbers, or facts that were not requested.",
    "- If Korean copy is requested, keep the Korean wording exactly as provided.",
    `- Compose the image visually for an approximate ${aspectRatio} layout.`,
    "- Produce one polished, practical final image.",
  ].join("\n");
}

type CloudflareEnvelope = {
  success?: boolean;
  result?: {
    image?: string;
  } | null;
  errors?: Array<{
    code?: number;
    message?: string;
  }>;
  messages?: Array<{
    code?: number;
    message?: string;
  }>;
};

function errorText(payload: CloudflareEnvelope | null, status: number) {
  const messages = [
    ...(payload?.errors ?? []),
    ...(payload?.messages ?? []),
  ]
    .map((item) => item?.message)
    .filter(Boolean);

  return messages.join(" | ") || `HTTP ${status}`;
}

function freeOnlyError(message: string) {
  if (/quota|limit|capacity|3040|rate|429/i.test(message)) {
    return new Error(
      "FREE_IMAGE_LIMIT_REACHED: Cloudflare Workers AI 무료 사용량/용량 한도에 도달했습니다. 유료 모델로 전환하지 않고 작업을 중지했습니다.",
    );
  }

  if (/403|5035|paid|billing|upgrade/i.test(message)) {
    return new Error(
      "FREE_IMAGE_MODEL_UNAVAILABLE: 현재 Cloudflare 무료 플랜에서 이미지 모델을 사용할 수 없습니다. 유료 전환 없이 작업을 중지했습니다.",
    );
  }

  return new Error(`CLOUDFLARE_IMAGE_FAILED: ${message}`);
}

export async function generateCloudflareImageAsset({
  context,
  result,
}: {
  context: SawolAiContext;
  result: AiTaskResult;
}): Promise<AiTaskAsset> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();

  if (!accountId || !apiToken) {
    throw new Error(
      "CLOUDFLARE_IMAGE_NOT_CONFIGURED: CLOUDFLARE_ACCOUNT_ID와 CLOUDFLARE_API_TOKEN이 필요합니다.",
    );
  }

  // 비용 방지를 위해 모델명을 환경변수로 열지 않습니다.
  // SAWOL OFFICE의 이미지 생성은 무료 테스트용 FLUX.1 Schnell만 사용합니다.
  const model = FREE_IMAGE_MODEL;
  const prompt = buildImagePrompt(context, result);
  const aspectRatio = detectImageAspectRatio(context);

  const endpoint =
    `https://api.cloudflare.com/client/v4/accounts/` +
    `${encodeURIComponent(accountId)}/ai/run/${model}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: prompt.slice(0, 2048),
      steps: 4,
      seed: Math.floor(Math.random() * 2147483647),
    }),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | CloudflareEnvelope
    | null;

  if (!response.ok || payload?.success === false) {
    throw freeOnlyError(errorText(payload, response.status));
  }

  const image = payload?.result?.image;

  if (!image || typeof image !== "string") {
    throw new Error(
      "CLOUDFLARE_IMAGE_FAILED: Cloudflare 응답에 생성 이미지 데이터가 없습니다.",
    );
  }

  return {
    kind: "IMAGE",
    dataBase64: image,
    url: null,
    storagePath: null,
    mimeType: "image/jpeg",
    prompt,
    model,
    aspectRatio,
    imageSize: "FREE",
  };
}
