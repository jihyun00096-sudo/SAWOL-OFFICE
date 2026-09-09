import { CommandForm } from "@/components/sawol/command-form";
import { OfficeShell } from "@/components/sawol/office-shell";
import { PageHeader } from "@/components/sawol/page-header";
import { requireSawolAdmin } from "@/lib/auth/require-sawol-admin";

export const dynamic = "force-dynamic";

export default async function CommandPage() {
  const { supabase } = await requireSawolAdmin();

  const [{ data: departments }, { count: pendingApprovals }] = await Promise.all([
    supabase
      .from("departments")
      .select("id, code, name, department_type")
      .in("department_type", ["HEADQUARTERS", "DEPARTMENT", "LAB"])
      .eq("is_active", true)
      .order("sort_order"),
    supabase.from("approvals").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
  ]);

  return (
    <OfficeShell pendingApprovals={pendingApprovals ?? 0}>
      <PageHeader
        eyebrow="CEO COMMAND"
        title="업무지시"
        description="지금은 업무를 구조화해 회사 DB에 등록합니다. AI 비서실 자동분석은 이후 단계에서 연결됩니다."
      />

      <div className="mt-7 grid gap-5 lg:grid-cols-[1fr_280px]">
        <CommandForm departments={(departments ?? []) as any} />

        <aside className="space-y-3">
          <div className="rounded-[18px] border border-[#E7E9EE] bg-white p-5">
            <p className="text-[12px] font-semibold">업무지시 원칙</p>
            <div className="mt-4 space-y-3 text-[11px] leading-5 text-[#7D838E]">
              <p>1. 원하는 결과를 구체적으로 적습니다.</p>
              <p>2. 사실 확인이 필요한 경우 업무 유형을 리서치로 지정합니다.</p>
              <p>3. 외부 발송·비용·배포는 이후에도 대표 승인 없이 실행하지 않습니다.</p>
            </div>
          </div>
          <div className="rounded-[18px] bg-[#EEF2FF] p-5">
            <p className="text-[11px] font-semibold text-[#3157D5]">다음 확장</p>
            <p className="mt-2 text-[11px] leading-5 text-[#66729A]">
              윤서진 비서실장이 지시를 읽고 프로젝트 여부, 담당 부서, 직원, 검수 단계를 자동 제안하게 됩니다.
            </p>
          </div>
        </aside>
      </div>
    </OfficeShell>
  );
}
