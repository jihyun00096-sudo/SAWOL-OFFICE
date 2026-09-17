import { LiveOfficeRefresh } from "@/components/sawol/live-office-refresh";
import {
  PixelLiveOffice,
  type PixelOfficeDepartment,
  type PixelOfficeEmployee,
  type PixelOfficeHandoff,
  type PixelOfficeWorkflow,
} from "@/components/sawol/pixel-live-office";
import { OfficeShell } from "@/components/sawol/office-shell";
import { PageHeader } from "@/components/sawol/page-header";
import { requireSawolAdmin } from "@/lib/auth/require-sawol-admin";

export const dynamic = "force-dynamic";

type DepartmentRow = {
  id: string;
  code: string | null;
  name: string;
  department_type: string;
  sort_order: number | null;
};

type EmployeeRow = {
  id: string;
  employee_code: string;
  name: string;
  position: string | null;
  status: string;
  specialty: string | null;
  department_id: string | null;
  current_task_id: string | null;
};

type TaskRow = {
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

type JobRow = {
  task_id: string;
  status: string;
  progress: number | null;
  current_step_title: string | null;
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

const CLOSED = new Set(["COMPLETED", "CANCELLED", "CANCELED"]);

function clampProgress(value: unknown) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
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
      .in("department_type", ["HEADQUARTERS", "DEPARTMENT", "LAB", "TEAM"])
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
      .limit(500),
    supabase
      .from("task_autopilot_jobs")
      .select("task_id,status,progress,current_step_title,updated_at")
      .in("status", ["QUEUED", "RUNNING", "AWAITING_APPROVAL", "PAUSED", "FAILED"])
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase
      .from("task_handoffs")
      .select("id,from_task_id,to_task_id,title,summary,status,created_at")
      .order("created_at", { ascending: false })
      .limit(120),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING_APPROVAL"),
  ]);

  const departmentRows = (departments ?? []) as DepartmentRow[];
  const employeeRows = (employees ?? []) as EmployeeRow[];
  const taskRows = (tasks ?? []) as TaskRow[];
  const jobRows = (jobs ?? []) as JobRow[];
  const handoffRows = (handoffs ?? []) as HandoffRow[];

  const taskById = new Map(taskRows.map((task) => [task.id, task]));
  const employeeById = new Map(employeeRows.map((employee) => [employee.id, employee]));
  const departmentById = new Map(departmentRows.map((department) => [department.id, department]));
  const latestJobByTask = new Map<string, JobRow>();

  for (const job of jobRows) {
    if (!latestJobByTask.has(job.task_id)) latestJobByTask.set(job.task_id, job);
  }

  const activeTaskByEmployee = new Map<string, TaskRow>();
  for (const task of taskRows) {
    if (!task.assigned_employee_id || CLOSED.has(task.status)) continue;
    if (!activeTaskByEmployee.has(task.assigned_employee_id)) {
      activeTaskByEmployee.set(task.assigned_employee_id, task);
    }
  }

  const mappedEmployees: PixelOfficeEmployee[] = employeeRows.map((employee) => {
    const currentTask = activeTaskByEmployee.get(employee.id) ?? (employee.current_task_id ? taskById.get(employee.current_task_id) : null) ?? null;
    const department = employee.department_id ? departmentById.get(employee.department_id) : null;

    return {
      id: employee.id,
      employeeCode: employee.employee_code,
      name: employee.name,
      position: employee.position,
      specialty: employee.specialty,
      status: employee.status,
      departmentId: employee.department_id,
      departmentName: department?.name ?? "미배정",
      currentTaskId: currentTask?.id ?? null,
      currentTaskTitle: currentTask?.title ?? null,
      currentTaskStatus: currentTask?.status ?? null,
      currentWorkflowId: currentTask?.workflow_id ?? null,
      currentWorkflowStep: currentTask?.workflow_step_no ?? null,
      updatedAt: currentTask?.updated_at ?? null,
    };
  });

  const employeesByDepartment = new Map<string, PixelOfficeEmployee[]>();
  for (const employee of mappedEmployees) {
    // 윤서진 비서는 중앙 관제(비서실)에 별도로 표시하므로 부서 좌석에 중복 배치하지 않습니다.
    if (employee.employeeCode === "EXEC-001") continue;

    const key = employee.departmentId ?? "__unassigned__";
    const list = employeesByDepartment.get(key) ?? [];
    list.push(employee);
    employeesByDepartment.set(key, list);
  }

  const mappedDepartments: PixelOfficeDepartment[] = departmentRows.map((department) => ({
    id: department.id,
    code: department.code,
    name: department.name,
    departmentType: department.department_type,
    sortOrder: department.sort_order ?? 999,
    employees: employeesByDepartment.get(department.id) ?? [],
  }));

  const unassigned = employeesByDepartment.get("__unassigned__") ?? [];
  if (unassigned.length) {
    mappedDepartments.push({
      id: "__unassigned__",
      code: null,
      name: "공용 업무존",
      departmentType: "TEAM",
      sortOrder: 9999,
      employees: unassigned,
    });
  }

  const rootTasks = taskRows.filter((task) => !task.parent_task_id);
  const childrenByRoot = new Map<string, TaskRow[]>();

  for (const task of taskRows) {
    if (!task.parent_task_id) continue;
    const list = childrenByRoot.get(task.parent_task_id) ?? [];
    list.push(task);
    childrenByRoot.set(task.parent_task_id, list);
  }

  const workflows: PixelOfficeWorkflow[] = rootTasks
    .map((root) => {
      const children = (childrenByRoot.get(root.id) ?? []).sort(
        (a, b) => (a.workflow_step_no ?? 999) - (b.workflow_step_no ?? 999),
      );
      const job = latestJobByTask.get(root.id) ?? null;
      const isActive = !CLOSED.has(root.status) || children.some((child) => !CLOSED.has(child.status)) || Boolean(job);
      if (!isActive) return null;

      const completed = children.filter((child) => child.status === "COMPLETED").length;
      const fallbackProgress = children.length ? (completed / children.length) * 100 : CLOSED.has(root.status) ? 100 : 0;
      const currentChild = children.find((child) => child.status !== "COMPLETED") ?? children[children.length - 1] ?? null;

      return {
        id: root.workflow_id ?? root.id,
        rootTaskId: root.id,
        taskCode: root.task_code,
        title: root.title,
        status: root.status,
        executionMode: root.execution_mode,
        progress: job ? clampProgress(job.progress) : fallbackProgress,
        currentStepTitle: job?.current_step_title ?? currentChild?.title ?? null,
        updatedAt: job?.updated_at ?? root.updated_at,
        steps: children.map((child, index) => {
          const employee = child.assigned_employee_id ? employeeById.get(child.assigned_employee_id) : null;
          const department = child.assigned_department_id ? departmentById.get(child.assigned_department_id) : employee?.department_id ? departmentById.get(employee.department_id) : null;
          return {
            id: child.id,
            stepNo: child.workflow_step_no ?? index + 1,
            stepKey: child.workflow_step_key,
            title: child.title,
            status: child.status,
            employeeId: child.assigned_employee_id,
            employeeName: employee?.name ?? null,
            departmentName: department?.name ?? null,
            updatedAt: child.updated_at,
          };
        }),
      } satisfies PixelOfficeWorkflow;
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b!.updatedAt).getTime() - new Date(a!.updatedAt).getTime())
    .slice(0, 18) as PixelOfficeWorkflow[];

  const mappedHandoffs: PixelOfficeHandoff[] = handoffRows
    .map((handoff) => {
      const fromTask = taskById.get(handoff.from_task_id);
      const toTask = taskById.get(handoff.to_task_id);
      const fromEmployee = fromTask?.assigned_employee_id ? employeeById.get(fromTask.assigned_employee_id) : null;
      const toEmployee = toTask?.assigned_employee_id ? employeeById.get(toTask.assigned_employee_id) : null;
      if (!fromEmployee && !toEmployee) return null;
      return {
        id: handoff.id,
        fromEmployee: fromEmployee?.name ?? "비서실",
        toEmployee: toEmployee?.name ?? "비서실",
        title: handoff.title,
        summary: handoff.summary,
        createdAt: handoff.created_at,
      } satisfies PixelOfficeHandoff;
    })
    .filter(Boolean)
    .slice(0, 30) as PixelOfficeHandoff[];

  const activeEmployees = mappedEmployees.filter((employee) => {
    if (["WORKING", "REVIEWING", "APPROVAL_WAIT", "BLOCKED"].includes(employee.status)) return true;
    return Boolean(employee.currentTaskId && employee.currentTaskStatus && !CLOSED.has(employee.currentTaskStatus));
  }).length;

  const secretary = mappedEmployees.find((employee) => employee.employeeCode === "EXEC-001") ?? null;

  return (
    <OfficeShell pendingApprovals={pendingApprovals ?? 0}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          eyebrow="LIVE OFFICE"
          title="SAWOL LIVE OFFICE"
          description="90명의 AI 직원이 각 부서 자리에서 대기하고, 업무가 생기면 직원 간 인수인계와 비서실 취합을 거쳐 대표에게 보고되는 흐름을 시각적으로 확인합니다."
        />
        <LiveOfficeRefresh seconds={10} />
      </div>

      <PixelLiveOffice
        departments={mappedDepartments}
        workflows={workflows}
        handoffs={mappedHandoffs}
        secretary={secretary}
        summary={{
          pendingApprovals: pendingApprovals ?? 0,
          activeWorkflows: workflows.length,
          activeEmployees,
          totalEmployees: mappedEmployees.length,
          recentHandoffs: mappedHandoffs.length,
        }}
      />
    </OfficeShell>
  );
}
