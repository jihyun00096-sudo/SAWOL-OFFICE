import Link from "next/link";
import { ApprovalTaskActions } from "@/components/sawol/approval-task-actions";
import { EmptyState } from "@/components/sawol/empty-state";
import { OfficeShell } from "@/components/sawol/office-shell";
import { PageHeader } from "@/components/sawol/page-header";
import { requireSawolAdmin } from "@/lib/auth/require-sawol-admin";

export const dynamic = "force-dynamic";

const priorityLabel: Record<string, string> = {
  URGENT: "긴급",
  HIGH: "높음",
  NORMAL: "보통",
  LOW: "낮음",
};

const taskTypeLabel: Record<string, string> = {
  RESEARCH: "리서치",
  PLANNING: "기획",
  PRODUCTION: "제작",
  EDIT: "수정",
  ANALYSIS: "분석",
  OPERATION: "운영",
  STUDY: "학습",
  DEVELOPMENT: "개발",
  DESIGN: "디자인",
  OTHER: "기타",
};

export default async function ApprovalsPage() {
  const { supabase } = await requireSawolAdmin();

  const { data: tasks, count: pendingApprovals } = await supabase
    .from("tasks")
    .select(
      `
      id,
      task_code,
      title,
      description,
      task_type,
      priority,
      status,
      created_at,
      employees:assigned_employee_id(name),
      departments:assigned_department_id(name)
      `,
      { count: "exact" },
    )
    .eq("status", "PENDING_APPROVAL")
    .order("updated_at", { ascending: false });

  const rows = (tasks ?? []) as any[];
  const taskIds = rows.map((task) => task.id);

  let latestRunByTask = new Map<string, any>();

  if (taskIds.length) {
    const { data: runs } = await supabase
      .from("task_runs")
      .select(
        "id, task_id, run_code, status, result_title, result_summary, submitted_at, created_at",
      )
      .in("task_id", taskIds)
      .order("created_at", { ascending: false });

    for (const run of runs ?? []) {
      if (!latestRunByTask.has(run.task_id)) {
        latestRunByTask.set(run.task_id, run);
      }
    }
  }

  return (
    <OfficeShell pendingApprovals={pendingApprovals ?? 0}>
      <PageHeader
        eyebrow="APPROVALS"
        title="승인함"
        description="검수가 끝나 대표의 최종 판단이 필요한 업무와 제출 결과를 확인하고 승인합니다."
        action={
          <Link
            href="/queue"
            className="flex h-10 min-w-[78px] items-center justify-center whitespace-nowrap rounded-[10px] border border-[#DCE4FF] bg-[#F8FAFF] px-4 text-[11px] font-semibold text-[#3157D5]"
          >
            실행 큐
          </Link>
        }
      />

      {!rows.length ? (
        <div className="mt-6">
          <EmptyState
            title="승인 대기 업무가 없습니다."
            description="검수가 완료되어 대표 승인 단계로 이동한 업무가 이곳에 표시됩니다."
          />
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {rows.map((task) => {
            const latestRun = latestRunByTask.get(task.id);

            return (
              <article
                key={task.id}
                className="rounded-[18px] border border-[#E7E9EE] bg-white p-4 sm:p-5 lg:p-6"
              >
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#FFF5DD] px-2.5 py-1 text-[9px] font-medium text-[#8A6824]">
                        대표 승인 대기
                      </span>
                      <span className="rounded-full bg-[#F4F5F7] px-2.5 py-1 text-[9px] text-[#777D87]">
                        {priorityLabel[task.priority] ?? task.priority}
                      </span>
                      <span className="text-[9px] text-[#999EA7]">
                        {taskTypeLabel[task.task_type] ?? task.task_type}
                      </span>
                    </div>

                    <h2 className="mt-3 break-words text-[14px] font-semibold">
                      {task.title}
                    </h2>

                    {latestRun?.result_summary ? (
                      <div className="mt-3 rounded-[12px] bg-[#F7F8FA] p-3">
                        <p className="text-[9px] font-semibold text-[#3157D5]">제출 결과 요약</p>
                        <p className="mt-1 break-words text-[10px] leading-5 text-[#686F7A]">
                          {latestRun.result_summary}
                        </p>
                      </div>
                    ) : task.description ? (
                      <p className="mt-2 max-w-[760px] break-words text-[11px] leading-5 text-[#7A808B]">
                        {task.description}
                      </p>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[9px] text-[#999EA7]">
                      <span>{task.task_code}</span>
                      <span>직원 · {task.employees?.name ?? "미배정"}</span>
                      <span>부서 · {task.departments?.name ?? "미배정"}</span>
                      {latestRun?.run_code ? <span>실행 · {latestRun.run_code}</span> : null}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {latestRun?.id ? (
                        <Link
                          href={`/runs/${latestRun.id}`}
                          className="flex h-9 items-center justify-center whitespace-nowrap rounded-[9px] bg-[#3157D5] px-3.5 text-[10px] font-semibold text-white"
                        >
                          제출 결과 보기
                        </Link>
                      ) : (
                        <span className="flex h-9 items-center rounded-[9px] bg-[#F4F5F7] px-3.5 text-[10px] text-[#858B96]">
                          제출 결과 없음
                        </span>
                      )}

                      <Link
                        href={`/tasks/${task.id}`}
                        className="flex h-9 items-center justify-center whitespace-nowrap rounded-[9px] border border-[#E1E4E9] bg-white px-3.5 text-[10px] font-semibold text-[#666D78]"
                      >
                        업무 상세 보기
                      </Link>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <ApprovalTaskActions taskId={task.id} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </OfficeShell>
  );
}
