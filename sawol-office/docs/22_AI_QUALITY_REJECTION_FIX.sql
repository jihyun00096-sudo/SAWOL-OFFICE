-- SAWOL OFFICE STEP22 AI QUALITY / REJECTION PATCH
-- 기존 구조는 유지하고 반려 재작업 시작점만 보강합니다.

begin;

create or replace function public.sawol_reject_autonomous_task(
  p_root_task_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_root public.tasks%rowtype;
  v_start uuid;
  v_key text;
  v_workflow uuid;
  v_count int:=0;
  v_force_full boolean:=false;
  v_force_research boolean:=false;
begin
  if not public.sawol_step22_is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'REJECTION_REASON_REQUIRED'; end if;

  select * into v_root from public.tasks where id=p_root_task_id for update;
  if not found then raise exception 'TASK_NOT_FOUND'; end if;
  if v_root.status<>'PENDING_APPROVAL' then raise exception 'TASK_NOT_PENDING_APPROVAL'; end if;

  v_workflow:=v_root.workflow_id;
  v_force_full := p_reason ~* '(처음부터|전체.*다시|전부.*다시|완전히.*다시|새로.*처음)';
  v_force_research := p_reason ~* '(다시\s*조사|재조사|새로\s*찾|조사.*다시|출처|근거|사실|기사|뉴스|링크|틀렸|부정확|정확.*다시)';

  -- 이전 반려 피드백을 계속 중첩시키지 않고 최신 대표 지시를 ACTIVE로 유지
  update public.task_feedback
  set status='ARCHIVED', resolved_at=coalesce(resolved_at,now())
  where root_task_id=p_root_task_id and status='ACTIVE';

  insert into public.task_feedback(root_task_id,workflow_id,reason)
  values(p_root_task_id,v_workflow,trim(p_reason));

  -- 수동 또는 단일 AUTO: 같은 업무를 새 실행 세션으로 다시 수행
  if v_root.execution_mode='MANUAL' or v_workflow is null then
    update public.tasks
    set status='WAITING', completed_at=null, updated_at=now()
    where id=p_root_task_id;
    return jsonb_build_object('ok',true,'mode',v_root.execution_mode,'reopened',1,'fresh_research',v_force_research);
  end if;

  -- "처음부터/전부 다시"면 첫 단계부터 재작업
  if v_force_full then
    select id,workflow_step_key into v_start,v_key
    from public.tasks
    where workflow_id=v_workflow and is_workflow_root=false
    order by workflow_step_no
    limit 1;
  end if;

  -- 조사/근거/뉴스/기사/사실 문제면 가능한 가장 이른 RESEARCH 단계부터 반드시 재실행
  if v_start is null and v_force_research then
    select id,workflow_step_key into v_start,v_key
    from public.tasks
    where workflow_id=v_workflow and is_workflow_root=false and task_type='RESEARCH'
    order by workflow_step_no
    limit 1;
  end if;

  -- 그 외에는 피드백 유형에 맞는 전문 단계부터
  if v_start is null then
    select id,workflow_step_key into v_start,v_key
    from public.tasks
    where workflow_id=v_workflow and is_workflow_root=false
      and (
        (p_reason~*'(기획|구성|구조|순서|타깃|전략)' and task_type='PLANNING')
        or (p_reason~*'(디자인|화면|모바일|레이아웃|이미지)' and task_type='DESIGN')
        or (p_reason~*'(개발|기능|코드|오류|버그|데이터|보안)' and task_type='DEVELOPMENT')
        or workflow_step_key='final'
      )
    order by case when workflow_step_key='final' then 9 else 0 end,workflow_step_no
    limit 1;
  end if;

  if v_start is null then
    select id,workflow_step_key into v_start,v_key
    from public.tasks
    where workflow_id=v_workflow and is_workflow_root=false
    order by workflow_step_no desc
    limit 1;
  end if;

  if v_start is null then raise exception 'WORKFLOW_STEP_NOT_FOUND'; end if;

  with recursive affected(id) as (
    select v_start
    union
    select d.task_id
    from public.task_dependencies d
    join affected a on d.depends_on_task_id=a.id
    where d.workflow_id=v_workflow
  )
  update public.task_handoffs h
  set status='SUPERSEDED',updated_at=now()
  where h.workflow_id=v_workflow
    and (h.from_task_id in(select id from affected) or h.to_task_id in(select id from affected));

  with recursive affected(id) as (
    select v_start
    union
    select d.task_id
    from public.task_dependencies d
    join affected a on d.depends_on_task_id=a.id
    where d.workflow_id=v_workflow
  )
  update public.tasks
  set status='WAITING',completed_at=null,updated_at=now()
  where id in(select id from affected);
  get diagnostics v_count=row_count;

  update public.tasks
  set status='IN_PROGRESS',completed_at=null,updated_at=now()
  where id=p_root_task_id;

  update public.task_workflows
  set status='ACTIVE',
      execution_mode='AUTOPILOT',
      completed_steps=(select count(*) from public.tasks where workflow_id=v_workflow and is_workflow_root=false and status='COMPLETED'),
      last_error=null,
      iteration=coalesce(iteration,0)+1,
      completed_at=null,
      updated_at=now()
  where id=v_workflow;

  return jsonb_build_object(
    'ok',true,
    'mode','AUTO',
    'reopen_from',v_key,
    'reopened',v_count,
    'fresh_research',v_force_research,
    'full_restart',v_force_full
  );
end $$;

revoke all on function public.sawol_reject_autonomous_task(uuid,text) from public;
grant execute on function public.sawol_reject_autonomous_task(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;

select p.proname as function_name, pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='sawol_reject_autonomous_task';
