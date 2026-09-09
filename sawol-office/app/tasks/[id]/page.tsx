import Link from "next/link";
import { notFound } from "next/navigation";
import { AssignmentAssistant } from "@/components/sawol/assignment-assistant";
import { DetailSection } from "@/components/sawol/detail-section";
import { OfficeShell } from "@/components/sawol/office-shell";
import { PageHeader } from "@/components/sawol/page-header";
import { StatusBadge } from "@/components/sawol/status-badge";
import { TaskDeleteButton } from "@/components/sawol/task-delete-button";
import { TaskEditForm } from "@/components/sawol/task-edit-form";
import { TaskRunPanel } from "@/components/sawol/task-run-panel";
import { TaskStageActions } from "@/components/sawol/task-stage-actions";
import {
  buildEmployeeWorkloads,
  rankEmployeesForTask,
} from "@/lib/sawol/assignment";
import {
  labelOf,
  priorityLabel,
  taskStatusLabel,
} from "@/lib/sawol/labels";
import { executionStatusLabel } from "@/lib/sawol/execution";
import { requireSawolAdmin } from "@/lib/auth/require-sawol-admin";

export const dynamic = "force-dynamic";

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

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireSawolAdmin();

  const [
    { data: task },
    { data: projects },
    { data: departments },
    { data: employees },
    { data: activeTasks },
    { data: runs },
    { data: currentAssignment },
    { count: pendingApprovals },
  ] = await Promise.all([
    supabase.from("tasks").select("*").eq("id", id).maybeSingle(),
    supabase.from("projects").select("id, name").order("created_at", { ascending: false }),
    supabase
      .from("departments")
      .select("id, code, name, parent_department_id")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("employees")
      .select(
        "id, name, employee_code, department_id, position, specialty, responsibilities, work_style, status, is_active",
      )
      .eq("is_active", true)
      .order("employee_code"),
    supabase
      .from("tasks")
      .select("id, assigned_employee_id, status")
      .not("assigned_employee_id", "is", null),
    supabase
      .from("task_runs")
      .select(
        "id, run_code, status, employee_id, started_at, submitted_at, completed_at, result_title, result_summary, error_message, created_at",
      )
      .eq("task_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("task_assignments")
      .select("assignment_source, assignment_reason, match_score")
      .eq("task_id", id)
      .eq("status", "ACTIVE")
      .order("assigned_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING_APPROVAL"),
  ]);

  if (!task) notFound();

  // 현재 업무 자체는 담당자의 다른 업무량 계산에서 제외.
  const workloads = buildEmployeeWorkloads((activeTasks ?? []) as any, task.id);

  const candidates = rankEmployeesForTask({
    title: task.title,
    description: task.description ?? "",
    taskType: task.task_type,
    departmentId: task.assigned_department_id,
    employees: (employees ?? []) as any,
    departments: (departments ?? []) as any,
    workloads,
  });

  return (
    <OfficeShell pendingApprovals={pendingApprovals ?? 0}>
      <PageHeader
        eyebrow={task.task_code}
        title={task.title}
        description={task.description ?? "업무 설명이 없습니다."}
        action={
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
            <Link
              href="/queue"
              className="flex h-10 min-w-[78px] items-center justify-center whitespace-nowrap rounded-[10px] border border-[#DCE4FF] bg-[#F8FAFF] px-3 text-[11px] font-semibold text-[#3157D5]"
            >
              실행 큐
            </Link>

            <Link
              href="/runs"
              className="flex h-10 min-w-[78px] items-center justify-center whitespace-nowrap rounded-[10px] border border-[#E1E4E9] bg-white px-3 text-[11px] font-semibold text-[#656B75]"
            >
              실행 기록
            </Link>

            <Link
              href="/tasks"
              className="flex h-10 min-w-[78px] items-center justify-center whitespace-nowrap rounded-[10px] border border-[#E1E4E9] bg-white px-3 text-[11px] font-semibold text-[#656B75]"
            >
              목록으로
            </Link>

            <div className="[&>button]:h-10 [&>button]:min-w-[78px] [&>button]:whitespace-nowrap">
              <TaskDeleteButton taskId={task.id} taskTitle={task.title} />
            </div>
          </div>
        }
      />

      <section className="mt-6 grid grid-cols-1 gap-3 min-[430px]:grid-cols-3">
        <div className="rounded-[16px] border border-[#E7E9EE] bg-white p-4">
          <p className="text-[10px] text-[#9297A1]">상태</p>
          <div className="mt-2">
            <StatusBadge
              value={task.status}
              label={executionStatusLabel[task.status] ?? labelOf(taskStatusLabel, task.status)}
            />
          </div>
        </div>

        <div className="rounded-[16px] border border-[#E7E9EE] bg-white p-4">
          <p className="text-[10px] text-[#9297A1]">우선순위</p>
          <div className="mt-2">
            <StatusBadge value={task.priority} label={labelOf(priorityLabel, task.priority)} />
          </div>
        </div>

        <div className="rounded-[16px] border border-[#E7E9EE] bg-white p-4">
          <p className="text-[10px] text-[#9297A1]">업무 유형</p>
          <p className="mt-2 break-words text-[12px] font-medium">
            {taskTypeLabel[task.task_type] ?? task.task_type}
          </p>
        </div>
      </section>

      <div className="mt-5">
        <AssignmentAssistant
          taskId={task.id}
          currentEmployeeId={task.assigned_employee_id}
          currentAssignment={currentAssignment as any}
          candidates={candidates}
        />
      </div>

      <div className="mt-5">
        <TaskRunPanel
          taskId={task.id}
          assignedEmployeeId={task.assigned_employee_id}
          taskStatus={task.status}
          runs={(runs ?? []) as any}
        />
      </div>

      <div className="mt-5">
        <TaskStageActions
          taskId={task.id}
          currentStatus={task.status}
          requiresCeoApproval={Boolean(task.requires_ceo_approval)}
        />
      </div>

      <div className="mt-5">
        <DetailSection
          title="업무 관리"
          description="업무 내용, 소속 프로젝트, 담당 부서와 직원을 직접 관리합니다."
        >
          <TaskEditForm
            task={task as any}
            projects={(projects ?? []) as any}
            departments={(departments ?? []) as any}
            employees={(employees ?? []) as any}
          />
        </DetailSection>
      </div>
    </OfficeShell>
  );
}
