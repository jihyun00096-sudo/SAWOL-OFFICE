import { CommandForm } from "@/components/sawol/command-form";
import { OfficeShell } from "@/components/sawol/office-shell";
import { PageHeader } from "@/components/sawol/page-header";
import {
  buildEmployeeWorkloads,
} from "@/lib/sawol/assignment";
import { requireSawolAdmin } from "@/lib/auth/require-sawol-admin";

export const dynamic = "force-dynamic";

export default async function CommandPage() {
  const { supabase } = await requireSawolAdmin();

  const [
    { data: departments },
    { data: projects },
    { data: employees },
    { data: activeTasks },
    { count: pendingApprovals },
  ] = await Promise.all([
    supabase
      .from("departments")
      .select("id, code, name, department_type, parent_department_id")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("projects")
      .select("id, name")
      .neq("status", "CANCELLED")
      .order("created_at", { ascending: false }),
    supabase
      .from("employees")
      .select(
        "id, name, employee_code, department_id, position, specialty, responsibilities, work_style, status, is_active",
      )
      .eq("is_active", true)
      .order("employee_code"),
    supabase
      .from("tasks")
      .select("assigned_employee_id, status")
      .not("assigned_employee_id", "is", null),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING_APPROVAL"),
  ]);

  const workloads = buildEmployeeWorkloads((activeTasks ?? []) as any);

  return (
    <OfficeShell pendingApprovals={pendingApprovals ?? 0}>
      <PageHeader
        eyebrow="SECRETARY"
        title="업무지시"
        description="대표의 지시를 비서실장이 분석합니다. 자동 실행은 조직이 끝까지 처리하고, 수동 실행은 기존 배정·실행·검수 기능으로 직접 개입할 수 있습니다."
      />

      <div className="mt-6">
        <CommandForm
          departments={(departments ?? []) as any}
          projects={(projects ?? []) as any}
          employees={(employees ?? []) as any}
          workloads={workloads}
        />
      </div>
    </OfficeShell>
  );
}
