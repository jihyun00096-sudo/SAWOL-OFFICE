import Link from "next/link";
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

type EmployeeRow = {
  id: string;
  name: string;
  position: string | null;
  status: string;
  current_task_id: string | null;
};

type TaskRow = {
  id: string;
  parent_task_id: string | null;
  task_code: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  task_type: string;
  execution_mode: string | null;
  assigned_employee_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  employees?: { name?: string | null } | null;
};

type JobRow = {
  id: string;
  task_id: string;
  status: string;
  progress: number | null;
  current_step_title: string | null;
  last_message: string | null;
  last_error: string | null;
  metadata: Record<string, any> | null;
  updated_at: string;
};

type FeedbackRow = {
  root_task_id: string;
  reason: string;
  status: string;
  created_at: string;
};

const taskStatusLabel: Record<string, string> = {
  WAITING: "대기",
  WAITING_FOR_DATA: "자료 대기",
  IN_PROGRESS: "진행 중",
  COLLABORATING: "협업 중",
  IN_REVIEW: "검수 중",
  REVIEW: "검수 중",
  PENDING_APPROVAL: "승인 대기",
  APPROVAL_WAIT: "승인 대기",
  REVISION_REQUESTED: "수정 요청",
  COMPLETED: "완료",
  ON_HOLD: "보류",
  CANCELLED: "취소",
  ERROR: "오류",
};

const employeeStatusLabel: Record<string, string> = {
  AVAILABLE: "대기 가능",
  WORKING: "작업 중",
  WAITING: "대기",
  REVIEWING: "검수 중",
  APPROVAL_WAIT: "승인 대기",
  BLOCKED: "문제 확인",
  OFFLINE: "오프라인",
};

const jobStatusLabel: Record<string, string> = {
  QUEUED: "실행 대기",
  RUNNING: "자동 실행 중",
  AWAITING_APPROVAL: "대표 승인 대기",
  COMPLETED: "완료",
  FAILED: "오류",
  PAUSED: "대표 판단 필요",
};

function n(value: unknown) {
  return Number(value ?? 0);
}

function safeMeta(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, any>) : {};
}

