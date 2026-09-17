import type { SawolAiContext } from "@/lib/ai/types";

type MemoryRow = Record<string, unknown>;

const MAX_MEMORY_ROWS = 16;

const TYPE_WEIGHT: Record<string, number> = {
  RULE: 34,
  CEO: 32,
  DECISION: 24,
  PROJECT: 22,
  KNOWLEDGE: 18,
  FAILURE: 15,
  RESULT: 14,
  PROMPT: 10,
};

const IMPORTANCE_WEIGHT: Record<string, number> = {
  HIGH: 24,
  MEDIUM: 12,
  LOW: 4,
};

const CONFIDENCE_WEIGHT: Record<string, number> = {
  VERIFIED: 18,
  RELIABLE: 14,
  INTERNAL: 10,
  EXPERIMENTAL: 2,
  UNVERIFIED: 0,
};

const STOP_WORDS = new Set([
  "업무",
  "작업",
  "대표",
  "요청",
  "진행",
  "결과",
  "최종",
  "관련",
  "대한",
  "위한",
  "내용",
  "정리",
  "만들어",
  "해주세요",
  "해줘",
  "작성",
  "자료",
  "프로젝트",
  "사월",
  "office",
  "sawol",
]);

function text(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function tokens(value: string) {
  return [
    ...new Set(
      value
        .toLowerCase()
        .replace(/[^0-9a-zA-Z가-힣]+/g, " ")
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(
          (token) =>
            token.length >= 2 &&
            !STOP_WORDS.has(token),
        ),
    ),
  ];
}

function contextSearchText(context: SawolAiContext) {
  const task = context.task ?? {};
  const rootTask = context.rootTask ?? {};
  const project = context.project ?? {};
  const employee = context.employee ?? {};
  const department = context.department ?? {};

  return [
    text(rootTask.title),
    text(rootTask.description),
    text(task.title),
    text(task.description),
    text(task.task_type),
    text(project.name),
    text(project.title),
    text(project.description),
    text(project.initial_request),
    text(project.purpose),
    text(project.goal),
    text(employee.name),
    text(employee.role),
    text(employee.job_title),
    text(employee.specialty),
    text(employee.responsibilities),
    text(department.name),
    text(department.department_name),
    text(department.description),
  ]
    .filter(Boolean)
    .join(" ");
}

function memorySearchText(memory: MemoryRow) {
  const metadata = objectValue(memory.metadata);

  return [
    text(memory.title),
    text(memory.content),
    text(memory.category),
    text(memory.memory_type),
    text(memory.source),
    text(metadata.scope),
    text(metadata.department_name),
    text(metadata.employee_name),
    text(metadata.tags),
  ]
    .filter(Boolean)
    .join(" ");
}

function overlapScore(contextTokens: string[], memoryTokens: string[]) {
  if (!contextTokens.length || !memoryTokens.length) return 0;

  const memorySet = new Set(memoryTokens);
  let matched = 0;

  for (const token of contextTokens) {
    if (memorySet.has(token)) {
      matched += token.length >= 4 ? 5 : 3;
      continue;
    }

    const fuzzy = memoryTokens.some(
      (candidate) =>
        candidate.length >= 3 &&
        token.length >= 3 &&
        (candidate.includes(token) || token.includes(candidate)),
    );

    if (fuzzy) matched += 1;
  }

  return Math.min(36, matched);
}

function timestamp(value: unknown) {
  const raw = text(value);
  if (!raw) return 0;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function scoreMemory(
  context: SawolAiContext,
  memory: MemoryRow,
  contextTokens: string[],
) {
  const type = text(memory.memory_type).toUpperCase();
  const importance = text(memory.importance).toUpperCase();
  const confidence = text(memory.confidence).toUpperCase();
  const projectId = text(memory.project_id);
  const currentProjectId = text(context.project?.id ?? context.task?.project_id);
  const metadata = objectValue(memory.metadata);

  let score =
    (TYPE_WEIGHT[type] ?? 8) +
    (IMPORTANCE_WEIGHT[importance] ?? 6) +
    (CONFIDENCE_WEIGHT[confidence] ?? 4);

  if (projectId && currentProjectId && projectId === currentProjectId) {
    score += 48;
  } else if (projectId && currentProjectId && projectId !== currentProjectId) {
    score -= 36;
  }

  const scope = text(metadata.scope).toUpperCase();
  if (scope === "GLOBAL") score += 8;
  if (scope === "PROJECT" && projectId === currentProjectId) score += 10;

  score += overlapScore(
    contextTokens,
    tokens(memorySearchText(memory)),
  );

  // 대표 규칙·대표 기억은 특정 업무와 직접 단어가 겹치지 않아도
  // 회사 운영 원칙으로 사용할 가능성이 높습니다.
  if (type === "RULE" || type === "CEO") score += 10;

  if (confidence === "UNVERIFIED") score -= 12;
  if (confidence === "EXPERIMENTAL") score -= 6;

  return score;
}

export function selectRelevantMemories({
  context,
  memories,
  limit = MAX_MEMORY_ROWS,
}: {
  context: SawolAiContext;
  memories: MemoryRow[];
  limit?: number;
}) {
  const contextTokens = tokens(contextSearchText(context));

  return memories
    .filter((memory) => text(memory.status).toUpperCase() === "ACTIVE")
    .map((memory) => ({
      memory,
      score: scoreMemory(context, memory, contextTokens),
      updatedAt: Math.max(
        timestamp(memory.updated_at),
        timestamp(memory.last_verified_at),
        timestamp(memory.created_at),
      ),
    }))
    .filter(({ memory, score }) => {
      const type = text(memory.memory_type).toUpperCase();

      // 대표 규칙은 상시 후보. 나머지는 일정 관련성 점수 이상만 전달.
      if (type === "RULE" || type === "CEO") return score >= 34;
      return score >= 42;
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.updatedAt - a.updatedAt;
    })
    .slice(0, Math.max(1, limit))
    .map(({ memory }) => memory);
}
