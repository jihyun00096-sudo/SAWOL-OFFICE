"use client";

import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Building2,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Filter,
  Network,
  Search,
  Sparkles,
  Users,
  Workflow,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";

type Department = {
  id: string;
  code?: string | null;
  name: string;
  department_type?: string | null;
  sort_order?: number | null;
};

type Employee = {
  id: string;
  employee_code: string;
  name: string;
  position: string;
  status: string;
  specialty: unknown;
  current_task_id?: string | null;
  departments: { id: string; name: string; code?: string | null } | null;
};

type Task = {
  id: string;
  task_code: string;
  title: string;
  status: string;
  priority: string;
  assigned_employee_id?: string | null;
  assigned_department_id?: string | null;
  parent_task_id?: string | null;
  workflow_id?: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
};

type Assignment = {
  id: string;
  task_id: string;
  employee_id: string;
  department_id?: string | null;
  assignment_source?: string | null;
  match_score?: number | null;
  status: string;
  assigned_at?: string | null;
  released_at?: string | null;
};

type Handoff = {
  id: string;
  from_task_id: string;
  to_task_id: string;
  title: string;
  status: string;
  created_at?: string | null;
};

const ACTIVE_TASKS = new Set([
  "WAITING",
  "WAITING_FOR_DATA",
  "IN_PROGRESS",
  "COLLABORATING",
  "IN_REVIEW",
  "APPROVAL_WAIT",
  "PENDING_APPROVAL",
  "REVISION_REQUESTED",
  "ON_HOLD",
  "ERROR",
]);

const ISSUE_TASKS = new Set([
  "WAITING_FOR_DATA",
  "REVISION_REQUESTED",
  "ON_HOLD",
  "ERROR",
]);

const EMPLOYEE_STATUS: Record<string, string> = {
  AVAILABLE: "대기",
  WORKING: "작업 중",
  WAITING: "자료 대기",
  REVIEWING: "검수 중",
  APPROVAL_WAIT: "승인 대기",
  BLOCKED: "보류",
  OFFLINE: "오프라인",
};

const STATUS_TONE: Record<string, string> = {
  AVAILABLE: "border-[#DDE5EB] bg-[#F7F9FA] text-[#71808C]",
  WORKING: "border-[#BEDCF6] bg-[#EEF7FF] text-[#3579B8]",
  WAITING: "border-[#EBDCB8] bg-[#FFF8E8] text-[#947126]",
  REVIEWING: "border-[#CBE7DD] bg-[#EFFAF6] text-[#3B846B]",
  APPROVAL_WAIT: "border-[#E9D7A9] bg-[#FFF8E6] text-[#8B6B22]",
  BLOCKED: "border-[#F0CACA] bg-[#FFF1F1] text-[#B75050]",
  OFFLINE: "border-[#E4E7EA] bg-[#F5F6F7] text-[#9AA3AA]",
};

function number(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function shortDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function specialtyList(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item)).filter(Boolean).slice(0, 3)
    : [];
}

