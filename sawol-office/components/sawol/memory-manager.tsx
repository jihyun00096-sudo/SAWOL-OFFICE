"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MemoryDeleteButton } from "@/components/sawol/memory-delete-button";
import { createClient } from "@/lib/supabase/client";
import { createHumanCode } from "@/lib/sawol/code";
import { memoryTypeLabel, labelOf } from "@/lib/sawol/labels";

type Memory = {
  id: string;
  memory_code: string;
  memory_type: string;
  category: string | null;
  title: string;
  content: string;
  importance: string;
  confidence: string;
  status: string;
  source: string | null;
  project_id: string | null;
  metadata?: Record<string, unknown> | null;
  last_verified_at?: string | null;
  updated_at?: string | null;
  created_at: string;
};

type Project = {
  id: string;
  project_code?: string | null;
  name?: string | null;
  title?: string | null;
  status?: string | null;
};

const importanceLabel: Record<string, string> = {
  HIGH: "높음",
  MEDIUM: "보통",
  LOW: "낮음",
};

const confidenceLabel: Record<string, string> = {
  VERIFIED: "검증됨",
  RELIABLE: "신뢰 가능",
  INTERNAL: "내부 정보",
  EXPERIMENTAL: "실험적",
  UNVERIFIED: "미검증",
};

const sourceLabel: Record<string, string> = {
  CEO_MANUAL: "대표 직접 등록",
  CEO: "대표",
  INTERNAL: "내부",
  SYSTEM: "시스템",
  PROJECT: "프로젝트",
  TASK: "업무",
  RESULT: "승인 결과",
};

const categoryLabel: Record<string, string> = {
  COMPANY_RULE: "회사 규칙",
  CEO_PREFERENCE: "대표 선호",
  PROJECT_CONTEXT: "프로젝트 맥락",
  OPERATING_DECISION: "운영 결정",
  EXPERTISE: "전문 지식",
  LESSON: "실패·교훈",
  APPROVED_RESULT: "승인 결과",
  EXTERNAL_APP: "외부 앱",
  WORK_STYLE: "업무 방식",
  DESIGN: "디자인",
  COST: "비용",
};

const categoryOptions = [
  ["COMPANY_RULE", "회사 규칙"],
  ["CEO_PREFERENCE", "대표 선호"],
  ["PROJECT_CONTEXT", "프로젝트 맥락"],
  ["OPERATING_DECISION", "운영 결정"],
  ["EXPERTISE", "전문 지식"],
  ["LESSON", "실패·교훈"],
  ["APPROVED_RESULT", "승인 결과"],
  ["EXTERNAL_APP", "외부 앱"],
  ["WORK_STYLE", "업무 방식"],
  ["DESIGN", "디자인"],
  ["COST", "비용"],
] as const;

function projectName(project: Project) {
  return (
    project.name?.trim() ||
    project.title?.trim() ||
    project.project_code?.trim() ||
    "이름 없는 프로젝트"
  );
}

function metadataOf(memory: Memory) {
  return memory.metadata && typeof memory.metadata === "object"
    ? memory.metadata
    : {};
}

function memoryScope(memory: Memory) {
  const metadata = metadataOf(memory);
  const explicit =
    typeof metadata.scope === "string"
      ? metadata.scope.toUpperCase()
      : "";

  if (explicit === "PROJECT" || memory.project_id) return "PROJECT";
  return "GLOBAL";
}

function isReliable(memory: Memory) {
  return ["VERIFIED", "RELIABLE", "INTERNAL"].includes(
    memory.confidence,
  );
}

