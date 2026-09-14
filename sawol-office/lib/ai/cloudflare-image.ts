import type { AiTaskAsset, SawolAiContext } from "@/lib/ai/types";
import { detectImageAspectRatio } from "@/lib/ai/image-policy";

const FREE_IMAGE_MODEL = "@cf/bytedance/stable-diffusion-xl-lightning";

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

function dimensionsFor(aspectRatio: string) {
  const value = aspectRatio.replace(/\s/g, "");

  if (value === "16:9") return { width: 1024, height: 576 };
  if (value === "9:16") return { width: 576, height: 1024 };
  if (value === "4:3") return { width: 1024, height: 768 };
  if (value === "3:4") return { width: 768, height: 1024 };

  return { width: 1024, height: 1024 };
}

function buildPositivePrompt(context: SawolAiContext) {
  const request = originalRequestText(context);
  const aspectRatio = detectImageAspectRatio(context);

  // SDXL은 "그리지 말 것"을 긴 문장으로 반복하기보다
  // 사용자가 원하는 피사체/장소/색감/스타일을 앞에 두는 편이 안정적입니다.
  return [
    request || "Create the requested image.",
    "",
    "Faithfully follow the user's requested subject, setting, colors, mood, and style.",
    "The requested main subject must be clearly visible and visually dominant.",
    `Composition: ${aspectRatio}.`,
    "Clean, coherent, polished composition. Accurate scene matching.",
  ].join("\n");
}

function buildNegativePrompt(context: SawolAiContext) {
  const request = originalRequestText(context);
  const wantsText = explicitlyRequestsText(request);

  const negatives = [
    "wrong subject",
    "missing main subject",
    "unrelated scene",
    "unrelated person",
    "unrelated building",
    "office interior",
    "corporate office",
    "meeting room",
    "company branding",
    "logo",
    "watermark",
    "low quality",
    "blurry",
    "distorted",
    "deformed",
    "duplicate subject",
  ];

  if (!wantsText) {
    negatives.push(
      "text",
      "letters",
      "typography",
      "signage",
      "caption",
      "label",
      "fake characters",
    );
  }

  return negatives.join(", ");
}

type CloudflareEnvelope = {
  success?: boolean;
  result?: unknown;
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
  if (/quota|limit|capacity|3040|3036|rate|429/i.test(message)) {
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

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return btoa(binary);
}

function findBase64Image(value: unknown): string | null {
  if (!value) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (trimmed.startsWith("data:image/")) {
      const comma = trimmed.indexOf(",");
      return comma >= 0 ? trimmed.slice(comma + 1) : null;
    }

    // 대략적인 base64 이미지 응답 대응
    if (trimmed.length > 1000 && /^[A-Za-z0-9+/=\s]+$/.test(trimmed)) {
      return trimmed.replace(/\s/g, "");
    }

    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findBase64Image(item);
      if (found) return found;
    }
    return null;
  }

  if (typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      const found = findBase64Image(item);
      if (found) return found;
    }
  }

  return null;
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
  // SDXL-Lightning만 사용하며 다른 유료 이미지 모델로 fallback하지 않습니다.
  const model = FREE_IMAGE_MODEL;
  const prompt = buildPositivePrompt(context);
  const negativePrompt = buildNegativePrompt(context);
  const aspectRatio = detectImageAspectRatio(context);
  const { width, height } = dimensionsFor(aspectRatio);

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
      negative_prompt: negativePrompt.slice(0, 2048),
      width,
      height,
      num_steps: 4,
      guidance: 8.5,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const payload = (await response.json().catch(() => null)) as
        | CloudflareEnvelope
        | null;
      throw freeOnlyError(errorText(payload, response.status));
    }

    const raw = await response.text().catch(() => "");
    throw freeOnlyError(raw || `HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";

  // SDXL 계열은 환경에 따라 이미지 바이트 스트림을 직접 반환할 수 있습니다.
  if (contentType.startsWith("image/")) {
    const buffer = await response.arrayBuffer();

    if (!buffer.byteLength) {
      throw new Error(
        "CLOUDFLARE_IMAGE_FAILED: Cloudflare가 빈 이미지 응답을 반환했습니다.",
      );
    }

    return {
      kind: "IMAGE",
      dataBase64: arrayBufferToBase64(buffer),
      url: null,
      storagePath: null,
      mimeType: contentType.split(";")[0] || "image/jpeg",
      prompt,
      model,
      aspectRatio,
      imageSize: `${width}x${height}`,
    };
  }

  // 일부 REST 응답은 JSON envelope 안에 base64 이미지를 담아 반환할 수 있어 함께 대응합니다.
  const payload = (await response.json().catch(() => null)) as
    | CloudflareEnvelope
    | null;

  if (payload?.success === false) {
    throw freeOnlyError(errorText(payload, response.status));
  }

  const image = findBase64Image(payload?.result);

  if (!image) {
    throw new Error(
      "CLOUDFLARE_IMAGE_FAILED: SDXL-Lightning 응답에서 이미지 데이터를 찾지 못했습니다.",
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
    imageSize: `${width}x${height}`,
  };
}
