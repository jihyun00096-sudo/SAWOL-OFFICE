# SAWOL OFFICE — STEP 13 대표 인증 및 RLS 보안 설정

## 0. 이 단계에서 바꾸는 것

STEP 13은 기존 STEP 1~12를 수정하지 않는다.

이번 단계에서 새로 추가하는 것은 다음과 같다.

1. 대표 1인 전용 인증 기준
2. 대표 계정 등록용 `app_admins` 테이블
3. 대표 여부를 안전하게 확인하는 내부 함수
4. 기존 8개 핵심 테이블의 RLS 정책
5. 대표실 요약 View 보안 보강
6. 로그인/로그아웃 동작 확인
7. 보안 검증 절차

---

# 1. STEP 13의 목표

SAWOL OFFICE v0.1은 대표 1명만 사용하는 개인 AI 회사다.

따라서 다음 조건을 만족해야 한다.

- 로그인하지 않은 사람은 회사 데이터를 읽을 수 없다.
- Supabase 계정을 가지고 있더라도 SAWOL OFFICE 대표로 등록되지 않았다면 데이터를 읽거나 수정할 수 없다.
- 대표로 등록된 계정만 회사 DB의 데이터를 읽고 쓸 수 있다.
- 일반 회원가입 화면은 제공하지 않는다.
- Service Role Key를 브라우저에서 사용하지 않는다.
- 기존 직원 데이터, 프로젝트 데이터, 기억 데이터는 그대로 보존한다.
- 대표실 요약 View가 RLS를 우회하지 않도록 한다.

---

# 2. 왜 단순히 `authenticated` 전체 허용을 하지 않는가

v0.1은 대표 1명만 사용하지만, 단순히 다음처럼 만들면 안 된다.

`to authenticated using (true)`

이 방식은 향후 실수로 다른 Auth 사용자가 생겼을 때 그 사용자도 회사 데이터를 볼 수 있게 된다.

SAWOL OFFICE에서는 별도의 관리자 목록인:

`public.app_admins`

를 만들고,

현재 로그인한 Auth User ID가 이 테이블에서 활성화된 대표인지 확인한다.

---

# 3. 대표 계정 먼저 만들기

Supabase Dashboard에서 다음 순서로 이동한다.

Authentication
→ Users

대표가 사용할 계정이 아직 없다면 사용자 추가 기능으로 대표 계정을 생성한다.

권장:

- 본인이 실제로 관리 가능한 이메일 사용
- 강력한 비밀번호 사용
- 다른 서비스와 비밀번호 재사용 금지

중요:

비밀번호를 아래 장소에 적지 않는다.

- GitHub
- Codespaces 파일
- docs
- SQL
- Notion
- Discord
- ChatGPT 대화
- 코드 주석

---

# 4. 대표 User UUID 찾기

Supabase:

Authentication
→ Users
→ 대표 계정 클릭

여기서 User UID 또는 User ID를 확인한다.

형태:

