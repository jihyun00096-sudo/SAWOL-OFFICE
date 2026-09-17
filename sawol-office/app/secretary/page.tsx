import Link from "next/link";
import { OfficeShell } from "@/components/sawol/office-shell";
import { PageHeader } from "@/components/sawol/page-header";
import { requireSawolAdmin } from "@/lib/auth/require-sawol-admin";
import { SecretaryControlCenter } from "@/components/sawol/secretary-control-center";

export const dynamic = "force-dynamic";

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

export default async function SecretaryPage() {
  const { supabase } = await requireSawolAdmin();

  const [
    { data: rootTasks },
    { data: workflowTasks },
    { data: jobs },
    { data: handoffs },
    { data: feedback },
    { data: approvals },
    { data: employees },
    { data: departments },
    { count: pendingApprovals },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("id,task_code,title,status,priority,execution_mode,assigned_employee_id,project_id,created_at,updated_at")
      .is("parent_task_id", null)
      .order("updated_at", { ascending: false })
      .limit(80),
    supabase
      .from("tasks")
      .select("id,parent_task_id,workflow_step_no,workflow_step_key,title,status,assigned_employee_id,updated_at")
      .not("parent_task_id", "is", null)
      .order("workflow_step_no", { ascending: true })
      .limit(240),
    supabase
      .from("task_autopilot_jobs")
      .select("task_id,status,progress,current_step_title,last_message,last_error,updated_at")
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase
      .from("task_handoffs")
      .select("id,from_task_id,to_task_id,title,summary,status,created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("task_feedback")
      .select("root_task_id,reason,status,created_at")
      .eq("status", "ACTIVE")
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("approvals")
      .select("id,task_id,title,status,requested_at")
      .order("requested_at", { ascending: false })
      .limit(80),
    supabase
      .from("employees")
      .select("id,name,employee_code,position,department_id")
      .eq("is_active", true)
      .order("employee_code"),
    supabase
      .from("departments")
      .select("id,name")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("approvals")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING"),
  ]);

  return (
    <OfficeShell pendingApprovals={pendingApprovals ?? 0}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <PageHeader
            eyebrow="SECRETARY OFFICE"
            title="윤서진 비서실"
            description="대표의 지시를 접수한 뒤 직원 배정·협업·인수인계·결과 취합·대표 보고까지 흐름을 한곳에서 관리합니다."
          />

          <div className="flex flex-wrap gap-2">
            <Link
              href="/command"
              className="flex h-10 items-center rounded-[11px] bg-[#17181C] px-4 text-[10px] font-semibold text-white"
            >
              + 새 업무 지시
            </Link>
            <Link
              href="/office"
              className="flex h-10 items-center rounded-[11px] border border-[#DDE3E8] bg-white px-4 text-[10px] font-semibold text-[#56636E]"
            >
              라이브 오피스 보기
            </Link>
          </div>
        </div>

        <SecretaryControlCenter
          rootTasks={(rootTasks ?? []) as RootTask[]}
          workflowTasks={(workflowTasks ?? []) as WorkflowTask[]}
          jobs={(jobs ?? []) as JobRow[]}
          handoffs={(handoffs ?? []) as HandoffRow[]}
          feedback={(feedback ?? []) as FeedbackRow[]}
          approvals={(approvals ?? []) as ApprovalRow[]}
          employees={(employees ?? []) as EmployeeRow[]}
          departments={(departments ?? []) as DepartmentRow[]}
        />
      </div>
    </OfficeShell>
  );
}
