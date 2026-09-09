import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailSection } from "@/components/sawol/detail-section";
import { EmptyState } from "@/components/sawol/empty-state";
import { OfficeShell } from "@/components/sawol/office-shell";
import { PageHeader } from "@/components/sawol/page-header";
import { ProjectDeleteButton } from "@/components/sawol/project-delete-button";
import { ProjectEditForm } from "@/components/sawol/project-edit-form";
import { StatusBadge } from "@/components/sawol/status-badge";
import {
  labelOf,
  priorityLabel,
  projectStatusLabel,
  resultTypeLabel,
  taskStatusLabel,
} from "@/lib/sawol/labels";
import { requireSawolAdmin } from "@/lib/auth/require-sawol-admin";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireSawolAdmin();

  const [
    { data: project },
    { data: tasks },
    { data: results },
    { data: approvals },
    { count: pendingApprovals },
  ] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("tasks")
      .select(
        "id, task_code, title, status, priority, task_type, created_at",
      )
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("results")
      .select(
        "id, result_code, title, result_type, status, version, created_at",
      )
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("approvals")
      .select("id, title, status, approval_type, requested_at")
      .eq("project_id", id)
      .order("requested_at", { ascending: false }),
    supabase
      .from("approvals")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING"),
  ]);

  if (!project) notFound();

  return (
    <OfficeShell pendingApprovals={pendingApprovals ?? 0}>
      <PageHeader
        eyebrow={project.project_code}
        title={project.name}
        description={project.objective ?? project.original_request}
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Link
              href="/projects"
              className="flex h-10 items-center justify-center rounded-[10px] border border-[#E1E4E9] bg-white px-4 text-[11px] font-semibold text-[#656B75]"
            >
              목록으로
            </Link>
            <ProjectDeleteButton
              projectId={project.id}
              projectName={project.name}
            />
          </div>
        }
      />

      <section className="mt-6 grid grid-cols-1 gap-3 min-[430px]:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[16px] border border-[#E7E9EE] bg-white p-4">
          <p className="text-[10px] text-[#9297A1]">상태</p>
          <div className="mt-2">
            <StatusBadge
              value={project.status}
              label={labelOf(projectStatusLabel, project.status)}
            />
          </div>
        </div>

        <div className="rounded-[16px] border border-[#E7E9EE] bg-white p-4">
          <p className="text-[10px] text-[#9297A1]">우선순위</p>
          <div className="mt-2">
            <StatusBadge
              value={project.priority}
              label={labelOf(priorityLabel, project.priority)}
            />
          </div>
        </div>

        <div className="rounded-[16px] border border-[#E7E9EE] bg-white p-4">
          <p className="text-[10px] text-[#9297A1]">진행률</p>
          <p className="mt-2 text-[20px] font-bold">{project.progress}%</p>
        </div>

        <div className="rounded-[16px] border border-[#E7E9EE] bg-white p-4">
          <p className="text-[10px] text-[#9297A1]">현재 단계</p>
          <p className="mt-2 break-words text-[12px] font-medium">
            {project.current_stage ?? "-"}
          </p>
        </div>
      </section>

      <div className="mt-5">
        <DetailSection
          title="프로젝트 관리"
          description="프로젝트 정의, 상태, 진행률과 운영 단계를 직접 수정합니다."
        >
          <ProjectEditForm project={project as any} />
        </DetailSection>
      </div>

      <section className="mt-7">
        <h2 className="text-[14px] font-semibold">관련 업무</h2>
        <div className="mt-3 space-y-2">
          {!tasks?.length ? (
            <EmptyState
              title="관련 업무가 없습니다."
              description="업무 상세에서 이 프로젝트를 연결할 수 있습니다."
            />
          ) : (
            tasks.map((task) => (
              <Link
                href={`/tasks/${task.id}`}
                key={task.id}
                className="block rounded-[15px] border border-[#E7E9EE] bg-white p-4 transition hover:border-[#D7DBE3]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge
                    value={task.status}
                    label={labelOf(taskStatusLabel, task.status)}
                  />
                  <span className="text-[10px] text-[#999EA7]">
                    {task.task_type}
                  </span>
                </div>
                <p className="mt-2 break-words text-[13px] font-medium">
                  {task.title}
                </p>
              </Link>
            ))
          )}
        </div>
      </section>

      <section className="mt-7 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-[14px] font-semibold">결과물</h2>
          <div className="mt-3 space-y-2">
            {!results?.length ? (
              <EmptyState
                title="아직 결과물이 없습니다."
                description="직원이 작업을 완료하면 결과가 이곳에 모입니다."
              />
            ) : (
              results.map((result) => (
                <Link
                  href={`/results/${result.id}`}
                  key={result.id}
                  className="block rounded-[15px] border border-[#E7E9EE] bg-white p-4 transition hover:border-[#D7DBE3]"
                >
                  <p className="text-[10px] text-[#9297A1]">
                    {labelOf(resultTypeLabel, result.result_type)} · v
                    {result.version}
                  </p>
                  <p className="mt-2 break-words text-[13px] font-medium">
                    {result.title}
                  </p>
                </Link>
              ))
            )}
          </div>
        </div>

        <div>
          <h2 className="text-[14px] font-semibold">승인 기록</h2>
          <div className="mt-3 space-y-2">
            {!approvals?.length ? (
              <EmptyState
                title="승인 요청이 없습니다."
                description="대표 판단이 필요한 작업이 생기면 이곳에 표시됩니다."
              />
            ) : (
              approvals.map((approval) => (
                <div
                  key={approval.id}
                  className="rounded-[15px] border border-[#E7E9EE] bg-white p-4"
                >
                  <StatusBadge
                    value={approval.status}
                    label={approval.status}
                  />
                  <p className="mt-2 break-words text-[13px] font-medium">
                    {approval.title}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </OfficeShell>
  );
}
