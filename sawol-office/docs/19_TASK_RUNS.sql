-- ============================================================
-- SAWOL OFFICE STEP 19
-- EXECUTION SESSION / TASK RUNS
-- ============================================================

begin;

create table if not exists public.task_runs (
  id uuid primary key default gen_random_uuid(),
  run_code text not null unique,
  task_id uuid not null references public.tasks(id) on delete cascade,
  employee_id uuid null references public.employees(id) on delete set null,
  status text not null default 'READY',
  started_at timestamptz null,
  submitted_at timestamptz null,
  completed_at timestamptz null,
  result_title text null,
  result_summary text null,
  result_body text null,
  error_message text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_task_runs_task_id
  on public.task_runs(task_id);

create index if not exists idx_task_runs_employee_id
  on public.task_runs(employee_id);

create index if not exists idx_task_runs_status
  on public.task_runs(status);

do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'task_runs'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%status%'
  loop
    execute format(
      'alter table public.task_runs drop constraint if exists %I',
      r.conname
    );
  end loop;

  alter table public.task_runs
    add constraint task_runs_status_check
    check (
      status in (
        'READY',
        'RUNNING',
        'SUBMITTED',
        'COMPLETED',
        'FAILED',
        'CANCELLED'
      )
    );
end $$;

alter table public.task_runs enable row level security;

drop policy if exists "task_runs_admin_select" on public.task_runs;
drop policy if exists "task_runs_admin_insert" on public.task_runs;
drop policy if exists "task_runs_admin_update" on public.task_runs;
drop policy if exists "task_runs_admin_delete" on public.task_runs;

create policy "task_runs_admin_select"
on public.task_runs
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

create policy "task_runs_admin_insert"
on public.task_runs
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

create policy "task_runs_admin_update"
on public.task_runs
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

create policy "task_runs_admin_delete"
on public.task_runs
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

commit;

-- Verification
select
  table_schema,
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name = 'task_runs';

select
  conname,
  pg_get_constraintdef(c.oid) as definition
from pg_constraint c
join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public'
  and t.relname = 'task_runs'
order by conname;
