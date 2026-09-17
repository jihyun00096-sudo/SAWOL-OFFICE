import Link from "next/link";

type RootTask = {
  id: string;
  task_code: string;
  title: string;
  status: string;
  priority: string;
  execution_mode: string | null;
  assigned_employee_id: string | null;
  project_id: string | null;
  created_at: string;
  updated_at: string;
};

type WorkflowTask = {
  id: string;
  parent_task_id: string | null;
  workflow_step_no: number | null;
  workflow_step_key: string | null;
  title: string;
  status: string;
  assigned_employee_id: string | null;
  updated_at: string;
};

type JobRow = {
  task_id: string;
  status: string;
  progress: number | null;
  current_step_title: string | null;
  last_message: string | null;
  last_error: string | null;
  updated_at: string;
};

type HandoffRow = {
  id: string;
  from_task_id: string;
  to_task_id: string;
  title: string;
  summary: string | null;
  status: string;
  created_at: string;
};

type FeedbackRow = {
  root_task_id: string;
  reason: string;
  status: string;
  created_at: string;
};

type ApprovalRow = {
  id: string;
  task_id: string | null;
  title: string;
  status: string;
  requested_at: string;
};

type EmployeeRow = {
  id: string;
  name: string;
  employee_code: string;
  position: string | null;
  department_id: string | null;
};

type DepartmentRow = {
  id: string;
  name: string;
};

type SecretaryStage = {
  key: "INTAKE" | "ASSIGN" | "COLLAB" | "GATHER" | "REPORT" | "DONE" | "ISSUE";
  label: string;
  index: number;
  note: string;
};

const ACTIVE_STATUSES = new Set([
  "WAITING",
  "WAITING_FOR_DATA",
  "IN_PROGRESS",
  "COLLABORATING",
  "IN_REVIEW",
  "REVIEW",
  "PENDING_APPROVAL",
  "APPROVAL_WAIT",
  "REVISION_REQUESTED",
  "ON_HOLD",
  "ERROR",
]);

const DONE_STATUSES = new Set(["COMPLETED"]);
const CHILD_DONE = new Set(["COMPLETED", "CANCELLED"]);

const stageRail = ["접수", "배정", "협업", "취합", "대표 보고"];

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

function statusLabel(value: string) {
  const map: Record<string, string> = {
    WAITING: "대기",
    WAITING_FOR_DATA: "자료 대기",
    IN_PROGRESS: "진행 중",
    COLLABORATING: "협업 중",
    IN_REVIEW: "검수 중",
    REVIEW: "검수 중",
    PENDING_APPROVAL: "승인 대기",
    APPROVAL_WAIT: "승인 대기",
    REVISION_REQUESTED: "재작업",
    COMPLETED: "완료",
    ON_HOLD: "보류",
    ERROR: "오류",
    CANCELLED: "취소",
  };
  return map[value] ?? value;
}

function toneForStage(stage: SecretaryStage["key"]) {
  if (stage === "ISSUE") return "border-[#F0D4D4] bg-[#FFF8F8] text-[#A64D4D]";
  if (stage === "REPORT") return "border-[#E9DDB8] bg-[#FFFBEE] text-[#8B6A21]";
  if (stage === "DONE") return "border-[#D5EADF] bg-[#F5FBF7] text-[#2E7C54]";
  return "border-[#D8E4EF] bg-[#F7FAFD] text-[#4B718F]";
}