`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

이 UUID는 비밀번호가 아니다.

STEP 13 SQL에 대표 계정을 등록하기 위해 사용한다.

---

# 5. STEP 13 SQL 파일

파일명:

`13_AUTH_RLS.sql`

이 파일은 실행 전 반드시 한 곳을 수정해야 한다.

파일 상단에서:

`00000000-0000-0000-0000-000000000000`

을 찾아서

대표의 실제 Supabase Auth User UUID로 교체한다.

예시:

기존:

`v_ceo_user_id uuid := '00000000-0000-0000-0000-000000000000';`

변경:

`v_ceo_user_id uuid := '실제-대표-UUID';`

주의:

대표 UUID 이외에는 SQL 내용을 임의로 바꾸지 않는다.

---

# 6. SQL 실행 전 확인

먼저 다음이 이미 존재해야 한다.

- departments
- employees
- projects
- tasks
- results
- reviews
- approvals
- memories

그리고 STEP 12가 정상 실행되어:

- 조직/팀 99개
- 직원 95명
- 초기 대표 기억 3건

이 들어 있어야 한다.

---

# 7. SQL 실행

Supabase:

SQL Editor
→ New query

`13_AUTH_RLS.sql` 전체 복사
→ 붙여넣기
→ 대표 UUID 수정
→ Run

정상적으로 끝나면 마지막 Verification 결과가 표시된다.

예상:

- admin_rows = 1
- rls_enabled_tables = 9
- dashboard_view_security_invoker = true에 해당하는 설정 확인

---

# 8. 이번 SQL이 만드는 객체

## public.app_admins

SAWOL OFFICE에 접근할 수 있는 Auth 사용자를 기록한다.

컬럼:

- user_id
- display_name
- is_active
- created_at
- updated_at

v0.1에서는 대표 한 명만 존재한다.

---

# 9. private 스키마

관리자 여부를 확인하는 내부 함수는 `public`에 두지 않는다.

이유:

`public` 스키마는 Supabase Data API에서 노출되는 기본 스키마다.

관리자 권한 판별용 SECURITY DEFINER 함수는 `private` 스키마에 둔다.

함수:

`private.is_sawol_admin()`

이 함수는 현재 요청의 `auth.uid()`가 활성화된 대표인지 확인한다.

---

# 10. SECURITY DEFINER 함수의 보안조건

함수는 다음 조건을 적용한다.

- `security definer`
- `stable`
- `set search_path = ''`
- 내부 테이블명은 `public.app_admins`처럼 스키마를 명시
- `public`과 `anon`에서 실행 권한 제거
- `authenticated`에게만 실행 권한 부여

이렇게 해야 검색경로 조작과 불필요한 외부 호출 위험을 줄일 수 있다.

---

# 11. app_admins 자체의 RLS

`app_admins`에도 RLS를 켠다.

대표는 자신의 관리자 행만 읽을 수 있다.

앱 화면에서는 다른 관리자를 만들거나 수정하지 않는다.

관리자 추가/삭제는 v0.1에서 Supabase Dashboard 또는 검증된 SQL을 통해서만 수행한다.

이렇게 하면 대표 계정을 탈취하지 않는 한 앱에서 관리자 목록을 임의 변경하기 어렵다.

---

# 12. 기존 8개 핵심 테이블 RLS

다음 테이블 모두 RLS가 활성화된 상태를 유지한다.

- departments
- employees
- projects
- tasks
- results
- reviews
- approvals
- memories

각 테이블에 다음 4가지 정책을 각각 만든다.

- SELECT
- INSERT
- UPDATE
- DELETE

`FOR ALL` 하나로 뭉치지 않는다.

모든 정책은:

`to authenticated`

그리고:

`(select private.is_sawol_admin())`

조건을 사용한다.

---

# 13. 왜 정책을 4개씩 나누는가

읽기, 생성, 수정, 삭제는 위험도가 다르다.

정책을 나누면 나중에 예를 들어:

- 직원 정보는 읽기만 허용
- 기억 삭제는 금지
- 프로젝트는 수정 가능
- 관리자 설정은 서버에서만 가능

같은 세부 보안정책으로 확장하기 쉽다.

---

# 14. anon 권한

비로그인 사용자인 `anon`에게 회사 테이블 권한을 주지 않는다.

SQL에서 핵심 테이블에 대해 `anon` 권한을 명시적으로 제거한다.

---

# 15. authenticated 권한

RLS 정책은 권한 자체를 생성하는 것이 아니다.

따라서 `authenticated` 역할에 필요한 SQL 권한을 명시적으로 부여한다.

핵심 테이블:

SELECT / INSERT / UPDATE / DELETE

단, 실제 접근은 RLS 정책을 통과한 대표만 가능하다.

즉:

SQL 권한
+
RLS 정책

두 단계가 모두 통과되어야 한다.

---

# 16. 대표실 View 보안 문제

STEP 9에서 만든:

`public.v_ceo_dashboard_summary`

는 단순 View로 만들어졌다.

PostgreSQL View는 설정에 따라 underlying table RLS와 다른 방식으로 동작할 수 있기 때문에 이번 단계에서 다시 생성한다.

새 View에는:

`security_invoker = true`

를 적용한다.

이렇게 하면 View를 조회하는 현재 사용자의 권한과 underlying table RLS를 따르도록 한다.

---

# 17. View 권한

`v_ceo_dashboard_summary`는:

- anon 접근 제거
- authenticated SELECT 허용

으로 설정한다.

하지만 underlying table RLS 때문에 대표가 아닌 authenticated 사용자는 실제 회사 데이터를 볼 수 없다.

---

# 18. Service Role Key

다음 키는 브라우저 코드에서 절대 사용하지 않는다.

`SUPABASE_SERVICE_ROLE_KEY`

Service Role은 RLS를 우회할 수 있으므로:

- `NEXT_PUBLIC_` 접두사 금지
- React Client Component 금지
- GitHub 커밋 금지
- docs 기록 금지

현재 단계에서는 Service Role이 필요하지 않다.

---

# 19. Publishable Key

현재 `.env.local`의:

`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

는 브라우저용 공개 키다.

이 키 자체가 DB 전체 권한을 주는 것이 아니다.

실제 데이터 보안은:

- Supabase Auth
- RLS
- DB 권한

으로 보호한다.

---

# 20. 로그인 UI

현재 with-supabase 템플릿에 인증 예제가 있을 수 있다.

STEP 13에서는 우선 다음 동작만 확인한다.

1. 대표 이메일과 비밀번호로 로그인
2. 로그인 성공 시 세션 생성
3. 내부 페이지에서 `getUser()` 또는 검증된 서버측 Auth 정보 확인
4. 로그아웃 가능

SAWOL OFFICE 전용 디자인 로그인 화면은 이후 UI 구현 단계에서 변경한다.

---

# 21. 회원가입 버튼

v0.1 사이트에는 회원가입 버튼을 노출하지 않는다.

템플릿에 Sign up 링크가 있다면 향후 SAWOL OFFICE 로그인 화면을 만들면서 제거한다.

단순히 버튼만 숨기는 것은 보안대책이 아니다.

Supabase Auth 자체의 신규 가입 설정도 함께 비활성화해야 한다.

---

