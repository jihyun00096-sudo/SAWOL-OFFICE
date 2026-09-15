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
  "사진 만들어줘",
  "사진 1장",
  "사진 한 장",
  "그림",
  "일러스트",
  "비주얼",
  "렌더",
  "렌더링",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "상세페이지 이미지",
  "image",
  "photo",
  "photograph",
  "illustration",
  "thumbnail",
  "poster",
  "banner",
  "render",
];

/**
 * 사용자가 "사진"이나 "이미지"라는 단어를 직접 쓰지 않아도
 * "핸드폰 카메라로 찍은 것처럼 만들어줘"처럼 자연스럽게 지시할 수 있습니다.
 *
 * generic한 "만들어줘" 하나만으로 이미지 업무로 오인하지 않고,
 * 촬영/카메라 계열 표현 + 생성 의도가 함께 있을 때만 이미지로 판정합니다.
 */
function hasCameraPhotoIntent(text: string) {
  const cameraSignals = [
    "카메라",
    "핸드폰 카메라",
    "휴대폰 카메라",
    "스마트폰 카메라",
    "촬영",
    "스튜디오 촬영",
    "찍은 것처럼",
    "찍은거처럼",
    "찍은 듯",
    "찍은듯",
    "찍어줘",
    "찍어 줘",
    "스냅샷",
    "셀카",
    "실사",
    "포토",
    "camera",
    "shot on",
    "snapshot",
    "studio shot",
  ];

  const creationSignals = [
    "만들",
    "생성",
    "제작",
    "그려",
    "그림",
    "이미지",
    "사진",
    "찍어",
    "create",
    "generate",
    "make",
  ];

  return (
    cameraSignals.some((signal) => text.includes(signal)) &&
    creationSignals.some((signal) => text.includes(signal))
  );
}

export function isImageRequest(context: SawolAiContext) {
  const text = contextText(context);

  return (
    IMAGE_SIGNALS.some((signal) => text.includes(signal)) ||
    hasCameraPhotoIntent(text)
  );
}

export function shouldGenerateImageForContext(context: SawolAiContext) {
  if (!isImageRequest(context)) return false;

  const task = context.task ?? {};
  const workflowId = textOf(task.workflow_id);
  const stepKey = textOf(task.workflow_step_key).toLowerCase();
  const parentTaskId = textOf(task.parent_task_id);

  // 대표가 직접 등록한 메인 이미지 업무:
  // workflow가 있어도 바로 이미지 파이프라인 허용
  if (!parentTaskId) {
    return true;
  }

  // 협업 과정에서 생성된 자식 업무:
  // 중간 단계마다 이미지를 여러 번 생성하지 않도록 final에서만 허용
  if (workflowId) {
    return stepKey === "final";
  }

  // workflow 없이 만들어진 자식 업무는 안전하게 실제 이미지 생성을 막음
  return false;
}

export function detectImageAspectRatio(context: SawolAiContext) {
  const text = contextText(context);

  if (
    text.includes("9:16") ||
    text.includes("세로형") ||
    text.includes("세로 이미지")
  ) {
    return "9:16";
  }

  if (
    text.includes("16:9") ||
    text.includes("가로형") ||
    text.includes("썸네일")
  ) {
    return "16:9";
  }

  if (text.includes("4:5")) return "4:5";
  if (text.includes("3:4")) return "3:4";
  if (text.includes("4:3")) return "4:3";

  if (
    text.includes("1:1") ||
    text.includes("정사각") ||
    text.includes("정방형")
  ) {
    return "1:1";
  }

  return "1:1";
}
