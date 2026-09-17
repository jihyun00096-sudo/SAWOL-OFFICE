import Link from "next/link";
import { LiveOfficeRefresh } from "@/components/sawol/live-office-refresh";
import { OfficeShell } from "@/components/sawol/office-shell";
import { PageHeader } from "@/components/sawol/page-header";
import { requireSawolAdmin } from "@/lib/auth/require-sawol-admin";

export const dynamic = "force-dynamic";

type Department = {
  id: string;
  code: string | null;
  name: string;
  department_type: string;
  sort_order: number | null;
};

type Employee = {
  id: string;
  employee_code: string;
  name: string;
  position: string | null;
  status: string;
  specialty: string | null;
  department_id: string | null;
  current_task_id: string | null;
};

type Task = {
  id: string;
  parent_task_id: string | null;
  workflow_id: string | null;
  workflow_step_no: number | null;
  workflow_step_key: string | null;
  task_code: string;
  title: string;
  status: string;
  execution_mode: string | null;
  assigned_employee_id: string | null;
  assigned_department_id: string | null;
  updated_at: string;
};

type Job = {
  id: string;
  task_id: string;
  status: string;
  progress: number | null;
  current_step_title: string | null;
  last_message: string | null;
  updated_at: string;
};

type Handoff = {
  id: string;
  from_task_id: string;
  to_task_id: string;
  title: string;
  summary: string | null;
  status: string;
  created_at: string;
};

const taskStatusLabel: Record<string, string> = {
  WAITING: "대기",
  WAITING_FOR_DATA: "자료 대기",
  IN_PROGRESS: "작업 중",
  COLLABORATING: "협업 중",
  IN_REVIEW: "검수 중",
  REVIEW: "검수 중",
  PENDING_APPROVAL: "대표 승인 대기",
  APPROVAL_WAIT: "대표 승인 대기",
  REVISION_REQUESTED: "재작업",
  COMPLETED: "완료",
  ON_HOLD: "보류",
  CANCELLED: "취소",
  ERROR: "오류",
};

const employeeStatusLabel: Record<string, string> = {
  AVAILABLE: "대기",
  WORKING: "작업 중",
  WAITING: "대기",
  REVIEWING: "검수 중",
  APPROVAL_WAIT: "대표 승인 대기",
  BLOCKED: "문제 확인",
  OFFLINE: "오프라인",
};

function short(value: string | null | undefined, max = 46) {
  const text = value?.trim() ?? "";
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function Character({
  employee,
  state,
  active = false,
}: {
  employee?: Employee | null;
  state: string;
  active?: boolean;
}) {
  const initials = employee?.name?.slice(-2) || "AI";
  const working = active || ["WORKING", "REVIEWING", "APPROVAL_WAIT"].includes(employee?.status ?? "");

  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      <div className="relative h-12 w-12">
        {working ? (
          <span className="absolute inset-0 animate-ping rounded-full bg-[#3157D5]/10" />
        ) : null}
        <div className="absolute left-1/2 top-0 h-7 w-7 -translate-x-1/2 rounded-full border-2 border-white bg-[#DCE5FF] shadow-sm" />
        <div className="absolute bottom-0 left-1/2 h-7 w-10 -translate-x-1/2 rounded-t-[13px] rounded-b-[8px] border-2 border-white bg-[#3157D5] shadow-sm" />
        <div className="absolute inset-x-0 top-[8px] text-[8px] font-bold text-[#263D83]">{initials}</div>
        <span
          className={`absolute right-0 top-0 h-3 w-3 rounded-full border-2 border-white ${
            working ? "bg-[#31A36B]" : employee?.status === "BLOCKED" ? "bg-[#C45151]" : "bg-[#BCC2CC]"
          }`}
        />
      </div>
      <p className="mt-1 max-w-[92px] truncate text-[9px] font-semibold text-[#414751]">
        {employee?.name || "배정 대기"}
      </p>
      <p className="mt-0.5 max-w-[100px] truncate text-[7px] text-[#9399A3]">{state}</p>
    </div>
  );
}

function FlowArrow({ done = false }: { done?: boolean }) {
  return (
    <div className="flex min-w-[34px] items-center justify-center px-1">
      <div className={`h-px flex-1 ${done ? "bg-[#7BB58F]" : "bg-[#D8DCE3]"}`} />
      <span className={`ml-[-1px] text-[12px] ${done ? "text-[#55A473]" : "text-[#B7BDC7]"}`}>→</span>
    </div>
  );
}

