import { LogoutButton } from "@/components/sawol/logout-button";
import { requireSawolAdmin } from "@/lib/auth/require-sawol-admin";
export const instant = false;


export const metadata = {
  title: "대표실",
};

type DashboardSummary = {
  active_projects: number | null;
  active_tasks: number | null;
  pending_approvals: number | null;
  waiting_for_data: number | null;
  error_tasks: number | null;
  completed_today: number | null;
};

function StatCard({
  label,
  value,
  note,
  accent = false,
}: {
  label: string;
  value: number;
  note: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-[18px] border p-5 sm:p-6 ${
        accent
          ? "border-[#DCE4FF] bg-[#F8FAFF]"
          : "border-[#E7E9EE] bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-[#6F7580]">{label}</p>

        {accent ? (
          <span className="h-2 w-2 rounded-full bg-[#3157D5]" />
        ) : null}
      </div>

      <p className="mt-4 text-[30px] font-bold tracking-[-0.04em] text-[#17181C]">
        {value.toLocaleString()}
      </p>

      <p className="mt-1 text-[12px] leading-5 text-[#9499A3]">{note}</p>
    </div>
  );
}

const menuItems = [
  {
    title: "업무지시",
    description: "AI 비서실에 새로운 업무를 전달합니다.",
    status: "다음 단계",
  },
  {
    title: "프로젝트",
    description: "진행 중인 프로젝트와 단계별 현황을 관리합니다.",
    status: "준비 중",
  },
  {
    title: "직원",
    description: "95명의 AI 직원과 전문 역할을 확인합니다.",
    status: "데이터 연결됨",
  },
  {
    title: "승인함",
    description: "대표 판단이 필요한 결과와 요청을 모아봅니다.",
    status: "준비 중",
  },
  {
    title: "결과함",
    description: "문서·이미지·코드·리서치 결과를 관리합니다.",
    status: "준비 중",
  },
  {
    title: "기억센터",
    description: "대표 선호와 프로젝트 경험을 축적합니다.",
    status: "데이터 연결됨",
  },
];

export default async function DashboardPage() {

  const { supabase } = await requireSawolAdmin();

  const [
    { data: summaryRow },
    { count: employeeCount },
    { count: departmentCount },
    { count: memoryCount },
  ] = await Promise.all([
    supabase
      .from("v_ceo_dashboard_summary")
      .select("*")
      .maybeSingle<DashboardSummary>(),

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

  const summary: DashboardSummary = summaryRow ?? {
    active_projects: 0,
    active_tasks: 0,
    pending_approvals: 0,
    waiting_for_data: 0,
    error_tasks: 0,
    completed_today: 0,
  };

  const activeProjects = Number(summary.active_projects ?? 0);
  const activeTasks = Number(summary.active_tasks ?? 0);
  const pendingApprovals = Number(summary.pending_approvals ?? 0);
  const errorTasks = Number(summary.error_tasks ?? 0);

  return (
    <main className="min-h-screen bg-[#F6F7F9]">
      <header className="sticky top-0 z-20 border-b border-[#E7E9EE]/90 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-5 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#17181C] text-[11px] font-bold text-white">
              SO
            </div>

            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold tracking-[-0.02em]">
                SAWOL OFFICE
              </p>

              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#31A36B]" />
                <p className="text-[11px] text-[#8A909B]">정상 운영 중</p>
              </div>
            </div>
          </div>

          <LogoutButton />
        </div>
      </header>

      <div className="mx-auto max-w-[1180px] px-5 py-8 sm:px-8 sm:py-10 lg:py-12">
        <section>
          <p className="text-[13px] font-semibold text-[#3157D5]">대표실</p>

          <h1 className="mt-2 text-[27px] font-bold tracking-[-0.04em] text-[#17181C] sm:text-[34px]">
            오늘의 SAWOL OFFICE
          </h1>

          <p className="mt-3 max-w-[640px] text-[14px] leading-6 text-[#747A86] sm:text-[15px]">
            필요한 것만 확인하고 결정할 수 있도록 현재 회사 상태를 간단하게
            정리했습니다.
          </p>
        </section>

        <section className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard
            label="진행 프로젝트"
            value={activeProjects}
            note="현재 진행 상태"
            accent
          />

          <StatCard
            label="진행 업무"
            value={activeTasks}
            note="직원 작업 중"
          />

          <StatCard
            label="승인 대기"
            value={pendingApprovals}
            note="대표 확인 필요"
          />

          <StatCard
            label="오류"
            value={errorTasks}
            note="확인 필요한 문제"
          />
        </section>

        <section className="mt-5 rounded-[20px] border border-[#E7E9EE] bg-white p-5 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EEF2FF] text-[12px] font-bold text-[#3157D5]">
                  윤
                </div>

                <div>
                  <p className="text-[13px] font-semibold">윤서진 비서실장</p>
                  <p className="text-[11px] text-[#969BA5]">오늘의 브리핑</p>
                </div>
              </div>

              <p className="mt-5 max-w-[760px] text-[14px] leading-7 text-[#4D525C]">
                SAWOL OFFICE의 기본 조직과 대표 권한 시스템이 연결되었습니다.
                현재 직원{" "}
                <strong className="font-semibold text-[#17181C]">
                  {(employeeCount ?? 0).toLocaleString()}명
                </strong>
                , 조직 및 팀{" "}
                <strong className="font-semibold text-[#17181C]">
                  {(departmentCount ?? 0).toLocaleString()}개
                </strong>
                가 등록되어 있습니다. 아직 실제 프로젝트가 시작되지 않았기 때문에
                진행 업무와 승인 대기가 0인 것은 정상입니다.
              </p>
            </div>

            <span className="w-fit rounded-full bg-[#F1F3F6] px-3 py-1.5 text-[11px] font-medium text-[#6D737E]">
              기반 시스템 연결 완료
            </span>
          </div>
        </section>

        <section className="mt-9">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-[18px] font-semibold tracking-[-0.025em]">
                업무 공간
              </h2>

              <p className="mt-1 text-[12px] text-[#8B909A]">
                필요한 메뉴부터 하나씩 연결합니다.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {menuItems.map((item) => (
              <div
                key={item.title}
                className="group rounded-[18px] border border-[#E7E9EE] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#D9DDE5] hover:shadow-[0_10px_30px_rgba(20,28,45,0.04)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-[15px] font-semibold tracking-[-0.02em]">
                    {item.title}
                  </h3>

                  <span className="shrink-0 rounded-full bg-[#F4F5F7] px-2.5 py-1 text-[10px] font-medium text-[#858B96]">
                    {item.status}
                  </span>
                </div>

                <p className="mt-3 text-[12px] leading-5 text-[#808691]">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-9 border-t border-[#E3E6EB] pt-7">
          <h2 className="text-[14px] font-semibold">회사 기반 데이터</h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[16px] bg-[#ECEFF5]/70 p-4">
              <p className="text-[11px] text-[#838995]">AI 직원</p>

              <p className="mt-2 text-[21px] font-bold tracking-[-0.03em]">
                {(employeeCount ?? 0).toLocaleString()}
              </p>
            </div>

            <div className="rounded-[16px] bg-[#ECEFF5]/70 p-4">
              <p className="text-[11px] text-[#838995]">조직 · 팀</p>

              <p className="mt-2 text-[21px] font-bold tracking-[-0.03em]">
                {(departmentCount ?? 0).toLocaleString()}
              </p>
            </div>

            <div className="rounded-[16px] bg-[#ECEFF5]/70 p-4">
              <p className="text-[11px] text-[#838995]">활성 기억</p>

              <p className="mt-2 text-[21px] font-bold tracking-[-0.03em]">
                {(memoryCount ?? 0).toLocaleString()}
              </p>
            </div>
          </div>
        </section>

        <footer className="mt-12 pb-4 text-center text-[11px] text-[#A0A5AE]">
          SAWOL OFFICE · v0.1
        </footer>
      </div>
    </main>
  );
}