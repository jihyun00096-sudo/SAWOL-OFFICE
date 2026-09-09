import { CommandForm } from "@/components/sawol/command-form";
import { OfficeShell } from "@/components/sawol/office-shell";
import { PageHeader } from "@/components/sawol/page-header";
import { requireSawolAdmin } from "@/lib/auth/require-sawol-admin";

export const dynamic = "force-dynamic";

export default async function CommandPage() {
  const { supabase } = await requireSawolAdmin();

  const [
    { data: departments },
    { data: projects },
    { data: employees },
    { count: pendingApprovals },
  ] = await Promise.all([
    supabase
      .from("departments")
      .select("id, code, name, department_type")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("projects")
      .select("id, name")
      .neq("status", "CANCELLED")
      .order("created_at", { ascending: false }),
    supabase
      .from("employees")
      .select("id, name, employee_code")
      .eq("is_active", true)
      .order("employee_code"),
    supabase
      .from("approvals")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING"),
  ]);

  return (
    <OfficeShell pendingApprovals={pendingApprovals ?? 0}>
      <PageHeader
        eyebrow="SECRETARY"
        title="업무지시"
        description="대표의 지시를 먼저 비서실장이 분석하고, 배정안을 확인한 뒤 실제 업무로 등록합니다."
      />

      <div className="mt-6">
        <CommandForm
          departments={(departments ?? []) as any}
          projects={(projects ?? []) as any}
          employees={(employees ?? []) as any}
        />
      </div>
    </OfficeShell>
  );
}
