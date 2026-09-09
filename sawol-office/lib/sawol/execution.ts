export const executionStatusLabel: Record<string, string> = {
  WAITING: "대기",
  IN_PROGRESS: "작업 중",
  REVIEW: "검수 대기",
  PENDING_APPROVAL: "대표 승인 대기",
  COMPLETED: "완료",
  ON_HOLD: "보류",
  ERROR: "오류",
};

export const executionStatusOrder = [
  "WAITING",
  "IN_PROGRESS",
  "REVIEW",
  "PENDING_APPROVAL",
  "COMPLETED",
  "ON_HOLD",
  "ERROR",
] as const;

export function nextPrimaryStatus(
  currentStatus: string,
  requiresCeoApproval: boolean,
) {
  switch (currentStatus) {
    case "WAITING":
      return "IN_PROGRESS";
    case "IN_PROGRESS":
      return "REVIEW";
    case "REVIEW":
      return requiresCeoApproval ? "PENDING_APPROVAL" : "COMPLETED";
    case "PENDING_APPROVAL":
      return "COMPLETED";
    default:
      return null;
  }
}

export function nextPrimaryLabel(
  currentStatus: string,
  requiresCeoApproval: boolean,
) {
  switch (currentStatus) {
    case "WAITING":
      return "작업 시작";
    case "IN_PROGRESS":
      return "검수 요청";
    case "REVIEW":
      return requiresCeoApproval ? "대표 승인 요청" : "검수 완료";
    case "PENDING_APPROVAL":
      return "대표 승인 후 완료";
    default:
      return null;
  }
}
