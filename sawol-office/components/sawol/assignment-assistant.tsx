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

const sourceLabel: Record<string, string> = {
  SECRETARY: "비서실장 추천",
  RECOMMENDATION: "추천 재배정",
  MANUAL: "대표 직접 지정",
  BACKFILL: "기존 배정",
};

export function AssignmentAssistant({
  taskId,
  currentEmployeeId,
  currentAssignment,
  candidates,
}: {
  taskId: string;
  currentEmployeeId: string | null;
  currentAssignment?: {
    assignment_source?: string | null;
    match_score?: number | null;
    assignment_reason?: string | null;
  } | null;
  candidates: AssignmentCandidate[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const currentCandidate =
    candidates.find((candidate) => candidate.employee.id === currentEmployeeId) ??
    null;

  const alternatives = candidates
    .filter((candidate) => candidate.employee.id !== currentEmployeeId)
    .slice(0, 5);

  const bestAlternative = alternatives[0] ?? null;

  // 8점 이상 차이 날 때만 재배정을 권장.
  const shouldRecommendReassignment =
    Boolean(currentCandidate && bestAlternative) &&
    bestAlternative!.score >= currentCandidate!.score + 8;

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
        engine: "STEP21_LOCAL_ROUTER_V2",
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

  return (
    <section className="rounded-[18px] border border-[#E7E9EE] bg-white p-4 sm:p-5 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-semibold">AI 직원 배정</p>
            <span className="rounded-full bg-[#EEF2FF] px-2 py-1 text-[8px] font-medium text-[#3157D5]">
              STEP 21
            </span>
          </div>
          <p className="mt-1 max-w-[760px] text-[10px] leading-5 text-[#8B919C]">
            전문분야, 조직, 현재 상태와 업무량을 함께 비교합니다. 이미 담당자가 있는 경우에는
            현재 배정을 기준으로 재배정 필요 여부를 판단합니다.
          </p>
        </div>

        {currentEmployeeId ? (
          <button
            type="button"
            onClick={unassign}
            disabled={Boolean(busyId)}
            className="h-9 shrink-0 whitespace-nowrap rounded-[9px] border border-[#E1E4E9] bg-white px-3 text-[10px] font-medium text-[#727884] disabled:opacity-50"
          >
            {busyId === "__unassign__" ? "처리 중..." : "미배정으로 변경"}
          </button>
        ) : null}
      </div>

      {currentCandidate ? (
        <div className="mt-5 rounded-[15px] border border-[#DDE4FA] bg-[#F8FAFF] p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-semibold text-[#3157D5]">
                  현재 담당
                </span>
                <span className="text-[9px] text-[#7D8490]">
                  현재 적합도 {currentCandidate.score}%
                </span>
                {currentAssignment?.assignment_source ? (
                  <span className="text-[9px] text-[#7D8490]">
                    {sourceLabel[currentAssignment.assignment_source] ??
                      currentAssignment.assignment_source}
                    {typeof currentAssignment.match_score === "number"
                      ? ` · 최초 ${currentAssignment.match_score}%`
                      : ""}
                  </span>
                ) : null}
              </div>

              <p className="mt-3 break-words text-[15px] font-semibold">
                {currentCandidate.employee.name}
              </p>
              <p className="mt-1 break-words text-[10px] text-[#818793]">
                {currentCandidate.employee.employee_code} ·{" "}
                {currentCandidate.employee.position}
              </p>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {currentCandidate.reasons.map((reason) => (
                  <span
                    key={reason}
                    className="rounded-full bg-white px-2.5 py-1 text-[9px] text-[#6F7681]"
                  >
                    {reason}
                  </span>
                ))}
              </div>
            </div>

            <div className="shrink-0 rounded-[11px] bg-white px-4 py-3 text-center">
              <p
                className={`text-[10px] font-semibold ${
                  shouldRecommendReassignment
                    ? "text-[#A06D19]"
                    : "text-[#2D7650]"
                }`}
              >
                {shouldRecommendReassignment
                  ? "재배정 검토 권장"
                  : "현재 배정 유지 권장"}
              </p>
              <p className="mt-1 text-[9px] text-[#9297A1]">
                {shouldRecommendReassignment && bestAlternative
                  ? `${bestAlternative.employee.name} 직원이 ${bestAlternative.score}%로 더 높습니다.`
                  : "현재 담당자가 추천 후보 대비 충분히 적합합니다."}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {!candidates.length ? (
        <div className="mt-5 rounded-[13px] bg-[#F7F8FA] p-5 text-center">
          <p className="text-[10px] text-[#858B96]">
            현재 배정 가능한 활성 직원이 없습니다.
          </p>
        </div>
      ) : !currentCandidate ? (
        <div className="mt-5 rounded-[15px] border border-[#DDE4FA] bg-[#F8FAFF] p-4 sm:p-5">
          <p className="text-[9px] font-semibold text-[#3157D5]">1순위 추천</p>
          <p className="mt-2 text-[15px] font-semibold">{candidates[0].employee.name}</p>
          <p className="mt-1 text-[10px] text-[#818793]">
            {candidates[0].employee.employee_code} · {candidates[0].employee.position}
            {" · "}적합도 {candidates[0].score}%
          </p>
          <button
            type="button"
            onClick={() => assign(candidates[0])}
            disabled={Boolean(busyId)}
            className="mt-4 h-10 whitespace-nowrap rounded-[10px] bg-[#3157D5] px-5 text-[11px] font-semibold text-white disabled:opacity-40"
          >
            {busyId === candidates[0].employee.id ? "배정 중..." : "추천 직원 배정"}
          </button>
        </div>
      ) : null}

      {alternatives.length ? (
        <div className="mt-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold">
                {currentCandidate ? "재배정 후보" : "추가 후보"}
              </p>
              <p className="mt-1 text-[9px] text-[#989EA8]">
                점수 차이가 작다면 현재 담당자를 유지하는 것을 권장합니다.
              </p>
            </div>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {alternatives.map((candidate, index) => (
              <div
                key={candidate.employee.id}
                className="rounded-[14px] border border-[#EAECF0] p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[9px] font-semibold text-[#8A909B]">
                        후보 {index + 1}
                      </span>
                      <span className="text-[9px] text-[#999EA7]">
                        적합도 {candidate.score}%
                      </span>
                    </div>
                    <p className="mt-2 break-words text-[12px] font-semibold">
                      {candidate.employee.name}
                    </p>
                    <p className="mt-1 break-words text-[9px] text-[#9197A1]">
                      {candidate.employee.employee_code} ·{" "}
                      {candidate.employee.position}
                    </p>
                    <p className="mt-2 text-[9px] text-[#9298A3]">
                      {statusLabel[candidate.employee.status] ??
                        candidate.employee.status}
                      {" · "}다른 활성 업무 {candidate.workload.active}건
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => assign(candidate)}
                    disabled={Boolean(busyId)}
                    className="h-9 shrink-0 whitespace-nowrap rounded-[9px] border border-[#E1E4E9] bg-white px-3 text-[9px] font-medium text-[#666D78] disabled:opacity-40"
                  >
                    {busyId === candidate.employee.id ? "배정 중..." : "재배정"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {message ? (
        <p className="mt-4 rounded-[10px] bg-[#F4F5F7] px-3 py-2.5 text-[10px] leading-5 text-[#666C76]">
          {message}
        </p>
      ) : null}
    </section>
  );
}
