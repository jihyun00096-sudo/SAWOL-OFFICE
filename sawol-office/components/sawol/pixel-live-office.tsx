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
  Maximize2,
  Minimize2,
  PanelRightOpen,
  Route,
  Minus,
  Monitor,
  Plus,
  Search,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";

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
  const columns = department.employees.length > 14 ? 6 : department.employees.length > 9 ? 5 : 4;

  return (
    <section className="relative min-h-[286px] overflow-hidden rounded-[12px] border-[2px] border-[#B8C8D6] bg-[#F9FCFE] shadow-[0_10px_22px_rgba(55,75,96,.09)]">
      <div className="absolute inset-0 opacity-[0.34]" style={{ backgroundImage: "linear-gradient(#DCE6EE 1px, transparent 1px), linear-gradient(90deg, #DCE6EE 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
      <div className="absolute inset-x-0 top-0 h-10 border-b border-[#BFD0DD] bg-[#EAF3FA]/95" />
      <div className="absolute left-1/2 top-[38px] h-[8px] w-16 -translate-x-1/2 rounded-b-[4px] border-x border-b border-[#AAB9C7] bg-[#D7E0E7]" />
      <div className="absolute right-3 top-[47px] flex items-center gap-1 rounded-[5px] border border-[#CBD7E1] bg-white/90 px-1.5 py-1 text-[6px] font-semibold text-[#7B8996]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#7EB7E7]" /> 출입문
      </div>

      <div className="relative z-10 flex h-10 items-center justify-between px-3.5">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-black text-[#314153]">{department.name}</p>
          <p className="mt-0.5 text-[6px] tracking-[0.08em] text-[#7E8D9C]">{department.code || department.departmentType}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${working > 0 ? "animate-pulse bg-[#4E99F5]" : "bg-[#BAC4CF]"}`} />
          <span className="text-[7px] font-semibold text-[#788796]">{working > 0 ? `${working} WORKING` : "IDLE"}</span>
        </div>
      </div>

      <div className="relative z-10 min-h-[214px] px-3 pb-2 pt-7">
        {department.employees.length ? (
          <div className="grid gap-x-1.5 gap-y-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
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
          <div className="flex min-h-[178px] items-center justify-center text-[8px] text-[#A0A9B3]">현재 배치된 직원이 없습니다.</div>
        )}
      </div>

      <div className="relative z-10 flex h-9 items-center justify-between border-t border-[#D6E1EB] bg-white/65 px-3">
        <div className="flex items-center gap-1.5 text-[6px] text-[#8995A2]">
          <Coffee className="h-3 w-3" /> {department.employees.length} seats · {working} active
        </div>
        <div className="scale-75 origin-right"><PixelPlant /></div>
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
  const [zoom, setZoom] = useState(0.82);
  const [selectedEmployee, setSelectedEmployee] = useState<PixelOfficeEmployee | null>(null);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(workflows[0]?.id ?? null);
  const [showOnlyActive, setShowOnlyActive] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [drawer, setDrawer] = useState<"employee" | "workflows" | "handoffs" | "approval" | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef({ active: false, x: 0, y: 0, left: 0, top: 0 });

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

  const departmentPairs = useMemo(() => {
    const pairs: Array<[PixelOfficeDepartment | null, PixelOfficeDepartment | null]> = [];
    for (let index = 0; index < visibleDepartments.length; index += 2) {
      pairs.push([visibleDepartments[index] ?? null, visibleDepartments[index + 1] ?? null]);
    }
    return pairs;
  }, [visibleDepartments]);

  const canvasWidth = 1440;
  const canvasHeight = 450 + Math.max(1, departmentPairs.length) * 330 + 260;

  function openEmployee(employee: PixelOfficeEmployee) {
    setSelectedEmployee(employee);
    setDrawer("employee");
  }

  function changeZoom(delta: number) {
    setZoom((value) => Math.max(0.55, Math.min(1.25, Math.round((value + delta) * 100) / 100)));
  }

  const statItems = [
    { label: "진행", value: summary.activeWorkflows, icon: BriefcaseBusiness },
    { label: "활동", value: summary.activeEmployees, icon: UsersRound },
    { label: "전체 직원", value: summary.totalEmployees, icon: Building2 },
    { label: "인수인계", value: summary.recentHandoffs, icon: Handshake },
    { label: "승인", value: summary.pendingApprovals, icon: FileCheck2 },
  ] satisfies Array<{ label: string; value: number; icon: LucideIcon }>;

  return (
    <div className={focusMode ? "fixed inset-0 z-[120] bg-[#EAF1F6]" : "mt-5"}>
      <section className={`relative overflow-hidden border border-[#D4DFE8] bg-[#EAF1F6] shadow-[0_18px_40px_rgba(37,58,80,.10)] ${focusMode ? "h-screen rounded-none" : "rounded-[22px]"}`}>
        <div className="flex min-h-[58px] flex-wrap items-center justify-between gap-3 border-b border-[#D8E2EA] bg-white px-4 py-2.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#263440] text-white"><Building2 className="h-4 w-4" /></div>
            <div className="min-w-0">
              <div className="flex items-center gap-2"><span className="h-2 w-2 animate-pulse rounded-full bg-[#4898E8]" /><p className="truncate text-[11px] font-black text-[#303E4B]">SAWOL LIVE OFFICE</p></div>
              <p className="mt-0.5 truncate text-[7px] text-[#8795A2]">실제 업무 데이터로 움직이는 90인 규모 가상 오피스 · 복도 / 부서 / 비서실 / 대표실</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {statItems.map(({ label, value, icon: Icon }) => (
              <button key={label} type="button" onClick={() => label === "승인" ? setDrawer("approval") : undefined} className="hidden h-8 items-center gap-1.5 rounded-[9px] border border-[#E1E7EC] bg-[#FAFCFD] px-2.5 text-[7px] text-[#73818E] lg:flex">
                <Icon className="h-3 w-3 text-[#5E8FBC]" /><span>{label}</span><b className="text-[#364653]">{value}</b>
              </button>
            ))}
            <button type="button" onClick={() => setShowOnlyActive((value) => !value)} className={`h-8 rounded-[9px] border px-2.5 text-[8px] font-semibold ${showOnlyActive ? "border-[#9CC9F2] bg-[#ECF6FF] text-[#3378B9]" : "border-[#DFE5EA] bg-white text-[#6F7D8A]"}`}>{showOnlyActive ? "전체 직원" : "활동만"}</button>
            <div className="flex h-8 overflow-hidden rounded-[9px] border border-[#DFE5EA] bg-white">
              <button type="button" onClick={() => changeZoom(-0.08)} className="flex w-8 items-center justify-center text-[#6E7D8A] hover:bg-[#F3F6F8]"><Minus className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => setZoom(0.82)} className="flex min-w-12 items-center justify-center border-x border-[#E5EAEE] px-2 text-[7px] font-bold text-[#5F6D7A]">{Math.round(zoom * 100)}%</button>
              <button type="button" onClick={() => changeZoom(0.08)} className="flex w-8 items-center justify-center text-[#6E7D8A] hover:bg-[#F3F6F8]"><Plus className="h-3.5 w-3.5" /></button>
            </div>
            <button type="button" onClick={() => setFocusMode((value) => !value)} className="flex h-8 items-center gap-1.5 rounded-[9px] bg-[#263440] px-3 text-[8px] font-semibold text-white hover:bg-[#1D2A34]">
              {focusMode ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}{focusMode ? "나가기" : "집중모드"}
            </button>
          </div>
        </div>

        <div className="relative border-b border-[#D7E1E8] bg-[#F9FBFC] px-4 py-2"><StatusLegend /></div>

        <div
          ref={scrollerRef}
          className={`relative select-none overflow-auto bg-[#DCE7EF] ${focusMode ? "h-[calc(100vh-97px)]" : "h-[760px]"}`}
          onPointerDown={(event) => {
            if ((event.target as HTMLElement).closest("button,a")) return;
            const element = scrollerRef.current;
            if (!element) return;
            dragRef.current = { active: true, x: event.clientX, y: event.clientY, left: element.scrollLeft, top: element.scrollTop };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!dragRef.current.active) return;
            const element = scrollerRef.current;
            if (!element) return;
            element.scrollLeft = dragRef.current.left - (event.clientX - dragRef.current.x);
            element.scrollTop = dragRef.current.top - (event.clientY - dragRef.current.y);
          }}
          onPointerUp={(event) => {
            dragRef.current.active = false;
            try { event.currentTarget.releasePointerCapture(event.pointerId); } catch {}
          }}
          onPointerCancel={() => { dragRef.current.active = false; }}
        >
          <div className="pointer-events-none sticky left-4 top-4 z-40 inline-flex rounded-full border border-white/80 bg-[#263440]/90 px-3 py-1.5 text-[7px] font-semibold text-white shadow-lg backdrop-blur">빈 공간을 드래그해서 이동 · 직원/업무 클릭 가능</div>

          <div className="relative p-6" style={{ width: canvasWidth * zoom + 48, height: canvasHeight * zoom + 48 }}>
            <div className="origin-top-left" style={{ width: canvasWidth, height: canvasHeight, transform: `scale(${zoom})` }}>
              <div className="relative h-full overflow-hidden rounded-[22px] border-[6px] border-[#A7B7C5] bg-[#C9D8E3] shadow-[0_22px_50px_rgba(45,65,83,.22)]">
                <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(#B7C8D5 1px, transparent 1px), linear-gradient(90deg, #B7C8D5 1px, transparent 1px)", backgroundSize: "28px 28px" }} />

                {/* ENTRANCE / LOBBY */}
                <div className="absolute left-1/2 top-0 z-20 h-[92px] w-[360px] -translate-x-1/2 rounded-b-[18px] border-x-2 border-b-2 border-[#AEBECA] bg-[#F7FAFC]/95 shadow-sm">
                  <div className="mx-auto mt-3 flex h-8 w-[210px] items-center justify-center rounded-[7px] bg-[#263440] text-[10px] font-black tracking-[0.13em] text-white">SAWOL OFFICE</div>
                  <div className="mt-2 flex items-center justify-center gap-3 text-[7px] font-semibold text-[#778692]"><span className="h-4 w-16 rounded-[3px] border border-[#B8C5CF] bg-[#DCE8F0]" /> MAIN ENTRANCE <span className="h-4 w-16 rounded-[3px] border border-[#B8C5CF] bg-[#DCE8F0]" /></div>
                </div>

                {/* EXECUTIVE FLOOR */}
                <div className="absolute left-8 right-8 top-[116px] z-10 grid grid-cols-[320px_1fr_270px] gap-5">
                  <div className="rounded-[14px] border-2 border-[#B6C5D1] bg-[#F9FBFD] p-4 shadow-sm">
                    <div className="flex items-center justify-between"><div><p className="text-[11px] font-black text-[#2E3B47]">대표실</p><p className="mt-1 text-[6px] tracking-[0.16em] text-[#83909B]">CEO ROOM</p></div><BriefcaseBusiness className="h-4 w-4 text-[#3C566A]" /></div>
                    <div className="mt-4 flex items-center justify-between rounded-[10px] border border-[#D7DFE6] bg-[#EEF3F7] p-3"><div><div className="h-7 w-24 rounded-[3px] border border-[#AEB9C3] bg-white shadow-[0_3px_0_#BBC5CD]" /><div className="mx-auto h-5 w-10 rounded-b bg-[#46525E]" /></div><div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#263440] text-[8px] font-black text-white">대표</div></div>
                    <button type="button" onClick={() => setDrawer("approval")} className="mt-3 flex w-full items-center justify-between rounded-[9px] border border-[#E2D8B7] bg-[#FFF9EA] px-3 py-2 text-[8px] font-semibold text-[#7F641C]"><span>대표 승인 대기</span><b>{summary.pendingApprovals}</b></button>
                  </div>

                  <div className="rounded-[14px] border-2 border-[#B4CADB] bg-[#F2F8FC] p-4 shadow-sm">
                    <div className="flex items-center justify-between"><div><p className="text-[11px] font-black text-[#31506A]">윤서진 비서실 · 중앙 관제</p><p className="mt-1 text-[7px] text-[#7890A3]">업무 분석 → 직원 배정 → 결과 취합 → 대표 보고</p></div><span className="rounded-full border border-[#C8D9E6] bg-white px-2.5 py-1 text-[6px] font-bold text-[#567893]">SECRETARY HUB</span></div>
                    <div className="mt-4 flex items-center gap-5">{secretary ? <PixelPerson employee={secretary} selected={selectedEmployee?.id === secretary.id} highlighted={highlightedEmployeeIds.has(secretary.id)} onClick={() => openEmployee(secretary)} /> : <div className="flex h-[80px] w-[80px] items-center justify-center rounded-[10px] border border-dashed border-[#BFD0DE] text-[8px] text-[#8CA0B1]">비서실</div>}<div className="grid flex-1 grid-cols-3 gap-2">{[["분석","업무 분해"],["취합","결과 묶음"],["보고","대표 전달"]].map(([a,b]) => <div key={a} className="rounded-[9px] border border-[#D7E2EB] bg-white p-2.5 text-center"><p className="text-[6px] text-[#8796A3]">{a}</p><p className="mt-1 text-[9px] font-bold text-[#45647C]">{b}</p></div>)}</div></div>
                  </div>

                  <div className="rounded-[14px] border-2 border-[#BCCBD6] bg-[#F9FBFD] p-4 shadow-sm">
                    <div className="flex items-center justify-between"><div><p className="text-[11px] font-black text-[#344653]">결과 데스크</p><p className="mt-1 text-[6px] text-[#82909C]">FINAL DELIVERY</p></div><FileText className="h-4 w-4 text-[#5A778D]" /></div>
                    <div className="mt-4 grid grid-cols-3 gap-2">{["PDF","XLSX","IMG"].map((type) => <div key={type} className="flex h-14 items-center justify-center rounded-[7px] border border-[#D6E0E8] bg-white text-[7px] font-black text-[#627585] shadow-[0_2px_0_#D7E0E7]">{type}</div>)}</div>
                    <Link href="/results" className="mt-3 flex h-8 items-center justify-center rounded-[8px] bg-[#E8F2F9] text-[8px] font-bold text-[#3C6B91]">결과함 열기</Link>
                  </div>
                </div>

                {/* MAIN CORRIDOR HEADER */}
                <div className="absolute left-8 right-8 top-[350px] z-10 flex h-[66px] items-center justify-between rounded-[10px] border-2 border-[#AEBECB] bg-[#E7EEF3] px-5 shadow-inner">
                  <div className="flex items-center gap-3"><Route className="h-4 w-4 text-[#55758F]" /><div><p className="text-[9px] font-black text-[#455867]">MAIN CORRIDOR</p><p className="mt-1 text-[6px] text-[#7E8E9A]">대표실 · 비서실 ↔ 각 부서 ↔ 회의 / 결과 공간</p></div></div><div className="flex items-center gap-3"><PixelPlant /><div className="h-7 w-24 rounded-[5px] border border-[#BCC8D1] bg-[#D6E1E8]" /><PixelPlant /></div>
                </div>

                {/* DEPARTMENT WINGS */}
                <div className="absolute left-8 right-8 top-[440px] z-10">
                  <div className="space-y-4">
                    {departmentPairs.map(([leftDepartment, rightDepartment], pairIndex) => (
                      <div key={`pair-${pairIndex}`} className="grid grid-cols-[1fr_118px_1fr] items-stretch gap-4">
                        {leftDepartment ? <DepartmentRoom department={leftDepartment} selectedEmployeeId={selectedEmployee?.id ?? null} highlightedEmployeeIds={highlightedEmployeeIds} onSelectEmployee={openEmployee} /> : <div />}
                        <div className="relative min-h-[286px] overflow-hidden rounded-[10px] border-x-2 border-[#AEBECB] bg-[#E6EDF2]">
                          <div className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 bg-[#C0CDD7]" />
                          <div className="absolute left-1/2 top-6 -translate-x-1/2 whitespace-nowrap rounded-full border border-[#C4D0D9] bg-white px-2 py-1 text-[6px] font-bold tracking-[0.12em] text-[#748592]">CORRIDOR {pairIndex + 1}</div>
                          <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-6"><PixelPlant /><div className="h-12 w-20 rounded-[6px] border border-[#B6C3CD] bg-[#CFD9E0] shadow-[0_3px_0_#B6C2CB]" /><PixelPlant /></div>
                          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-[6px] text-[#8998A4]">업무 이동 동선</div>
                        </div>
                        {rightDepartment ? <DepartmentRoom department={rightDepartment} selectedEmployeeId={selectedEmployee?.id ?? null} highlightedEmployeeIds={highlightedEmployeeIds} onSelectEmployee={openEmployee} /> : <div className="rounded-[12px] border-2 border-dashed border-[#B8C7D3] bg-white/35" />}
                      </div>
                    ))}
                  </div>
                </div>

                {/* SUPPORT ZONE */}
                <div className="absolute bottom-7 left-8 right-8 z-10 grid h-[190px] grid-cols-[1fr_1.3fr_1fr] gap-5">
                  <div className="rounded-[14px] border-2 border-[#B7C6D1] bg-[#F8FBFD] p-4"><p className="text-[10px] font-black text-[#3B4A56]">회의실</p><p className="mt-1 text-[6px] text-[#85939E]">COLLAB ROOM</p><div className="mt-6 flex justify-center"><div className="relative h-16 w-40 rounded-[10px] border border-[#AEBCC7] bg-[#D3DEE6] shadow-[0_4px_0_#B8C4CD]">{["-left-3 top-3","-right-3 top-3","left-8 -bottom-3","right-8 -bottom-3"].map((className, index) => <span key={index} className={`absolute h-8 w-7 rounded-[5px] border border-[#A4B1BB] bg-[#BFCCD5] ${className}`} />)}</div></div></div>
                  <div className="rounded-[14px] border-2 border-[#B4C7D5] bg-[#F3F8FC] p-4"><div className="flex items-center justify-between"><div><p className="text-[10px] font-black text-[#36566E]">업무 전달 라운지</p><p className="mt-1 text-[6px] text-[#7E93A4]">HANDOFF / SECRETARY COLLECTION</p></div><Handshake className="h-4 w-4 text-[#4D826D]" /></div><div className="mt-4">{selectedWorkflow ? <WorkflowRail workflow={selectedWorkflow} compact /> : <div className="flex h-20 items-center justify-center text-[8px] text-[#91A0AC]">진행 중 workflow가 없습니다.</div>}</div></div>
                  <div className="rounded-[14px] border-2 border-[#B7C6D1] bg-[#F8FBFD] p-4"><p className="text-[10px] font-black text-[#3B4A56]">휴게 / 탕비존</p><p className="mt-1 text-[6px] text-[#85939E]">BREAK AREA</p><div className="mt-5 flex items-center justify-center gap-5"><Coffee className="h-7 w-7 text-[#617D92]" /><div className="h-12 w-24 rounded-[8px] border border-[#B8C5CF] bg-[#D8E1E7] shadow-[0_3px_0_#BBC5CC]" /><PixelPlant /></div></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FLOATING CONTROLS */}
        <div className="absolute right-4 top-[112px] z-50 flex flex-col gap-2">
          <button type="button" onClick={() => setDrawer("workflows")} className="flex h-10 items-center gap-2 rounded-[11px] border border-[#D5E1EA] bg-white px-3 text-[8px] font-bold text-[#526473] shadow-lg hover:bg-[#F8FAFC]"><BriefcaseBusiness className="h-3.5 w-3.5 text-[#4B8FD0]" />업무 <span className="rounded-full bg-[#EAF4FD] px-1.5 py-0.5 text-[#3478B9]">{summary.activeWorkflows}</span></button>
          <button type="button" onClick={() => setDrawer("handoffs")} className="flex h-10 items-center gap-2 rounded-[11px] border border-[#D5E1EA] bg-white px-3 text-[8px] font-bold text-[#526473] shadow-lg hover:bg-[#F8FAFC]"><Handshake className="h-3.5 w-3.5 text-[#4B886F]" />전달 <span className="rounded-full bg-[#EDF8F3] px-1.5 py-0.5 text-[#33775D]">{summary.recentHandoffs}</span></button>
          <button type="button" onClick={() => setDrawer("approval")} className="flex h-10 items-center gap-2 rounded-[11px] border border-[#D5E1EA] bg-white px-3 text-[8px] font-bold text-[#526473] shadow-lg hover:bg-[#F8FAFC]"><FileCheck2 className="h-3.5 w-3.5 text-[#A77B23]" />승인 <span className="rounded-full bg-[#FFF6DF] px-1.5 py-0.5 text-[#8B671D]">{summary.pendingApprovals}</span></button>
        </div>

        {drawer ? (
          <div className="absolute inset-y-[58px] right-0 z-[70] w-[min(360px,92vw)] border-l border-[#D6E0E8] bg-white shadow-[-18px_0_40px_rgba(42,61,80,.15)]">
            <div className="flex h-12 items-center justify-between border-b border-[#E1E7EC] px-4"><div className="flex items-center gap-2"><PanelRightOpen className="h-4 w-4 text-[#4E89BF]" /><p className="text-[10px] font-black text-[#364450]">{drawer === "employee" ? "직원 상세" : drawer === "workflows" ? "진행 중 업무" : drawer === "handoffs" ? "최근 인수인계" : "대표 승인 대기"}</p></div><button type="button" onClick={() => setDrawer(null)} className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#E3E8ED] text-[#77838E] hover:bg-[#F5F7F9]"><X className="h-4 w-4" /></button></div>
            <div className={`overflow-auto p-4 ${focusMode ? "h-[calc(100vh-106px)]" : "max-h-[700px]"}`}>
              {drawer === "employee" && selectedEmployee ? <EmployeeDetail employee={selectedEmployee} onClose={() => { setSelectedEmployee(null); setDrawer(null); }} /> : null}
              {drawer === "workflows" ? <div className="space-y-2.5">{workflows.length ? workflows.map((workflow) => <button key={workflow.id} type="button" onClick={() => { setSelectedWorkflowId(workflow.id); setDrawer(null); }} className={`w-full rounded-[12px] border p-3 text-left ${selectedWorkflowId === workflow.id ? "border-[#9FC8F0] bg-[#EFF7FF]" : "border-[#E1E7EC] bg-[#FBFCFD]"}`}><div className="flex items-start justify-between gap-2"><p className="line-clamp-2 text-[8px] font-bold leading-4 text-[#43515E]">{workflow.title}</p><span className="shrink-0 text-[7px] font-black text-[#4384C4]">{Math.round(workflow.progress)}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#E8EDF1]"><div className="h-full rounded-full bg-[#5A9CE1]" style={{ width: `${Math.max(3, Math.min(100, workflow.progress))}%` }} /></div><p className="mt-2 truncate text-[7px] text-[#8995A0]">{workflow.currentStepTitle || "다음 단계 준비 중"}</p></button>) : <p className="py-10 text-center text-[8px] text-[#97A2AC]">진행 중 업무가 없습니다.</p>}</div> : null}
              {drawer === "handoffs" ? <div className="space-y-2.5">{handoffs.length ? handoffs.slice(0, 20).map((handoff) => <div key={handoff.id} className="rounded-[12px] border border-[#E1E8ED] bg-[#FBFDFE] p-3"><div className="flex items-center gap-1.5 text-[8px] font-bold text-[#44535F]"><span className="max-w-[110px] truncate">{handoff.fromEmployee}</span><ChevronRight className="h-3 w-3 text-[#94A0AA]" /><span className="max-w-[110px] truncate">{handoff.toEmployee}</span></div><p className="mt-2 text-[7px] leading-4 text-[#7A8792]">{handoff.title}</p><p className="mt-2 text-[6px] text-[#9CA6AE]">{formatTime(handoff.createdAt)}</p></div>) : <p className="py-10 text-center text-[8px] text-[#97A2AC]">최근 인수인계가 없습니다.</p>}</div> : null}
              {drawer === "approval" ? <div><div className="rounded-[14px] border border-[#E7DCB9] bg-[#FFF9EA] p-4"><p className="text-[8px] font-semibold text-[#8C6B22]">대표가 확인할 업무</p><p className="mt-2 text-[28px] font-black text-[#394551]">{summary.pendingApprovals}</p><p className="mt-2 text-[7px] leading-4 text-[#81765D]">직원들의 세부 진행은 비서실이 관리하고, 대표에게는 승인·문제·최종 결과만 올라오는 구조를 유지합니다.</p></div><div className="mt-3 grid grid-cols-2 gap-2"><Link href="/approvals" className="flex h-10 items-center justify-center rounded-[10px] bg-[#263440] text-[8px] font-bold text-white">승인함</Link><Link href="/results" className="flex h-10 items-center justify-center rounded-[10px] border border-[#DDE4E9] bg-white text-[8px] font-bold text-[#4D5C68]">결과함</Link></div></div> : null}
            </div>
          </div>
        ) : null}
      </section>

      {!focusMode && selectedWorkflow ? (
        <section className="mt-4 rounded-[18px] border border-[#DCE4EA] bg-white p-4">
          <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black text-[#394653]">선택 업무 전달 흐름</p><p className="mt-1 text-[7px] text-[#8A96A1]">대표 지시 → 직원 협업 → 비서 취합 → 대표 보고</p></div><Link href={`/tasks/${selectedWorkflow.rootTaskId}`} className="flex h-8 items-center gap-1 rounded-[9px] border border-[#DEE5EA] px-2.5 text-[8px] font-semibold text-[#667582]">업무 상세 <ChevronRight className="h-3 w-3" /></Link></div>
          <div className="mt-3"><WorkflowRail workflow={selectedWorkflow} /></div>
        </section>
      ) : null}
    </div>
  );
}
