-- ============================================================
-- SAWOL OFFICE v0.1
-- STEP 13 — CEO AUTHORIZATION & RLS
--
-- PREREQUISITES
-- 1) docs/09_SUPABASE_SQL.sql executed
-- 2) docs/12_SEED_DATA.sql executed
-- 3) CEO user created in Supabase Auth
--
-- IMPORTANT
-- Replace ONLY the UUID below before running.
-- Do NOT place a password or secret key in this file.
-- ============================================================

begin;

-- ============================================================
-- 0. Private schema for internal authorization helpers
-- ============================================================

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated;

-- ============================================================
-- 1. Admin registry
-- ============================================================

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'SAWOL OFFICE CEO',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_admins enable row level security;

-- Ensure updated_at trigger exists from STEP 9.
drop trigger if exists trg_app_admins_updated_at on public.app_admins;
create trigger trg_app_admins_updated_at
before update on public.app_admins
for each row execute function public.set_updated_at();

-- ============================================================
-- 2. Register CEO
-- Replace the zero UUID before running.
-- ============================================================

do $$
declare
  v_ceo_user_id uuid := 'd2a65749-e836-47f9-ab35-01059255ce83';
begin
  if v_ceo_user_id = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception
      'STOP: Replace 00000000-0000-0000-0000-000000000000 with the CEO Supabase Auth User UUID before running STEP 13.';
  end if;

  if not exists (
    select 1
    from auth.users
    where id = v_ceo_user_id
  ) then
    raise exception
      'STOP: The supplied CEO UUID does not exist in auth.users. Check Authentication > Users and copy the correct User UID.';
  end if;

  insert into public.app_admins (user_id, display_name, is_active)
  values (v_ceo_user_id, 'SAWOL OFFICE CEO', true)
  on conflict (user_id) do update
  set display_name = excluded.display_name,
      is_active = true,
      updated_at = now();
end
$$;

-- ============================================================
-- 3. Internal admin check function
-- Security-definer is kept out of the exposed public schema.
-- search_path is pinned to empty and relations are schema-qualified.
-- ============================================================

create or replace function private.is_sawol_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.app_admins a
      where a.user_id = (select auth.uid())
        and a.is_active = true
    );
$$;

revoke all on function private.is_sawol_admin() from public;
revoke all on function private.is_sawol_admin() from anon;
grant execute on function private.is_sawol_admin() to authenticated;

-- ============================================================
-- 4. app_admins permissions and self-read policy
-- App users cannot insert/update/delete admin rows in v0.1.
-- Admin membership changes are performed via trusted Dashboard SQL.
-- ============================================================

revoke all on table public.app_admins from anon;
revoke all on table public.app_admins from authenticated;
grant select on table public.app_admins to authenticated;

drop policy if exists "SAWOL admin can read own admin row"
on public.app_admins;

create policy "SAWOL admin can read own admin row"
on public.app_admins
for select
to authenticated
using (
  user_id = (select auth.uid())
  and is_active = true
);

-- ============================================================
-- 5. Ensure RLS on all SAWOL core tables
-- ============================================================

alter table public.departments enable row level security;
alter table public.employees enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.results enable row level security;
alter table public.reviews enable row level security;
alter table public.approvals enable row level security;
alter table public.memories enable row level security;

-- ============================================================
-- 6. Remove anon table privileges
-- ============================================================

revoke all on table public.departments from anon;
revoke all on table public.employees from anon;
revoke all on table public.projects from anon;
revoke all on table public.tasks from anon;
revoke all on table public.results from anon;
revoke all on table public.reviews from anon;
revoke all on table public.approvals from anon;
revoke all on table public.memories from anon;

-- ============================================================
-- 7. Grant authenticated SQL privileges.
-- RLS still decides whether the authenticated user may access rows.
-- ============================================================

grant select, insert, update, delete on table public.departments to authenticated;
grant select, insert, update, delete on table public.employees to authenticated;
grant select, insert, update, delete on table public.projects to authenticated;
grant select, insert, update, delete on table public.tasks to authenticated;
grant select, insert, update, delete on table public.results to authenticated;
grant select, insert, update, delete on table public.reviews to authenticated;
grant select, insert, update, delete on table public.approvals to authenticated;
grant select, insert, update, delete on table public.memories to authenticated;

-- ============================================================
-- 8. Drop only SAWOL v0.1 policies if re-running this migration.
-- ============================================================

