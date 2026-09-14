-- STEP23-3.7 FREE-ONLY Cloudflare 이미지 경로 복구
-- STEP23-3.7 코드 배포가 Ready 된 뒤 1회 실행하세요.

update public.task_autopilot_jobs j
set
  status = 'QUEUED',
  progress = 0,
  current_step_title = null,
  last_error = null,
  last_message = '무료 이미지 생성 경로를 Cloudflare FLUX.1 Schnell로 변경하여 재실행 대기 중입니다.',
  finished_at = null,
  heartbeat_at = now(),
  updated_at = now()
from public.tasks t
where j.task_id = t.id
  and t.execution_mode = 'AUTO'
  and t.status = 'WAITING'
  and j.status = 'FAILED'
  and (
    j.last_error ilike '%gemini%image%'
    or j.last_error ilike '%image/png%'
    or j.last_error ilike '%image/jpeg%'
    or j.last_error ilike '%generateContent%'
    or j.last_error ilike '%image interaction%'
    or j.last_error ilike '%CLOUDFLARE_IMAGE%'
  );

select
  t.task_code,
  t.status as task_status,
  j.status as job_status,
  j.progress,
  j.current_step_title,
  j.last_message,
  j.last_error
from public.tasks t
join public.task_autopilot_jobs j
  on j.task_id = t.id
where t.execution_mode = 'AUTO'
order by j.updated_at desc
limit 20;
