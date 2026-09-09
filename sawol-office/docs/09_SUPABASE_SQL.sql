
-- SAWOL OFFICE v0.1
-- STEP 9: Supabase SQL Schema
-- Core tables:
-- departments, employees, projects, tasks, results, reviews, approvals, memories

create extension if not exists "pgcrypto";

-- =========================================================
-- Helper: updated_at trigger
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================
-- 1) departments
-- =========================================================

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  department_type text not null
    check (department_type in ('HEADQUARTERS','DEPARTMENT','TEAM','LAB')),
  parent_department_id uuid null,
  description text null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint departments_parent_fk
    foreign key (parent_department_id)
    references public.departments(id)
    on delete set null
);

create index if not exists idx_departments_parent
  on public.departments(parent_department_id);

create index if not exists idx_departments_active
  on public.departments(is_active);

drop trigger if exists trg_departments_updated_at on public.departments;
create trigger trg_departments_updated_at
before update on public.departments
for each row execute function public.set_updated_at();

-- =========================================================
-- 2) projects
-- employees FK to current_task is added later to avoid cycle
-- =========================================================

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  project_code text not null unique,
  name text not null,
  original_request text not null,
  objective text null,
  expected_result text null,
  status text not null default 'IDEA'
    check (status in (
      'IDEA',
      'PLANNING',
      'IN_PROGRESS',
      'REVIEW',
      'APPROVAL_WAIT',
      'ON_HOLD',
      'COMPLETED',
      'CANCELLED'
    )),
  priority text not null default 'NORMAL'
    check (priority in ('URGENT','HIGH','NORMAL','LOW')),
  manager_employee_id uuid null,
  progress integer not null default 0
    check (progress between 0 and 100),
  current_stage text null,
  risk_level text not null default 'LOW'
    check (risk_level in ('LOW','MEDIUM','HIGH','CRITICAL')),
  estimated_cost numeric(14,2) not null default 0,
  actual_cost numeric(14,2) not null default 0,
  started_at timestamptz null,
  due_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_projects_status
  on public.projects(status);

create index if not exists idx_projects_priority
  on public.projects(priority);

drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

-- =========================================================
-- 3) employees
-- =========================================================

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_code text not null unique,
  name text not null,
  department_id uuid not null,
  position text not null,
  specialty jsonb not null default '[]'::jsonb,
  responsibilities jsonb not null default '[]'::jsonb,
  allowed_actions jsonb not null default '[]'::jsonb,
  prohibited_actions jsonb not null default '[]'::jsonb,
  tools jsonb not null default '[]'::jsonb,
  work_style text null,
  speaking_style text null,
  report_style text null,
  status text not null default 'AVAILABLE'
    check (status in (
      'AVAILABLE',
      'WORKING',
      'WAITING',
      'REVIEWING',
      'APPROVAL_WAIT',
      'BLOCKED',
      'OFFLINE'
    )),
  current_task_id uuid null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employees_department_fk
    foreign key (department_id)
    references public.departments(id)
    on delete restrict
);

create index if not exists idx_employees_department
  on public.employees(department_id);

create index if not exists idx_employees_status
  on public.employees(status);

create index if not exists idx_employees_active
  on public.employees(is_active);

drop trigger if exists trg_employees_updated_at on public.employees;
create trigger trg_employees_updated_at
before update on public.employees
for each row execute function public.set_updated_at();

-- Add manager FK now that employees exists
alter table public.projects
  drop constraint if exists projects_manager_employee_fk;

alter table public.projects
  add constraint projects_manager_employee_fk
  foreign key (manager_employee_id)
  references public.employees(id)
  on delete set null;

create index if not exists idx_projects_manager
  on public.projects(manager_employee_id);

-- =========================================================
-- 4) tasks
-- =========================================================

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  task_code text not null unique,
  project_id uuid null,
  parent_task_id uuid null,
  title text not null,
  description text null,
  task_type text not null
    check (task_type in (
      'RESEARCH',
      'PLANNING',
      'PRODUCTION',
      'EDIT',
      'ANALYSIS',
      'OPERATION',
      'STUDY',
      'DEVELOPMENT',
      'DESIGN',
      'OTHER'
    )),
  status text not null default 'WAITING'
    check (status in (
      'WAITING',
      'WAITING_FOR_DATA',
      'IN_PROGRESS',
      'COLLABORATING',
      'IN_REVIEW',
      'APPROVAL_WAIT',
      'REVISION_REQUESTED',
      'COMPLETED',
      'ON_HOLD',
      'CANCELLED',
      'ERROR'
    )),
  priority text not null default 'NORMAL'
    check (priority in ('URGENT','HIGH','NORMAL','LOW')),
  assigned_employee_id uuid null,
  assigned_department_id uuid null,
  review_level integer not null default 0
    check (review_level between 0 and 3),
  requires_ceo_approval boolean not null default false,
  blocked_reason text null,
  input_data jsonb not null default '{}'::jsonb,
  output_requirements jsonb not null default '{}'::jsonb,
  started_at timestamptz null,
  due_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_project_fk
    foreign key (project_id)
    references public.projects(id)
    on delete set null,
  constraint tasks_parent_fk
    foreign key (parent_task_id)
    references public.tasks(id)
    on delete set null,
  constraint tasks_assigned_employee_fk
    foreign key (assigned_employee_id)
    references public.employees(id)
    on delete set null,
  constraint tasks_assigned_department_fk
    foreign key (assigned_department_id)
    references public.departments(id)
    on delete set null
);

