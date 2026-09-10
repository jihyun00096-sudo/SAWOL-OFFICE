"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createHumanCode } from "@/lib/sawol/code";
import { rankEmployeesForTask, type AssignmentWorkload } from "@/lib/sawol/assignment";
import {
  analyzeSecretaryCommand,
  type SecretaryAnalysis,
} from "@/lib/sawol/secretary";
import { SecretaryAnalysisCard } from "@/components/sawol/secretary-analysis-card";
import { buildWorkflowPlan } from "@/lib/sawol/workflow";

type Department = {
  id: string;
  code: string;
  name: string;
  department_type: string;
  parent_department_id?: string | null;
};

type Project = {
  id: string;
  name: string;
};

type Employee = {
  id: string;
  name: string;
  employee_code: string;
  department_id: string;
  position: string;
  specialty: unknown;
  responsibilities: unknown;
  work_style?: string | null;
  status: string;
  is_active?: boolean;
};

const taskTypeOptions = [
  ["RESEARCH", "리서치"],
  ["PLANNING", "기획"],
  ["PRODUCTION", "제작"],
  ["EDIT", "수정"],
  ["ANALYSIS", "분석"],
  ["OPERATION", "운영"],
  ["STUDY", "학습"],
  ["DEVELOPMENT", "개발"],
  ["DESIGN", "디자인"],
  ["OTHER", "기타"],
] as const;

const priorityOptions = [
  ["URGENT", "긴급"],
  ["HIGH", "높음"],
  ["NORMAL", "보통"],
  ["LOW", "낮음"],
] as const;

