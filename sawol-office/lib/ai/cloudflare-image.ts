import type { AiTaskAsset, SawolAiContext } from "@/lib/ai/types";
import { detectImageAspectRatio } from "@/lib/ai/image-policy";

const FREE_IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";

function textOf(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function originalRequestText(context: SawolAiContext) {
  const root = context.rootTask ?? {};
  const task = context.task ?? {};

  const title = textOf(root.title) || textOf(task.title);
  const description = textOf(root.description) || textOf(task.description);

  if (description && description !== title) {
    return `${title}\n${description}`.trim();
  }

  return title.trim();
}

function explicitlyRequestsText(request: string) {
  return /(문구|텍스트|글씨|타이포|타이틀|제목|카피|슬로건|로고|표기|써줘|적어줘|넣어줘|write|text|title|headline|caption|typography)/i.test(
    request,
  );
}

function buildImagePrompt(context: SawolAiContext) {
  const request = originalRequestText(context);
  const aspectRatio = detectImageAspectRatio(context);
  const wantsText = explicitlyRequestsText(request);

  const lines = [
    "Create one polished image that faithfully depicts the following user request.",
    "",
    "USER REQUEST:",
    request || "Create the requested image.",
    "",
    "GENERATION GUIDANCE:",
    "- Make the requested main subject clearly visible and dominant.",
    "- Preserve the requested setting, colors, mood, style, and composition.",
    "- Add only visual elements that naturally belong to the requested scene.",
    `- Compose the scene for an approximate ${aspectRatio} layout.`,
  ];

  if (!wantsText) {
    lines.push("- Keep the image free of text, lettering, labels, signs, and watermarks.");
  } else {
    lines.push(
      "- Include only wording explicitly requested by the user.",
      "- Do not invent additional wording.",
    );
  }

  return lines.join("\n");
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
}: {
  context: SawolAiContext;
}): Promise<AiTaskAsset> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();

  if (!accountId || !apiToken) {
    throw new Error(
      "CLOUDFLARE_IMAGE_NOT_CONFIGURED: CLOUDFLARE_ACCOUNT_ID와 CLOUDFLARE_API_TOKEN이 필요합니다.",
    );
  }

  // FREE-ONLY:
  // 이미지 모델은 FLUX.1 Schnell 하나로 고정하고 유료 모델로 fallback하지 않습니다.
  const model = FREE_IMAGE_MODEL;
  const prompt = buildImagePrompt(context);
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
