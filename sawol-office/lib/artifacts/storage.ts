import type { GeneratedArtifact } from "@/lib/artifacts/types";

const BUCKET = "sawol-results";

function safeFileName(value: string, fallback: string) {
  const normalized = value
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "");

  return (normalized || fallback).slice(0, 120);
}

export async function persistGeneratedArtifacts(
  supabase: any,
  {
    taskId,
    runId,
    artifacts,
  }: {
    taskId: string;
    runId: string;
    artifacts: GeneratedArtifact[];
  },
): Promise<GeneratedArtifact[]> {
  const persisted: GeneratedArtifact[] = [];

  for (const artifact of artifacts) {
    if (!artifact.dataBase64) {
      persisted.push(artifact);
      continue;
    }

    const fileName = safeFileName(
      artifact.fileName || `${artifact.id}.${artifact.format}`,
      `${artifact.id}.${artifact.format}`,
    );
    const storagePath = `${taskId}/${runId}/files/${Date.now()}-${fileName}`;
    const bytes = Buffer.from(artifact.dataBase64, "base64");

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, bytes, {
        contentType: artifact.mimeType,
        upsert: false,
        cacheControl: "31536000",
      });

    if (uploadError) {
      throw new Error(
        `${artifact.label} 파일을 Storage에 저장하지 못했습니다: ${uploadError.message}`,
      );
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    const publicUrl = data?.publicUrl;

    if (!publicUrl) {
      throw new Error(
        `${artifact.label} 파일의 공개 URL을 만들지 못했습니다.`,
      );
    }

    persisted.push({
      ...artifact,
      dataBase64: null,
      storagePath,
      url: publicUrl,
      fileName,
      sizeBytes: bytes.byteLength,
    });
  }

  return persisted;
}
