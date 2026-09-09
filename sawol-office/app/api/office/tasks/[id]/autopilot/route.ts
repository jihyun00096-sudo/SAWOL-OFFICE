import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { executeAiTask } from "@/lib/ai/provider";
import { createHumanCode } from "@/lib/sawol/code";
import type { SawolAiContext } from "@/lib/ai/types";

export const runtime = "nodejs";
export const maxDuration = 180;

function msg(error:unknown){return error instanceof Error?error.message.slice(0,700):"AI 자동 실행 오류";}

async function requireAdmin(supabase:any){
  const {data:claims}=await supabase.auth.getClaims(); const userId=claims?.claims?.sub;
  if(!userId) return false;
  const {data}=await supabase.from("app_admins").select("user_id").eq("user_id",userId).eq("is_active",true).maybeSingle();
  return Boolean(data);
}

async function executeTask(supabase:any, task:any){
  let {data:run}=await supabase.from("task_runs").select("*").eq("task_id",task.id).in("status",["READY","RUNNING"]).order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(!run){
    const {error}=await supabase.rpc("sawol_start_task_run",{p_task_id:task.id,p_run_code:createHumanCode("RUN")});
    if(error) throw new Error(error.message);
    const r=await supabase.from("task_runs").select("*").eq("task_id",task.id).in("status",["READY","RUNNING"]).order("created_at",{ascending:false}).limit(1).maybeSingle(); run=r.data;
  }
  if(!run) throw new Error("RUN_NOT_CREATED");
  const [projectResult,departmentResult,employeeResult,memoryResult,handoffResult,rootTaskResult,feedbackResult]=await Promise.all([
    task.project_id?supabase.from("projects").select("*").eq("id",task.project_id).maybeSingle():Promise.resolve({data:null}),
    task.assigned_department_id?supabase.from("departments").select("*").eq("id",task.assigned_department_id).maybeSingle():Promise.resolve({data:null}),
    (run.employee_id||task.assigned_employee_id)?supabase.from("employees").select("*").eq("id",run.employee_id||task.assigned_employee_id).maybeSingle():Promise.resolve({data:null}),
    supabase.from("memories").select("*").eq("status","ACTIVE").limit(12),
    task.workflow_id&&!task.is_workflow_root?supabase.from("task_handoffs").select("title,summary,content,from_task_id,created_at").eq("to_task_id",task.id).eq("status","AVAILABLE").order("created_at"):Promise.resolve({data:[]}),
    task.parent_task_id?supabase.from("tasks").select("task_code,title,description,task_type,priority").eq("id",task.parent_task_id).maybeSingle():Promise.resolve({data:null}),
    supabase.from("task_feedback").select("reason,created_at").eq("root_task_id",task.parent_task_id||task.id).eq("status","ACTIVE").order("created_at",{ascending:false}).limit(3),
  ]);
  const context:SawolAiContext={task,project:projectResult.data??null,department:departmentResult.data??null,employee:employeeResult.data??null,memories:memoryResult.data??[],handoffs:handoffResult.data??[],rootTask:rootTaskResult.data??null,feedbacks:feedbackResult.data??[]};
  try {
    const ai=await executeAiTask({context,useWebSearch:task.task_type==="RESEARCH"});
    const now=new Date().toISOString();
    const {error:saveErr}=await supabase.from("task_runs").update({status:"COMPLETED",provider:ai.provider,model:ai.model,provider_response_id:ai.responseId,usage_json:ai.usage,ai_finished_at:now,submitted_at:now,completed_at:now,result_title:ai.result.title,result_summary:ai.result.summary,result_body:ai.result.body,error_message:null,metadata:{...(run.metadata??{}),autopilot:true,confidence:ai.result.confidence,sources:ai.result.sources},updated_at:now}).eq("id",run.id);
    if(saveErr) throw new Error(saveErr.message);
    return {runId:run.id,result:ai.result};
  } catch (error) {
    const failedAt=new Date().toISOString(); const message=msg(error);
    await supabase.from("task_runs").update({status:"FAILED",error_message:message,ai_finished_at:failedAt,updated_at:failedAt}).eq("id",run.id);
    await supabase.from("tasks").update({status:"ERROR",updated_at:failedAt}).eq("id",task.id);
    throw error;
  }
}

export async function POST(_req:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params; const supabase=await createClient();
  if(!(await requireAdmin(supabase))) return NextResponse.json({ok:false,message:"권한이 없습니다."},{status:403});
  const {data:root}=await supabase.from("tasks").select("*").eq("id",id).maybeSingle();
  if(!root) return NextResponse.json({ok:false,message:"업무를 찾을 수 없습니다."},{status:404});
  try{
    await supabase.from("tasks").update({requires_ceo_approval:true,updated_at:new Date().toISOString()}).eq("id",root.id);
    if(!root.workflow_id){
      const {result}=await executeTask(supabase,{...root,requires_ceo_approval:true});
      await supabase.from("tasks").update({status:"PENDING_APPROVAL",updated_at:new Date().toISOString()}).eq("id",root.id);
      return NextResponse.json({ok:true,state:"AWAITING_APPROVAL",progress:100,title:result.title});
    }
    const {data:children}=await supabase.from("tasks").select("*").eq("workflow_id",root.workflow_id).eq("is_workflow_root",false).order("workflow_step_no");
    const rows=children??[];
    const completed=rows.filter((x:any)=>x.status==="COMPLETED").length;
    if(rows.length&&completed===rows.length){
      const refreshed=await supabase.from("tasks").select("status").eq("id",root.id).maybeSingle();
      return NextResponse.json({ok:true,state:refreshed.data?.status==="PENDING_APPROVAL"?"AWAITING_APPROVAL":"FINISHING",progress:100});
    }
    let next:any=null;
    for(const child of rows){
      if(child.status==="COMPLETED") continue;
      const {data:unmet}=await supabase.rpc("sawol_unmet_dependencies",{p_task_id:child.id});
      if(!(unmet?.length)){next=child;break;}
    }
    if(!next) return NextResponse.json({ok:true,state:"WAITING",progress:rows.length?Math.round(completed/rows.length*100):0});
    const {result}=await executeTask(supabase,next);
    await supabase.from("tasks").update({status:"COMPLETED",completed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",next.id);
    const {data:afterRoot}=await supabase.from("tasks").select("status").eq("id",root.id).maybeSingle();
    const done=completed+1; const progress=rows.length?Math.round(done/rows.length*100):100;
    return NextResponse.json({ok:true,state:afterRoot?.status==="PENDING_APPROVAL"?"AWAITING_APPROVAL":"RUNNING",progress,stepTitle:next.title,resultTitle:result.title});
  }catch(error){
    const message=msg(error);
    if(root.workflow_id) await supabase.from("task_workflows").update({status:"FAILED",last_error:message,updated_at:new Date().toISOString()}).eq("id",root.workflow_id);
    return NextResponse.json({ok:false,message},{status:500});
  }
}
