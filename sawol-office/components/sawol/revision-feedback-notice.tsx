export function RevisionFeedbackNotice({
  feedback,
  executionMode,
}: {
  feedback: { reason: string; created_at: string } | null;
  executionMode: "AUTO" | "MANUAL";
}) {
  if (!feedback) return null;

  return (
    <section className="mt-5 rounded-[16px] border border-[#F0D8D8] bg-[#FFF9F9] p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold text-[#B14444]">
            대표 수정 요청
          </p>
          <p className="mt-2 whitespace-pre-wrap break-words text-[11px] leading-5 text-[#5F646D]">
            {feedback.reason}
          </p>
          <p className="mt-2 text-[9px] text-[#A0A5AE]">
            {new Date(feedback.created_at).toLocaleString("ko-KR")}
          </p>
        </div>

        {executionMode === "MANUAL" ? (
          <a
            href="#manual-task-editor"
            className="flex h-9 shrink-0 items-center justify-center rounded-[9px] border border-[#E3CACA] bg-white px-3.5 text-[10px] font-semibold text-[#A64242]"
          >
            업무 내용 수정으로 이동
          </a>
        ) : (
          <span className="w-fit shrink-0 rounded-full bg-[#EEF2FF] px-2.5 py-1.5 text-[9px] font-semibold text-[#3157D5]">
            자동 재작업에 반영
          </span>
        )}
      </div>
    </section>
  );
}
