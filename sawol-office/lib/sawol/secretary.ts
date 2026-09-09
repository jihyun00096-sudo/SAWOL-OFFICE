export type SecretaryProject = {
  id: string;
  name: string;
};

export type SecretaryDepartment = {
  id: string;
  name: string;
  code?: string | null;
};

export type SecretaryEmployee = {
  id: string;
  name: string;
  employee_code: string;
};

export type SecretaryAnalysis = {
  taskType: string;
  priority: string;
  projectId: string;
  departmentId: string;
  employeeId: string;
  requiresCeoApproval: boolean;
  confidence: number;
  rationale: string[];
  steps: string[];
};

const taskRules: Array<{
  type: string;
  keywords: string[];
  weight?: number;
}> = [
  {
    type: "DEVELOPMENT",
    keywords: [
      "개발", "코드", "사이트", "웹", "서버", "api", "오류", "버그",
      "로그인", "데이터베이스", "supabase", "github", "vercel", "배포",
      "자동화", "erp",
    ],
  },
  {
    type: "DESIGN",
    keywords: [
      "디자인", "이미지", "썸네일", "상세페이지", "배너", "포스터",
      "로고", "색상", "폰트", "레이아웃", "ui", "ux",
    ],
  },
  {
    type: "RESEARCH",
    keywords: [
      "조사", "찾아", "찾기", "검색", "리서치", "경쟁", "비교",
      "자료", "사실 확인", "시장", "사례", "벤치마킹",
    ],
  },
  {
    type: "ANALYSIS",
    keywords: [
      "분석", "검토", "진단", "계산", "통계", "평가", "원인",
      "체크", "점검",
    ],
  },
  {
    type: "PLANNING",
    keywords: [
      "기획", "구성", "전략", "설계", "구상", "계획", "커리큘럼",
      "정책", "프로세스",
    ],
  },
  {
    type: "OPERATION",
    keywords: [
      "운영", "관리", "cs", "고객", "문의", "공지", "회원",
      "정산", "환불", "일정", "명단",
    ],
  },
  {
    type: "EDIT",
    keywords: [
      "수정", "교체", "보완", "고쳐", "변경", "다듬", "오타",
      "리뉴얼",
    ],
  },
  {
    type: "PRODUCTION",
    keywords: [
      "제작", "작성", "만들어", "만들기", "문서", "보고서", "글",
      "메일", "안내문",
    ],
  },
  {
    type: "STUDY",
    keywords: ["학습", "공부", "정리", "배워", "교육", "요약"],
  },
];

const urgentKeywords = [
  "긴급", "즉시", "지금", "바로 처리", "오늘 안", "장애",
  "접속 불가", "서비스 중단", "먹통",
];

const highKeywords = [
  "중요", "우선", "오늘", "내일", "마감", "급해", "빠르게",
];

const approvalKeywords = [
  "삭제", "결제", "비용", "예산", "계약", "발송", "공지",
  "게시", "배포", "프로덕션", "개인정보", "법무", "환불",
  "고객 전체", "전체 고객", "송금", "구매",
];

const departmentRuleGroups = [
  {
    keywords: ["개발", "기술", "서버", "코드", "웹", "api", "데이터", "자동화", "erp"],
    names: ["개발", "기술", "it", "시스템", "엔지니어"],
  },
  {
    keywords: ["디자인", "이미지", "썸네일", "상세페이지", "배너", "ui", "ux"],
    names: ["디자인", "크리에이티브", "콘텐츠"],
  },
  {
    keywords: ["마케팅", "광고", "홍보", "브랜드", "유입"],
    names: ["마케팅", "브랜드", "광고"],
  },
  {
    keywords: ["cs", "고객", "문의", "환불", "회원", "운영"],
    names: ["cs", "고객", "운영", "서비스"],
  },
  {
    keywords: ["정산", "재무", "매출", "세금", "비용", "회계"],
    names: ["재무", "회계", "정산"],
  },
  {
    keywords: ["법무", "계약", "약관", "개인정보"],
    names: ["법무", "컴플라이언스"],
  },
  {
    keywords: ["조사", "리서치", "분석", "기획", "전략"],
    names: ["기획", "전략", "리서치", "분석", "비서"],
  },
];

