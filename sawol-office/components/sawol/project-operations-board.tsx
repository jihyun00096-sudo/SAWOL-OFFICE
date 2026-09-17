"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/sawol/status-badge";
import { labelOf, taskStatusLabel } from "@/lib/sawol/labels";

type RootTask = {
  id: string;
  task_code: string;
  title: string;
  status: string;
  priority: string;
  execution_mode?: string | null;
  workflow_id?: string | null;
  assigned_employee_id?: string | null;
  employees?: { name: string } | null;
  departments?: { name: string } | null;
  created_at: string;
};

type WorkflowStep = {
  id: string;
  parent_task_id?: string | null;
  workflow_id?: string | null;
  title: string;
  status: string;
  workflow_step_no?: number | null;
  employees?: { name: string } | null;
  departments?: { name: string } | null;
};

type Handoff = {
  id: string;
  from_task_id: string;
  to_task_id: string;
  title: string;
  created_at: string;
};

type Feedback = {
  id: string;
  root_task_id: string;
  reason: string;
  status: string;
  created_at: string;
};

const activeStatuses = new Set([
  "IN_PROGRESS",
  "COLLABORATING",
  "IN_REVIEW",
  "APPROVAL_WAIT",
  "PENDING_APPROVAL",
  "REVISION_REQUESTED",
  "WAITING_FOR_DATA",
]);

function taskWeight(status: string) {
  if (status === "COMPLETED") return 100;
  if (status === "APPROVAL_WAIT" || status === "PENDING_APPROVAL") return 92;
  if (status === "IN_REVIEW") return 82;
  if (status === "REVISION_REQUESTED") return 68;
  if (status === "IN_PROGRESS" || status === "COLLABORATING") return 52;
  if (status === "WAITING_FOR_DATA" || status === "ON_HOLD" || status === "ERROR") return 28;
  if (status === "CANCELLED" || status === "CANCELED") return 0;
  return 10;
}

function shortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function ProjectOperationsBoard({
  projectId,
  tasks,
  steps,
  handoffs,
  feedbacks,
}: {
  projectId: string;
  tasks: RootTask[];
  steps: WorkflowStep[];
  handoffs: Handoff[];
  feedbacks: Feedback[];
}) {
  const [selectedTaskId, setSelectedTaskId] = useState(tasks[0]?.id ?? "");

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? tasks[0] ?? null;
  const selectedSteps = useMemo(
    () => steps.filter((step) => step.parent_task_id === selectedTask?.id),
    [steps, selectedTask?.id],
  );
  const selectedFeedbacks = useMemo(
    () => feedbacks.filter((feedback) => feedback.root_task_id === selectedTask?.id),
    [feedbacks, selectedTask?.id],
  );

  const completed = tasks.filter((task) => task.status === "COMPLETED").length;
  const active = tasks.filter((task) => activeStatuses.has(task.status)).length;
  const waiting = tasks.filter((task) => task.status === "WAITING").length;
  const attention = tasks.filter((task) =>
    ["ERROR", "ON_HOLD", "WAITING_FOR_DATA", "REVISION_REQUESTED"].includes(task.status),
  ).length;
  const progress = tasks.length
    ? Math.round(tasks.reduce((sum, task) => sum + taskWeight(task.status), 0) / tasks.length)
    : 0;

  const taskById = new Map<string, RootTask | WorkflowStep>([
    ...tasks.map((task) => [task.id, task] as const),
    ...steps.map((step) => [step.id, step] as const),
  ]);

  return (
    <section className="rounded-[20px] border border-[#E5E8EE] bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.12em] text-[#3157D5]">PROJECT CONTROL</p>
          <h2 className="mt-1 text-[15px] font-semibold text-[#22262D]">프로젝트 운영 현황</h2>
          <p className="mt-1 text-[10px] leading-5 text-[#8A909A]">메인 업무 → AI 협업 단계 → 인수인계 → 재작업까지 한 화면에서 확인합니다.</p>
        </div>
        <Link
          href={`/command?project_id=${projectId}`}
          className="flex h-9 items-center justify-center rounded-[10px] bg-[#17181C] px-4 text-[10px] font-semibold text-white"
        >
          이 프로젝트에 업무 추가
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          ["실시간 진행률", `${progress}%`, "#3157D5"],
          ["진행 중", `${active}건`, "#3157D5"],
          ["대기", `${waiting}건`, "#7D8490"],
          ["완료", `${completed}건`, "#25855A"],
          ["확인 필요", `${attention}건`, attention ? "#C16A2B" : "#7D8490"],
        ].map(([label, value, color]) => (
          <div key={label} className="rounded-[14px] border border-[#ECEEF2] bg-[#FBFCFD] p-3">
            <p className="text-[9px] text-[#9298A2]">{label}</p>
            <p className="mt-1 text-[16px] font-bold" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {!tasks.length ? (
        <div className="mt-5 rounded-[15px] border border-dashed border-[#DDE2EA] bg-[#FBFCFD] px-5 py-10 text-center">
          <p className="text-[12px] font-medium text-[#626974]">아직 연결된 메인 업무가 없습니다.</p>
          <p className="mt-1 text-[10px] text-[#9298A2]">프로젝트 업무를 추가하면 흐름이 이곳에 쌓입니다.</p>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 xl:grid-cols-[310px_minmax(0,1fr)]">
          <div className="space-y-2">
            {tasks.map((task) => {
              const childCount = steps.filter((step) => step.parent_task_id === task.id).length;
              const selected = task.id === selectedTask?.id;
              return (
                <button
                  type="button"
                  key={task.id}
                  onClick={() => setSelectedTaskId(task.id)}
                  className={`w-full rounded-[14px] border p-3 text-left transition ${
                    selected ? "border-[#BFCDF4] bg-[#F7F9FF]" : "border-[#E8EAF0] bg-white hover:border-[#D7DCE5]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge value={task.status} label={labelOf(taskStatusLabel, task.status)} />
                    <span className="text-[8px] font-medium text-[#9A9FAA]">{task.execution_mode === "AUTO" ? "AUTO" : "MANUAL"}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-[11px] font-semibold leading-5 text-[#353A43]">{task.title}</p>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[8px] text-[#9399A4]">
                    <span>{task.task_code}</span>
                    <span>{task.employees?.name ?? "미배정"}</span>
                    {childCount ? <span>협업 {childCount}단계</span> : null}
                  </div>
                </button>
              );
            })}
          </div>

          {selectedTask ? (
            <div className="min-w-0 rounded-[16px] border border-[#E8EAF0] bg-[#FCFDFE] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold text-[#3157D5]">선택 업무</p>
                  <h3 className="mt-1 break-words text-[13px] font-semibold text-[#272B32]">{selectedTask.title}</h3>
                  <p className="mt-1 text-[9px] text-[#969CA6]">{selectedTask.departments?.name ?? "부서 미배정"} · {selectedTask.employees?.name ?? "직원 미배정"}</p>
                </div>
                <Link href={`/tasks/${selectedTask.id}`} className="rounded-[9px] border border-[#DDE2EA] bg-white px-3 py-2 text-[9px] font-semibold text-[#5D6470]">업무 상세 ↗</Link>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-[#4D535D]">업무 흐름</p>
                  <span className="text-[8px] text-[#979DA7]">{selectedSteps.length ? `${selectedSteps.length}개 AI 단계` : "단일 업무"}</span>
                </div>

                {selectedSteps.length ? (
                  <div className="mt-3 overflow-x-auto pb-2">
                    <div className="flex min-w-max items-stretch gap-2">
                      <div className="flex w-[145px] flex-col justify-between rounded-[13px] border border-[#C9D5F8] bg-[#F6F8FF] p-3">
                        <span className="text-[8px] font-semibold text-[#3157D5]">대표 지시</span>
                        <p className="mt-2 line-clamp-2 text-[9px] font-medium text-[#424852]">{selectedTask.title}</p>
                      </div>
                      {selectedSteps.map((step, index) => (
                        <div key={step.id} className="flex items-center gap-2">
                          <span className="text-[11px] text-[#B7BDC7]">→</span>
                          <div className="w-[150px] rounded-[13px] border border-[#E4E7ED] bg-white p-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[8px] font-semibold text-[#7B828D]">{step.workflow_step_no ?? index + 1}단계</span>
                              <StatusBadge value={step.status} label={labelOf(taskStatusLabel, step.status)} />
                            </div>
                            <p className="mt-2 line-clamp-2 text-[9px] font-medium leading-4 text-[#444A54]">{step.title}</p>
                            <p className="mt-2 truncate text-[8px] text-[#969CA6]">{step.employees?.name ?? step.departments?.name ?? "담당 대기"}</p>
                          </div>
                        </div>
                      ))}
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-[#B7BDC7]">→</span>
                        <div className="flex w-[140px] flex-col justify-between rounded-[13px] border border-[#CFE7DA] bg-[#F6FBF8] p-3">
                          <span className="text-[8px] font-semibold text-[#25855A]">비서 취합 → 대표</span>
                          <p className="mt-2 text-[9px] font-medium text-[#4A515A]">최종 결과·승인</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex items-center gap-2 rounded-[13px] border border-[#E4E7ED] bg-white p-3 text-[9px] text-[#6F7681]">
                    <span className="font-semibold text-[#3157D5]">대표</span><span>→</span><span>{selectedTask.employees?.name ?? "담당 직원"}</span><span>→</span><span>비서 취합</span><span>→</span><span>대표</span>
                  </div>
                )}
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                <div className="rounded-[14px] border border-[#E8EAF0] bg-white p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold text-[#505661]">최근 인수인계</p>
                    <span className="text-[8px] text-[#9A9FAA]">{handoffs.length}건</span>
                  </div>
                  <div className="mt-2 space-y-2">
                    {handoffs
                      .filter((handoff) => {
                        const from = taskById.get(handoff.from_task_id) as any;
                        const to = taskById.get(handoff.to_task_id) as any;
                        return from?.parent_task_id === selectedTask.id || to?.parent_task_id === selectedTask.id;
                      })
                      .slice(0, 4)
                      .map((handoff) => (
                        <div key={handoff.id} className="rounded-[10px] bg-[#F7F8FA] px-3 py-2">
                          <p className="truncate text-[9px] font-medium text-[#555C66]">{(taskById.get(handoff.from_task_id) as any)?.employees?.name ?? "이전 담당"} → {(taskById.get(handoff.to_task_id) as any)?.employees?.name ?? "다음 담당"}</p>
                          <p className="mt-1 truncate text-[8px] text-[#969CA6]">{handoff.title} · {shortDate(handoff.created_at)}</p>
                        </div>
                      ))}
                    {!handoffs.some((handoff) => {
                      const from = taskById.get(handoff.from_task_id) as any;
                      const to = taskById.get(handoff.to_task_id) as any;
                      return from?.parent_task_id === selectedTask.id || to?.parent_task_id === selectedTask.id;
                    }) ? <p className="py-4 text-center text-[9px] text-[#A0A6AF]">아직 인수인계 기록이 없습니다.</p> : null}
                  </div>
                </div>

                <div className="rounded-[14px] border border-[#E8EAF0] bg-white p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold text-[#505661]">재작업 / 대표 피드백</p>
                    <span className="text-[8px] text-[#9A9FAA]">{selectedFeedbacks.length}건</span>
                  </div>
                  <div className="mt-2 space-y-2">
                    {selectedFeedbacks.slice(0, 4).map((feedback) => (
                      <div key={feedback.id} className="rounded-[10px] bg-[#FFF9F4] px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[8px] font-semibold text-[#B56A31]">{feedback.status === "ACTIVE" ? "재작업 중" : "처리됨"}</span>
                          <span className="text-[8px] text-[#A0A6AF]">{shortDate(feedback.created_at)}</span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[9px] leading-4 text-[#646A73]">{feedback.reason}</p>
                      </div>
                    ))}
                    {!selectedFeedbacks.length ? <p className="py-4 text-center text-[9px] text-[#A0A6AF]">재작업 이력이 없습니다.</p> : null}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
