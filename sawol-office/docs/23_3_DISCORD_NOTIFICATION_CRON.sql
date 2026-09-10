-- ============================================================
-- SAWOL OFFICE STEP23-3
-- Discord 진행/완료/승인/오류 알림 Cron
--
-- 기존 STEP23-1의 Supabase Vault secret을 그대로 사용합니다.
-- 추가 secret 불필요.
-- ============================================================

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

-- 같은 이름의 기존 작업이 있으면 제거
select cron.unschedule(jobid)
from cron.job
where jobname = 'sawol-discord-notifications-every-minute';

-- 매분 Discord notification worker 호출
select cron.schedule(
  'sawol-discord-notifications-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := replace(
      (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'sawol_worker_url'
        limit 1
      ),
      '/api/worker/autopilot',
      '/api/worker/discord-notifications'
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
      'kind', 'discord-notifications',
      'requested_at', now()
    ),
    timeout_milliseconds := 55000
  );
  $$
);

-- 확인
select jobid, jobname, schedule, active
from cron.job
where jobname = 'sawol-discord-notifications-every-minute';
