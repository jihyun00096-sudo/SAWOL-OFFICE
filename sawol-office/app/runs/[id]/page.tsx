import Link from "next/link";
import { notFound } from "next/navigation";
import { OfficeShell } from "@/components/sawol/office-shell";
import { PageHeader } from "@/components/sawol/page-header";
import { TaskRunResultForm } from "@/components/sawol/task-run-result-form";
import { runStatusLabel, runStatusTone } from "@/lib/sawol/run-labels";
import { requireSawolAdmin } from "@/lib/auth/require-sawol-admin";

export const dynamic = "force-dynamic";

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireSawolAdmin();

  const [
    { data: run },
    { count: pendingApprovals },
  ] = await Promise.all([
    supabase
      .from("task_runs")
      .select(
        `
        *,
        tasks:task_id(id, title, task_code, description, status),
        employees:employee_id(name, employee_code)
        `,
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING_APPROVAL"),
  ]);

  if (!run) notFound();

  const task = run.tasks as any;

  return (
    <OfficeShell pendingApprovals={pendingApprovals ?? 0}>
      <PageHeader
        eyebrow={run.run_code}
        title={task?.title ?? "실행 세션"}
        description="업무 실행 과정과 제출된 결과를 확인합니다."
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Link
              href="/runs"
              className="flex h-10 items-center justify-center rounded-[10px] border border-[#DCE4FF] bg-[#F8FAFF] px-4 text-[11px] font-semibold text-[#3157D5]"
            >
              실행 기록 목록
            </Link>

            {task?.id ? (
              <Link
                href={`/tasks/${task.id}`}
                className="flex h-10 items-center justify-center rounded-[10px] border border-[#E1E4E9] bg-white px-4 text-[11px] font-semibold text-[#656B75]"
              >
                업무로 이동
              </Link>
            ) : null}
          </div>
        }
      />

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[16px] border border-[#E7E9EE] bg-white p-4">
          <p className="text-[9px] text-[#9499A3]">실행 상태</p>
          <span
            className={`mt-2 inline-block rounded-full px-2.5 py-1 text-[9px] font-medium ${
              runStatusTone[run.status] ??
              "bg-[#F4F5F7] text-[#777D87]"
            }`}
          >
            {runStatusLabel[run.status] ?? run.status}
          </span>
        </div>

        <div className="rounded-[16px] border border-[#E7E9EE] bg-white p-4">
          <p className="text-[9px] text-[#9499A3]">담당 직원</p>
          <p className="mt-2 text-[11px] font-semibold">
            {(run.employees as any)?.name ?? "미배정"}
          </p>
        </div>

        <div className="rounded-[16px] border border-[#E7E9EE] bg-white p-4">
          <p className="text-[9px] text-[#9499A3]">연결 업무</p>
          <p className="mt-2 text-[11px] font-semibold">
            {task?.task_code ?? "-"}
          </p>
        </div>
      </section>

      {run.result_body ? (
        <section className="mt-5 rounded-[18px] border border-[#E7E9EE] bg-white p-5 sm:p-6">
          <p className="text-[10px] font-semibold text-[#3157D5]">
            제출 결과
          </p>
          <h2 className="mt-2 text-[16px] font-semibold">
            {run.result_title}
          </h2>

          {run.result_summary ? (
            <p className="mt-3 rounded-[12px] bg-[#F7F8FA] px-4 py-3 text-[11px] leading-5 text-[#666C76]">
              {run.result_summary}
            </p>
          ) : null}

          <div className="mt-5 whitespace-pre-wrap text-[12px] leading-7 text-[#444A54]">
            {run.result_body}
          </div>
        </section>
      ) : (
        <section className="mt-5 rounded-[18px] border border-[#E7E9EE] bg-white p-5 sm:p-6">
          <div className="mb-5">
            <p className="text-[13px] font-semibold">결과 제출</p>
            <p className="mt-1 text-[10px] text-[#8B919C]">
              현재 STEP 19에서는 실행 결과를 수동 입력해 전체 검수 흐름을 먼저 검증합니다.
            </p>
          </div>

          <TaskRunResultForm
            runId={run.id}
            taskId={task.id}
          />
        </section>
      )}
    </OfficeShell>
  );
}