export function MemoryManager({
  memories,
  projects,
}: {
  memories: Memory[];
  projects: Project[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [scope, setScope] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [newScope, setNewScope] = useState<"GLOBAL" | "PROJECT">(
    "GLOBAL",
  );

  const projectMap = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );

  const summary = useMemo(() => {
    const high = memories.filter(
      (memory) => memory.importance === "HIGH",
    ).length;
    const verified = memories.filter(
      (memory) => memory.confidence === "VERIFIED",
    ).length;
    const projectScoped = memories.filter(
      (memory) => memoryScope(memory) === "PROJECT",
    ).length;
    const rules = memories.filter((memory) =>
      ["RULE", "CEO"].includes(memory.memory_type),
    ).length;

    return {
      total: memories.length,
      high,
      verified,
      projectScoped,
      rules,
    };
  }, [memories]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    return memories.filter((memory) => {
      const metadata = metadataOf(memory);
      const searchable = [
        memory.title,
        memory.content,
        memory.category ?? "",
        memory.source ?? "",
        String(metadata.tags ?? ""),
      ]
        .join(" ")
        .toLowerCase();

      const matches = !query || searchable.includes(query);
      const typeMatches = !type || memory.memory_type === type;
      const scopeMatches =
        !scope || memoryScope(memory) === scope;

      return matches && typeMatches && scopeMatches;
    });
  }, [memories, q, type, scope]);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const content = String(form.get("content") ?? "").trim();
    const projectId =
      newScope === "PROJECT"
        ? String(form.get("project_id") ?? "").trim()
        : "";

    if (!title || !content) {
      setError("제목과 기억 내용은 필수입니다.");
      return;
    }

    if (newScope === "PROJECT" && !projectId) {
      setError("프로젝트 전용 기억은 연결할 프로젝트를 선택해 주세요.");
      return;
    }

    setBusy(true);
    setError("");

    const supabase = createClient();
    const now = new Date().toISOString();

    const { error: insertError } = await supabase
      .from("memories")
      .insert({
        memory_code: createHumanCode("MEM"),
        memory_type: String(form.get("memory_type") ?? "CEO"),
        category:
          String(form.get("category") ?? "").trim() || null,
        title,
        content,
        importance: String(
          form.get("importance") ?? "MEDIUM",
        ),
        confidence: String(
          form.get("confidence") ?? "INTERNAL",
        ),
        status: "ACTIVE",
        source: "CEO_MANUAL",
        project_id: projectId || null,
        effective_from: now,
        last_verified_at:
          String(form.get("confidence") ?? "INTERNAL") === "VERIFIED"
            ? now
            : null,
        metadata: {
          scope: newScope,
          tags: String(form.get("tags") ?? "").trim() || null,
          provider_neutral: true,
          created_by: "CEO",
        },
      });

    if (insertError) {
      console.error(insertError);
      setError("기억 저장에 실패했습니다.");
      setBusy(false);
      return;
    }

    setOpen(false);
    setNewScope("GLOBAL");
    router.refresh();
    setBusy(false);
  }

  return (
    <>
      <section className="mt-6 overflow-hidden rounded-[22px] border border-[#DDE6ED] bg-white shadow-[0_12px_40px_rgba(31,55,76,0.04)]">
        <div className="grid gap-px bg-[#E8EDF1] sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["활성 기억", summary.total, "회사 전체 기억"],
            ["대표 규칙", summary.rules, "RULE · CEO"],
            ["중요 기억", summary.high, "우선 적용 후보"],
            ["검증 완료", summary.verified, "신뢰도 VERIFIED"],
            [
              "프로젝트 기억",
              summary.projectScoped,
              "해당 프로젝트에서 우선",
            ],
          ].map(([label, value, note]) => (
            <div key={String(label)} className="bg-white p-4">
              <p className="text-[9px] font-semibold text-[#85919B]">
                {label}
              </p>
              <p className="mt-2 text-[22px] font-black tracking-[-0.04em] text-[#2B3944]">
                {value}
              </p>
              <p className="mt-1 text-[8px] text-[#A0A8AF]">
                {note}
              </p>
            </div>
          ))}
        </div>

        <div className="border-t border-[#E8EDF1] bg-[#F8FBFD] px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold text-[#536A7A]">
                Provider-neutral Memory OS
              </p>
              <p className="mt-1 text-[9px] leading-4 text-[#8D99A3]">
                Gemini·Claude 등 어떤 AI를 사용해도 같은 기억 저장소를
                사용하고, 업무·프로젝트에 맞는 기억만 실행 직전에
                선별합니다.
              </p>
            </div>
            <span className="w-fit rounded-full border border-[#D4E4EE] bg-white px-2.5 py-1 text-[8px] font-semibold text-[#5A7B92]">
              AI 모델과 기억 분리 완료
            </span>
          </div>
        </div>
      </section>

      <div className="mt-4 flex flex-col gap-3 rounded-[16px] border border-[#E7E9EE] bg-white p-4 lg:flex-row">
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="제목 · 내용 · 태그 검색"
          className="h-10 min-w-0 flex-1 rounded-[10px] border border-[#E1E4E9] px-3 text-[12px] outline-none focus:border-[#76A7C7]"
        />

        <select
          value={type}
          onChange={(event) => setType(event.target.value)}
          className="h-10 rounded-[10px] border border-[#E1E4E9] px-3 text-[11px] lg:w-[160px]"
        >
          <option value="">모든 기억 유형</option>
          {Object.entries(memoryTypeLabel).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={scope}
          onChange={(event) => setScope(event.target.value)}
          className="h-10 rounded-[10px] border border-[#E1E4E9] px-3 text-[11px] lg:w-[150px]"
        >
          <option value="">모든 범위</option>
          <option value="GLOBAL">회사 전체</option>
          <option value="PROJECT">프로젝트 전용</option>
        </select>

        <button
          onClick={() => setOpen(true)}
          className="h-10 rounded-[10px] bg-[#263B4B] px-4 text-[11px] font-semibold text-white transition hover:bg-[#1D2F3C]"
        >
          새 기억
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <p className="text-[10px] text-[#969BA5]">
          {filtered.length}건 표시
        </p>
        <p className="text-[9px] text-[#A2A9B0]">
          대표 규칙 → 프로젝트 전용 → 관련 지식 순으로 AI가 선별
        </p>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        {filtered.map((memory) => {
          const project = memory.project_id
            ? projectMap.get(memory.project_id)
            : null;
          const memoryScopeLabel =
            memoryScope(memory) === "PROJECT"
              ? project
                ? projectName(project)
                : "프로젝트 전용"
              : "회사 전체";

          return (
            <article
              key={memory.id}
              className="rounded-[18px] border border-[#E4E9ED] bg-white p-5 transition hover:border-[#C9D9E4] hover:shadow-[0_8px_24px_rgba(29,54,72,0.04)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5 text-[8px]">
                  <span className="rounded-full bg-[#EDF5FB] px-2.5 py-1 font-semibold text-[#4D7997]">
                    {labelOf(memoryTypeLabel, memory.memory_type)}
                  </span>

                  <span className="rounded-full bg-[#F3F5F6] px-2.5 py-1 font-medium text-[#67727C]">
                    {memoryScopeLabel}
                  </span>

                  <span className="rounded-full bg-[#F3F5F6] px-2.5 py-1 text-[#737984]">
                    중요도 {labelOf(importanceLabel, memory.importance)}
                  </span>

                  <span
                    className={`rounded-full px-2.5 py-1 ${
                      isReliable(memory)
                        ? "bg-[#EEF8F2] text-[#4B765C]"
                        : "bg-[#FFF5E5] text-[#8A692C]"
                    }`}
                  >
                    {labelOf(confidenceLabel, memory.confidence)}
                  </span>
                </div>

                <MemoryDeleteButton
                  memoryId={memory.id}
                  memoryTitle={memory.title}
                />
              </div>

              <h2 className="mt-4 text-[13px] font-semibold text-[#2D353D]">
                {memory.title}
              </h2>

              <p className="mt-2 line-clamp-6 whitespace-pre-wrap text-[11px] leading-5 text-[#707A84]">
                {memory.content}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[8px] text-[#A1A7AE]">
                <span>{memory.memory_code}</span>
                <span>·</span>
                <span>
                  {memory.category
                    ? labelOf(categoryLabel, memory.category)
                    : "미분류"}
                </span>
                <span>·</span>
                <span>
                  {memory.source
                    ? labelOf(sourceLabel, memory.source)
                    : "출처 없음"}
                </span>
              </div>
            </article>
          );
        })}
      </div>

      {!filtered.length ? (
        <div className="mt-4 rounded-[18px] border border-dashed border-[#DCE2E7] bg-[#FAFBFC] px-5 py-12 text-center">
          <p className="text-[11px] font-semibold text-[#65717B]">
            조건에 맞는 기억이 없습니다.
          </p>
          <p className="mt-1 text-[9px] text-[#A0A7AE]">
            검색 조건을 바꾸거나 새 기억을 등록해 주세요.
          </p>
        </div>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4 backdrop-blur-[2px]">
          <div className="max-h-[92vh] w-full max-w-[620px] overflow-y-auto rounded-[22px] bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[16px] font-semibold text-[#252D34]">
                  새 기억 등록
                </h2>
                <p className="mt-1 text-[9px] leading-4 text-[#929AA2]">
                  AI 모델 자체가 아니라 SAWOL OFFICE에 저장됩니다.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setError("");
                }}
                className="text-[11px] text-[#7D838E]"
              >
                닫기
              </button>
            </div>

            <form onSubmit={add} className="mt-5 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewScope("GLOBAL")}
                  className={`rounded-[12px] border px-3 py-3 text-left transition ${
                    newScope === "GLOBAL"
                      ? "border-[#9FC0D5] bg-[#F2F8FC]"
                      : "border-[#E2E6EA] bg-white"
                  }`}
                >
                  <p className="text-[10px] font-semibold text-[#455560]">
                    회사 전체 기억
                  </p>
                  <p className="mt-1 text-[8px] leading-4 text-[#929AA2]">
                    규칙·대표 선호·공통 지식
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setNewScope("PROJECT")}
                  className={`rounded-[12px] border px-3 py-3 text-left transition ${
                    newScope === "PROJECT"
                      ? "border-[#9FC0D5] bg-[#F2F8FC]"
                      : "border-[#E2E6EA] bg-white"
                  }`}
                >
                  <p className="text-[10px] font-semibold text-[#455560]">
                    프로젝트 전용
                  </p>
                  <p className="mt-1 text-[8px] leading-4 text-[#929AA2]">
                    해당 프로젝트 업무에서 우선
                  </p>
                </button>
              </div>

              {newScope === "PROJECT" ? (
                <select
                  name="project_id"
                  defaultValue=""
                  className="h-11 w-full rounded-[10px] border border-[#E1E4E9] px-3 text-[11px]"
                >
                  <option value="">연결 프로젝트 선택 *</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {projectName(project)}
                    </option>
                  ))}
                </select>
              ) : null}

              <input
                name="title"
                placeholder="기억 제목 *"
                className="h-11 w-full rounded-[10px] border border-[#E1E4E9] px-3 text-[12px]"
              />

              <textarea
                name="content"
                rows={6}
                placeholder="AI 직원들이 실제 업무에서 참고해야 할 내용을 구체적으로 입력하세요. *"
                className="w-full rounded-[10px] border border-[#E1E4E9] px-3 py-2.5 text-[12px] leading-5"
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  name="memory_type"
                  defaultValue="RULE"
                  className="h-10 rounded-[10px] border border-[#E1E4E9] px-3 text-[11px]"
                >
                  {Object.entries(memoryTypeLabel).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>

                <select
                  name="category"
                  defaultValue="COMPANY_RULE"
                  className="h-10 rounded-[10px] border border-[#E1E4E9] px-3 text-[11px]"
                >
                  <option value="">카테고리 없음</option>
                  {categoryOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>

                <select
                  name="importance"
                  defaultValue="HIGH"
                  className="h-10 rounded-[10px] border border-[#E1E4E9] px-3 text-[11px]"
                >
                  <option value="HIGH">중요도 높음</option>
                  <option value="MEDIUM">중요도 보통</option>
                  <option value="LOW">중요도 낮음</option>
                </select>

                <select
                  name="confidence"
                  defaultValue="INTERNAL"
                  className="h-10 rounded-[10px] border border-[#E1E4E9] px-3 text-[11px]"
                >
                  <option value="VERIFIED">검증됨</option>
                  <option value="RELIABLE">신뢰 가능</option>
                  <option value="INTERNAL">내부 정보</option>
                  <option value="EXPERIMENTAL">실험적</option>
                  <option value="UNVERIFIED">미검증</option>
                </select>
              </div>

              <input
                name="tags"
                placeholder="태그 (선택) 예: 디자인, CS, 재개발"
                className="h-10 w-full rounded-[10px] border border-[#E1E4E9] px-3 text-[11px]"
              />

              <div className="rounded-[12px] border border-[#DCE8EF] bg-[#F7FBFD] px-3.5 py-3">
                <p className="text-[9px] font-semibold text-[#56778D]">
                  기억 사용 방식
                </p>
                <p className="mt-1 text-[8px] leading-4 text-[#8A9AA5]">
                  저장된 모든 기억을 매번 AI에 보내지 않습니다. 대표 규칙,
                  프로젝트 일치 여부, 중요도, 신뢰도, 현재 업무와의 연관성을
                  계산해 실행마다 필요한 기억만 최대 16건 선별합니다.
                </p>
              </div>

              {error ? (
                <p className="rounded-[9px] bg-[#FFF1F1] px-3 py-2 text-[10px] text-[#B14444]">
                  {error}
                </p>
              ) : null}

              <button
                disabled={busy}
                className="h-11 w-full rounded-[10px] bg-[#263B4B] text-[11px] font-semibold text-white disabled:opacity-50"
              >
                {busy ? "저장 중..." : "SAWOL OFFICE에 기억 저장"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
