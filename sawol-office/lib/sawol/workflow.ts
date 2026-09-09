import {
  rankEmployeesForTask,
  type AssignmentDepartment,
  type AssignmentEmployee,
  type AssignmentWorkload,
} from "@/lib/sawol/assignment";

export type WorkflowPlanStep = {
  key: string;
  title: string;
  description: string;
  taskType: string;
  priority: string;
  dependsOn: string[];
  employeeId: string;
  departmentId: string;
  matchScore: number | null;
  assignmentReason: string;
  candidates: Array<{
    employeeId: string;
    name: string;
    employeeCode: string;
    departmentId: string;
    score: number;
  }>;
};

export type WorkflowPlan = {
  recommended: boolean;
  reason: string;
  steps: WorkflowPlanStep[];
};

const complexKeywords = [
  "전체", "기획", "개발", "제작", "구축", "상세페이지", "사이트", "시스템",
  "조사", "분석", "설계", "자동화", "런칭", "리뉴얼", "전략", "보고서",
];

function templateFor(taskType: string, title: string) {
  if (taskType === "DEVELOPMENT") {
    return [
      {
        key: "spec",
        title: `${title} · 요구사항·데이터 구조 설계`,
        description: "대표 요청을 구현 가능한 요구사항으로 정리하고 데이터 구조, 권한, 보안·개인정보 조건과 완료 기준을 확정합니다.",
        taskType: "PLANNING",
        dependsOn: [],
      },
      {
        key: "backend",
        title: `${title} · 데이터·백엔드 구현`,
        description: "확정된 요구사항을 기준으로 데이터 저장, 중복 방지, 권한 처리와 핵심 서버 로직을 구현·검토합니다.",
        taskType: "DEVELOPMENT",
        dependsOn: ["spec"],
      },
      {
        key: "frontend",
        title: `${title} · 관리자 화면 구현`,
        description: "PC·모바일에서 사용할 수 있는 관리 화면, 검색·필터·상태 표시 등 프론트엔드 기능을 구현합니다.",
        taskType: "DEVELOPMENT",
        dependsOn: ["spec"],
      },
      {
        key: "qa",
        title: `${title} · 통합 QA·보안 점검`,
        description: "백엔드와 화면 결과를 통합 검수하고 중복 등록, 권한, 개인정보, 모바일 반응형과 오류 케이스를 점검해 최종 결과를 정리합니다.",
        taskType: "ANALYSIS",
        dependsOn: ["backend", "frontend"],
      },
    ];
  }

  if (taskType === "DESIGN" || title.includes("상세페이지")) {
    return [
      {
        key: "research",
        title: `${title} · 레퍼런스·경쟁 조사`,
        description: "목표 고객, 경쟁 사례와 참고 구성을 조사하고 사실과 참고 요소를 구분해 정리합니다.",
        taskType: "RESEARCH",
        dependsOn: [],
      },
      {
        key: "structure",
        title: `${title} · 정보 구조·카피 기획`,
        description: "대표 요청과 조사 결과를 바탕으로 전체 섹션 순서, 핵심 메시지, CTA와 각 섹션에 들어갈 내용을 설계합니다.",
        taskType: "PLANNING",
        dependsOn: ["research"],
      },
      {
        key: "design",
        title: `${title} · 디자인 구조 초안`,
        description: "확정된 정보 구조를 모바일 우선의 실제 상세페이지 제작안 수준으로 구체화합니다.",
        taskType: "DESIGN",
        dependsOn: ["structure"],
      },
      {
        key: "qa",
        title: `${title} · 최종 검수`,
        description: "요청사항 누락, 과장 표현, 정보 흐름, 모바일 사용성을 검수하고 대표가 승인할 최종안을 정리합니다.",
        taskType: "ANALYSIS",
        dependsOn: ["design"],
      },
    ];
  }

  if (taskType === "RESEARCH" || taskType === "ANALYSIS") {
    return [
      {
        key: "scope",
        title: `${title} · 조사 범위·기준 확정`,
        description: "조사 범위, 필요한 출처, 비교 기준과 사실 검증 원칙을 먼저 정리합니다.",
        taskType: "PLANNING",
        dependsOn: [],
      },
      {
        key: "research",
        title: `${title} · 자료 조사`,
        description: "확정된 기준에 따라 필요한 자료와 근거를 수집하고 확인되지 않은 사실은 분리합니다.",
        taskType: "RESEARCH",
        dependsOn: ["scope"],
      },
      {
        key: "analysis",
        title: `${title} · 비교·분석`,
        description: "수집된 자료를 목적에 맞게 비교·분석하고 대표가 판단할 수 있도록 핵심 시사점을 구조화합니다.",
        taskType: "ANALYSIS",
        dependsOn: ["research"],
      },
      {
        key: "qa",
        title: `${title} · 사실·완성도 검수`,
        description: "출처, 숫자, 논리 누락과 과도한 추론을 점검하고 최종 보고 형태로 정리합니다.",
        taskType: "ANALYSIS",
        dependsOn: ["analysis"],
      },
    ];
  }

  return [
    {
      key: "research",
      title: `${title} · 사전 조사`,
      description: "업무에 필요한 기존 자료와 조건을 확인하고 사실·제약사항·필수 요구를 정리합니다.",
      taskType: "RESEARCH",
      dependsOn: [],
    },
    {
      key: "plan",
      title: `${title} · 실행안 기획`,
      description: "사전 조사 결과를 바탕으로 실행 순서, 구성과 완료 기준을 설계합니다.",
      taskType: "PLANNING",
      dependsOn: ["research"],
    },
    {
      key: "produce",
      title: `${title} · 산출물 제작`,
      description: "확정된 실행안을 기준으로 대표가 검수할 수 있는 수준의 실제 산출물을 만듭니다.",
      taskType: "PRODUCTION",
      dependsOn: ["plan"],
    },
    {
      key: "qa",
      title: `${title} · 통합 검수`,
      description: "원래 요청과 결과를 대조하고 누락·오류·리스크를 점검해 대표 승인용 최종안을 정리합니다.",
      taskType: "ANALYSIS",
      dependsOn: ["produce"],
    },
  ];
}

