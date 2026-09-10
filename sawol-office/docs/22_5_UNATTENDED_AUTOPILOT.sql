-- ============================================================
-- SAWOL OFFICE STEP 22.5
-- Unattended AUTO runner + live execution state
-- 기존 STEP22 AUTO/MANUAL/협업 구조는 유지하고,
-- AUTO 작업의 실행 상태만 별도 durable job으로 기록합니다.
-- ============================================================

begin;

create table if not exists public.task_autopilot_jobs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null unique references public.tasks(id) on delete cascade,
  status text not null default 'QUEUED'
    check (status in ('QUEUED','RUNNING','AWAITING_APPROVAL','COMPLETED','FAILED','PAUSED')),
  progress integer not null default 0 check (progress between 0 and 100),
  current_step_title text null,
  last_message text null,
  last_error text null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  started_at timestamptz null,
  heartbeat_at timestamptz null,
  finished_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_task_autopilot_jobs_status
  on public.task_autopilot_jobs(status);

create index if not exists idx_task_autopilot_jobs_heartbeat
  on public.task_autopilot_jobs(heartbeat_at desc);

-- 기존 공통 updated_at 함수 재사용
DO $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'set_updated_at'
  ) then
    drop trigger if exists trg_task_autopilot_jobs_updated_at on public.task_autopilot_jobs;
    create trigger trg_task_autopilot_jobs_updated_at
    before update on public.task_autopilot_jobs
    for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.task_autopilot_jobs enable row level security;

drop policy if exists task_autopilot_jobs_admin_select on public.task_autopilot_jobs;
create policy task_autopilot_jobs_admin_select
on public.task_autopilot_jobs
for select
to authenticated
using (public.sawol_step22_is_admin());

drop policy if exists task_autopilot_jobs_admin_insert on public.task_autopilot_jobs;
create policy task_autopilot_jobs_admin_insert
on public.task_autopilot_jobs
for insert
to authenticated
with check (public.sawol_step22_is_admin());

drop policy if exists task_autopilot_jobs_admin_update on public.task_autopilot_jobs;
create policy task_autopilot_jobs_admin_update
on public.task_autopilot_jobs
for update
to authenticated
using (public.sawol_step22_is_admin())
with check (public.sawol_step22_is_admin());

drop policy if exists task_autopilot_jobs_admin_delete on public.task_autopilot_jobs;
create policy task_autopilot_jobs_admin_delete
on public.task_autopilot_jobs
for delete
to authenticated
using (public.sawol_step22_is_admin());

notify pgrst, 'reload schema';

commit;

-- ============================================================
-- 적용 확인
-- 1행이 나오면 정상입니다.
-- ============================================================
select
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name = 'task_autopilot_jobs';

-- 정책 4개 확인
select
  policyname,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'task_autopilot_jobs'
order by policyname;
