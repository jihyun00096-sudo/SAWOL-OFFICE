import { EmptyState } from "@/components/sawol/empty-state";
import { OfficeShell } from "@/components/sawol/office-shell";
import { PageHeader } from "@/components/sawol/page-header";
import { TaskBrowser } from "@/components/sawol/task-browser";
import { requireSawolAdmin } from "@/lib/auth/require-sawol-admin";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const { supabase } = await requireSawolAdmin();

  const [{ data: tasks }, { count: pendingApprovals }] = await Promise.all([
    supabase
      .from("tasks")
      .select(`
        id, task_code, title, description, task_type, status, priority, created_at,
        employees:assigned_employee_id(name, employee_code),
        departments:assigned_department_id(name)
      `)
      .order("created_at", { ascending: false }),
    supabase
      .from("approvals")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING"),
  ]);

  return (
    <OfficeShell pendingApprovals={pendingApprovals ?? 0}>
      <PageHeader
        eyebrow="TASKS"
        title="전체 업무"
        description="프로젝트와 관계없이 회사에 등록된 모든 업무를 검색하고 관리합니다."
      />

      {!tasks?.length ? (
        <div className="mt-7">
          <EmptyState
            title="등록된 업무가 없습니다."
            description="업무지시 메뉴에서 첫 업무를 등록해보세요."
          />
        </div>
      ) : (
        <TaskBrowser tasks={(tasks ?? []) as any} />
      )}
    </OfficeShell>
  );
}
