import { EmptyState } from "@/components/sawol/empty-state";
import { OfficeShell } from "@/components/sawol/office-shell";
import { PageHeader } from "@/components/sawol/page-header";
import { TaskBrowser } from "@/components/sawol/task-browser";
import { requireSawolAdmin } from "@/lib/auth/require-sawol-admin";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const { supabase } = await requireSawolAdmin();

  const [
    { data: tasks },
    { data: workflowChildren },
    { count: pendingApprovals },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select(`
        id, task_code, title, description, task_type, status, priority, created_at,
        parent_task_id, workflow_id, is_workflow_root, execution_mode,
        employees:assigned_employee_id(name, employee_code),
        departments:assigned_department_id(name)
      `)
      .is("parent_task_id", null)
      .order("created_at", { ascending: false }),

    supabase
      .from("tasks")
      .select(`
        id, parent_task_id, workflow_id, workflow_step_no, workflow_step_key,
        title, status,
        employees:assigned_employee_id(name, employee_code)
      `)
      .not("parent_task_id", "is", null)
      .order("workflow_step_no", { ascending: true }),

    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING_APPROVAL"),
  ]);

  const childrenByRoot = new Map<string, any[]>();

  for (const child of workflowChildren ?? []) {
    if (!child.parent_task_id) continue;
    const list = childrenByRoot.get(child.parent_task_id) ?? [];
    list.push(child);
    childrenByRoot.set(child.parent_task_id, list);
  }

  const enrichedTasks = (tasks ?? []).map((task: any) => {
    const children = childrenByRoot.get(task.id) ?? [];
    const completed = children.filter((child) => child.status === "COMPLETED").length;
    const current =
      children.find((child) =>
        ["IN_PROGRESS", "REVIEW", "PENDING_APPROVAL", "ERROR", "ON_HOLD"].includes(child.status),
      ) ??
      children.find((child) => child.status === "WAITING") ??
      children.at(-1) ??
      null;

    return {
      ...task,
      workflow_summary: children.length
        ? {
            total: children.length,
            completed,
            current_title: current?.title ?? null,
            current_status: current?.status ?? null,
            current_employee: current?.employees?.name ?? null,
          }
        : null,
    };
  });

  return (
    <OfficeShell pendingApprovals={pendingApprovals ?? 0}>
      <PageHeader
        eyebrow="TASKS"
        title="전체 업무"
        description="대표가 지시한 메인 업무만 표시합니다. AI 협업의 세부 단계는 메인 업무 안에서 확인할 수 있습니다."
      />

      {!enrichedTasks.length ? (
        <div className="mt-7">
          <EmptyState
            title="등록된 업무가 없습니다."
            description="업무지시 메뉴에서 첫 업무를 등록해보세요."
          />
        </div>
      ) : (
        <TaskBrowser tasks={enrichedTasks as any} />
      )}
    </OfficeShell>
  );
}
