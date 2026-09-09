import {
  rankEmployeesForTask,
  type AssignmentDepartment,
  type AssignmentEmployee,
  type AssignmentWorkload,
} from "@/lib/sawol/assignment";

export type WorkflowMode = "SINGLE" | "COLLAB";
export type WorkflowPlanStep = {
  key: string; title: string; description: string; taskType: string; priority: string;
  dependsOn: string[]; employeeId: string; departmentId: string; matchScore: number | null;
  assignmentReason: string; candidates: Array<{ employeeId:string; name:string; employeeCode:string; departmentId:string; score:number }>;
};
export type WorkflowPlan = { mode: WorkflowMode; complexity: number; recommended:boolean; reason:string; steps:WorkflowPlanStep[] };

const collaborationSignals = ["전체", "구축", "개발", "사이트", "시스템", "자동화", "런칭", "리뉴얼", "상세페이지 전체", "조사 후", "분석 후", "기획부터", "제작까지", "여러 직원", "협업", "종합", "보고서 작성"];
const simpleSignals = ["체크리스트", "한 문장", "문구 수정", "오타", "짧게", "5개", "간단", "요약", "정리해줘", "메일 작성", "공지 작성"];

export function assessWorkflowComplexity(task:{title:string;description:string|null;task_type:string}) {
  const text = `${task.title} ${task.description ?? ""}`.toLowerCase();
  let score = 18;
  score += collaborationSignals.filter(x => text.includes(x)).length * 14;
  score -= simpleSignals.filter(x => text.includes(x)).length * 10;
  const numbered = (text.match(/\b\d+[.)]/g) ?? []).length;
  score += Math.min(24, numbered * 3);
  if (["DEVELOPMENT","DESIGN"].includes(task.task_type)) score += 12;
  if (text.length > 700) score += 12; else if (text.length < 180) score -= 8;
  if (/한\s*명|혼자|단일/.test(text)) score = 10;
  if (/여러\s*(직원|부서)|협업|나눠서/.test(text)) score = Math.max(score, 75);
  return Math.max(0, Math.min(100, Math.round(score)));
}

function templateFor(taskType:string,title:string,description:string|null) {
  const text = `${title} ${description ?? ""}`.toLowerCase();
  if (taskType === "DEVELOPMENT") return [
    {key:"spec",title:"요구사항·데이터 구조 정리",description:"대표 요청을 구현 가능한 요구사항, 데이터 구조, 권한·보안 조건과 완료 기준으로 정리합니다.",taskType:"PLANNING",dependsOn:[]},
    {key:"build",title:"핵심 기능 구현안 작성",description:"확정된 요구사항을 바탕으로 실제 구현 구조와 핵심 로직을 작성합니다.",taskType:"DEVELOPMENT",dependsOn:["spec"]},
    {key:"ui",title:"사용 화면·운영 흐름 정리",description:"사용자가 실제로 쓰는 화면과 운영 흐름, 모바일 대응을 구체화합니다.",taskType:"DEVELOPMENT",dependsOn:["spec"]},
    {key:"final",title:"통합 검수·최종 결과 정리",description:"앞 단계 결과를 모두 통합해 누락·오류·보안 위험을 검수하고 대표 승인용 최종본 하나로 정리합니다.",taskType:"ANALYSIS",dependsOn:["spec","build","ui"]},
  ];
  if (taskType === "DESIGN" || text.includes("상세페이지")) return [
    {key:"research",title:"필요 자료·타깃 확인",description:"대표 요청을 수행하는 데 꼭 필요한 타깃, 기존 자료와 참고 기준만 확인합니다.",taskType:"RESEARCH",dependsOn:[]},
    {key:"structure",title:"전체 구성·카피 기획",description:"조사 결과를 바탕으로 전체 정보 구조, 핵심 메시지와 섹션별 내용을 설계합니다.",taskType:"PLANNING",dependsOn:["research"]},
    {key:"design",title:"실제 제작안 구체화",description:"기획 결과를 실제 제작에 바로 사용할 수 있는 수준으로 구체화합니다.",taskType:"DESIGN",dependsOn:["structure"]},
    {key:"final",title:"통합 검수·최종본 정리",description:"모든 결과를 통합해 누락·과장·흐름을 검수하고 대표 승인용 최종 결과 하나로 정리합니다.",taskType:"ANALYSIS",dependsOn:["research","structure","design"]},
  ];
  if (taskType === "RESEARCH" || taskType === "ANALYSIS") return [
    {key:"research",title:"자료 조사·사실 확인",description:"필요 자료와 근거를 수집하고 확인된 사실과 추정을 분리합니다.",taskType:"RESEARCH",dependsOn:[]},
    {key:"analysis",title:"비교·분석",description:"수집 자료를 목적에 맞게 비교하고 핵심 시사점을 구조화합니다.",taskType:"ANALYSIS",dependsOn:["research"]},
    {key:"final",title:"최종 보고서 정리",description:"조사와 분석을 통합해 대표가 바로 판단할 수 있는 최종 결과로 정리합니다.",taskType:"ANALYSIS",dependsOn:["research","analysis"]},
  ];
  return [
    {key:"produce",title:title,description:description ?? "대표 요청을 그대로 수행해 완성 결과를 만듭니다.",taskType:taskType || "PRODUCTION",dependsOn:[]},
    {key:"final",title:"최종 검수·결과 정리",description:"앞 결과를 검수하고 대표 승인용 최종본 하나로 정리합니다.",taskType:"ANALYSIS",dependsOn:["produce"]},
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
