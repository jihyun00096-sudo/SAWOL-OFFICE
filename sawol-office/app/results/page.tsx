import { EmptyState } from "@/components/sawol/empty-state";
import { OfficeShell } from "@/components/sawol/office-shell";
import { PageHeader } from "@/components/sawol/page-header";
import { StatusBadge } from "@/components/sawol/status-badge";
import { labelOf, resultTypeLabel } from "@/lib/sawol/labels";
import { requireSawolAdmin } from "@/lib/auth/require-sawol-admin";

export const dynamic = "force-dynamic";

export default async function ResultsPage() {
  const { supabase } = await requireSawolAdmin();

  const [{ data: results }, { count: pendingApprovals }] = await Promise.all([
    supabase
      .from("results")
      .select("id, result_code, title, summary, result_type, status, version, is_final, created_at, employees:employee_id(name, employee_code)")
      .order("created_at", { ascending: false }),
    supabase.from("approvals").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
  ]);

  return (
    <OfficeShell pendingApprovals={pendingApprovals ?? 0}>
      <PageHeader eyebrow="RESULTS" title="결과함" description="문서, 이미지, 코드, 리서치 등 직원들이 만든 결과물을 모아보는 공간입니다." />

      <div className="mt-7">
        {!results?.length ? (
          <EmptyState title="아직 결과물이 없습니다." description="AI 직원 실행 단계가 연결되면 완성된 결과가 이곳에 쌓입니다." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {results.map((result: any) => (
              <article key={result.id} className="rounded-[17px] border border-[#E7E9EE] bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-[#F4F5F7] px-2.5 py-1 text-[10px] text-[#707680]">{labelOf(resultTypeLabel, result.result_type)}</span>
                  <StatusBadge value={result.status} label={result.status} />
                </div>
                <h2 className="mt-4 text-[14px] font-semibold">{result.title}</h2>
                <p className="mt-2 line-clamp-3 text-[11px] leading-5 text-[#7D838E]">{result.summary ?? "요약 없음"}</p>
                <div className="mt-4 flex flex-wrap gap-3 text-[10px] text-[#999EA7]">
                  <span>v{result.version}</span>
                  <span>{result.employees?.name ?? "담당자 없음"}</span>
                  {result.is_final ? <span className="font-medium text-[#3157D5]">최종본</span> : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </OfficeShell>
  );
}
