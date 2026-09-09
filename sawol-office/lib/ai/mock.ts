import type { AiTaskResult, SawolAiContext } from "@/lib/ai/types";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function taskField(
  context: SawolAiContext,
  key: string,
  fallback = "",
) {
  return text(context.task[key]) || fallback;
}

function projectName(context: SawolAiContext) {
  if (!context.project) return "";
  return (
    text(context.project.name) ||
    text(context.project.title) ||
    text(context.project.project_code)
  );
}

function departmentName(context: SawolAiContext) {
  if (!context.department) return "";
  return text(context.department.name);
}

function employeeName(context: SawolAiContext) {
  if (!context.employee) return "";
  return text(context.employee.name);
}

function memoryHighlights(context: SawolAiContext) {
  return context.memories
    .slice(0, 4)
    .map((memory) => {
      const title = text(memory.title);
      const content = text(memory.content) || text(memory.summary);
      if (!title && !content) return "";
      return `- ${title || "기억"}: ${content.slice(0, 180)}`;
    })
    .filter(Boolean);
}

function buildSections(
  taskType: string,
  title: string,
  description: string,
) {
  const intro =
    `이 결과는 SAWOL OFFICE의 무료 Mock AI가 생성한 테스트용 시뮬레이션 결과입니다.\n` +
    `실제 외부 정보 확인이나 웹 검색은 수행하지 않았습니다.\n\n` +
    `업무: ${title}\n` +
    `요청 내용: ${description || "상세 설명 없음"}\n`;

  const templates: Record<string, string> = {
    RESEARCH: `
[1. 조사 목적]
- 대표가 요청한 주제를 비교·검토하기 위한 조사 구조를 설정합니다.
- 실제 운영 전에는 공식 자료와 최신 공개 정보를 별도로 확인해야 합니다.

[2. 권장 조사 기준]
- 대상의 핵심 기능 또는 제공 가치
- 가격/비용 구조
- 주요 타깃
- 차별화 포인트
- 고객이 느낄 수 있는 장단점
- 우리 회사에 적용할 수 있는 요소

[3. Mock 발견사항]
- 경쟁 요소는 단순 기능 수보다 정보 전달 구조와 신뢰 형성이 중요하다는 가설을 세울 수 있습니다.
- 가격 비교는 동일 조건 기준으로 맞춰야 왜곡을 줄일 수 있습니다.
- 표면적인 문구보다 실제 제공 범위와 제한 조건을 함께 비교하는 편이 좋습니다.

[4. 실제 조사 시 필요한 추가 확인]
- 최신 공식 페이지
- 실제 가격 및 기간
- 이용 조건
- 최근 업데이트 여부
- 공식 출처 링크

[5. 대표 검수 포인트]
- 조사 범위가 너무 넓거나 좁지 않은지
- 비교 기준이 회사 목적과 맞는지
- 외부 공개 가능한 자료와 내부 참고 자료를 구분했는지
`,
    PLANNING: `
[1. 목표]
- 요청 업무를 대표가 빠르게 판단할 수 있는 실행 가능한 기획안으로 구조화합니다.

[2. 권장 구성]
- 문제 정의
- 목표
- 대상
- 핵심 메시지
- 실행 순서
- 필요한 자료
- 검수 기준

[3. 1차 실행안]
- 먼저 기존 자료와 현재 조건을 확인합니다.
- 반드시 필요한 핵심 요소를 우선 배치합니다.
- 부가 요소는 핵심 흐름을 방해하지 않는 범위에서 추가합니다.
- 결과물은 모바일/PC 또는 실제 사용 환경을 기준으로 검수합니다.

[4. 리스크]
- 정보 부족 상태에서 세부안을 확정하면 재작업 가능성이 높습니다.
- 대표 의사결정이 필요한 지점은 실행 전에 분리하는 편이 안전합니다.

[5. 완료 기준]
- 목적이 한 문장으로 설명됨
- 실행 순서가 명확함
- 담당/필요 자료가 구분됨
- 대표가 승인할 포인트가 보임
`,
    DEVELOPMENT: `
[1. 문제 정의]
- 요청된 개발 업무의 재현 조건과 영향 범위를 먼저 확인합니다.

[2. 점검 순서]
- 현재 동작 재현
- 브라우저/서버 로그 확인
- DB 또는 API 연결 확인
- 최소 수정 범위 결정
- 수정 후 회귀 테스트

[3. 권장 수정 원칙]
- 정상 동작 중인 기능을 불필요하게 교체하지 않습니다.
- 데이터 구조 변경은 마지막 수단으로 둡니다.
- 모바일/PC 양쪽을 확인합니다.
- 오류 발생 시 이전 상태로 되돌릴 수 있게 Git 복구 지점을 남깁니다.

[4. 테스트 체크]
- 정상 입력
- 빈 값
- 중복 클릭
- 새로고침
- 직접 URL 접근
- 모바일
- 권한 없는 접근

[5. 대표 확인]
- 실제 배포 전 테스트 환경에서 먼저 검증하는 것을 권장합니다.
`,
    DESIGN: `
[1. 디자인 목표]
- 복잡도를 낮추고 핵심 정보가 빠르게 읽히는 구조를 우선합니다.

[2. 정보 위계]
- 제목
- 핵심 메시지
- 주요 수치/혜택
- 세부 설명
- 행동 버튼 또는 다음 단계

[3. 레이아웃]
- 모바일에서는 한 열 중심
- PC에서는 과도한 좌우 분할을 피함
- 카드 간 간격과 텍스트 크기 통일
- 포인트 색상은 제한적으로 사용

[4. 검수 기준]
- 가로 스크롤 없음
- 버튼 잘림 없음
- 폰트/간격 일관성
- 중요 정보가 첫 화면에 보임
- AI 느낌보다 실제 서비스 UI처럼 자연스러움

[5. 수정 원칙]
- 지정되지 않은 영역을 불필요하게 바꾸지 않습니다.
`,
    ANALYSIS: `
[1. 분석 기준]
- 사실
- 추정
- 확인 필요 항목을 분리합니다.

[2. 점검 구조]
- 현재 상태
- 문제 또는 특징
- 원인 후보
- 영향
- 대안
- 권고안

[3. 판단]
- 단일 원인으로 단정하지 않고 확인 가능한 근거 순서로 좁히는 것이 안전합니다.

[4. 대표용 결론]
- 바로 실행할 항목과 추가 확인 후 결정할 항목을 분리하는 방식을 권장합니다.
`,
    OPERATION: `
[1. 운영 목적]
- 반복 업무를 누락 없이 처리하고 예외 상황을 기록하는 것을 목표로 합니다.

[2. 기본 절차]
- 요청 확인
- 대상 데이터 확인
- 기준/정책 확인
- 처리
- 결과 기록
- 예외 여부 확인

[3. 예외 처리]
- 기준이 없는 사례는 임의 판단하지 않고 대표 승인 대상으로 올립니다.
- 고객/외부 발송 관련 작업은 발송 전 문구와 대상 재확인을 권장합니다.

[4. 완료 체크]
- 처리 대상 일치
- 정책 준수
- 기록 저장
- 후속 조치 여부 표시
`,
    EDIT: `
[1. 수정 범위]
- 대표가 지정한 영역만 우선 수정합니다.

[2. 보존 원칙]
- 기존 정상 기능
- 기존 데이터
- 지정하지 않은 디자인
- 이미 검증된 운영 흐름

[3. 수정 절차]
- 변경 전 상태 확인
- 최소 변경
- 저장
- 새로고침
- PC/모바일 재검수

[4. 완료 기준]
- 요청한 부분만 변경됨
- 기존 기능 회귀 없음
`,
    PRODUCTION: `
[1. 산출물 목표]
- 대표가 바로 검수할 수 있는 완성도 높은 1차 초안을 만듭니다.

[2. 구성]
- 목적
- 핵심 내용
- 세부 내용
- 예외/주의사항
- 최종 검수 항목

[3. 품질 기준]
- 불필요한 반복 제거
- 사실과 의견 구분
- 문체/표기 통일
- 실제 사용 가능한 수준의 구체성 확보
`,
    STUDY: `
[1. 학습 목표]
- 단순 요약이 아니라 실무 적용이 가능한 형태로 구조화합니다.

[2. 정리 방식]
- 핵심 개념
- 왜 중요한지
- 실제 사례
- 주의점
- 실무 적용 포인트

[3. 복습 체크]
- 용어를 설명할 수 있는지
- 실제 업무에서 어떤 상황에 쓰는지
- 잘못 적용할 위험은 무엇인지
`,
    OTHER: `
[1. 요청 해석]
- 업무의 목적과 최종 결과물을 먼저 명확히 합니다.

[2. 실행 구조]
- 필요한 자료 확인
- 핵심 작업 수행
- 예외사항 확인
- 결과 정리
- 대표 검수

[3. 주의]
- 정보가 부족한 부분은 임의로 사실을 만들지 않습니다.
`,
  };

  return `${intro}\n${templates[taskType] ?? templates.OTHER}`.trim();
}

