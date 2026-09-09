"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ApprovalTaskActions({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "return" | null>(null);
  const [message, setMessage] = useState("");

  async function updateStatus(nextStatus: "COMPLETED" | "REVIEW") {
    if (busy) return;

    setBusy(nextStatus === "COMPLETED" ? "approve" : "return");
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
      .eq("id", taskId)
      .eq("status", "PENDING_APPROVAL");

    if (error) {
      console.error(error);
      setMessage("승인 처리에 실패했습니다.");
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
          onClick={() => updateStatus("COMPLETED")}
          className="h-10 rounded-[10px] bg-[#17181C] px-4 text-[11px] font-semibold text-white disabled:opacity-50"
        >
          {busy === "approve" ? "처리 중..." : "승인 후 완료"}
        </button>

        <button
          type="button"
          disabled={busy !== null}
          onClick={() => updateStatus("REVIEW")}
          className="h-10 rounded-[10px] border border-[#E1E4E9] bg-white px-4 text-[11px] font-semibold text-[#656B75] disabled:opacity-50"
        >
          {busy === "return" ? "처리 중..." : "검수로 돌려보내기"}
        </button>
      </div>

      {message ? (
        <p className="mt-2 rounded-[9px] bg-[#FFF1F1] px-3 py-2 text-[10px] text-[#B14444]">
          {message}
        </p>
      ) : null}
    </div>
  );
}
