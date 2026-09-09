import { EmptyState } from "@/components/sawol/empty-state";
import { OfficeShell } from "@/components/sawol/office-shell";
import { PageHeader } from "@/components/sawol/page-header";
import { StatusBadge } from "@/components/sawol/status-badge";
import { labelOf, priorityLabel, taskStatusLabel } from "@/lib/sawol/labels";
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
    supabase.from("approvals").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
  ]);

  return (
    <OfficeShell pendingApprovals={pendingApprovals ?? 0}>
      <PageHeader eyebrow="TASKS" title="전체 업무" description="프로젝트와 관계없이 회사에 등록된 모든 Task를 확인합니다." />

      <div className="mt-7">
        {!tasks?.length ? (
          <EmptyState title="등록된 업무가 없습니다." description="업무지시 메뉴에서 첫 업무를 등록해보세요." />
        ) : (
          <div className="space-y-3">
            {tasks.map((task: any) => (
              <article key={task.id} className="rounded-[17px] border border-[#E7E9EE] bg-white p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge value={task.status} label={labelOf(taskStatusLabel, task.status)} />
                  <StatusBadge value={task.priority} label={labelOf(priorityLabel, task.priority)} />
                  <span className="text-[10px] text-[#9A9FAA]">{task.task_type}</span>
                </div>

                <h2 className="mt-3 text-[14px] font-semibold">{task.title}</h2>
                {task.description ? <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-[#818791]">{task.description}</p> : null}

                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[10px] text-[#999EA7]">
                  <span>{task.task_code}</span>
                  <span>담당 직원: {task.employees?.name ?? "미배정"}</span>
                  <span>부서: {task.departments?.name ?? "미배정"}</span>
                  <span>{new Date(task.created_at).toLocaleDateString("ko-KR")}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </OfficeShell>
  );
}