function Zone({
  title,
  subtitle,
  children,
  accent = false,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <section
      className={`rounded-[20px] border p-4 ${
        accent ? "border-[#CAD6FA] bg-[#F8FAFF]" : "border-[#E5E8ED] bg-white"
      }`}
    >
      <div className="mb-3">
        <p className="text-[11px] font-semibold text-[#393F49]">{title}</p>
        <p className="mt-1 text-[8px] text-[#9AA0AA]">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

export default async function LiveOfficePage() {
  const { supabase } = await requireSawolAdmin();

  const [
    { data: departments },
    { data: employees },
    { data: tasks },
    { data: jobs },
    { data: handoffs },
    { count: pendingApprovals },
  ] = await Promise.all([
    supabase
      .from("departments")
      .select("id,code,name,department_type,sort_order")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("employees")
      .select("id,employee_code,name,position,status,specialty,department_id,current_task_id")
      .eq("is_active", true)
      .order("employee_code"),
    supabase
      .from("tasks")
      .select("id,parent_task_id,workflow_id,workflow_step_no,workflow_step_key,task_code,title,status,execution_mode,assigned_employee_id,assigned_department_id,updated_at")
      .order("updated_at", { ascending: false })
      .limit(220),
    supabase
      .from("task_autopilot_jobs")
      .select("id,task_id,status,progress,current_step_title,last_message,updated_at")
      .in("status", ["QUEUED", "RUNNING", "AWAITING_APPROVAL", "PAUSED", "FAILED"])
      .order("updated_at", { ascending: false })
      .limit(40),
    supabase
      .from("task_handoffs")
      .select("id,from_task_id,to_task_id,title,summary,status,created_at")
      .eq("status", "AVAILABLE")
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING_APPROVAL"),
  ]);

  const departmentRows = (departments ?? []) as Department[];
  const employeeRows = (employees ?? []) as Employee[];
  const taskRows = (tasks ?? []) as Task[];
  const jobRows = (jobs ?? []) as Job[];
  const handoffRows = (handoffs ?? []) as Handoff[];

  const employeesById = new Map(employeeRows.map((employee) => [employee.id, employee]));
  const departmentsById = new Map(departmentRows.map((department) => [department.id, department]));
  const tasksById = new Map(taskRows.map((task) => [task.id, task]));
  const jobsByTaskId = new Map(jobRows.map((job) => [job.task_id, job]));

  const rootTasks = taskRows.filter((task) => !task.parent_task_id);
  const childTasks = taskRows.filter((task) => Boolean(task.parent_task_id));

  const workflowGroups = rootTasks
    .map((root) => {
      const children = childTasks
        .filter((task) => task.parent_task_id === root.id)
        .sort((a, b) => (a.workflow_step_no ?? 999) - (b.workflow_step_no ?? 999));
      const job = jobsByTaskId.get(root.id) ?? null;
      return { root, children, job };
    })
    .filter(({ root, children, job }) => {
      const activeRoot = !["COMPLETED", "CANCELLED"].includes(root.status);
      return activeRoot || children.some((task) => !["COMPLETED", "CANCELLED"].includes(task.status)) || Boolean(job);
    })
    .slice(0, 8);

  const activeEmployeeIds = new Set(
    childTasks
      .filter((task) => !["COMPLETED", "CANCELLED"].includes(task.status))
      .map((task) => task.assigned_employee_id)
      .filter(Boolean) as string[],
  );

  const activeByDepartment = new Map<string, Employee[]>();
  employeeRows.forEach((employee) => {
    if (!employee.department_id) return;
    const list = activeByDepartment.get(employee.department_id) ?? [];
    if (activeEmployeeIds.has(employee.id) || ["WORKING", "REVIEWING", "APPROVAL_WAIT", "BLOCKED"].includes(employee.status)) {
      list.push(employee);
      activeByDepartment.set(employee.department_id, list);
    }
  });

  const visibleDepartments = departmentRows
    .map((department) => ({
      department,
      activeEmployees: activeByDepartment.get(department.id) ?? [],
    }))
    .filter(({ activeEmployees }) => activeEmployees.length > 0)
    .slice(0, 8);

  const secretary = employeeRows.find((employee) => employee.employee_code === "EXEC-001") ?? null;

  const waitingForCeo = workflowGroups.filter(({ root, job }) =>
    ["PENDING_APPROVAL", "APPROVAL_WAIT"].includes(root.status) || job?.status === "AWAITING_APPROVAL",
  );

  const latestHandoffs = handoffRows.slice(0, 10).map((handoff) => {
    const fromTask = tasksById.get(handoff.from_task_id);
    const toTask = tasksById.get(handoff.to_task_id);
    const fromEmployee = fromTask?.assigned_employee_id ? employeesById.get(fromTask.assigned_employee_id) : null;
    const toEmployee = toTask?.assigned_employee_id ? employeesById.get(toTask.assigned_employee_id) : null;
    return { handoff, fromTask, toTask, fromEmployee, toEmployee };
  });

  return (
    <OfficeShell pendingApprovals={pendingApprovals ?? 0}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          eyebrow="LIVE OFFICE"
          title="SAWOL LIVE OFFICE"
          description="대표 지시가 직원들에게 전달되고, 협업·인수인계·비서실 취합을 거쳐 대표실로 돌아오는 흐름을 실시간으로 확인합니다."
        />
        <LiveOfficeRefresh seconds={10} />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[16px] border border-[#E6E9EE] bg-white p-4">
          <p className="text-[9px] text-[#9298A2]">진행 중 workflow</p>
          <p className="mt-2 text-[24px] font-bold">{workflowGroups.length}</p>
        </div>
        <div className="rounded-[16px] border border-[#E6E9EE] bg-white p-4">
          <p className="text-[9px] text-[#9298A2]">현재 활동 직원</p>
          <p className="mt-2 text-[24px] font-bold">{activeEmployeeIds.size}</p>
        </div>
        <div className="rounded-[16px] border border-[#E6E9EE] bg-white p-4">
          <p className="text-[9px] text-[#9298A2]">최근 인수인계</p>
          <p className="mt-2 text-[24px] font-bold">{latestHandoffs.length}</p>
        </div>
        <div className="rounded-[16px] border border-[#DCE4FF] bg-[#F8FAFF] p-4">
          <p className="text-[9px] text-[#3157D5]">대표 승인 대기</p>
          <p className="mt-2 text-[24px] font-bold text-[#3157D5]">{waitingForCeo.length}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="rounded-[24px] border border-[#E3E7ED] bg-[#F1F3F6] p-3 sm:p-4">
            <div className="grid gap-3 lg:grid-cols-[190px_1fr_190px]">
              <Zone title="대표실" subtitle="지시 · 승인 · 최종 판단" accent>
                <div className="rounded-[14px] border border-[#D8E1FB] bg-white px-3 py-4 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#17181C] text-[11px] font-bold text-white shadow-sm">CEO</div>
                  <p className="mt-2 text-[10px] font-semibold">대표</p>
                  <p className="mt-1 text-[8px] text-[#8E949E]">
                    {waitingForCeo.length ? `${waitingForCeo.length}건 보고 대기` : "현재 판단 대기 없음"}
                  </p>
                  <Link href="/approvals" className="mt-3 inline-flex rounded-[8px] bg-[#3157D5] px-3 py-1.5 text-[8px] font-semibold text-white">
                    승인함 열기
                  </Link>
                </div>
              </Zone>

              <Zone title="비서실" subtitle="업무 접수 · 분배 · 취합 · 대표 보고" accent>
                <div className="flex items-center gap-4 rounded-[14px] border border-[#D8E1FB] bg-white px-4 py-4">
                  <Character employee={secretary} state={waitingForCeo.length ? "최종 보고 정리 중" : "업무 흐름 관리 중"} active={workflowGroups.length > 0} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold">윤서진 비서실장</p>
                    <p className="mt-1 text-[8px] leading-4 text-[#7F8691]">
                      직원별 결과를 받고 다음 담당자에게 넘기며, 최종 결과가 모이면 대표 보고본으로 취합합니다.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-[#EEF2FF] px-2 py-1 text-[7px] font-semibold text-[#3157D5]">진행 {workflowGroups.length}</span>
                      <span className="rounded-full bg-[#FFF6E5] px-2 py-1 text-[7px] font-semibold text-[#9A7020]">보고대기 {waitingForCeo.length}</span>
                    </div>
                  </div>
                </div>
              </Zone>

              <Zone title="결과 데스크" subtitle="완료 결과 · 파일 · 보고서">
                <div className="rounded-[14px] border border-[#E7E9EE] bg-[#FAFBFC] px-3 py-4 text-center">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-[13px] bg-white text-[20px] shadow-sm">📦</div>
                  <p className="mt-2 text-[9px] font-semibold">결과함</p>
                  <p className="mt-1 text-[8px] text-[#969CA6]">승인된 산출물 보관</p>
                  <Link href="/results" className="mt-3 inline-flex text-[8px] font-semibold text-[#3157D5]">결과 확인 →</Link>
                </div>
              </Zone>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {visibleDepartments.length ? (
                visibleDepartments.map(({ department, activeEmployees }) => (
                  <Zone
                    key={department.id}
                    title={department.name}
                    subtitle={`${activeEmployees.length}명 활동 중`}
                  >
                    <div className="grid grid-cols-2 gap-3">
                      {activeEmployees.slice(0, 4).map((employee) => {
                        const task = childTasks.find(
                          (row) => row.assigned_employee_id === employee.id && !["COMPLETED", "CANCELLED"].includes(row.status),
                        );
                        return (
                          <Link key={employee.id} href={task ? `/tasks/${task.id}` : `/employees/${employee.id}`} className="rounded-[12px] bg-[#F8F9FB] px-2 py-3 transition hover:bg-[#F1F4FF]">
                            <Character
                              employee={employee}
                              active={Boolean(task)}
                              state={task ? short(task.title, 22) : employeeStatusLabel[employee.status] ?? employee.status}
                            />
                          </Link>
                        );
                      })}
                    </div>
                    {activeEmployees.length > 4 ? (
                      <p className="mt-2 text-center text-[7px] text-[#A0A5AE]">+ {activeEmployees.length - 4}명 더 작업 중</p>
                    ) : null}
                  </Zone>
                ))
              ) : (
                <div className="col-span-full rounded-[20px] border border-dashed border-[#D9DDE4] bg-white px-4 py-10 text-center">
                  <p className="text-[11px] font-semibold text-[#676E79]">현재 활동 중인 부서가 없습니다.</p>
                  <p className="mt-1 text-[9px] text-[#A0A5AE]">새 AUTO 업무가 시작되면 직원들이 이 오피스에 표시됩니다.</p>
                </div>
              )}
            </div>
          </div>

          <section className="rounded-[20px] border border-[#E5E8ED] bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[13px] font-semibold">업무 전달 라인</h2>
                <p className="mt-1 text-[9px] text-[#969CA6]">각 업무가 직원 → 직원 → 비서실 → 대표실로 넘어가는 실제 흐름</p>
              </div>
              <Link href="/tasks" className="text-[9px] font-semibold text-[#3157D5]">전체 업무 →</Link>
            </div>

            <div className="mt-4 space-y-3">
              {workflowGroups.length ? (
                workflowGroups.map(({ root, children, job }) => {
                  const currentIndex = children.findIndex((task) => !["COMPLETED", "CANCELLED"].includes(task.status));
                  const approval = ["PENDING_APPROVAL", "APPROVAL_WAIT"].includes(root.status) || job?.status === "AWAITING_APPROVAL";

                  return (
                    <div key={root.id} className="rounded-[16px] border border-[#E8EAEF] bg-[#FCFCFD] p-3 sm:p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[10px] font-semibold text-[#333943]">{root.title}</p>
                          <p className="mt-1 text-[7px] text-[#A1A6AF]">{root.task_code} · {job?.progress ?? 0}%</p>
                        </div>
                        <span className={`rounded-full px-2 py-1 text-[7px] font-semibold ${approval ? "bg-[#FFF4DA] text-[#92691B]" : "bg-[#EEF2FF] text-[#3157D5]"}`}>
                          {approval ? "대표 보고 대기" : job?.current_step_title || taskStatusLabel[root.status] || root.status}
                        </span>
                      </div>

                      <div className="mt-4 overflow-x-auto pb-1">
                        <div className="flex min-w-max items-start">
                          {children.map((step, index) => {
                            const employee = step.assigned_employee_id ? employeesById.get(step.assigned_employee_id) : null;
                            const done = step.status === "COMPLETED";
                            const current = index === currentIndex && !approval;
                            return (
                              <div key={step.id} className="flex items-center">
                                <Link href={`/tasks/${step.id}`} className={`w-[128px] rounded-[13px] border px-2 py-3 ${current ? "border-[#9BB0F2] bg-[#F5F7FF]" : done ? "border-[#CDE7D6] bg-[#F7FCF8]" : "border-[#E4E7EC] bg-white"}`}>
                                  <Character employee={employee} active={current} state={current ? "지금 작업 중" : done ? "전달 완료" : "다음 차례"} />
                                  <p className="mt-2 line-clamp-2 text-center text-[8px] leading-4 text-[#656C77]">{step.title}</p>
                                </Link>
                                {index < children.length - 1 ? <FlowArrow done={done} /> : null}
                              </div>
                            );
                          })}

                          {children.length ? <FlowArrow done={children.every((step) => step.status === "COMPLETED")} /> : null}
                          <div className={`w-[130px] rounded-[13px] border px-2 py-3 ${approval ? "border-[#EBD8A7] bg-[#FFFDF6]" : "border-[#E4E7EC] bg-white"}`}>
                            <Character employee={secretary} active={approval} state={approval ? "결과 취합 완료" : "취합 대기"} />
                            <p className="mt-2 text-center text-[8px] leading-4 text-[#656C77]">비서실 최종 정리</p>
                          </div>
                          <FlowArrow done={approval} />
                          <Link href={approval ? "/approvals" : `/tasks/${root.id}`} className={`w-[112px] rounded-[13px] border px-2 py-4 text-center ${approval ? "border-[#AFC0F4] bg-[#F6F8FF]" : "border-[#E4E7EC] bg-white"}`}>
                            <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-[12px] bg-[#17181C] text-[9px] font-bold text-white">CEO</div>
                            <p className="mt-2 text-[8px] font-semibold">대표 보고</p>
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-[14px] border border-dashed border-[#E1E4E9] bg-[#FAFBFC] px-4 py-8 text-center text-[10px] text-[#969CA6]">
                  현재 진행 중인 workflow가 없습니다.
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-[20px] border border-[#E5E8ED] bg-white p-4">
            <h2 className="text-[12px] font-semibold">최근 인수인계</h2>
            <p className="mt-1 text-[8px] text-[#989EA8]">실제로 누구에게 업무가 넘어갔는지 기록</p>

            <div className="mt-3 space-y-2">
              {latestHandoffs.length ? (
                latestHandoffs.map(({ handoff, fromTask, toTask, fromEmployee, toEmployee }) => (
                  <Link key={handoff.id} href={toTask ? `/tasks/${toTask.id}` : "/tasks"} className="block rounded-[12px] bg-[#F7F8FA] px-3 py-3 transition hover:bg-[#F2F5FF]">
                    <div className="flex items-center gap-2 text-[8px]">
                      <span className="font-semibold text-[#555D68]">{fromEmployee?.name || "이전 담당"}</span>
                      <span className="text-[#AEB4BE]">→</span>
                      <span className="font-semibold text-[#3157D5]">{toEmployee?.name || "다음 담당"}</span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-[8px] leading-4 text-[#7F8691]">
                      {short(handoff.summary || handoff.title || toTask?.title, 82)}
                    </p>
                  </Link>
                ))
              ) : (
                <div className="rounded-[12px] bg-[#F8F9FB] px-3 py-5 text-center text-[9px] text-[#9AA0AA]">인수인계 기록 없음</div>
              )}
            </div>
          </section>

          <section className="rounded-[20px] border border-[#DCE4FF] bg-[#F8FAFF] p-4">
            <h2 className="text-[12px] font-semibold text-[#3157D5]">비서 → 대표 보고</h2>
            <p className="mt-1 text-[8px] text-[#7F8CB0]">모든 직원 결과가 모인 뒤 최종 보고 단계</p>
            <div className="mt-3 space-y-2">
              {waitingForCeo.length ? (
                waitingForCeo.map(({ root }) => (
                  <Link key={root.id} href="/approvals" className="block rounded-[12px] border border-[#D7E0FB] bg-white px-3 py-3">
                    <p className="truncate text-[9px] font-semibold text-[#3F4752]">{root.title}</p>
                    <p className="mt-1 text-[8px] text-[#3157D5]">윤서진 취합 완료 → 대표 승인 대기</p>
                  </Link>
                ))
              ) : (
                <p className="rounded-[12px] bg-white px-3 py-4 text-center text-[9px] text-[#8F97A5]">현재 대표 보고 대기 없음</p>
              )}
            </div>
          </section>

          <section className="rounded-[20px] border border-[#E5E8ED] bg-white p-4">
            <h2 className="text-[12px] font-semibold">오피스 범례</h2>
            <div className="mt-3 space-y-2 text-[8px] text-[#7F8691]">
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#31A36B]" /> 실제 작업 중</div>
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#BCC2CC]" /> 대기 / 다음 차례</div>
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#C45151]" /> 오류 / 문제 확인</div>
              <p className="pt-1 leading-4 text-[#A0A5AE]">이 화면은 기존 업무·직원·handoff 데이터를 읽기만 하며 실행 로직을 변경하지 않습니다.</p>
            </div>
          </section>
        </aside>
      </div>
    </OfficeShell>
  );
}
