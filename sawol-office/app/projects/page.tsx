import { EmptyState } from "@/components/sawol/empty-state";
import { OfficeShell } from "@/components/sawol/office-shell";
import { PageHeader } from "@/components/sawol/page-header";
import { ProjectBrowser } from "@/components/sawol/project-browser";
import { ProjectCreateForm } from "@/components/sawol/project-create-form";
import { requireSawolAdmin } from "@/lib/auth/require-sawol-admin";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const { supabase } = await requireSawolAdmin();

  const [{ data: projects }, { count: pendingApprovals }] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "id, project_code, name, status, priority, progress, current_stage, created_at",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("approvals")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING"),
  ]);

  return (
    <OfficeShell pendingApprovals={pendingApprovals ?? 0}>
      <PageHeader
        eyebrow="PROJECTS"
        title="프로젝트"
        description="아이디어부터 완료까지 장기 업무를 프로젝트 단위로 관리합니다."
        action={<ProjectCreateForm />}
      />

      {!projects?.length ? (
        <div className="mt-7">
          <EmptyState
            title="아직 프로젝트가 없습니다."
            description="새 프로젝트 버튼으로 첫 프로젝트를 생성해보세요."
          />
        </div>
      ) : (
        <ProjectBrowser projects={projects as any} />
      )}
    </OfficeShell>
  );
}
