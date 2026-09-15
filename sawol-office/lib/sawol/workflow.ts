import {
  rankEmployeesForTask,
  type AssignmentDepartment,
  type AssignmentEmployee,
  type AssignmentWorkload,
} from "@/lib/sawol/assignment";

export type WorkflowMode = "SINGLE" | "COLLAB";

export type WorkflowAssessment = {
  complexity: number;
  mode: WorkflowMode;
  threshold: number;
  reasons: string[];
};
export type WorkflowPlanStep = {
  key: string; title: string; description: string; taskType: string; priority: string;
  dependsOn: string[]; employeeId: string; departmentId: string; matchScore: number | null;
  assignmentReason: string; candidates: Array<{ employeeId:string; name:string; employeeCode:string; departmentId:string; score:number }>;
};
export type WorkflowPlan = { mode: WorkflowMode; complexity: number; recommended:boolean; reason:string; steps:WorkflowPlanStep[] };

const collaborationSignals = [
  "전체",
  "구축",
  "개발",
  "사이트",
  "시스템",
  "자동화",
  "런칭",
  "리뉴얼",
  "상세페이지 전체",
  "조사 후",
  "분석 후",
  "기획부터",
  "제작까지",
  "결과까지",
  "마지막에",
  "여러 직원",
  "협업",
  "종합",
  "보고서 작성",
];

const simpleSignals = [
  "체크리스트",
  "한 문장",
  "문구 수정",
  "오타",
  "짧게",
  "간단",
  "메일 작성",
  "공지 작성",
];

function capabilityCount(text: string) {
  const groups = [
    /조사|검색|리서치|자료\s*수집|뉴스|시장\s*이슈/,
    /출처|근거|사실\s*확인|검증|팩트\s*체크/,
    /분석|비교|시사점|핵심\s*내용|정리/,
    /기획|구성|카피|구조화|설계/,
    /이미지|카드뉴스|썸네일|포스터|배너|일러스트|디자인|사진/,
    /개발|코드|구현|배포|자동화|사이트|시스템/,
    /보고서|최종\s*보고|결과\s*제출|대표\s*보고/,
  ];

  return groups.filter((pattern) => pattern.test(text)).length;
}

