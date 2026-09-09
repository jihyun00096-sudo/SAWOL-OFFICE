import Link from "next/link";

const statusLabel: Record<string, string> = {
  WAITING: "대기",
  IN_PROGRESS: "작업 중",
  REVIEW: "검수 대기",
  PENDING_APPROVAL: "대표 승인 대기",
  COMPLETED: "완료",
  ON_HOLD: "보류",
  ERROR: "오류",
};

export function WorkflowBoard({
  workflow,
  steps,
  dependencies,
}: {
  workflow: { workflow_code: string; status: string; total_steps: number; completed_steps: number };
  steps: Array<any>;
  dependencies: Array<any>;
}) {
  const completed = workflow.completed_steps ?? steps.filter((step) => step.status === "COMPLETED").length;
  const total = workflow.total_steps || steps.length;
  const percent = total ? Math.round((completed / total) * 100) : 0;
  const depsByTask = new Map<string, any[]>();
  for (const dep of dependencies) {
    const list = depsByTask.get(dep.task_id) ?? [];
    list.push(dep);
    depsByTask.set(dep.task_id, list);
  }

  return (
    <section className="rounded-[18px] border border-[#E7E9EE] bg-white p-4 sm:p-5 lg:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-semibold">AI 협업 워크플로</p>
            <span className="rounded-full bg-[#EEF2FF] px-2 py-1 text-[8px] font-semibold text-[#3157D5]">{workflow.workflow_code}</span>
          </div>
          <p className="mt-1 text-[10px] leading-5 text-[#8B919C]">각 단계는 선행 업무가 완료된 뒤 실행할 수 있으며 결과는 다음 직원에게 자동 인계됩니다.</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-[18px] font-semibold">{percent}%</p>
          <p className="text-[9px] text-[#989EA8]">{completed} / {total} 완료</p>
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#EEF0F4]">
        <div className="h-full rounded-full bg-[#3157D5] transition-all" style={{ width: `${percent}%` }} />
      </div>

      <div className="mt-5 grid gap-3">
        {steps.map((step: any) => {
          const deps = depsByTask.get(step.id) ?? [];
          const unmet = deps.filter((dep) => dep.depends_on?.status !== "COMPLETED");
          return (
            <Link key={step.id} href={`/tasks/${step.id}`} className="block rounded-[15px] border border-[#E8EAF0] p-4 transition hover:border-[#D8DCE4]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#F3F4F6] px-2 py-1 text-[9px] font-semibold">{String(step.workflow_step_no).padStart(2, "0")}</span>
                    <span className="text-[9px] text-[#777D87]">{statusLabel[step.status] ?? step.status}</span>
                    {unmet.length ? (
                      <span className="rounded-full bg-[#FFF5DD] px-2 py-1 text-[8px] text-[#8A6824]">선행 업무 대기 {unmet.length}</span>
                    ) : step.status === "WAITING" ? (
                      <span className="rounded-full bg-[#ECF8F0] px-2 py-1 text-[8px] text-[#2D7650]">진행 가능</span>
                    ) : null}
                  </div>
                  <p className="mt-2 break-words text-[12px] font-semibold">{step.title}</p>
                  <p className="mt-1 text-[9px] text-[#969CA6]">{step.employees?.name ?? "미배정"} · {step.departments?.name ?? "미배정"}</p>
                  {deps.length ? (
                    <p className="mt-2 break-words text-[9px] text-[#9A9FA8]">선행: {deps.map((dep) => dep.depends_on?.title ?? "업무").join(" · ")}</p>
                  ) : null}
                </div>
                <span className="shrink-0 text-[9px] font-semibold text-[#3157D5]">단계 열기 →</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
