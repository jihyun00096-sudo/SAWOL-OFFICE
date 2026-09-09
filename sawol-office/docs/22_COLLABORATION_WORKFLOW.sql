-- ============================================================
-- SAWOL OFFICE STEP 22
-- MULTI EMPLOYEE COLLABORATION / DEPENDENCY / HANDOFF
-- Prerequisite: STEP 18 ~ STEP 21 applied
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 0. Admin helper (reuse STEP21 if present)
-- ------------------------------------------------------------
create or replace function public.sawol_step22_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.app_admins a
    where a.user_id = auth.uid()
      and a.is_active = true
  );
$$;

revoke all on function public.sawol_step22_is_admin() from public;
grant execute on function public.sawol_step22_is_admin() to authenticated;

-- ------------------------------------------------------------
-- 1. Workflow table
-- ------------------------------------------------------------
create table if not exists public.task_workflows (
  id uuid primary key default gen_random_uuid(),
  workflow_code text not null unique,
  root_task_id uuid not null unique references public.tasks(id) on delete cascade,
  status text not null default 'DRAFT'
    check (status in ('DRAFT','ACTIVE','PAUSED','REVIEW','COMPLETED','FAILED','CANCELLED')),
  plan_version integer not null default 1 check (plan_version >= 1),
  strategy text not null default 'SEQUENTIAL_DAG',
  total_steps integer not null default 0 check (total_steps >= 0),
  completed_steps integer not null default 0 check (completed_steps >= 0),
  metadata jsonb not null default '{}'::jsonb,
  activated_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_task_workflows_status
  on public.task_workflows(status);

-- ------------------------------------------------------------
-- 2. Extend tasks for workflow membership
-- ------------------------------------------------------------
alter table public.tasks
  add column if not exists workflow_id uuid null,
  add column if not exists workflow_step_no integer null,
  add column if not exists workflow_step_key text null,
  add column if not exists is_workflow_root boolean not null default false;

-- Safe FK creation
DO $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tasks_workflow_fk'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_workflow_fk
      foreign key (workflow_id)
      references public.task_workflows(id)
      on delete set null;
  end if;
end $$;

create index if not exists idx_tasks_workflow
  on public.tasks(workflow_id);

create unique index if not exists uq_tasks_workflow_step_key
  on public.tasks(workflow_id, workflow_step_key)
  where workflow_id is not null and workflow_step_key is not null;

-- ------------------------------------------------------------
-- 3. Dependencies
-- ------------------------------------------------------------
create table if not exists public.task_dependencies (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.task_workflows(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  depends_on_task_id uuid not null references public.tasks(id) on delete cascade,
  dependency_type text not null default 'HARD'
    check (dependency_type in ('HARD','SOFT')),
  created_at timestamptz not null default now(),
  constraint task_dependencies_no_self check (task_id <> depends_on_task_id),
  constraint task_dependencies_unique unique (task_id, depends_on_task_id)
);

create index if not exists idx_task_dependencies_task
  on public.task_dependencies(task_id);
create index if not exists idx_task_dependencies_depends
  on public.task_dependencies(depends_on_task_id);
create index if not exists idx_task_dependencies_workflow
  on public.task_dependencies(workflow_id);

-- ------------------------------------------------------------
-- 4. Handoffs
-- ------------------------------------------------------------
create table if not exists public.task_handoffs (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.task_workflows(id) on delete cascade,
  from_task_id uuid not null references public.tasks(id) on delete cascade,
  to_task_id uuid not null references public.tasks(id) on delete cascade,
  source_run_id uuid null references public.task_runs(id) on delete set null,
  source_result_id uuid null references public.results(id) on delete set null,
  title text not null,
  summary text null,
  content text null,
  status text not null default 'AVAILABLE'
    check (status in ('AVAILABLE','SUPERSEDED','ARCHIVED')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_task_handoffs_to_task
  on public.task_handoffs(to_task_id);
create index if not exists idx_task_handoffs_from_task
  on public.task_handoffs(from_task_id);
create index if not exists idx_task_handoffs_workflow
  on public.task_handoffs(workflow_id);

create unique index if not exists uq_task_handoff_source
  on public.task_handoffs(from_task_id, to_task_id, source_run_id)
  where source_run_id is not null;

-- ------------------------------------------------------------
-- 5. updated_at triggers
-- ------------------------------------------------------------
drop trigger if exists trg_task_workflows_updated_at on public.task_workflows;
create trigger trg_task_workflows_updated_at
before update on public.task_workflows
for each row execute function public.set_updated_at();

drop trigger if exists trg_task_handoffs_updated_at on public.task_handoffs;
create trigger trg_task_handoffs_updated_at
before update on public.task_handoffs
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 6. RLS
-- ------------------------------------------------------------
alter table public.task_workflows enable row level security;
alter table public.task_dependencies enable row level security;
alter table public.task_handoffs enable row level security;

DO $$
declare
  tbl text;
  cmd text;
begin
  foreach tbl in array array['task_workflows','task_dependencies','task_handoffs']
  loop
    foreach cmd in array array['select','insert','update','delete']
    loop
      execute format('drop policy if exists %I on public.%I', tbl || '_admin_' || cmd, tbl);
      if cmd = 'select' then
        execute format(
          'create policy %I on public.%I for select to authenticated using (public.sawol_step22_is_admin())',
          tbl || '_admin_select', tbl
        );
      elsif cmd = 'insert' then
        execute format(
          'create policy %I on public.%I for insert to authenticated with check (public.sawol_step22_is_admin())',
          tbl || '_admin_insert', tbl
        );
      elsif cmd = 'update' then
        execute format(
          'create policy %I on public.%I for update to authenticated using (public.sawol_step22_is_admin()) with check (public.sawol_step22_is_admin())',
          tbl || '_admin_update', tbl
        );
      else
        execute format(
          'create policy %I on public.%I for delete to authenticated using (public.sawol_step22_is_admin())',
          tbl || '_admin_delete', tbl
        );
      end if;
    end loop;
  end loop;
end $$;

-- ------------------------------------------------------------
-- 7. Prevent duplicate active execution sessions
-- ------------------------------------------------------------
create unique index if not exists uq_task_runs_one_active_per_task
  on public.task_runs(task_id)
  where status in ('READY','RUNNING','SUBMITTED');

-- ------------------------------------------------------------
-- 8. Dependency check helper
-- ------------------------------------------------------------
create or replace function public.sawol_unmet_dependencies(p_task_id uuid)
returns table(task_id uuid, task_code text, title text, status text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select d.depends_on_task_id, t.task_code, t.title, t.status
  from public.task_dependencies d
  join public.tasks t on t.id = d.depends_on_task_id
  where d.task_id = p_task_id
    and d.dependency_type = 'HARD'
    and t.status <> 'COMPLETED'
  order by t.workflow_step_no nulls last, t.created_at;
$$;

revoke all on function public.sawol_unmet_dependencies(uuid) from public;
grant execute on function public.sawol_unmet_dependencies(uuid) to authenticated;

-- ------------------------------------------------------------
-- 9. Safe workflow creation RPC
-- p_steps format:
-- [
--   {
--     "key":"research",
--     "title":"...",
--     "description":"...",
--     "task_type":"RESEARCH",
--     "employee_id":"uuid|null",
--     "department_id":"uuid|null",
--     "match_score":80,
--     "assignment_reason":"...",
--     "depends_on":["brief"]
--   }
-- ]
-- ------------------------------------------------------------
create or replace function public.sawol_create_workflow(
  p_root_task_id uuid,
  p_steps jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_root public.tasks%rowtype;
  v_workflow_id uuid;
  v_workflow_code text;
  v_count integer;
  v_i integer;
  v_step jsonb;
  v_key text;
  v_dep_key text;
  v_task_id uuid;
  v_dep_task_id uuid;
  v_employee_id uuid;
  v_department_id uuid;
  v_match_score integer;
  v_assignment_reason text;
  v_task_type text;
  v_priority text;
  v_key_map jsonb := '{}'::jsonb;
begin
  if not public.sawol_step22_is_admin() then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select * into v_root
  from public.tasks
  where id = p_root_task_id
  for update;

  if not found then raise exception 'ROOT_TASK_NOT_FOUND'; end if;
  if v_root.parent_task_id is not null then raise exception 'CHILD_TASK_CANNOT_BECOME_ROOT'; end if;
  if v_root.status in ('COMPLETED','CANCELLED','CANCELED') then raise exception 'ROOT_TASK_IS_CLOSED'; end if;
  if v_root.workflow_id is not null then raise exception 'WORKFLOW_ALREADY_EXISTS'; end if;
  if exists (select 1 from public.task_runs where task_id = p_root_task_id) then
    raise exception 'ROOT_HAS_EXECUTION_HISTORY';
  end if;
  if exists (select 1 from public.results where task_id = p_root_task_id) then
    raise exception 'ROOT_HAS_RESULT_HISTORY';
  end if;
  if jsonb_typeof(p_steps) <> 'array' then raise exception 'INVALID_STEPS'; end if;

  v_count := jsonb_array_length(p_steps);
  if v_count < 2 or v_count > 8 then raise exception 'STEP_COUNT_MUST_BE_2_TO_8'; end if;

  -- Validate unique keys and only backward dependencies. This guarantees DAG/no cycles.
  for v_i in 0..v_count-1 loop
    v_step := p_steps -> v_i;
    v_key := nullif(trim(v_step ->> 'key'), '');
    if v_key is null then raise exception 'STEP_KEY_REQUIRED'; end if;
    if v_key_map ? v_key then raise exception 'DUPLICATE_STEP_KEY:%', v_key; end if;
    v_key_map := v_key_map || jsonb_build_object(v_key, v_i + 1);

    if jsonb_typeof(coalesce(v_step -> 'depends_on', '[]'::jsonb)) <> 'array' then
      raise exception 'INVALID_DEPENDENCY_LIST:%', v_key;
    end if;

    for v_dep_key in select jsonb_array_elements_text(coalesce(v_step -> 'depends_on', '[]'::jsonb))
    loop
      if not (v_key_map ? v_dep_key) then
        raise exception 'DEPENDENCY_MUST_REFERENCE_EARLIER_STEP:%->%', v_key, v_dep_key;
      end if;
      if (v_key_map ->> v_dep_key)::integer >= v_i + 1 then
        raise exception 'INVALID_DEPENDENCY_ORDER:%->%', v_key, v_dep_key;
      end if;
    end loop;
  end loop;

  v_workflow_code := 'WF-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(md5(gen_random_uuid()::text),1,6));

  insert into public.task_workflows(
    workflow_code, root_task_id, status, plan_version, strategy,
    total_steps, completed_steps, activated_at, metadata
  ) values (
    v_workflow_code, p_root_task_id, 'ACTIVE', 1, 'SEQUENTIAL_DAG',
    v_count, 0, now(), jsonb_build_object('created_by','STEP22_LOCAL_PLANNER')
  ) returning id into v_workflow_id;

  update public.tasks
  set workflow_id = v_workflow_id,
      is_workflow_root = true,
      status = 'IN_PROGRESS',
      updated_at = now()
  where id = p_root_task_id;

  v_key_map := '{}'::jsonb;

  -- Create child tasks
  for v_i in 0..v_count-1 loop
    v_step := p_steps -> v_i;
    v_key := trim(v_step ->> 'key');
    v_task_type := coalesce(nullif(v_step ->> 'task_type',''), 'OTHER');
    v_priority := coalesce(nullif(v_step ->> 'priority',''), v_root.priority, 'NORMAL');
    v_employee_id := nullif(v_step ->> 'employee_id','')::uuid;
    v_department_id := nullif(v_step ->> 'department_id','')::uuid;
    v_match_score := nullif(v_step ->> 'match_score','')::integer;
    v_assignment_reason := nullif(v_step ->> 'assignment_reason','');

    if v_task_type not in ('RESEARCH','PLANNING','PRODUCTION','EDIT','ANALYSIS','OPERATION','STUDY','DEVELOPMENT','DESIGN','OTHER') then
      raise exception 'INVALID_TASK_TYPE:%', v_task_type;
    end if;

    insert into public.tasks(
      task_code, project_id, parent_task_id, workflow_id, workflow_step_no,
      workflow_step_key, is_workflow_root, title, description, task_type,
      status, priority, assigned_department_id, assigned_employee_id,
      review_level, requires_ceo_approval, input_data, output_requirements
    ) values (
      'TASK-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(md5(gen_random_uuid()::text),1,5)),
      v_root.project_id,
      p_root_task_id,
      v_workflow_id,
      v_i + 1,
      v_key,
      false,
      coalesce(nullif(v_step ->> 'title',''), v_root.title || ' · ' || (v_i + 1)::text || '단계'),
      coalesce(nullif(v_step ->> 'description',''), 'STEP22 협업 하위 업무'),
      v_task_type,
      'WAITING',
      v_priority,
      v_department_id,
      null,
      0,
      false,
      jsonb_build_object(
        'source','STEP22_WORKFLOW',
        'root_task_id',p_root_task_id,
        'workflow_step_key',v_key,
        'root_request',jsonb_build_object('title',v_root.title,'description',v_root.description)
      ),
      jsonb_build_object('workflow_step', v_i + 1)
    ) returning id into v_task_id;

    v_key_map := v_key_map || jsonb_build_object(v_key, v_task_id::text);

    if v_employee_id is not null then
      perform public.sawol_assign_task(
        v_task_id,
        v_employee_id,
        'RECOMMENDATION',
        coalesce(v_assignment_reason,'STEP22 협업 계획 자동 추천'),
        v_match_score,
        jsonb_build_object('step',22,'workflow_id',v_workflow_id,'workflow_step_key',v_key)
      );
    end if;
  end loop;

  -- Create dependencies after all children exist
  for v_i in 0..v_count-1 loop
    v_step := p_steps -> v_i;
    v_key := trim(v_step ->> 'key');
    v_task_id := (v_key_map ->> v_key)::uuid;

    for v_dep_key in select jsonb_array_elements_text(coalesce(v_step -> 'depends_on', '[]'::jsonb))
    loop
      v_dep_task_id := (v_key_map ->> v_dep_key)::uuid;
      insert into public.task_dependencies(workflow_id, task_id, depends_on_task_id, dependency_type)
      values (v_workflow_id, v_task_id, v_dep_task_id, 'HARD')
      on conflict (task_id, depends_on_task_id) do nothing;
    end loop;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'workflow_id', v_workflow_id,
    'workflow_code', v_workflow_code,
    'total_steps', v_count
  );
end;
$$;

revoke all on function public.sawol_create_workflow(uuid,jsonb) from public;
grant execute on function public.sawol_create_workflow(uuid,jsonb) to authenticated;

-- ------------------------------------------------------------
-- 10. Safe run start RPC with dependency + duplicate protection
-- ------------------------------------------------------------
create or replace function public.sawol_start_task_run(
  p_task_id uuid,
  p_run_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task public.tasks%rowtype;
  v_run_id uuid;
  v_unmet integer;
begin
  if not public.sawol_step22_is_admin() then raise exception 'NOT_AUTHORIZED'; end if;

  select * into v_task
  from public.tasks
  where id = p_task_id
  for update;

  if not found then raise exception 'TASK_NOT_FOUND'; end if;
  if v_task.status in ('COMPLETED','CANCELLED','CANCELED') then raise exception 'TASK_IS_CLOSED'; end if;
  if v_task.is_workflow_root then raise exception 'WORKFLOW_ROOT_IS_ORCHESTRATOR'; end if;
  if v_task.assigned_employee_id is null then raise exception 'EMPLOYEE_REQUIRED'; end if;

  select count(*) into v_unmet
  from public.sawol_unmet_dependencies(p_task_id);

  if v_unmet > 0 then raise exception 'DEPENDENCIES_NOT_COMPLETED'; end if;

  if exists (
    select 1 from public.task_runs
    where task_id = p_task_id
      and status in ('READY','RUNNING','SUBMITTED')
  ) then
    raise exception 'ACTIVE_RUN_ALREADY_EXISTS';
  end if;

  insert into public.task_runs(
    run_code, task_id, employee_id, status, started_at, metadata
  ) values (
    p_run_code, p_task_id, v_task.assigned_employee_id, 'RUNNING', now(),
    jsonb_build_object('source','STEP22_SAFE_START','step',22,'workflow_id',v_task.workflow_id)
  ) returning id into v_run_id;

  update public.tasks
  set status = 'IN_PROGRESS', started_at = coalesce(started_at, now()), updated_at = now()
  where id = p_task_id;

  return jsonb_build_object('ok',true,'run_id',v_run_id);
end;
$$;

revoke all on function public.sawol_start_task_run(uuid,text) from public;
grant execute on function public.sawol_start_task_run(uuid,text) to authenticated;

-- ------------------------------------------------------------
-- 11. Guard dependency bypass on workflow children
-- ------------------------------------------------------------
create or replace function public.sawol_guard_workflow_dependency()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_unmet integer;
begin
  if new.workflow_id is null or new.is_workflow_root then return new; end if;

  if new.status in ('IN_PROGRESS','REVIEW','PENDING_APPROVAL','COMPLETED')
     and old.status = 'WAITING' then
    select count(*) into v_unmet from public.sawol_unmet_dependencies(new.id);
    if v_unmet > 0 then raise exception 'DEPENDENCIES_NOT_COMPLETED'; end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_tasks_workflow_dependency_guard on public.tasks;
create trigger trg_tasks_workflow_dependency_guard
before update of status on public.tasks
for each row execute function public.sawol_guard_workflow_dependency();

-- ------------------------------------------------------------
-- 12. Create handoffs and finalize root when child completes
-- ------------------------------------------------------------
create or replace function public.sawol_refresh_workflow(p_workflow_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_workflow public.task_workflows%rowtype;
  v_root public.tasks%rowtype;
  v_total integer;
  v_completed integer;
  v_error integer;
  v_final_task public.tasks%rowtype;
  v_final_run public.task_runs%rowtype;
  v_root_run_id uuid;
  v_root_run_code text;
begin
  if p_workflow_id is null then return; end if;

  select * into v_workflow from public.task_workflows where id = p_workflow_id for update;
  if not found then return; end if;

  select * into v_root from public.tasks where id = v_workflow.root_task_id for update;
  if not found then return; end if;

  select count(*), count(*) filter (where status='COMPLETED'), count(*) filter (where status='ERROR')
  into v_total, v_completed, v_error
  from public.tasks
  where workflow_id = p_workflow_id and is_workflow_root = false;

  update public.task_workflows
  set total_steps = v_total,
      completed_steps = v_completed,
      status = case
        when v_total > 0 and v_completed = v_total then 'REVIEW'
        when status in ('COMPLETED','CANCELLED') then status
        else 'ACTIVE'
      end,
      metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object('error_steps',v_error)
  where id = p_workflow_id;

  if v_total = 0 or v_completed <> v_total then return; end if;

  select * into v_final_task
  from public.tasks t
  where t.workflow_id = p_workflow_id
    and t.is_workflow_root = false
    and not exists (
      select 1 from public.task_dependencies d
      where d.depends_on_task_id = t.id
    )
  order by t.workflow_step_no desc
  limit 1;

  if not found then
    select * into v_final_task
    from public.tasks
    where workflow_id = p_workflow_id and is_workflow_root = false
    order by workflow_step_no desc
    limit 1;
  end if;

  select * into v_final_run
  from public.task_runs
  where task_id = v_final_task.id
    and result_body is not null
    and status in ('SUBMITTED','COMPLETED')
  order by coalesce(submitted_at,completed_at,created_at) desc
  limit 1;

  if found then
    select id into v_root_run_id
    from public.task_runs
    where task_id = v_root.id
      and (metadata ->> 'workflow_final') = 'true'
    order by created_at desc
    limit 1;

    if v_root_run_id is null then
      v_root_run_code := 'RUN-WF-' || upper(substr(md5(gen_random_uuid()::text),1,8));
      insert into public.task_runs(
        run_code, task_id, employee_id, status, started_at, submitted_at,
        result_title, result_summary, result_body, metadata
      ) values (
        v_root_run_code,
        v_root.id,
        coalesce(v_final_run.employee_id, v_root.assigned_employee_id),
        'SUBMITTED',
        coalesce(v_final_run.started_at, now()),
        now(),
        coalesce(v_final_run.result_title, v_root.title || ' 최종 결과'),
        v_final_run.result_summary,
        v_final_run.result_body,
        jsonb_build_object(
          'workflow_final', true,
          'workflow_id', p_workflow_id,
          'source_task_id', v_final_task.id,
          'source_run_id', v_final_run.id,
          'step', 22
        )
      ) returning id into v_root_run_id;
    end if;
  end if;

  if v_root.requires_ceo_approval then
    update public.tasks
    set status='PENDING_APPROVAL', updated_at=now()
    where id=v_root.id and status <> 'COMPLETED';
  else
    update public.tasks
    set status='COMPLETED', completed_at=coalesce(completed_at,now()), updated_at=now()
    where id=v_root.id;
    begin
      perform public.sawol_sync_task_artifacts(v_root.id);
    exception when undefined_function then
      null;
    end;
  end if;
end;
$$;

create or replace function public.sawol_workflow_task_change_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run public.task_runs%rowtype;
  v_dep record;
begin
  if new.workflow_id is null then return new; end if;

  -- Child completion => create handoff snapshot for direct successors.
  if not new.is_workflow_root
     and new.status = 'COMPLETED'
     and old.status is distinct from new.status then

    select * into v_run
    from public.task_runs
    where task_id = new.id
      and result_body is not null
      and status in ('SUBMITTED','COMPLETED')
    order by coalesce(submitted_at,completed_at,created_at) desc
    limit 1;

    if found then
      for v_dep in
        select d.task_id as to_task_id
        from public.task_dependencies d
        where d.depends_on_task_id = new.id
      loop
        insert into public.task_handoffs(
          workflow_id, from_task_id, to_task_id, source_run_id,
          title, summary, content, status, metadata
        ) values (
          new.workflow_id, new.id, v_dep.to_task_id, v_run.id,
          coalesce(v_run.result_title,new.title),
          v_run.result_summary,
          v_run.result_body,
          'AVAILABLE',
          jsonb_build_object('created_by','STEP22_COMPLETION_TRIGGER')
        ) on conflict do nothing;
      end loop;
    end if;
  end if;

  -- Root completion after representative approval => workflow complete.
  if new.is_workflow_root and new.status='COMPLETED' then
    update public.task_workflows
    set status='COMPLETED', completed_at=coalesce(completed_at,now())
    where id=new.workflow_id and status <> 'COMPLETED';
  else
    perform public.sawol_refresh_workflow(new.workflow_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_tasks_workflow_change on public.tasks;
create trigger trg_tasks_workflow_change
after update of status on public.tasks
for each row
when (old.status is distinct from new.status)
execute function public.sawol_workflow_task_change_trigger();

commit;

-- ============================================================
-- VERIFICATION (safe SELECT only)
-- ============================================================
select table_name
from information_schema.tables
where table_schema='public'
  and table_name in ('task_workflows','task_dependencies','task_handoffs')
order by table_name;

select column_name, data_type
from information_schema.columns
where table_schema='public'
  and table_name='tasks'
  and column_name in ('workflow_id','workflow_step_no','workflow_step_key','is_workflow_root')
order by column_name;

select indexname
from pg_indexes
where schemaname='public'
  and indexname in ('uq_task_runs_one_active_per_task','uq_tasks_workflow_step_key')
order by indexname;

select tablename, policyname, cmd
from pg_policies
where schemaname='public'
  and tablename in ('task_workflows','task_dependencies','task_handoffs')
order by tablename, policyname;