# 22. Supabase 신규 가입 차단

대표 계정을 만든 이후 Supabase Authentication 설정에서 신규 가입을 비활성화한다.

Dashboard UI 버전에 따라 메뉴명은 달라질 수 있다.

찾아야 할 의미:

- 신규 사용자 가입 허용
- Email signups
- Enable sign ups
- Allow new users

정확한 현재 메뉴는 Supabase Dashboard의 Auth 설정을 보고 확인한다.

---

# 23. 페이지 보호

v0.1 내부 페이지:

- /dashboard
- /command
- /projects
- /tasks
- /employees
- /approvals
- /results
- /memory
- /system
- /settings

로그인하지 않은 사용자는 `/login`으로 보내야 한다.

이 페이지 보호 로직은 Next.js 서버 인증 구조와 함께 적용한다.

---

# 24. 중요한 원칙: 미들웨어만 믿지 않는다

페이지 redirect만으로 데이터 보안을 구현하지 않는다.

왜냐하면 화면 접근을 막더라도 API나 Supabase Data API를 직접 호출할 수 있기 때문이다.

실제 최종 방어선은 RLS다.

따라서:

UI 접근 제한
+
서버 인증 확인
+
Supabase RLS

3중 구조로 생각한다.

---

# 25. 대표 로그인 후 DB 테스트

로그인 완료 후 사이트에서 다음을 테스트한다.

### 직원 조회
employees 데이터가 읽혀야 한다.

예상:

95명

### 부서 조회
departments 데이터가 읽혀야 한다.

예상:

99개

### 기억 조회
memories 최소 3건이 읽혀야 한다.

---

# 26. 비로그인 테스트

로그아웃 후 동일 데이터를 요청하면:

- 빈 결과
- 권한 오류
- 로그인 화면 이동

중 하나가 나타나야 한다.

회사 데이터가 그대로 보이면 보안 설정 실패다.

---

# 27. 대표가 아닌 사용자 테스트

가능하면 개발 후 별도 테스트 계정을 만들어 RLS를 확인할 수 있다.

단 테스트 후 해당 계정은 제거한다.

대표가 아닌 authenticated 사용자는:

- departments 조회 불가
- employees 조회 불가
- projects 조회 불가
- memories 조회 불가

여야 한다.

---

# 28. app_admins 변경 주의사항

대표 계정 UUID를 잘못 넣은 경우 앱에서 데이터가 하나도 보이지 않을 수 있다.

이 경우 RLS를 끄지 않는다.

대신:

Authentication → Users

대표 User UUID 확인

↓

app_admins의 user_id 확인

↓

잘못된 UUID를 수정한다.

---

# 29. 대표 계정 변경

나중에 로그인 이메일을 바꾸더라도 같은 Supabase Auth User UUID를 유지하면 app_admins 수정이 필요하지 않을 수 있다.

새로운 Auth User를 완전히 생성했다면 새로운 UUID를 app_admins에 등록해야 한다.

---

# 30. 계정 분실 시

대표 로그인 계정을 잃어버렸다고 해서 RLS를 삭제하지 않는다.

Supabase Auth의 계정 복구 기능 또는 Dashboard 관리자 기능으로 계정을 복구한다.

---

# 31. RLS 문제 발생 시 금지사항

문제가 발생했다고 다음 행동을 하지 않는다.

- RLS 전체 비활성화
- `using (true)`로 임시 전체 공개 후 방치
- anon에게 전체 권한 부여
- Service Role Key를 브라우저에 넣기
- SQL에 대표 비밀번호 입력
- GitHub에 비밀키 업로드

문제가 생기면 정책과 Auth 상태를 각각 점검한다.

---

# 32. SQL 재실행

`13_AUTH_RLS.sql`은 가능한 한 재실행 가능한 구조로 작성한다.

기존 SAWOL OFFICE 정책 이름을 제거한 뒤 다시 생성한다.

대표 UUID는 재실행 시에도 정확한 값을 유지해야 한다.

---

# 33. STEP 13 완료 확인표

아래를 모두 만족하면 완료다.

- [ ] 대표 Auth 계정 존재
- [ ] 대표 User UUID 확인
- [ ] `13_AUTH_RLS.sql`의 UUID 교체
- [ ] SQL 정상 실행
- [ ] app_admins에 대표 1명 등록
- [ ] 8개 핵심 테이블 RLS 활성화
- [ ] 대표 전용 정책 생성
- [ ] dashboard View security_invoker 적용
- [ ] anon 접근 제한
- [ ] 신규 일반 가입 비활성화
- [ ] 대표 로그인 성공
- [ ] 대표 데이터 조회 성공
- [ ] 로그아웃 후 데이터 접근 불가 확인

---

# 34. STEP 13 완료 후 상태

완료 후 SAWOL OFFICE는:

GitHub / Codespaces
→ 코드와 설계

Supabase Auth
→ 대표 신원 확인

Supabase RLS
→ 대표 데이터 접근 통제

Supabase Database
→ 회사 운영 데이터

구조가 된다.

이후 단계부터 대표실과 실제 SAWOL OFFICE UI를 데이터와 연결한다.