create index if not exists idx_tasks_project
  on public.tasks(project_id);

create index if not exists idx_tasks_status
  on public.tasks(status);

create index if not exists idx_tasks_employee
  on public.tasks(assigned_employee_id);

create index if not exists idx_tasks_department
  on public.tasks(assigned_department_id);

create index if not exists idx_tasks_parent
  on public.tasks(parent_task_id);

drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

-- Add employee.current_task FK after tasks exists
alter table public.employees
  drop constraint if exists employees_current_task_fk;

alter table public.employees
  add constraint employees_current_task_fk
  foreign key (current_task_id)
  references public.tasks(id)
  on delete set null;

create index if not exists idx_employees_current_task
  on public.employees(current_task_id);

-- =========================================================
-- 5) results
-- =========================================================

create table if not exists public.results (
  id uuid primary key default gen_random_uuid(),
  result_code text not null unique,
  project_id uuid null,
  task_id uuid null,
  employee_id uuid not null,
  result_type text not null
    check (result_type in (
      'DOCUMENT',
      'IMAGE',
      'CODE',
      'RESEARCH',
      'SPREADSHEET',
      'ANALYSIS',
      'PROMPT',
      'WEB',
      'DATA',
      'OTHER'
    )),
  title text not null,
  summary text null,
  content text null,
  file_url text null,
  external_url text null,
  version integer not null default 1
    check (version >= 1),
  status text not null default 'DRAFT'
    check (status in (
      'DRAFT',
      'IN_REVIEW',
      'APPROVAL_WAIT',
      'APPROVED',
      'REJECTED',
      'ARCHIVED'
    )),
  is_final boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint results_project_fk
    foreign key (project_id)
    references public.projects(id)
    on delete set null,
  constraint results_task_fk
    foreign key (task_id)
    references public.tasks(id)
    on delete set null,
  constraint results_employee_fk
    foreign key (employee_id)
    references public.employees(id)
    on delete restrict
);

create index if not exists idx_results_project
  on public.results(project_id);

create index if not exists idx_results_task
  on public.results(task_id);

create index if not exists idx_results_employee
  on public.results(employee_id);

create index if not exists idx_results_status
  on public.results(status);

drop trigger if exists trg_results_updated_at on public.results;
create trigger trg_results_updated_at
before update on public.results
for each row execute function public.set_updated_at();

-- =========================================================
-- 6) reviews
-- =========================================================

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  task_id uuid null,
  result_id uuid null,
  reviewer_employee_id uuid not null,
  review_type text not null
    check (review_type in (
      'FACT',
      'REQUIREMENT',
      'CONTENT',
      'DESIGN',
      'CODE',
      'SECURITY',
      'LEGAL_RISK',
      'FINAL'
    )),
  review_level integer not null default 0
    check (review_level between 0 and 3),
  verdict text not null
    check (verdict in (
      'PASS',
      'PASS_WITH_WARNING',
      'REVISE',
      'REJECT'
    )),
  findings text null,
  required_changes text null,
  warnings text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_task_fk
    foreign key (task_id)
    references public.tasks(id)
    on delete cascade,
  constraint reviews_result_fk
    foreign key (result_id)
    references public.results(id)
    on delete cascade,
  constraint reviews_reviewer_fk
    foreign key (reviewer_employee_id)
    references public.employees(id)
    on delete restrict,
  constraint reviews_target_check
    check (task_id is not null or result_id is not null)
);

create index if not exists idx_reviews_task
  on public.reviews(task_id);

create index if not exists idx_reviews_result
  on public.reviews(result_id);

create index if not exists idx_reviews_reviewer
  on public.reviews(reviewer_employee_id);

drop trigger if exists trg_reviews_updated_at on public.reviews;
create trigger trg_reviews_updated_at
before update on public.reviews
for each row execute function public.set_updated_at();

-- =========================================================
-- 7) approvals
-- =========================================================

