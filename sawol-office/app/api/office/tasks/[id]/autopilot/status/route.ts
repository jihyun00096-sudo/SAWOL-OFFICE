import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STALE_MS = 4 * 60 * 1000;

async function requireAdmin(supabase: any) {
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;
  if (claimsError || !userId) return false;

  const { data: admin, error: adminError } = await supabase
    .from("app_admins")
    .select("user_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  return !adminError && Boolean(admin);
}

function stale(job: any) {
  if (!job || job.status !== "RUNNING") return false;
  const point = job.heartbeat_at || job.updated_at || job.started_at;
  if (!point) return true;
  return Date.now() - new Date(point).getTime() > STALE_MS;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  if (!(await requireAdmin(supabase))) {
    return NextResponse.json({ ok: false, message: "권한이 없습니다." }, { status: 403 });
  }

  const [{ data: root }, { data: job }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, status, execution_mode, workflow_id, assigned_employee_id, employees:assigned_employee_id(name, employee_code)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("task_autopilot_jobs")
      .select("*")
      .eq("task_id", id)
      .maybeSingle(),
  ]);

  if (!root) {
    return NextResponse.json({ ok: false, message: "업무를 찾을 수 없습니다." }, { status: 404 });
  }

  let steps: any[] = [];
  let workflow: any = null;

  if (root.workflow_id) {
    const [{ data: workflowRow }, { data: childRows }] = await Promise.all([
      supabase
        .from("task_workflows")
        .select("id, workflow_code, status, total_steps, completed_steps")
        .eq("id", root.workflow_id)
        .maybeSingle(),
      supabase
        .from("tasks")
        .select("id, title, status, workflow_step_no, workflow_step_key, assigned_employee_id, employees:assigned_employee_id(name, employee_code)")
        .eq("workflow_id", root.workflow_id)
        .eq("is_workflow_root", false)
        .order("workflow_step_no"),
    ]);
    workflow = workflowRow ?? null;
    steps = childRows ?? [];
  }

  const completed = steps.filter((step) => step.status === "COMPLETED").length;
  const current =
    steps.find((step) => ["IN_PROGRESS", "REVIEW", "ERROR", "ON_HOLD"].includes(step.status)) ??
    steps.find((step) => step.status === "WAITING") ??
    null;

  const computedProgress = steps.length
    ? Math.round((completed / steps.length) * 100)
    : root.status === "PENDING_APPROVAL" || root.status === "COMPLETED"
      ? 100
      : job?.progress ?? 0;

  return NextResponse.json({
    ok: true,
    root: {
      id: root.id,
      title: root.title,
      status: root.status,
      execution_mode: root.execution_mode,
      employee: (root as any).employees ?? null,
    },
    job: job
      ? {
          id: job.id,
          status: job.status,
          progress: Math.max(job.progress ?? 0, computedProgress),
          current_step_title: job.current_step_title,
          last_message: job.last_message,
          last_error: job.last_error,
          attempt_count: job.attempt_count,
          started_at: job.started_at,
          heartbeat_at: job.heartbeat_at,
          finished_at: job.finished_at,
          stale: stale(job),
        }
      : null,
    workflow: workflow
      ? {
          code: workflow.workflow_code,
          status: workflow.status,
          total: steps.length || workflow.total_steps || 0,
          completed,
          current: current
            ? {
                id: current.id,
                title: current.title,
                status: current.status,
                step_no: current.workflow_step_no,
                employee: current.employees?.name ?? null,
                employee_code: current.employees?.employee_code ?? null,
              }
            : null,
          steps: steps.map((step) => ({
            id: step.id,
            title: step.title,
            status: step.status,
            step_no: step.workflow_step_no,
            employee: step.employees?.name ?? null,
            employee_code: step.employees?.employee_code ?? null,
          })),
        }
      : null,
    server_time: new Date().toISOString(),
  });
}
