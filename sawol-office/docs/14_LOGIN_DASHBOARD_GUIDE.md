# SAWOL OFFICE — STEP 14 로그인 + 첫 대표실 화면

## 1. 목적

STEP 14에서는 SAWOL OFFICE의 첫 실제 UI를 만든다.

완료 목표:

- `/` 접속 시 로그인 상태에 따라 자동 이동
- `/login` 대표 전용 로그인
- 대표 여부 확인
- 로그인 성공 후 `/dashboard`
- 대표실 첫 화면
- Supabase 실제 데이터 연동
- 로그아웃
- 모바일/PC 반응형
- Pretendard 통일
- 회원가입 UI 없음

기존 STEP 1~13은 수정하지 않는다.

---

## 2. 디자인 원칙

SAWOL OFFICE 디자인의 기본 기준:

- 복잡하지 않게
- 정보 우선
- 여백 넉넉하게
- 흰색 카드 중심
- 매우 옅은 회색 배경
- 진한 네이비/차콜 텍스트
- 블루 포인트는 필요한 곳에만
- 과도한 그라데이션/그림자/애니메이션 금지
- 모바일에서는 1열
- PC에서는 자연스럽게 확장
- 폰트는 Pretendard로 통일

색상 방향:

- 배경: #F6F7F9
- 카드: #FFFFFF
- 기본 텍스트: #17181C
- 보조 텍스트: #717784
- 테두리: #E7E9EE
- 핵심 포인트: #3157D5
- 위험: #D84A4A

색상은 향후 디자인 시스템 단계에서 변경할 수 있으나
v0.1에서는 단순함을 유지한다.

---

## 3. 이번 ZIP에서 추가/교체하는 파일

### 교체
- `app/layout.tsx`
- `app/page.tsx`

### 추가
- `app/login/page.tsx`
- `app/dashboard/page.tsx`
- `components/sawol/login-form.tsx`
- `components/sawol/logout-button.tsx`
- `lib/auth/require-sawol-admin.ts`

---

## 4. 기존 파일을 삭제하지 않는다

파일을 덮어쓰기 전에 Git으로 현재 상태를 저장하는 것을 권장한다.

Codespaces 터미널:

```bash
git status
git add .
git commit -m "chore: save step 13 baseline"
```

커밋이 실패하면 사용자 이름/이메일 설정이 필요한 경우가 있으므로
그 오류를 먼저 해결한다.

---

## 5. ZIP 적용 방법

ZIP 압축을 풀면 다음 폴더가 나온다.

```text
app/
components/
lib/
docs/
```

이 네 폴더를 `sawol-office` 프로젝트 루트 기준으로 복사한다.

예상 구조:

```text
sawol-office/
├─ app/
│  ├─ dashboard/
│  │  └─ page.tsx
│  ├─ login/
│  │  └─ page.tsx
│  ├─ globals.css
│  ├─ layout.tsx
│  └─ page.tsx
│
├─ components/
│  └─ sawol/
│     ├─ login-form.tsx
│     └─ logout-button.tsx
│
├─ lib/
│  ├─ auth/
│  │  └─ require-sawol-admin.ts
│  └─ supabase/
│     ├─ client.ts       ← 기존 템플릿 유지
│     ├─ server.ts       ← 기존 템플릿 유지
│     └─ proxy.ts        ← 기존 템플릿 유지
│
├─ docs/
│  └─ 14_LOGIN_DASHBOARD_GUIDE.md
│
├─ proxy.ts              ← 기존 템플릿 유지
└─ .env.local
```

---

## 6. 중요 — 기존 Supabase 파일은 덮어쓰지 않는다

다음 파일은 `with-supabase` 템플릿이 이미 관리한다.

- `lib/supabase/client.ts`
- `lib/supabase/server.ts`
- `lib/supabase/proxy.ts`
- 루트 `proxy.ts`

이번 STEP 14 ZIP에는 이 파일들을 넣지 않는다.

현재 Supabase 공식 Next.js SSR 구조는 브라우저용 Client와 서버용 Client를 분리하고
Proxy에서 인증 토큰을 갱신하는 방식을 사용한다.

따라서 템플릿의 현재 구조를 그대로 활용한다.

---

## 7. 로그인 동작

`/login`

대표가:

- 이메일
- 비밀번호

입력

↓

Supabase:

`signInWithPassword()`

↓

로그인 성공

↓

`app_admins`에서 현재 사용자가 활성 대표인지 확인

↓

대표 맞음

`/dashboard`

↓

대표 아님

즉시 로그아웃 후 접근 차단

---

## 8. 회원가입 없음

SAWOL OFFICE v0.1에는 회원가입 버튼을 만들지 않는다.

로그인 화면에는:

- 이메일
- 비밀번호
- 로그인