create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid null,
  task_id uuid null,
  result_id uuid null,
  approval_type text not null
    check (approval_type in (
      'RESULT',
      'COST',
      'DEPLOY',
      'EXTERNAL_SEND',
      'DATA_CHANGE',
      'SECURITY',
      'LEGAL',
      'OTHER'
    )),
  title text not null,
  summary text not null,
  status text not null default 'PENDING'
    check (status in (
      'PENDING',
      'APPROVED',
      'REVISION_REQUESTED',
      'HOLD',
      'REJECTED'
    )),
  risk_summary text null,
  cost numeric(14,2) null,
  requested_by_employee_id uuid null,
  ceo_comment text null,
  requested_at timestamptz not null default now(),
  decided_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint approvals_project_fk
    foreign key (project_id)
    references public.projects(id)
    on delete set null,
  constraint approvals_task_fk
    foreign key (task_id)
    references public.tasks(id)
    on delete set null,
  constraint approvals_result_fk
    foreign key (result_id)
    references public.results(id)
    on delete set null,
  constraint approvals_requested_by_fk
    foreign key (requested_by_employee_id)
    references public.employees(id)
    on delete set null,
  constraint approvals_target_check
    check (
      project_id is not null
      or task_id is not null
      or result_id is not null
    )
);

create index if not exists idx_approvals_status
  on public.approvals(status);

create index if not exists idx_approvals_project
  on public.approvals(project_id);

create index if not exists idx_approvals_task
  on public.approvals(task_id);

drop trigger if exists trg_approvals_updated_at on public.approvals;
create trigger trg_approvals_updated_at
before update on public.approvals
for each row execute function public.set_updated_at();

-- =========================================================
-- 8) memories
-- =========================================================

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  memory_code text not null unique,
  memory_type text not null
    check (memory_type in (
      'CEO',
      'PROJECT',
      'DECISION',
      'KNOWLEDGE',
      'FAILURE',
      'PROMPT',
      'RULE',
      'RESULT'
    )),
  category text null,
  title text not null,
  content text not null,
  importance text not null default 'MEDIUM'
    check (importance in ('HIGH','MEDIUM','LOW')),
  confidence text not null default 'INTERNAL'
    check (confidence in (
      'VERIFIED',
      'RELIABLE',
      'INTERNAL',
      'EXPERIMENTAL',
      'UNVERIFIED'
    )),
  status text not null default 'ACTIVE'
    check (status in (
      'ACTIVE',
      'SUPERSEDED',
      'ARCHIVED',
      'INVALID'
    )),
  project_id uuid null,
  source text null,
  effective_from timestamptz null,
  last_verified_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memories_project_fk
    foreign key (project_id)
    references public.projects(id)
    on delete set null
);

create index if not exists idx_memories_type
  on public.memories(memory_type);

create index if not exists idx_memories_category
  on public.memories(category);

create index if not exists idx_memories_status
  on public.memories(status);

create index if not exists idx_memories_project
  on public.memories(project_id);

drop trigger if exists trg_memories_updated_at on public.memories;
create trigger trg_memories_updated_at
before update on public.memories
for each row execute function public.set_updated_at();

-- =========================================================
-- RLS
-- Initial v0.1 policy:
-- Enable RLS now, but do not create public/anon policies.
-- Access should be done through authenticated server-side code
-- or explicit owner policies added in the app stage.
-- =========================================================

alter table public.departments enable row level security;
alter table public.employees enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.results enable row level security;
alter table public.reviews enable row level security;
alter table public.approvals enable row level security;
alter table public.memories enable row level security;

-- =========================================================
-- Optional authenticated read/write policies for single-user prototype
-- IMPORTANT:
-- Use only if the app uses Supabase Auth and only the owner can sign in.
-- Remove/comment these if using strictly server-side service role access.
-- =========================================================

-- Example:
-- create policy "authenticated_all_departments"
-- on public.departments
-- for all
-- to authenticated
-- using (true)
-- with check (true);

-- Repeat equivalent policy per table only after authentication design is fixed.

-- =========================================================
-- Convenience views
-- =========================================================

create or replace view public.v_ceo_dashboard_summary as
select
  (select count(*) from public.projects
    where status in ('PLANNING','IN_PROGRESS','REVIEW','APPROVAL_WAIT')) as active_projects,
  (select count(*) from public.tasks
    where status in ('IN_PROGRESS','COLLABORATING')) as active_tasks,
  (select count(*) from public.approvals
    where status = 'PENDING') as pending_approvals,
  (select count(*) from public.tasks
    where status = 'WAITING_FOR_DATA') as waiting_for_data,
  (select count(*) from public.tasks
    where status = 'ERROR') as error_tasks,
  (select count(*) from public.tasks
    where status = 'COMPLETED'
      and completed_at::date = current_date) as completed_today;

-- =========================================================
-- End
-- =========================================================