function employeeInitial(name: string) {
  return name.trim().slice(0, 1) || "AI";
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-1 text-[8px] font-semibold ${
        STATUS_TONE[status] ?? STATUS_TONE.AVAILABLE
      }`}
    >
      {EMPLOYEE_STATUS[status] ?? status}
    </span>
  );
}

function StatCard({
  label,
  value,
  note,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number;
  note: string;
  icon: typeof Users;
  tone?: "default" | "blue" | "warn" | "danger";
}) {
  const toneClass =
    tone === "blue"
      ? "border-[#D5E7F7] bg-[#F8FCFF]"
      : tone === "warn"
        ? "border-[#EBDDCA] bg-[#FFFBF2]"
        : tone === "danger"
          ? "border-[#F0D3D3] bg-[#FFF8F8]"
          : "border-[#E4E9ED] bg-white";

  return (
    <div className={`rounded-[18px] border p-4 ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-semibold text-[#8A96A0]">{label}</p>
          <p className="mt-2 text-[24px] font-black tracking-[-0.04em] text-[#33414D]">
            {number(value)}
          </p>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-[11px] border border-white/80 bg-white text-[#5D8AB0] shadow-sm">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 text-[8px] leading-4 text-[#929DA6]">{note}</p>
    </div>
  );
}

export function OrganizationControlCenter({
  employees,
  departments,
  tasks,
  assignments,
  handoffs,
}: {
  employees: Employee[];
  departments: Department[];
  tasks: Task[];
  assignments: Assignment[];
  handoffs: Handoff[];
}) {
  const [query, setQuery] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [status, setStatus] = useState("");
  const [view, setView] = useState<"organization" | "employees">("organization");

  const taskById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks],
  );
  const employeeById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees],
  );

  const activeTasks = useMemo(
    () => tasks.filter((task) => ACTIVE_TASKS.has(task.status)),
    [tasks],
  );

  const loadByEmployee = useMemo(() => {
    const map = new Map<string, number>();
    for (const task of activeTasks) {
      if (!task.assigned_employee_id) continue;
      map.set(
        task.assigned_employee_id,
        (map.get(task.assigned_employee_id) ?? 0) + 1,
      );
    }
    return map;
  }, [activeTasks]);

  const completedByEmployee = useMemo(() => {
    const map = new Map<string, number>();
    for (const task of tasks) {
      if (task.status !== "COMPLETED" || !task.assigned_employee_id) continue;
      map.set(
        task.assigned_employee_id,
        (map.get(task.assigned_employee_id) ?? 0) + 1,
      );
    }
    return map;
  }, [tasks]);

  const handoffCounts = useMemo(() => {
    const incoming = new Map<string, number>();
    const outgoing = new Map<string, number>();

    for (const handoff of handoffs) {
      const fromTask = taskById.get(handoff.from_task_id);
      const toTask = taskById.get(handoff.to_task_id);
      if (fromTask?.assigned_employee_id) {
        outgoing.set(
          fromTask.assigned_employee_id,
          (outgoing.get(fromTask.assigned_employee_id) ?? 0) + 1,
        );
      }
      if (toTask?.assigned_employee_id) {
        incoming.set(
          toTask.assigned_employee_id,
          (incoming.get(toTask.assigned_employee_id) ?? 0) + 1,
        );
      }
    }

    return { incoming, outgoing };
  }, [handoffs, taskById]);

  const issueEmployeeIds = useMemo(() => {
    const set = new Set<string>();
    for (const task of tasks) {
      if (ISSUE_TASKS.has(task.status) && task.assigned_employee_id) {
        set.add(task.assigned_employee_id);
      }
    }
    for (const employee of employees) {
      if (["BLOCKED", "WAITING"].includes(employee.status)) set.add(employee.id);
    }
    return set;
  }, [employees, tasks]);

  const departmentStats = useMemo(() => {
    return departments.map((department) => {
      const members = employees.filter(
        (employee) => employee.departments?.id === department.id,
      );
      const busy = members.filter(
        (employee) => (loadByEmployee.get(employee.id) ?? 0) > 0,
      ).length;
      const review = members.filter((employee) =>
        ["REVIEWING", "APPROVAL_WAIT"].includes(employee.status),
      ).length;
      const issues = members.filter((employee) =>
        issueEmployeeIds.has(employee.id),
      ).length;
      const taskCount = members.reduce(
        (sum, employee) => sum + (loadByEmployee.get(employee.id) ?? 0),
        0,
      );
      const utilization = members.length
        ? Math.min(100, Math.round((busy / members.length) * 100))
        : 0;
      const specialties = [...new Set(members.flatMap((employee) => specialtyList(employee.specialty)))].slice(0, 4);

      return {
        ...department,
        members,
        busy,
        review,
        issues,
        taskCount,
        utilization,
        specialties,
      };
    });
  }, [departments, employees, issueEmployeeIds, loadByEmployee]);

  const summary = useMemo(() => {
    const busy = employees.filter(
      (employee) => (loadByEmployee.get(employee.id) ?? 0) > 0,
    ).length;
    const available = employees.filter(
      (employee) => (loadByEmployee.get(employee.id) ?? 0) === 0,
    ).length;
    const overloaded = employees.filter(
      (employee) => (loadByEmployee.get(employee.id) ?? 0) >= 3,
    ).length;

    return {
      total: employees.length,
      departments: departmentStats.filter((department) => department.members.length).length,
      busy,
      available,
      issues: issueEmployeeIds.size,
      overloaded,
    };
  }, [departmentStats, employees, issueEmployeeIds, loadByEmployee]);

  const filteredEmployees = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees
      .filter((employee) => {
        const specialties = specialtyList(employee.specialty).join(" ").toLowerCase();
        const matchesQuery =
          !q ||
          employee.name.toLowerCase().includes(q) ||
          employee.employee_code.toLowerCase().includes(q) ||
          employee.position.toLowerCase().includes(q) ||
          employee.departments?.name.toLowerCase().includes(q) ||
          specialties.includes(q);
        const matchesDepartment =
          !departmentId || employee.departments?.id === departmentId;
        const matchesStatus = !status || employee.status === status;
        return matchesQuery && matchesDepartment && matchesStatus;
      })
      .sort((a, b) => {
        const loadDiff =
          (loadByEmployee.get(b.id) ?? 0) - (loadByEmployee.get(a.id) ?? 0);
        if (loadDiff !== 0) return loadDiff;
        return a.employee_code.localeCompare(b.employee_code);
      });
  }, [departmentId, employees, loadByEmployee, query, status]);

  const busiest = useMemo(
    () =>
      [...employees]
        .sort(
          (a, b) =>
            (loadByEmployee.get(b.id) ?? 0) -
            (loadByEmployee.get(a.id) ?? 0),
        )
        .filter((employee) => (loadByEmployee.get(employee.id) ?? 0) > 0)
        .slice(0, 6),
    [employees, loadByEmployee],
  );

  const recentHandoffs = useMemo(
    () =>
      handoffs.slice(0, 8).map((handoff) => {
        const fromTask = taskById.get(handoff.from_task_id);
        const toTask = taskById.get(handoff.to_task_id);
        const fromEmployee = fromTask?.assigned_employee_id
          ? employeeById.get(fromTask.assigned_employee_id)
          : null;
        const toEmployee = toTask?.assigned_employee_id
          ? employeeById.get(toTask.assigned_employee_id)
          : null;
        return { handoff, fromTask, toTask, fromEmployee, toEmployee };
      }),
    [employeeById, handoffs, taskById],
  );

  const activeAssignments = assignments.filter((item) => item.status === "ACTIVE");
  const secretaryAssignments = activeAssignments.filter(
    (item) => item.assignment_source === "SECRETARY",
  ).length;

  return (
    <div className="mt-6 space-y-4">
      <section className="overflow-hidden rounded-[22px] border border-[#DCE6ED] bg-[linear-gradient(135deg,#F7FBFE_0%,#FFFFFF_52%,#F2F8FC_100%)] p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-[720px]">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-[11px] border border-[#D6E6F2] bg-white text-[#4D89B8] shadow-sm">
                <Network className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[12px] font-black text-[#344652]">SAWOL ORGANIZATION CONTROL</p>
                <p className="mt-0.5 text-[8px] text-[#8495A2]">90인 조직 운영 상태 · 업무량 · 협업 · 인수인계</p>
              </div>
            </div>
            <p className="mt-4 text-[11px] leading-5 text-[#72818D]">
              대표는 직원 개개인의 진행을 직접 관리하기보다, 부서 가동률과 과부하·문제 직원·협업 흐름을 이 화면에서 확인합니다.
              직원 상태는 라이브 오피스와 같은 실데이터를 사용합니다.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Link href="/office" className="flex h-10 items-center justify-center gap-2 rounded-[11px] border border-[#D7E4EC] bg-white px-4 text-[9px] font-bold text-[#55738A] shadow-sm hover:bg-[#F8FBFD]">
              <Building2 className="h-3.5 w-3.5" /> 라이브 오피스
            </Link>
            <Link href="/secretary" className="flex h-10 items-center justify-center gap-2 rounded-[11px] bg-[#263541] px-4 text-[9px] font-bold text-white hover:bg-[#1D2B35]">
              <Sparkles className="h-3.5 w-3.5" /> 비서실 관제
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="전체 직원" value={summary.total} note="활성 AI 직원" icon={Users} tone="blue" />
        <StatCard label="운영 부서" value={summary.departments} note="직원이 배치된 조직" icon={Building2} />
        <StatCard label="업무 중" value={summary.busy} note="현재 1건 이상 담당" icon={Activity} tone="blue" />
        <StatCard label="대기 가능" value={summary.available} note="즉시 배정 가능한 인력" icon={Clock3} />
        <StatCard label="확인 필요" value={summary.issues} note="보류·오류·자료 대기" icon={CircleAlert} tone={summary.issues ? "danger" : "default"} />
        <StatCard label="과부하" value={summary.overloaded} note="활성 업무 3건 이상" icon={Zap} tone={summary.overloaded ? "warn" : "default"} />
      </section>

      <section className="rounded-[19px] border border-[#E1E7EB] bg-white p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex rounded-[11px] bg-[#F4F7F9] p-1">
            <button type="button" onClick={() => setView("organization")} className={`h-8 rounded-[8px] px-3 text-[9px] font-bold transition ${view === "organization" ? "bg-white text-[#3F6683] shadow-sm" : "text-[#8A969F]"}`}>
              조직 현황
            </button>
            <button type="button" onClick={() => setView("employees")} className={`h-8 rounded-[8px] px-3 text-[9px] font-bold transition ${view === "employees" ? "bg-white text-[#3F6683] shadow-sm" : "text-[#8A969F]"}`}>
              직원 명부
            </button>
          </div>
          <p className="px-1 text-[8px] text-[#98A2AA]">비서실 자동 배정 {secretaryAssignments}건 · 활성 배정 {activeAssignments.length}건</p>
        </div>
      </section>

      {view === "organization" ? (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {departmentStats.filter((department) => department.members.length).map((department) => (
              <button
                key={department.id}
                type="button"
                onClick={() => {
                  setDepartmentId(department.id);
                  setView("employees");
                }}
                className="group rounded-[19px] border border-[#E1E7EB] bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-[#C9DDEB] hover:shadow-[0_10px_30px_rgba(49,81,106,0.06)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#DBE8F0] bg-[#F4F9FC] text-[#5587AA]">
                        <Building2 className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-[12px] font-black text-[#3D4E59]">{department.name}</p>
                        <p className="mt-0.5 text-[7px] font-semibold text-[#A0AAB1]">{department.code || "DEPARTMENT"}</p>
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-[#B2BEC6] transition group-hover:translate-x-0.5 group-hover:text-[#5D8AAF]" />
                </div>

                <div className="mt-5 grid grid-cols-4 gap-2">
                  {[
                    ["인원", department.members.length],
                    ["업무중", department.busy],
                    ["업무", department.taskCount],
                    ["확인", department.issues],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-[10px] bg-[#F7F9FA] px-2 py-2.5 text-center">
                      <p className="text-[7px] text-[#9AA4AC]">{label}</p>
                      <p className="mt-1 text-[13px] font-black text-[#4A5964]">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-[7px]">
                    <span className="font-semibold text-[#82909A]">가동률</span>
                    <span className="font-black text-[#5486AA]">{department.utilization}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#EEF2F4]">
                    <div className="h-full rounded-full bg-[#79B5DE]" style={{ width: `${department.utilization}%` }} />
                  </div>
                </div>

                <div className="mt-4 flex min-h-6 flex-wrap gap-1.5">
                  {department.specialties.length ? department.specialties.map((specialty) => (
                    <span key={specialty} className="rounded-full border border-[#E3E9ED] bg-[#FAFBFC] px-2 py-1 text-[7px] text-[#7F8B94]">{specialty}</span>
                  )) : <span className="text-[7px] text-[#A3ACB3]">전문분야 정보 없음</span>}
                </div>
              </button>
            ))}
          </section>

          <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <div className="rounded-[19px] border border-[#E1E7EB] bg-white p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-black text-[#3E4D58]">현재 업무량 상위</p>
                  <p className="mt-1 text-[8px] text-[#929DA5]">동시 업무가 많은 직원을 먼저 확인합니다.</p>
                </div>
                <Activity className="h-4 w-4 text-[#6DA4CA]" />
              </div>
              <div className="mt-4 space-y-2">
                {busiest.map((employee, index) => {
                  const load = loadByEmployee.get(employee.id) ?? 0;
                  return (
                    <Link key={employee.id} href={`/employees/${employee.id}`} className="flex items-center gap-3 rounded-[12px] border border-[#E9EDF0] p-3 transition hover:border-[#CEDDE7] hover:bg-[#FBFDFE]">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-[#F0F6FA] text-[9px] font-black text-[#5B86A4]">{index + 1}</span>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EAF4FB] text-[9px] font-black text-[#447BA2]">{employeeInitial(employee.name)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[9px] font-bold text-[#4A5862]">{employee.name} <span className="font-normal text-[#9AA4AB]">· {employee.position}</span></p>
                        <p className="mt-0.5 truncate text-[7px] text-[#9AA4AB]">{employee.departments?.name ?? "소속 없음"}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[8px] font-black ${load >= 3 ? "bg-[#FFF0E8] text-[#B56E3E]" : "bg-[#EEF7FD] text-[#4B83AA]"}`}>{load}건</span>
                    </Link>
                  );
                })}
                {!busiest.length ? <div className="rounded-[12px] bg-[#F8FAFB] px-4 py-8 text-center text-[8px] text-[#9BA5AD]">현재 배정된 업무가 없습니다.</div> : null}
              </div>
            </div>

            <div className="rounded-[19px] border border-[#E1E7EB] bg-white p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-black text-[#3E4D58]">최근 직원 간 인수인계</p>
                  <p className="mt-1 text-[8px] text-[#929DA5]">실제 workflow handoff 기준입니다.</p>
                </div>
                <Workflow className="h-4 w-4 text-[#6DA4CA]" />
              </div>
              <div className="mt-4 space-y-2">
                {recentHandoffs.map(({ handoff, fromEmployee, toEmployee, fromTask, toTask }) => (
                  <div key={handoff.id} className="rounded-[12px] border border-[#E9EDF0] p-3">
                    <div className="flex items-center gap-2 text-[8px] font-bold text-[#566672]">
                      <span className="max-w-[36%] truncate">{fromEmployee?.name ?? "이전 담당"}</span>
                      <ArrowRight className="h-3 w-3 shrink-0 text-[#78A4C2]" />
                      <span className="max-w-[36%] truncate">{toEmployee?.name ?? "다음 담당"}</span>
                      <span className="ml-auto shrink-0 text-[7px] font-normal text-[#A0A9B0]">{shortDate(handoff.created_at)}</span>
                    </div>
                    <p className="mt-2 truncate text-[8px] text-[#87939C]">{fromTask?.title ?? handoff.title} → {toTask?.title ?? "다음 단계"}</p>
                  </div>
                ))}
                {!recentHandoffs.length ? <div className="rounded-[12px] bg-[#F8FAFB] px-4 py-8 text-center text-[8px] text-[#9BA5AD]">최근 인수인계 기록이 없습니다.</div> : null}
              </div>
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="rounded-[19px] border border-[#E1E7EB] bg-white p-4">
            <div className="grid gap-2 lg:grid-cols-[1fr_220px_170px_auto]">
              <label className="relative block">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#A2ABB2]" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름 · 직원코드 · 직책 · 전문분야 검색" className="h-10 w-full rounded-[10px] border border-[#E0E6EA] bg-[#FBFCFD] pl-9 pr-3 text-[10px] outline-none transition focus:border-[#9FC5DE] focus:bg-white" />
              </label>
              <select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} className="h-10 rounded-[10px] border border-[#E0E6EA] bg-white px-3 text-[9px] text-[#5E6C77] outline-none">
                <option value="">모든 부서</option>
                {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </select>
              <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-[10px] border border-[#E0E6EA] bg-white px-3 text-[9px] text-[#5E6C77] outline-none">
                <option value="">모든 상태</option>
                {Object.entries(EMPLOYEE_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <button type="button" onClick={() => { setQuery(""); setDepartmentId(""); setStatus(""); }} className="flex h-10 items-center justify-center gap-2 rounded-[10px] border border-[#E0E6EA] bg-white px-3 text-[9px] font-semibold text-[#71808B] hover:bg-[#F7F9FA]">
                <Filter className="h-3.5 w-3.5" /> 초기화
              </button>
            </div>
          </section>

          <section className="overflow-hidden rounded-[19px] border border-[#E1E7EB] bg-white">
            <div className="flex items-center justify-between border-b border-[#E7ECEF] px-4 py-3">
              <div>
                <p className="text-[10px] font-black text-[#45545F]">직원 운영 명부</p>
                <p className="mt-0.5 text-[7px] text-[#9AA4AC]">검색 결과 {filteredEmployees.length}명 · 라이브 오피스와 동일한 상태 데이터</p>
              </div>
              <Users className="h-4 w-4 text-[#6A9DBF]" />
            </div>

            <div className="hidden grid-cols-[minmax(220px,1.4fr)_minmax(150px,1fr)_100px_100px_90px_90px] gap-3 border-b border-[#EDF0F2] bg-[#FAFBFC] px-4 py-2.5 text-[7px] font-bold text-[#929DA5] xl:grid">
              <span>직원</span><span>소속 / 전문분야</span><span>상태</span><span>현재 업무</span><span>인수인계</span><span>최근 완료</span>
            </div>

            <div className="divide-y divide-[#EEF1F3]">
              {filteredEmployees.map((employee) => {
                const load = loadByEmployee.get(employee.id) ?? 0;
                const completed = completedByEmployee.get(employee.id) ?? 0;
                const incoming = handoffCounts.incoming.get(employee.id) ?? 0;
                const outgoing = handoffCounts.outgoing.get(employee.id) ?? 0;
                const specialties = specialtyList(employee.specialty);
                const isIssue = issueEmployeeIds.has(employee.id);
                const overloaded = load >= 3;

                return (
                  <Link key={employee.id} href={`/employees/${employee.id}`} className="grid gap-3 px-4 py-4 transition hover:bg-[#FBFDFE] xl:grid-cols-[minmax(220px,1.4fr)_minmax(150px,1fr)_100px_100px_90px_90px] xl:items-center">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-[10px] font-black ${isIssue ? "border-[#F0D0D0] bg-[#FFF3F3] text-[#B75C5C]" : "border-[#DCE9F1] bg-[#EFF7FC] text-[#4B83AA]"}`}>{employeeInitial(employee.name)}</span>
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate text-[10px] font-black text-[#45545F]">{employee.name}</p>
                          {overloaded ? <span className="shrink-0 rounded-full bg-[#FFF0E8] px-1.5 py-0.5 text-[6px] font-bold text-[#B96C3A]">과부하</span> : null}
                          {isIssue && !overloaded ? <span className="shrink-0 rounded-full bg-[#FFF0F0] px-1.5 py-0.5 text-[6px] font-bold text-[#B95757]">확인</span> : null}
                        </div>
                        <p className="mt-1 truncate text-[7px] text-[#9AA4AC]">{employee.employee_code} · {employee.position}</p>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-[8px] font-semibold text-[#657681]">{employee.departments?.name ?? "소속 없음"}</p>
                      <p className="mt-1 truncate text-[7px] text-[#A0A9B0]">{specialties.join(" · ") || "전문분야 미등록"}</p>
                    </div>

                    <div><StatusPill status={employee.status} /></div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[13px] font-black ${overloaded ? "text-[#B86B3A]" : load ? "text-[#4E83AA]" : "text-[#9AA4AC]"}`}>{load}</span>
                      <span className="text-[7px] text-[#9CA6AD]">건</span>
                    </div>

                    <div className="flex items-center gap-1 text-[8px] font-semibold text-[#687985]">
                      <span>{incoming}</span><ArrowRight className="h-3 w-3 text-[#98ABB8]" /><span>{outgoing}</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[8px] font-semibold text-[#5C7668]">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#65A47E]" /> {completed}
                    </div>
                  </Link>
                );
              })}
              {!filteredEmployees.length ? <div className="px-4 py-12 text-center text-[9px] text-[#99A3AA]">조건에 맞는 직원이 없습니다.</div> : null}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
