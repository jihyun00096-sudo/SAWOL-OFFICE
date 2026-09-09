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
      .from("approvals")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING"),
  ]);

  return (
    <OfficeShell pendingApprovals={pendingApprovals ?? 0}>
      <PageHeader
        eyebrow="RESULTS"
        title="결과함"
        description="문서, 이미지, 코드, 리서치 등 직원들이 만든 결과물을 검색하고 상세 확인합니다."
      />

      {!results?.length ? (
        <div className="mt-7">
          <EmptyState
            title="아직 결과물이 없습니다."
            description="AI 직원 실행 단계가 연결되면 완성된 결과가 이곳에 쌓입니다."
          />
        </div>
      ) : (
        <ResultBrowser results={(results ?? []) as any} />
      )}
    </OfficeShell>
  );
}
