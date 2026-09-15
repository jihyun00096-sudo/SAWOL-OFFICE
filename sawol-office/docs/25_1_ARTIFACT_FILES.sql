-- STEP25.1
-- task_runs.metadata.step20.artifacts / artifact_plan 을 승인 결과(results.metadata)에 자동 복사합니다.
-- 기존 결과 스키마를 변경하지 않고, metadata 안에 파일 목록을 보존합니다.

create or replace function public.sawol_copy_run_artifacts_to_result()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run_metadata jsonb;
  v_artifacts jsonb;
  v_plan jsonb;
begin
  if new.source_run_id is null then
    return new;
  end if;

  select metadata
  into v_run_metadata
  from public.task_runs
  where id = new.source_run_id;

  if v_run_metadata is null then
    return new;
  end if;

  v_artifacts := coalesce(v_run_metadata -> 'step20' -> 'artifacts', '[]'::jsonb);
  v_plan := coalesce(v_run_metadata -> 'step20' -> 'artifact_plan', '{}'::jsonb);

  new.metadata :=
    coalesce(new.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'artifacts', v_artifacts,
      'artifact_plan', v_plan
    );

  if new.file_url is null
     and jsonb_typeof(v_artifacts) = 'array'
     and jsonb_array_length(v_artifacts) > 0
  then
    new.file_url := nullif(v_artifacts -> 0 ->> 'url', '');
  end if;

  return new;
end;
$$;

drop trigger if exists trg_results_copy_run_artifacts on public.results;

create trigger trg_results_copy_run_artifacts
before insert or update of source_run_id, metadata
on public.results
for each row
execute function public.sawol_copy_run_artifacts_to_result();

-- 이미 생성된 승인 결과가 있다면 한 번 동기화
update public.results r
set
  metadata =
    coalesce(r.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'artifacts',
      coalesce(tr.metadata -> 'step20' -> 'artifacts', '[]'::jsonb),
      'artifact_plan',
      coalesce(tr.metadata -> 'step20' -> 'artifact_plan', '{}'::jsonb)
    ),
  file_url = coalesce(
    r.file_url,
    nullif(tr.metadata -> 'step20' -> 'artifacts' -> 0 ->> 'url', '')
  ),
  updated_at = now()
from public.task_runs tr
where r.source_run_id = tr.id
  and (
    jsonb_array_length(
      coalesce(tr.metadata -> 'step20' -> 'artifacts', '[]'::jsonb)
    ) > 0
    or tr.metadata -> 'step20' -> 'artifact_plan' is not null
  );
