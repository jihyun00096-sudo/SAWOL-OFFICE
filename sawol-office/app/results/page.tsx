import { EmptyState } from "@/components/sawol/empty-state";
import { OfficeShell } from "@/components/sawol/office-shell";
import { PageHeader } from "@/components/sawol/page-header";
import { ResultBrowser } from "@/components/sawol/result-browser";
import { requireSawolAdmin } from "@/lib/auth/require-sawol-admin";

export const dynamic = "force-dynamic";

export default async function ResultsPage() {
  const { supabase } = await requireSawolAdmin();

  const [{ data: results }, { count: pendingApprovals }] = await Promise.all([
    supabase
      .from("results")
      .select(
        "id, result_code, title, summary, result_type, status, version, is_final, created_at, employees:employee_id(name, employee_code)",
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
        eyebrow="RESULTS"
        title="결과함"
        description="대표 승인을 통과한 최종 결과물과 직원·AI가 만든 산출물을 검색하고 확인합니다."
      />

      {!results?.length ? (
        <div className="mt-7">
          <EmptyState
            title="아직 결과물이 없습니다."
            description="실행 결과가 대표 승인을 통과하면 최종 결과물이 이곳에 자동으로 쌓입니다."
          />
        </div>
      ) : (
        <ResultBrowser results={(results ?? []) as any} />
      )}
    </OfficeShell>
  );
}
