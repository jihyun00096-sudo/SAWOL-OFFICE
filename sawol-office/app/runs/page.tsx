import { OfficeShell } from "@/components/sawol/office-shell";
import { PageHeader } from "@/components/sawol/page-header";
import { RunBrowser } from "@/components/sawol/run-browser";
import { requireSawolAdmin } from "@/lib/auth/require-sawol-admin";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  const { supabase } = await requireSawolAdmin();

  const [
    { data: runs },
    { count: pendingApprovals },
  ] = await Promise.all([
    supabase
      .from("task_runs")
      .select(
        `
        id,
        run_code,
        status,
        result_title,
        created_at,
        tasks:task_id(title, task_code),
        employees:employee_id(name)
        `,
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING_APPROVAL"),
  ]);

  return (
    <OfficeShell pendingApprovals={pendingApprovals ?? 0}>
      <PageHeader
        eyebrow="EXECUTIONS"
        title="실행 기록"
        description="AI 직원과 업무 실행 세션, 제출 결과와 오류 이력을 확인합니다."
      />

      <RunBrowser runs={(runs ?? []) as any} />
    </OfficeShell>
  );
}
