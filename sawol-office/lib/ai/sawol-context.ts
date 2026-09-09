import type { SawolAiContext } from "@/lib/ai/types";

function stringValue(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function firstText(row: Record<string, unknown> | null, keys: string[]) {
  if (!row) return "";
  for (const key of keys) {
    const value = stringValue(row[key]);
    if (value) return value;
  }
  return "";
}

function compactRow(row: Record<string, unknown> | null, keys: string[]) {
  if (!row) return null;
  const result: Record<string, string> = {};
  for (const key of keys) {
    const value = stringValue(row[key]);
    if (value) result[key] = value;
  }
  return Object.keys(result).length ? result : null;
}

export function buildSawolSystemPrompt(context: SawolAiContext) {
  const employeeName = firstText(context.employee, ["name", "display_name"]) || "미배정 AI 직원";
  const employeeRole = firstText(context.employee, ["role", "job_title", "position", "specialty", "description"]) || "지정된 전문 역할";
  const departmentName = firstText(context.department, ["name", "department_name"]) || "미배정 부서";

  return `
당신은 SAWOL OFFICE 내부에서 업무를 수행하는 AI 직원입니다.

현재 실행 주체:
- 직원: ${employeeName}
- 역할: ${employeeRole}
- 소속 부서: ${departmentName}

운영 원칙:
1. 대표가 지시한 업무 범위를 임의로 바꾸지 않습니다.
2. 사실과 추정을 명확히 구분합니다.
3. 확인하지 못한 사실, 통계, 링크, 출처를 지어내지 않습니다.
4. 정보가 부족하면 결과 본문에서 부족한 정보를 명확히 표시합니다.
5. 대표가 바로 검수할 수 있게 결과를 실무 문서 수준으로 작성합니다.
6. 단순한 개요만 내지 말고 업무 목적을 달성할 수 있을 정도로 충분히 작성합니다.
7. 개인정보, 인증정보, 비밀키 등 민감정보를 결과에 노출하지 않습니다.
8. 최종 승인이나 외부 발송을 했다고 주장하지 않습니다.
9. 웹 검색이 연결된 경우 실제 확인한 정보만 출처로 기록합니다.
10. 최신 정보가 필요한데 웹 검색이 없으면 그 한계를 명확히 표시합니다.
11. STEP22 인수인계가 제공되면 앞 직원의 결과를 반복하지 말고 현재 단계 목적에 맞게 이어서 활용합니다.
`.trim();
}

export function buildSawolUserPrompt(context: SawolAiContext) {
  const task = compactRow(context.task, ["task_code", "title", "description", "task_type", "priority", "status", "workflow_step_no", "workflow_step_key", "due_at"]);
  const rootTask = compactRow(context.rootTask ?? null, ["task_code", "title", "description", "task_type", "priority"]);
  const project = compactRow(context.project, ["project_code", "name", "title", "description", "initial_request", "purpose", "goal", "desired_result", "current_stage", "status", "priority"]);
  const employee = compactRow(context.employee, ["employee_code", "name", "role", "job_title", "position", "specialty", "description"]);
  const department = compactRow(context.department, ["code", "name", "department_name", "description"]);
  const memoryRows = context.memories.slice(0, 12).map((memory) => compactRow(memory, ["memory_code", "title", "content", "summary", "category", "importance", "priority", "scope"])).filter(Boolean);
  const handoffRows = (context.handoffs ?? []).slice(0, 8).map((handoff) => compactRow(handoff, ["title", "summary", "content", "from_task_id", "created_at"])).filter(Boolean);

  return `
아래 SAWOL OFFICE 업무를 수행하세요.

[현재 업무]
${JSON.stringify(task, null, 2)}

[상위 대표 업무]
${rootTask ? JSON.stringify(rootTask, null, 2) : "단일 업무 또는 상위 업무 없음"}

[연결 프로젝트]
${project ? JSON.stringify(project, null, 2) : "없음"}

[담당 부서]
${department ? JSON.stringify(department, null, 2) : "미배정"}

[담당 직원]
${employee ? JSON.stringify(employee, null, 2) : "미배정"}

[이전 단계 인수인계]
${handoffRows.length ? JSON.stringify(handoffRows, null, 2) : "선행 단계 인수인계 없음"}

[회사 활성 기억]
${memoryRows.length ? JSON.stringify(memoryRows, null, 2) : "사용 가능한 활성 기억 없음"}

작성 기준:
- 현재 업무의 제목과 설명을 직접적인 완료 기준으로 취급합니다.
- 상위 대표 업무가 있으면 전체 목적을 벗어나지 않습니다.
- 인수인계 결과가 있으면 그 내용을 입력 자료로 사용하고, 현재 단계에서 필요한 추가 작업에 집중합니다.
- 프로젝트가 연결되어 있으면 프로젝트 목적과 원하는 결과를 함께 반영합니다.
- 활성 기억은 회사 운영 선호와 기준으로 참고합니다.
- 결과 제목은 산출물을 명확하게 식별할 수 있어야 합니다.
- 요약은 다음 직원 또는 대표가 빠르게 핵심을 파악할 수 있어야 합니다.
- 본문은 다음 단계가 그대로 이어받을 수 있을 정도로 충분히 작성합니다.
- 확인하지 않은 사실이나 출처를 만들지 않습니다.
`.trim();
}
