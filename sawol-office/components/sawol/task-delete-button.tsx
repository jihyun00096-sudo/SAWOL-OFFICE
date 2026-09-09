"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function TaskDeleteButton({
  taskId,
  taskTitle,
}: {
  taskId: string;
  taskTitle: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function deleteTask() {
    if (busy || !confirmed) return;

    setBusy(true);
    setMessage("");

    const supabase = createClient();

    const [
      { count: resultCount, error: resultError },
      { count: approvalCount, error: approvalError },
    ] = await Promise.all([
      supabase
        .from("results")
        .select("id", { count: "exact", head: true })
        .eq("task_id", taskId),
      supabase
        .from("approvals")
        .select("id", { count: "exact", head: true })
        .eq("task_id", taskId),
    ]);

    if (resultError || approvalError) {
      console.error("Task dependency check failed", {
        resultError,
        approvalError,
      });
      setMessage("연결 데이터 확인 중 문제가 발생했습니다.");
      setBusy(false);
      return;
    }

    if ((resultCount ?? 0) > 0 || (approvalCount ?? 0) > 0) {
      setMessage(
        `삭제할 수 없습니다. 이 업무에 결과 ${resultCount ?? 0}건, 승인 ${approvalCount ?? 0}건이 연결되어 있습니다. 연결 데이터를 먼저 정리하거나 업무 상태를 '폐기'로 변경해주세요.`,
      );
      setBusy(false);
      return;
    }

    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId);

    if (error) {
      console.error(error);
      setMessage(
        "업무 삭제에 실패했습니다. RLS 권한 또는 연결된 데이터가 있는지 확인해주세요.",
      );
      setBusy(false);
      return;
    }

    router.replace("/tasks");
    router.refresh();
  }

  function openModal() {
    setOpen(true);
    setConfirmed(false);
    setMessage("");
  }

  function closeModal() {
    if (busy) return;
    setOpen(false);
    setConfirmed(false);
    setMessage("");
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="flex h-10 w-full items-center justify-center rounded-[10px] border border-[#F0D2D2] bg-white px-4 text-[11px] font-semibold text-[#B14444] transition hover:bg-[#FFF7F7] sm:w-auto"
      >
        업무 삭제
      </button>

      {open ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/30 p-4 backdrop-blur-[2px]">
          <button
            type="button"
            aria-label="닫기"
            onClick={closeModal}
            className="absolute inset-0 cursor-default"
          />

          <div className="relative max-h-[calc(100dvh-32px)] w-full max-w-[460px] overflow-y-auto rounded-[20px] bg-white p-5 shadow-2xl sm:p-6">
            <p className="text-[11px] font-semibold text-[#B14444]">
              위험 작업
            </p>

            <h2 className="mt-1.5 text-[18px] font-semibold tracking-[-0.02em]">
              업무 완전 삭제
            </h2>

            <p className="mt-3 break-keep text-[11px] leading-5 text-[#777D87]">
              삭제된 업무는 복구할 수 없습니다. 결과물 또는 승인 데이터가 연결되어
              있는 경우 운영 이력 보호를 위해 삭제가 차단됩니다.
            </p>

            <div className="mt-5 rounded-[12px] bg-[#F7F8FA] p-3.5">
              <p className="text-[10px] text-[#969BA5]">삭제할 업무</p>
              <p className="mt-1 break-words text-[12px] font-semibold text-[#272A30]">
                {taskTitle}
              </p>
            </div>

            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-[12px] border border-[#E8EAF0] bg-white p-3.5">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#B14444]"
              />
              <span>
                <span className="block text-[11px] font-semibold text-[#343842]">
                  확인했습니다
                </span>
                <span className="mt-1 block text-[10px] leading-5 text-[#8A909B]">
                  삭제 후 복구할 수 없다는 내용을 확인했습니다.
                </span>
              </span>
            </label>

            {message ? (
              <p className="mt-3 rounded-[10px] bg-[#FFF3F3] px-3 py-2.5 text-[10px] leading-5 text-[#A64242]">
                {message}
              </p>
            ) : null}

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={closeModal}
                disabled={busy}
                className="h-11 rounded-[10px] border border-[#E1E4E9] bg-white text-[11px] font-semibold text-[#656B75]"
              >
                취소
              </button>

              <button
                type="button"
                onClick={deleteTask}
                disabled={busy || !confirmed}
                className="h-11 rounded-[10px] bg-[#B14444] text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? "확인 중..." : "완전 삭제"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