function deriveStage({
  task,
  children,
  job,
  activeFeedback,
  pendingApproval,
}: {
  task: RootTask;
  children: WorkflowTask[];
  job?: JobRow;
  activeFeedback?: FeedbackRow;
  pendingApproval?: ApprovalRow;
}): SecretaryStage {
  if (
    task.status === "ERROR" ||
    task.status === "ON_HOLD" ||
    job?.status === "FAILED" ||
    job?.status === "PAUSED"
  ) {
    return {
      key: "ISSUE",
      label: "문제 확인",
      index: 2,
      note: job?.last_error || job?.last_message || "비서실 확인이 필요한 예외가 있습니다.",
    };
  }

  if (activeFeedback || task.status === "REVISION_REQUESTED") {
    return {
      key: "COLLAB",
      label: "재작업 관리",
      index: 2,
      note: activeFeedback?.reason || "대표 반려 사유를 반영해 재작업 중입니다.",
    };
  }

  if (
    pendingApproval ||
    task.status === "PENDING_APPROVAL" ||
    task.status === "APPROVAL_WAIT" ||
    job?.status === "AWAITING_APPROVAL"
  ) {
    return {
      key: "REPORT",
      label: "대표 보고 대기",
      index: 4,
      note: "비서실 취합이 끝났으며 대표 확인을 기다립니다.",
    };
  }

  if (DONE_STATUSES.has(task.status) || job?.status === "COMPLETED") {
    return {
      key: "DONE",
      label: "보고 완료",
      index: 4,
      note: "최종 보고 흐름이 완료되었습니다.",
    };
  }

  if (!children.length) {
    if (job?.status === "RUNNING") {
      return {
        key: "COLLAB",
        label: "단독 업무 관리",
        index: 2,
        note: job.current_step_title || job.last_message || "담당 직원이 업무를 수행 중입니다.",
      };
    }

    return {
      key: "INTAKE",
      label: "접수·분석",
      index: 0,
      note: "대표 지시를 접수하고 담당자·실행 방식을 정리 중입니다.",
    };
  }

  const completed = children.filter((child) => CHILD_DONE.has(child.status)).length;
  const active = children.filter((child) => !CHILD_DONE.has(child.status));

  if (completed === children.length) {
    return {
      key: "GATHER",
      label: "결과 취합·검수",
      index: 3,
      note: "직원별 결과를 비서실에서 하나의 대표 보고로 정리 중입니다.",
    };
  }

  if (active.length) {
    return {
      key: "COLLAB",
      label: "협업 관리",
      index: 2,
      note: `${completed}/${children.length} 단계 완료 · 다음 인수인계를 관리 중입니다.`,
    };
  }

  return {
    key: "ASSIGN",
    label: "배정 준비",
    index: 1,
    note: "업무 구조와 담당 직원을 배정 중입니다.",
  };
}

function StatCard({ label, value, note, tone = "default" }: { label: string; value: number; note: string; tone?: "default" | "blue" | "warning" | "danger" }) {
  const styles = {
    default: "border-[#E5E8EC] bg-white",
    blue: "border-[#D8E4EF] bg-[#F8FBFE]",
    warning: "border-[#EDE1BE] bg-[#FFFCF3]",
    danger: "border-[#F0D7D7] bg-[#FFF9F9]",
  }[tone];

  return (
    <div className={`rounded-[18px] border p-4 ${styles}`}>
      <p className="text-[10px] font-medium text-[#7D8790]">{label}</p>
      <p className="mt-2 text-[26px] font-black tracking-[-0.04em] text-[#273540]">{value}</p>
      <p className="mt-1 text-[9px] leading-4 text-[#9AA2AA]">{note}</p>
    </div>
  );
}

