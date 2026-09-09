export type AssignmentDepartment = {
  id: string;
  name: string;
  code?: string | null;
  parent_department_id?: string | null;
};

export type AssignmentEmployee = {
  id: string;
  name: string;
  employee_code: string;
  department_id: string;
  position: string;
  specialty: unknown;
  responsibilities: unknown;
  work_style?: string | null;
  status: string;
  is_active?: boolean;
};

export type AssignmentWorkload = {
  employee_id: string;
  active: number;
  waiting: number;
  inProgress: number;
  review: number;
  approval: number;
  error: number;
};

export type AssignmentCandidate = {
  employee: AssignmentEmployee;
  score: number;
  workload: AssignmentWorkload;
  reasons: string[];
};

const typeTerms: Record<string, string[]> = {
  RESEARCH: ["리서치", "조사", "자료", "검색", "공식자료", "팩트", "시장", "경쟁", "트렌드", "레퍼런스"],
  PLANNING: ["기획", "전략", "서비스", "기능", "사용자", "정보구조", "수익모델", "구성"],
  DESIGN: ["디자인", "상세페이지", "이미지", "썸네일", "배너", "브랜드", "ui", "ux", "아트"],
  DEVELOPMENT: ["개발", "프론트엔드", "백엔드", "db", "데이터베이스", "api", "배포", "보안", "github", "웹", "시스템"],
  ANALYSIS: ["분석", "데이터", "성과", "대시보드", "평가", "진단", "검증"],
  OPERATION: ["운영", "cs", "고객", "민원", "공지", "문서", "엑셀", "개인정보", "정책"],
  EDIT: ["수정", "보정", "검수", "오타", "편집", "이미지수정"],
  PRODUCTION: ["제작", "작성", "콘텐츠", "문서", "카피", "상세페이지", "이미지"],
  STUDY: ["학습", "연구", "지식", "자료", "정리", "교육"],
  OTHER: [],
};

const prefixBonus: Record<string, string[]> = {
  RESEARCH: ["RSCH"],
  PLANNING: ["PLAN", "EXEC"],
  DESIGN: ["CRTV"],
  DEVELOPMENT: ["DEV", "AUTO"],
  ANALYSIS: ["DATA", "QA", "RSCH"],
  OPERATION: ["OPS"],
  EDIT: ["CRTV", "QA"],
  PRODUCTION: ["CRTV", "OPS"],
  STUDY: ["RND", "MEM"],
};

const stopWords = new Set([
  "그리고", "에서", "으로", "부터", "까지", "대한", "관련", "현재",
  "이번", "업무", "프로젝트", "만들어", "해줘", "해주세요", "확인",
  "하는", "있는", "없는", "하고", "한다", "정리", "작성", "초안",
]);

function normalize(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ");
}

function tokens(value: string) {
  return normalize(value)
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && !stopWords.has(item));
}

function jsonText(value: unknown) {
  if (Array.isArray(value)) return value.map(String).join(" ");
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .map((item) => String(item))
      .join(" ");
  }
  return "";
}

function isDepartmentDescendant(
  employeeDepartmentId: string,
  targetDepartmentId: string,
  departments: AssignmentDepartment[],
) {
  if (employeeDepartmentId === targetDepartmentId) return "DIRECT" as const;

  const byId = new Map(departments.map((department) => [department.id, department]));
  let current = byId.get(employeeDepartmentId);
  const visited = new Set<string>();

  while (current?.parent_department_id && !visited.has(current.id)) {
    visited.add(current.id);

    if (current.parent_department_id === targetDepartmentId) {
      return "DESCENDANT" as const;
    }

    current = byId.get(current.parent_department_id);
  }

  return "OTHER" as const;
}

export function buildEmployeeWorkloads(
  tasks: Array<{
    assigned_employee_id: string | null;
    status: string;
  }>,
): AssignmentWorkload[] {
  const map = new Map<string, AssignmentWorkload>();

  for (const task of tasks) {
    if (!task.assigned_employee_id) continue;
    if (["COMPLETED", "CANCELLED", "CANCELED"].includes(task.status)) continue;

    const row =
      map.get(task.assigned_employee_id) ?? {
        employee_id: task.assigned_employee_id,
        active: 0,
        waiting: 0,
        inProgress: 0,
        review: 0,
        approval: 0,
        error: 0,
      };

    row.active += 1;

    if (["WAITING", "WAITING_FOR_DATA", "ON_HOLD"].includes(task.status)) {
      row.waiting += 1;
    } else if (["IN_PROGRESS", "COLLABORATING"].includes(task.status)) {
      row.inProgress += 1;
    } else if (["REVIEW", "IN_REVIEW"].includes(task.status)) {
      row.review += 1;
    } else if (["PENDING_APPROVAL", "APPROVAL_WAIT"].includes(task.status)) {
      row.approval += 1;
    } else if (task.status === "ERROR") {
      row.error += 1;
    }

    map.set(task.assigned_employee_id, row);
  }

  return [...map.values()];
}

