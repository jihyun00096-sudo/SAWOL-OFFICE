"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function MemoryDeleteButton({
  memoryId,
  memoryTitle,
}: {
  memoryId: string;
  memoryTitle: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function close() {
    if (busy) return;
    setOpen(false);
    setConfirmed(false);
    setMessage("");
  }

  async function remove() {
    if (!confirmed || busy) return;

    setBusy(true);
    setMessage("");

    const supabase = createClient();

    const { data, error } = await supabase
      .from("memories")
      .delete()
      .eq("id", memoryId)
      .select("id");

    if (error) {
      console.error(error);
      setMessage(
        `기억 삭제에 실패했습니다. ${error.message || "삭제 권한을 확인해주세요."}`,
      );
      setBusy(false);
      return;
    }

    if (!data || data.length !== 1) {
      setMessage(
        "삭제된 기억이 없습니다. Supabase의 memories DELETE 권한(RLS)을 확인해주세요.",
      );
      setBusy(false);
      return;
    }

    setOpen(false);
    setConfirmed(false);
    setBusy(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-[8px] border border-[#F1D7D7] bg-white px-2.5 py-1.5 text-[9px] font-medium text-[#C55252] transition hover:bg-[#FFF8F8]"
      >
        삭제
      </button>

      {open ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/25 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-[460px] rounded-[22px] bg-white p-5 shadow-2xl sm:p-6">
            <p className="text-[10px] font-semibold text-[#C55252]">
              기억 영구 삭제
            </p>
            <h2 className="mt-2 text-[17px] font-semibold">
              이 기억을 삭제할까요?
            </h2>

            <p className="mt-2 break-words text-[11px] leading-5 text-[#777D87]">
              {memoryTitle}
            </p>

            <div className="mt-5 rounded-[12px] bg-[#FFF7F7] p-4">
              <p className="text-[10px] leading-5 text-[#A85A5A]">
                삭제하면 앞으로 AI Context에서 이 기억을 사용하지 않습니다.
                원본 업무와 결과함 데이터는 유지됩니다.
              </p>
            </div>

            <label className="mt-4 flex cursor-pointer items-center gap-2 rounded-[11px] border border-[#E7E9EE] p-3">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                className="accent-[#C55252]"
              />
              <span className="text-[11px] text-[#555B65]">
                삭제 내용을 확인했습니다.
              </span>
            </label>

            {message ? (
              <p className="mt-3 rounded-[9px] bg-[#FFF1F1] px-3 py-2 text-[10px] leading-5 text-[#B14444]">
                {message}
              </p>
            ) : null}

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={close}
                disabled={busy}
                className="h-11 rounded-[10px] border border-[#E1E4E9] bg-white text-[11px] font-semibold text-[#656B75] disabled:opacity-50"
              >
                취소
              </button>

              <button
                type="button"
                onClick={remove}
                disabled={!confirmed || busy}
                className="h-11 rounded-[10px] bg-[#C55252] text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? "삭제 중..." : "완전 삭제"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
