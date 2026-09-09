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
    setRequiresApproval(enrichedAnalysis.requiresCeoApproval);
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

    if (createdTask?.id && employeeId) {
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

    setSuccess(true);
    setMessage("대표 확인이 완료되어 업무가 등록되었습니다.");

    formElement.reset();
    setAnalysis(null);
    setTaskType("OTHER");
    setPriority("NORMAL");
    setProjectId("");
    setDepartmentId("");
    setEmployeeId("");
    setRequiresApproval(false);

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
                  담당 직원
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
                  onChange={(event) =>
                    setRequiresApproval(event.target.checked)
                  }
                  className="h-4 w-4 accent-[#3157D5]"
                />
                <span>
                  <span className="block text-[10px] font-semibold">
                    완료 후 대표 승인 필요
                  </span>
                  <span className="mt-0.5 block text-[9px] text-[#9297A1]">
                    중요한 최종 결과는 대표가 확인합니다.
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
                {submitting ? "업무 등록 중..." : "이대로 업무 등록"}
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
