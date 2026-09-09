-- ============================================================
-- SAWOL OFFICE STEP 21
-- EMPLOYEE ROUTING / ASSIGNMENT HISTORY / STATUS SYNC
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Assignment history
-- ------------------------------------------------------------

create table if not exists public.task_assignments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  department_id uuid null references public.departments(id) on delete set null,
  assignment_source text not null default 'MANUAL'
    check (assignment_source in (
      'SECRETARY',
      'RECOMMENDATION',
      'MANUAL',
      'BACKFILL'
    )),
  assignment_reason text null,
  match_score integer null check (match_score is null or match_score between 0 and 100),
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE','RELEASED')),
  assigned_at timestamptz not null default now(),
  released_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_task_assignments_task
  on public.task_assignments(task_id);

create index if not exists idx_task_assignments_employee
  on public.task_assignments(employee_id);

create index if not exists idx_task_assignments_status
  on public.task_assignments(status);

create unique index if not exists uq_task_assignments_active_task
  on public.task_assignments(task_id)
  where status = 'ACTIVE';

drop trigger if exists trg_task_assignments_updated_at
on public.task_assignments;

create trigger trg_task_assignments_updated_at
before update on public.task_assignments
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 2. RLS
-- ------------------------------------------------------------

alter table public.task_assignments enable row level security;

drop policy if exists "task_assignments_admin_select" on public.task_assignments;
drop policy if exists "task_assignments_admin_insert" on public.task_assignments;
drop policy if exists "task_assignments_admin_update" on public.task_assignments;
drop policy if exists "task_assignments_admin_delete" on public.task_assignments;

create policy "task_assignments_admin_select"
on public.task_assignments
for select
to authenticated
using (
  exists (
    select 1
    from public.app_admins a
    where a.user_id = auth.uid()
      and a.is_active = true
  )
);

create policy "task_assignments_admin_insert"
on public.task_assignments
for insert
to authenticated
with check (
  exists (
    select 1
    from public.app_admins a
    where a.user_id = auth.uid()
      and a.is_active = true
  )
);

create policy "task_assignments_admin_update"
on public.task_assignments
for update
to authenticated
using (
  exists (
    select 1
    from public.app_admins a
    where a.user_id = auth.uid()
      and a.is_active = true
  )
)
with check (
  exists (
    select 1
    from public.app_admins a
    where a.user_id = auth.uid()
      and a.is_active = true
  )
);

create policy "task_assignments_admin_delete"
on public.task_assignments
for delete
to authenticated
using (
  exists (
    select 1
    from public.app_admins a
    where a.user_id = auth.uid()
      and a.is_active = true
  )
);

-- ------------------------------------------------------------
-- 3. Admin guard helper
-- ------------------------------------------------------------

create or replace function public.sawol_step21_is_admin()
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

revoke all on function public.sawol_step21_is_admin() from public;
grant execute on function public.sawol_step21_is_admin() to authenticated;

-- ------------------------------------------------------------
-- 4. Employee state recalculation
-- ------------------------------------------------------------

