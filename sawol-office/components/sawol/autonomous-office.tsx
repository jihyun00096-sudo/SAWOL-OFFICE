"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { buildWorkflowPlan } from "@/lib/sawol/workflow";
import type { AssignmentDepartment, AssignmentEmployee, AssignmentWorkload } from "@/lib/sawol/assignment";

export function AutonomousOffice({task,employees,departments,workloads,hasWorkflow}:{task:{id:string;title:string;description:string|null;task_type:string;priority:string;status:string};employees:AssignmentEmployee[];departments:AssignmentDepartment[];workloads:AssignmentWorkload[];hasWorkflow:boolean}){
  const router=useRouter(); const [busy,setBusy]=useState(false); const [message,setMessage]=useState(""); const [progress,setProgress]=useState<number|null>(null);
  const plan=useMemo(()=>buildWorkflowPlan({task,employees,departments,workloads}),[task,employees,departments,workloads]);
  async function advanceLoop(){
    for(let i=0;i<12;i++){
      const r=await fetch(`/api/office/tasks/${task.id}/autopilot`,{method:"POST"}); const p=await r.json().catch(()=>null);
      if(!r.ok||!p?.ok) throw new Error(p?.message||`자동 실행 실패 (${r.status})`);
      setProgress(typeof p.progress==="number"?p.progress:null); setMessage(p.stepTitle?`${p.stepTitle} 처리 완료 · 다음 업무를 이어서 진행합니다.`:"AI 직원들이 업무를 진행하고 있습니다.");
      router.refresh();
      if(["AWAITING_APPROVAL","COMPLETED"].includes(p.state)){setMessage("AI 직원 협업이 끝났습니다. 최종 결과가 대표 승인함으로 이동했습니다.");return;}
      await new Promise(res=>setTimeout(res,500));
    }
    throw new Error("자동 실행 안전 한도에 도달했습니다. 진행 상태를 확인해주세요.");
  }
  async function start(){
    if(busy)return; setBusy(true); setMessage(""); setProgress(0);
    try{
      if(!hasWorkflow&&plan.mode==="COLLAB"){
        if(plan.steps.some(s=>!s.employeeId)) throw new Error("자동 배정 가능한 직원이 부족합니다.");
        const supabase=createClient();
        const payload=plan.steps.map(s=>({key:s.key,title:s.title,description:s.description,task_type:s.taskType,priority:s.priority,employee_id:s.employeeId,department_id:s.departmentId||null,match_score:s.matchScore,assignment_reason:s.assignmentReason,depends_on:s.dependsOn}));
        const {error}=await supabase.rpc("sawol_create_workflow",{p_root_task_id:task.id,p_steps:payload}); if(error) throw new Error(error.message);
      }
      await advanceLoop();
    }catch(e){setMessage(e instanceof Error?e.message:"자동 실행 중 오류가 발생했습니다.");}finally{setBusy(false);router.refresh();}
  }
  const closed=["COMPLETED","PENDING_APPROVAL","CANCELLED","CANCELED"].includes(task.status);
  return <section className="rounded-[18px] border border-[#DDE4FA] bg-[#FBFCFF] p-4 sm:p-5 lg:p-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="text-[13px] font-semibold">AI 자율 오피스</p><span className="rounded-full bg-[#EEF2FF] px-2 py-1 text-[8px] font-semibold text-[#3157D5]">AUTO</span></div><p className="mt-1 max-w-[760px] text-[10px] leading-5 text-[#7A8290]">대표는 업무만 맡기면 됩니다. 비서실장 판단 → 직원 자동 배정 → 협업·인수인계 → 통합 검수까지 자동 진행하고 최종 결과만 승인함에 올립니다.</p></div>
      {!closed?<button onClick={start} disabled={busy} className="h-11 shrink-0 rounded-[11px] bg-[#3157D5] px-5 text-[11px] font-semibold text-white disabled:opacity-50">{busy?"AI 직원들이 처리 중...":"AI 조직에 맡기기"}</button>:null}</div>
    {!hasWorkflow?<div className="mt-4 rounded-[13px] bg-white p-4"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#F3F5F8] px-2.5 py-1 text-[9px] font-semibold">복잡도 {plan.complexity}%</span><span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${plan.mode==="COLLAB"?"bg-[#EEF2FF] text-[#3157D5]":"bg-[#ECF8F0] text-[#2D7650]"}`}>{plan.mode==="COLLAB"?`협업 ${plan.steps.length}단계 권장`:"단일 직원 처리 권장"}</span></div><p className="mt-2 text-[10px] leading-5 text-[#7B828E]">{plan.reason}</p></div>:null}
    {progress!==null?<div className="mt-4"><div className="h-2 overflow-hidden rounded-full bg-[#E9EDF7]"><div className="h-full rounded-full bg-[#3157D5] transition-all" style={{width:`${progress}%`}}/></div><p className="mt-2 text-[9px] text-[#7D8490]">자동 진행률 {progress}%</p></div>:null}
    {message?<p className={`mt-3 rounded-[10px] px-3 py-2.5 text-[10px] leading-5 ${message.includes("오류")||message.includes("실패")?"bg-[#FFF2F2] text-[#A64242]":"bg-[#F1F6FF] text-[#3157D5]"}`}>{message}</p>:null}
  </section>;
}
