-- ============================================================
-- SAWOL OFFICE STEP22
-- 협업/자율 워크플로 전체 삭제 FINAL FIX
--
-- 목적
-- 1) 부모 업무 하나를 삭제하면 연결된 STEP21~22 운영 데이터를 안전한 순서로 정리
-- 2) 하위 업무 / 배정 / 실행 / 승인 / 검수 / 결과 / 인수인계 / 의존성 / 워크플로 정리
-- 3) Supabase PostgREST schema cache 즉시 reload
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 0. CEO/Admin 판별 함수
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
  );
$$;

revoke all on function public.sawol_step22_is_admin() from public;
grant execute on function public.sawol_step22_is_admin() to authenticated;


-- ------------------------------------------------------------
-- 1. 부모 업무 기준 협업 트리 전체 삭제
-- ------------------------------------------------------------
create or replace function public.sawol_delete_workflow_tree(
  p_root_task_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_root_exists boolean := false;
  v_root_parent uuid;
  v_workflow_id uuid;
  v_task_ids uuid[] := array[]::uuid[];
  v_tree_ids uuid[] := array[]::uuid[];
  v_workflow_task_ids uuid[] := array[]::uuid[];
  v_result_ids uuid[] := array[]::uuid[];
  v_deleted_tasks integer := 0;
  v_deleted_workflows integer := 0;
  v_table text;
  v_col text;
  v_where text;
  v_sql text;
begin
  -- 권한
  if not public.sawol_step22_is_admin() then
    raise exception 'NOT_AUTHORIZED';
  end if;

  -- 부모 업무 존재 확인 + 잠금
  select exists(
    select 1 from public.tasks where id = p_root_task_id
  )
  into v_root_exists;

  if not v_root_exists then
    raise exception 'TASK_NOT_FOUND';
  end if;

  perform 1
  from public.tasks
  where id = p_root_task_id
  for update;

  -- parent_task_id가 있는 구조라면, 자식에서 직접 전체삭제하는 것을 차단
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tasks'
      and column_name = 'parent_task_id'
  ) then
    execute
      'select parent_task_id from public.tasks where id = $1'
      into v_root_parent
      using p_root_task_id;

    if v_root_parent is not null then
      raise exception 'DELETE_FROM_ROOT_ONLY';
    end if;
  end if;

  -- ----------------------------------------------------------
  -- 삭제 대상 Task ID 수집
  -- ----------------------------------------------------------
  v_task_ids := array[p_root_task_id];

  -- A) parent_task_id 기반 재귀 트리
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tasks'
      and column_name = 'parent_task_id'
  ) then
    execute $q$
      with recursive task_tree as (
        select id
        from public.tasks
        where id = $1

        union all

        select t.id
        from public.tasks t
        join task_tree p
          on t.parent_task_id = p.id
      )
      select coalesce(array_agg(distinct id), array[]::uuid[])
      from task_tree
    $q$
    into v_tree_ids
    using p_root_task_id;

    v_task_ids := (
      select coalesce(array_agg(distinct x), array[]::uuid[])
      from unnest(v_task_ids || v_tree_ids) x
    );
  end if;

  -- B) workflow_id 기반 Task 묶음
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tasks'
      and column_name = 'workflow_id'
  ) then
    execute
      'select workflow_id from public.tasks where id = $1'
      into v_workflow_id
      using p_root_task_id;

    if v_workflow_id is not null then
      execute
        'select coalesce(array_agg(distinct id), array[]::uuid[])
         from public.tasks
         where workflow_id = $1'
        into v_workflow_task_ids
        using v_workflow_id;

      v_task_ids := (
        select coalesce(array_agg(distinct x), array[]::uuid[])
        from unnest(v_task_ids || v_workflow_task_ids) x
      );
    end if;
  end if;

  -- ----------------------------------------------------------
  -- 결과 ID 미리 수집
  -- ----------------------------------------------------------
  if to_regclass('public.results') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'results'
         and column_name = 'task_id'
     ) then
    execute
      'select coalesce(array_agg(id), array[]::uuid[])
       from public.results
       where task_id = any($1)'
      into v_result_ids
      using v_task_ids;
  end if;

  -- ----------------------------------------------------------
  -- 직원 현재 업무 연결 해제
  -- ----------------------------------------------------------
  if to_regclass('public.employees') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'employees'
         and column_name = 'current_task_id'
     ) then

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'employees'
        and column_name = 'status'
    ) then
      execute
        'update public.employees
         set current_task_id = null,
             status = ''AVAILABLE''
         where current_task_id = any($1)'
      using v_task_ids;
    else
      execute
        'update public.employees
         set current_task_id = null
         where current_task_id = any($1)'
      using v_task_ids;
    end if;
  end if;

  -- ----------------------------------------------------------
  -- 결과를 기억센터가 참조한다면 먼저 정리
  -- ----------------------------------------------------------
  if to_regclass('public.memories') is not null then
    if coalesce(array_length(v_result_ids, 1), 0) > 0
       and exists (
         select 1
         from information_schema.columns
         where table_schema = 'public'
           and table_name = 'memories'
           and column_name = 'source_result_id'
       ) then
      execute
        'delete from public.memories
         where source_result_id = any($1)'
      using v_result_ids;
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'memories'
        and column_name = 'source_task_id'
    ) then
      execute
        'delete from public.memories
         where source_task_id = any($1)'
      using v_task_ids;
    end if;
  end if;

  -- ----------------------------------------------------------
  -- Task/Workflow 연결 테이블 정리
  -- 컬럼이 실제 존재할 때만 DELETE하므로 이전 STEP 구조와도 호환
  -- ----------------------------------------------------------
  foreach v_table in array array[
    'task_feedback',
    'task_handoffs',
    'task_dependencies',
    'approvals',
    'reviews',
    'results',
    'task_runs',
    'task_assignments'
  ]
  loop
    if to_regclass('public.' || v_table) is null then
      continue;
    end if;

    v_where := null;

    -- Task를 직접 참조할 가능성이 있는 UUID 컬럼들
    foreach v_col in array array[
      'task_id',
      'root_task_id',
      'parent_task_id',
      'child_task_id',
      'source_task_id',
      'target_task_id',
      'from_task_id',
      'to_task_id',
      'predecessor_task_id',
      'successor_task_id',
      'depends_on_task_id',
      'dependent_task_id',
      'dependency_task_id'
    ]
    loop
      if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = v_table
          and column_name = v_col
      ) then
        v_where := concat_ws(
          ' or ',
          v_where,
          format('%I = any($1)', v_col)
        );
      end if;
    end loop;

    -- Workflow 직접 참조
    if v_workflow_id is not null
       and exists (
         select 1
         from information_schema.columns
         where table_schema = 'public'
           and table_name = v_table
           and column_name = 'workflow_id'
       ) then
      v_where := concat_ws(
        ' or ',
        v_where,
        format('workflow_id = %L::uuid', v_workflow_id::text)
      );
    end if;

    if v_where is not null and btrim(v_where) <> '' then
      v_sql := format(
        'delete from public.%I where %s',
        v_table,
        v_where
      );

      execute v_sql using v_task_ids;
    end if;
  end loop;

  -- ----------------------------------------------------------
  -- Task가 workflow_id를 참조한다면 먼저 연결 해제
  -- task_workflows.root_task_id -> tasks.id와의 상호 FK 충돌 방지
  -- ----------------------------------------------------------
  if v_workflow_id is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'tasks'
         and column_name = 'workflow_id'
     ) then
    execute
      'update public.tasks
       set workflow_id = null
       where id = any($1)'
    using v_task_ids;
  end if;

  -- ----------------------------------------------------------
  -- Workflow 행 삭제
  -- ----------------------------------------------------------
  if to_regclass('public.task_workflows') is not null then
    if v_workflow_id is not null then
      execute
        'delete from public.task_workflows
         where id = $1'
      using v_workflow_id;

      get diagnostics v_deleted_workflows = row_count;
    end if;

    -- 혹시 workflow_id 연결 없이 root_task_id만 있는 레거시 구조
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'task_workflows'
        and column_name = 'root_task_id'
    ) then
      execute
        'delete from public.task_workflows
         where root_task_id = $1'
      using p_root_task_id;
    end if;
  end if;

  -- ----------------------------------------------------------
  -- 마지막으로 Task 트리 삭제
  -- ----------------------------------------------------------
  delete from public.tasks
  where id = any(v_task_ids);

  get diagnostics v_deleted_tasks = row_count;

  return jsonb_build_object(
    'ok', true,
    'root_task_id', p_root_task_id,
    'workflow_id', v_workflow_id,
    'deleted_tasks', v_deleted_tasks,
    'deleted_workflows', v_deleted_workflows
  );
end;
$$;

revoke all
on function public.sawol_delete_workflow_tree(uuid)
from public;

grant execute
on function public.sawol_delete_workflow_tree(uuid)
to authenticated;


-- ------------------------------------------------------------
-- 2. PostgREST Schema Cache reload
-- ------------------------------------------------------------
notify pgrst, 'reload schema';

commit;


-- ============================================================
-- 3. 적용 확인
-- ============================================================
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n
  on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'sawol_step22_is_admin',
    'sawol_delete_workflow_tree'
  )
order by p.proname;