export async function runMockTask({
  context,
}: {
  context: SawolAiContext;
}) {
  // Small delay so UI behavior resembles a real remote execution
  await new Promise((resolve) => setTimeout(resolve, 900));

  const taskType = taskField(context, "task_type", "OTHER");
  const title = taskField(context, "title", "SAWOL OFFICE 테스트 업무");
  const description = taskField(context, "description");
  const project = projectName(context);
  const department = departmentName(context);
  const employee = employeeName(context);
  const memories = memoryHighlights(context);

  let body = buildSections(taskType, title, description);

  const contextLines = [
    project ? `- 연결 프로젝트: ${project}` : "",
    department ? `- 담당 부서: ${department}` : "",
    employee ? `- 담당 직원: ${employee}` : "",
  ].filter(Boolean);

  if (contextLines.length) {
    body += `\n\n[연결 Context]\n${contextLines.join("\n")}`;
  }

  if (memories.length) {
    body += `\n\n[참고한 회사 기억]\n${memories.join("\n")}`;
  }

  body +=
    `\n\n[Mock 실행 안내]\n` +
    `이 결과는 시스템 흐름 검증을 위한 무료 시뮬레이션입니다. ` +
    `실제 운영 전에는 최신 정보, 수치, 외부 사실 및 출처를 실제 AI Provider 또는 사람이 다시 확인해야 합니다.`;

  const needsReview =
    ["RESEARCH", "ANALYSIS", "DEVELOPMENT"].includes(taskType) ||
    Boolean(taskField(context, "requires_ceo_approval"));

  const result: AiTaskResult = {
    title: `[Mock] ${title} 결과 초안`,
    summary:
      `무료 Mock AI가 ${taskType} 유형으로 업무를 시뮬레이션했습니다. ` +
      `전체 실행·저장·검수 흐름 확인용이며 실제 외부 사실 검증은 포함되지 않습니다.`,
    body,
    confidence: taskType === "OTHER" ? 58 : 72,
    needs_human_review: needsReview,
    sources: [],
  };

  return {
    provider: "mock",
    model: "sawol-mock-v1",
    responseId: `mock_${Date.now()}`,
    usage: {
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      billable: false,
    },
    result,
    usedWebSearch: false,
  };
}
