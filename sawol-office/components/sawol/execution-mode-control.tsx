"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type ExecutionMode = "AUTO" | "MANUAL";

export function ExecutionModeControl({
  taskId,
  mode,
  taskStatus,
}: {
  taskId: string;
  mode: ExecutionMode;
  taskStatus: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const closed = ["COMPLETED", "CANCELLED", "CANCELED"].includes(taskStatus);

  async function changeMode(nextMode: ExecutionMode) {
    if (busy || closed || nextMode === mode) return;

    setBusy(true);
    setMessage("");

    const supabase = createClient();
    const { error } = await supabase.rpc("sawol_set_task_execution_mode", {
      p_task_id: taskId,
      p_mode: nextMode,
    });

    if (error) {
      setMessage(`운영 방식 변경에 실패했습니다. ${error.message}`);
      setBusy(false);
      return;
    }

    setMessage(
      nextMode === "AUTO"
        ? "자동 실행 모드로 전환했습니다. 현재 진행상태를 보존한 채 AI가 이어서 처리할 수 있습니다."
        : "수동 실행 모드로 전환했습니다. 자동 진행은 멈추고 현재 상태에서 직접 개입할 수 있습니다.",
    );
    setBusy(false);
    router.refresh();
  }

  return (
    <section className="rounded-[18px] border border-[#E7E9EE] bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-semibold">업무 운영 방식</p>
            <span
              className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${
                mode === "AUTO"
                  ? "bg-[#EEF2FF] text-[#3157D5]"
                  : "bg-[#F3F4F6] text-[#626873]"
              }`}
            >
              {mode === "AUTO" ? "자동 실행" : "수동 실행"}
            </span>
          </div>
          <p className="mt-1 break-keep text-[10px] leading-5 text-[#8C929D]">
            자동은 비서실장이 배정부터 검수까지 이어서 처리하고, 수동은 대표가 기존 운영 도구로 직접 개입합니다.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button
            type="button"
            disabled={busy || closed || mode === "AUTO"}
            onClick={() => changeMode("AUTO")}
            className={`h-10 rounded-[10px] px-4 text-[11px] font-semibold transition disabled:cursor-not-allowed ${
              mode === "AUTO"
                ? "bg-[#3157D5] text-white"
                : "border border-[#DCE4FF] bg-[#F8FAFF] text-[#3157D5] disabled:opacity-45"
            }`}
          >
            자동 실행
          </button>
          <button
            type="button"
            disabled={busy || closed || mode === "MANUAL"}
            onClick={() => changeMode("MANUAL")}
            className={`h-10 rounded-[10px] px-4 text-[11px] font-semibold transition disabled:cursor-not-allowed ${
              mode === "MANUAL"
                ? "bg-[#17181C] text-white"
                : "border border-[#E1E4E9] bg-white text-[#626873] disabled:opacity-45"
            }`}
          >
            수동 실행
          </button>
        </div>
      </div>
      {message ? (
        <p className="mt-3 rounded-[10px] bg-[#F6F8FC] px-3 py-2.5 text-[10px] leading-5 text-[#626873]">
          {message}
        </p>
      ) : null}
    </section>
  );
}