export function SecretaryControlCenter({
  rootTasks,
  workflowTasks,
  jobs,
  handoffs,
  feedback,
  approvals,
  employees,
  departments,
}: {
  rootTasks: RootTask[];
  workflowTasks: WorkflowTask[];
  jobs: JobRow[];
  handoffs: HandoffRow[];
  feedback: FeedbackRow[];
  approvals: ApprovalRow[];
  employees: EmployeeRow[];
  departments: DepartmentRow[];
}) {
  const employeeMap = new Map(employees.map((row) => [row.id, row]));
  const departmentMap = new Map(departments.map((row) => [row.id, row.name]));
  const jobMap = new Map<string, JobRow>();
  jobs.forEach((row) => {
    if (!jobMap.has(row.task_id)) jobMap.set(row.task_id, row);
  });

  const childMap = new Map<string, WorkflowTask[]>();
  workflowTasks.forEach((row) => {
    if (!row.parent_task_id) return;
    const current = childMap.get(row.parent_task_id) ?? [];
    current.push(row);
    childMap.set(row.parent_task_id, current);
  });

  const feedbackMap = new Map<string, FeedbackRow>();
  feedback.forEach((row) => {
    if (!feedbackMap.has(row.root_task_id)) feedbackMap.set(row.root_task_id, row);
  });

  const approvalMap = new Map<string, ApprovalRow>();
  approvals.forEach((row) => {
    if (row.task_id && row.status === "PENDING" && !approvalMap.has(row.task_id)) {
      approvalMap.set(row.task_id, row);
    }
  });

  const taskByChildId = new Map(workflowTasks.map((row) => [row.id, row]));

  const activeRoots = rootTasks
    .filter((task) => ACTIVE_STATUSES.has(task.status) || jobMap.has(task.id))
    .slice(0, 18);

  const completedToday = rootTasks.filter((task) => DONE_STATUSES.has(task.status)).slice(0, 12);
  const pendingReports = activeRoots.filter((task) => {
    const stage = deriveStage({
      task,
      children: childMap.get(task.id) ?? [],
      job: jobMap.get(task.id),
      activeFeedback: feedbackMap.get(task.id),
      pendingApproval: approvalMap.get(task.id),
    });
    return stage.key === "REPORT";
  }).length;
  const issues = activeRoots.filter((task) => {
    const stage = deriveStage({
      task,
      children: childMap.get(task.id) ?? [],
      job: jobMap.get(task.id),
      activeFeedback: feedbackMap.get(task.id),
      pendingApproval: approvalMap.get(task.id),
    });
    return stage.key === "ISSUE" || Boolean(feedbackMap.get(task.id));
  }).length;
  const collaborating = activeRoots.filter((task) => (childMap.get(task.id) ?? []).length > 1).length;

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[22px] border border-[#DDE5EB] bg-[#F8FBFD]">
        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-[#C9DAE7] bg-white text-[13px] font-black text-[#486A84]">윤</div>
              <div>
                <p className="text-[14px] font-bold text-[#273844]">윤서진 비서실장 · 중앙 관제</p>
                <p className="mt-1 text-[9px] text-[#80909D]">대표 지시 접수 → 직원 배정 → 협업 인수인계 → 결과 취합 → 대표 보고</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {stageRail.map((label, index) => (
                <div key={label} className="flex items-center gap-2">
                  <div className="rounded-full border border-[#D4E1EB] bg-white px-3 py-1.5 text-[8px] font-semibold text-[#56748B]">
                    {index + 1}. {label}
                  </div>
                  {index < stageRail.length - 1 ? <span className="text-[9px] text-[#A7B6C1]">→</span> : null}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Link href="/command" className="rounded-[14px] border border-[#D3DEE6] bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-sm">
              <p className="text-[9px] font-semibold text-[#466A85]">대표 업무 지시</p>
              <p className="mt-1 text-[8px] leading-4 text-[#96A1A9]">새 업무를 비서실에 접수합니다.</p>
            </Link>
            <Link href="/approvals" className="rounded-[14px] border border-[#E5D9B7] bg-[#FFFCF4] p-4 transition hover:-translate-y-0.5 hover:shadow-sm">
              <p className="text-[9px] font-semibold text-[#8B6A21]">대표 보고함</p>
              <p className="mt-1 text-[8px] leading-4 text-[#A49A7D]">취합이 끝난 결과만 확인합니다.</p>
            </Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="비서실 관리 중" value={activeRoots.length} note="현재 대표 지시 기준 활성 업무" tone="blue" />
        <StatCard label="협업 업무" value={collaborating} note="2명 이상 직원이 이어서 처리" />
        <StatCard label="대표 보고 대기" value={pendingReports} note="대표가 확인하면 되는 최종 결과" tone="warning" />
        <StatCard label="비서실 확인 필요" value={issues} note="오류·보류·재작업 포함" tone={issues ? "danger" : "default"} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="rounded-[20px] border border-[#E3E7EB] bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[12px] font-bold text-[#34424D]">비서실 업무대장</p>
              <p className="mt-1 text-[9px] text-[#929CA4]">대표가 직접 직원별 진행을 관리하지 않아도 비서실 단계로 요약합니다.</p>
            </div>
            <Link href="/tasks" className="text-[9px] font-semibold text-[#557994]">전체 업무 →</Link>
          </div>

          <div className="mt-4 space-y-3">
            {activeRoots.length ? activeRoots.map((task) => {
              const children = childMap.get(task.id) ?? [];
              const stage = deriveStage({
                task,
                children,
                job: jobMap.get(task.id),
                activeFeedback: feedbackMap.get(task.id),
                pendingApproval: approvalMap.get(task.id),
              });
              const participantIds = new Set<string>();
              if (task.assigned_employee_id) participantIds.add(task.assigned_employee_id);
              children.forEach((child) => child.assigned_employee_id && participantIds.add(child.assigned_employee_id));
              const participants = [...participantIds].map((id) => employeeMap.get(id)).filter(Boolean) as EmployeeRow[];
              const doneCount = children.filter((child) => CHILD_DONE.has(child.status)).length;
              const job = jobMap.get(task.id);

              return (
                <Link key={task.id} href={`/tasks/${task.id}`} className="block rounded-[16px] border border-[#E6EAED] bg-[#FCFDFE] p-4 transition hover:border-[#CCDCE7] hover:bg-white hover:shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2 py-1 text-[7px] font-bold ${toneForStage(stage.key)}`}>{stage.label}</span>
                        <span className="text-[8px] text-[#9AA3AB]">{task.task_code}</span>
                        <span className="text-[8px] text-[#A0A8AF]">{task.execution_mode === "AUTO" ? "AUTO" : "MANUAL"}</span>
                      </div>
                      <p className="mt-2 truncate text-[11px] font-bold text-[#36454F]">{task.title}</p>
                      <p className="mt-1 line-clamp-2 text-[8px] leading-4 text-[#87949E]">{stage.note}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[8px] font-semibold text-[#5E7485]">{statusLabel(task.status)}</p>
                      <p className="mt-1 text-[7px] text-[#A0A8AF]">{formatTime(task.updated_at)}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-5 gap-1.5">
                    {stageRail.map((label, index) => (
                      <div key={label}>
                        <div className={`h-1.5 rounded-full ${index <= stage.index ? (stage.key === "ISSUE" ? "bg-[#D78787]" : "bg-[#6D98B8]") : "bg-[#E8EDF1]"}`} />
                        <p className={`mt-1 text-center text-[6px] ${index === stage.index ? "font-bold text-[#4E718B]" : "text-[#A0A9B0]"}`}>{label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#EEF1F3] pt-3">
                    <span className="rounded-full bg-[#F0F5F8] px-2 py-1 text-[7px] text-[#678093]">
                      협업 {children.length ? `${doneCount}/${children.length}` : "단독"}
                    </span>
                    {typeof job?.progress === "number" ? (
                      <span className="rounded-full bg-[#F4F5F7] px-2 py-1 text-[7px] text-[#77828B]">자동진행 {job.progress}%</span>
                    ) : null}
                    {participants.slice(0, 5).map((employee) => (
                      <span key={employee.id} className="rounded-full border border-[#E1E6EA] bg-white px-2 py-1 text-[7px] text-[#697782]">
                        {employee.name}
                      </span>
                    ))}
                    {participants.length > 5 ? <span className="text-[7px] text-[#9AA3AA]">+{participants.length - 5}</span> : null}
                  </div>
                </Link>
              );
            }) : (
              <div className="rounded-[14px] border border-dashed border-[#DFE4E8] bg-[#FAFBFC] px-4 py-10 text-center text-[10px] text-[#929BA3]">현재 비서실이 관리 중인 활성 업무가 없습니다.</div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[20px] border border-[#E3E7EB] bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold text-[#3D4A54]">최근 인수인계</p>
              <span className="text-[8px] text-[#9DA5AC]">직원 → 직원</span>
            </div>
            <div className="mt-3 space-y-2.5">
              {handoffs.slice(0, 8).map((handoff) => {
                const fromTask = taskByChildId.get(handoff.from_task_id);
                const toTask = taskByChildId.get(handoff.to_task_id);
                const fromEmployee = fromTask?.assigned_employee_id ? employeeMap.get(fromTask.assigned_employee_id) : undefined;
                const toEmployee = toTask?.assigned_employee_id ? employeeMap.get(toTask.assigned_employee_id) : undefined;
                return (
                  <div key={handoff.id} className="rounded-[12px] bg-[#F7F9FA] p-3">
                    <div className="flex items-center gap-2 text-[8px] font-semibold text-[#59758A]">
                      <span>{fromEmployee?.name ?? "비서실"}</span><span className="text-[#A4B1BA]">→</span><span>{toEmployee?.name ?? "비서실"}</span>
                    </div>
                    <p className="mt-1 truncate text-[8px] text-[#7E8992]">{handoff.title}</p>
                    <p className="mt-1 text-[7px] text-[#A1A8AE]">{formatTime(handoff.created_at)}</p>
                  </div>
                );
              })}
              {!handoffs.length ? <p className="py-6 text-center text-[9px] text-[#A0A8AF]">아직 인수인계 기록이 없습니다.</p> : null}
            </div>
          </div>

          <div className="rounded-[20px] border border-[#E6DEC5] bg-[#FFFDF7] p-4">
            <p className="text-[11px] font-bold text-[#746033]">대표에게 올라가는 기준</p>
            <div className="mt-3 space-y-2 text-[8px] leading-4 text-[#8B7C59]">
              <p>• 최종 결과가 준비되어 승인만 필요한 업무</p>
              <p>• 비서실이 자체 해결하지 못한 오류·보류</p>
              <p>• 대표 반려 후 재작업 결과가 다시 준비된 업무</p>
            </div>
            <p className="mt-3 rounded-[10px] bg-white/80 px-3 py-2 text-[8px] leading-4 text-[#8D8065]">직원들의 일반적인 중간 진행은 대표에게 일일이 올리지 않고 비서실에서 관리합니다.</p>
          </div>

          {completedToday.length ? (
            <div className="rounded-[20px] border border-[#DCEAE3] bg-[#F8FCFA] p-4">
              <p className="text-[11px] font-bold text-[#3C6652]">최근 보고 완료</p>
              <div className="mt-3 space-y-2">
                {completedToday.slice(0, 5).map((task) => (
                  <Link key={task.id} href={`/tasks/${task.id}`} className="block rounded-[10px] bg-white px-3 py-2.5">
                    <p className="truncate text-[8px] font-semibold text-[#4D6659]">{task.title}</p>
                    <p className="mt-1 text-[7px] text-[#92A29A]">{formatTime(task.updated_at)}</p>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
