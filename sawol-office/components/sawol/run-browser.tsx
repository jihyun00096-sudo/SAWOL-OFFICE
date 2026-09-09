import Link from "next/link";
import { runStatusLabel, runStatusTone } from "@/lib/sawol/run-labels";

type RunRow = {
  id: string;
  run_code: string;
  status: string;
  result_title: string | null;
  created_at: string;
  tasks: { title: string; task_code: string } | null;
  employees: { name: string } | null;
};

export function RunBrowser({ runs }: { runs: RunRow[] }) {
  if (!runs.length) {
    return (
      <div className="mt-6 rounded-[18px] border border-dashed border-[#DDE1E7] bg-white p-10 text-center">
        <p className="text-[12px] font-semibold">실행 기록이 없습니다.</p>
        <p className="mt-2 text-[10px] text-[#8C929D]">
          업무 상세에서 실행 세션을 시작하면 여기에 기록됩니다.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      {runs.map((run) => (
        <Link
          key={run.id}
          href={`/runs/${run.id}`}
          className="block rounded-[17px] border border-[#E7E9EE] bg-white p-5 transition hover:border-[#D7DBE3]"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[9px] font-semibold text-[#3157D5]">
                {run.run_code}
              </p>
              <h2 className="mt-2 break-words text-[13px] font-semibold">
                {run.tasks?.title ?? "연결 업무 없음"}
              </h2>
              <p className="mt-2 text-[10px] text-[#8C929D]">
                결과 · {run.result_title ?? "미제출"}
              </p>
              <p className="mt-2 text-[9px] text-[#A0A5AE]">
                담당 · {run.employees?.name ?? "미배정"}
              </p>
            </div>

            <span
              className={`w-fit rounded-full px-2.5 py-1 text-[9px] font-medium ${
                runStatusTone[run.status] ??
                "bg-[#F4F5F7] text-[#777D87]"
              }`}
            >
              {runStatusLabel[run.status] ?? run.status}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
