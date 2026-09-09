-- ============================================================
-- SAWOL OFFICE STEP 20 FINAL FIX
-- Final approval -> task_runs + results + memories atomically
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1) results를 AI 실행 결과와 연결할 수 있도록 확장
-- ------------------------------------------------------------

alter table public.results
  add column if not exists source_run_id uuid null,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- AI 실행은 담당 직원 미배정 상태에서도 가능하므로 결과도 저장 가능해야 함.
alter table public.results
  alter column employee_id drop not null;

-- task_runs가 존재하는 STEP19 이후 환경에서 FK를 안전하게 추가
DO $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'results_source_run_fk'
      and conrelid = 'public.results'::regclass
  ) then
    alter table public.results
      add constraint results_source_run_fk
      foreign key (source_run_id)
      references public.task_runs(id)
      on delete set null;
  end if;
end $$;

create unique index if not exists uq_results_source_run
  on public.results(source_run_id)
  where source_run_id is not null;

create index if not exists idx_results_source_run
  on public.results(source_run_id);

-- ------------------------------------------------------------
-- 2) 완료된 업무의 최종 실행 결과를 결과함/기억센터에 동기화
-- ------------------------------------------------------------

create or replace function public.sawol_sync_task_artifacts(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task public.tasks%rowtype;
  v_run public.task_runs%rowtype;
  v_result_id uuid;
  v_result_code text;
  v_result_type text;
  v_memory_code text;
  v_memory_content text;
  v_employee_id uuid;
begin
  select *
  into v_task
  from public.tasks
  where id = p_task_id;

  if not found then
    raise exception 'TASK_NOT_FOUND';
  end if;

  select *
  into v_run
  from public.task_runs
  where task_id = p_task_id
    and result_body is not null
    and status in ('SUBMITTED', 'COMPLETED')
  order by coalesce(submitted_at, completed_at, created_at) desc, created_at desc
  limit 1;

  if not found then
    return jsonb_build_object(
      'ok', true,
      'has_result', false,
      'task_id', p_task_id,
      'message', '완료 처리할 실행 결과가 없습니다.'
    );
  end if;

  v_employee_id := coalesce(v_run.employee_id, v_task.assigned_employee_id);
  v_result_code := 'RESULT-' || regexp_replace(v_run.run_code, '^RUN-', '', 'i');

  v_result_type := case v_task.task_type
    when 'RESEARCH' then 'RESEARCH'
    when 'ANALYSIS' then 'ANALYSIS'
    when 'DEVELOPMENT' then 'CODE'
    else 'DOCUMENT'
  end;

  insert into public.results (
    result_code,
    project_id,
    task_id,
    employee_id,
    source_run_id,
    result_type,
    title,
    summary,
    content,
    version,
    status,
    is_final,
    metadata
  )
  values (
    v_result_code,
    v_task.project_id,
    v_task.id,
    v_employee_id,
    v_run.id,
    v_result_type,
    coalesce(nullif(v_run.result_title, ''), v_task.title || ' 결과'),
    v_run.result_summary,
    v_run.result_body,
    1,
    'APPROVED',
    true,
    jsonb_build_object(
      'source', 'task_run',
      'run_code', v_run.run_code,
      'provider', v_run.provider,
      'model', v_run.model,
      'auto_finalized', true
    )
  )
  on conflict (source_run_id) where source_run_id is not null
  do update set
    project_id = excluded.project_id,
    task_id = excluded.task_id,
    employee_id = excluded.employee_id,
    result_type = excluded.result_type,
    title = excluded.title,
    summary = excluded.summary,
    content = excluded.content,
    status = 'APPROVED',
    is_final = true,
    metadata = coalesce(public.results.metadata, '{}'::jsonb) || excluded.metadata,
    updated_at = now()
  returning id into v_result_id;

  -- 최종 승인된 실행 세션만 COMPLETED 처리
  update public.task_runs
  set
    status = 'COMPLETED',
    completed_at = coalesce(completed_at, now()),
    updated_at = now()
  where id = v_run.id;

  -- 승인된 결과를 장기 기억에 너무 길지 않게 요약 저장
  v_memory_code := 'MEMORY-RESULT-' || regexp_replace(v_run.run_code, '^RUN-', '', 'i');
  v_memory_content := left(
    concat_ws(
      E'\n\n',
      nullif(v_run.result_summary, ''),
      case
        when nullif(v_run.result_body, '') is not null
          then '승인된 결과 핵심:' || E'\n' || left(v_run.result_body, 1800)
        else null
      end
    ),
    2400
  );

  if nullif(v_memory_content, '') is not null then
    insert into public.memories (
      memory_code,
      memory_type,
      category,
      title,
      content,
      importance,
      confidence,
      status,
      project_id,
      source,
      effective_from,
      last_verified_at,
      metadata
    )
    values (
      v_memory_code,
      'RESULT',
      'APPROVED_RESULT',
      '승인 결과 · ' || v_task.title,
      v_memory_content,
      'MEDIUM',
      'VERIFIED',
      'ACTIVE',
      v_task.project_id,
      'RESULT',
      now(),
      now(),
      jsonb_build_object(
        'result_id', v_result_id,
        'result_code', v_result_code,
        'task_id', v_task.id,
        'task_code', v_task.task_code,
        'run_id', v_run.id,
        'run_code', v_run.run_code,
        'provider', v_run.provider,
        'model', v_run.model,
        'auto_generated', true
      )
    )
    on conflict (memory_code)
    do update set
      title = excluded.title,
      content = excluded.content,
      confidence = 'VERIFIED',
      status = 'ACTIVE',
      project_id = excluded.project_id,
      source = 'RESULT',
      last_verified_at = now(),
      metadata = excluded.metadata,
      updated_at = now();
  end if;

  return jsonb_build_object(
    'ok', true,
    'has_result', true,
    'task_id', v_task.id,
    'run_id', v_run.id,
    'result_id', v_result_id,
    'result_code', v_result_code,
    'memory_code', v_memory_code
  );
end;
$$;

-- ------------------------------------------------------------
-- 3) 대표 승인 완료 전용 함수
-- task 완료 + 결과/기억 생성이 한 DB 트랜잭션 안에서 처리됨
-- ------------------------------------------------------------

