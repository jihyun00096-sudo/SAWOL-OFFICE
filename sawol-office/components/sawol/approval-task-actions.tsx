"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ApprovalTaskActions({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "return" | null>(null);
  const [message, setMessage] = useState("");

  async function approveAndFinalize() {
    if (busy) return;

    setBusy("approve");
    setMessage("");

    const supabase = createClient();

    const { data, error } = await supabase.rpc(
      "sawol_finalize_task_approval",
      { p_task_id: taskId },
    );

    if (error) {
      console.error(error);
      setMessage(
        "승인 완료 처리에 실패했습니다. STEP20 최종 SQL 적용 여부와 실행 결과 상태를 확인해주세요.",
      );
      setBusy(null);
      return;
    }

    const payload = data as any;
    const hasResult = payload?.artifacts?.has_result;

    if (hasResult === false) {
      setMessage(
        "업무는 완료됐지만 연결된 실행 결과가 없어 결과함/기억센터에는 생성되지 않았습니다.",
      );
    }

    router.refresh();
    setBusy(null);
  }

  async function returnToReview() {
    if (busy) return;

    setBusy("return");
    setMessage("");

    const supabase = createClient();

    const { error } = await supabase
      .from("tasks")
      .update({
        status: "REVIEW",
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .eq("status", "PENDING_APPROVAL");

    if (error) {
      console.error(error);
      setMessage("검수 단계로 되돌리는 데 실패했습니다.");
      setBusy(null);
      return;
    }

    router.refresh();
    setBusy(null);
  }

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={busy !== null}
          onClick={approveAndFinalize}
          className="h-10 rounded-[10px] bg-[#17181C] px-4 text-[11px] font-semibold text-white disabled:opacity-50"
        >
          {busy === "approve" ? "결과 정리 중..." : "승인 후 완료"}
        </button>

        <button
          type="button"
          disabled={busy !== null}
          onClick={returnToReview}
          className="h-10 rounded-[10px] border border-[#E1E4E9] bg-white px-4 text-[11px] font-semibold text-[#656B75] disabled:opacity-50"
        >
          {busy === "return" ? "처리 중..." : "검수로 돌려보내기"}
        </button>
      </div>

      {message ? (
        <p className="mt-2 max-w-[360px] rounded-[9px] bg-[#FFF7E8] px-3 py-2 text-[10px] leading-5 text-[#8A6824]">
          {message}
        </p>
      ) : null}
    </div>
  );
}
