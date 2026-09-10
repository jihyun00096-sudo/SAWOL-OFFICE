"use client";

import { useEffect, useRef, useState } from "react";

type Snapshot = {
  job: null | {
    status: string;
    progress: number;
    last_message: string | null;
    last_error: string | null;
    stale: boolean;
  };
  workflow: null | {
    total: number;
    completed: number;
    current: null | {
      title: string;
      status: string;
      employee: string | null;
    };
  };
};

type Fallback = {
  total: number;
  completed: number;
  current_title: string | null;
  current_status: string | null;
  current_employee: string | null;
} | null;

const statusLabel: Record<string, string> = {
  WAITING: "대기",
  IN_PROGRESS: "작업 중",
  REVIEW: "검수 중",
  PENDING_APPROVAL: "승인 대기",
  COMPLETED: "완료",
  ERROR: "오류",
  ON_HOLD: "보류",
  RUNNING: "자동 실행 중",
  QUEUED: "실행 대기",
  FAILED: "자동 실행 중단",
  AWAITING_APPROVAL: "대표 승인 대기",
};

export function TaskLiveProgress({
  taskId,
  taskStatus,
  executionMode,
  fallback,
}: {
  taskId: string;
  taskStatus: string;
  executionMode?: string | null;
  fallback?: Fallback;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    async function load() {
      try {
        const response = await fetch(`/api/office/tasks/${taskId}/autopilot/status`, {
          cache: "no-store",
        });
        const payload = await response.json().catch(() => null);
        if (response.ok && payload?.ok && mounted.current) {
          setSnapshot(payload);
        }
      } catch {
        // 목록은 실시간 조회 실패 시 서버 렌더 fallback을 그대로 사용합니다.
      }
    }

    void load();

    if (["COMPLETED", "PENDING_APPROVAL", "CANCELLED", "CANCELED"].includes(taskStatus)) {
      return () => {
        mounted.current = false;
      };
    }

    const timer = window.setInterval(load, 1800);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
    };
  }, [taskId, taskStatus]);

  const live = snapshot?.workflow;
  const total = live?.total ?? fallback?.total ?? 0;
  const completed = live?.completed ?? fallback?.completed ?? 0;
  const currentTitle = live?.current?.title ?? fallback?.current_title ?? null;
  const currentEmployee = live?.current?.employee ?? fallback?.current_employee ?? null;
  const currentStatus = live?.current?.status ?? fallback?.current_status ?? snapshot?.job?.status ?? null;
  const percent = snapshot?.job?.progress ?? (total ? Math.round((completed / total) * 100) : 0);

  if (!total && executionMode !== "AUTO") return null;

  const message = snapshot?.job?.last_error
    ? snapshot.job.last_error
    : snapshot?.job?.last_message;

  return (
    <div className="mt-4 rounded-[12px] bg-[#F7F9FF] px-3.5 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 text-[10px] leading-5 text-[#586173]">
          <span className="font-semibold text-[#3157D5]">
            {total ? `AI 협업 ${completed}/${total}` : "AI 자동 실행"}
          </span>
          {currentTitle ? ` · ${currentTitle}` : ""}
          {currentEmployee ? ` · ${currentEmployee}` : ""}
          {currentStatus ? ` · ${statusLabel[currentStatus] ?? currentStatus}` : ""}
        </p>
        <span className="shrink-0 text-[9px] font-semibold text-[#777F8D]">{percent}%</span>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#E4E9F6]">
        <div className="h-full rounded-full bg-[#3157D5] transition-all duration-500" style={{ width: `${percent}%` }} />
      </div>

      {message ? (
        <p className={`mt-2 line-clamp-1 text-[9px] ${snapshot?.job?.last_error ? "text-[#B64B4B]" : "text-[#8991A0]"}`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