create or replace function public.sawol_finalize_task_approval(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
  v_synced jsonb;
begin
  select status
  into v_status
  from public.tasks
  where id = p_task_id
  for update;

  if not found then
    raise exception 'TASK_NOT_FOUND';
  end if;

  if v_status <> 'PENDING_APPROVAL' then
    raise exception 'TASK_NOT_PENDING_APPROVAL: %', v_status;
  end if;

  update public.tasks
  set
    status = 'COMPLETED',
    completed_at = coalesce(completed_at, now()),
    updated_at = now()
  where id = p_task_id;

  v_synced := public.sawol_sync_task_artifacts(p_task_id);

  return jsonb_build_object(
    'ok', true,
    'task_id', p_task_id,
    'artifacts', v_synced
  );
end;
$$;

revoke all on function public.sawol_sync_task_artifacts(uuid) from public;
revoke all on function public.sawol_finalize_task_approval(uuid) from public;

grant execute on function public.sawol_sync_task_artifacts(uuid) to authenticated;
grant execute on function public.sawol_finalize_task_approval(uuid) to authenticated;

-- ------------------------------------------------------------
-- 4) 이미 STEP20에서 완료된 업무 Backfill
-- 결과함/기억센터가 비어 있던 기존 완료 업무도 즉시 동기화
-- ------------------------------------------------------------

DO $$
declare
  r record;
begin
  for r in
    select distinct t.id
    from public.tasks t
    join public.task_runs tr on tr.task_id = t.id
    where t.status = 'COMPLETED'
      and tr.result_body is not null
      and tr.status in ('SUBMITTED', 'COMPLETED')
  loop
    perform public.sawol_sync_task_artifacts(r.id);
  end loop;
end $$;

commit;

-- ============================================================
-- Verification
-- ============================================================

select
  t.task_code,
  t.title as task_title,
  t.status as task_status,
  tr.run_code,
  tr.status as run_status,
  r.result_code,
  r.status as result_status,
  r.is_final,
  m.memory_code,
  m.status as memory_status
from public.tasks t
left join lateral (
  select *
  from public.task_runs x
  where x.task_id = t.id
  order by x.created_at desc
  limit 1
) tr on true
left join public.results r on r.source_run_id = tr.id
left join public.memories m on m.metadata ->> 'run_id' = tr.id::text
where tr.id is not null
order by t.updated_at desc
limit 20;
