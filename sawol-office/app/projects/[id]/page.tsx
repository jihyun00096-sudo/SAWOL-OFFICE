import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailSection } from "@/components/sawol/detail-section";
import { EmptyState } from "@/components/sawol/empty-state";
import { OfficeShell } from "@/components/sawol/office-shell";
import { PageHeader } from "@/components/sawol/page-header";
import { ProjectDeleteButton } from "@/components/sawol/project-delete-button";
import { ProjectEditForm } from "@/components/sawol/project-edit-form";
import { ProjectOperationsBoard } from "@/components/sawol/project-operations-board";
import { StatusBadge } from "@/components/sawol/status-badge";
import { labelOf, priorityLabel, projectStatusLabel, resultTypeLabel, taskStatusLabel } from "@/lib/sawol/labels";
import { requireSawolAdmin } from "@/lib/auth/require-sawol-admin";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireSawolAdmin();

  const [
    { data: project },
    { data: allTasks },
    { data: results },
    { data: approvals },
    { count: pendingApprovals },
  ] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("tasks")
      .select("id,task_code,title,status,priority,task_type,created_at,parent_task_id,workflow_id,workflow_step_no,workflow_step_key,is_workflow_root,execution_mode,assigned_employee_id,employees:assigned_employee_id(name),departments:assigned_department_id(name)")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("results").select("id,result_code,title,result_type,status,version,created_at").eq("project_id", id).order("created_at", { ascending: false }),
    supabase.from("approvals").select("id,title,status,approval_type,requested_at,task_id").eq("project_id", id).order("requested_at", { ascending: false }),
    supabase.from("approvals").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
  ]);

  if (!project) notFound();

  const rootTasks = (allTasks ?? []).filter((task: any) => !task.parent_task_id);
  const workflowSteps = (allTasks ?? []).filter((task: any) => Boolean(task.parent_task_id));
  const taskIds = (allTasks ?? []).map((task: any) => task.id);
  const rootIds = rootTasks.map((task: any) => task.id);

  const [{ data: handoffs }, { data: feedbacks }] = await Promise.all([
    taskIds.length
      ? supabase.from("task_handoffs").select("id,from_task_id,to_task_id,title,created_at").in("from_task_id", taskIds).order("created_at", { ascending: false }).limit(80)
      : Promise.resolve({ data: [] as any[] }),
    rootIds.length
      ? supabase.from("task_feedback").select("id,root_task_id,reason,status,created_at").in("root_task_id", rootIds).order("created_at", { ascending: false }).limit(80)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  return (
    <OfficeShell pendingApprovals={pendingApprovals ?? 0}>
      <PageHeader
        eyebrow={project.project_code}
        title={project.name}
        description={project.objective ?? project.original_request}
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Link href={`/command?project_id=${project.id}`} className="flex h-10 items-center justify-center rounded-[10px] bg-[#17181C] px-4 text-[11px] font-semibold text-white">업무 추가</Link>
            <Link href="/projects" className="flex h-10 items-center justify-center rounded-[10px] border border-[#E1E4E9] bg-white px-4 text-[11px] font-semibold text-[#656B75]">목록으로</Link>
            <ProjectDeleteButton projectId={project.id} projectName={project.name} />
          </div>
        }
      />

      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-[16px] border border-[#E7E9EE] bg-white p-4"><p className="text-[10px] text-[#9297A1]">상태</p><div className="mt-2"><StatusBadge value={project.status} label={labelOf(projectStatusLabel, project.status)} /></div></div>
        <div className="rounded-[16px] border border-[#E7E9EE] bg-white p-4"><p className="text-[10px] text-[#9297A1]">우선순위</p><div className="mt-2"><StatusBadge value={project.priority} label={labelOf(priorityLabel, project.priority)} /></div></div>
        <div className="rounded-[16px] border border-[#E7E9EE] bg-white p-4"><p className="text-[10px] text-[#9297A1]">메인 업무</p><p className="mt-2 text-[20px] font-bold">{rootTasks.length}</p></div>
        <div className="rounded-[16px] border border-[#E7E9EE] bg-white p-4"><p className="text-[10px] text-[#9297A1]">현재 단계</p><p className="mt-2 break-words text-[12px] font-medium">{project.current_stage ?? "-"}</p></div>
      </section>

      <div className="mt-5">
        <ProjectOperationsBoard projectId={project.id} tasks={rootTasks as any} steps={workflowSteps as any} handoffs={(handoffs ?? []) as any} feedbacks={(feedbacks ?? []) as any} />
      </div>

      <div className="mt-5">
        <DetailSection title="프로젝트 관리" description="프로젝트 정의·상태·운영 정보를 직접 수정합니다. 실시간 업무 진행률은 위 운영 현황에서 별도로 계산됩니다.">
          <ProjectEditForm project={project as any} />
        </DetailSection>
      </div>

      <section className="mt-7 grid gap-6 lg:grid-cols-2">
        <div>
          <div className="flex items-center justify-between"><h2 className="text-[14px] font-semibold">메인 업무</h2><span className="text-[9px] text-[#9A9FAA]">{rootTasks.length}건</span></div>
          <div className="mt-3 space-y-2">
            {!rootTasks.length ? <EmptyState title="관련 업무가 없습니다." description="업무 추가 버튼으로 프로젝트에 첫 업무를 연결할 수 있습니다." /> : rootTasks.slice(0, 8).map((task: any) => (
              <Link href={`/tasks/${task.id}`} key={task.id} className="block rounded-[15px] border border-[#E7E9EE] bg-white p-4 transition hover:border-[#D7DBE3]">
                <div className="flex flex-wrap items-center gap-2"><StatusBadge value={task.status} label={labelOf(taskStatusLabel, task.status)} /><span className="text-[9px] text-[#999EA7]">{task.execution_mode === "AUTO" ? "AUTO" : "MANUAL"}</span></div>
                <p className="mt-2 break-words text-[13px] font-medium">{task.title}</p>
                <p className="mt-1 text-[9px] text-[#9A9FAA]">{task.employees?.name ?? "미배정"} · {task.departments?.name ?? "부서 미배정"}</p>
              </Link>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between"><h2 className="text-[14px] font-semibold">결과물</h2><span className="text-[9px] text-[#9A9FAA]">{results?.length ?? 0}건</span></div>
          <div className="mt-3 space-y-2">
            {!results?.length ? <EmptyState title="아직 결과물이 없습니다." description="직원이 작업을 완료하면 결과가 이곳에 모입니다." /> : results.slice(0, 8).map((result) => (
              <Link href={`/results/${result.id}`} key={result.id} className="block rounded-[15px] border border-[#E7E9EE] bg-white p-4 transition hover:border-[#D7DBE3]">
                <p className="text-[10px] text-[#9297A1]">{labelOf(resultTypeLabel, result.result_type)} · v{result.version}</p>
                <p className="mt-2 break-words text-[13px] font-medium">{result.title}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-7">
        <div className="flex items-center justify-between"><h2 className="text-[14px] font-semibold">대표 승인 기록</h2><span className="text-[9px] text-[#9A9FAA]">{approvals?.length ?? 0}건</span></div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {!approvals?.length ? <EmptyState title="승인 요청이 없습니다." description="대표 판단이 필요한 작업이 생기면 이곳에 표시됩니다." /> : approvals.slice(0, 8).map((approval) => (
            <div key={approval.id} className="rounded-[15px] border border-[#E7E9EE] bg-white p-4">
              <StatusBadge value={approval.status} label={approval.status === "PENDING" ? "승인 대기" : approval.status} />
              <p className="mt-2 break-words text-[13px] font-medium">{approval.title}</p>
            </div>
          ))}
        </div>
      </section>
    </OfficeShell>
  );
}
