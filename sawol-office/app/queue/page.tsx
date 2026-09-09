import Link from "next/link";
import { EmployeeWorkload } from "@/components/sawol/employee-workload";
import { ExecutionQueue } from "@/components/sawol/execution-queue";
import { OfficeShell } from "@/components/sawol/office-shell";
import { PageHeader } from "@/components/sawol/page-header";
import { requireSawolAdmin } from "@/lib/auth/require-sawol-admin";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const { supabase } = await requireSawolAdmin();

  const [
    { data: tasks },
    { data: employees },
    { count: pendingApprovals },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        `
        id,
        task_code,
        title,
        description,
        status,
        priority,
        task_type,
        requires_ceo_approval,
        assigned_employee_id,
        created_at,
        employees:assigned_employee_id(name),
        departments:assigned_department_id(name)
        `,
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("employees")
      .select("id, name, employee_code")
      .eq("is_active", true)
      .order("employee_code"),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING_APPROVAL"),
  ]);

  const taskRows = (tasks ?? []) as any[];

  const workload = (employees ?? []).map((employee: any) => {
    const own = taskRows.filter(
      (task) => task.assigned_employee_id === employee.id,
    );

    return {
      id: employee.id,
      name: employee.name,
      employee_code: employee.employee_code,
      waiting: own.filter((task) => task.status === "WAITING").length,
      inProgress: own.filter((task) => task.status === "IN_PROGRESS").length,
      review: own.filter((task) => task.status === "REVIEW").length,
      pendingApproval: own.filter(
        (task) => task.status === "PENDING_APPROVAL",
      ).length,
      error: own.filter((task) => task.status === "ERROR").length,
    };
  });

  return (
    <OfficeShell pendingApprovals={pendingApprovals ?? 0}>
      <PageHeader
        eyebrow="OPERATIONS"
        title="업무 실행 큐"
        description="등록된 업무를 대기부터 완료까지 실제 운영 단계별로 확인하고 관리합니다."
        action={
          <Link
            href="/tasks"
            className="flex h-10 items-center justify-center rounded-[10px] border border-[#E1E4E9] bg-white px-4 text-[11px] font-semibold text-[#656B75]"
          >
            전체 업무
          </Link>
        }
      />

      <ExecutionQueue tasks={taskRows as any} />

      <div className="mt-6">
        <EmployeeWorkload employees={workload} />
      </div>
    </OfficeShell>
  );
}
