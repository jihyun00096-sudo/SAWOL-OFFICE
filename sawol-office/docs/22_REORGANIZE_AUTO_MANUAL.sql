-- ============================================================
-- SAWOL OFFICE STEP22 REORGANIZE
-- AUTO + MANUAL dual-mode foundation
-- 기존 수동 기능 보존 / 자동화는 상위 레이어로 추가
-- ============================================================
begin;

-- 1. 루트 업무 단위 실행 방식
alter table public.tasks
  add column if not exists execution_mode text not null default 'MANUAL';

-- 기존 DB에 예상 밖 값이 있다면 안전하게 MANUAL로 정리
update public.tasks
set execution_mode = 'MANUAL'
where execution_mode is null
   or execution_mode not in ('AUTO','MANUAL');

DO $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid='public.tasks'::regclass
      and contype='c'
      and pg_get_constraintdef(oid) ilike '%execution_mode%'
  loop
    execute format('alter table public.tasks drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.tasks
  add constraint tasks_execution_mode_check
  check (execution_mode in ('AUTO','MANUAL'));

create index if not exists idx_tasks_execution_mode
  on public.tasks(execution_mode);

-- 2. 기존 workflow 실행모드 컬럼 보강
alter table public.task_workflows
  add column if not exists execution_mode text not null default 'AUTOPILOT',
  add column if not exists last_error text null,
  add column if not exists iteration integer not null default 1;

-- 3. AUTO/MANUAL 전환 RPC
create or replace function public.sawol_set_task_execution_mode(
  p_task_id uuid,
  p_mode text
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_task public.tasks%rowtype;
begin
  if not public.sawol_step22_is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  if p_mode not in ('AUTO','MANUAL') then raise exception 'INVALID_EXECUTION_MODE'; end if;

  select * into v_task from public.tasks where id=p_task_id for update;
  if not found then raise exception 'TASK_NOT_FOUND'; end if;
  if v_task.parent_task_id is not null then raise exception 'ROOT_TASK_ONLY'; end if;
  if v_task.status in ('COMPLETED','CANCELLED','CANCELED') then raise exception 'TASK_IS_CLOSED'; end if;

  update public.tasks
  set execution_mode=p_mode, updated_at=now()
  where id=p_task_id;

  if v_task.workflow_id is not null then
    if p_mode='MANUAL' then
      update public.task_workflows
      set execution_mode='MANUAL',
          status=case when status='ACTIVE' then 'PAUSED' else status end,
          updated_at=now()
      where id=v_task.workflow_id;
    else
      update public.task_workflows
      set execution_mode='AUTOPILOT',
          status=case when status='PAUSED' then 'ACTIVE' else status end,
          last_error=null,
          updated_at=now()
      where id=v_task.workflow_id;
    end if;
  end if;

  return jsonb_build_object('ok',true,'task_id',p_task_id,'execution_mode',p_mode);
end $$;

revoke all on function public.sawol_set_task_execution_mode(uuid,text) from public;
grant execute on function public.sawol_set_task_execution_mode(uuid,text) to authenticated;

-- 4. 대표 피드백 테이블 (기존 자동화 반려 기능 복구 포함)
create table if not exists public.task_feedback (
  id uuid primary key default gen_random_uuid(),
  root_task_id uuid not null references public.tasks(id) on delete cascade,
  workflow_id uuid null references public.task_workflows(id) on delete cascade,
  reason text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','RESOLVED','ARCHIVED')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz null
);
create index if not exists idx_task_feedback_root on public.task_feedback(root_task_id,created_at desc);
alter table public.task_feedback enable row level security;
drop policy if exists task_feedback_admin_select on public.task_feedback;
drop policy if exists task_feedback_admin_insert on public.task_feedback;
drop policy if exists task_feedback_admin_update on public.task_feedback;
drop policy if exists task_feedback_admin_delete on public.task_feedback;
create policy task_feedback_admin_select on public.task_feedback for select to authenticated using (public.sawol_step22_is_admin());
create policy task_feedback_admin_insert on public.task_feedback for insert to authenticated with check (public.sawol_step22_is_admin());
create policy task_feedback_admin_update on public.task_feedback for update to authenticated using (public.sawol_step22_is_admin()) with check (public.sawol_step22_is_admin());
create policy task_feedback_admin_delete on public.task_feedback for delete to authenticated using (public.sawol_step22_is_admin());

-- 5. 반려 RPC: 수동 업무는 재오픈만, 자동 업무는 관련 단계부터 재작업 준비
create or replace function public.sawol_reject_autonomous_task(p_root_task_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_root public.tasks%rowtype;v_start uuid;v_key text;v_workflow uuid;v_count int:=0;
begin
  if not public.sawol_step22_is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'REJECTION_REASON_REQUIRED'; end if;
  select * into v_root from public.tasks where id=p_root_task_id for update;
  if not found then raise exception 'TASK_NOT_FOUND'; end if;
  if v_root.status<>'PENDING_APPROVAL' then raise exception 'TASK_NOT_PENDING_APPROVAL'; end if;
  v_workflow:=v_root.workflow_id;
  insert into public.task_feedback(root_task_id,workflow_id,reason) values(p_root_task_id,v_workflow,trim(p_reason));

  if v_root.execution_mode='MANUAL' or v_workflow is null then
    update public.tasks set status='WAITING',completed_at=null,updated_at=now() where id=p_root_task_id;
    return jsonb_build_object('ok',true,'mode',v_root.execution_mode,'reopened',1);
  end if;

  select id,workflow_step_key into v_start,v_key
  from public.tasks
  where workflow_id=v_workflow and is_workflow_root=false
    and ((p_reason~*'(조사|자료|근거|사실|출처|기사|뉴스)' and task_type='RESEARCH')
      or (p_reason~*'(기획|구성|구조|순서|타깃|전략)' and task_type='PLANNING')
      or (p_reason~*'(디자인|화면|모바일|레이아웃|이미지)' and task_type='DESIGN')
      or (p_reason~*'(개발|기능|코드|오류|버그|데이터|보안)' and task_type='DEVELOPMENT')
      or workflow_step_key='final')
  order by case when workflow_step_key='final' then 9 else 0 end,workflow_step_no limit 1;

  if v_start is null then
    select id,workflow_step_key into v_start,v_key from public.tasks where workflow_id=v_workflow and is_workflow_root=false order by workflow_step_no desc limit 1;
  end if;
  if v_start is null then raise exception 'WORKFLOW_STEP_NOT_FOUND'; end if;

  with recursive affected(id) as (
    select v_start
    union
    select d.task_id from public.task_dependencies d join affected a on d.depends_on_task_id=a.id where d.workflow_id=v_workflow
  )
  update public.task_handoffs h set status='SUPERSEDED',updated_at=now()
  where h.workflow_id=v_workflow and (h.from_task_id in(select id from affected) or h.to_task_id in(select id from affected));

  with recursive affected(id) as (
    select v_start
    union
    select d.task_id from public.task_dependencies d join affected a on d.depends_on_task_id=a.id where d.workflow_id=v_workflow
  )
  update public.tasks set status='WAITING',completed_at=null,updated_at=now() where id in(select id from affected);
  get diagnostics v_count=row_count;

  update public.tasks set status='IN_PROGRESS',completed_at=null,updated_at=now() where id=p_root_task_id;
  update public.task_workflows set status='ACTIVE',execution_mode='AUTOPILOT',completed_steps=(select count(*) from public.tasks where workflow_id=v_workflow and is_workflow_root=false and status='COMPLETED'),last_error=null,iteration=coalesce(iteration,0)+1,completed_at=null,updated_at=now() where id=v_workflow;
  return jsonb_build_object('ok',true,'mode','AUTO','reopen_from',v_key,'reopened',v_count);
end $$;
revoke all on function public.sawol_reject_autonomous_task(uuid,text) from public;
grant execute on function public.sawol_reject_autonomous_task(uuid,text) to authenticated;

notify pgrst,'reload schema';
commit;

-- 확인 1: tasks 실행모드 컬럼
select column_name,column_default,is_nullable
from information_schema.columns
where table_schema='public' and table_name='tasks' and column_name='execution_mode';

-- 확인 2: 필요한 RPC
select p.proname as function_name,pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('sawol_set_task_execution_mode','sawol_reject_autonomous_task')
order by p.proname;
