"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  executionStatusLabel,
  nextPrimaryLabel,
  nextPrimaryStatus,
} from "@/lib/sawol/execution";

export function TaskStageActions({
  taskId,
  currentStatus,
  requiresCeoApproval,
  isWorkflowRoot = false,
  unmetDependencies = 0,
}: {
  taskId: string;
  currentStatus: string;
  requiresCeoApproval: boolean;
  isWorkflowRoot?: boolean;
  unmetDependencies?: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function changeStatus(nextStatus: string) {
    if (busy || nextStatus === currentStatus || isWorkflowRoot) return;
    if (currentStatus === "WAITING" && nextStatus === "IN_PROGRESS" && unmetDependencies > 0) {
      setMessage("선행 업무가 완료되지 않아 작업을 시작할 수 없습니다.");
      return;
    }

    setBusy(true);
    setMessage("");
    const supabase = createClient();

    const payload: Record<string, unknown> = {
      status: nextStatus,
      updated_at: new Date().toISOString(),
    };

    if (nextStatus === "COMPLETED") payload.completed_at = new Date().toISOString();

    const { error } = await supabase.from("tasks").update(payload).eq("id", taskId);

    if (error) {
      console.error(error);
      if ((error.message ?? "").includes("DEPENDENCIES_NOT_COMPLETED")) {
        setMessage("선행 업무가 완료되지 않아 상태를 변경할 수 없습니다.");
      } else {
        setMessage("상태 변경에 실패했습니다. STEP18/STEP22 상태·의존성 SQL 적용 여부를 확인해주세요.");
      }
      setBusy(false);
      return;
    }

    router.refresh();
    setBusy(false);
  }

  const primaryStatus = nextPrimaryStatus(currentStatus, requiresCeoApproval);
  const primaryLabel = nextPrimaryLabel(currentStatus, requiresCeoApproval);

  return (
    <section className="rounded-[18px] border border-[#E7E9EE] bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[13px] font-semibold">실행 상태</p>
          <p className="mt-1 text-[10px] leading-5 text-[#8B919C]">업무를 실제 운영 단계에 맞게 이동합니다.</p>
        </div>
        <span className="w-fit rounded-full bg-[#F2F4F7] px-3 py-1.5 text-[10px] font-medium text-[#676D77]">현재 · {executionStatusLabel[currentStatus] ?? currentStatus}</span>
      </div>

      {isWorkflowRoot ? (
        <p className="mt-4 rounded-[11px] bg-[#F7F8FA] px-3.5 py-3 text-[10px] leading-5 text-[#737A85]">
          협업 상위 업무의 상태는 하위 단계 진행 상황에 따라 자동 관리됩니다. 개별 단계 카드를 열어 실제 작업을 진행해주세요.
        </p>
      ) : (
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {primaryStatus && primaryLabel ? (
            <button
              type="button"
              disabled={busy || (currentStatus === "WAITING" && unmetDependencies > 0)}
              onClick={() => changeStatus(primaryStatus)}
              className="h-10 whitespace-nowrap rounded-[10px] bg-[#17181C] px-4 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "처리 중..." : primaryLabel}
            </button>
          ) : null}

          {currentStatus !== "ON_HOLD" && currentStatus !== "COMPLETED" ? (
            <button type="button" disabled={busy} onClick={() => changeStatus("ON_HOLD")} className="h-10 whitespace-nowrap rounded-[10px] border border-[#E1E4E9] bg-white px-4 text-[11px] font-semibold text-[#666C76]">보류</button>
          ) : null}

          {currentStatus !== "ERROR" && currentStatus !== "COMPLETED" ? (
            <button type="button" disabled={busy} onClick={() => changeStatus("ERROR")} className="h-10 whitespace-nowrap rounded-[10px] border border-[#F0D2D2] bg-white px-4 text-[11px] font-semibold text-[#B14444]">오류 처리</button>
          ) : null}

          {["ON_HOLD", "ERROR"].includes(currentStatus) ? (
            <button type="button" disabled={busy} onClick={() => changeStatus("WAITING")} className="h-10 whitespace-nowrap rounded-[10px] border border-[#DCE4FF] bg-[#F8FAFF] px-4 text-[11px] font-semibold text-[#3157D5]">다시 대기로</button>
          ) : null}
        </div>
      )}

      {!isWorkflowRoot && unmetDependencies > 0 ? (
        <p className="mt-4 rounded-[11px] bg-[#FFF9EB] px-3.5 py-3 text-[10px] leading-5 text-[#8A6824]">선행 업무 {unmetDependencies}건이 완료되기 전에는 작업 시작이 잠겨 있습니다.</p>
      ) : null}

      {!isWorkflowRoot && requiresCeoApproval ? (
        <p className="mt-4 rounded-[11px] bg-[#FFF9EB] px-3.5 py-3 text-[10px] leading-5 text-[#8A6824]">이 업무는 대표 승인 필요로 설정되어 있습니다. 작업 완료 후 검수 단계를 거쳐 승인함으로 이동합니다.</p>
      ) : null}

      {message ? <p className="mt-3 rounded-[10px] bg-[#FFF3F3] px-3 py-2.5 text-[10px] text-[#A64242]">{message}</p> : null}
    </section>
  );
}
