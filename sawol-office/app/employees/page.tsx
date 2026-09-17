import { OfficeShell } from "@/components/sawol/office-shell";
import { OrganizationControlCenter } from "@/components/sawol/organization-control-center";
import { PageHeader } from "@/components/sawol/page-header";
import { requireSawolAdmin } from "@/lib/auth/require-sawol-admin";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const { supabase } = await requireSawolAdmin();

  const [
    { data: employees },
    { data: departments },
    { data: tasks },
    { data: assignments },
    { data: handoffs },
    { count: pendingApprovals },
  ] = await Promise.all([
    supabase
      .from("employees")
      .select(
        "id, employee_code, name, position, status, specialty, current_task_id, departments:department_id(id, name, code)",
      )
      .eq("is_active", true)
      .order("employee_code"),
    supabase
      .from("departments")
      .select("id, code, name, department_type, sort_order")
      .eq("is_active", true)
      .in("department_type", ["HEADQUARTERS", "DEPARTMENT", "LAB", "TEAM"])
      .order("sort_order"),
    supabase
      .from("tasks")
      .select(
        "id, task_code, title, status, priority, assigned_employee_id, assigned_department_id, parent_task_id, workflow_id, updated_at, completed_at",
      )
      .order("updated_at", { ascending: false })
      .limit(600),
    supabase
      .from("task_assignments")
      .select(
        "id, task_id, employee_id, department_id, assignment_source, match_score, status, assigned_at, released_at",
      )
      .order("assigned_at", { ascending: false })
      .limit(800),
    supabase
      .from("task_handoffs")
      .select("id, from_task_id, to_task_id, title, status, created_at")
      .eq("status", "AVAILABLE")
      .order("created_at", { ascending: false })
      .limit(250),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .in("status", ["PENDING_APPROVAL", "APPROVAL_WAIT"]),
  ]);

  return (
    <OfficeShell pendingApprovals={pendingApprovals ?? 0}>
      <PageHeader
        eyebrow="ORGANIZATION"
        title="조직 · AI 직원"
        description="90명 AI 직원의 부서, 전문성, 현재 업무량, 협업 인수인계와 가동 상태를 한 곳에서 관리합니다."
      />

      <OrganizationControlCenter
        employees={(employees ?? []) as any}
        departments={(departments ?? []) as any}
        tasks={(tasks ?? []) as any}
        assignments={(assignments ?? []) as any}
        handoffs={(handoffs ?? []) as any}
      />
    </OfficeShell>
  );
}