만 표시한다.

비밀번호 찾기 역시 초기 버전에서는 노출하지 않는다.

필요 시 Supabase Dashboard에서 관리자 방식으로 처리한 뒤
나중에 별도 복구 화면을 추가한다.

---

## 9. 서버측 대표 검증

`lib/auth/require-sawol-admin.ts`

역할:

1. `getClaims()`로 로그인 신원 검증
2. JWT의 `sub`에서 User UUID 확인
3. `app_admins` 조회
4. 활성 대표인지 확인
5. 아니면 `/login` 이동

브라우저 화면을 숨기는 것만으로 보호하지 않는다.

RLS는 STEP 13에서 이미 최종 데이터 방어선으로 설정되어 있다.

---

## 10. 첫 대표실

`/dashboard`

이번 버전에서는 실제 DB에서 다음 값을 읽는다.

- 직원 수
- 조직/팀 수
- 활성 기억 수
- 진행 프로젝트 수
- 진행 업무 수
- 승인 대기
- 오류
- 오늘 완료

STEP 12 데이터가 정상이라면 기본적으로:

직원
95명

조직/팀
99개

대표 기억
3개 이상

가 표시되어야 한다.

프로젝트가 아직 없으므로 나머지는 대부분 0이 정상이다.

---

## 11. 대표실 레이아웃

### PC

상단:
SAWOL OFFICE 로고 / 상태 / 로그아웃

본문:
환영 메시지

↓

핵심 4개 요약카드

↓

비서실 브리핑

↓

업무 메뉴 6개

↓

회사 기반 데이터

### 모바일

모든 카드는 1열 또는 2열로 자동 축소한다.

텍스트 크기를 과도하게 줄이지 않는다.

사이드바는 STEP 15에서 만든다.

이번에는 상단 헤더 중심으로 시작한다.

---

## 12. Pretendard

폰트 파일 자체를 저장소에 넣지 않는다.

공식 Pretendard 프로젝트가 제공하는 CDN의 Variable Dynamic Subset을 사용한다.

Root Layout에 stylesheet를 연결하고 Body font-family를 Pretendard로 통일한다.

---

## 13. 실행

프로젝트 루트:

```bash
npm run dev
```

Codespaces:

Ports
→ 3000
→ 전달된 주소 열기

---

## 14. 테스트 순서

### A. 로그인하지 않은 상태

사이트 `/`

예상:

`/login`으로 이동

---

### B. 잘못된 비밀번호

예상:

로그인 실패 메시지

DB 내용은 노출되지 않음

---

### C. 대표 계정

정상 로그인

↓

`/dashboard`

---

### D. 대표실 수치

예상:

직원 95
조직/팀 99
기억 3+

---

### E. 새로고침

로그인 세션 유지

---

### F. 로그아웃

로그인 화면 이동

그 후 `/dashboard` 직접 입력

↓

로그인 화면으로 이동

---

## 15. 만약 로그인 후 다시 로그인 화면으로 돌아오는 경우

확인:

1. `.env.local`의 URL
2. Publishable Key
3. 대표 Auth User UUID
4. `app_admins.user_id`
5. `app_admins.is_active = true`
6. STEP 13 RLS 정상 여부
7. `lib/supabase/proxy.ts` 존재 여부

RLS를 끄지 않는다.

---

## 16. 대표실에서 0명으로 표시되는 경우

대표 인증은 성공했지만 RLS 또는 DB 조회가 실패했을 수 있다.

Supabase에서:

```sql
select count(*) from public.employees;
select count(*) from public.departments;
select count(*) from public.memories;
```

Dashboard SQL Editor에서 실제 데이터 존재 여부 확인.

직원은 95명, 부서/팀은 99개가 기준이다.

---

## 17. 보안

절대 하지 않는 것:

- Service Role Key를 `NEXT_PUBLIC_`에 넣기
- 로그인 비밀번호 코드에 적기
- RLS 끄기
- 대표 UID를 UI에 표시하기
- 로그에 비밀번호 출력하기
- 회원가입 버튼 추가하기

---

## 18. STEP 14 완료 기준

- [ ] Pretendard 적용
- [ ] PC 로그인 화면 정상
- [ ] 모바일 로그인 화면 정상
- [ ] 대표 로그인 성공
- [ ] 비대표 차단
- [ ] Dashboard 이동
- [ ] 직원 95 표시
- [ ] 조직/팀 99 표시
- [ ] 대표 기억 표시
- [ ] 로그아웃 정상
- [ ] 새로고침 후 세션 정상
- [ ] 직접 `/dashboard` 접근 보호

완료 후 STEP 15에서 실제 SAWOL OFFICE 공통 레이아웃과
사이드바, 프로젝트, 직원 화면을 구축한다.
