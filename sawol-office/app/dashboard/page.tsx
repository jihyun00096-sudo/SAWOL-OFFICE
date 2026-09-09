import { OfficeShell } from "@/components/sawol/office-shell";
import { PageHeader } from "@/components/sawol/page-header";
import { requireSawolAdmin } from "@/lib/auth/require-sawol-admin";

export const dynamic = "force-dynamic";

type DashboardSummary = {
  active_projects: number | null;
  active_tasks: number | null;
  pending_approvals: number | null;
  waiting_for_data: number | null;
  error_tasks: number | null;
  completed_today: number | null;
};

function Stat({
  label,
  value,
  note,
  accent,
}: {
  label: string;
  value: number;
  note: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-[16px] border p-4 sm:rounded-[18px] sm:p-5 ${
        accent
          ? "border-[#DCE4FF] bg-[#F8FAFF]"
          : "border-[#E7E9EE] bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[11px] font-medium text-[#737985] sm:text-[12px]">
          {label}
        </p>
        {accent ? (
          <span className="h-2 w-2 shrink-0 rounded-full bg-[#3157D5]" />
        ) : null}
      </div>

      <p className="mt-3 text-[27px] font-bold tracking-[-0.04em] sm:mt-4 sm:text-[29px]">
        {value.toLocaleString()}
      </p>

      <p className="mt-1 text-[10px] leading-4 text-[#999EA7] sm:text-[11px]">
        {note}
      </p>
    </div>
  );
}

export default async function DashboardPage() {
  const { supabase } = await requireSawolAdmin();

  const [
    { data: summaryRow },
    { count: employeeCount },
    { count: departmentCount },
    { count: memoryCount },
  ] = await Promise.all([
    supabase.from("v_ceo_dashboard_summary").select("*").maybeSingle(),
    supabase
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    supabase
      .from("departments")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    supabase
      .from("memories")
      .select("id", { count: "exact", head: true })
      .eq("status", "ACTIVE"),
  ]);

  const summary = (summaryRow ?? {}) as Partial<DashboardSummary>;
  const pendingApprovals = Number(summary.pending_approvals ?? 0);

  return (
    <OfficeShell pendingApprovals={pendingApprovals}>
      <PageHeader
        eyebrow="대표실"
        title="오늘의 SAWOL OFFICE"
        description="필요한 것만 확인하고 결정할 수 있도록 현재 회사 상태를 간단하게 정리했습니다."
      />

      <section className="mt-6 grid grid-cols-1 gap-3 min-[430px]:grid-cols-2 lg:mt-7 lg:grid-cols-4">
        <Stat
          label="진행 프로젝트"
          value={Number(summary.active_projects ?? 0)}
          note="현재 진행 상태"
          accent
        />
        <Stat
          label="진행 업무"
          value={Number(summary.active_tasks ?? 0)}
          note="직원 작업 중"
        />
        <Stat
          label="승인 대기"
          value={pendingApprovals}
          note="대표 확인 필요"
        />
        <Stat
          label="오류"
          value={Number(summary.error_tasks ?? 0)}
          note="확인 필요한 문제"
        />
      </section>

      <section className="mt-4 rounded-[18px] border border-[#E7E9EE] bg-white p-4 sm:rounded-[20px] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EEF2FF] text-[12px] font-bold text-[#3157D5]">
                윤
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold">
                  윤서진 비서실장
                </p>
                <p className="mt-0.5 text-[10px] text-[#989DA6]">
                  오늘의 브리핑
                </p>
              </div>
            </div>

            <p className="mt-4 break-keep text-[12px] leading-6 text-[#555B65] sm:mt-5 sm:text-[13px] sm:leading-7">
              현재 AI 직원{" "}
              <strong className="text-[#17181C]">{employeeCount ?? 0}명</strong>,
              조직 및 팀{" "}
              <strong className="text-[#17181C]">{departmentCount ?? 0}개</strong>,
              활성 기억{" "}
              <strong className="text-[#17181C]">{memoryCount ?? 0}건</strong>이
              연결되어 있습니다. 업무지시와 프로젝트 메뉴에서 실제 업무를 등록할 수 있습니다.
            </p>
          </div>

          <span className="w-fit shrink-0 rounded-full bg-[#F1F3F6] px-3 py-1.5 text-[10px] font-medium text-[#6D737E]">
            운영판 연결 완료
          </span>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-3 min-[430px]:grid-cols-3 lg:mt-8">
        {[
          ["직원", employeeCount ?? 0, "전문 AI 직원"],
          ["조직 · 팀", departmentCount ?? 0, "업무 분류 체계"],
          ["오늘 완료", Number(summary.completed_today ?? 0), "완료된 Task"],
        ].map(([label, value, note]) => (
          <div
            key={String(label)}
            className="min-w-0 rounded-[15px] bg-[#ECEFF5]/70 p-4 sm:rounded-[16px]"
          >
            <p className="text-[10px] text-[#838995] sm:text-[11px]">{label}</p>
            <p className="mt-2 text-[20px] font-bold tracking-[-0.03em] sm:text-[21px]">
              {Number(value).toLocaleString()}
            </p>
            <p className="mt-1 text-[9px] text-[#9BA0A9] sm:text-[10px]">{note}</p>
          </div>
        ))}
      </section>
    </OfficeShell>
  );
}
