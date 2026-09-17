import { EmptyState } from "@/components/sawol/empty-state";
import { OfficeShell } from "@/components/sawol/office-shell";
import { PageHeader } from "@/components/sawol/page-header";
import { ProjectBrowser } from "@/components/sawol/project-browser";
import { ProjectCreateForm } from "@/components/sawol/project-create-form";
import { requireSawolAdmin } from "@/lib/auth/require-sawol-admin";

export const dynamic = "force-dynamic";

function taskProgress(status: string) {
  if (status === "COMPLETED") return 100;
  if (["APPROVAL_WAIT", "PENDING_APPROVAL"].includes(status)) return 92;
  if (status === "IN_REVIEW") return 82;
  if (status === "REVISION_REQUESTED") return 68;
  if (["IN_PROGRESS", "COLLABORATING"].includes(status)) return 52;
  if (["WAITING_FOR_DATA", "ON_HOLD", "ERROR"].includes(status)) return 28;
  if (["CANCELLED", "CANCELED"].includes(status)) return 0;
  return 10;
}

export default async function ProjectsPage() {
  const { supabase } = await requireSawolAdmin();

  const [
    { data: projects },
    { data: rootTasks },
    { data: results },
    { data: approvals },
    { count: pendingApprovals },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id, project_code, name, status, priority, progress, current_stage, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("tasks")
      .select("id,project_id,status")
      .is("parent_task_id", null)
      .not("project_id", "is", null),
    supabase.from("results").select("id,project_id").not("project_id", "is", null),
    supabase.from("approvals").select("id,project_id,status").not("project_id", "is", null),
    supabase.from("approvals").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
  ]);

  const enriched = (projects ?? []).map((project: any) => {
    const tasks = (rootTasks ?? []).filter((task: any) => task.project_id === project.id);
    const completed = tasks.filter((task: any) => task.status === "COMPLETED").length;
    const active = tasks.filter((task: any) => ["IN_PROGRESS", "COLLABORATING", "IN_REVIEW", "APPROVAL_WAIT", "PENDING_APPROVAL", "REVISION_REQUESTED"].includes(task.status)).length;
    const attention = tasks.filter((task: any) => ["ERROR", "ON_HOLD", "WAITING_FOR_DATA", "REVISION_REQUESTED"].includes(task.status)).length;
    const liveProgress = tasks.length
      ? Math.round(tasks.reduce((sum: number, task: any) => sum + taskProgress(task.status), 0) / tasks.length)
      : project.progress ?? 0;

    return {
      ...project,
      live_progress: liveProgress,
      task_count: tasks.length,
      active_count: active,
      completed_count: completed,
      attention_count: attention,
      result_count: (results ?? []).filter((row: any) => row.project_id === project.id).length,
      approval_count: (approvals ?? []).filter((row: any) => row.project_id === project.id && row.status === "PENDING").length,
    };
  });

  return (
    <OfficeShell pendingApprovals={pendingApprovals ?? 0}>
      <PageHeader
        eyebrow="PROJECTS"
        title="프로젝트"
        description="아이디어부터 업무·협업·결과·승인까지 프로젝트 단위로 관리합니다."
        action={<ProjectCreateForm />}
      />

      {!enriched.length ? (
        <div className="mt-7">
          <EmptyState title="아직 프로젝트가 없습니다." description="새 프로젝트 버튼으로 첫 프로젝트를 생성해보세요." />
        </div>
      ) : (
        <ProjectBrowser projects={enriched as any} />
      )}
    </OfficeShell>
  );
}
