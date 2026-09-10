import type { SawolAiContext } from "@/lib/ai/types";

function stringValue(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function firstText(
  row: Record<string, unknown> | null,
  keys: string[],
) {
  if (!row) return "";

  for (const key of keys) {
    const value = stringValue(row[key]);
    if (value) return value;
  }

  return "";
}

function compactRow(
  row: Record<string, unknown> | null,
  keys: string[],
) {
  if (!row) return null;

  const result: Record<string, string> = {};

  for (const key of keys) {
    const value = stringValue(row[key]);
    if (value) result[key] = value;
  }

  return Object.keys(result).length ? result : null;
}

export function buildSawolSystemPrompt(context: SawolAiContext) {
  const employeeName =
    firstText(context.employee, ["name", "display_name"]) ||
    "미배정 AI 직원";

  const employeeRole =
    firstText(context.employee, [
      "role",
      "job_title",
      "position",
      "specialty",
      "description",
    ]) || "지정된 전문 역할";

  const departmentName =
    firstText(context.department, ["name", "department_name"]) ||
    "미배정 부서";

  const taskType =
    firstText(context.task, ["task_type"]).toUpperCase() || "OTHER";

  return `
당신은 SAWOL OFFICE 내부에서 실제 업무를 수행하는 AI 직원입니다.
당신의 역할은 '방법을 설명하는 조언자'가 아니라 '요청된 산출물을 직접 만들어 제출하는 실무자'입니다.

현재 실행 주체:
- 직원: ${employeeName}
- 역할: ${employeeRole}
- 소속 부서: ${departmentName}
- 업무 유형: ${taskType}

절대 원칙:
1. 대표가 "가져와", "찾아줘", "작성해줘", "정리해줘", "만들어줘"라고 요청했다면 방법론을 설명하는 것으로 끝내지 말고 결과물을 직접 제출합니다.
2. 가능한 도구가 제공되면 실제로 사용합니다. 도구를 사용할 수 있는데도 "검색이 연결되어 있지 않다"거나 "직접 검색하라"고 회피하지 않습니다.
3. 사실과 추정을 구분합니다. 확인하지 않은 기사·통계·날짜·링크·출처를 지어내지 않습니다.
4. 최신 정보 업무에서 검색 도구가 제공되면 반드시 검색 결과를 근거로 작성합니다.
5. 최신 정보가 필요한데 검색 도구가 실제로 제공되지 않은 경우에만 한계를 분명히 밝힙니다.
6. 대표 요청의 수량·형식·조건을 정확히 지킵니다. "3개"를 요청하면 정확히 3개를 제출합니다.
6-1. 대표가 특정 사이트·매체·도메인·링크 형식을 지정하면 변경 불가 HARD CONSTRAINT입니다. 비슷한 출처로 대체하지 않습니다.
6-2. 대표가 날짜 범위, 대상, 금지 표현, 결과 형식을 지정하면 편의상 완화하거나 생략하지 않습니다.
6-3. 조건을 충족하지 못하면 그럴듯한 가짜 결과로 채우지 말고 검증 실패를 명시합니다.
7. STEP22 인수인계가 있으면 앞 직원 산출물을 입력 자료로 사용하고, 현재 단계의 전문 업무를 이어서 수행합니다.
8. 이전 직원의 내용을 단순 반복하지 말고 검토·보완·발전시킵니다.
9. 최종 통합 담당이면 각 직원 결과를 하나의 완성본으로 합치고 중복·충돌·누락을 제거합니다.
10. 반려 피드백이 있으면 기존 결과의 표현만 바꾸지 말고 해당 업무를 다시 수행해 문제를 실제로 해결한 새 결과를 제출합니다.
10-1. 반려에 "다시 조사", "재조사", "출처", "근거", "기사", "뉴스", "사실", "틀림", "부정확"이 포함되면 이전 조사 결과를 신뢰하지 말고 이번 실행에서 새로 확인한 근거를 우선합니다.
11. 개인정보, 인증정보, 비밀키 등 민감정보를 결과에 노출하지 않습니다.
12. 최종 승인·외부 발송·실제 결제를 했다고 허위로 주장하지 않습니다.

RESEARCH 업무 추가 원칙:
- 검색 도구가 제공되면 반드시 최신 웹 정보를 확인합니다.
- 기사/뉴스 요청은 기사 제목, 매체, 핵심 내용, 왜 중요한지, 가능한 경우 날짜와 출처를 구분해 제공합니다.
- 검색 결과 중 동일 이슈를 반복한 기사보다 서로 다른 핵심 이슈를 우선합니다.
- 검색 근거가 부족한 항목은 억지로 채우지 말고 검증 필요를 표시합니다.
- 기사 제목만 보고 기사 본문에 없는 내용을 추정하지 않습니다. 제공된 메타 설명/근거 범위를 넘는 사실은 단정하지 않습니다.
- 대표가 "네이버 뉴스 링크"처럼 출처를 지정하면 최종 URL의 실제 도메인까지 조건과 일치해야 합니다.

최종 산출물은 대표가 그대로 읽거나 다음 AI 직원이 바로 이어서 사용할 수 있는 실무 수준으로 작성하세요.
`.trim();
}

export function buildSawolUserPrompt(context: SawolAiContext) {
  const task = compactRow(context.task, [
    "task_code",
    "title",
    "description",
    "task_type",
    "priority",
    "status",
    "workflow_step_no",
    "workflow_step_key",
    "due_at",
  ]);

  const rootTask = compactRow(context.rootTask ?? null, [
    "task_code",
    "title",
    "description",
    "task_type",
    "priority",
  ]);

  const project = compactRow(context.project, [
    "project_code",
    "name",
    "title",
    "description",
    "initial_request",
    "purpose",
    "goal",
    "desired_result",
    "current_stage",
    "status",
    "priority",
  ]);

  const employee = compactRow(context.employee, [
    "employee_code",
    "name",
    "role",
    "job_title",
    "position",
    "specialty",
    "description",
    "responsibilities",
    "work_style",
  ]);

  const department = compactRow(context.department, [
    "code",
    "name",
    "department_name",
    "description",
  ]);

  const memoryRows = context.memories
    .slice(0, 12)
    .map((memory) =>
      compactRow(memory, [
        "memory_code",
        "title",
        "content",
        "summary",
        "category",
        "importance",
        "priority",
        "scope",
      ]),
    )
    .filter(Boolean);

  const handoffRows = (context.handoffs ?? [])
    .slice(0, 8)
    .map((handoff) =>
      compactRow(handoff, [
        "title",
        "summary",
        "content",
        "from_task_id",
        "created_at",
      ]),
    )
    .filter(Boolean);

  const feedbackRows = (context.feedbacks ?? [])
    .slice(0, 3)
    .map((feedback) =>
      compactRow(feedback, ["reason", "created_at"]),
    )
    .filter(Boolean);

  return `
아래 SAWOL OFFICE 업무를 실제로 완료하세요.

[현재 업무]
${JSON.stringify(task, null, 2)}

[상위 대표 업무]
${
  rootTask
    ? JSON.stringify(rootTask, null, 2)
    : "단일 업무 또는 상위 업무 없음"
}

[연결 프로젝트]
${project ? JSON.stringify(project, null, 2) : "없음"}

[담당 부서]
${department ? JSON.stringify(department, null, 2) : "미배정"}

[담당 직원]
${employee ? JSON.stringify(employee, null, 2) : "미배정"}

[이전 단계 인수인계]
${
  handoffRows.length
    ? JSON.stringify(handoffRows, null, 2)
    : "선행 단계 인수인계 없음"
}

[대표 반려·수정 피드백]
${
  feedbackRows.length
    ? JSON.stringify(feedbackRows, null, 2)
    : "현재 반려 피드백 없음"
}

[회사 활성 기억]
${
  memoryRows.length
    ? JSON.stringify(memoryRows, null, 2)
    : "사용 가능한 활성 기억 없음"
}

실행 기준:
- 현재 업무 제목과 설명을 '완료해야 하는 실제 작업지시'로 취급하세요.
- 상위 대표 업무가 있으면 전체 목적을 벗어나지 마세요.
- 인수인계가 있으면 반드시 읽고 현재 단계 산출물에 반영하세요.
- 대표 반려 피드백이 있으면 가장 높은 우선순위로 수정하세요.
- 반려 피드백이 재조사를 요구하면 이전 답안을 고쳐 쓰는 방식으로 끝내지 말고 새 근거를 기준으로 다시 작성하세요.
- 프로젝트가 있으면 프로젝트 목적과 원하는 결과를 함께 반영하세요.
- 회사 기억은 관련 있을 때만 적용하고 무관한 기억을 억지로 끼워 넣지 마세요.
- 요청된 산출물 자체를 만들어 제출하세요. 작업 방법 안내나 템플릿만 제출하지 마세요.
- 협업 최종 단계에서는 선행 직원 결과를 짧게 요약하지 말고, 대표 원문의 모든 요구사항을 다시 대조해 완성된 최종 산출물로 통합하세요.
- 대표 원문에 번호로 나열된 요구사항이 있으면 누락 없이 모두 반영했는지 제출 직전에 자체 점검하세요.
`.trim();
}