const stopWords = new Set([
  "그리고", "에서", "으로", "부터", "까지", "대한", "관련", "현재",
  "이번", "업무", "프로젝트", "만들어", "해줘", "해주세요", "확인",
  "하는", "있는", "없는", "하고", "한다", "정리",
]);

function normalize(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ");
}

function includesKeyword(text: string, keyword: string) {
  return text.includes(keyword.toLowerCase());
}

function tokenize(value: string) {
  return normalize(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !stopWords.has(token));
}

function scoreTaskType(text: string) {
  const scores = new Map<string, number>();

  for (const rule of taskRules) {
    let score = 0;

    for (const keyword of rule.keywords) {
      if (includesKeyword(text, keyword)) {
        score += rule.weight ?? 1;
      }
    }

    scores.set(rule.type, score);
  }

  const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const [bestType, bestScore] = sorted[0] ?? ["OTHER", 0];

  return {
    type: bestScore > 0 ? bestType : "OTHER",
    score: bestScore,
    secondScore: sorted[1]?.[1] ?? 0,
  };
}

function suggestPriority(text: string) {
  if (urgentKeywords.some((keyword) => includesKeyword(text, keyword))) {
    return "URGENT";
  }

  if (highKeywords.some((keyword) => includesKeyword(text, keyword))) {
    return "HIGH";
  }

  return "NORMAL";
}

