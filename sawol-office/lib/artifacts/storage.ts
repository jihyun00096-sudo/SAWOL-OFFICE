import type { GeneratedArtifact } from "@/lib/artifacts/types";

const BUCKET = "sawol-results";

function safeDisplayFileName(value: string, fallback: string) {
  const normalized = value
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "");

  return (normalized || fallback).slice(0, 120);
}

/**
 * Supabase Storage object key는 사용자용 파일명과 분리합니다.
 * 한글/공백/특수문자/말줄임표 등이 들어간 제목을 key에 그대로 사용하면
 * "Invalid key"가 발생할 수 있으므로 Storage 내부 경로는 ASCII-only로 생성합니다.
 *
 * 사용자에게 보이는 실제 파일명은 safeDisplayFileName()으로 별도 보존합니다.
 */
function storageObjectName(artifact: GeneratedArtifact, index: number) {
  const rawFormat =
    typeof artifact.format === "string" && artifact.format
      ? artifact.format.toLowerCase()
      : "bin";

  const extension = rawFormat.replace(/[^a-z0-9]/g, "") || "bin";
  const kind =
    typeof artifact.kind === "string"
      ? artifact.kind.toLowerCase().replace(/[^a-z0-9_-]/g, "")
      : "artifact";

  const random = crypto.randomUUID();

  return `${kind || "artifact"}-${index + 1}-${random}.${extension}`;
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

  for (const [index, artifact] of artifacts.entries()) {
    if (!artifact.dataBase64) {
      persisted.push(artifact);
      continue;
    }

    const fileName = safeDisplayFileName(
      artifact.fileName || `${artifact.id}.${artifact.format}`,
      `${artifact.id}.${artifact.format}`,
    );

    // Storage 내부 key는 사용자 입력/한글 제목을 사용하지 않습니다.
    // 화면과 다운로드용 이름(fileName)은 그대로 유지합니다.
    const objectName = storageObjectName(artifact, index);
    const storagePath = `${taskId}/${runId}/files/${objectName}`;
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
