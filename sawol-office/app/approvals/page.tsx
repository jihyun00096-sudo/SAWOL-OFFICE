import { ApprovalActions } from "@/components/sawol/approval-actions";
import { EmptyState } from "@/components/sawol/empty-state";
import { OfficeShell } from "@/components/sawol/office-shell";
import { PageHeader } from "@/components/sawol/page-header";
import { StatusBadge } from "@/components/sawol/status-badge";
import { requireSawolAdmin } from "@/lib/auth/require-sawol-admin";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const { supabase } = await requireSawolAdmin();

  const [{ data: approvals }, { count: pendingApprovals }] = await Promise.all([
    supabase
      .from("approvals")
      .select("id, approval_type, title, summary, status, risk_summary, cost, ceo_comment, requested_at, decided_at")
      .order("requested_at", { ascending: false }),
    supabase.from("approvals").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
  ]);

  const sorted = [...(approvals ?? [])].sort((a, b) => {
    if (a.status === "PENDING" && b.status !== "PENDING") return -1;
    if (a.status !== "PENDING" && b.status === "PENDING") return 1;
    return 0;
  });

  return (
    <OfficeShell pendingApprovals={pendingApprovals ?? 0}>
      <PageHeader eyebrow="APPROVALS" title="승인함" description="대표 판단이 필요한 비용·결과물·배포·외부행동 요청을 한 곳에서 관리합니다." />

      <div className="mt-7">
        {!sorted.length ? (
          <EmptyState title="승인 대기 업무가 없습니다." description="대표 결정이 필요한 요청이 생기면 이곳에 표시됩니다." />
        ) : (
          <div className="space-y-3">
            {sorted.map((approval) => (
              <article key={approval.id} className="rounded-[18px] border border-[#E7E9EE] bg-white p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge value={approval.status} label={approval.status} />
                  <span className="text-[10px] text-[#969BA5]">{approval.approval_type}</span>
                </div>
                <h2 className="mt-3 text-[14px] font-semibold">{approval.title}</h2>
                <p className="mt-2 text-[11px] leading-5 text-[#777D87]">{approval.summary}</p>

                {approval.risk_summary ? <p className="mt-3 rounded-[10px] bg-[#FFF7E8] px-3 py-2 text-[10px] leading-5 text-[#94661D]">위험: {approval.risk_summary}</p> : null}
                {approval.cost != null ? <p className="mt-2 text-[10px] text-[#8C929D]">예상 비용: {Number(approval.cost).toLocaleString()}원</p> : null}

                {approval.status === "PENDING" ? <ApprovalActions id={approval.id} /> : approval.ceo_comment ? (
                  <p className="mt-4 border-t border-[#ECEEF2] pt-3 text-[10px] text-[#777D87]">대표 메모: {approval.ceo_comment}</p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </OfficeShell>
  );
}
