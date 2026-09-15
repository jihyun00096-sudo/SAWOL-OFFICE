"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const QUICK_REASONS = [
  "전체를 처음부터 다시 검토해줘.",
  "자료와 근거를 다시 조사해서 정확하게 수정해줘.",
  "구성과 문구를 다시 정리해줘.",
  "디자인/이미지 결과가 요청과 달라. 다시 제작해줘.",
];

export function ApprovalTaskActions({
  taskId,
  executionMode = "MANUAL",
}: {
  taskId: string;
  executionMode?: "AUTO" | "MANUAL";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(
    null,
  );
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  async function approve() {
    if (busy) return;

    setBusy("approve");
    setMessage("");

    const supabase = createClient();

    const { data, error } = await supabase.rpc(
      "sawol_finalize_task_approval",
      {
        p_task_id: taskId,
      },
    );

    if (error) {
      setMessage(
        "승인 완료 처리에 실패했습니다. " + error.message,
      );
      setBusy(null);
      return;
    }

    if ((data as any)?.artifacts?.has_result === false) {
      setMessage(
        "업무는 완료됐지만 연결된 실행 결과가 없어 결과함/기억센터에는 생성되지 않았습니다.",
      );
    }

    await supabase
      .from("task_feedback")
      .update({
        status: "RESOLVED",
        resolved_at: new Date().toISOString(),
      })
      .eq("root_task_id", taskId)
      .eq("status", "ACTIVE");

    router.refresh();
    setBusy(null);
  }

  async function reject() {
    const trimmed = reason.trim();

    if (busy || !trimmed) return;

    setBusy("reject");
    setMessage("");

    try {
      const response = await fetch(
        `/api/office/tasks/${taskId}/reject`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reason: trimmed,
          }),
        },
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        throw new Error(
          payload?.message || "반려 처리에 실패했습니다.",
        );
      }

      setOpen(false);
      setReason("");

      if (executionMode === "AUTO") {
        setMessage(
          "반려 접수 완료. 사유를 보존한 채 AUTO 재작업 큐에 등록했습니다. 상시 Worker가 자동으로 다시 처리한 뒤 승인함에 새 결과를 올립니다.",
        );
      } else {
        setMessage(
          "반려 사유를 저장하고 수동 업무를 대기 상태로 되돌렸습니다. 업무 상세에서 직접 수정·재실행해주세요.",
        );
      }

      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "반려 처리 중 오류가 발생했습니다.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          disabled={busy !== null}
          onClick={approve}
          className="h-10 rounded-[10px] bg-[#17181C] px-4 text-[11px] font-semibold text-white disabled:opacity-50"
        >
          {busy === "approve"
            ? "결과 정리 중..."
            : "승인 후 완료"}
        </button>

        <button
          disabled={busy !== null}
          onClick={() => setOpen(true)}
          className="h-10 rounded-[10px] border border-[#F0D2D2] bg-white px-4 text-[11px] font-semibold text-[#B14444] disabled:opacity-50"
        >
          반려 · 수정 요청
        </button>
      </div>

      {message ? (
        <p className="mt-2 max-w-[520px] rounded-[9px] bg-[#FFF7E8] px-3 py-2 text-[10px] leading-5 text-[#8A6824]">
          {message}
        </p>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/30 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-[560px] rounded-[20px] bg-white p-5 shadow-2xl sm:p-6">
            <p className="text-[11px] font-semibold text-[#B14444]">
              대표 반려
            </p>

            <h2 className="mt-1 text-[18px] font-semibold">
              어떤 부분을 다시 작업할까요?
            </h2>

            <p className="mt-2 text-[10px] leading-5 text-[#7A808B]">
              대표 반려 사유는 AI 직원에게 다음 작업 지시로
              전달됩니다. AUTO 업무는 관련 단계부터 다시 열고
              상시 작업 큐에 자동 등록되며, 재작업이 끝나면 다시
              승인함으로 올라옵니다.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {QUICK_REASONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setReason(item)}
                  className="rounded-full border border-[#E2E5EA] bg-[#F8F9FB] px-3 py-1.5 text-left text-[9px] leading-4 text-[#68707C] hover:border-[#C9D3F5] hover:bg-[#F6F8FF]"
                >
                  {item}
                </button>
              ))}
            </div>

            <textarea
              value={reason}
              onChange={(event) =>
                setReason(event.target.value)
              }
              placeholder="예: 전체 구성은 괜찮은데 기사 출처가 부정확해. 기존 결과를 조금 고치는 게 아니라 자료를 다시 조사해서 처음부터 정확하게 만들어줘."
              className="mt-4 min-h-[150px] w-full resize-y rounded-[12px] border border-[#E1E4E9] p-3 text-[11px] leading-5 outline-none focus:border-[#3157D5]"
            />

            <div className="mt-3 rounded-[10px] bg-[#F7F8FA] px-3 py-2 text-[9px] leading-5 text-[#737A85]">
              <p>
                · “처음부터 / 전체 다시” → 첫 단계부터 재작업
              </p>
              <p>
                · “재조사 / 출처 / 근거 / 뉴스” → 조사 단계부터 재작업
              </p>
              <p>
                · “디자인 / 이미지” → 관련 제작 단계부터 재작업
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  if (!busy) setOpen(false);
                }}
                className="h-11 rounded-[10px] border border-[#E1E4E9] text-[11px] font-semibold"
              >
                취소
              </button>

              <button
                onClick={reject}
                disabled={busy !== null || !reason.trim()}
                className="h-11 rounded-[10px] bg-[#B14444] text-[11px] font-semibold text-white disabled:opacity-40"
              >
                {busy === "reject"
                  ? "반려 접수 중..."
                  : executionMode === "AUTO"
                    ? "반려하고 자동 재작업"
                    : "반려하고 대기로 이동"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
