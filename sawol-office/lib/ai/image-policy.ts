import type { SawolAiContext } from "@/lib/ai/types";

function textOf(value: unknown) {
  return typeof value === "string" ? value : "";
}

function contextText(context: SawolAiContext) {
  const task = context.task ?? {};
  const root = context.rootTask ?? {};
  return [
    textOf(root.title),
    textOf(root.description),
    textOf(task.title),
    textOf(task.description),
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

const IMAGE_SIGNALS = [
  "이미지",
  "썸네일",
  "포스터",
  "배너",
  "카드뉴스",
  "로고",
  "프로필 사진",
  "프로필사진",
  "사진 제작",
  "사진 만들어",
  "그림",
  "일러스트",
  "비주얼",
  "png",
  "jpg",
  "jpeg",
  "상세페이지 이미지",
];

export function isImageRequest(context: SawolAiContext) {
  const text = contextText(context);
  return IMAGE_SIGNALS.some((signal) => text.includes(signal));
}

export function shouldGenerateImageForContext(context: SawolAiContext) {
  if (!isImageRequest(context)) return false;

  const task = context.task ?? {};
  const workflowId = textOf(task.workflow_id);
  const stepKey = textOf(task.workflow_step_key).toLowerCase();
  const parentTaskId = textOf(task.parent_task_id);

  // 단일 업무면 해당 업무가 직접 이미지를 생성합니다.
  if (!workflowId && !parentTaskId) return true;

  // 협업 업무면 최종 단계에서 한 번만 실제 이미지를 생성합니다.
  return stepKey === "final";
}

export function detectImageAspectRatio(context: SawolAiContext) {
  const text = contextText(context);

  if (text.includes("9:16") || text.includes("세로형") || text.includes("세로 이미지")) {
    return "9:16";
  }
  if (text.includes("16:9") || text.includes("가로형") || text.includes("썸네일")) {
    return "16:9";
  }
  if (text.includes("4:5")) return "4:5";
  if (text.includes("3:4")) return "3:4";
  if (text.includes("1:1") || text.includes("정사각")) return "1:1";

  return "1:1";
}