export function CommandForm({
  departments,
  projects,
  employees,
  workloads,
}: {
  departments: Department[];
  projects: Project[];
  employees: Employee[];
  workloads: AssignmentWorkload[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);

  const [analysis, setAnalysis] = useState<SecretaryAnalysis | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  const [taskType, setTaskType] = useState("OTHER");
  const [priority, setPriority] = useState("NORMAL");
  const [projectId, setProjectId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [executionMode, setExecutionMode] = useState<"AUTO" | "MANUAL">("AUTO");
  const [autoProgress, setAutoProgress] = useState<number | null>(null);

  const projectName = useMemo(
    () => projects.find((project) => project.id === projectId)?.name,
    [projects, projectId],
  );

  const departmentName = useMemo(
    () =>
      departments.find((department) => department.id === departmentId)?.name,
    [departments, departmentId],
  );

  const employeeName = useMemo(
    () => employees.find((employee) => employee.id === employeeId)?.name,
    [employees, employeeId],
  );

  function readCommand() {
    if (!formRef.current) return null;

    const form = new FormData(formRef.current);
    const title = String(form.get("title") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();

    return {
      form,
      title,
      description,
    };
  }

  function analyze() {
    const command = readCommand();

    if (!command) return;

    if (!command.title || !command.description) {
      setSuccess(false);
      setMessage("업무 제목과 업무 내용을 먼저 입력해주세요.");
      return;
    }

    const nextAnalysis = analyzeSecretaryCommand({
      title: command.title,
      description: command.description,
      projects,
      departments,
    });

    const candidates = rankEmployeesForTask({
      title: command.title,
      description: command.description,
      taskType: nextAnalysis.taskType,
      departmentId: nextAnalysis.departmentId,
      employees,
      departments,
      workloads,
    });

    const recommendedEmployeeId = candidates[0]?.employee.id ?? "";

    const enrichedAnalysis = {
      ...nextAnalysis,
      employeeId: recommendedEmployeeId,
      rationale: recommendedEmployeeId
        ? [
            ...nextAnalysis.rationale,
            `${candidates[0].employee.name} 직원이 전문분야·소속 조직·현재 업무량 기준 1순위로 추천되었습니다.`,
          ]
        : [
            ...nextAnalysis.rationale,
            "현재 조건에서 확실한 추천 직원을 찾지 못해 미배정을 유지합니다.",
          ],
    };

    setAnalysis(enrichedAnalysis);
    setTaskType(enrichedAnalysis.taskType);
    setPriority(enrichedAnalysis.priority);
    setProjectId(enrichedAnalysis.projectId);
    setDepartmentId(enrichedAnalysis.departmentId);
    setEmployeeId(enrichedAnalysis.employeeId);
    setRequiresApproval(executionMode === "AUTO" ? true : enrichedAnalysis.requiresCeoApproval);
    setSuccess(true);
    setMessage(
      "비서실 분석이 완료되었습니다. 아래 제안값을 확인하거나 수정해주세요.",
    );
  }

  function resetAll() {
    formRef.current?.reset();
    setAnalysis(null);
    setTaskType("OTHER");
    setPriority("NORMAL");
    setProjectId("");
    setDepartmentId("");
    setEmployeeId("");
    setRequiresApproval(false);
    setExecutionMode("AUTO");
    setAutoProgress(null);
    setMessage("");
    setSuccess(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) return;

    if (!analysis) {
      setSuccess(false);
      setMessage("먼저 비서실장에게 분석을 요청해주세요.");
      return;
    }

    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    const title = String(form.get("title") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();

    if (!title || !description) {
      setSuccess(false);
      setMessage("업무 제목과 업무 내용은 필수입니다.");
      return;
    }

    setSubmitting(true);
    setMessage("");

    const supabase = createClient();

    const requestedResult =
      String(form.get("expected_result") ?? "").trim() || null;

    const { data: createdTask, error } = await supabase
      .from("tasks")
      .insert({
      task_code: createHumanCode("TASK"),
      title,
      description,
      task_type: taskType,
      priority,
      project_id: projectId || null,
      assigned_department_id: departmentId || null,
      assigned_employee_id: null,
      requires_ceo_approval: requiresApproval,
      execution_mode: executionMode,
      status: "WAITING",
      review_level: 0,
      input_data: {
        source: "CEO_COMMAND",
        secretary_analysis: {
          engine: "STEP17_RULE_ENGINE",
          confidence: analysis.confidence,
          rationale: analysis.rationale,
          suggested_steps: analysis.steps,
          suggested_task_type: analysis.taskType,
          suggested_priority: analysis.priority,
          suggested_project_id: analysis.projectId || null,
          suggested_department_id: analysis.departmentId || null,
          suggested_employee_id: analysis.employeeId || null,
          suggested_requires_ceo_approval:
            analysis.requiresCeoApproval,
          representative_final_choice: {
            task_type: taskType,
            priority,
            project_id: projectId || null,
            department_id: departmentId || null,
            employee_id: employeeId || null,
            requires_ceo_approval: requiresApproval,
            execution_mode: executionMode,
          },
        },
      },
      output_requirements: {
        requested_result: requestedResult,
        secretary_plan: analysis.steps,
      },
    })
      .select("id")
      .single();

    if (error) {
      console.error(error);
      setSuccess(false);
      setMessage(
        "업무 등록에 실패했습니다. 입력값 또는 Supabase 연결을 확인해주세요.",
      );
      setSubmitting(false);
      return;
    }

    const workflowPlan = buildWorkflowPlan({
      task: { title, description, task_type: taskType, priority },
      employees: employees as any,
      departments: departments as any,
      workloads,
    });

    const shouldAssignRootEmployee =
      executionMode === "MANUAL" || workflowPlan.mode === "SINGLE";

    if (createdTask?.id && employeeId && shouldAssignRootEmployee) {
      const selectedEmployee = employees.find(
        (employee) => employee.id === employeeId,
      );

      const candidates = rankEmployeesForTask({
        title,
        description,
        taskType,
        departmentId,
        employees,
        departments,
        workloads,
      });

      const selectedCandidate = candidates.find(
        (candidate) => candidate.employee.id === employeeId,
      );

      const { error: assignmentError } = await supabase.rpc(
        "sawol_assign_task",
        {
          p_task_id: createdTask.id,
          p_employee_id: employeeId,
          p_assignment_source: "SECRETARY",
          p_assignment_reason:
            selectedCandidate?.reasons.join(" / ") ||
            "대표가 업무지시 화면에서 담당 직원을 확정",
          p_match_score: selectedCandidate?.score ?? null,
          p_metadata: {
            source: "COMMAND_FORM",
            step: 21,
            employee_code: selectedEmployee?.employee_code ?? null,
            secretary_confidence: analysis.confidence,
          },
        },
      );

      if (assignmentError) {
        console.error(assignmentError);
        setSuccess(false);
        setMessage(
          "업무는 생성됐지만 직원 배정에 실패했습니다. 업무 상세에서 다시 배정해주세요.",
        );
        setSubmitting(false);
        router.refresh();
        return;
      }
    }

    if (createdTask?.id && executionMode === "AUTO") {
      try {
        setSuccess(true);
        setMessage("업무가 등록되었습니다. 비서실장이 자동 실행을 시작합니다.");
        setAutoProgress(0);

        if (workflowPlan.mode === "SINGLE" && !employeeId) {
          const autoCandidates = rankEmployeesForTask({
            title,
            description,
            taskType,
            departmentId,
            employees,
            departments,
            workloads,
          });
          const top = autoCandidates[0];
          if (!top) throw new Error("자동 배정 가능한 직원을 찾지 못했습니다.");

          const { error: autoAssignmentError } = await supabase.rpc(
            "sawol_assign_task",
            {
              p_task_id: createdTask.id,
              p_employee_id: top.employee.id,
              p_assignment_source: "AUTOPILOT",
              p_assignment_reason:
                top.reasons.join(" / ") || "자동 실행 전 단일 업무 담당자 배정",
              p_match_score: top.score ?? null,
              p_metadata: {
                source: "COMMAND_FORM_AUTO",
                step: 22,
                secretary_confidence: analysis.confidence,
              },
            },
          );
          if (autoAssignmentError) throw new Error(autoAssignmentError.message);
        }

        if (workflowPlan.mode === "COLLAB") {
          if (workflowPlan.steps.some((step) => !step.employeeId)) {
            throw new Error("자동 협업에 필요한 AI 직원을 충분히 배정하지 못했습니다.");
          }

          const workflowPayload = workflowPlan.steps.map((step) => ({
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

          const { error: workflowError } = await supabase.rpc(
            "sawol_create_workflow",
            { p_root_task_id: createdTask.id, p_steps: workflowPayload },
          );

          if (workflowError) throw new Error(workflowError.message);
        }

        const startResponse = await fetch(
          `/api/office/tasks/${createdTask.id}/autopilot/start`,
          { method: "POST" },
        );
        const startPayload = await startResponse.json().catch(() => null);

        if (!startResponse.ok || !startPayload?.ok) {
          throw new Error(
            startPayload?.message || `자동 실행 시작 실패 (${startResponse.status})`,
          );
        }

        setAutoProgress(0);
        setMessage(
          "업무 등록 완료 · 이제부터 AI 직원들이 백그라운드에서 자동으로 처리합니다.",
        );

        router.push(`/tasks/${createdTask.id}`);
        router.refresh();
        setSubmitting(false);
        return;
      } catch (autoError) {
        console.error(autoError);
        setSuccess(false);
        setMessage(
          `업무는 등록됐지만 자동 실행 중 멈췄습니다. 업무 상세에서 수동으로 개입하거나 자동 실행을 재개할 수 있습니다. ${autoError instanceof Error ? autoError.message : ""}`,
        );
        setSubmitting(false);
        router.push(`/tasks/${createdTask.id}`);
        router.refresh();
        return;
      }
    }

    setSuccess(true);
    setMessage("수동 실행 업무가 등록되었습니다. 업무 상세에서 기존 수동 도구로 진행할 수 있습니다.");

    formElement.reset();
    setAnalysis(null);
    setTaskType("OTHER");
    setPriority("NORMAL");
    setProjectId("");
    setDepartmentId("");
    setEmployeeId("");
    setRequiresApproval(false);
    setExecutionMode("AUTO");
    setAutoProgress(null);

    router.refresh();
    setSubmitting(false);
  }

  const input =
    "h-11 w-full rounded-[11px] border border-[#E1E4E9] bg-white px-3.5 text-[12px] outline-none transition focus:border-[#3157D5] focus:ring-4 focus:ring-[#3157D5]/[0.06]";

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-4">
      <section className="rounded-[20px] border border-[#E7E9EE] bg-white p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EEF2FF] text-[11px] font-bold text-[#3157D5]">
            윤
          </div>

          <div>
            <p className="text-[13px] font-semibold">윤서진 비서실장</p>
            <p className="mt-1 break-keep text-[10px] leading-5 text-[#8B919C]">
              대표님의 지시를 먼저 읽고 업무 성격과 배정안을 정리하겠습니다.
              분석 단계에서는 실제 업무가 생성되지 않습니다.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-5">
          <div>
            <label className="mb-2 block text-[11px] font-semibold">
              무엇을 해야 하나요? *
            </label>
            <input
              name="title"
              className={input}
              placeholder="예: 신통기획 강의 상세페이지 경쟁 강의 조사"
              maxLength={160}
              onChange={() => analysis && setAnalysis(null)}
            />
          </div>

          <div>
            <label className="mb-2 block text-[11px] font-semibold">
              자세히 알려주세요 *
            </label>
            <textarea
              name="description"
              rows={7}
              className="w-full resize-y rounded-[12px] border border-[#E1E4E9] bg-white px-3.5 py-3 text-[12px] leading-6 outline-none transition focus:border-[#3157D5] focus:ring-4 focus:ring-[#3157D5]/[0.06]"
              placeholder="조사 범위, 만들어야 할 것, 지켜야 할 조건 등을 평소 말하듯 적어주세요."
              onChange={() => analysis && setAnalysis(null)}
            />
          </div>

          <div>
            <label className="mb-2 block text-[11px] font-semibold">
              원하는 결과물이 있다면
            </label>
            <input
              name="expected_result"
              className={input}
              placeholder="예: 경쟁 강의 10개 비교표 + 상세페이지 구성안"
              maxLength={300}
            />
          </div>

          <button
            type="button"
            onClick={analyze}
            className="h-11 w-full rounded-[11px] bg-[#3157D5] px-5 text-[12px] font-semibold text-white transition hover:bg-[#294BC0] sm:w-auto"
          >
            {analysis ? "다시 분석하기" : "비서실장에게 분석 요청"}
          </button>
        </div>
      </section>

      {analysis ? (
        <>
          <SecretaryAnalysisCard
            analysis={{
              ...analysis,
              taskType,
              priority,
              projectId,
              departmentId,
              employeeId,
              requiresCeoApproval: requiresApproval,
            }}
            projectName={projectName}
            departmentName={departmentName}
            employeeName={employeeName}
          />

          <section className="rounded-[20px] border border-[#E7E9EE] bg-white p-5 sm:p-6">
            <div>
              <p className="text-[13px] font-semibold">대표 확인</p>
              <p className="mt-1 text-[10px] leading-5 text-[#8C929D]">
                비서실의 제안입니다. 필요한 항목은 직접 바꾼 뒤 업무를 등록해주세요.
              </p>
            </div>

            <div className="mt-5">
              <p className="mb-2 text-[10px] font-semibold">실행 방식</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => { setExecutionMode("AUTO"); setRequiresApproval(true); }}
                  className={`rounded-[14px] border p-4 text-left transition ${executionMode === "AUTO" ? "border-[#BFCBFF] bg-[#F6F8FF]" : "border-[#E3E6EB] bg-white"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[12px] font-semibold">자동 실행</span>
                    <span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${executionMode === "AUTO" ? "bg-[#3157D5] text-white" : "bg-[#F2F3F5] text-[#8A909A]"}`}>추천</span>
                  </div>
                  <p className="mt-2 break-keep text-[10px] leading-5 text-[#7D8490]">
                    비서실장이 직원 배정, 협업, 실행, 내부 검수까지 이어서 처리하고 대표에게 최종 결과를 올립니다.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setExecutionMode("MANUAL")}
                  className={`rounded-[14px] border p-4 text-left transition ${executionMode === "MANUAL" ? "border-[#C9CDD5] bg-[#F8F9FA]" : "border-[#E3E6EB] bg-white"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[12px] font-semibold">수동 실행</span>
                    <span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${executionMode === "MANUAL" ? "bg-[#17181C] text-white" : "bg-[#F2F3F5] text-[#8A909A]"}`}>직접 개입</span>
                  </div>
                  <p className="mt-2 break-keep text-[10px] leading-5 text-[#7D8490]">
                    지금까지 만든 배정·실행·상태변경·업무수정 기능을 그대로 사용하며 대표가 과정에 직접 참여합니다.
                  </p>
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-2 block text-[10px] font-semibold">
                  업무 유형
                </label>
                <select
                  value={taskType}
                  onChange={(event) => setTaskType(event.target.value)}
                  className={input}
                >
                  {taskTypeOptions.map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-semibold">
                  우선순위
                </label>
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value)}
                  className={input}
                >
                  {priorityOptions.map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-semibold">
                  프로젝트
                </label>
                <select
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
                  className={input}
                >
                  <option value="">프로젝트 연결 없음</option>
                  {projects.map((project) => (
                    <option value={project.id} key={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-semibold">
                  담당 부서
                </label>
                <select
                  value={departmentId}
                  onChange={(event) => setDepartmentId(event.target.value)}
                  className={input}
                >
                  <option value="">미배정</option>
                  {departments.map((department) => (
                    <option value={department.id} key={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-semibold">
                  담당 직원 {executionMode === "AUTO" ? "(단일 업무 우선 담당)" : ""}
                </label>
                <select
                  value={employeeId}
                  onChange={(event) => setEmployeeId(event.target.value)}
                  className={input}
                >
                  <option value="">미배정</option>
                  {employees.map((employee) => (
                    <option value={employee.id} key={employee.id}>
                      {employee.name} · {employee.employee_code}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[11px] bg-[#F7F8FA] px-3.5 py-2.5">
                <input
                  type="checkbox"
                  checked={requiresApproval}
                  disabled={executionMode === "AUTO"}
                  onChange={(event) => setRequiresApproval(event.target.checked)}
                  className="h-4 w-4 accent-[#3157D5] disabled:opacity-60"
                />
                <span>
                  <span className="block text-[10px] font-semibold">
                    완료 후 대표 승인 필요
                  </span>
                  <span className="mt-0.5 block text-[9px] text-[#9297A1]">
                    {executionMode === "AUTO" ? "자동 실행은 최종 결과를 반드시 대표 승인함에 올립니다." : "중요한 최종 결과는 대표가 확인합니다."}
                  </span>
                </span>
              </label>
            </div>

            {message ? (
              <div
                className={`mt-4 rounded-[11px] px-4 py-3 text-[11px] ${
                  success
                    ? "bg-[#EEF8F2] text-[#2C7B50]"
                    : "bg-[#FFF1F1] text-[#B14444]"
                }`}
              >
                {message}
              </div>
            ) : null}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={resetAll}
                disabled={submitting}
                className="h-11 rounded-[11px] border border-[#E1E4E9] bg-white px-5 text-[11px] font-semibold text-[#666C76]"
              >
                처음부터 다시
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="h-11 rounded-[11px] bg-[#17181C] px-6 text-[11px] font-semibold text-white disabled:opacity-50"
              >
                {submitting ? (executionMode === "AUTO" ? `자동 실행 중${autoProgress !== null ? ` ${autoProgress}%` : "..."}` : "업무 등록 중...") : executionMode === "AUTO" ? "등록하고 자동 실행" : "수동 업무 등록"}
              </button>
            </div>
          </section>
        </>
      ) : message ? (
        <div
          className={`rounded-[11px] px-4 py-3 text-[11px] ${
            success
              ? "bg-[#EEF8F2] text-[#2C7B50]"
              : "bg-[#FFF1F1] text-[#B14444]"
          }`}
        >
          {message}
        </div>
      ) : null}
    </form>
  );
}
