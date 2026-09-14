import type { AiTaskAsset, AiTaskResult, SawolAiContext } from "@/lib/ai/types";
import { detectImageAspectRatio } from "@/lib/ai/image-policy";

const FREE_IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";

function textOf(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function originalRequestText(context: SawolAiContext) {
  const root = context.rootTask ?? {};
  const task = context.task ?? {};

  const title = textOf(root.title) || textOf(task.title);
  const description =
    textOf(root.description) ||
    textOf(task.description);

  return [title, description].filter(Boolean).join("\n").trim();
}

function hasExplicitTextRequest(request: string) {
  return /(문구|텍스트|글씨|제목|타이틀|카피|슬로건|로고명|이름|표기|써줘|적어줘|넣어줘|write|text|title|headline|caption)/i.test(
    request,
  );
}

function hasOfficeSignal(request: string) {
  return /(사무실|오피스|office|회의실|책상|의자|회사 내부|workspace)/i.test(
    request,
  );
}

function buildImagePrompt(context: SawolAiContext, result: AiTaskResult) {
  const request = originalRequestText(context);
  const aspectRatio = detectImageAspectRatio(context);
  const explicitText = hasExplicitTextRequest(request);
  const officeRequested = hasOfficeSignal(request);

  const rules = [
    "Create exactly ONE image that follows the user's original request literally.",
    "The original request below is the PRIMARY and HIGHEST-PRIORITY instruction.",
    "Do not reinterpret the request as a SAWOL OFFICE scene, workplace scene, company scene, dashboard, office interior, or business presentation.",
    "Do not add objects, scenery, furniture, architecture, signs, logos, people, brands, or themes that the user did not request.",
    "Do not replace the requested main subject with a metaphor, workplace concept, or abstract concept.",
    "Make the requested main subject immediately obvious and dominant in the image.",
    `Compose for an approximate ${aspectRatio} layout.`,
  ];

  if (!explicitText) {
    rules.push(
      "ABSOLUTELY NO TEXT: no letters, no words, no Korean characters, no English text, no signs, no labels, no typography, no watermarks.",
    );
  } else {
    rules.push(
      "Only include text that the user explicitly requested. Do not invent any additional wording.",
      "If exact Korean typography cannot be rendered reliably, prefer a clean area reserved for text rather than inventing broken or fake Korean characters.",
    );
  }

  if (!officeRequested) {
    rules.push(
      "Do not depict an office, meeting room, desk, chair, windowed workplace, corporate interior, or office signage.",
    );
  }

  return [
    "IMAGE GENERATION TASK",
    "",
    "[ORIGINAL USER REQUEST — FOLLOW THIS LITERALLY]",
    request || "(No request text available)",
    "",
    "[STRICT RULES]",
    ...rules.map((rule) => `- ${rule}`),
    "",
    "[SECONDARY CONTEXT — USE ONLY IF IT HELPS, NEVER OVERRIDE THE ORIGINAL REQUEST]",
    result.summary || "",
    "",
    "Final check before generating:",
    "1. Is the requested subject actually present?",
    "2. Are the requested colors/background/style present?",
    "3. Did you avoid all unrequested office/business elements?",
    "4. Did you avoid unrequested text?",
    "If any answer is no, fix the image before returning it.",
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

  // FREE-ONLY: 이 모델 외의 유료 이미지 모델로 자동 전환하지 않습니다.
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
