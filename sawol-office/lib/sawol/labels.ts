export const projectStatusLabel: Record<string, string> = {
  IDEA: "아이디어",
  PLANNING: "기획 중",
  IN_PROGRESS: "진행 중",
  REVIEW: "검수 중",
  APPROVAL_WAIT: "승인 대기",
  ON_HOLD: "보류",
  COMPLETED: "완료",
  CANCELLED: "폐기",
};

export const taskStatusLabel: Record<string, string> = {
  WAITING: "대기",
  WAITING_FOR_DATA: "자료 대기",
  IN_PROGRESS: "진행 중",
  COLLABORATING: "협업 중",
  IN_REVIEW: "검수 중",
  APPROVAL_WAIT: "승인 대기",
  REVISION_REQUESTED: "수정 요청",
  COMPLETED: "완료",
  ON_HOLD: "보류",
  CANCELLED: "폐기",
  ERROR: "오류",
};

export const employeeStatusLabel: Record<string, string> = {
  AVAILABLE: "업무 대기",
  WORKING: "업무 중",
  WAITING: "대기",
  REVIEWING: "검수 중",
  APPROVAL_WAIT: "대표 승인 대기",
  BLOCKED: "문제 발생",
  OFFLINE: "비활성",
};

export const priorityLabel: Record<string, string> = {
  URGENT: "긴급",
  HIGH: "높음",
  NORMAL: "보통",
  LOW: "낮음",
};

export const resultTypeLabel: Record<string, string> = {
  DOCUMENT: "문서",
  IMAGE: "이미지",
  CODE: "코드",
  RESEARCH: "리서치",
  SPREADSHEET: "엑셀",
  ANALYSIS: "분석",
  PROMPT: "프롬프트",
  WEB: "웹",
  DATA: "데이터",
  OTHER: "기타",
};

export const memoryTypeLabel: Record<string, string> = {
  CEO: "대표 기억",
  PROJECT: "프로젝트",
  DECISION: "결정",
  KNOWLEDGE: "전문지식",
  FAILURE: "실패",
  PROMPT: "프롬프트",
  RULE: "규칙",
  RESULT: "결과",
};

export function labelOf(
  map: Record<string, string>,
  value: string | null | undefined,
) {
  if (!value) return "-";
  return map[value] ?? value;
}
