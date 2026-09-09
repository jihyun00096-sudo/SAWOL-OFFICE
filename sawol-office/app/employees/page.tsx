import { EmployeeBrowser } from "@/components/sawol/employee-browser";
import { OfficeShell } from "@/components/sawol/office-shell";
import { PageHeader } from "@/components/sawol/page-header";
import { requireSawolAdmin } from "@/lib/auth/require-sawol-admin";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const { supabase } = await requireSawolAdmin();

  const [
    { data: employees },
    { data: departments },
    { count: pendingApprovals },
  ] = await Promise.all([
    supabase
      .from("employees")
      .select(
        "id, employee_code, name, position, status, specialty, current_task_id, departments:department_id(id, name)",
      )
      .eq("is_active", true)
      .order("employee_code"),
    supabase
      .from("departments")
      .select("id, name")
      .eq("is_active", true)
      .in("department_type", ["HEADQUARTERS", "DEPARTMENT", "LAB", "TEAM"])
      .order("sort_order"),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING_APPROVAL"),
  ]);

  return (
    <OfficeShell pendingApprovals={pendingApprovals ?? 0}>
      <PageHeader
        eyebrow="EMPLOYEES"
        title="AI 직원"
        description="전문분야와 현재 업무 상태를 기준으로 운영되는 SAWOL OFFICE의 AI 직원 명부입니다."
      />
      <EmployeeBrowser
        employees={(employees ?? []) as any}
        departments={(departments ?? []) as any}
      />
    </OfficeShell>
  );
}
