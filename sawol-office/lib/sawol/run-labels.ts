export const runStatusLabel: Record<string, string> = {
  READY: "실행 준비",
  RUNNING: "실행 중",
  SUBMITTED: "결과 제출",
  COMPLETED: "검수 완료",
  FAILED: "실행 오류",
  CANCELLED: "취소",
};

export const runStatusTone: Record<string, string> = {
  READY: "bg-[#F2F4F7] text-[#666C76]",
  RUNNING: "bg-[#EEF2FF] text-[#3157D5]",
  SUBMITTED: "bg-[#FFF7E6] text-[#8A6824]",
  COMPLETED: "bg-[#ECF8F1] text-[#2F7A51]",
  FAILED: "bg-[#FFF1F1] text-[#B14444]",
  CANCELLED: "bg-[#F4F5F7] text-[#777D87]",
};
