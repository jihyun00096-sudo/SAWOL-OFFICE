"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { buildWorkflowPlan } from "@/lib/sawol/workflow";
import {
  rankEmployeesForTask,
  type AssignmentDepartment,
  type AssignmentEmployee,
  type AssignmentWorkload,
} from "@/lib/sawol/assignment";

type Snapshot = {
  job: null | {
    status: string;
    progress: number;
    current_step_title: string | null;
    last_message: string | null;
    last_error: string | null;
    stale: boolean;
    attempt_count: number;
  };
  workflow: null | {
    total: number;
    completed: number;
    current: null | {
      title: string;
      status: string;
      step_no: number | null;
      employee: string | null;
      employee_code: string | null;
    };
    steps: Array<{
      id: string;
      title: string;
      status: string;
      step_no: number | null;
      employee: string | null;
      employee_code: string | null;
    }>;
  };
};

const CLOSED = new Set(["COMPLETED", "PENDING_APPROVAL", "CANCELLED", "CANCELED"]);
const stepStatusLabel: Record<string, string> = {
  WAITING: "대기",
  IN_PROGRESS: "작업 중",
  REVIEW: "검수 중",
  PENDING_APPROVAL: "승인 대기",
  COMPLETED: "완료",
  ERROR: "오류",
  ON_HOLD: "보류",
};

