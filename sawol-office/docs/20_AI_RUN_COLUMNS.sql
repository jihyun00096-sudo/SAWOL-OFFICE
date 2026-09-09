-- ============================================================
-- SAWOL OFFICE STEP 20
-- AI EXECUTION METADATA COLUMNS
-- ============================================================
-- 기존 task_runs 결과 구조를 유지하면서
-- Provider / Model / Response ID / Usage / AI 실행시각을 추가합니다.
--
-- 기존 데이터 삭제 없음
-- 기존 컬럼 타입 변경 없음
-- ============================================================

begin;

alter table public.task_runs
  add column if not exists provider text null,
  add column if not exists model text null,
  add column if not exists provider_response_id text null,
  add column if not exists usage_json jsonb null,
  add column if not exists ai_started_at timestamptz null,
  add column if not exists ai_finished_at timestamptz null;

create index if not exists idx_task_runs_provider_response_id
  on public.task_runs(provider_response_id)
  where provider_response_id is not null;

commit;

-- Verification
select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'task_runs'
  and column_name in (
    'provider',
    'model',
    'provider_response_id',
    'usage_json',
    'ai_started_at',
    'ai_finished_at'
  )
order by ordinal_position;
