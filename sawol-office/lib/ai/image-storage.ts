import type { AiTaskAsset } from "@/lib/ai/types";

const BUCKET = "sawol-results";

function extensionFor(mimeType: string) {
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("webp")) return "webp";
  return "png";
}

export async function persistGeneratedImageAsset(
  supabase: any,
  {
    taskId,
    runId,
    asset,
  }: {
    taskId: string;
    runId: string;
    asset: AiTaskAsset;
  },
): Promise<AiTaskAsset> {
  if (!asset.dataBase64) return asset;

  const extension = extensionFor(asset.mimeType);
  const storagePath = `${taskId}/${runId}-${Date.now()}.${extension}`;
  const bytes = Buffer.from(asset.dataBase64, "base64");

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, bytes, {
      contentType: asset.mimeType,
      upsert: false,
      cacheControl: "31536000",
    });

  if (uploadError) {
    throw new Error(`생성 이미지를 Storage에 저장하지 못했습니다: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  const publicUrl = data?.publicUrl;

  if (!publicUrl) {
    throw new Error("생성 이미지의 공개 URL을 만들지 못했습니다.");
  }

  return {
    ...asset,
    dataBase64: null,
    storagePath,
    url: publicUrl,
  };
}
