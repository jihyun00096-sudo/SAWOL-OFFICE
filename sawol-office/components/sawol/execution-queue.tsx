"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type QueueTask = {
  id: string;
  task_code: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  task_type: string;
  requires_ceo_approval: boolean;
  created_at: string;
  employees: { name: string } | null;
  departments: { name: string } | null;
};

const mainStatuses = [
  ["WAITING", "대기"],
  ["IN_PROGRESS", "작업 중"],
  ["REVIEW", "검수 대기"],
  ["PENDING_APPROVAL", "대표 승인 대기"],
  ["COMPLETED", "완료"],
] as const;

const exceptionStatuses = [
  ["ON_HOLD", "보류"],
  ["ERROR", "오류"],
] as const;

const priorityLabel: Record<string, string> = {
  URGENT: "긴급",
  HIGH: "높음",
  NORMAL: "보통",
  LOW: "낮음",
};

const typeLabel: Record<string, string> = {
  RESEARCH: "리서치",
  PLANNING: "기획",
  PRODUCTION: "제작",
  EDIT: "수정",
  ANALYSIS: "분석",
  OPERATION: "운영",
  STUDY: "학습",
  DEVELOPMENT: "개발",
  DESIGN: "디자인",
  OTHER: "기타",
};

function TaskCard({ task }: { task: QueueTask }) {
  return (
    <Link
      href={`/tasks/${task.id}`}
      className="block rounded-[14px] border border-[#E4E7EC] bg-white p-4 transition hover:border-[#D5D9E1] hover:shadow-[0_8px_24px_rgba(20,28,45,0.035)]"
    >
      <div className="flex flex-wrap gap-1.5">
        <span className="rounded-full bg-[#F4F5F7] px-2 py-1 text-[8px] text-[#777D87]">
          {priorityLabel[task.priority] ?? task.priority}
        </span>
        <span className="rounded-full bg-[#F4F5F7] px-2 py-1 text-[8px] text-[#777D87]">
          {typeLabel[task.task_type] ?? task.task_type}
        </span>
        {task.requires_ceo_approval ? (
          <span className="rounded-full bg-[#FFF5DD] px-2 py-1 text-[8px] text-[#8A6824]">
            대표 승인
          </span>
        ) : null}
      </div>

      <p className="mt-3 break-words text-[11px] font-semibold leading-5">
        {task.title}
      </p>

      <div className="mt-3 space-y-1 text-[9px] text-[#999EA7]">
        <p>직원 · {task.employees?.name ?? "미배정"}</p>
        <p>부서 · {task.departments?.name ?? "미배정"}</p>
      </div>
    </Link>
  );
}

export function ExecutionQueue({ tasks }: { tasks: QueueTask[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return tasks;

    return tasks.filter(
      (task) =>
        task.title.toLowerCase().includes(q) ||
        task.task_code.toLowerCase().includes(q) ||
        (task.description ?? "").toLowerCase().includes(q) ||
        (task.employees?.name ?? "").toLowerCase().includes(q) ||
        (task.departments?.name ?? "").toLowerCase().includes(q),
    );
  }, [tasks, query]);

  return (
    <>
      <div className="mt-6 rounded-[16px] border border-[#E7E9EE] bg-white p-4">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="업무 · 직원 · 부서 검색"
          className="h-10 w-full rounded-[10px] border border-[#E1E4E9] px-3 text-[11px] outline-none focus:border-[#3157D5]"
        />
      </div>

      <section className="mt-5">
        <div className="mb-3">
          <h2 className="text-[13px] font-semibold">핵심 진행 흐름</h2>
          <p className="mt-1 text-[9px] text-[#959AA4]">
            대기부터 완료까지 기본 업무 흐름입니다.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {mainStatuses.map(([status, label]) => {
            const columnTasks = filtered.filter((task) => task.status === status);

            return (
              <div
                key={status}
                className="min-w-0 rounded-[17px] bg-[#EEF0F4]/80 p-3"
              >
                <div className="flex items-center justify-between px-1 py-1">
                  <h3 className="text-[10px] font-semibold">{label}</h3>
                  <span className="rounded-full bg-white px-2 py-1 text-[8px] text-[#7D838D]">
                    {columnTasks.length}
                  </span>
                </div>

                <div className="mt-2 space-y-2">
                  {columnTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}

                  {!columnTasks.length ? (
                    <div className="rounded-[12px] border border-dashed border-[#D8DCE3] bg-white/60 px-3 py-6 text-center">
                      <p className="text-[9px] text-[#A0A5AE]">업무 없음</p>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-3">
          <h2 className="text-[13px] font-semibold">예외 처리</h2>
          <p className="mt-1 text-[9px] text-[#959AA4]">
            보류되거나 오류가 발생한 업무만 별도로 관리합니다.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {exceptionStatuses.map(([status, label]) => {
            const columnTasks = filtered.filter((task) => task.status === status);

            return (
              <div
                key={status}
                className={`rounded-[17px] p-3 ${
                  status === "ERROR" ? "bg-[#FFF4F4]" : "bg-[#F3F4F6]"
                }`}
              >
                <div className="flex items-center justify-between px-1 py-1">
                  <h3 className="text-[10px] font-semibold">{label}</h3>
                  <span className="rounded-full bg-white px-2 py-1 text-[8px] text-[#7D838D]">
                    {columnTasks.length}
                  </span>
                </div>

                <div className="mt-2 grid gap-2 lg:grid-cols-2">
                  {columnTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}

                  {!columnTasks.length ? (
                    <div className="rounded-[12px] border border-dashed border-[#D8DCE3] bg-white/60 px-3 py-5 text-center lg:col-span-2">
                      <p className="text-[9px] text-[#A0A5AE]">업무 없음</p>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