export function AutonomousOffice({
  task,
  employees,
  departments,
  workloads,
  hasWorkflow,
  executionMode = "AUTO",
}: {
  task: {
    id: string;
    title: string;
    description: string | null;
    task_type: string;
    priority: string;
    status: string;
    assigned_employee_id?: string | null;
  };
  employees: AssignmentEmployee[];
  departments: AssignmentDepartment[];
  workloads: AssignmentWorkload[];
  hasWorkflow: boolean;
  executionMode?: "AUTO" | "MANUAL";
}) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [starting, setStarting] = useState(false);
  const [localError, setLocalError] = useState("");
  const kickOnce = useRef(false);
  const lastRefreshSignature = useRef("");

  const plan = useMemo(
    () => buildWorkflowPlan({ task, employees, departments, workloads }),
    [task, employees, departments, workloads],
  );

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/office/tasks/${task.id}/autopilot/status`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) return;

      setSnapshot(payload);
      setLoaded(true);

      const signature = JSON.stringify({
        job: payload.job?.status,
        progress: payload.job?.progress,
        current: payload.workflow?.current?.id,
        completed: payload.workflow?.completed,
      });

      if (lastRefreshSignature.current && lastRefreshSignature.current !== signature) {
        router.refresh();
      }
      lastRefreshSignature.current = signature;
    } catch {
      setLoaded(true);
    }
  }, [router, task.id]);

  useEffect(() => {
    if (executionMode !== "AUTO") return;

    void loadStatus();
    const timer = window.setInterval(loadStatus, 1600);
    return () => window.clearInterval(timer);
  }, [executionMode, loadStatus]);

  const prepareAndStart = useCallback(async (forceRetry = false) => {
    if (starting || executionMode !== "AUTO" || CLOSED.has(task.status)) return;
    setStarting(true);
    setLocalError("");

    try {
      const supabase = createClient();

      if (!hasWorkflow && plan.mode === "SINGLE" && !task.assigned_employee_id) {
        const ranked = rankEmployeesForTask({
          title: task.title,
          description: task.description ?? "",
          taskType: task.task_type,
          departmentId: null,
          employees,
          departments,
          workloads,
        });
        const top = ranked[0];
        if (!top) throw new Error("자동 배정 가능한 직원을 찾지 못했습니다.");

        const { error } = await supabase.rpc("sawol_assign_task", {
          p_task_id: task.id,
          p_employee_id: top.employee.id,
          p_assignment_source: "AUTOPILOT",
          p_assignment_reason: top.reasons.join(" / ") || "AUTO 무인 실행 담당자 배정",
          p_match_score: top.score ?? null,
          p_metadata: { source: "STEP22_5_UNATTENDED", step: 22.5 },
        });
        if (error) throw new Error(error.message);
      }

      if (!hasWorkflow && plan.mode === "COLLAB") {
        if (plan.steps.some((step) => !step.employeeId)) {
          throw new Error("자동 협업에 필요한 AI 직원을 충분히 배정하지 못했습니다.");
        }

        const workflowPayload = plan.steps.map((step) => ({
          key: step.key,
          title: step.title,
          description: step.description,
          task_type: step.taskType,
          priority: step.priority,
          employee_id: step.employeeId,
          department_id: step.departmentId || null,
          match_score: step.matchScore,
          assignment_reason: step.assignmentReason,
          depends_on: step.dependsOn,
        }));

        const { error } = await supabase.rpc("sawol_create_workflow", {
          p_root_task_id: task.id,
          p_steps: workflowPayload,
        });
        if (error && !error.message.includes("WORKFLOW_ALREADY_EXISTS")) {
          throw new Error(error.message);
        }
      }

      const response = await fetch(`/api/office/tasks/${task.id}/autopilot/start`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ retry: forceRetry }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || `자동 실행 시작 실패 (${response.status})`);
      }

      await loadStatus();
      router.refresh();
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "자동 실행 시작 중 오류가 발생했습니다.");
    } finally {
      setStarting(false);
    }
  }, [
    starting,
    executionMode,
    task,
    hasWorkflow,
    plan,
    employees,
    departments,
    workloads,
    loadStatus,
    router,
  ]);

  useEffect(() => {
    if (!loaded || executionMode !== "AUTO" || CLOSED.has(task.status) || kickOnce.current) return;

    const job = snapshot?.job;
    const shouldAutoStart = !job || job.status === "QUEUED" || (job.status === "RUNNING" && job.stale);

    if (shouldAutoStart) {
      kickOnce.current = true;
      void prepareAndStart(Boolean(job?.stale));
    }
  }, [loaded, executionMode, task.status, snapshot, prepareAndStart]);

  if (executionMode !== "AUTO") return null;

  const job = snapshot?.job;
  const workflow = snapshot?.workflow;
  const progress = job?.progress ?? (workflow?.total ? Math.round((workflow.completed / workflow.total) * 100) : 0);
  const failed = job?.status === "FAILED" || Boolean(localError);
  const current = workflow?.current;
  const closed = CLOSED.has(task.status) || ["AWAITING_APPROVAL", "COMPLETED"].includes(job?.status ?? "");

  return (
    <section className="rounded-[18px] border border-[#DDE4FA] bg-[#FBFCFF] p-4 sm:p-5 lg:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-semibold">AI 자율 오피스</p>
            <span className="rounded-full bg-[#EEF2FF] px-2 py-1 text-[8px] font-semibold text-[#3157D5]">AUTO · 무인 실행</span>
            {!failed && !closed ? (
              <span className="rounded-full bg-[#ECF8F0] px-2 py-1 text-[8px] font-semibold text-[#2D7650]">
                {job?.status === "RUNNING" ? "자동 처리 중" : "자동 시작 준비"}
              </span>
            ) : null}
          </div>
          <p className="mt-1 max-w-[780px] text-[10px] leading-5 text-[#7A8290]">
            AUTO 업무는 등록 후 별도 실행 버튼 없이 시작합니다. 직원 배정 → 협업 → 인수인계 → 내부 검수 → 대표 승인함까지 자동으로 진행하며, 실패할 때만 대표가 개입합니다.
          </p>
        </div>

        {failed ? (
          <button
            onClick={() => {
              kickOnce.current = true;
              void prepareAndStart(true);
            }}
            disabled={starting}
            className="h-10 shrink-0 rounded-[10px] border border-[#D8DDE8] bg-white px-4 text-[10px] font-semibold text-[#3157D5] disabled:opacity-50"
          >
            {starting ? "복구 시작 중..." : "자동 실행 다시 시작"}
          </button>
        ) : null}
      </div>

      {!hasWorkflow && !workflow ? (
        <div className="mt-4 rounded-[13px] bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#F3F5F8] px-2.5 py-1 text-[9px] font-semibold">복잡도 {plan.complexity}%</span>
            <span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${plan.mode === "COLLAB" ? "bg-[#EEF2FF] text-[#3157D5]" : "bg-[#ECF8F0] text-[#2D7650]"}`}>
              {plan.mode === "COLLAB" ? `협업 ${plan.steps.length}단계` : "단일 직원 처리"}
            </span>
            <span className="rounded-full bg-[#F7F8FA] px-2.5 py-1 text-[9px] text-[#7A818D]">협업 기준 60점</span>
          </div>
          <p className="mt-2 text-[10px] leading-5 text-[#7B828E]">{plan.reason}</p>
        </div>
      ) : null}

      <div className="mt-4 rounded-[13px] bg-white p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[9px] font-semibold text-[#3157D5]">
              {closed ? "자동 처리 완료" : current ? "현재 AI 직원 작업" : "자동 실행 상태"}
            </p>
            <p className="mt-1 break-words text-[11px] font-semibold text-[#252A32]">
              {current?.title ?? job?.current_step_title ?? (closed ? "대표 확인 단계" : "업무 준비 중")}
            </p>
            <p className="mt-1 text-[9px] leading-4 text-[#858C98]">
              {current?.employee ? `${current.employee} · ` : ""}
              {current?.status ? stepStatusLabel[current.status] ?? current.status : job?.last_message ?? "실행 상태를 확인 중입니다."}
            </p>
          </div>
          <p className="shrink-0 text-[18px] font-semibold text-[#242A33]">{progress}%</p>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E9EDF7]">
          <div className="h-full rounded-full bg-[#3157D5] transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {workflow?.steps?.length ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {workflow.steps.map((step) => (
            <div key={step.id} className="rounded-[11px] border border-[#E9ECF3] bg-white px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-[9px] font-semibold text-[#424955]">
                  {step.step_no ? `${String(step.step_no).padStart(2, "0")} · ` : ""}{step.title}
                </p>
                <span className="shrink-0 text-[8px] text-[#858C97]">{stepStatusLabel[step.status] ?? step.status}</span>
              </div>
              <p className="mt-1 text-[8px] text-[#9A9FA8]">{step.employee ?? "미배정"}</p>
            </div>
          ))}
        </div>
      ) : null}

      {failed ? (
        <p className="mt-3 rounded-[10px] bg-[#FFF2F2] px-3 py-2.5 text-[10px] leading-5 text-[#A64242]">
          {localError || job?.last_error || "자동 실행이 중단되었습니다. 기존 결과와 협업 단계는 보존되어 있습니다."}
        </p>
      ) : job?.last_message ? (
        <p className="mt-3 rounded-[10px] bg-[#F1F6FF] px-3 py-2.5 text-[10px] leading-5 text-[#3157D5]">{job.last_message}</p>
      ) : null}
    </section>
  );
}