function suggestProject(text: string, projects: SecretaryProject[]) {
  const textTokens = new Set(tokenize(text));

  let bestId = "";
  let bestScore = 0;

  for (const project of projects) {
    const projectTokens = tokenize(project.name);
    let score = 0;

    for (const token of projectTokens) {
      if (textTokens.has(token) || normalize(text).includes(token)) {
        score += token.length >= 4 ? 2 : 1;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestId = project.id;
    }
  }

  return bestScore >= 2 ? bestId : "";
}

function suggestDepartment(
  text: string,
  departments: SecretaryDepartment[],
) {
  const normalizedText = normalize(text);

  let selectedGroup:
    | (typeof departmentRuleGroups)[number]
    | undefined;

  let groupScore = 0;

  for (const group of departmentRuleGroups) {
    const score = group.keywords.reduce(
      (sum, keyword) =>
        sum + (normalizedText.includes(keyword.toLowerCase()) ? 1 : 0),
      0,
    );

    if (score > groupScore) {
      selectedGroup = group;
      groupScore = score;
    }
  }

  if (!selectedGroup || groupScore === 0) return "";

  let bestId = "";
  let bestScore = 0;

  for (const department of departments) {
    const name = normalize(`${department.name} ${department.code ?? ""}`);
    const score = selectedGroup.names.reduce(
      (sum, keyword) =>
        sum + (name.includes(keyword.toLowerCase()) ? 1 : 0),
      0,
    );

    if (score > bestScore) {
      bestScore = score;
      bestId = department.id;
    }
  }

  return bestScore > 0 ? bestId : "";
}

function stepsFor(taskType: string, text: string) {
  const base: Record<string, string[]> = {
    RESEARCH: [
      "요구사항과 조사 범위 확정",
      "신뢰 가능한 자료 수집",
      "비교·교차검증",
      "핵심 결과와 시사점 정리",
    ],
    PLANNING: [
      "목표와 제약조건 정리",
      "필요 자료 및 현황 확인",
      "구조·대안 설계",
      "최종 기획안 정리",
    ],
    DESIGN: [
      "디자인 요구사항 정리",
      "레퍼런스와 화면 구조 확인",
      "1차 시안 제작",
      "오탈자·모바일·가독성 검수",
    ],
    DEVELOPMENT: [
      "재현 조건과 영향 범위 확인",
      "구현·수정 계획 수립",
      "코드 적용",
      "기능·모바일·회귀 테스트",
    ],
    ANALYSIS: [
      "분석 기준 설정",
      "필요 데이터 확인",
      "분석 및 이상값 점검",
      "결론과 권고사항 정리",
    ],
    OPERATION: [
      "운영 기준 확인",
      "대상 데이터 점검",
      "업무 처리",
      "처리 결과와 예외사항 기록",
    ],
    EDIT: [
      "수정 범위 확정",
      "기존 요소 보존 조건 확인",
      "수정 적용",
      "변경 외 영역 및 결과 검수",
    ],
    PRODUCTION: [
      "산출물 요구사항 정리",
      "초안 제작",
      "내용·형식 검수",
      "최종본 정리",
    ],
    STUDY: [
      "학습 범위 설정",
      "핵심 자료 정리",
      "중요 개념 구조화",
      "실무 적용 포인트 요약",
    ],
    OTHER: [
      "요구사항 정리",
      "필요 자료와 조건 확인",
      "업무 수행",
      "결과 검수 및 보고",
    ],
  };

  const steps = [...(base[taskType] ?? base.OTHER)];

  if (
    text.includes("비교") &&
    !steps.some((step) => step.includes("비교"))
  ) {
    steps.splice(Math.max(1, steps.length - 1), 0, "대안 및 비교표 정리");
  }

  return steps;
}

export function analyzeSecretaryCommand({
  title,
  description,
  projects,
  departments,
}: {
  title: string;
  description: string;
  projects: SecretaryProject[];
  departments: SecretaryDepartment[];
}): SecretaryAnalysis {
  const combined = normalize(`${title} ${description}`);

  const task = scoreTaskType(combined);
  const priority = suggestPriority(combined);
  const projectId = suggestProject(combined, projects);
  const departmentId = suggestDepartment(combined, departments);
  const requiresCeoApproval = approvalKeywords.some((keyword) =>
    includesKeyword(combined, keyword),
  );

  const rationale: string[] = [];

  if (task.type !== "OTHER") {
    rationale.push(
      `입력 내용의 핵심 키워드를 기준으로 ${task.type} 성격이 가장 강하게 감지되었습니다.`,
    );
  } else {
    rationale.push(
      "명확한 전문 업무 키워드가 부족해 기타 업무로 분류했습니다.",
    );
  }

  if (priority === "URGENT") {
    rationale.push("긴급/장애성 표현이 포함되어 긴급 우선순위를 제안합니다.");
  } else if (priority === "HIGH") {
    rationale.push("중요도 또는 마감성 표현이 포함되어 높은 우선순위를 제안합니다.");
  }

  if (projectId) {
    rationale.push("기존 프로젝트명과 업무 내용의 연관도가 높아 프로젝트 연결을 제안합니다.");
  }

  if (departmentId) {
    rationale.push("업무 키워드와 현재 조직명을 비교해 담당 부서를 제안했습니다.");
  } else {
    rationale.push("확실한 담당 부서를 찾지 못해 미배정을 유지합니다.");
  }

  if (requiresCeoApproval) {
    rationale.push("삭제·비용·외부 발송 등 대표 확인이 필요한 위험 키워드가 포함되어 있습니다.");
  }

  let confidence = 52;
  confidence += Math.min(task.score * 7, 21);
  if (task.score > task.secondScore) confidence += 5;
  if (projectId) confidence += 7;
  if (departmentId) confidence += 8;
  confidence = Math.max(45, Math.min(94, confidence));

  return {
    taskType: task.type,
    priority,
    projectId,
    departmentId,
    employeeId: "",
    requiresCeoApproval,
    confidence,
    rationale,
    steps: stepsFor(task.type, combined),
  };
}
