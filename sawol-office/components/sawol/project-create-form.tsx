"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createHumanCode } from "@/lib/sawol/code";

export function ProjectCreateForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const request = String(form.get("original_request") ?? "").trim();

    if (!name || !request) {
      setError("프로젝트명과 최초 요청은 필수입니다.");
      return;
    }

    setBusy(true);
    setError("");

    const supabase = createClient();
    const { error: insertError } = await supabase.from("projects").insert({
      project_code: createHumanCode("PRJ"),
      name,
      original_request: request,
      objective: String(form.get("objective") ?? "").trim() || null,
      expected_result: String(form.get("expected_result") ?? "").trim() || null,
      priority: String(form.get("priority") ?? "NORMAL"),
      risk_level: String(form.get("risk_level") ?? "LOW"),
      status: "PLANNING",
      progress: 0,
      current_stage: "초기 기획",
    });

    if (insertError) {
      console.error(insertError);
      setError("프로젝트 생성에 실패했습니다.");
      setBusy(false);
      return;
    }

    setOpen(false);
    router.refresh();
    setBusy(false);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="h-10 rounded-[10px] bg-[#17181C] px-4 text-[12px] font-semibold text-white">
        새 프로젝트
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4 backdrop-blur-[1px]">
      <div className="w-full max-w-[560px] rounded-[22px] bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-semibold">새 프로젝트</h2>
          <button onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-[12px] text-[#777D87] hover:bg-[#F4F5F7]">닫기</button>
        </div>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <input name="name" placeholder="프로젝트명 *" className="h-11 w-full rounded-[11px] border border-[#E1E4E9] px-3.5 text-[13px] outline-none focus:border-[#3157D5]" />
          <textarea name="original_request" rows={4} placeholder="처음 이 프로젝트를 만들게 된 요청 *" className="w-full rounded-[11px] border border-[#E1E4E9] px-3.5 py-3 text-[13px] outline-none focus:border-[#3157D5]" />
          <input name="objective" placeholder="목적" className="h-11 w-full rounded-[11px] border border-[#E1E4E9] px-3.5 text-[13px] outline-none focus:border-[#3157D5]" />
          <input name="expected_result" placeholder="원하는 최종 결과" className="h-11 w-full rounded-[11px] border border-[#E1E4E9] px-3.5 text-[13px] outline-none focus:border-[#3157D5]" />
          <div className="grid grid-cols-2 gap-3">
            <select name="priority" defaultValue="NORMAL" className="h-11 rounded-[11px] border border-[#E1E4E9] px-3 text-[12px]">
              <option value="URGENT">긴급</option><option value="HIGH">높음</option><option value="NORMAL">보통</option><option value="LOW">낮음</option>
            </select>
            <select name="risk_level" defaultValue="LOW" className="h-11 rounded-[11px] border border-[#E1E4E9] px-3 text-[12px]">
              <option value="LOW">낮은 위험</option><option value="MEDIUM">중간 위험</option><option value="HIGH">높은 위험</option><option value="CRITICAL">매우 높은 위험</option>
            </select>
          </div>

          {error ? <p className="rounded-[10px] bg-[#FFF1F1] px-3 py-2 text-[11px] text-[#B14444]">{error}</p> : null}

          <button disabled={busy} className="h-11 w-full rounded-[11px] bg-[#17181C] text-[12px] font-semibold text-white disabled:opacity-50">
            {busy ? "생성 중..." : "프로젝트 생성"}
          </button>
        </form>
      </div>
    </div>
  );
}
