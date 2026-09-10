"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/sawol/status-badge";
import { TaskLiveProgress } from "@/components/sawol/task-live-progress";
import {
  labelOf,
  priorityLabel,
  taskStatusLabel,
} from "@/lib/sawol/labels";

type WorkflowSummary = {
  total: number;
  completed: number;
  current_title: string | null;
  current_status: string | null;
  current_employee: string | null;
} | null;

type Task = {
  id: string;
  task_code: string;
  title: string;
  description: string | null;
  task_type: string;
  status: string;
  priority: string;
  created_at: string;
  execution_mode?: string | null;
  workflow_id?: string | null;
  is_workflow_root?: boolean | null;
  employees: { name: string; employee_code: string } | null;
  departments: { name: string } | null;
  workflow_summary?: WorkflowSummary;
};

const taskTypeLabel: Record<string, string> = {
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


export function TaskBrowser({ tasks }: { tasks: Task[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return tasks.filter((task) => {
      const searchMatch =
        !q ||
        task.title.toLowerCase().includes(q) ||
        task.task_code.toLowerCase().includes(q) ||
        (task.description ?? "").toLowerCase().includes(q) ||
        task.task_type.toLowerCase().includes(q) ||
        (taskTypeLabel[task.task_type] ?? "").toLowerCase().includes(q) ||
        (task.workflow_summary?.current_title ?? "").toLowerCase().includes(q) ||
        (task.workflow_summary?.current_employee ?? "").toLowerCase().includes(q);

      return (
        searchMatch &&
        (!status || task.status === status) &&
        (!priority || task.priority === priority)
      );
    });
  }, [tasks, query, status, priority]);

  const control =
    "h-10 rounded-[10px] border border-[#E1E4E9] bg-white px-3 text-[11px] outline-none focus:border-[#3157D5]";

  return (
    <>
      <div className="mt-6 grid gap-3 rounded-[16px] border border-[#E7E9EE] bg-white p-4 sm:grid-cols-[1fr_170px_150px]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="제목 · 코드 · 설명 · 유형 검색"
          className={control}
        />

        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className={control}
        >
          <option value="">모든 상태</option>
          {Object.entries(taskStatusLabel).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={priority}
          onChange={(event) => setPriority(event.target.value)}
          className={control}
        >
          <option value="">모든 우선순위</option>
          {Object.entries(priorityLabel).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <p className="mt-3 text-[10px] text-[#969BA5]">
        메인 업무 {filtered.length}개
      </p>

      <div className="mt-3 space-y-3">
        {filtered.map((task) => {
          const workflow = task.workflow_summary;
          return (
            <Link
              href={`/tasks/${task.id}`}
              key={task.id}
              className="block rounded-[17px] border border-[#E7E9EE] bg-white p-5 transition hover:border-[#D7DBE3]"
            >
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  value={task.status}
                  label={labelOf(taskStatusLabel, task.status)}
                />
                <StatusBadge
                  value={task.priority}
                  label={labelOf(priorityLabel, task.priority)}
                />
                <span className="text-[10px] text-[#9A9FAA]">
                  {taskTypeLabel[task.task_type] ?? task.task_type}
                </span>
                {workflow ? (
                  <span className="rounded-full bg-[#EEF2FF] px-2 py-1 text-[9px] font-semibold text-[#3157D5]">
                    AI 협업 {workflow.completed}/{workflow.total}
                  </span>
                ) : null}
                {task.execution_mode ? (
                  <span className="rounded-full bg-[#F5F6F8] px-2 py-1 text-[9px] text-[#747B86]">
                    {task.execution_mode === "AUTO" ? "자동" : "수동"}
                  </span>
                ) : null}
              </div>

              <h2 className="mt-3 text-[14px] font-semibold">{task.title}</h2>

              {task.description ? (
                <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-[#818791]">
                  {task.description}
                </p>
              ) : null}

              {workflow || task.execution_mode === "AUTO" ? (
                <TaskLiveProgress
                  taskId={task.id}
                  taskStatus={task.status}
                  executionMode={task.execution_mode}
                  fallback={workflow}
                />
              ) : null}

              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[10px] text-[#999EA7]">
                <span>{task.task_code}</span>
                {!workflow ? (
                  <>
                    <span>직원: {task.employees?.name ?? "미배정"}</span>
                    <span>부서: {task.departments?.name ?? "미배정"}</span>
                  </>
                ) : (
                  <span>세부 단계는 메인 업무 상세에서 확인</span>
                )}
                <span>{new Date(task.created_at).toLocaleDateString("ko-KR")}</span>
              </div>
            </Link>
          );
        })}

        {!filtered.length ? (
          <div className="rounded-[18px] border border-dashed border-[#DDE1E7] bg-white p-10 text-center">
            <p className="text-[12px] text-[#777D87]">
              조건에 맞는 업무가 없습니다.
            </p>
          </div>
        ) : null}
      </div>
    </>
  );
}
