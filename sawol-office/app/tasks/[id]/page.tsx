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
import { AutonomousOffice } from "@/components/sawol/autonomous-office";
import { WorkflowBoard } from "@/components/sawol/workflow-board";
import { WorkflowChildContext } from "@/components/sawol/workflow-child-context";
import { buildEmployeeWorkloads, rankEmployeesForTask } from "@/lib/sawol/assignment";
import { labelOf, priorityLabel, taskStatusLabel } from "@/lib/sawol/labels";
import { executionStatusLabel } from "@/lib/sawol/execution";
import { requireSawolAdmin } from "@/lib/auth/require-sawol-admin";

export const dynamic = "force-dynamic";

const taskTypeLabel: Record<string, string> = {
  RESEARCH: "리서치", PLANNING: "기획", PRODUCTION: "제작", EDIT: "수정",
  ANALYSIS: "분석", OPERATION: "운영", STUDY: "학습", DEVELOPMENT: "개발",
  DESIGN: "디자인", OTHER: "기타",
};

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireSawolAdmin();

  const [
    { data: task }, { data: projects }, { data: departments }, { data: employees },
    { data: activeTasks }, { data: runs }, { data: currentAssignment }, { count: pendingApprovals },
  ] = await Promise.all([
    supabase.from("tasks").select("*").eq("id", id).maybeSingle(),
    supabase.from("projects").select("id, name").order("created_at", { ascending: false }),
    supabase.from("departments").select("id, code, name, parent_department_id").eq("is_active", true).order("sort_order"),
    supabase.from("employees").select("id, name, employee_code, department_id, position, specialty, responsibilities, work_style, status, is_active").eq("is_active", true).order("employee_code"),
    supabase.from("tasks").select("id, assigned_employee_id, status").not("assigned_employee_id", "is", null),
    supabase.from("task_runs").select("id, run_code, status, employee_id, started_at, submitted_at, completed_at, result_title, result_summary, error_message, created_at").eq("task_id", id).order("created_at", { ascending: false }),
    supabase.from("task_assignments").select("assignment_source, assignment_reason, match_score").eq("task_id", id).eq("status", "ACTIVE").order("assigned_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status", "PENDING_APPROVAL"),
  ]);

  if (!task) notFound();

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

  let workflow: any = null;
  let workflowSteps: any[] = [];
  let workflowDependencies: any[] = [];
  let ownDependencies: any[] = [];
  let handoffs: any[] = [];
  let rootTask: any = null;

  if (task.workflow_id) {
    const [{ data: wf }, { data: steps }, { data: deps }] = await Promise.all([
      supabase.from("task_workflows").select("*").eq("id", task.workflow_id).maybeSingle(),
      supabase.from("tasks").select("id, task_code, title, status, workflow_step_no, workflow_step_key, assigned_employee_id, assigned_department_id, employees:assigned_employee_id(name), departments:assigned_department_id(name)").eq("workflow_id", task.workflow_id).eq("is_workflow_root", false).order("workflow_step_no"),
      supabase.from("task_dependencies").select("id, task_id, depends_on_task_id, depends_on:depends_on_task_id(id, task_code, title, status)").eq("workflow_id", task.workflow_id),
    ]);
    workflow = wf;
    workflowSteps = (steps ?? []) as any[];
    workflowDependencies = (deps ?? []) as any[];
    ownDependencies = workflowDependencies.filter((dep: any) => dep.task_id === task.id);

    if (task.parent_task_id) {
      const [{ data: root }, { data: incoming }] = await Promise.all([
        supabase.from("tasks").select("id, task_code, title").eq("id", task.parent_task_id).maybeSingle(),
        supabase.from("task_handoffs").select("id, title, summary, content, created_at").eq("to_task_id", task.id).eq("status", "AVAILABLE").order("created_at"),
      ]);
      rootTask = root;
      handoffs = (incoming ?? []) as any[];
    }
  }

  const unmetDependencies = ownDependencies
    .filter((dep: any) => dep.depends_on?.status !== "COMPLETED")
    .map((dep: any) => ({ task_code: dep.depends_on?.task_code, title: dep.depends_on?.title ?? "선행 업무" }));

  return (
    <OfficeShell pendingApprovals={pendingApprovals ?? 0}>
      <PageHeader
        eyebrow={task.task_code}
        title={task.title}
        description={task.description ?? "업무 설명이 없습니다."}
        action={
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
            <Link href="/queue" className="flex h-10 min-w-[78px] items-center justify-center whitespace-nowrap rounded-[10px] border border-[#DCE4FF] bg-[#F8FAFF] px-3 text-[11px] font-semibold text-[#3157D5]">실행 큐</Link>
            <Link href="/runs" className="flex h-10 min-w-[78px] items-center justify-center whitespace-nowrap rounded-[10px] border border-[#E1E4E9] bg-white px-3 text-[11px] font-semibold text-[#656B75]">실행 기록</Link>
            <Link href="/tasks" className="flex h-10 min-w-[78px] items-center justify-center whitespace-nowrap rounded-[10px] border border-[#E1E4E9] bg-white px-3 text-[11px] font-semibold text-[#656B75]">목록으로</Link>
            <div className="[&>button]:h-10 [&>button]:min-w-[78px] [&>button]:whitespace-nowrap"><TaskDeleteButton taskId={task.id} taskTitle={task.title} /></div>
          </div>
        }
      />

      <section className="mt-6 grid grid-cols-1 gap-3 min-[430px]:grid-cols-3">
        <div className="rounded-[16px] border border-[#E7E9EE] bg-white p-4"><p className="text-[10px] text-[#9297A1]">상태</p><div className="mt-2"><StatusBadge value={task.status} label={executionStatusLabel[task.status] ?? labelOf(taskStatusLabel, task.status)} /></div></div>
        <div className="rounded-[16px] border border-[#E7E9EE] bg-white p-4"><p className="text-[10px] text-[#9297A1]">우선순위</p><div className="mt-2"><StatusBadge value={task.priority} label={labelOf(priorityLabel, task.priority)} /></div></div>
        <div className="rounded-[16px] border border-[#E7E9EE] bg-white p-4"><p className="text-[10px] text-[#9297A1]">업무 유형</p><p className="mt-2 break-words text-[12px] font-medium">{taskTypeLabel[task.task_type] ?? task.task_type}</p></div>
      </section>

      {!task.parent_task_id ? (
        <div className="mt-5"><AutonomousOffice task={task as any} employees={(employees ?? []) as any} departments={(departments ?? []) as any} workloads={workloads} hasWorkflow={Boolean(task.workflow_id)} /></div>
      ) : null}

      {task.is_workflow_root && workflow ? (
        <div className="mt-5"><WorkflowBoard workflow={workflow} steps={workflowSteps} dependencies={workflowDependencies} /></div>
      ) : null}

      {task.parent_task_id && rootTask ? (
        <div className="mt-5"><WorkflowChildContext rootTask={rootTask} stepNo={task.workflow_step_no} dependencies={ownDependencies} handoffs={handoffs} /></div>
      ) : null}

      {!task.parent_task_id ? (
        <details className="mt-5 rounded-[18px] border border-[#E7E9EE] bg-white">
          <summary className="cursor-pointer list-none px-5 py-4 text-[11px] font-semibold text-[#6F7682]">수동 관리 · 오류 복구가 필요할 때만 열기</summary>
          <div className="space-y-5 border-t border-[#ECEEF2] p-5">
            <AssignmentAssistant taskId={task.id} currentEmployeeId={task.assigned_employee_id} currentAssignment={currentAssignment as any} candidates={candidates} />
            <TaskRunPanel taskId={task.id} assignedEmployeeId={task.assigned_employee_id} taskStatus={task.status} runs={(runs ?? []) as any} isWorkflowRoot={Boolean(task.is_workflow_root)} unmetDependencies={unmetDependencies} />
            <TaskStageActions taskId={task.id} currentStatus={task.status} requiresCeoApproval={Boolean(task.requires_ceo_approval)} isWorkflowRoot={Boolean(task.is_workflow_root)} unmetDependencies={unmetDependencies.length} />
            <DetailSection title="업무 관리" description="업무 내용, 소속 프로젝트, 담당 부서와 직원을 직접 관리합니다.">
              <TaskEditForm task={task as any} projects={(projects ?? []) as any} departments={(departments ?? []) as any} employees={(employees ?? []) as any} />
            </DetailSection>
          </div>
        </details>
      ) : (
        <div className="mt-5 rounded-[16px] border border-[#E7E9EE] bg-white p-4 text-[10px] leading-5 text-[#737A85]">이 화면은 AI 조직 내부 단계입니다. 대표가 직접 실행할 필요가 없으며 상위 업무의 AI 자율 오피스가 자동으로 이어서 처리합니다.</div>
      )}
    </OfficeShell>
  );
}
