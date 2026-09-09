"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createHumanCode } from "@/lib/sawol/code";

type Department = {
  id: string;
  code: string;
  name: string;
  department_type: string;
};

export function CommandForm({ departments }: { departments: Department[] }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();

    if (!title || !description) {
      setSuccess(false);
      setMessage("업무 제목과 업무 내용을 입력해주세요.");
      return;
    }

    setSubmitting(true);
    setMessage("");

    const supabase = createClient();
    const departmentId = String(form.get("department_id") ?? "") || null;

    const { error } = await supabase.from("tasks").insert({
      task_code: createHumanCode("TASK"),
      title,
      description,
      task_type: String(form.get("task_type") ?? "OTHER"),
      priority: String(form.get("priority") ?? "NORMAL"),
      assigned_department_id: departmentId,
      requires_ceo_approval: form.get("requires_ceo_approval") === "on",
      status: "WAITING",
      review_level: 0,
      input_data: {
        source: "CEO_COMMAND",
      },
      output_requirements: {
        requested_result: String(form.get("expected_result") ?? "").trim(),
      },
    });

    if (error) {
      console.error(error);
      setSuccess(false);
      setMessage("업무 등록에 실패했습니다. 입력값과 Supabase 연결을 확인해주세요.");
      setSubmitting(false);
      return;
    }

    setSuccess(true);
    setMessage("업무가 등록되었습니다. 전체 업무에서 확인할 수 있습니다.");
    event.currentTarget.reset();
    router.refresh();
    setSubmitting(false);
  }

  const input =
    "h-11 w-full rounded-[11px] border border-[#E1E4E9] bg-white px-3.5 text-[13px] outline-none transition focus:border-[#3157D5] focus:ring-4 focus:ring-[#3157D5]/[0.07]";

  return (
    <form onSubmit={submit} className="rounded-[20px] border border-[#E7E9EE] bg-white p-5 sm:p-6">
      <div className="grid gap-5">
        <div>
          <label className="mb-2 block text-[12px] font-semibold">업무 제목 *</label>
          <input name="title" className={input} placeholder="예: 타로 기록 서비스 경쟁사이트 조사" maxLength={120} />
        </div>

        <div>
          <label className="mb-2 block text-[12px] font-semibold">업무 내용 *</label>
          <textarea
            name="description"
            rows={7}
            className="w-full resize-y rounded-[12px] border border-[#E1E4E9] bg-white px-3.5 py-3 text-[13px] leading-6 outline-none transition focus:border-[#3157D5] focus:ring-4 focus:ring-[#3157D5]/[0.07]"
            placeholder="무엇을 조사하고, 만들고, 확인해야 하는지 자연스럽게 적어주세요."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-[12px] font-semibold">업무 유형</label>
            <select name="task_type" className={input} defaultValue="OTHER">
              <option value="RESEARCH">리서치</option>
              <option value="PLANNING">기획</option>
              <option value="PRODUCTION">제작</option>
              <option value="EDIT">수정</option>
              <option value="ANALYSIS">분석</option>
              <option value="OPERATION">운영</option>
              <option value="STUDY">학습</option>
              <option value="DEVELOPMENT">개발</option>
              <option value="DESIGN">디자인</option>
              <option value="OTHER">기타</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-[12px] font-semibold">우선순위</label>
            <select name="priority" className={input} defaultValue="NORMAL">
              <option value="URGENT">긴급</option>
              <option value="HIGH">높음</option>
              <option value="NORMAL">보통</option>
              <option value="LOW">낮음</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-[12px] font-semibold">담당 부서</label>
          <select name="department_id" className={input} defaultValue="">
            <option value="">비서실 자동배정 대기</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[10px] text-[#999EA7]">선택하지 않으면 향후 비서실 AI가 자동배정합니다.</p>
        </div>

        <div>
          <label className="mb-2 block text-[12px] font-semibold">원하는 결과물</label>
          <input name="expected_result" className={input} placeholder="예: 경쟁사 10곳 비교표 + 핵심 시사점" maxLength={300} />
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-[12px] bg-[#F7F8FA] p-3.5">
          <input type="checkbox" name="requires_ceo_approval" className="mt-0.5 h-4 w-4 accent-[#3157D5]" />
          <span>
            <span className="block text-[12px] font-medium">완료 후 대표 승인 필요</span>
            <span className="mt-1 block text-[10px] leading-4 text-[#9297A1]">중요한 결과물이라면 승인 단계를 지정합니다.</span>
          </span>
        </label>

        {message ? (
          <div className={`rounded-[11px] px-4 py-3 text-[12px] ${success ? "bg-[#EEF8F2] text-[#2C7B50]" : "bg-[#FFF1F1] text-[#B14444]"}`}>
            {message}
          </div>
        ) : null}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="h-11 rounded-[11px] bg-[#17181C] px-5 text-[12px] font-semibold text-white transition hover:bg-[#292B31] disabled:opacity-50"
          >
            {submitting ? "등록 중..." : "업무 등록"}
          </button>
        </div>
      </div>
    </form>
  );
}
