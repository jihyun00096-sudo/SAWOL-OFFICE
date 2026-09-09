-- ============================================================
-- SAWOL OFFICE STEP 18
-- tasks.status CHECK CONSTRAINT PATCH
-- ============================================================
-- 목적:
-- STEP 18 실행 상태값을 tasks.status가 허용하도록 확장한다.
--
-- 안전장치:
-- 1) public.tasks가 존재하는지 확인
-- 2) 현재 저장된 status 중 예상 밖 값이 있으면 중단
-- 3) status 컬럼을 참조하는 CHECK constraint만 제거
-- 4) 새 명시적 constraint 추가
-- ============================================================

begin;

do $$
declare
  v_unknown text;
  r record;
begin
  if to_regclass('public.tasks') is null then
    raise exception 'STOP: public.tasks table does not exist.';
  end if;

  select string_agg(distinct status, ', ' order by status)
    into v_unknown
  from public.tasks
  where status is not null
    and status not in (
      'WAITING',
      'IN_PROGRESS',
      'REVIEW',
      'PENDING_APPROVAL',
      'COMPLETED',
      'ON_HOLD',
      'ERROR',
      'WAITING_FOR_DATA',
      'CANCELLED',
      'CANCELED'
    );

  if v_unknown is not null then
    raise exception
      'STOP: Unexpected existing tasks.status value(s): %. Review these values before changing the constraint.',
      v_unknown;
  end if;

  -- status 컬럼을 참조하는 기존 CHECK constraint만 제거.
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'tasks'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%status%'
  loop
    execute format(
      'alter table public.tasks drop constraint if exists %I',
      r.conname
    );
  end loop;

  alter table public.tasks
    drop constraint if exists tasks_status_step18_check;

  alter table public.tasks
    add constraint tasks_status_step18_check
    check (
      status in (
        'WAITING',
        'IN_PROGRESS',
        'REVIEW',
        'PENDING_APPROVAL',
        'COMPLETED',
        'ON_HOLD',
        'ERROR',
        'WAITING_FOR_DATA',
        'CANCELLED',
        'CANCELED'
      )
    );

end $$;

commit;

-- Verification
select
  status,
  count(*) as task_count
from public.tasks
group by status
order by status;

select
  conname,
  pg_get_constraintdef(c.oid) as definition
from pg_constraint c
join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public'
  and t.relname = 'tasks'
  and c.contype = 'c'
order by conname;
