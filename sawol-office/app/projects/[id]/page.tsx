import { notFound } from "next/navigation";
import { EmptyState } from "@/components/sawol/empty-state";
import { OfficeShell } from "@/components/sawol/office-shell";
import { PageHeader } from "@/components/sawol/page-header";
import { StatusBadge } from "@/components/sawol/status-badge";
import { labelOf, priorityLabel, projectStatusLabel, taskStatusLabel, resultTypeLabel } from "@/lib/sawol/labels";
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
    supabase.from("tasks").select("id, task_code, title, status, priority, task_type, created_at").eq("project_id", id).order("created_at", { ascending: false }),
    supabase.from("results").select("id, result_code, title, result_type, status, version, created_at").eq("project_id", id).order("created_at", { ascending: false }),
    supabase.from("approvals").select("id, title, status, approval_type, requested_at").eq("project_id", id).order("requested_at", { ascending: false }),
    supabase.from("approvals").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
  ]);

  if (!project) notFound();

  return (
    <OfficeShell pendingApprovals={pendingApprovals ?? 0}>
      <PageHeader eyebrow={project.project_code} title={project.name} description={project.objective ?? project.original_request} />

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[16px] border border-[#E7E9EE] bg-white p-4"><p className="text-[10px] text-[#9297A1]">상태</p><div className="mt-2"><StatusBadge value={project.status} label={labelOf(projectStatusLabel, project.status)} /></div></div>
        <div className="rounded-[16px] border border-[#E7E9EE] bg-white p-4"><p className="text-[10px] text-[#9297A1]">우선순위</p><div className="mt-2"><StatusBadge value={project.priority} label={labelOf(priorityLabel, project.priority)} /></div></div>
        <div className="rounded-[16px] border border-[#E7E9EE] bg-white p-4"><p className="text-[10px] text-[#9297A1]">진행률</p><p className="mt-2 text-[20px] font-bold">{project.progress}%</p></div>
        <div className="rounded-[16px] border border-[#E7E9EE] bg-white p-4"><p className="text-[10px] text-[#9297A1]">현재 단계</p><p className="mt-2 text-[12px] font-medium">{project.current_stage ?? "-"}</p></div>
      </section>

      <section className="mt-6 rounded-[18px] border border-[#E7E9EE] bg-white p-5">
        <h2 className="text-[13px] font-semibold">프로젝트 정의</h2>
        <dl className="mt-4 grid gap-4 text-[12px] sm:grid-cols-2">
          <div><dt className="text-[#999EA7]">최초 요청</dt><dd className="mt-1.5 leading-6">{project.original_request}</dd></div>
          <div><dt className="text-[#999EA7]">원하는 결과</dt><dd className="mt-1.5 leading-6">{project.expected_result ?? "-"}</dd></div>
        </dl>
      </section>

      <section className="mt-7">
        <h2 className="text-[14px] font-semibold">관련 업무</h2>
        <div className="mt-3 space-y-2">
          {!tasks?.length ? <EmptyState title="관련 업무가 없습니다." description="업무지시에서 프로젝트 연결 기능은 다음 확장에서 추가됩니다." /> :
          tasks.map(task => (
            <div key={task.id} className="rounded-[15px] border border-[#E7E9EE] bg-white p-4">
              <div className="flex flex-wrap items-center gap-2"><StatusBadge value={task.status} label={labelOf(taskStatusLabel, task.status)} /><span className="text-[10px] text-[#999EA7]">{task.task_type}</span></div>
              <p className="mt-2 text-[13px] font-medium">{task.title}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-7 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-[14px] font-semibold">결과물</h2>
          <div className="mt-3 space-y-2">
            {!results?.length ? <EmptyState title="아직 결과물이 없습니다." description="직원이 작업을 완료하면 결과가 이곳에 모입니다." /> :
            results.map(result => (
              <div key={result.id} className="rounded-[15px] border border-[#E7E9EE] bg-white p-4">
                <p className="text-[10px] text-[#9297A1]">{labelOf(resultTypeLabel, result.result_type)} · v{result.version}</p>
                <p className="mt-2 text-[13px] font-medium">{result.title}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-[14px] font-semibold">승인 기록</h2>
          <div className="mt-3 space-y-2">
            {!approvals?.length ? <EmptyState title="승인 요청이 없습니다." description="대표 판단이 필요한 작업이 생기면 이곳에 표시됩니다." /> :
            approvals.map(approval => (
              <div key={approval.id} className="rounded-[15px] border border-[#E7E9EE] bg-white p-4">
                <StatusBadge value={approval.status} label={approval.status} />
                <p className="mt-2 text-[13px] font-medium">{approval.title}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </OfficeShell>
  );
}
