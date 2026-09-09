"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  created_at: string;
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
  RESULT: "결과",
};

export function MemoryManager({ memories }: { memories: Memory[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    return memories.filter((memory) => {
      const matches =
        !query ||
        memory.title.toLowerCase().includes(query) ||
        memory.content.toLowerCase().includes(query) ||
        (memory.category ?? "").toLowerCase().includes(query);

      return matches && (!type || memory.memory_type === type);
    });
  }, [memories, q, type]);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const content = String(form.get("content") ?? "").trim();

    if (!title || !content) {
      setError("제목과 기억 내용은 필수입니다.");
      return;
    }

    setBusy(true);
    setError("");

    const supabase = createClient();

    const { error: insertError } = await supabase.from("memories").insert({
      memory_code: createHumanCode("MEM"),
      memory_type: String(form.get("memory_type") ?? "CEO"),
      category: String(form.get("category") ?? "").trim() || null,
      title,
      content,
      importance: String(form.get("importance") ?? "MEDIUM"),
      confidence: String(form.get("confidence") ?? "INTERNAL"),
      status: "ACTIVE",
      source: "CEO_MANUAL",
      effective_from: new Date().toISOString(),
    });

    if (insertError) {
      console.error(insertError);
      setError("기억 저장에 실패했습니다.");
      setBusy(false);
      return;
    }

    setOpen(false);
    router.refresh();
    setBusy(false);
  }

  return (
    <>
      <div className="mt-6 flex flex-col gap-3 rounded-[16px] border border-[#E7E9EE] bg-white p-4 sm:flex-row">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="기억 검색"
          className="h-10 flex-1 rounded-[10px] border border-[#E1E4E9] px-3 text-[12px] outline-none focus:border-[#3157D5]"
        />

        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="h-10 rounded-[10px] border border-[#E1E4E9] px-3 text-[11px] sm:w-[170px]"
        >
          <option value="">모든 기억</option>
          {Object.entries(memoryTypeLabel).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <button
          onClick={() => setOpen(true)}
          className="h-10 rounded-[10px] bg-[#17181C] px-4 text-[11px] font-semibold text-white"
        >
          새 기억
        </button>
      </div>

      <p className="mt-3 text-[10px] text-[#969BA5]">
        {filtered.length}건 표시
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {filtered.map((memory) => (
          <article
            key={memory.id}
            className="rounded-[17px] border border-[#E7E9EE] bg-white p-5"
          >
            <div className="flex flex-wrap items-center gap-2 text-[9px]">
              <span className="rounded-full bg-[#EEF2FF] px-2.5 py-1 font-medium text-[#3157D5]">
                {labelOf(memoryTypeLabel, memory.memory_type)}
              </span>

              <span className="rounded-full bg-[#F4F5F7] px-2.5 py-1 text-[#737984]">
                {labelOf(importanceLabel, memory.importance)}
              </span>

              <span className="rounded-full bg-[#F4F5F7] px-2.5 py-1 text-[#737984]">
                {labelOf(confidenceLabel, memory.confidence)}
              </span>

              {memory.category ? (
                <span className="text-[#999EA7]">{memory.category}</span>
              ) : null}
            </div>

            <h2 className="mt-4 text-[13px] font-semibold">{memory.title}</h2>

            <p className="mt-2 whitespace-pre-wrap text-[11px] leading-5 text-[#737984]">
              {memory.content}
            </p>

            <p className="mt-4 text-[9px] text-[#A1A6AF]">
              {memory.memory_code} ·{" "}
              {memory.source
                ? labelOf(sourceLabel, memory.source)
                : "출처 없음"}
            </p>
          </article>
        ))}
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-[560px] rounded-[22px] bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex justify-between">
              <h2 className="text-[16px] font-semibold">새 기억 등록</h2>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[11px] text-[#7D838E]"
              >
                닫기
              </button>
            </div>

            <form onSubmit={add} className="mt-5 space-y-3">
              <input
                name="title"
                placeholder="기억 제목 *"
                className="h-11 w-full rounded-[10px] border border-[#E1E4E9] px-3 text-[12px]"
              />

              <textarea
                name="content"
                rows={5}
                placeholder="기억할 내용 *"
                className="w-full rounded-[10px] border border-[#E1E4E9] px-3 py-2.5 text-[12px]"
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  name="memory_type"
                  defaultValue="CEO"
                  className="h-10 rounded-[10px] border border-[#E1E4E9] px-3 text-[11px]"
                >
                  {Object.entries(memoryTypeLabel).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>

                <input
                  name="category"
                  placeholder="카테고리 (선택)"
                  className="h-10 rounded-[10px] border border-[#E1E4E9] px-3 text-[11px]"
                />

                <select
                  name="importance"
                  defaultValue="MEDIUM"
                  className="h-10 rounded-[10px] border border-[#E1E4E9] px-3 text-[11px]"
                >
                  <option value="HIGH">높음</option>
                  <option value="MEDIUM">보통</option>
                  <option value="LOW">낮음</option>
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

              {error ? (
                <p className="rounded-[9px] bg-[#FFF1F1] px-3 py-2 text-[10px] text-[#B14444]">
                  {error}
                </p>
              ) : null}

              <button
                disabled={busy}
                className="h-11 w-full rounded-[10px] bg-[#17181C] text-[11px] font-semibold text-white disabled:opacity-50"
              >
                {busy ? "저장 중..." : "기억 저장"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
