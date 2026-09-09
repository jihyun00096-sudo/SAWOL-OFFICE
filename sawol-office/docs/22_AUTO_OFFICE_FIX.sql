-- ============================================================
-- SAWOL OFFICE STEP22 AUTO OFFICE FIX
-- 대표는 지시/승인/반려만, 내부 단계는 AI 직원 자동 진행
-- prerequisite: 22_COLLABORATION_WORKFLOW.sql applied
-- ============================================================
begin;

alter table public.task_workflows add column if not exists execution_mode text not null default 'AUTOPILOT';
alter table public.task_workflows add column if not exists last_error text null;
alter table public.task_workflows add column if not exists iteration integer not null default 1;

create table if not exists public.task_feedback (
  id uuid primary key default gen_random_uuid(),
  root_task_id uuid not null references public.tasks(id) on delete cascade,
  workflow_id uuid null references public.task_workflows(id) on delete cascade,
  reason text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','RESOLVED','ARCHIVED')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz null
);
create index if not exists idx_task_feedback_root on public.task_feedback(root_task_id, created_at desc);
alter table public.task_feedback enable row level security;
drop policy if exists task_feedback_admin_select on public.task_feedback;
drop policy if exists task_feedback_admin_insert on public.task_feedback;
drop policy if exists task_feedback_admin_update on public.task_feedback;
drop policy if exists task_feedback_admin_delete on public.task_feedback;
create policy task_feedback_admin_select on public.task_feedback for select to authenticated using (public.sawol_step22_is_admin());
create policy task_feedback_admin_insert on public.task_feedback for insert to authenticated with check (public.sawol_step22_is_admin());
create policy task_feedback_admin_update on public.task_feedback for update to authenticated using (public.sawol_step22_is_admin()) with check (public.sawol_step22_is_admin());
create policy task_feedback_admin_delete on public.task_feedback for delete to authenticated using (public.sawol_step22_is_admin());

create or replace function public.sawol_reject_autonomous_task(p_root_task_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_root public.tasks%rowtype; v_start uuid; v_key text; v_workflow uuid; v_count int;
begin
  if not public.sawol_step22_is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'REJECTION_REASON_REQUIRED'; end if;
  select * into v_root from public.tasks where id=p_root_task_id for update;
  if not found then raise exception 'TASK_NOT_FOUND'; end if;
  if v_root.status <> 'PENDING_APPROVAL' then raise exception 'TASK_NOT_PENDING_APPROVAL'; end if;
  v_workflow := v_root.workflow_id;
  insert into public.task_feedback(root_task_id,workflow_id,reason) values(p_root_task_id,v_workflow,trim(p_reason));

  if v_workflow is null then
    update public.tasks set status='WAITING', completed_at=null, updated_at=now() where id=p_root_task_id;
    return jsonb_build_object('ok',true,'mode','SINGLE','reopened',1);
  end if;

  -- 반려 문구에 맞는 가장 이른 전문 단계를 선택. 특정 신호가 없으면 최종 통합 단계만 재작업.
  select id, workflow_step_key into v_start, v_key
  from public.tasks
  where workflow_id=v_workflow and is_workflow_root=false
    and (
      (p_reason ~* '(조사|자료|근거|사실|출처)' and task_type='RESEARCH') or
      (p_reason ~* '(기획|구성|구조|순서|타깃|전략)' and task_type='PLANNING') or
      (p_reason ~* '(디자인|화면|모바일|레이아웃|이미지)' and task_type='DESIGN') or
      (p_reason ~* '(개발|기능|코드|오류|버그|데이터|보안)' and task_type='DEVELOPMENT') or
      workflow_step_key='final'
    )
  order by case when workflow_step_key='final' then 9 else 0 end, workflow_step_no
  limit 1;

  if v_start is null then
    select id,workflow_step_key into v_start,v_key from public.tasks where workflow_id=v_workflow and is_workflow_root=false order by workflow_step_no desc limit 1;
  end if;

  with recursive affected(id) as (
    select v_start
    union
    select d.task_id from public.task_dependencies d join affected a on d.depends_on_task_id=a.id where d.workflow_id=v_workflow
  )
  update public.task_handoffs h set status='SUPERSEDED',updated_at=now()
  where h.workflow_id=v_workflow and (h.from_task_id in (select id from affected) or h.to_task_id in (select id from affected));

  with recursive affected(id) as (
    select v_start
    union
    select d.task_id from public.task_dependencies d join affected a on d.depends_on_task_id=a.id where d.workflow_id=v_workflow
  )
  update public.tasks set status='WAITING',completed_at=null,updated_at=now() where id in (select id from affected);
  get diagnostics v_count = row_count;

  update public.tasks set status='IN_PROGRESS',completed_at=null,updated_at=now() where id=p_root_task_id;
  update public.task_workflows set status='ACTIVE',completed_steps=(select count(*) from public.tasks where workflow_id=v_workflow and is_workflow_root=false and status='COMPLETED'),last_error=null,iteration=iteration+1,completed_at=null,updated_at=now() where id=v_workflow;
  return jsonb_build_object('ok',true,'mode','COLLAB','reopen_from',v_key,'reopened',v_count);
end $$;
revoke all on function public.sawol_reject_autonomous_task(uuid,text) from public;
grant execute on function public.sawol_reject_autonomous_task(uuid,text) to authenticated;

create or replace function public.sawol_delete_workflow_tree(p_root_task_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_root public.tasks%rowtype; v_ids uuid[]; v_count int;
begin
  if not public.sawol_step22_is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  select * into v_root from public.tasks where id=p_root_task_id for update;
  if not found then raise exception 'TASK_NOT_FOUND'; end if;
  if v_root.parent_task_id is not null then raise exception 'DELETE_FROM_ROOT_ONLY'; end if;
  select array_agg(id) into v_ids from public.tasks where id=p_root_task_id or parent_task_id=p_root_task_id or (v_root.workflow_id is not null and workflow_id=v_root.workflow_id);
  v_count:=coalesce(array_length(v_ids,1),0);
  delete from public.approvals where task_id=any(v_ids);
  delete from public.reviews where task_id=any(v_ids);
  delete from public.results where task_id=any(v_ids);
  delete from public.tasks where id<>p_root_task_id and id=any(v_ids);
  delete from public.tasks where id=p_root_task_id;
  return jsonb_build_object('ok',true,'deleted_tasks',v_count);
end $$;
revoke all on function public.sawol_delete_workflow_tree(uuid) from public;
grant execute on function public.sawol_delete_workflow_tree(uuid) to authenticated;

commit;

select column_name from information_schema.columns where table_schema='public' and table_name='task_workflows' and column_name in ('execution_mode','last_error','iteration') order by column_name;
select table_name from information_schema.tables where table_schema='public' and table_name='task_feedback';
