"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Task = {
  id: string;
  title: string;
  description: string | null;
  task_type: string;
  status: string;
  priority: string;
  project_id: string | null;
  assigned_department_id: string | null;
  assigned_employee_id: string | null;
  requires_ceo_approval: boolean;
};

type Option = {
  id: string;
  name: string;
};

type Employee = {
  id: string;
  name: string;
  employee_code: string;
  position?: string;
};

export function TaskEditForm({
  task,
  projects,
  departments,
  employees,
}: {
  task: Task;
  projects: Option[];
  departments: Option[];
  employees: Employee[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const form = new FormData(event.currentTarget);
    const status = String(form.get("status") ?? task.status);

    if (
      ["CANCELLED", "CANCELED"].includes(status) &&
      !["CANCELLED", "CANCELED"].includes(task.status) &&
      !window.confirm(
        "이 업무를 폐기 상태로 변경할까요?\n데이터는 삭제되지 않습니다.",
      )
    ) {
      return;
    }

    const title = String(form.get("title") ?? "").trim();

    if (!title) {
      setMessage("업무 제목은 필수입니다.");
      return;
    }

    const nextEmployeeId =
      String(form.get("assigned_employee_id") ?? "") || null;

    setBusy(true);
    setMessage("");

    const supabase = createClient();

    const { error } = await supabase
      .from("tasks")
      .update({
        title,
        description: String(form.get("description") ?? "").trim() || null,
        task_type: String(form.get("task_type") ?? "OTHER"),
        status,
        priority: String(form.get("priority") ?? "NORMAL"),
        project_id: String(form.get("project_id") ?? "") || null,
        assigned_department_id:
          String(form.get("assigned_department_id") ?? "") || null,
        requires_ceo_approval:
          form.get("requires_ceo_approval") === "on",
        updated_at: new Date().toISOString(),
      })
      .eq("id", task.id);

    if (error) {
      console.error(error);
      setMessage("업무 수정에 실패했습니다.");
      setBusy(false);
      return;
    }

    if (nextEmployeeId !== task.assigned_employee_id) {
      if (nextEmployeeId) {
        const { error: assignmentError } = await supabase.rpc(
          "sawol_assign_task",
          {
            p_task_id: task.id,
            p_employee_id: nextEmployeeId,
            p_assignment_source: "MANUAL",
            p_assignment_reason: "업무 관리 화면에서 대표가 직접 지정",
            p_match_score: null,
            p_metadata: {
              source: "TASK_EDIT_FORM",
              step: 21,
            },
          },
        );

        if (assignmentError) {
          console.error(assignmentError);
          setMessage(
            "업무 내용은 저장됐지만 직원 배정에 실패했습니다. STEP21 SQL 적용 여부를 확인해주세요.",
          );
          setBusy(false);
          router.refresh();
          return;
        }
      } else {
        const { error: unassignError } = await supabase.rpc(
          "sawol_unassign_task",
          {
            p_task_id: task.id,
          },
        );

        if (unassignError) {
          console.error(unassignError);
          setMessage(
            "업무 내용은 저장됐지만 미배정 처리에 실패했습니다. STEP21 SQL 적용 여부를 확인해주세요.",
          );
          setBusy(false);
          router.refresh();
          return;
        }
      }
    }

    setMessage("저장되었습니다.");
    router.refresh();
    setBusy(false);
  }

  const input =
    "h-11 w-full rounded-[10px] border border-[#E1E4E9] bg-white px-3 text-[12px] outline-none focus:border-[#3157D5]";

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div>
        <label className="mb-2 block text-[11px] font-semibold">업무 제목 *</label>
        <input
          name="title"
          defaultValue={task.title}
          className={input}
          maxLength={160}
        />
      </div>

      <div>
        <label className="mb-2 block text-[11px] font-semibold">업무 설명</label>
        <textarea
          name="description"
          defaultValue={task.description ?? ""}
          rows={6}
          className="w-full rounded-[10px] border border-[#E1E4E9] px-3 py-3 text-[12px] leading-5 outline-none focus:border-[#3157D5]"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-2 block text-[11px] font-semibold">업무 유형</label>
          <select name="task_type" defaultValue={task.task_type} className={input}>
            <option value="RESEARCH">리서치</option>
            <option value="PLANNING">기획</option>
            <option value="PRODUCTION">제작</option>
            <option value="EDIT">수정</option>
            <option value="ANALYSIS">분석</option>
            <option value="OPERATION">운영</option>
            <option value="STUDY">학습</option>
            <option value="DEVELOPMENT">개발</option>
            <option value="DESIGN">디자인</option>
            <option value="OTHER">기타</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-[11px] font-semibold">상태</label>
          <select name="status" defaultValue={task.status} className={input}>
            <option value="WAITING">대기</option>
            <option value="WAITING_FOR_DATA">자료 대기</option>
            <option value="IN_PROGRESS">진행 중</option>
            <option value="COLLABORATING">협업 중</option>
            <option value="REVIEW">검수 대기</option>
            <option value="PENDING_APPROVAL">대표 승인 대기</option>
            <option value="COMPLETED">완료</option>
            <option value="ON_HOLD">보류</option>
            <option value="CANCELLED">폐기</option>
            <option value="ERROR">오류</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-[11px] font-semibold">우선순위</label>
          <select name="priority" defaultValue={task.priority} className={input}>
            <option value="URGENT">긴급</option>
            <option value="HIGH">높음</option>
            <option value="NORMAL">보통</option>
            <option value="LOW">낮음</option>
          </select>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div>
          <label className="mb-2 block text-[11px] font-semibold">프로젝트</label>
          <select
            name="project_id"
            defaultValue={task.project_id ?? ""}
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
          <label className="mb-2 block text-[11px] font-semibold">담당 부서</label>
          <select
            name="assigned_department_id"
            defaultValue={task.assigned_department_id ?? ""}
            className={input}
          >
            <option value="">미배정</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-[11px] font-semibold">담당 직원</label>
          <select
            name="assigned_employee_id"
            defaultValue={task.assigned_employee_id ?? ""}
            className={input}
          >
            <option value="">미배정</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name} · {employee.employee_code}
                {employee.position ? ` · ${employee.position}` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-[12px] bg-[#F7F8FA] p-3.5">
        <input
          name="requires_ceo_approval"
          type="checkbox"
          defaultChecked={task.requires_ceo_approval}
          className="mt-0.5 h-4 w-4 accent-[#3157D5]"
        />
        <span>
          <span className="block text-[11px] font-medium">
            완료 후 대표 승인 필요
          </span>
          <span className="mt-1 block text-[10px] text-[#9297A1]">
            결과 완료 후 대표가 최종 확인해야 하는 업무입니다.
          </span>
        </span>
      </label>

      {message ? (
        <p className="rounded-[10px] bg-[#F4F5F7] px-3 py-2.5 text-[11px] text-[#666C76]">
          {message}
        </p>
      ) : null}

      <div className="flex justify-end">
        <button
          disabled={busy}
          className="h-10 rounded-[10px] bg-[#17181C] px-5 text-[11px] font-semibold text-white disabled:opacity-50"
        >
          {busy ? "저장 중..." : "업무 저장"}
        </button>
      </div>
    </form>
  );
}
