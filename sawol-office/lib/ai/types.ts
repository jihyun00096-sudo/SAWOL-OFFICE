export type AiResultSource = {
  title: string;
  url: string;
  note: string;
};

export type AiTaskResult = {
  title: string;
  summary: string;
  body: string;
  confidence: number;
  needs_human_review: boolean;
  sources: AiResultSource[];
};

export type SawolAiContext = {
  task: Record<string, unknown>;
  project: Record<string, unknown> | null;
  department: Record<string, unknown> | null;
  employee: Record<string, unknown> | null;
  memories: Record<string, unknown>[];
  handoffs?: Record<string, unknown>[];
  rootTask?: Record<string, unknown> | null;
};
