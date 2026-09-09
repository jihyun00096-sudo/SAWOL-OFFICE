"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createHumanCode } from "@/lib/sawol/code";
import { runStatusLabel, runStatusTone } from "@/lib/sawol/run-labels";

type Run = {
  id: string;
  run_code: string;
  status: string;
  employee_id: string | null;
  started_at: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  result_title: string | null;
  result_summary: string | null;
  error_message: string | null;
  created_at: string;
};

export function TaskRunPanel({
  taskId,
  assignedEmployeeId,
  taskStatus,
  runs,
}: {
  taskId: string;
  assignedEmployeeId: string | null;
  taskStatus: string;
  runs: Run[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const activeRun = runs.find((run) =>
    ["READY", "RUNNING", "SUBMITTED"].includes(run.status),
  );

  async function createRun() {
    if (busy || activeRun) return;

    setBusy(true);
    setMessage("");

    const supabase = createClient();
    const now = new Date().toISOString();

    const { error } = await supabase.from("task_runs").insert({
      run_code: createHumanCode("RUN"),
      task_id: taskId,
      employee_id: assignedEmployeeId || null,
      status: "RUNNING",
      started_at: now,
      metadata: {
        source: "CEO_MANUAL_START",
        step: 19,
      },
    });

    if (error) {
      console.error(error);
      setMessage("실행 세션 생성에 실패했습니다.");
      setBusy(false);
      return;
    }

    if (taskStatus === "WAITING") {
      await supabase
        .from("tasks")
        .update({
          status: "IN_PROGRESS",
          updated_at: now,
        })
        .eq("id", taskId);
    }

    router.refresh();
    setBusy(false);
  }

  return (
    <section className="rounded-[18px] border border-[#E7E9EE] bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[13px] font-semibold">실행 세션</p>
          <p className="mt-1 text-[10px] leading-5 text-[#8B919C]">
            실제 작업 시작과 결과 제출 기록을 남깁니다.
          </p>
        </div>

        {!activeRun && !["COMPLETED"].includes(taskStatus) ? (
          <button
            type="button"
            onClick={createRun}
            disabled={busy}
            className="h-10 rounded-[10px] bg-[#3157D5] px-4 text-[11px] font-semibold text-white disabled:opacity-50"
          >
            {busy ? "생성 중..." : "실행 세션 시작"}
          </button>
        ) : null}
      </div>

      {message ? (
        <p className="mt-3 rounded-[9px] bg-[#FFF1F1] px-3 py-2 text-[10px] text-[#B14444]">
          {message}
        </p>
      ) : null}

      {!runs.length ? (
        <div className="mt-5 rounded-[13px] bg-[#F7F8FA] p-5 text-center">
          <p className="text-[10px] text-[#898F99]">
            아직 실행 기록이 없습니다.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {runs.map((run) => (
            <Link
              href={`/runs/${run.id}`}
              key={run.id}
              className="block rounded-[13px] border border-[#EAECF0] p-4 transition hover:border-[#D8DCE4]"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold">{run.run_code}</p>
                  <p className="mt-1 truncate text-[9px] text-[#969BA5]">
                    {run.result_title ?? "결과 미제출"}
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
      )}
    </section>
  );
}