function truncate(value: string | null | undefined, max = 110) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function formatTime(value: string | null | undefined) {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function StatCard({
  label,
  value,
  note,
  href,
  tone = "default",
}: {
  label: string;
  value: number;
  note: string;
  href?: string;
  tone?: "default" | "blue" | "warning" | "danger";
}) {
  const styles = {
    default: "border-[#E7E9EE] bg-white",
    blue: "border-[#DCE4FF] bg-[#F8FAFF]",
    warning: "border-[#F2E2BC] bg-[#FFFDF7]",
    danger: "border-[#F0D5D5] bg-[#FFF9F9]",
  }[tone];

  const valueStyle = {
    default: "text-[#17181C]",
    blue: "text-[#3157D5]",
    warning: "text-[#9A7020]",
    danger: "text-[#B34A4A]",
  }[tone];

  const card = (
    <div className={`h-full rounded-[18px] border p-4 transition sm:p-5 ${styles} ${href ? "hover:-translate-y-0.5 hover:shadow-sm" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium text-[#747B86] sm:text-[12px]">{label}</p>
        {href ? <span className="text-[10px] text-[#A1A6AF]">보기 →</span> : null}
      </div>
      <p className={`mt-3 text-[28px] font-bold tracking-[-0.04em] ${valueStyle}`}>
        {value.toLocaleString()}
      </p>
      <p className="mt-1 text-[10px] leading-4 text-[#9A9FA8]">{note}</p>
    </div>
  );

  return href ? <Link href={href}>{card}</Link> : card;
}

function EmptyMini({ text }: { text: string }) {
  return (
    <div className="rounded-[14px] border border-dashed border-[#E1E4E9] bg-[#FAFBFC] px-4 py-7 text-center text-[11px] text-[#9399A3]">
      {text}
    </div>
  );
}

export default async function DashboardPage() {
  const { supabase } = await requireSawolAdmin();

  const [
    { data: summaryRow },
    { data: employees },
    { count: departmentCount },
    { count: memoryCount },
    { data: jobs },
    { data: feedbackRows },
    { data: recentTasks },
  ] = await Promise.all([
    supabase.from("v_ceo_dashboard_summary").select("*").maybeSingle(),
    supabase
      .from("employees")
      .select("id, name, position, status, current_task_id")
      .eq("is_active", true)
      .order("employee_code"),
    supabase
      .from("departments")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    supabase
      .from("memories")
      .select("id", { count: "exact", head: true })
      .eq("status", "ACTIVE"),
    supabase
      .from("task_autopilot_jobs")
      .select("id, task_id, status, progress, current_step_title, last_message, last_error, metadata, updated_at")
      .in("status", ["QUEUED", "RUNNING", "AWAITING_APPROVAL", "PAUSED", "FAILED"])
      .order("updated_at", { ascending: false })
      .limit(20),
    supabase
      .from("task_feedback")
      .select("root_task_id, reason, status, created_at")
      .eq("status", "ACTIVE")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("tasks")
      .select(
        "id, parent_task_id, task_code, title, description, status, priority, task_type, execution_mode, assigned_employee_id, created_at, updated_at, completed_at, employees:assigned_employee_id(name)",
      )
      .order("updated_at", { ascending: false })
      .limit(60),
  ]);

  const summary = (summaryRow ?? {}) as Partial<DashboardSummary>;
  const employeeRows = (employees ?? []) as EmployeeRow[];
  const taskRows = (recentTasks ?? []) as TaskRow[];
  const jobRows = (jobs ?? []) as JobRow[];
  const feedback = (feedbackRows ?? []) as FeedbackRow[];

  const taskById = new Map(taskRows.map((task) => [task.id, task]));
  const feedbackByTask = new Map(feedback.map((item) => [item.root_task_id, item]));

  const pendingApprovals = n(summary.pending_approvals);
  const pausedJobs = jobRows.filter((job) => job.status === "PAUSED");
  const failedJobs = jobRows.filter((job) => job.status === "FAILED");
  const reworkJobs = jobRows.filter((job) => {
    const metadata = safeMeta(job.metadata);
    return Boolean(metadata.rejection) || feedbackByTask.has(job.task_id);
  });
  const runningJobs = jobRows.filter((job) => ["QUEUED", "RUNNING"].includes(job.status));

  const attentionCount = pendingApprovals + pausedJobs.length + failedJobs.length;

  const workingEmployees = employeeRows.filter((employee) =>
    ["WORKING", "REVIEWING", "APPROVAL_WAIT", "BLOCKED"].includes(employee.status),
  );

  const recentRootTasks = taskRows.filter((task) => !task.parent_task_id).slice(0, 8);

  const briefing = (() => {
    if (attentionCount > 0) {
      return `현재 대표 확인이 필요한 항목은 ${attentionCount}건입니다. 승인 ${pendingApprovals}건${pausedJobs.length ? `, 판단 필요 ${pausedJobs.length}건` : ""}${failedJobs.length ? `, 오류 ${failedJobs.length}건` : ""}이 있습니다.`;
    }

    if (runningJobs.length > 0) {
      return `대표 확인 대기 없이 자동 업무 ${runningJobs.length}건이 진행 중입니다. 완료된 결과만 승인함으로 올리겠습니다.`;
    }

    return "현재 대표가 바로 처리해야 할 항목은 없습니다. 새로운 업무 지시를 기다리고 있습니다.";
  })();

  return (
    <OfficeShell pendingApprovals={pendingApprovals}>
      <PageHeader
        eyebrow="대표실"
        title="오늘의 SAWOL OFFICE"
        description="회사가 지금 무엇을 하고 있는지, 대표가 무엇만 확인하면 되는지 한 화면에서 봅니다."
        action={
          <Link
            href="/command"
            className="flex h-10 items-center justify-center whitespace-nowrap rounded-[10px] bg-[#3157D5] px-4 text-[11px] font-semibold text-white"
          >
            새 업무 지시
          </Link>
        }
      />

      <section className="mt-6 grid grid-cols-2 gap-3 lg:mt-7 lg:grid-cols-6">
        <StatCard
          label="진행 중"
          value={n(summary.active_tasks)}
          note="직원 · AUTO 작업 포함"
          href="/queue"
          tone="blue"
        />
        <StatCard
          label="승인 대기"
          value={pendingApprovals}
          note="대표 최종 확인 필요"
          href="/approvals"
          tone={pendingApprovals ? "warning" : "default"}
        />
        <StatCard
          label="재작업"
          value={reworkJobs.length}
          note="반려 사유 반영 중"
          href="/queue"
          tone={reworkJobs.length ? "warning" : "default"}
        />
        <StatCard
          label="판단 필요"
          value={pausedJobs.length}
          note="자동 처리 일시 정지"
          href="/queue"
          tone={pausedJobs.length ? "warning" : "default"}
        />
        <StatCard
          label="오류"
          value={Math.max(n(summary.error_tasks), failedJobs.length)}
          note="복구 또는 확인 필요"
          href="/queue"
          tone={Math.max(n(summary.error_tasks), failedJobs.length) ? "danger" : "default"}
        />
        <StatCard
          label="오늘 완료"
          value={n(summary.completed_today)}
          note="완료된 대표 업무"
          href="/results"
        />
      </section>

      <section className="mt-4 rounded-[20px] border border-[#DCE4FF] bg-[#F8FAFF] p-4 sm:p-5 lg:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#3157D5] text-[12px] font-bold text-white">
                윤
              </div>
              <div>
                <p className="text-[13px] font-semibold text-[#17181C]">윤서진 비서실장</p>
                <p className="mt-0.5 text-[10px] text-[#818895]">대표 브리핑</p>
              </div>
            </div>
            <p className="mt-4 max-w-[850px] break-keep text-[12px] leading-6 text-[#4F5867] sm:text-[13px] sm:leading-7">
              {briefing}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {pendingApprovals > 0 ? (
              <Link
                href="/approvals"
                className="flex h-9 items-center justify-center rounded-[9px] bg-[#3157D5] px-3.5 text-[10px] font-semibold text-white"
              >
                승인 {pendingApprovals}건 확인
              </Link>
            ) : null}
            <Link
              href="/queue"
              className="flex h-9 items-center justify-center rounded-[9px] border border-[#D9E1F8] bg-white px-3.5 text-[10px] font-semibold text-[#596579]"
            >
              실행 현황 보기
            </Link>
          </div>
        </div>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[1.35fr_0.85fr]">
        <section className="rounded-[20px] border border-[#E7E9EE] bg-white p-4 sm:p-5 lg:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-[14px] font-semibold">지금 AI 회사에서 일어나는 일</h2>
              <p className="mt-1 text-[10px] text-[#9298A2]">AUTO Worker 기준 실시간 진행 상태</p>
            </div>
            <Link href="/queue" className="text-[10px] font-medium text-[#3157D5]">
              전체 보기 →
            </Link>
          </div>

          <div className="mt-4 space-y-2.5">
            {!jobRows.length ? (
              <EmptyMini text="현재 실행 중이거나 대표 확인을 기다리는 AUTO 업무가 없습니다." />
            ) : (
              jobRows.slice(0, 7).map((job) => {
                const task = taskById.get(job.task_id);
                const metadata = safeMeta(job.metadata);
                const rejection = safeMeta(metadata.rejection);
                const isRework = Boolean(Object.keys(rejection).length || feedbackByTask.has(job.task_id));
                const progress = Math.max(0, Math.min(100, n(job.progress)));
                const isProblem = ["PAUSED", "FAILED"].includes(job.status);

                return (
                  <Link
                    key={job.id}
                    href={task ? `/tasks/${task.id}` : "/queue"}
                    className="block rounded-[15px] border border-[#ECEEF2] p-3.5 transition hover:border-[#DCE4FF] hover:bg-[#FBFCFF]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`rounded-full px-2 py-1 text-[8px] font-semibold ${
                              isProblem
                                ? "bg-[#FFF0F0] text-[#B34A4A]"
                                : job.status === "AWAITING_APPROVAL"
                                  ? "bg-[#FFF5DD] text-[#8A6824]"
                                  : "bg-[#EEF2FF] text-[#3157D5]"
                            }`}
                          >
                            {jobStatusLabel[job.status] ?? job.status}
                          </span>
                          {isRework ? (
                            <span className="rounded-full bg-[#FFF7E8] px-2 py-1 text-[8px] font-semibold text-[#997024]">
                              반려 재작업
                            </span>
                          ) : null}
                          {task?.execution_mode === "AUTO" ? (
                            <span className="text-[8px] text-[#9BA0A9]">AUTO</span>
                          ) : null}
                        </div>

                        <p className="mt-2 truncate text-[11px] font-semibold text-[#252831]">
                          {task?.title ?? "업무 정보 불러오는 중"}
                        </p>
                        <p className="mt-1 truncate text-[9px] text-[#8C929D]">
                          {task?.employees?.name
                            ? `${task.employees.name} · `
                            : ""}
                          {job.current_step_title || job.last_message || "다음 실행 단계 준비"}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-[11px] font-bold text-[#545C69]">{progress}%</p>
                        <p className="mt-1 text-[8px] text-[#A2A7B0]">{formatTime(job.updated_at)}</p>
                      </div>
                    </div>

                    {!isProblem ? (
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#EFF1F4]">
                        <div
                          className="h-full rounded-full bg-[#3157D5]"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    ) : job.last_error ? (
                      <p className="mt-2 line-clamp-2 text-[9px] leading-4 text-[#B34A4A]">
                        {truncate(job.last_error, 150)}
                      </p>
                    ) : null}
                  </Link>
                );
              })
            )}
          </div>
        </section>

        <section className="rounded-[20px] border border-[#E7E9EE] bg-white p-4 sm:p-5 lg:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-[14px] font-semibold">대표가 봐야 할 것</h2>
              <p className="mt-1 text-[10px] text-[#9298A2]">판단이 필요한 항목만 모았습니다.</p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${
                attentionCount
                  ? "bg-[#FFF5DD] text-[#8A6824]"
                  : "bg-[#EEF7F0] text-[#4D7A57]"
              }`}
            >
              {attentionCount ? `${attentionCount}건` : "확인 완료"}
            </span>
          </div>

          <div className="mt-4 space-y-2.5">
            {pendingApprovals > 0 ? (
              <Link
                href="/approvals"
                className="flex items-center justify-between gap-3 rounded-[14px] border border-[#F0E2C2] bg-[#FFFDF8] p-3.5"
              >
                <div>
                  <p className="text-[10px] font-semibold text-[#6F5625]">대표 승인 대기</p>
                  <p className="mt-1 text-[9px] text-[#9A855B]">최종 결과를 확인하고 승인 또는 반려해주세요.</p>
                </div>
                <span className="text-[18px] font-bold text-[#9A7020]">{pendingApprovals}</span>
              </Link>
            ) : null}

            {pausedJobs.length > 0 ? (
              <Link
                href="/queue"
                className="flex items-center justify-between gap-3 rounded-[14px] border border-[#F0E2C2] bg-[#FFFDF8] p-3.5"
              >
                <div>
                  <p className="text-[10px] font-semibold text-[#6F5625]">대표 판단 필요</p>
                  <p className="mt-1 text-[9px] text-[#9A855B]">자동 처리만으로 결정하기 어려운 업무입니다.</p>
                </div>
                <span className="text-[18px] font-bold text-[#9A7020]">{pausedJobs.length}</span>
              </Link>
            ) : null}

            {failedJobs.length > 0 ? (
              <Link
                href="/queue"
                className="flex items-center justify-between gap-3 rounded-[14px] border border-[#F0D5D5] bg-[#FFF9F9] p-3.5"
              >
                <div>
                  <p className="text-[10px] font-semibold text-[#913E3E]">자동 실행 오류</p>
                  <p className="mt-1 text-[9px] text-[#AA7070]">복구 여부를 확인해야 하는 업무입니다.</p>
                </div>
                <span className="text-[18px] font-bold text-[#B34A4A]">{failedJobs.length}</span>
              </Link>
            ) : null}

            {!attentionCount ? (
              <EmptyMini text="지금 대표가 바로 판단해야 할 항목은 없습니다." />
            ) : null}
          </div>
        </section>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <section className="rounded-[20px] border border-[#E7E9EE] bg-white p-4 sm:p-5 lg:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-[14px] font-semibold">AI 직원 현황</h2>
              <p className="mt-1 text-[10px] text-[#9298A2]">현재 실제로 일하고 있는 직원 중심</p>
            </div>
            <Link href="/employees" className="text-[10px] font-medium text-[#3157D5]">
              직원 전체 →
            </Link>
          </div>

          <div className="mt-4 space-y-2">
            {(workingEmployees.length ? workingEmployees : employeeRows.slice(0, 5)).slice(0, 6).map((employee) => {
              const currentTask = employee.current_task_id ? taskById.get(employee.current_task_id) : null;
              const active = ["WORKING", "REVIEWING", "APPROVAL_WAIT"].includes(employee.status);

              return (
                <Link
                  key={employee.id}
                  href={`/employees/${employee.id}`}
                  className="flex items-center gap-3 rounded-[13px] border border-[#EEF0F3] px-3 py-3 transition hover:bg-[#FAFBFC]"
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      active
                        ? "bg-[#EEF2FF] text-[#3157D5]"
                        : employee.status === "BLOCKED"
                          ? "bg-[#FFF0F0] text-[#B34A4A]"
                          : "bg-[#F2F3F5] text-[#7C828C]"
                    }`}
                  >
                    {employee.name.slice(0, 1)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[10px] font-semibold">{employee.name}</p>
                      <span className="text-[8px] text-[#A0A5AE]">{employeeStatusLabel[employee.status] ?? employee.status}</span>
                    </div>
                    <p className="mt-1 truncate text-[9px] text-[#8C929D]">
                      {currentTask?.title || employee.position || "대기 중"}
                    </p>
                  </div>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${active ? "bg-[#3157D5]" : employee.status === "BLOCKED" ? "bg-[#C85C5C]" : "bg-[#CDD1D7]"}`} />
                </Link>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 rounded-[14px] bg-[#F7F8FA] p-3">
            <div>
              <p className="text-[8px] text-[#989DA6]">직원</p>
              <p className="mt-1 text-[14px] font-bold">{employeeRows.length}</p>
            </div>
            <div>
              <p className="text-[8px] text-[#989DA6]">조직 · 팀</p>
              <p className="mt-1 text-[14px] font-bold">{departmentCount ?? 0}</p>
            </div>
            <div>
              <p className="text-[8px] text-[#989DA6]">활성 기억</p>
              <p className="mt-1 text-[14px] font-bold">{memoryCount ?? 0}</p>
            </div>
          </div>
        </section>

        <section className="rounded-[20px] border border-[#E7E9EE] bg-white p-4 sm:p-5 lg:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-[14px] font-semibold">최근 대표 업무</h2>
              <p className="mt-1 text-[10px] text-[#9298A2]">최근 변경된 메인 업무 기준</p>
            </div>
            <Link href="/tasks" className="text-[10px] font-medium text-[#3157D5]">
              전체 업무 →
            </Link>
          </div>

          <div className="mt-4 divide-y divide-[#EFF1F4]">
            {!recentRootTasks.length ? (
              <EmptyMini text="최근 업무가 없습니다." />
            ) : (
              recentRootTasks.map((task) => {
                const activeFeedback = feedbackByTask.get(task.id);

                return (
                  <Link
                    key={task.id}
                    href={`/tasks/${task.id}`}
                    className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-[#F2F4F7] px-2 py-1 text-[8px] font-medium text-[#6E7580]">
                          {taskStatusLabel[task.status] ?? task.status}
                        </span>
                        {activeFeedback ? (
                          <span className="rounded-full bg-[#FFF7E8] px-2 py-1 text-[8px] font-semibold text-[#997024]">재작업</span>
                        ) : null}
                        {task.execution_mode ? (
                          <span className="text-[8px] text-[#A0A5AE]">{task.execution_mode}</span>
                        ) : null}
                      </div>
                      <p className="mt-2 truncate text-[10px] font-semibold text-[#2D3038]">{task.title}</p>
                      <p className="mt-1 truncate text-[8px] text-[#969CA6]">
                        {task.employees?.name ? `${task.employees.name} · ` : ""}
                        {task.task_code}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[8px] text-[#A1A6AF]">{formatTime(task.updated_at)}</p>
                      <span className="mt-2 inline-block text-[9px] text-[#3157D5]">보기 →</span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </section>
      </div>
    </OfficeShell>
  );
}