export function buildWorkflowPlan({
  task,
  employees,
  departments,
  workloads,
}: {
  task: { title: string; description: string | null; task_type: string; priority: string };
  employees: AssignmentEmployee[];
  departments: AssignmentDepartment[];
  workloads: AssignmentWorkload[];
}): WorkflowPlan {
  const request = `${task.title} ${task.description ?? ""}`.toLowerCase();
  const complexity = complexKeywords.filter((word) => request.includes(word)).length;
  const baseSteps = templateFor(task.task_type, task.title);

  const usedCount = new Map<string, number>();
  const steps = baseSteps.map((step) => {
    const ranked = rankEmployeesForTask({
      title: step.title,
      description: `${step.description}\n원래 대표 요청: ${task.description ?? task.title}`,
      taskType: step.taskType,
      departmentId: null,
      employees,
      departments,
      workloads,
    });

    const diversified = [...ranked].sort((a, b) => {
      const aAdjusted = a.score - (usedCount.get(a.employee.id) ?? 0) * 8;
      const bAdjusted = b.score - (usedCount.get(b.employee.id) ?? 0) * 8;
      if (bAdjusted !== aAdjusted) return bAdjusted - aAdjusted;
      return a.employee.employee_code.localeCompare(b.employee.employee_code);
    });

    const top = diversified[0];
    if (top) usedCount.set(top.employee.id, (usedCount.get(top.employee.id) ?? 0) + 1);

    return {
      ...step,
      priority: task.priority,
      employeeId: top?.employee.id ?? "",
      departmentId: top?.employee.department_id ?? "",
      matchScore: top?.score ?? null,
      assignmentReason: top
        ? `${top.reasons.join(" / ")} / 동일 협업 내 업무 집중도를 함께 고려`
        : "자동 추천 직원 없음",
      candidates: diversified.slice(0, 5).map((candidate) => ({
        employeeId: candidate.employee.id,
        name: candidate.employee.name,
        employeeCode: candidate.employee.employee_code,
        departmentId: candidate.employee.department_id,
        score: candidate.score,
      })),
    };
  });

  return {
    recommended: complexity >= 2 || steps.length >= 4,
    reason:
      complexity >= 2
        ? "조사·기획·제작·검수처럼 서로 다른 전문 단계가 포함되어 협업 방식이 적합합니다."
        : "업무를 전문 단계로 나누면 결과물 추적과 검수가 쉬워집니다.",
    steps,
  };
}
