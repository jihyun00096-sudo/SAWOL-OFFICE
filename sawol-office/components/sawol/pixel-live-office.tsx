"use client";

import Link from "next/link";
import {
  BriefcaseBusiness,
  Building2,
  ChevronRight,
  CircleAlert,
  Coffee,
  FileCheck2,
  FileText,
  Focus,
  Handshake,
  Minus,
  Monitor,
  Plus,
  Search,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";

export type PixelOfficeEmployee = {
  id: string;
  employeeCode: string;
  name: string;
  position: string | null;
  specialty: string | null;
  status: string;
  departmentId: string | null;
  departmentName: string;
  currentTaskId: string | null;
  currentTaskTitle: string | null;
  currentTaskStatus: string | null;
  currentWorkflowId: string | null;
  currentWorkflowStep: number | null;
  updatedAt: string | null;
};

export type PixelOfficeDepartment = {
  id: string;
  code: string | null;
  name: string;
  departmentType: string;
  sortOrder: number;
  employees: PixelOfficeEmployee[];
};

export type PixelOfficeWorkflowStep = {
  id: string;
  stepNo: number;
  stepKey: string | null;
  title: string;
  status: string;
  employeeId: string | null;
  employeeName: string | null;
  departmentName: string | null;
  updatedAt: string;
};

export type PixelOfficeWorkflow = {
  id: string;
  rootTaskId: string;
  taskCode: string;
  title: string;
  status: string;
  executionMode: string | null;
  progress: number;
  currentStepTitle: string | null;
  updatedAt: string;
  steps: PixelOfficeWorkflowStep[];
};

export type PixelOfficeHandoff = {
  id: string;
  fromEmployee: string;
  toEmployee: string;
  title: string;
  summary: string | null;
  createdAt: string;
};

export type PixelOfficeSummary = {
  pendingApprovals: number;
  activeWorkflows: number;
  activeEmployees: number;
  totalEmployees: number;
  recentHandoffs: number;
};

const statusLabel: Record<string, string> = {
  AVAILABLE: "대기",
  WAITING: "대기",
  OFFLINE: "자리 비움",
  WORKING: "작업 중",
  REVIEWING: "검수 중",
  APPROVAL_WAIT: "대표 승인 대기",
  BLOCKED: "문제 확인",
  WAITING_FOR_DATA: "자료 대기",
  IN_PROGRESS: "작업 중",
  COLLABORATING: "협업 중",
  IN_REVIEW: "검수 중",
  REVIEW: "검수 중",
  PENDING_APPROVAL: "대표 승인 대기",
  REVISION_REQUESTED: "재작업",
  COMPLETED: "완료",
  ON_HOLD: "보류",
  ERROR: "오류",
};

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

function stateOf(employee: PixelOfficeEmployee) {
  const taskStatus = employee.currentTaskStatus ?? "";
  if (["ERROR", "BLOCKED"].includes(employee.status) || taskStatus === "ERROR") return "error";
  if (["APPROVAL_WAIT"].includes(employee.status) || taskStatus === "PENDING_APPROVAL") return "approval";
  if (["REVIEWING"].includes(employee.status) || ["REVIEW", "IN_REVIEW"].includes(taskStatus)) return "review";
  if (["WORKING"].includes(employee.status) || ["IN_PROGRESS", "COLLABORATING"].includes(taskStatus)) return "working";
  if (taskStatus === "WAITING_FOR_DATA") return "waiting-data";
  return "idle";
}

function employeeStatusLabel(employee: PixelOfficeEmployee) {
  return statusLabel[employee.currentTaskStatus ?? ""] ?? statusLabel[employee.status] ?? "대기";
}

function PixelPerson({
  employee,
  selected,
  highlighted,
  compact = false,
  onClick,
}: {
  employee: PixelOfficeEmployee;
  selected: boolean;
  highlighted: boolean;
  compact?: boolean;
  onClick: () => void;
}) {
  const state = stateOf(employee);
  const initials = employee.name.slice(-2);

  const stateTone: Record<string, { dot: string; monitor: string; chair: string }> = {
    idle: { dot: "bg-[#AAB2BE]", monitor: "bg-[#E9EDF2]", chair: "bg-[#BFC7D1]" },
    working: { dot: "bg-[#3D82F6]", monitor: "bg-[#B9D9FF]", chair: "bg-[#7CAAF2]" },
    review: { dot: "bg-[#28A77A]", monitor: "bg-[#CBEFE3]", chair: "bg-[#6AC5A7]" },
    approval: { dot: "bg-[#E1A72B]", monitor: "bg-[#FBE9B8]", chair: "bg-[#D9B55F]" },
    error: { dot: "bg-[#D85B5B]", monitor: "bg-[#F6CCCC]", chair: "bg-[#E69B9B]" },
    "waiting-data": { dot: "bg-[#8B77D9]", monitor: "bg-[#DDD7F5]", chair: "bg-[#A99AE5]" },
  };

  const tone = stateTone[state] ?? stateTone.idle;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex min-w-0 flex-col items-center rounded-[10px] px-1.5 py-1.5 text-center transition-all duration-200 ${
        selected
          ? "bg-white shadow-[0_0_0_2px_#5BA7FF,0_8px_18px_rgba(60,104,160,.16)]"
          : highlighted
            ? "bg-[#F1F8FF] shadow-[0_0_0_1px_#8BC0FF]"
            : "hover:bg-white/70"
      }`}
      title={`${employee.name} · ${employeeStatusLabel(employee)}`}
    >
      <div className={`relative ${compact ? "h-[54px] w-[58px]" : "h-[62px] w-[66px]"}`}>
        {state !== "idle" ? (
          <span className={`absolute left-1 top-0 h-2.5 w-2.5 rounded-full border-2 border-white ${tone.dot} ${state === "working" ? "animate-pulse" : ""}`} />
        ) : null}

        <div className="absolute bottom-[7px] left-1/2 h-[18px] w-[50px] -translate-x-1/2 rounded-[2px] border border-[#AEB7C2] bg-[#D8DEE6] shadow-[0_3px_0_#ADB6C1]" />
        <div className={`absolute bottom-[19px] left-1/2 h-[22px] w-[31px] -translate-x-1/2 rounded-[2px] border border-[#91A0AE] ${tone.monitor} shadow-[0_2px_0_#94A0AC]`}>
          <div className="mx-auto mt-[4px] h-[2px] w-[17px] bg-white/80" />
          <div className="mx-auto mt-[3px] h-[2px] w-[12px] bg-white/60" />
        </div>
        <div className="absolute bottom-[13px] left-1/2 h-[6px] w-[3px] -translate-x-1/2 bg-[#8E9AA7]" />

        <div className={`absolute bottom-[4px] left-1/2 h-[20px] w-[20px] -translate-x-1/2 rounded-[3px] border border-[#8796A5] ${tone.chair}`} />

        <div className="absolute bottom-[18px] left-1/2 h-[17px] w-[18px] -translate-x-1/2 rounded-[3px] bg-[#E9B992] shadow-[inset_0_-3px_0_rgba(111,70,51,.12)]">
          <div className="absolute -top-[3px] left-[2px] h-[7px] w-[14px] rounded-t-[4px] bg-[#303742]" />
          <div className="absolute left-[4px] top-[7px] h-[2px] w-[2px] bg-[#36404B]" />
          <div className="absolute right-[4px] top-[7px] h-[2px] w-[2px] bg-[#36404B]" />
        </div>
        <div className="absolute bottom-[5px] left-1/2 h-[15px] w-[22px] -translate-x-1/2 rounded-t-[5px] bg-[#334155]" />

        {state === "working" ? (
          <div className="absolute right-[1px] top-[1px] flex h-[19px] w-[19px] items-center justify-center rounded-full border border-[#BBD9FF] bg-white text-[#3579D6] shadow-sm">
            <Monitor className="h-2.5 w-2.5" />
          </div>
        ) : null}
        {state === "review" ? (
          <div className="absolute right-[1px] top-[1px] flex h-[19px] w-[19px] items-center justify-center rounded-full border border-[#BDE5D7] bg-white text-[#238A68] shadow-sm">
            <Search className="h-2.5 w-2.5" />
          </div>
        ) : null}
        {state === "approval" ? (
          <div className="absolute right-[1px] top-[1px] flex h-[19px] w-[19px] items-center justify-center rounded-full border border-[#F0D99B] bg-white text-[#B07B12] shadow-sm">
            <FileCheck2 className="h-2.5 w-2.5" />
          </div>
        ) : null}
      </div>

      <p className="max-w-[72px] truncate text-[9px] font-semibold tracking-[-0.02em] text-[#3C4652]">{employee.name}</p>
      <p className="mt-0.5 max-w-[74px] truncate text-[7px] text-[#8F99A5]">{initials} · {employeeStatusLabel(employee)}</p>
    </button>
  );
}

function PixelPlant() {
  return (
    <div className="relative h-12 w-9 shrink-0" aria-hidden="true">
      <div className="absolute bottom-0 left-1/2 h-4 w-7 -translate-x-1/2 rounded-b-[5px] bg-[#8E6C56] shadow-[0_3px_0_#6F5444]" />
      <div className="absolute bottom-3 left-[8px] h-7 w-3 rotate-[-18deg] rounded-t-full bg-[#68A77C]" />
      <div className="absolute bottom-4 right-[7px] h-7 w-3 rotate-[18deg] rounded-t-full bg-[#7BB68D]" />
      <div className="absolute bottom-5 left-[13px] h-7 w-3 rounded-t-full bg-[#5F9C73]" />
    </div>
  );
}

function StatusLegend() {
  const items = [
    ["#3D82F6", "작업 중"],
    ["#28A77A", "검수 중"],
    ["#E1A72B", "승인 대기"],
    ["#8B77D9", "자료 대기"],
    ["#D85B5B", "문제 확인"],
    ["#AAB2BE", "대기"],
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {items.map(([color, label]) => (
        <span key={label} className="inline-flex items-center gap-1.5 text-[8px] text-[#7E8895]">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
          {label}
        </span>
      ))}
    </div>
  );
}

function DepartmentRoom({
  department,
  selectedEmployeeId,
  highlightedEmployeeIds,
  onSelectEmployee,
}: {
  department: PixelOfficeDepartment;
  selectedEmployeeId: string | null;
  highlightedEmployeeIds: Set<string>;
  onSelectEmployee: (employee: PixelOfficeEmployee) => void;
}) {
  const working = department.employees.filter((employee) => stateOf(employee) !== "idle").length;
  const columns = department.employees.length > 12 ? 6 : department.employees.length > 7 ? 5 : 4;

  return (
    <section className="relative overflow-hidden rounded-[18px] border border-[#C9D6E5] bg-[#F8FBFE] shadow-[0_10px_24px_rgba(62,84,109,.08)]">
      <div className="absolute inset-0 opacity-[0.42]" style={{ backgroundImage: "linear-gradient(#DCE5EF 1px, transparent 1px), linear-gradient(90deg, #DCE5EF 1px, transparent 1px)", backgroundSize: "18px 18px" }} />
      <div className="absolute inset-x-0 top-0 h-11 border-b border-[#BED0E2] bg-[#EAF3FB]/95" />
      <div className="relative z-10 flex h-11 items-center justify-between px-3.5">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-bold text-[#314153]">{department.name}</p>
          <p className="mt-0.5 text-[7px] text-[#7E8D9C]">{department.employees.length}명 · {working}명 활동</p>
        </div>
        <div className="flex items-center gap-1.5">
          {working > 0 ? <span className="h-2 w-2 animate-pulse rounded-full bg-[#4E99F5]" /> : <span className="h-2 w-2 rounded-full bg-[#BAC4CF]" />}
          <span className="text-[7px] font-semibold text-[#788796]">{working > 0 ? "LIVE" : "IDLE"}</span>
        </div>
      </div>

      <div className="relative z-10 min-h-[210px] p-3.5 pt-4">
        {department.employees.length ? (
          <div
            className="grid gap-x-1.5 gap-y-2"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {department.employees.map((employee) => (
              <PixelPerson
                key={employee.id}
                employee={employee}
                selected={selectedEmployeeId === employee.id}
                highlighted={highlightedEmployeeIds.has(employee.id)}
                compact={department.employees.length > 12}
                onClick={() => onSelectEmployee(employee)}
              />
            ))}
          </div>
        ) : (
          <div className="flex min-h-[180px] items-center justify-center text-[9px] text-[#A0A9B3]">배치된 직원이 없습니다.</div>
        )}
      </div>

      <div className="relative z-10 flex items-end justify-between border-t border-[#D6E1EB] bg-white/55 px-3 py-2">
        <div className="flex items-center gap-1.5 text-[7px] text-[#8995A2]">
          <Coffee className="h-3 w-3" />
          대기 중인 직원도 자리에 표시됩니다
        </div>
        <PixelPlant />
      </div>
    </section>
  );
}

function WorkflowRail({
  workflow,
  compact = false,
}: {
  workflow: PixelOfficeWorkflow;
  compact?: boolean;
}) {
  const completed = workflow.steps.filter((step) => step.status === "COMPLETED").length;

  return (
    <div className={`rounded-[16px] border border-[#D9E4EF] bg-white ${compact ? "p-3" : "p-4"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-bold text-[#303B47]">{workflow.title}</p>
          <p className="mt-1 text-[7px] text-[#8894A0]">{workflow.taskCode} · {completed}/{workflow.steps.length} 단계 완료</p>
        </div>
        <span className="shrink-0 rounded-full bg-[#EEF6FF] px-2 py-1 text-[7px] font-semibold text-[#3276C8]">{Math.round(workflow.progress)}%</span>
      </div>

      <div className="mt-3 overflow-x-auto pb-1">
        <div className="flex min-w-max items-center gap-1">
          <div className="flex h-8 items-center rounded-[8px] border border-[#DDE5EE] bg-[#F6F8FA] px-2.5 text-[7px] font-semibold text-[#647181]">대표 지시</div>
          <ChevronRight className="h-3.5 w-3.5 text-[#ABB6C1]" />
          <div className="flex h-8 items-center rounded-[8px] border border-[#D1E0EF] bg-[#EFF6FC] px-2.5 text-[7px] font-semibold text-[#4B718F]">비서실 분석</div>

          {workflow.steps.map((step, index) => {
            const done = step.status === "COMPLETED";
            const current = !done && workflow.steps.slice(0, index).every((previous) => previous.status === "COMPLETED");
            return (
              <div key={step.id} className="flex items-center gap-1">
                <ChevronRight className={`h-3.5 w-3.5 ${done ? "text-[#6CB08B]" : current ? "text-[#4D94E8]" : "text-[#C0C7D0]"}`} />
                <div className={`relative flex min-h-8 max-w-[132px] items-center gap-1.5 rounded-[8px] border px-2.5 py-1.5 text-[7px] font-semibold ${
                  done
                    ? "border-[#CDE5D6] bg-[#F1FAF5] text-[#39795A]"
                    : current
                      ? "border-[#AFCFF4] bg-[#EFF7FF] text-[#2F70BC] shadow-[0_0_0_2px_rgba(72,145,228,.08)]"
                      : "border-[#E1E5EA] bg-[#FAFBFC] text-[#8A949F]"
                }`}>
                  {current ? <span className="absolute -right-1 -top-1 h-2 w-2 animate-ping rounded-full bg-[#4D94E8]/40" /> : null}
                  <span className="truncate">{step.employeeName || `단계 ${step.stepNo}`}</span>
                </div>
              </div>
            );
          })}

          <ChevronRight className="h-3.5 w-3.5 text-[#A8B5C1]" />
          <div className="flex h-8 items-center rounded-[8px] border border-[#D1E0EF] bg-[#F1F7FC] px-2.5 text-[7px] font-semibold text-[#4B718F]">비서 취합</div>
          <ChevronRight className="h-3.5 w-3.5 text-[#A8B5C1]" />
          <div className="flex h-8 items-center rounded-[8px] border border-[#C9D4E1] bg-[#27313D] px-2.5 text-[7px] font-semibold text-white">대표 보고</div>
        </div>
      </div>
    </div>
  );
}

function EmployeeDetail({
  employee,
  onClose,
}: {
  employee: PixelOfficeEmployee;
  onClose: () => void;
}) {
  return (
    <div className="rounded-[18px] border border-[#D9E3ED] bg-white p-4 shadow-[0_12px_30px_rgba(53,72,92,.10)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-[#EAF4FF] text-[11px] font-black text-[#3C78B8]">{employee.name.slice(-2)}</div>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-bold text-[#303A46]">{employee.name}</p>
            <p className="mt-1 truncate text-[8px] text-[#8994A0]">{employee.position || "AI 직원"} · {employee.departmentName}</p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-[#E3E8ED] text-[#7E8995] hover:bg-[#F5F7F9]" aria-label="직원 상세 닫기">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-[11px] bg-[#F5F8FB] p-2.5">
          <p className="text-[7px] text-[#8C98A5]">현재 상태</p>
          <p className="mt-1 text-[9px] font-semibold text-[#42505E]">{employeeStatusLabel(employee)}</p>
        </div>
        <div className="rounded-[11px] bg-[#F5F8FB] p-2.5">
          <p className="text-[7px] text-[#8C98A5]">직원 코드</p>
          <p className="mt-1 text-[9px] font-semibold text-[#42505E]">{employee.employeeCode}</p>
        </div>
      </div>

      <div className="mt-3 rounded-[12px] border border-[#E3E9EF] p-3">
        <p className="text-[7px] font-semibold text-[#7E8B98]">현재 업무</p>
        <p className="mt-1.5 text-[9px] font-semibold leading-4 text-[#394552]">{employee.currentTaskTitle || "배정된 업무 없이 자리에서 대기 중"}</p>
        {employee.currentWorkflowStep ? <p className="mt-1 text-[7px] text-[#8994A0]">협업 workflow {employee.currentWorkflowStep}단계</p> : null}
      </div>

      {employee.specialty ? (
        <div className="mt-3 rounded-[12px] bg-[#F7FAFC] p-3">
          <p className="text-[7px] font-semibold text-[#7E8B98]">전문 분야</p>
          <p className="mt-1 text-[8px] leading-4 text-[#5D6975]">{employee.specialty}</p>
        </div>
      ) : null}

      <Link href={`/employees/${employee.id}`} className="mt-3 flex h-9 items-center justify-center rounded-[10px] bg-[#26313D] text-[8px] font-semibold text-white hover:bg-[#1D2731]">직원 상세 보기</Link>
    </div>
  );
}

export function PixelLiveOffice({
  departments,
  workflows,
  handoffs,
  summary,
  secretary,
}: {
  departments: PixelOfficeDepartment[];
  workflows: PixelOfficeWorkflow[];
  handoffs: PixelOfficeHandoff[];
  summary: PixelOfficeSummary;
  secretary: PixelOfficeEmployee | null;
}) {
  const [zoom, setZoom] = useState(0.9);
  const [selectedEmployee, setSelectedEmployee] = useState<PixelOfficeEmployee | null>(null);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(workflows[0]?.id ?? null);
  const [showOnlyActive, setShowOnlyActive] = useState(false);

  const selectedWorkflow = useMemo(
    () => workflows.find((workflow) => workflow.id === selectedWorkflowId) ?? null,
    [selectedWorkflowId, workflows],
  );

  const highlightedEmployeeIds = useMemo(
    () => new Set((selectedWorkflow?.steps ?? []).map((step) => step.employeeId).filter(Boolean) as string[]),
    [selectedWorkflow],
  );

  const visibleDepartments = useMemo(() => {
    if (!showOnlyActive) return departments;
    return departments
      .map((department) => ({
        ...department,
        employees: department.employees.filter((employee) => stateOf(employee) !== "idle"),
      }))
      .filter((department) => department.employees.length > 0);
  }, [departments, showOnlyActive]);

  const roomColumns = visibleDepartments.length > 8 ? 3 : 2;
  const canvasWidth = roomColumns === 3 ? 1520 : 1120;
  const rows = Math.max(1, Math.ceil(visibleDepartments.length / roomColumns));
  const canvasHeight = 330 + rows * 330;

  return (
    <div className="mt-5 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {([
          { label: "진행 workflow", value: summary.activeWorkflows, icon: BriefcaseBusiness, textTone: "text-[#367BC8]", bgTone: "bg-[#EDF6FF]" },
          { label: "활동 직원", value: summary.activeEmployees, icon: UsersRound, textTone: "text-[#367BC8]", bgTone: "bg-[#EDF6FF]" },
          { label: "전체 직원", value: summary.totalEmployees, icon: Building2, textTone: "text-[#586675]", bgTone: "bg-[#F2F5F7]" },
          { label: "최근 인수인계", value: summary.recentHandoffs, icon: Handshake, textTone: "text-[#2C8A68]", bgTone: "bg-[#EEF9F5]" },
          { label: "대표 승인 대기", value: summary.pendingApprovals, icon: FileCheck2, textTone: "text-[#A97718]", bgTone: "bg-[#FFF8E8]" },
        ] satisfies Array<{ label: string; value: number; icon: LucideIcon; textTone: string; bgTone: string }>).map(({ label, value, icon: Icon, textTone, bgTone }) => (
          <div key={label} className="rounded-[16px] border border-[#E1E7ED] bg-white p-4 shadow-[0_5px_15px_rgba(65,82,101,.04)]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[8px] font-semibold text-[#8B96A2]">{label}</p>
              <div className={`flex h-7 w-7 items-center justify-center rounded-[9px] ${bgTone}`}><Icon className={`h-3.5 w-3.5 ${textTone}`} /></div>
            </div>
            <p className="mt-3 text-[22px] font-black tracking-[-0.04em] text-[#2F3944]">{value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
        <section className="min-w-0 overflow-hidden rounded-[20px] border border-[#D8E1EA] bg-[#F5F9FC] shadow-[0_14px_35px_rgba(47,72,96,.08)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DDE5EC] bg-white px-4 py-3.5">
            <div>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#4A97EC] opacity-35" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#4A97EC]" />
                </span>
                <p className="text-[10px] font-bold text-[#384553]">SAWOL OFFICE · PIXEL FLOOR</p>
              </div>
              <p className="mt-1 text-[7px] text-[#8B97A3]">90명 규모를 기준으로 전체 → 부서 → 개인을 확대해 보는 운영 플로어</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setShowOnlyActive((value) => !value)} className={`h-8 rounded-[9px] border px-2.5 text-[8px] font-semibold transition ${showOnlyActive ? "border-[#9AC5F6] bg-[#EDF6FF] text-[#3479C7]" : "border-[#DEE5EB] bg-white text-[#76828E] hover:bg-[#F7F9FB]"}`}>
                {showOnlyActive ? "전체 직원 보기" : "활동 직원만"}
              </button>
              <div className="flex h-8 items-center overflow-hidden rounded-[9px] border border-[#DEE5EB] bg-white">
                <button type="button" onClick={() => setZoom((value) => Math.max(0.7, Math.round((value - 0.1) * 10) / 10))} className="flex h-full w-8 items-center justify-center text-[#73808D] hover:bg-[#F4F7F9]" aria-label="축소"><Minus className="h-3.5 w-3.5" /></button>
                <div className="flex h-full min-w-12 items-center justify-center border-x border-[#E4E9EE] px-2 text-[8px] font-semibold text-[#64717E]">{Math.round(zoom * 100)}%</div>
                <button type="button" onClick={() => setZoom((value) => Math.min(1.2, Math.round((value + 0.1) * 10) / 10))} className="flex h-full w-8 items-center justify-center text-[#73808D] hover:bg-[#F4F7F9]" aria-label="확대"><Plus className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          </div>

          <div className="border-b border-[#E0E7ED] bg-[#FBFCFD] px-4 py-2.5"><StatusLegend /></div>

          <div className="relative max-h-[760px] overflow-auto bg-[#ECF3F8] p-4 sm:p-5">
            <div style={{ width: canvasWidth * zoom, height: canvasHeight * zoom }}>
              <div className="origin-top-left" style={{ width: canvasWidth, minHeight: canvasHeight, transform: `scale(${zoom})` }}>
                <div className="relative overflow-hidden rounded-[22px] border-[5px] border-[#AEBECC] bg-[#DCE8F2] p-5 shadow-[0_18px_35px_rgba(70,93,117,.18)]">
                  <div className="absolute inset-0 opacity-[0.32]" style={{ backgroundImage: "linear-gradient(#C3D3E0 1px, transparent 1px), linear-gradient(90deg, #C3D3E0 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
                  <div className="relative z-10 grid grid-cols-[260px_1fr_240px] gap-4">
                    <div className="rounded-[17px] border border-[#C1D0DD] bg-[#F8FBFD]/95 p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-black text-[#2E3A46]">대표실</p>
                          <p className="mt-1 text-[7px] text-[#8794A0]">CEO ROOM</p>
                        </div>
                        <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#25313D] text-white"><BriefcaseBusiness className="h-4 w-4" /></div>
                      </div>
                      <div className="mt-4 flex items-end justify-between rounded-[13px] border border-[#D4DDE5] bg-[#EFF4F8] p-3">
                        <div>
                          <div className="h-6 w-20 rounded-[3px] border border-[#A9B7C4] bg-white shadow-[0_3px_0_#BBC5CE]" />
                          <div className="mx-auto h-5 w-8 rounded-b-[5px] bg-[#44505C]" />
                        </div>
                        <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-[#25313D] text-[8px] font-black text-white shadow-md">대표</div>
                      </div>
                      <div className="mt-3 rounded-[11px] border border-[#E0E6EB] bg-white p-3">
                        <p className="text-[7px] text-[#8B96A1]">대표 승인 대기</p>
                        <p className="mt-1 text-[18px] font-black text-[#2D3844]">{summary.pendingApprovals}</p>
                      </div>
                    </div>

                    <div className="rounded-[17px] border border-[#BFD2E2] bg-[#F4F9FD]/95 p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black text-[#31506B]">윤서진 비서실 · 중앙 관제</p>
                          <p className="mt-1 text-[7px] text-[#7E94A8]">업무 분석 → 배정 → 결과 취합 → 대표 보고</p>
                        </div>
                        <div className="rounded-full border border-[#C8DBEA] bg-white px-2.5 py-1 text-[7px] font-semibold text-[#527694]">SECRETARY HUB</div>
                      </div>

                      <div className="mt-4 flex items-center gap-4">
                        {secretary ? (
                          <PixelPerson employee={secretary} selected={selectedEmployee?.id === secretary.id} highlighted={highlightedEmployeeIds.has(secretary.id)} onClick={() => setSelectedEmployee(secretary)} />
                        ) : (
                          <div className="flex h-[82px] w-[78px] items-center justify-center rounded-[12px] border border-dashed border-[#BDD0E0] text-[8px] text-[#8FA1B1]">비서실</div>
                        )}
                        <div className="grid flex-1 grid-cols-3 gap-2">
                          <div className="rounded-[10px] border border-[#D5E2EC] bg-white p-2.5 text-center"><p className="text-[7px] text-[#8A98A4]">분석</p><p className="mt-1 text-[10px] font-bold text-[#4A647B]">업무 분해</p></div>
                          <div className="rounded-[10px] border border-[#D5E2EC] bg-white p-2.5 text-center"><p className="text-[7px] text-[#8A98A4]">취합</p><p className="mt-1 text-[10px] font-bold text-[#4A647B]">결과 묶음</p></div>
                          <div className="rounded-[10px] border border-[#D5E2EC] bg-white p-2.5 text-center"><p className="text-[7px] text-[#8A98A4]">보고</p><p className="mt-1 text-[10px] font-bold text-[#4A647B]">대표 전달</p></div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[17px] border border-[#C5D5E2] bg-[#F8FBFD]/95 p-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black text-[#334455]">결과 데스크</p>
                          <p className="mt-1 text-[7px] text-[#8795A2]">승인된 산출물 보관</p>
                        </div>
                        <FileText className="h-4 w-4 text-[#57748E]" />
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-2">
                        {["PDF", "XLSX", "IMG"].map((type) => <div key={type} className="flex h-14 items-center justify-center rounded-[9px] border border-[#D5E1EA] bg-white text-[7px] font-bold text-[#667887] shadow-[0_2px_0_#D5DEE6]">{type}</div>)}
                      </div>
                      <Link href="/results" className="mt-3 flex h-8 items-center justify-center rounded-[9px] bg-[#EAF3FA] text-[8px] font-semibold text-[#3E6F95]">결과함 열기</Link>
                    </div>
                  </div>

                  <div className="relative z-10 mt-4 grid gap-4" style={{ gridTemplateColumns: `repeat(${roomColumns}, minmax(0, 1fr))` }}>
                    {visibleDepartments.map((department) => (
                      <DepartmentRoom
                        key={department.id}
                        department={department}
                        selectedEmployeeId={selectedEmployee?.id ?? null}
                        highlightedEmployeeIds={highlightedEmployeeIds}
                        onSelectEmployee={setSelectedEmployee}
                      />
                    ))}
                  </div>

                  <div className="relative z-10 mt-4 rounded-[16px] border border-[#BDD0DE] bg-[#F8FBFD]/95 p-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[9px] font-bold text-[#40515F]">업무 이동 레일</p>
                        <p className="mt-1 text-[7px] text-[#8997A3]">선택한 workflow의 실제 담당자 순서를 따라 결과가 비서실과 대표실로 이동합니다.</p>
                      </div>
                      <Sparkles className="h-4 w-4 text-[#4F91D6]" />
                    </div>
                    <div className="mt-3">
                      {selectedWorkflow ? <WorkflowRail workflow={selectedWorkflow} compact /> : <p className="py-4 text-center text-[8px] text-[#9AA4AE]">진행 중 workflow가 없습니다.</p>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          {selectedEmployee ? <EmployeeDetail employee={selectedEmployee} onClose={() => setSelectedEmployee(null)} /> : (
            <div className="rounded-[18px] border border-[#D9E3ED] bg-white p-4 shadow-[0_12px_30px_rgba(53,72,92,.08)]">
              <div className="flex items-center gap-2"><Focus className="h-4 w-4 text-[#4B8ED7]" /><p className="text-[10px] font-bold text-[#384553]">오피스 사용법</p></div>
              <p className="mt-3 text-[8px] leading-4 text-[#7E8995]">직원은 업무가 없어도 자기 자리에 그대로 있습니다. 직원이나 workflow를 선택하면 현재 업무와 전달 흐름이 강조됩니다.</p>
              <div className="mt-3 rounded-[12px] bg-[#F4F8FB] p-3 text-[8px] leading-4 text-[#687583]">전체 회사 → 부서 → 직원 순서로 확대해서 보는 구조입니다. 90명이 넘어가도 한 화면에 정보를 억지로 다 펼치지 않습니다.</div>
            </div>
          )}

          <section className="rounded-[18px] border border-[#DDE4EA] bg-white p-4 shadow-[0_10px_28px_rgba(56,74,93,.06)]">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-[10px] font-bold text-[#394653]">진행 중 업무</p><p className="mt-1 text-[7px] text-[#8F9AA5]">클릭하면 관련 직원이 오피스에서 강조됩니다.</p></div>
              <BriefcaseBusiness className="h-4 w-4 text-[#64829D]" />
            </div>
            <div className="mt-3 space-y-2">
              {workflows.length ? workflows.slice(0, 8).map((workflow) => (
                <button key={workflow.id} type="button" onClick={() => setSelectedWorkflowId(workflow.id)} className={`w-full rounded-[11px] border p-3 text-left transition ${selectedWorkflowId === workflow.id ? "border-[#A7C9EF] bg-[#F0F7FF] shadow-[0_0_0_2px_rgba(77,148,232,.07)]" : "border-[#E4E9EE] bg-[#FCFDFE] hover:bg-[#F7F9FB]"}`}>
                  <div className="flex items-start justify-between gap-2"><p className="line-clamp-2 text-[8px] font-semibold leading-4 text-[#46525E]">{workflow.title}</p><span className="shrink-0 text-[7px] font-bold text-[#4384CC]">{Math.round(workflow.progress)}%</span></div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#E9EEF3]"><div className="h-full rounded-full bg-[#5A9CE4]" style={{ width: `${Math.max(3, Math.min(100, workflow.progress))}%` }} /></div>
                  <p className="mt-2 truncate text-[7px] text-[#8C97A2]">{workflow.currentStepTitle || "비서실에서 다음 단계를 정리 중"}</p>
                </button>
              )) : <p className="rounded-[11px] border border-dashed border-[#DDE4EA] py-5 text-center text-[8px] text-[#9BA5AF]">진행 중 업무가 없습니다.</p>}
            </div>
          </section>

          <section className="rounded-[18px] border border-[#DDE4EA] bg-white p-4 shadow-[0_10px_28px_rgba(56,74,93,.06)]">
            <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold text-[#394653]">최근 인수인계</p><p className="mt-1 text-[7px] text-[#8F9AA5]">직원이 다음 직원에게 넘긴 실제 handoff</p></div><Handshake className="h-4 w-4 text-[#438D70]" /></div>
            <div className="mt-3 space-y-2.5">
              {handoffs.length ? handoffs.slice(0, 7).map((handoff) => (
                <div key={handoff.id} className="rounded-[11px] border border-[#E4EAEF] bg-[#FCFDFE] p-3">
                  <div className="flex items-center gap-1.5 text-[8px] font-semibold text-[#46535F]"><span className="max-w-[90px] truncate">{handoff.fromEmployee}</span><ChevronRight className="h-3 w-3 shrink-0 text-[#9AA6B1]" /><span className="max-w-[90px] truncate">{handoff.toEmployee}</span></div>
                  <p className="mt-1.5 line-clamp-2 text-[7px] leading-3.5 text-[#7F8B96]">{handoff.title}</p>
                  <p className="mt-1.5 text-[6px] text-[#A0A9B2]">{formatTime(handoff.createdAt)}</p>
                </div>
              )) : <p className="rounded-[11px] border border-dashed border-[#DDE4EA] py-5 text-center text-[8px] text-[#9BA5AF]">최근 인수인계가 없습니다.</p>}
            </div>
          </section>

          <section className="rounded-[18px] border border-[#E2E6E9] bg-[#2B3540] p-4 text-white shadow-[0_12px_28px_rgba(33,45,57,.16)]">
            <div className="flex items-center gap-2"><CircleAlert className="h-4 w-4 text-[#9BC6F2]" /><p className="text-[10px] font-bold">대표가 보면 되는 것</p></div>
            <p className="mt-3 text-[8px] leading-4 text-[#CED7DF]">직원들의 세부 작업은 오피스가 보여주고, 대표에게는 승인·문제·최종 결과만 올라오게 유지합니다.</p>
            <div className="mt-3 grid grid-cols-2 gap-2"><Link href="/approvals" className="flex h-9 items-center justify-center rounded-[9px] bg-white/10 text-[8px] font-semibold hover:bg-white/15">승인함</Link><Link href="/results" className="flex h-9 items-center justify-center rounded-[9px] bg-white text-[8px] font-semibold text-[#2B3540]">결과함</Link></div>
          </section>
        </aside>
      </div>

      {selectedWorkflow ? (
        <section className="rounded-[20px] border border-[#DCE4EA] bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-[10px] font-bold text-[#394653]">선택 업무 전달 전체 흐름</p><p className="mt-1 text-[8px] text-[#8B97A3]">대표 지시부터 직원별 작업, 비서 취합, 대표 보고까지 한 줄로 확인합니다.</p></div>
            <Link href={`/tasks/${selectedWorkflow.rootTaskId}`} className="inline-flex h-8 items-center gap-1 rounded-[9px] border border-[#DDE5EB] px-2.5 text-[8px] font-semibold text-[#667582] hover:bg-[#F7F9FA]">업무 상세 <ChevronRight className="h-3 w-3" /></Link>
          </div>
          <div className="mt-4"><WorkflowRail workflow={selectedWorkflow} /></div>
        </section>
      ) : null}

      <style jsx global>{`
        @media (prefers-reduced-motion: no-preference) {
          .sawol-pixel-office-working {
            animation: sawolPixelWorking 2.2s steps(2, end) infinite;
          }
        }
        @keyframes sawolPixelWorking {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-1px); }
        }
      `}</style>
    </div>
  );
}
