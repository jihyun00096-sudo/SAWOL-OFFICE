"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AiExecuteButton({
  runId,
  runStatus,
  configured,
  provider,
  providerLabel,
  model,
  researchMode,
}: {
  runId: string;
  runStatus: string;
  configured: boolean;
  provider: "mock" | "openai" | "gemini";
  providerLabel: string;
  model: string;
  researchMode: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [warning, setWarning] = useState("");

  const canExecute = ["READY", "RUNNING", "FAILED"].includes(runStatus);
  const isMock = provider === "mock";
  const isGemini = provider === "gemini";

  async function execute() {
    if (busy || !configured || !canExecute) return;

    setBusy(true);
    setMessage("");
    setWarning("");

    try {
      const response = await fetch(`/api/ai/runs/${runId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        setMessage(
          payload?.message ||
            `AI 실행 요청이 실패했습니다. HTTP ${response.status}`,
        );
        setBusy(false);
        router.refresh();
        return;
      }

      if (payload.warning) setWarning(payload.warning);
      router.refresh();
    } catch (error) {
      console.error(error);
      setMessage(
        "AI 실행 요청 중 네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return (
      <div className="rounded-[14px] border border-[#F0D2D2] bg-[#FFF8F8] p-4">
        <p className="text-[11px] font-semibold text-[#A64242]">
          AI Provider 설정 필요
        </p>
        <p className="mt-1 text-[10px] leading-5 text-[#9A6666]">
          현재 Provider가 사용할 수 없는 상태입니다. .env.local의 Provider와 API Key를 확인해주세요.
        </p>
      </div>
    );
  }

  if (!canExecute) return null;

  return (
    <div
      className={`rounded-[14px] border p-4 ${
        isMock
          ? "border-[#DCE8DD] bg-[#F7FBF7]"
          : isGemini
            ? "border-[#DDE6F8] bg-[#F8FAFF]"
            : "border-[#DCE4FF] bg-[#F8FAFF]"
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p
              className={`text-[11px] font-semibold ${
                isMock ? "text-[#3B7748]" : "text-[#2348C5]"
              }`}
            >
              {providerLabel}
            </p>

            <span className="rounded-full bg-white px-2 py-1 text-[8px] text-[#778099]">
              {model}
            </span>

            {isMock ? (
              <span className="rounded-full bg-[#EAF6EC] px-2 py-1 text-[8px] font-medium text-[#3B7748]">
                비용 0원
              </span>
            ) : null}

            {isGemini ? (
              <span className="rounded-full bg-[#EDF4FF] px-2 py-1 text-[8px] font-medium text-[#3157D5]">
                무료 등급 지원 모델
              </span>
            ) : null}

            {!isMock && researchMode ? (
              <span className="rounded-full bg-[#FFF5DD] px-2 py-1 text-[8px] text-[#8A6824]">
                외부 웹 검색 없음
              </span>
            ) : null}
          </div>

          <p className="mt-2 max-w-[680px] text-[10px] leading-5 text-[#70798D]">
            {isMock
              ? "실제 API 비용 없이 업무 실행 → 결과 저장 → 검수 흐름을 테스트합니다. 외부 사실이나 최신 정보는 실제로 조회하지 않습니다."
              : isGemini
                ? "Gemini가 회사 기억, 프로젝트, 담당 직원, 업무 지시와 STEP22 인수인계를 읽고 실제 결과물을 생성합니다. 무료 테스트에서는 외부 Google 검색을 사용하지 않습니다."
                : "회사 기억, 프로젝트, 담당 부서·직원, 현재 업무 지시를 조합해 실제 AI 결과물을 생성합니다. 결과는 검수 대기로 이동합니다."}
          </p>
        </div>

        <button
          type="button"
          onClick={execute}
          disabled={busy}
          className={`h-10 shrink-0 rounded-[10px] px-5 text-[11px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
            isMock
              ? "bg-[#3D7B4C] hover:bg-[#32683F]"
              : "bg-[#3157D5] hover:bg-[#294BC0]"
          }`}
        >
          {busy
            ? isMock
              ? "Mock AI가 테스트 중..."
              : isGemini
                ? "Gemini가 업무 수행 중..."
                : "AI가 업무 수행 중..."
            : runStatus === "FAILED"
              ? "AI 실행 다시 시도"
              : isMock
                ? "무료 Mock AI로 실행"
                : isGemini
                  ? "Gemini로 업무 실행"
                  : "AI로 업무 실행"}
        </button>
      </div>

      {busy ? (
        <div className="mt-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-current opacity-40" />
          </div>
          <p className="mt-2 text-[9px] leading-5 text-[#778099]">
            실행 결과를 생성하고 저장하는 중입니다. 같은 버튼을 반복해서 누르지 마세요.
          </p>
        </div>
      ) : null}

      {message ? (
        <p className="mt-3 rounded-[9px] bg-[#FFF0F0] px-3 py-2 text-[10px] leading-5 text-[#A64242]">
          {message}
        </p>
      ) : null}

      {warning ? (
        <p className="mt-3 rounded-[9px] bg-[#FFF8E8] px-3 py-2 text-[10px] leading-5 text-[#8A6824]">
          {warning}
        </p>
      ) : null}
    </div>
  );
}
