import Link from "next/link";
import { EmptyState } from "@/components/sawol/empty-state";
import { OfficeShell } from "@/components/sawol/office-shell";
import { PageHeader } from "@/components/sawol/page-header";
import { ProjectCreateForm } from "@/components/sawol/project-create-form";
import { StatusBadge } from "@/components/sawol/status-badge";
import { priorityLabel, projectStatusLabel, labelOf } from "@/lib/sawol/labels";
import { requireSawolAdmin } from "@/lib/auth/require-sawol-admin";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const { supabase } = await requireSawolAdmin();
  const [{ data: projects }, { count: pendingApprovals }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, project_code, name, status, priority, progress, current_stage, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("approvals").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
  ]);

  return (
    <OfficeShell pendingApprovals={pendingApprovals ?? 0}>
      <PageHeader
        eyebrow="PROJECTS"
        title="프로젝트"
        description="아이디어부터 완료까지 장기 업무를 프로젝트 단위로 관리합니다."
        action={<ProjectCreateForm />}
      />

      <div className="mt-7">
        {!projects?.length ? (
          <EmptyState title="아직 프로젝트가 없습니다." description="새 프로젝트 버튼으로 첫 프로젝트를 생성해보세요." />
        ) : (
          <div className="grid gap-3">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="rounded-[18px] border border-[#E7E9EE] bg-white p-5 transition hover:border-[#D6DAE2] hover:shadow-[0_8px_24px_rgba(25,33,48,0.035)]"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge value={project.status} label={labelOf(projectStatusLabel, project.status)} />
                      <StatusBadge value={project.priority} label={labelOf(priorityLabel, project.priority)} />
                    </div>
                    <h2 className="mt-3 truncate text-[15px] font-semibold">{project.name}</h2>
                    <p className="mt-1 text-[10px] text-[#9A9FAA]">{project.project_code} · {project.current_stage ?? "단계 미설정"}</p>
                  </div>

                  <div className="w-full sm:w-[220px]">
                    <div className="flex items-center justify-between text-[10px] text-[#8C929D]">
                      <span>진행률</span><span>{project.progress}%</span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-[#ECEEF2]">
                      <div className="h-full rounded-full bg-[#3157D5]" style={{ width: `${project.progress}%` }} />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </OfficeShell>
  );
}
