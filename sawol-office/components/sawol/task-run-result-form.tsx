"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function TaskRunResultForm({
  runId,
  taskId,
}: {
  runId: string;
  taskId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const form = new FormData(event.currentTarget);
    const title = String(form.get("result_title") ?? "").trim();
    const summary = String(form.get("result_summary") ?? "").trim();
    const body = String(form.get("result_body") ?? "").trim();

    if (!title || !body) {
      setMessage("결과 제목과 결과 내용은 필수입니다.");
      return;
    }

    setBusy(true);
    setMessage("");

    const supabase = createClient();
    const now = new Date().toISOString();

    const { error: runError } = await supabase
      .from("task_runs")
      .update({
        status: "SUBMITTED",
        result_title: title,
        result_summary: summary || null,
        result_body: body,
        submitted_at: now,
        updated_at: now,
      })
      .eq("id", runId);

    if (runError) {
      console.error(runError);
      setMessage("결과 저장에 실패했습니다.");
      setBusy(false);
      return;
    }

    const { error: taskError } = await supabase
      .from("tasks")
      .update({
        status: "REVIEW",
        updated_at: now,
      })
      .eq("id", taskId);

    if (taskError) {
      console.error(taskError);
      setMessage(
        "결과는 저장됐지만 업무를 검수 대기로 이동하지 못했습니다. 업무 상태를 확인해주세요.",
      );
      setBusy(false);
      router.refresh();
      return;
    }

    router.refresh();
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="mb-2 block text-[10px] font-semibold">
          결과 제목 *
        </label>
        <input
          name="result_title"
          placeholder="예: 경쟁 강의 10개 조사 결과"
          className="h-11 w-full rounded-[10px] border border-[#E1E4E9] px-3 text-[11px] outline-none focus:border-[#3157D5]"
        />
      </div>

      <div>
        <label className="mb-2 block text-[10px] font-semibold">
          한 줄 요약
        </label>
        <input
          name="result_summary"
          placeholder="대표가 빠르게 확인할 핵심 요약"
          className="h-11 w-full rounded-[10px] border border-[#E1E4E9] px-3 text-[11px] outline-none focus:border-[#3157D5]"
        />
      </div>

      <div>
        <label className="mb-2 block text-[10px] font-semibold">
          결과 내용 *
        </label>
        <textarea
          name="result_body"
          rows={9}
          placeholder="조사 결과, 제작 내용, 검토 결과 등을 입력해주세요."
          className="w-full resize-y rounded-[10px] border border-[#E1E4E9] px-3 py-3 text-[11px] leading-6 outline-none focus:border-[#3157D5]"
        />
      </div>

      {message ? (
        <p className="rounded-[9px] bg-[#FFF1F1] px-3 py-2 text-[10px] text-[#B14444]">
          {message}
        </p>
      ) : null}

      <button
        disabled={busy}
        className="h-11 w-full rounded-[10px] bg-[#17181C] text-[11px] font-semibold text-white disabled:opacity-50"
      >
        {busy ? "제출 중..." : "결과 제출 → 검수 대기"}
      </button>
    </form>
  );
}