export function rankEmployeesForTask({
  title,
  description,
  taskType,
  departmentId,
  employees,
  departments,
  workloads,
}: {
  title: string;
  description: string;
  taskType: string;
  departmentId: string | null | undefined;
  employees: AssignmentEmployee[];
  departments: AssignmentDepartment[];
  workloads: AssignmentWorkload[];
}): AssignmentCandidate[] {
  const query = normalize(`${title} ${description}`);
  const queryTokens = new Set(tokens(`${title} ${description}`));
  const workloadMap = new Map(workloads.map((item) => [item.employee_id, item]));
  const taskTerms = typeTerms[taskType] ?? [];
  const preferredPrefixes = prefixBonus[taskType] ?? [];

  const candidates: AssignmentCandidate[] = [];

  for (const employee of employees) {
    if (employee.is_active === false) continue;
    if (["OFFLINE", "BLOCKED"].includes(employee.status)) continue;

    const workload =
      workloadMap.get(employee.id) ?? {
        employee_id: employee.id,
        active: 0,
        waiting: 0,
        inProgress: 0,
        review: 0,
        approval: 0,
        error: 0,
      };

    const profile = normalize(
      [
        employee.position,
        jsonText(employee.specialty),
        jsonText(employee.responsibilities),
        employee.work_style ?? "",
      ].join(" "),
    );

    let score = 28;
    const reasons: string[] = [];

    const prefix = employee.employee_code.split("-")[0];
    if (preferredPrefixes.includes(prefix)) {
      score += 13;
      reasons.push("업무 유형과 전문 조직이 잘 맞음");
    }

    const matchingTerms = taskTerms.filter(
      (term) => query.includes(term) && profile.includes(term),
    );

    if (matchingTerms.length) {
      score += Math.min(24, matchingTerms.length * 8);
      reasons.push(`전문 키워드 일치 · ${matchingTerms.slice(0, 3).join(", ")}`);
    }

    let tokenMatches = 0;
    for (const token of queryTokens) {
      if (profile.includes(token)) tokenMatches += 1;
    }

    if (tokenMatches > 0) {
      score += Math.min(22, tokenMatches * 5);
      reasons.push(`요청 내용과 전문분야 ${tokenMatches}개 항목 일치`);
    }

    if (departmentId) {
      const relation = isDepartmentDescendant(
        employee.department_id,
        departmentId,
        departments,
      );

      if (relation === "DIRECT") {
        score += 18;
        reasons.push("추천 부서에 직접 소속");
      } else if (relation === "DESCENDANT") {
        score += 14;
        reasons.push("추천 부서 산하 전문팀 소속");
      } else {
        score -= 6;
      }
    }

    if (employee.status === "AVAILABLE") {
      score += 9;
      reasons.push("현재 즉시 배정 가능");
    } else if (employee.status === "WAITING") {
      score += 5;
      reasons.push("현재 대기 상태");
    } else if (employee.status === "WORKING") {
      score -= 5;
    } else if (employee.status === "REVIEWING") {
      score -= 3;
    } else if (employee.status === "APPROVAL_WAIT") {
      score += 1;
    }

    const loadPenalty = Math.min(20, workload.active * 4);
    score -= loadPenalty;

    if (workload.active === 0) {
      score += 5;
      reasons.push("진행 중인 다른 업무 없음");
    } else {
      reasons.push(`현재 활성 업무 ${workload.active}건`);
    }

    score = Math.max(0, Math.min(100, Math.round(score)));

    candidates.push({
      employee,
      score,
      workload,
      reasons: reasons.slice(0, 4),
    });
  }

  return candidates
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.workload.active !== b.workload.active) {
        return a.workload.active - b.workload.active;
      }
      return a.employee.employee_code.localeCompare(b.employee.employee_code);
    })
    .slice(0, 8);
}
