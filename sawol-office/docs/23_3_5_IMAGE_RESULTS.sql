-- ============================================================
-- SAWOL OFFICE STEP 23-3.5
-- Gemini image result + Storage + final artifact sync
-- ============================================================

begin;

-- 1) Generated result images bucket
insert into storage.buckets (id, name, public)
values ('sawol-results', 'sawol-results', true)
on conflict (id)
do update set public = excluded.public;

-- Browser-admin/manual AI execution may upload generated images.
drop policy if exists "sawol_results_admin_select" on storage.objects;
drop policy if exists "sawol_results_admin_insert" on storage.objects;
drop policy if exists "sawol_results_admin_update" on storage.objects;
drop policy if exists "sawol_results_admin_delete" on storage.objects;

create policy "sawol_results_admin_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'sawol-results'
  and exists (
    select 1
    from public.app_admins a
    where a.user_id = auth.uid()
      and a.is_active = true
  )
);

create policy "sawol_results_admin_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'sawol-results'
  and exists (
    select 1
    from public.app_admins a
    where a.user_id = auth.uid()
      and a.is_active = true
  )
);

create policy "sawol_results_admin_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'sawol-results'
  and exists (
    select 1
    from public.app_admins a
    where a.user_id = auth.uid()
      and a.is_active = true
  )
)
with check (
  bucket_id = 'sawol-results'
  and exists (
    select 1
    from public.app_admins a
    where a.user_id = auth.uid()
      and a.is_active = true
  )
);

create policy "sawol_results_admin_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'sawol-results'
  and exists (
    select 1
    from public.app_admins a
    where a.user_id = auth.uid()
      and a.is_active = true
  )
);

-- 2) Final approval sync now understands IMAGE assets.
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
  v_asset jsonb;
  v_file_url text;
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

  v_asset := coalesce(v_run.metadata -> 'step20' -> 'asset', '{}'::jsonb);
  v_file_url := nullif(v_asset ->> 'url', '');

  v_result_type := case
    when coalesce(v_asset ->> 'kind', '') = 'IMAGE' then 'IMAGE'
    when v_task.task_type = 'RESEARCH' then 'RESEARCH'
    when v_task.task_type = 'ANALYSIS' then 'ANALYSIS'
    when v_task.task_type = 'DEVELOPMENT' then 'CODE'
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
    file_url,
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
    v_file_url,
    1,
    'APPROVED',
    true,
    jsonb_build_object(
      'source', 'task_run',
      'run_code', v_run.run_code,
      'provider', v_run.provider,
      'model', v_run.model,
      'auto_finalized', true,
      'asset', v_asset
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
    file_url = excluded.file_url,
    status = 'APPROVED',
    is_final = true,
    metadata = coalesce(public.results.metadata, '{}'::jsonb) || excluded.metadata,
    updated_at = now()
  returning id into v_result_id;

  update public.task_runs
  set
    status = 'COMPLETED',
    completed_at = coalesce(completed_at, now()),
    updated_at = now()
  where id = v_run.id;

  v_memory_code := 'MEMORY-RESULT-' || regexp_replace(v_run.run_code, '^RUN-', '', 'i');
  v_memory_content := left(
    concat_ws(
      E'\n\n',
      nullif(v_run.result_summary, ''),
      case
        when v_file_url is not null
          then '승인된 이미지 결과: ' || v_file_url
        else null
      end,
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
        'asset', v_asset,
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
    'memory_code', v_memory_code,
    'result_type', v_result_type,
    'file_url', v_file_url
  );
end;
$$;

revoke all on function public.sawol_sync_task_artifacts(uuid) from public;
grant execute on function public.sawol_sync_task_artifacts(uuid) to authenticated;

commit;

-- Verification
select id, name, public
from storage.buckets
where id = 'sawol-results';
