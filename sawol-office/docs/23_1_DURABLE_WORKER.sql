-- ============================================================
-- SAWOL OFFICE STEP 23-1
-- Supabase Cron -> Vercel Durable Worker
--
-- 목적:
-- Vercel Hobby 자체 Cron은 하루 1회 제한이 있으므로,
-- Supabase pg_cron + pg_net이 매분 Vercel worker endpoint를 호출합니다.
--
-- 이 SQL은 먼저 Vercel의 환경변수와 Supabase Vault secret을
-- 설정한 뒤 실행하세요.
-- ============================================================

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

-- 기존 동일 이름의 작업이 있으면 제거
select cron.unschedule(jobid)
from cron.job
where jobname = 'sawol-autopilot-worker-every-minute';

-- 매분 Vercel worker를 1회 호출
select cron.schedule(
  'sawol-autopilot-worker-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'sawol_worker_url'
      limit 1
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization',
      'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'sawol_worker_secret'
        limit 1
      )
    ),
    body := jsonb_build_object(
      'source', 'supabase-cron',
      'requested_at', now()
    ),
    timeout_milliseconds := 55000
  );
  $$
);

-- 확인
select jobid, jobname, schedule, active
from cron.job
where jobname = 'sawol-autopilot-worker-every-minute';
