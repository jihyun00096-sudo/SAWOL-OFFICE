import Link from "next/link";

export function WorkflowChildContext({
  rootTask,
  stepNo,
  dependencies,
  handoffs,
}: {
  rootTask: { id: string; title: string; task_code: string };
  stepNo: number | null;
  dependencies: Array<any>;
  handoffs: Array<any>;
}) {
  const unmet = dependencies.filter((dep) => dep.depends_on?.status !== "COMPLETED");
  return (
    <section className="rounded-[18px] border border-[#E7E9EE] bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#EEF2FF] px-2 py-1 text-[8px] font-semibold text-[#3157D5]">협업 단계 {stepNo ?? "-"}</span>
            {unmet.length ? <span className="rounded-full bg-[#FFF5DD] px-2 py-1 text-[8px] text-[#8A6824]">선행 업무 대기</span> : <span className="rounded-full bg-[#ECF8F0] px-2 py-1 text-[8px] text-[#2D7650]">진행 가능</span>}
          </div>
          <p className="mt-2 text-[10px] text-[#7A808B]">상위 업무 · {rootTask.title}</p>
        </div>
        <Link href={`/tasks/${rootTask.id}`} className="flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-[9px] border border-[#E1E4E9] px-3 text-[10px] font-semibold text-[#656B75]">전체 협업 보기</Link>
      </div>

      {dependencies.length ? (
        <div className="mt-4 rounded-[12px] bg-[#F7F8FA] p-3">
          <p className="text-[9px] font-semibold">선행 업무</p>
          <div className="mt-2 space-y-1.5">
            {dependencies.map((dep) => <p key={dep.id} className="text-[9px] text-[#777E89]">• {dep.depends_on?.title} · {dep.depends_on?.status === "COMPLETED" ? "완료" : "대기"}</p>)}
          </div>
        </div>
      ) : null}

      {handoffs.length ? (
        <div className="mt-4 rounded-[12px] border border-[#E4E9F8] bg-[#FAFBFF] p-3">
          <p className="text-[9px] font-semibold text-[#3157D5]">이전 단계 인수인계 {handoffs.length}건</p>
          {handoffs.map((handoff) => (
            <div key={handoff.id} className="mt-2 border-t border-[#ECEEF4] pt-2 first:border-0 first:pt-0">
              <p className="text-[10px] font-semibold">{handoff.title}</p>
              {handoff.summary ? <p className="mt-1 text-[9px] leading-5 text-[#777E89]">{handoff.summary}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
