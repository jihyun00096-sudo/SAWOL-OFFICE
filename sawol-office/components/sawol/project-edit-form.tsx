"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Project = {
  id: string;
  name: string;
  original_request: string;
  objective: string | null;
  expected_result: string | null;
  status: string;
  priority: string;
  risk_level: string;
  progress: number;
  current_stage: string | null;
};

export function ProjectEditForm({ project }: { project: Project }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const form = new FormData(event.currentTarget);
    const status = String(form.get("status") ?? project.status);

    if (
      status === "CANCELLED" &&
      project.status !== "CANCELLED" &&
      !window.confirm(
        "이 프로젝트를 폐기 상태로 변경할까요?\n데이터는 삭제되지 않지만 운영 목록에서 폐기 프로젝트로 분류됩니다.",
      )
    ) {
      return;
    }

    const progressValue = Number(form.get("progress") ?? 0);
    const progress = Math.max(0, Math.min(100, Math.round(progressValue)));

    const name = String(form.get("name") ?? "").trim();
    const originalRequest = String(form.get("original_request") ?? "").trim();

    if (!name || !originalRequest) {
      setMessage("프로젝트명과 최초 요청은 필수입니다.");
      return;
    }

    setBusy(true);
    setMessage("");

    const supabase = createClient();

    const { error } = await supabase
      .from("projects")
      .update({
        name,
        original_request: originalRequest,
        objective: String(form.get("objective") ?? "").trim() || null,
        expected_result:
          String(form.get("expected_result") ?? "").trim() || null,
        status,
        priority: String(form.get("priority") ?? "NORMAL"),
        risk_level: String(form.get("risk_level") ?? "LOW"),
        progress,
        current_stage: String(form.get("current_stage") ?? "").trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", project.id);

    if (error) {
      console.error(error);
      setMessage("프로젝트 수정에 실패했습니다.");
      setBusy(false);
      return;
    }

    setMessage("저장되었습니다.");
    router.refresh();
    setBusy(false);
  }

  const input =
    "h-11 w-full rounded-[10px] border border-[#E1E4E9] bg-white px-3 text-[12px] outline-none focus:border-[#3157D5] focus:ring-4 focus:ring-[#3157D5]/[0.06]";

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div>
        <label className="mb-2 block text-[11px] font-semibold">
          프로젝트명 *
        </label>
        <input
          name="name"
          defaultValue={project.name}
          className={input}
          maxLength={150}
        />
      </div>

      <div>
        <label className="mb-2 block text-[11px] font-semibold">
          최초 요청 *
        </label>
        <textarea
          name="original_request"
          defaultValue={project.original_request}
          rows={4}
          className="w-full rounded-[10px] border border-[#E1E4E9] px-3 py-3 text-[12px] leading-5 outline-none focus:border-[#3157D5]"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-[11px] font-semibold">목적</label>
          <textarea
            name="objective"
            defaultValue={project.objective ?? ""}
            rows={3}
            className="w-full rounded-[10px] border border-[#E1E4E9] px-3 py-3 text-[12px] leading-5 outline-none focus:border-[#3157D5]"
          />
        </div>

        <div>
          <label className="mb-2 block text-[11px] font-semibold">
            원하는 결과
          </label>
          <textarea
            name="expected_result"
            defaultValue={project.expected_result ?? ""}
            rows={3}
            className="w-full rounded-[10px] border border-[#E1E4E9] px-3 py-3 text-[12px] leading-5 outline-none focus:border-[#3157D5]"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-2 block text-[11px] font-semibold">상태</label>
          <select name="status" defaultValue={project.status} className={input}>
            <option value="IDEA">아이디어</option>
            <option value="PLANNING">기획 중</option>
            <option value="IN_PROGRESS">진행 중</option>
            <option value="REVIEW">검수 중</option>
            <option value="APPROVAL_WAIT">승인 대기</option>
            <option value="ON_HOLD">보류</option>
            <option value="COMPLETED">완료</option>
            <option value="CANCELLED">폐기</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-[11px] font-semibold">
            우선순위
          </label>
          <select
            name="priority"
            defaultValue={project.priority}
            className={input}
          >
            <option value="URGENT">긴급</option>
            <option value="HIGH">높음</option>
            <option value="NORMAL">보통</option>
            <option value="LOW">낮음</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-[11px] font-semibold">위험도</label>
          <select
            name="risk_level"
            defaultValue={project.risk_level}
            className={input}
          >
            <option value="LOW">낮음</option>
            <option value="MEDIUM">중간</option>
            <option value="HIGH">높음</option>
            <option value="CRITICAL">매우 높음</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-[11px] font-semibold">
            진행률
          </label>
          <input
            name="progress"
            type="number"
            min={0}
            max={100}
            defaultValue={project.progress}
            className={input}
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-[11px] font-semibold">
          현재 단계
        </label>
        <input
          name="current_stage"
          defaultValue={project.current_stage ?? ""}
          placeholder="예: 시장조사 / 기획 / 개발 / 검수"
          className={input}
        />
      </div>

      {message ? (
        <p className="rounded-[10px] bg-[#F4F5F7] px-3 py-2.5 text-[11px] text-[#666C76]">
          {message}
        </p>
      ) : null}

      <div className="flex justify-end">
        <button
          disabled={busy}
          className="h-10 rounded-[10px] bg-[#17181C] px-5 text-[11px] font-semibold text-white disabled:opacity-50"
        >
          {busy ? "저장 중..." : "프로젝트 저장"}
        </button>
      </div>
    </form>
  );
}