create or replace function public.sawol_refresh_employee_state(p_employee_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_employee public.employees%rowtype;
  v_task public.tasks%rowtype;
  v_status text;
begin
  if p_employee_id is null then
    return;
  end if;

  select *
  into v_employee
  from public.employees
  where id = p_employee_id;

  if not found then
    return;
  end if;

  if not v_employee.is_active or v_employee.status = 'OFFLINE' then
    update public.employees
    set current_task_id = null
    where id = p_employee_id;
    return;
  end if;

  select *
  into v_task
  from public.tasks
  where assigned_employee_id = p_employee_id
    and status not in ('COMPLETED','CANCELLED','CANCELED')
  order by
    case status
      when 'ERROR' then 1
      when 'IN_PROGRESS' then 2
      when 'COLLABORATING' then 2
      when 'REVIEW' then 3
      when 'IN_REVIEW' then 3
      when 'PENDING_APPROVAL' then 4
      when 'APPROVAL_WAIT' then 4
      when 'WAITING' then 5
      when 'WAITING_FOR_DATA' then 6
      when 'ON_HOLD' then 7
      else 8
    end,
    case priority
      when 'URGENT' then 1
      when 'HIGH' then 2
      when 'NORMAL' then 3
      else 4
    end,
    updated_at desc
  limit 1;

  if not found then
    update public.employees
    set
      current_task_id = null,
      status = 'AVAILABLE'
    where id = p_employee_id;
    return;
  end if;

  v_status := case
    when v_task.status = 'ERROR' then 'BLOCKED'
    when v_task.status in ('IN_PROGRESS','COLLABORATING') then 'WORKING'
    when v_task.status in ('REVIEW','IN_REVIEW') then 'REVIEWING'
    when v_task.status in ('PENDING_APPROVAL','APPROVAL_WAIT') then 'APPROVAL_WAIT'
    when v_task.status in ('WAITING','WAITING_FOR_DATA','ON_HOLD') then 'WAITING'
    else 'AVAILABLE'
  end;

  update public.employees
  set
    current_task_id = v_task.id,
    status = v_status
  where id = p_employee_id;
end;
$$;

revoke all on function public.sawol_refresh_employee_state(uuid) from public;
grant execute on function public.sawol_refresh_employee_state(uuid) to authenticated;

-- ------------------------------------------------------------
-- 5. Safe assignment RPC
-- ------------------------------------------------------------

create or replace function public.sawol_assign_task(
  p_task_id uuid,
  p_employee_id uuid,
  p_assignment_source text default 'MANUAL',
  p_assignment_reason text default null,
  p_match_score integer default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task public.tasks%rowtype;
  v_employee public.employees%rowtype;
  v_old_employee_id uuid;
begin
  if not public.sawol_step21_is_admin() then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if p_assignment_source not in ('SECRETARY','RECOMMENDATION','MANUAL','BACKFILL') then
    raise exception 'INVALID_ASSIGNMENT_SOURCE';
  end if;

  if p_match_score is not null and (p_match_score < 0 or p_match_score > 100) then
    raise exception 'INVALID_MATCH_SCORE';
  end if;

  select *
  into v_task
  from public.tasks
  where id = p_task_id
  for update;

  if not found then
    raise exception 'TASK_NOT_FOUND';
  end if;

  if v_task.status in ('COMPLETED','CANCELLED','CANCELED') then
    raise exception 'TASK_IS_CLOSED';
  end if;

  select *
  into v_employee
  from public.employees
  where id = p_employee_id;

  if not found then
    raise exception 'EMPLOYEE_NOT_FOUND';
  end if;

  if not v_employee.is_active or v_employee.status = 'OFFLINE' then
    raise exception 'EMPLOYEE_NOT_AVAILABLE';
  end if;

  v_old_employee_id := v_task.assigned_employee_id;

  update public.task_assignments
  set
    status = 'RELEASED',
    released_at = coalesce(released_at, now())
  where task_id = p_task_id
    and status = 'ACTIVE';

  update public.tasks
  set
    assigned_employee_id = p_employee_id,
    assigned_department_id = coalesce(assigned_department_id, v_employee.department_id),
    updated_at = now()
  where id = p_task_id;

  insert into public.task_assignments (
    task_id,
    employee_id,
    department_id,
    assignment_source,
    assignment_reason,
    match_score,
    status,
    metadata
  )
  values (
    p_task_id,
    p_employee_id,
    v_employee.department_id,
    p_assignment_source,
    p_assignment_reason,
    p_match_score,
    'ACTIVE',
    coalesce(p_metadata, '{}'::jsonb)
  );

  if v_old_employee_id is not null
     and v_old_employee_id is distinct from p_employee_id then
    perform public.sawol_refresh_employee_state(v_old_employee_id);
  end if;

  perform public.sawol_refresh_employee_state(p_employee_id);

  return jsonb_build_object(
    'ok', true,
    'task_id', p_task_id,
    'employee_id', p_employee_id,
    'previous_employee_id', v_old_employee_id
  );
end;
$$;

revoke all on function public.sawol_assign_task(
  uuid, uuid, text, text, integer, jsonb
) from public;

grant execute on function public.sawol_assign_task(
  uuid, uuid, text, text, integer, jsonb
) to authenticated;

-- ------------------------------------------------------------
-- 6. Safe unassign RPC
-- ------------------------------------------------------------

create or replace function public.sawol_unassign_task(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task public.tasks%rowtype;
  v_old_employee_id uuid;
begin
  if not public.sawol_step21_is_admin() then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select *
  into v_task
  from public.tasks
  where id = p_task_id
  for update;

  if not found then
    raise exception 'TASK_NOT_FOUND';
  end if;

  v_old_employee_id := v_task.assigned_employee_id;

  update public.task_assignments
  set
    status = 'RELEASED',
    released_at = coalesce(released_at, now())
  where task_id = p_task_id
    and status = 'ACTIVE';

  update public.tasks
  set
    assigned_employee_id = null,
    updated_at = now()
  where id = p_task_id;

  if v_old_employee_id is not null then
    perform public.sawol_refresh_employee_state(v_old_employee_id);
  end if;

  return jsonb_build_object(
    'ok', true,
    'task_id', p_task_id,
    'previous_employee_id', v_old_employee_id
  );
end;
$$;

revoke all on function public.sawol_unassign_task(uuid) from public;
grant execute on function public.sawol_unassign_task(uuid) to authenticated;

-- ------------------------------------------------------------
-- 7. Task status / employee change trigger
-- Any path that changes Task status still refreshes employee state.
-- ------------------------------------------------------------

create or replace function public.sawol_task_employee_state_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    if old.assigned_employee_id is not null then
      perform public.sawol_refresh_employee_state(old.assigned_employee_id);
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE'
     and old.assigned_employee_id is distinct from new.assigned_employee_id
     and old.assigned_employee_id is not null then
    perform public.sawol_refresh_employee_state(old.assigned_employee_id);
  end if;

  if new.assigned_employee_id is not null then
    perform public.sawol_refresh_employee_state(new.assigned_employee_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_tasks_employee_state_sync on public.tasks;

create trigger trg_tasks_employee_state_sync
after insert or update or delete
on public.tasks
for each row execute function public.sawol_task_employee_state_trigger();

-- ------------------------------------------------------------
-- 8. Backfill current assignments
-- ------------------------------------------------------------

insert into public.task_assignments (
  task_id,
  employee_id,
  department_id,
  assignment_source,
  assignment_reason,
  match_score,
  status,
  metadata
)
select
  t.id,
  t.assigned_employee_id,
  e.department_id,
  'BACKFILL',
  'STEP21 적용 전 기존 담당 직원',
  null,
  'ACTIVE',
  jsonb_build_object('step', 21, 'backfill', true)
from public.tasks t
join public.employees e on e.id = t.assigned_employee_id
where t.assigned_employee_id is not null
  and t.status not in ('COMPLETED','CANCELLED','CANCELED')
  and not exists (
    select 1
    from public.task_assignments a
    where a.task_id = t.id
      and a.status = 'ACTIVE'
  )
on conflict do nothing;

-- Refresh every active employee once
DO $$
declare
  r record;
begin
  for r in
    select id
    from public.employees
    where is_active = true
  loop
    perform public.sawol_refresh_employee_state(r.id);
  end loop;
end $$;

commit;

-- ============================================================
-- Verification
-- ============================================================

select
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name = 'task_assignments';

select
  policyname,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'task_assignments'
order by policyname;

select
  e.employee_code,
  e.name,
  e.status,
  t.task_code as current_task
from public.employees e
left join public.tasks t on t.id = e.current_task_id
where e.is_active = true
order by e.employee_code
limit 20;

select
  a.status,
  count(*) as assignment_count
from public.task_assignments a
group by a.status
order by a.status;
