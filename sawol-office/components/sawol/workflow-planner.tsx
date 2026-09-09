"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { buildWorkflowPlan } from "@/lib/sawol/workflow";
import type {
  AssignmentDepartment,
  AssignmentEmployee,
  AssignmentWorkload,
} from "@/lib/sawol/assignment";

export function WorkflowPlanner({
  task,
  employees,
  departments,
  workloads,
}: {
  task: {
    id: string;
    title: string;
    description: string | null;
    task_type: string;
    priority: string;
  };
  employees: AssignmentEmployee[];
  departments: AssignmentDepartment[];
  workloads: AssignmentWorkload[];
}) {
  const router = useRouter();
  const [plan, setPlan] = useState<ReturnType<typeof buildWorkflowPlan> | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const employeeById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees],
  );

  function generate() {
    setMessage("");
    setPlan(buildWorkflowPlan({ task, employees, departments, workloads }));
  }

  function changeEmployee(stepKey: string, employeeId: string) {
    setPlan((current) => {
      if (!current) return current;
      return {
        ...current,
        steps: current.steps.map((step) => {
          if (step.key !== stepKey) return step;
          const selected = step.candidates.find((candidate) => candidate.employeeId === employeeId);
          return {
            ...step,
            employeeId,
            departmentId: selected?.departmentId ?? employeeById.get(employeeId)?.department_id ?? "",
            matchScore: selected?.score ?? null,
            assignmentReason: selected
              ? `STEP22 협업 계획 후보 중 대표 선택 · 적합도 ${selected.score}%`
              : "대표가 협업 계획에서 직접 선택",
          };
        }),
      };
    });
  }

  async function activate() {
    if (!plan || busy) return;
    if (plan.steps.some((step) => !step.employeeId)) {
      setMessage("모든 협업 단계에 담당 직원을 선택해주세요.");
      return;
    }

    setBusy(true);
    setMessage("");
    const supabase = createClient();

    const payload = plan.steps.map((step) => ({
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
      p_steps: payload,
    });

    if (error) {
      console.error(error);
      setMessage(`협업 시작에 실패했습니다. ${error.message}`);
      setBusy(false);
      return;
    }

    router.refresh();
    setBusy(false);
  }

  if (!plan) {
    return (
      <section className="rounded-[18px] border border-[#E7E9EE] bg-white p-4 sm:p-5 lg:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[13px] font-semibold">AI 협업 워크플로</p>
              <span className="rounded-full bg-[#EEF2FF] px-2 py-1 text-[8px] font-semibold text-[#3157D5]">STEP 22</span>
            </div>
            <p className="mt-1 max-w-[760px] text-[10px] leading-5 text-[#8B919C]">
              큰 업무를 전문 단계로 나눈 뒤 각 AI 직원에게 배정하고, 앞 단계 결과를 다음 단계에 인계합니다.
              계획을 먼저 확인한 뒤에만 실제 하위 업무가 생성됩니다.
            </p>
          </div>
          <button onClick={generate} type="button" className="h-10 shrink-0 whitespace-nowrap rounded-[10px] bg-[#3157D5] px-4 text-[11px] font-semibold text-white">
            협업 계획 생성
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[18px] border border-[#DDE4FA] bg-[#FBFCFF] p-4 sm:p-5 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[13px] font-semibold">협업 계획 미리보기</p>
          <p className="mt-1 text-[10px] leading-5 text-[#727986]">{plan.reason}</p>
        </div>
        <span className="w-fit rounded-full bg-white px-3 py-1.5 text-[9px] text-[#3157D5]">총 {plan.steps.length}단계</span>
      </div>

      <div className="mt-5 space-y-3">
        {plan.steps.map((step, index) => (
          <article key={step.key} className="rounded-[15px] border border-[#E5E8EF] bg-white p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#F2F4F7] px-2 py-1 text-[9px] font-semibold">{String(index + 1).padStart(2, "0")}</span>
                  <span className="text-[9px] text-[#3157D5]">{step.taskType}</span>
                  {step.dependsOn.length ? (
                    <span className="text-[9px] text-[#969CA6]">선행 · {step.dependsOn.join(", ")}</span>
                  ) : (
                    <span className="text-[9px] text-[#2D7650]">즉시 시작 가능</span>
                  )}
                </div>
                <h3 className="mt-2 break-words text-[12px] font-semibold">{step.title}</h3>
                <p className="mt-2 break-words text-[10px] leading-5 text-[#777E89]">{step.description}</p>
              </div>

              <div className="w-full shrink-0 lg:w-[260px]">
                <label className="mb-1.5 block text-[9px] font-semibold text-[#7D838E]">담당 직원</label>
                <select
                  value={step.employeeId}
                  onChange={(event) => changeEmployee(step.key, event.target.value)}
                  className="h-10 w-full rounded-[10px] border border-[#E1E4E9] bg-white px-3 text-[10px] outline-none focus:border-[#3157D5]"
                >
                  <option value="">직원 선택</option>
                  {step.candidates.map((candidate) => (
                    <option key={candidate.employeeId} value={candidate.employeeId}>
                      {candidate.name} · {candidate.employeeCode} · {candidate.score}%
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </article>
        ))}
      </div>

      {message ? <p className="mt-4 rounded-[10px] bg-[#FFF3F3] px-3 py-2.5 text-[10px] text-[#A64242]">{message}</p> : null}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={generate} disabled={busy} className="h-10 whitespace-nowrap rounded-[10px] border border-[#E1E4E9] bg-white px-4 text-[11px] font-semibold text-[#656B75]">
          계획 다시 생성
        </button>
        <button type="button" onClick={activate} disabled={busy} className="h-10 whitespace-nowrap rounded-[10px] bg-[#17181C] px-5 text-[11px] font-semibold text-white disabled:opacity-50">
          {busy ? "협업 시작 중..." : "협업 계획 확정 · 시작"}
        </button>
      </div>
    </section>
  );
}
