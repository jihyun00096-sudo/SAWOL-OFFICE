"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const actions = [
  { value: "APPROVED", label: "승인" },
  { value: "REVISION_REQUESTED", label: "수정 요청" },
  { value: "HOLD", label: "보류" },
  { value: "REJECTED", label: "폐기" },
];

export function ApprovalActions({ id }: { id: string }) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState("");

  async function decide(status: string) {
    if (busy) return;
    setBusy(status);

    const supabase = createClient();
    const { error } = await supabase
      .from("approvals")
      .update({
        status,
        ceo_comment: comment.trim() || null,
        decided_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "PENDING");

    if (error) {
      alert("승인 상태 변경에 실패했습니다.");
      console.error(error);
    } else {
      router.refresh();
    }
    setBusy("");
  }

  return (
    <div className="mt-4 border-t border-[#ECEEF2] pt-4">
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder="대표 메모 또는 수정 지시"
        className="w-full resize-none rounded-[10px] border border-[#E1E4E9] px-3 py-2.5 text-[11px] outline-none focus:border-[#3157D5]"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.value}
            onClick={() => decide(action.value)}
            disabled={Boolean(busy)}
            className={`h-9 rounded-[9px] px-3 text-[10px] font-semibold ${
              action.value === "APPROVED"
                ? "bg-[#17181C] text-white"
                : "border border-[#E1E4E9] bg-white text-[#626873]"
            } disabled:opacity-50`}
          >
            {busy === action.value ? "처리 중" : action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
