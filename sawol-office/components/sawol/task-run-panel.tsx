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
  isWorkflowRoot = false,
  unmetDependencies = [],
}: {
  taskId: string;
  assignedEmployeeId: string | null;
  taskStatus: string;
  runs: Run[];
  isWorkflowRoot?: boolean;
  unmetDependencies?: Array<{ task_code?: string; title: string }>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const activeRun = runs.find((run) =>
    ["READY", "RUNNING", "SUBMITTED"].includes(run.status),
  );

  async function createRun() {
    if (busy || activeRun || isWorkflowRoot) return;

    if (!assignedEmployeeId) {
      setMessage("실행 전에 담당 직원을 먼저 배정해주세요.");
      return;
    }

    if (unmetDependencies.length) {
      setMessage(`선행 업무 ${unmetDependencies.length}건이 아직 완료되지 않았습니다.`);
      return;
    }

    setBusy(true);
    setMessage("");
    const supabase = createClient();

    const { error } = await supabase.rpc("sawol_start_task_run", {
      p_task_id: taskId,
      p_run_code: createHumanCode("RUN"),
    });

    if (error) {
      console.error(error);
      const raw = error.message ?? "";
      if (raw.includes("DEPENDENCIES_NOT_COMPLETED")) {
        setMessage("선행 업무가 완료되지 않아 실행할 수 없습니다.");
      } else if (raw.includes("ACTIVE_RUN_ALREADY_EXISTS")) {
        setMessage("이미 진행 중이거나 제출 대기 중인 실행 세션이 있습니다.");
      } else if (raw.includes("EMPLOYEE_REQUIRED")) {
        setMessage("담당 직원을 먼저 배정해주세요.");
      } else {
        setMessage(`실행 세션 생성에 실패했습니다. ${raw}`);
      }
      setBusy(false);
      return;
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
            실제 작업 시작과 결과 제출 기록을 남깁니다. STEP22 협업 업무는 선행 단계 완료 여부를 DB에서도 확인합니다.
          </p>
        </div>

        {!activeRun && !["COMPLETED"].includes(taskStatus) && !isWorkflowRoot ? (
          <button
            type="button"
            onClick={createRun}
            disabled={busy || unmetDependencies.length > 0 || !assignedEmployeeId}
            className="h-10 shrink-0 whitespace-nowrap rounded-[10px] bg-[#3157D5] px-4 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "생성 중..." : "실행 세션 시작"}
          </button>
        ) : null}
      </div>

      {isWorkflowRoot ? (
        <p className="mt-4 rounded-[11px] bg-[#F7F8FA] px-3.5 py-3 text-[10px] leading-5 text-[#737A85]">
          이 업무는 협업 워크플로의 상위 업무입니다. 실제 실행은 아래 협업 단계에서 진행되며, 모든 단계가 완료되면 최종 결과가 상위 업무에 자동 집계됩니다.
        </p>
      ) : unmetDependencies.length ? (
        <div className="mt-4 rounded-[11px] bg-[#FFF9EB] px-3.5 py-3">
          <p className="text-[10px] font-semibold text-[#8A6824]">선행 업무 완료 후 시작할 수 있습니다.</p>
          <div className="mt-2 space-y-1">
            {unmetDependencies.map((dep) => (
              <p key={`${dep.task_code ?? ""}-${dep.title}`} className="text-[9px] text-[#8A6824]">• {dep.task_code ? `${dep.task_code} · ` : ""}{dep.title}</p>
            ))}
          </div>
        </div>
      ) : null}

      {message ? (
        <p className="mt-3 rounded-[9px] bg-[#FFF1F1] px-3 py-2 text-[10px] text-[#B14444]">{message}</p>
      ) : null}

      {!runs.length ? (
        <div className="mt-5 rounded-[13px] bg-[#F7F8FA] p-5 text-center">
          <p className="text-[10px] text-[#898F99]">아직 실행 기록이 없습니다.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {runs.map((run) => (
            <Link href={`/runs/${run.id}`} key={run.id} className="block rounded-[13px] border border-[#EAECF0] p-4 transition hover:border-[#D8DCE4]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold">{run.run_code}</p>
                  <p className="mt-1 truncate text-[9px] text-[#969BA5]">{run.result_title ?? "결과 미제출"}</p>
                </div>
                <span className={`w-fit rounded-full px-2.5 py-1 text-[9px] font-medium ${runStatusTone[run.status] ?? "bg-[#F4F5F7] text-[#777D87]"}`}>
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
