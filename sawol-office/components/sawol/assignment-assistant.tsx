"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { AssignmentCandidate } from "@/lib/sawol/assignment";

const statusLabel: Record<string, string> = {
  AVAILABLE: "업무 대기",
  WAITING: "대기",
  WORKING: "업무 중",
  REVIEWING: "검수 중",
  APPROVAL_WAIT: "대표 승인 대기",
  BLOCKED: "문제 발생",
  OFFLINE: "비활성",
};

export function AssignmentAssistant({
  taskId,
  currentEmployeeId,
  candidates,
}: {
  taskId: string;
  currentEmployeeId: string | null;
  candidates: AssignmentCandidate[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function assign(candidate: AssignmentCandidate) {
    if (busyId) return;

    setBusyId(candidate.employee.id);
    setMessage("");

    const supabase = createClient();

    const { error } = await supabase.rpc("sawol_assign_task", {
      p_task_id: taskId,
      p_employee_id: candidate.employee.id,
      p_assignment_source: "RECOMMENDATION",
      p_assignment_reason: candidate.reasons.join(" / "),
      p_match_score: candidate.score,
      p_metadata: {
        engine: "STEP21_LOCAL_ROUTER",
        workload_at_assignment: candidate.workload,
      },
    });

    if (error) {
      console.error(error);
      setMessage(
        `직원 배정에 실패했습니다. ${error.message || "STEP21 SQL 적용 여부를 확인해주세요."}`,
      );
      setBusyId(null);
      return;
    }

    setMessage(`${candidate.employee.name} 직원에게 배정했습니다.`);
    router.refresh();
    setBusyId(null);
  }

  async function unassign() {
    if (busyId) return;

    setBusyId("__unassign__");
    setMessage("");

    const supabase = createClient();

    const { error } = await supabase.rpc("sawol_unassign_task", {
      p_task_id: taskId,
    });

    if (error) {
      console.error(error);
      setMessage(
        `미배정 처리에 실패했습니다. ${error.message || "STEP21 SQL 적용 여부를 확인해주세요."}`,
      );
      setBusyId(null);
      return;
    }

    setMessage("담당 직원을 미배정으로 변경했습니다.");
    router.refresh();
    setBusyId(null);
  }

  const top = candidates[0];

  return (
    <section className="rounded-[18px] border border-[#E7E9EE] bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-semibold">AI 직원 배정</p>
            <span className="rounded-full bg-[#EEF2FF] px-2 py-1 text-[8px] font-medium text-[#3157D5]">
              STEP 21
            </span>
          </div>
          <p className="mt-1 max-w-[700px] text-[10px] leading-5 text-[#8B919C]">
            전문분야, 조직, 현재 상태와 업무량을 함께 비교한 추천입니다.
            추천 점수는 참고용이며 대표가 언제든 다른 직원을 선택할 수 있습니다.
          </p>
        </div>

        {currentEmployeeId ? (
          <button
            type="button"
            onClick={unassign}
            disabled={Boolean(busyId)}
            className="h-9 shrink-0 rounded-[9px] border border-[#E1E4E9] bg-white px-3 text-[10px] font-medium text-[#727884] disabled:opacity-50"
          >
            {busyId === "__unassign__" ? "처리 중..." : "미배정으로 변경"}
          </button>
        ) : null}
      </div>

      {!candidates.length ? (
        <div className="mt-5 rounded-[13px] bg-[#F7F8FA] p-5 text-center">
          <p className="text-[10px] text-[#858B96]">
            현재 배정 가능한 활성 직원이 없습니다.
          </p>
        </div>
      ) : (
        <>
          {top ? (
            <div className="mt-5 rounded-[15px] border border-[#DDE4FA] bg-[#F8FAFF] p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-semibold text-[#3157D5]">
                      1순위 추천
                    </span>
                    <span className="text-[10px] text-[#7D8490]">
                      적합도 {top.score}%
                    </span>
                  </div>

                  <p className="mt-3 text-[15px] font-semibold">
                    {top.employee.name}
                  </p>
                  <p className="mt-1 text-[10px] text-[#818793]">
                    {top.employee.employee_code} · {top.employee.position}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {top.reasons.map((reason) => (
                      <span
                        key={reason}
                        className="rounded-full bg-white px-2.5 py-1 text-[9px] text-[#6F7681]"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => assign(top)}
                  disabled={
                    Boolean(busyId) || currentEmployeeId === top.employee.id
                  }
                  className="h-10 shrink-0 rounded-[10px] bg-[#3157D5] px-5 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {currentEmployeeId === top.employee.id
                    ? "현재 담당"
                    : busyId === top.employee.id
                      ? "배정 중..."
                      : "추천 직원 배정"}
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {candidates.slice(1, 5).map((candidate, index) => (
              <div
                key={candidate.employee.id}
                className="rounded-[14px] border border-[#EAECF0] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[9px] font-semibold text-[#8A909B]">
                        {index + 2}순위
                      </span>
                      <span className="text-[9px] text-[#999EA7]">
                        적합도 {candidate.score}%
                      </span>
                    </div>
                    <p className="mt-2 text-[12px] font-semibold">
                      {candidate.employee.name}
                    </p>
                    <p className="mt-1 truncate text-[9px] text-[#9197A1]">
                      {candidate.employee.employee_code} ·{" "}
                      {candidate.employee.position}
                    </p>
                    <p className="mt-2 text-[9px] text-[#9298A3]">
                      {statusLabel[candidate.employee.status] ??
                        candidate.employee.status}
                      {" · "}
                      활성 업무 {candidate.workload.active}건
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => assign(candidate)}
                    disabled={
                      Boolean(busyId) ||
                      currentEmployeeId === candidate.employee.id
                    }
                    className="shrink-0 rounded-[9px] border border-[#E1E4E9] bg-white px-3 py-2 text-[9px] font-medium text-[#666D78] disabled:opacity-40"
                  >
                    {currentEmployeeId === candidate.employee.id
                      ? "현재 담당"
                      : busyId === candidate.employee.id
                        ? "배정 중..."
                        : "배정"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {message ? (
        <p className="mt-4 rounded-[10px] bg-[#F4F5F7] px-3 py-2.5 text-[10px] leading-5 text-[#666C76]">
          {message}
        </p>
      ) : null}
    </section>
  );
}
