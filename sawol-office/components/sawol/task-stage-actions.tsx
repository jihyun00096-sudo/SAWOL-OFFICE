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
}: {
  taskId: string;
  currentStatus: string;
  requiresCeoApproval: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function changeStatus(nextStatus: string) {
    if (busy || nextStatus === currentStatus) return;

    setBusy(true);
    setMessage("");

    const supabase = createClient();

    const payload: Record<string, unknown> = {
      status: nextStatus,
      updated_at: new Date().toISOString(),
    };

    if (nextStatus === "COMPLETED") {
      payload.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("tasks")
      .update(payload)
      .eq("id", taskId);

    if (error) {
      console.error(error);
      setMessage(
        "상태 변경에 실패했습니다. STEP 18의 task status SQL 패치가 적용되었는지 확인해주세요.",
      );
      setBusy(false);
      return;
    }

    router.refresh();
    setBusy(false);
  }

  const primaryStatus = nextPrimaryStatus(
    currentStatus,
    requiresCeoApproval,
  );
  const primaryLabel = nextPrimaryLabel(
    currentStatus,
    requiresCeoApproval,
  );

  return (
    <section className="rounded-[18px] border border-[#E7E9EE] bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[13px] font-semibold">실행 상태</p>
          <p className="mt-1 text-[10px] leading-5 text-[#8B919C]">
            업무를 실제 운영 단계에 맞게 이동합니다.
          </p>
        </div>

        <span className="w-fit rounded-full bg-[#F2F4F7] px-3 py-1.5 text-[10px] font-medium text-[#676D77]">
          현재 · {executionStatusLabel[currentStatus] ?? currentStatus}
        </span>
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {primaryStatus && primaryLabel ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => changeStatus(primaryStatus)}
            className="h-10 rounded-[10px] bg-[#17181C] px-4 text-[11px] font-semibold text-white disabled:opacity-50"
          >
            {busy ? "처리 중..." : primaryLabel}
          </button>
        ) : null}

        {currentStatus !== "ON_HOLD" && currentStatus !== "COMPLETED" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => changeStatus("ON_HOLD")}
            className="h-10 rounded-[10px] border border-[#E1E4E9] bg-white px-4 text-[11px] font-semibold text-[#666C76]"
          >
            보류
          </button>
        ) : null}

        {currentStatus !== "ERROR" && currentStatus !== "COMPLETED" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => changeStatus("ERROR")}
            className="h-10 rounded-[10px] border border-[#F0D2D2] bg-white px-4 text-[11px] font-semibold text-[#B14444]"
          >
            오류 처리
          </button>
        ) : null}

        {["ON_HOLD", "ERROR"].includes(currentStatus) ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => changeStatus("WAITING")}
            className="h-10 rounded-[10px] border border-[#DCE4FF] bg-[#F8FAFF] px-4 text-[11px] font-semibold text-[#3157D5]"
          >
            다시 대기로
          </button>
        ) : null}
      </div>

      {requiresCeoApproval ? (
        <p className="mt-4 rounded-[11px] bg-[#FFF9EB] px-3.5 py-3 text-[10px] leading-5 text-[#8A6824]">
          이 업무는 대표 승인 필요로 설정되어 있습니다. 작업 완료 후 검수 단계를
          거쳐 승인함으로 이동하며, 대표 승인 전에는 완료 처리되지 않습니다.
        </p>
      ) : null}

      {message ? (
        <p className="mt-3 rounded-[10px] bg-[#FFF3F3] px-3 py-2.5 text-[10px] text-[#A64242]">
          {message}
        </p>
      ) : null}
    </section>
  );
}