drop policy if exists "SAWOL CEO select departments" on public.departments;
drop policy if exists "SAWOL CEO insert departments" on public.departments;
drop policy if exists "SAWOL CEO update departments" on public.departments;
drop policy if exists "SAWOL CEO delete departments" on public.departments;

drop policy if exists "SAWOL CEO select employees" on public.employees;
drop policy if exists "SAWOL CEO insert employees" on public.employees;
drop policy if exists "SAWOL CEO update employees" on public.employees;
drop policy if exists "SAWOL CEO delete employees" on public.employees;

drop policy if exists "SAWOL CEO select projects" on public.projects;
drop policy if exists "SAWOL CEO insert projects" on public.projects;
drop policy if exists "SAWOL CEO update projects" on public.projects;
drop policy if exists "SAWOL CEO delete projects" on public.projects;

drop policy if exists "SAWOL CEO select tasks" on public.tasks;
drop policy if exists "SAWOL CEO insert tasks" on public.tasks;
drop policy if exists "SAWOL CEO update tasks" on public.tasks;
drop policy if exists "SAWOL CEO delete tasks" on public.tasks;

drop policy if exists "SAWOL CEO select results" on public.results;
drop policy if exists "SAWOL CEO insert results" on public.results;
drop policy if exists "SAWOL CEO update results" on public.results;
drop policy if exists "SAWOL CEO delete results" on public.results;

drop policy if exists "SAWOL CEO select reviews" on public.reviews;
drop policy if exists "SAWOL CEO insert reviews" on public.reviews;
drop policy if exists "SAWOL CEO update reviews" on public.reviews;
drop policy if exists "SAWOL CEO delete reviews" on public.reviews;

drop policy if exists "SAWOL CEO select approvals" on public.approvals;
drop policy if exists "SAWOL CEO insert approvals" on public.approvals;
drop policy if exists "SAWOL CEO update approvals" on public.approvals;
drop policy if exists "SAWOL CEO delete approvals" on public.approvals;

drop policy if exists "SAWOL CEO select memories" on public.memories;
drop policy if exists "SAWOL CEO insert memories" on public.memories;
drop policy if exists "SAWOL CEO update memories" on public.memories;
drop policy if exists "SAWOL CEO delete memories" on public.memories;

-- ============================================================
-- 9. departments policies
-- ============================================================

create policy "SAWOL CEO select departments"
on public.departments
for select
to authenticated
using ((select private.is_sawol_admin()));

create policy "SAWOL CEO insert departments"
on public.departments
for insert
to authenticated
with check ((select private.is_sawol_admin()));

create policy "SAWOL CEO update departments"
on public.departments
for update
to authenticated
using ((select private.is_sawol_admin()))
with check ((select private.is_sawol_admin()));

create policy "SAWOL CEO delete departments"
on public.departments
for delete
to authenticated
using ((select private.is_sawol_admin()));

-- ============================================================
-- 10. employees policies
-- ============================================================

create policy "SAWOL CEO select employees"
on public.employees
for select
to authenticated
using ((select private.is_sawol_admin()));

create policy "SAWOL CEO insert employees"
on public.employees
for insert
to authenticated
with check ((select private.is_sawol_admin()));

create policy "SAWOL CEO update employees"
on public.employees
for update
to authenticated
using ((select private.is_sawol_admin()))
with check ((select private.is_sawol_admin()));

create policy "SAWOL CEO delete employees"
on public.employees
for delete
to authenticated
using ((select private.is_sawol_admin()));

-- ============================================================
-- 11. projects policies
-- ============================================================

create policy "SAWOL CEO select projects"
on public.projects
for select
to authenticated
using ((select private.is_sawol_admin()));

create policy "SAWOL CEO insert projects"
on public.projects
for insert
to authenticated
with check ((select private.is_sawol_admin()));

create policy "SAWOL CEO update projects"
on public.projects
for update
to authenticated
using ((select private.is_sawol_admin()))
with check ((select private.is_sawol_admin()));

create policy "SAWOL CEO delete projects"
on public.projects
for delete
to authenticated
using ((select private.is_sawol_admin()));

-- ============================================================
-- 12. tasks policies
-- ============================================================

create policy "SAWOL CEO select tasks"
on public.tasks
for select
to authenticated
using ((select private.is_sawol_admin()));

create policy "SAWOL CEO insert tasks"
on public.tasks
for insert
to authenticated
with check ((select private.is_sawol_admin()));

create policy "SAWOL CEO update tasks"
on public.tasks
for update
to authenticated
using ((select private.is_sawol_admin()))
with check ((select private.is_sawol_admin()));