export function assessWorkflowComplexity(task:{title:string;description:string|null;task_type:string}) {
  const text = `${task.title} ${task.description ?? ""}`.toLowerCase();
  let score = 18;

  score += collaborationSignals.filter((x) => text.includes(x)).length * 10;

  const capabilities = capabilityCount(text);

  if (capabilities >= 4) {
    score = Math.max(score, 82);
  } else if (capabilities === 3) {
    score = Math.max(score, 72);
  } else if (capabilities === 2) {
    score += 24;
  }

  const hasResearch = /조사|검색|리서치|자료\s*수집|뉴스|시장\s*이슈/.test(text);
  const hasVerification = /출처|근거|사실\s*확인|검증|팩트\s*체크/.test(text);
  const hasVisualDeliverable = /이미지|카드뉴스|썸네일|포스터|배너|일러스트|디자인|사진/.test(text);
  const hasSequentialLanguage =
    /조사.*(정리|분석|기획|제작)|정리.*(이미지|카드뉴스|제작)|(?:뒤|후|다음).*?(?:이미지|제작|결과)|마지막.*(?:이미지|결과|제출)/s.test(text);

  // 조사/검증 + 시각 산출물은 서로 다른 전문 단계가 필요한 대표적인 협업 업무입니다.
  if (hasResearch && hasVisualDeliverable) {
    score = Math.max(score, 86);
  }

  if (hasResearch && hasVerification && hasVisualDeliverable) {
    score = Math.max(score, 92);
  }

  if (hasSequentialLanguage && capabilities >= 2) {
    score = Math.max(score, 78);
  }

  const numbered = (text.match(/\b\d+[.)]/g) ?? []).length;
  score += Math.min(18, numbered * 3);

  if (["DEVELOPMENT", "DESIGN"].includes(task.task_type)) {
    score += 12;
  }

  // 짧은 문장이라도 여러 전문 단계가 명확하면 길이 때문에 단일 업무로 강등하지 않습니다.
  if (text.length > 700) {
    score += 12;
  } else if (text.length < 180 && capabilities <= 1) {
    score -= 8;
  }

  if (capabilities <= 1) {
    score -= simpleSignals.filter((x) => text.includes(x)).length * 10;
  }

  if (/한\s*명|혼자|단일\s*(직원|처리)/.test(text)) {
    score = 10;
  }

  if (/여러\s*(직원|부서)|협업|나눠서|분담/.test(text)) {
    score = Math.max(score, 85);
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function templateFor(taskType:string,title:string,description:string|null) {
  const text = `${title} ${description ?? ""}`.toLowerCase();

  const mixedResearchVisual =
    /조사|검색|리서치|자료\s*수집|뉴스|시장\s*이슈/.test(text) &&
    /이미지|카드뉴스|썸네일|포스터|배너|일러스트|디자인|사진/.test(text);

  if (mixedResearchVisual) return [
    {key:"research",title:"자료 조사·출처 검증",description:"대표 요청에 필요한 최신 자료를 조사하고, 각 사실의 출처·날짜·확인 범위를 검증합니다. 확인된 사실과 추정을 분리하고 다음 단계가 그대로 사용할 수 있게 근거를 남깁니다.",taskType:"RESEARCH",dependsOn:[]},
    {key:"structure",title:"핵심 내용·카드 구성 기획",description:"조사 결과를 바탕으로 대표가 요청한 수량과 형식에 맞춰 핵심 메시지, 우선순위, 카드뉴스/시각 산출물의 정보 구조와 실제 들어갈 문구를 설계합니다.",taskType:"PLANNING",dependsOn:["research"]},
    {key:"design",title:"시각 산출물 제작",description:"확정된 조사 근거와 구성안을 바탕으로 대표 요청에 맞는 실제 이미지·카드뉴스 산출물을 제작합니다. 원문 조건, 글자 사용 여부, 화면 비율과 스타일을 정확히 지킵니다.",taskType:"DESIGN",dependsOn:["research","structure"]},
    {key:"final",title:"출처·내용·산출물 통합 검수",description:"조사 근거, 문구, 시각 산출물을 대표 원문과 다시 대조해 누락·오류·과장을 수정합니다. 최종 결과와 출처를 대표 승인용 완성본으로 제출합니다.",taskType:"ANALYSIS",dependsOn:["research","structure","design"]},
  ];

  if (taskType === "DEVELOPMENT") return [
    {key:"spec",title:"요구사항·데이터 구조 정리",description:"대표 원문의 요구사항을 생략하지 말고 구현 가능한 요구사항, 데이터 구조, 권한·보안 조건, 예외 케이스와 완료 기준까지 실무 문서 수준으로 정리합니다.",taskType:"PLANNING",dependsOn:[]},
    {key:"build",title:"핵심 기능 구현안 작성",description:"확정된 요구사항을 바탕으로 실제 구현 구조, 핵심 로직, 오류 처리와 테스트 포인트까지 다음 직원이 바로 이어받을 수 있는 수준으로 작성합니다.",taskType:"DEVELOPMENT",dependsOn:["spec"]},
    {key:"ui",title:"사용 화면·운영 흐름 정리",description:"사용자가 실제로 쓰는 화면과 운영 흐름, 모바일 대응, 상태별 UI와 예외 상황까지 구체화합니다.",taskType:"DEVELOPMENT",dependsOn:["spec"]},
    {key:"final",title:"통합 검수·최종 결과 정리",description:"앞 단계 결과를 모두 읽고 대표 원문의 요구사항 체크리스트와 대조합니다. 누락·오류·보안 위험을 수정한 뒤 요약본이 아니라 대표가 바로 사용할 수 있는 완성형 최종본 하나로 통합합니다.",taskType:"ANALYSIS",dependsOn:["spec","build","ui"]},
  ];
  if (taskType === "DESIGN" || text.includes("상세페이지")) return [
    {key:"research",title:"필요 자료·타깃 확인",description:"대표 요청을 수행하는 데 필요한 타깃, 기존 자료, 사실 근거, 참고 기준을 확인하고 불확실한 부분을 분리합니다. 조사 결과는 다음 단계가 실제 기획에 쓸 수 있을 정도로 구체적으로 남깁니다.",taskType:"RESEARCH",dependsOn:[]},
    {key:"structure",title:"전체 구성·카피 기획",description:"조사 결과와 대표 원문을 바탕으로 전체 정보 구조, 핵심 메시지, 섹션별 목적과 실제 들어갈 내용을 구체적으로 설계합니다. 제목만 나열하지 않습니다.",taskType:"PLANNING",dependsOn:["research"]},
    {key:"design",title:"실제 제작안 구체화",description:"기획 결과를 실제 제작에 바로 사용할 수 있도록 문구, 구성, 우선순위, 화면 흐름과 제작 지시까지 구체화합니다.",taskType:"DESIGN",dependsOn:["structure"]},
    {key:"final",title:"통합 검수·최종본 정리",description:"모든 단계 결과를 대표 원문의 요구사항과 다시 대조하고 누락·과장·중복을 수정합니다. 선행 결과를 짧게 요약하지 말고 대표가 바로 사용할 수 있는 완성형 최종 결과 하나로 통합합니다.",taskType:"ANALYSIS",dependsOn:["research","structure","design"]},
  ];
  if (taskType === "RESEARCH" || taskType === "ANALYSIS") return [
    {key:"research",title:"자료 조사·사실 확인",description:"필요 자료를 새로 조사하고 각 근거의 출처·날짜·확인 범위를 기록합니다. 기사 제목만으로 내용을 추정하지 말고 확인된 사실과 추정을 엄격히 분리합니다.",taskType:"RESEARCH",dependsOn:[]},
    {key:"analysis",title:"비교·분석",description:"수집 자료의 출처와 사실관계를 유지한 채 비교하고 대표의 목적에 맞는 핵심 시사점, 차이점, 리스크를 구체적으로 구조화합니다.",taskType:"ANALYSIS",dependsOn:["research"]},
    {key:"final",title:"최종 보고서 정리",description:"조사와 분석의 근거를 유지하면서 대표 원문의 수량·형식·출처 조건을 다시 확인하고, 대표가 바로 판단하거나 사용할 수 있는 완성형 최종 결과로 정리합니다.",taskType:"ANALYSIS",dependsOn:["research","analysis"]},
  ];
  return [
    {key:"produce",title:title,description:description ?? "대표 요청의 세부 조건을 생략하지 않고 그대로 수행해 바로 사용할 수 있는 완성 결과를 만듭니다.",taskType:taskType || "PRODUCTION",dependsOn:[]},
    {key:"final",title:"최종 검수·결과 정리",description:"앞 결과를 대표 원문과 항목별로 대조해 누락을 보완하고, 단순 요약이 아닌 대표 승인용 완성 최종본 하나로 정리합니다.",taskType:"ANALYSIS",dependsOn:["produce"]},
  ];
}

export function buildWorkflowPlan({task,employees,departments,workloads}:{task:{title:string;description:string|null;task_type:string;priority:string};employees:AssignmentEmployee[];departments:AssignmentDepartment[];workloads:AssignmentWorkload[]}):WorkflowPlan {
  const complexity = assessWorkflowComplexity(task);
  const mode:WorkflowMode = complexity >= 60 ? "COLLAB" : "SINGLE";
  if (mode === "SINGLE") return {mode,complexity,recommended:false,reason:`복잡도 ${complexity}점 · 한 명의 담당 직원이 끝까지 처리하는 편이 더 효율적입니다.`,steps:[]};
  const baseSteps = templateFor(task.task_type,task.title,task.description);
  const usedCount = new Map<string,number>();
  const steps = baseSteps.map(step=>{
    const ranked = rankEmployeesForTask({title:step.title,description:`${step.description}\n원래 대표 요청: ${task.description ?? task.title}`,taskType:step.taskType,departmentId:null,employees,departments,workloads});
    const diversified=[...ranked].sort((a,b)=>(b.score-(usedCount.get(b.employee.id)??0)*8)-(a.score-(usedCount.get(a.employee.id)??0)*8));
    const top=diversified[0]; if(top) usedCount.set(top.employee.id,(usedCount.get(top.employee.id)??0)+1);
    return {...step,priority:task.priority,employeeId:top?.employee.id??"",departmentId:top?.employee.department_id??"",matchScore:top?.score??null,assignmentReason:top?`${top.reasons.join(" / ")} / 동일 협업 내 업무 집중도 고려`:"자동 추천 직원 없음",candidates:diversified.slice(0,5).map(c=>({employeeId:c.employee.id,name:c.employee.name,employeeCode:c.employee.employee_code,departmentId:c.employee.department_id,score:c.score}))};
  });
  return {mode,complexity,recommended:true,reason:`복잡도 ${complexity}점 · 서로 다른 전문 작업이 필요해 AI 직원 협업이 효율적입니다.`,steps};
}
