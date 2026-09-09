-- ============================================================
-- SAWOL OFFICE STEP 20
-- DELETE RLS FIX FOR results / memories
-- ============================================================
-- 목적:
-- 1) 로그인된 SAWOL 대표 계정만 results / memories 삭제 허용
-- 2) 브라우저 Supabase Client DELETE가 RLS에 막히는 문제 해결
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. 대표 여부 확인 helper
-- SECURITY DEFINER로 app_admins 조회를 한 곳에 모음
-- ------------------------------------------------------------

create or replace function public.is_sawol_admin()
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
      and a.is_active = true
  );
$$;

revoke all on function public.is_sawol_admin() from public;
grant execute on function public.is_sawol_admin() to authenticated;

-- ------------------------------------------------------------
-- 2. results DELETE policy
-- ------------------------------------------------------------

drop policy if exists "sawol_admin_delete_results" on public.results;

create policy "sawol_admin_delete_results"
on public.results
for delete
to authenticated
using (public.is_sawol_admin());

-- ------------------------------------------------------------
-- 3. memories DELETE policy
-- ------------------------------------------------------------

drop policy if exists "sawol_admin_delete_memories" on public.memories;

create policy "sawol_admin_delete_memories"
on public.memories
for delete
to authenticated
using (public.is_sawol_admin());

commit;

-- ------------------------------------------------------------
-- Verification
-- 아래 결과에 2개의 DELETE policy가 보여야 정상
-- ------------------------------------------------------------

select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual
from pg_policies
where schemaname = 'public'
  and tablename in ('results', 'memories')
  and cmd = 'DELETE'
order by tablename, policyname;