create policy "SAWOL CEO delete tasks"
on public.tasks
for delete
to authenticated
using ((select private.is_sawol_admin()));

-- ============================================================
-- 13. results policies
-- ============================================================

create policy "SAWOL CEO select results"
on public.results
for select
to authenticated
using ((select private.is_sawol_admin()));

create policy "SAWOL CEO insert results"
on public.results
for insert
to authenticated
with check ((select private.is_sawol_admin()));

create policy "SAWOL CEO update results"
on public.results
for update
to authenticated
using ((select private.is_sawol_admin()))
with check ((select private.is_sawol_admin()));

create policy "SAWOL CEO delete results"
on public.results
for delete
to authenticated
using ((select private.is_sawol_admin()));

-- ============================================================
-- 14. reviews policies
-- ============================================================

create policy "SAWOL CEO select reviews"
on public.reviews
for select
to authenticated
using ((select private.is_sawol_admin()));

create policy "SAWOL CEO insert reviews"
on public.reviews
for insert
to authenticated
with check ((select private.is_sawol_admin()));

create policy "SAWOL CEO update reviews"
on public.reviews
for update
to authenticated
using ((select private.is_sawol_admin()))
with check ((select private.is_sawol_admin()));

create policy "SAWOL CEO delete reviews"
on public.reviews
for delete
to authenticated
using ((select private.is_sawol_admin()));

-- ============================================================
-- 15. approvals policies
-- ============================================================

create policy "SAWOL CEO select approvals"
on public.approvals
for select
to authenticated
using ((select private.is_sawol_admin()));

create policy "SAWOL CEO insert approvals"
on public.approvals
for insert
to authenticated
with check ((select private.is_sawol_admin()));

create policy "SAWOL CEO update approvals"
on public.approvals
for update
to authenticated
using ((select private.is_sawol_admin()))
with check ((select private.is_sawol_admin()));

create policy "SAWOL CEO delete approvals"
on public.approvals
for delete
to authenticated
using ((select private.is_sawol_admin()));

-- ============================================================
-- 16. memories policies
-- ============================================================

create policy "SAWOL CEO select memories"
on public.memories
for select
to authenticated
using ((select private.is_sawol_admin()));

create policy "SAWOL CEO insert memories"
on public.memories
for insert
to authenticated
with check ((select private.is_sawol_admin()));

create policy "SAWOL CEO update memories"
on public.memories
for update
to authenticated
using ((select private.is_sawol_admin()))
with check ((select private.is_sawol_admin()));

create policy "SAWOL CEO delete memories"
on public.memories
for delete
to authenticated
using ((select private.is_sawol_admin()));

-- ============================================================
-- 17. Rebuild CEO dashboard view as SECURITY INVOKER
-- so underlying table RLS is respected.
-- ============================================================

drop view if exists public.v_ceo_dashboard_summary;

create view public.v_ceo_dashboard_summary
with (security_invoker = true)
as
select
  (
    select count(*)
    from public.projects
    where status in ('PLANNING','IN_PROGRESS','REVIEW','APPROVAL_WAIT')
  ) as active_projects,
  (
    select count(*)
    from public.tasks
    where status in ('IN_PROGRESS','COLLABORATING')
  ) as active_tasks,
  (
    select count(*)
    from public.approvals
    where status = 'PENDING'
  ) as pending_approvals,
  (
    select count(*)
    from public.tasks
    where status = 'WAITING_FOR_DATA'
  ) as waiting_for_data,
  (
    select count(*)
    from public.tasks
    where status = 'ERROR'
  ) as error_tasks,
  (
    select count(*)
    from public.tasks
    where status = 'COMPLETED'
      and completed_at::date = current_date
  ) as completed_today;

revoke all on table public.v_ceo_dashboard_summary from anon;
grant select on table public.v_ceo_dashboard_summary to authenticated;

-- ============================================================
-- 18. Verification helper queries
-- ============================================================

commit;

-- A. Exactly one active CEO/admin is expected in v0.1.
select count(*) as active_admin_rows
from public.app_admins
where is_active = true;

-- B. Core + app_admins RLS status.
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'app_admins',
    'departments',
    'employees',
    'projects',
    'tasks',
    'results',
    'reviews',
    'approvals',
    'memories'
  )
order by c.relname;

-- C. Confirm the dashboard view exists.
select
  schemaname,
  viewname
from pg_views
where schemaname = 'public'
  and viewname = 'v_ceo_dashboard_summary';

-- ============================================================
-- END STEP 13
-- ============================================================
