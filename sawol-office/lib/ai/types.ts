import type {
  ArtifactPlan,
  GeneratedArtifact,
} from "@/lib/artifacts/types";

export type AiResultSource = {
  title: string;
  url: string;
  note: string;
};

export type AiTaskAsset = {
  kind: "IMAGE";
  url?: string | null;
  storagePath?: string | null;
  mimeType: string;
  /** 실제 이미지 모델에 전달된 최종 positive prompt */
  prompt: string;
  /** 실제 이미지 모델에 전달된 negative prompt */
  negativePrompt?: string | null;
  /** 대표가 입력한 원문 요청 */
  sourcePrompt?: string | null;
  /** 프롬프트 번역/정리 단계 정보 */
  translationProvider?: string | null;
  translationModel?: string | null;
  model: string;
  aspectRatio: string;
  imageSize: string;
  /** 서버에서 Storage에 올리기 전까지만 사용하는 임시 데이터 */
  dataBase64?: string | null;
};

export type AiTaskResult = {
  title: string;
  summary: string;
  body: string;
  confidence: number;
  needs_human_review: boolean;
  sources: AiResultSource[];
  asset?: AiTaskAsset | null;
  /**
   * STEP25 범용 산출물.
   * 기존 IMAGE asset은 호환성을 위해 그대로 유지합니다.
   */
  artifacts?: GeneratedArtifact[] | null;
  artifact_plan?: ArtifactPlan | null;
};

export type SawolAiContext = {
  task: Record<string, unknown>;
  project: Record<string, unknown> | null;
  department: Record<string, unknown> | null;
  employee: Record<string, unknown> | null;
  memories: Record<string, unknown>[];
  handoffs?: Record<string, unknown>[];
  rootTask?: Record<string, unknown> | null;
  feedbacks?: Record<string, unknown>[];
};
