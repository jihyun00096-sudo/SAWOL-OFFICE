"use client";

import type { SecretaryAnalysis } from "@/lib/sawol/secretary";

const typeLabel: Record<string, string> = {
  RESEARCH: "리서치",
  PLANNING: "기획",
  PRODUCTION: "제작",
  EDIT: "수정",
  ANALYSIS: "분석",
  OPERATION: "운영",
  STUDY: "학습",
  DEVELOPMENT: "개발",
  DESIGN: "디자인",
  OTHER: "기타",
};

const priorityLabel: Record<string, string> = {
  URGENT: "긴급",
  HIGH: "높음",
  NORMAL: "보통",
  LOW: "낮음",
};

export function SecretaryAnalysisCard({
  analysis,
  projectName,
  departmentName,
  employeeName,
}: {
  analysis: SecretaryAnalysis;
  projectName?: string;
  departmentName?: string;
  employeeName?: string;
}) {
  const confidenceText =
    analysis.confidence >= 80
      ? "높음"
      : analysis.confidence >= 65
        ? "보통"
        : "참고";

  return (
    <section className="rounded-[20px] border border-[#DDE4FA] bg-[#F8FAFF] p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EEF2FF] text-[12px] font-bold text-[#3157D5]">
            윤
          </div>

          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[#24272D]">
              윤서진 비서실장 분석
            </p>
            <p className="mt-1 text-[10px] text-[#858B96]">
              대표 승인 전 · 아직 업무는 등록되지 않았습니다.
            </p>
          </div>
        </div>

        <div className="w-fit rounded-full bg-white px-3 py-1.5 text-[10px] font-medium text-[#636A75] shadow-sm">
          분석 신뢰도 {analysis.confidence}% · {confidenceText}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[
          ["업무 유형", typeLabel[analysis.taskType] ?? analysis.taskType],
          ["우선순위", priorityLabel[analysis.priority] ?? analysis.priority],
          ["추천 프로젝트", projectName || "연결 없음"],
          ["추천 부서", departmentName || "미배정"],
          ["추천 직원", employeeName || "미배정"],
          ["대표 승인", analysis.requiresCeoApproval ? "필요" : "불필요"],
        ].map(([label, value]) => (
          <div
            key={label}
            className="min-w-0 rounded-[13px] border border-[#E4E9F8] bg-white p-3.5"
          >
            <p className="text-[9px] text-[#969CA7]">{label}</p>
            <p className="mt-1.5 truncate text-[11px] font-semibold text-[#30343B]">
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold text-[#3B4049]">
            제안 작업 단계
          </p>

          <ol className="mt-3 space-y-2">
            {analysis.steps.map((step, index) => (
              <li
                key={`${index}-${step}`}
                className="flex items-start gap-2.5 text-[10px] leading-5 text-[#676E79]"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[9px] font-semibold text-[#3157D5]">
                  {index + 1}
                </span>
                <span className="pt-[1px]">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div>
          <p className="text-[11px] font-semibold text-[#3B4049]">
            이렇게 판단했습니다
          </p>

          <ul className="mt-3 space-y-2">
            {analysis.rationale.map((reason, index) => (
              <li
                key={`${index}-${reason}`}
                className="flex items-start gap-2 text-[10px] leading-5 text-[#737A85]"
              >
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#6E86D8]" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-5 rounded-[12px] bg-white/75 px-3.5 py-3">
        <p className="text-[9px] leading-5 text-[#8A909B]">
          현재 STEP 17의 비서실 분석은 외부 AI API를 사용하지 않는 내부 규칙 기반
          분석입니다. 제안값은 대표가 아래에서 직접 수정한 뒤 등록할 수 있습니다.
        </p>
      </div>
    </section>
  );
}
