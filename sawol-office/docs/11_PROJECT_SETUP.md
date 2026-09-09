# SAWOL OFFICE — PROJECT SETUP

## 1. STEP 11 목적

SAWOL OFFICE v0.1을 실제로 개발하기 위한 개발환경과 외부 서비스를 처음 연결한다.

이번 단계에서 목표로 하는 것은 다음이다.

1. 로컬 개발환경 준비
2. Next.js 프로젝트 생성
3. Supabase 프로젝트 생성
4. 환경변수 연결
5. Supabase Auth 기본 연결
6. STEP 9 SQL 준비
7. GitHub 저장소 연결
8. Vercel 프로젝트 연결
9. 기본 사이트 실행 확인
10. 이후 SAWOL OFFICE 화면 개발을 시작할 수 있는 상태 만들기

이번 STEP에서는 아직 다음을 하지 않는다.

- Discord 실제 연동
- Notion 실제 연동
- GitHub 자동 PR Agent
- AI 직원 자동실행
- OpenAI / Claude / Gemini API 연결
- 픽셀 오피스
- 자동 회의

먼저 사이트와 DB 기반을 정상적으로 세팅한다.

---

# 2. 추천 진행 방식

SAWOL OFFICE는 처음부터 모든 것을 직접 설정하기보다 Supabase의 Next.js 공식 템플릿을 이용하는 것을 우선 추천한다.

권장 시작 명령:

```bash
npx create-next-app -e with-supabase
```

이 템플릿은 Next.js, TypeScript, Tailwind CSS, Supabase의 쿠키 기반 인증 구성을 시작점으로 제공한다.

SAWOL OFFICE에서 필요한 구조와 가장 가깝고 초기 설정 오류를 줄일 수 있다.

---

# 3. 필요한 계정

초기에는 다음 무료 계정이면 충분하다.

## 필수

### GitHub
코드 저장 및 버전관리.

### Supabase
DB 및 로그인.

### Vercel
사이트 배포.

## 이미 사용 중이면 그대로 사용

새 계정을 만들 필요 없다.

---

# 4. PC에 필요한 프로그램

## Node.js

Next.js 실행에 필요하다.

설치되어 있는지 확인:

```bash
node -v
```

버전이 표시되면 설치되어 있다.

---

## npm

확인:

```bash
npm -v
```

Node.js 설치 시 일반적으로 함께 설치된다.

---

## Git

확인:

```bash
git --version
```

---

## 코드 편집기

추천:

Visual Studio Code

Claude Code를 나중에 사용할 경우에도 이 프로젝트 폴더를 그대로 사용할 수 있다.

---

# 5. 프로젝트를 저장할 폴더

예:

```text
C:\SAWOL_OFFICE
```

또는

```text
C:\Projects\SAWOL_OFFICE
```

한글 폴더명보다 영문 폴더명을 권장한다.

---

# 6. Next.js 프로젝트 생성

터미널에서 프로젝트를 만들 위치로 이동한다.

예:

```bash
cd C:\Projects
```

다음 명령 실행:

```bash
npx create-next-app -e with-supabase sawol-office
```

생성이 끝나면:

```bash
cd sawol-office
```

---

# 7. 프로젝트 실행 확인

실행:

```bash
npm run dev
```

브라우저에서:

```text
http://localhost:3000
```

접속한다.

사이트가 정상적으로 표시되면 Next.js 기본 설치 성공.

---

# 8. 프로젝트 기본 구조 확인

초기 생성 후 구조가 STEP 10과 완전히 동일하지 않아도 된다.

중요한 것은 App Router 기반 프로젝트라는 점이다.

향후 SAWOL OFFICE에서는 다음 구조로 정리한다.

```text
src/
  app/
  components/
  lib/
```

템플릿이 `src` 폴더를 사용하지 않는 경우에도 기능상 문제는 없다.

개발 시작 전에 우리가 구조를 한 번 정리한다.

---

# 9. Supabase 프로젝트 생성

Supabase에 로그인한다.

새 프로젝트를 생성한다.

추천 프로젝트명:

```text
sawol-office
```

Database Password는 안전하게 별도 보관한다.

일반 프로젝트 문서나 GitHub에 기록하지 않는다.

---

# 10. Supabase 연결정보 확인

Supabase 프로젝트의 Connect/API 관련 화면에서 다음 값을 확인한다.

필요한 값:

```text
Project URL
Publishable Key
```

환경변수에서는 다음 이름을 사용한다.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

과거 문서나 예제에서 `ANON_KEY`라는 이름을 볼 수 있지만 SAWOL OFFICE 신규 구축은 현재 Supabase 문서의 Publishable Key 기준으로 시작한다.

---

# 11. .env.local 설정

프로젝트 루트에:

```text
.env.local
```

파일을 사용한다.

예:

```env
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

주의:

실제 값을 회사 설계문서에 기록하지 않는다.

---

# 12. 환경변수 보안

다음 값은 GitHub에 올리지 않는다.

- Supabase Service Role Key
- OpenAI API Key
- Claude/Anthropic API Key
- Gemini API Key
- Notion Secret
- Discord Webhook URL
- GitHub Token
- Google OAuth Secret

`.env.local`은 Git 추적 대상이 되지 않도록 유지한다.

---

# 13. Supabase Client 구조

Supabase 공식 SSR 방식에 따라 브라우저용 Client와 서버용 Client를 분리한다.

기본 구조:

```text
lib/
  supabase/
    client.ts
    server.ts
```

브라우저 코드:

`createBrowserClient`

서버 코드:

`createServerClient`

을 사용한다.

with-supabase 템플릿을 사용할 경우 관련 설정이 이미 포함되어 있을 수 있으므로 중복 생성하지 않고 먼저 기존 파일을 확인한다.

---

# 14. 로그인 방식

STEP 10에서 결정한 대로 v0.1은 대표 1명만 사용한다.

초기 인증:

```text
이메일 + 비밀번호
```

목표:

로그인 성공
→ `/dashboard`

로그인하지 않음
→ `/login`

---

# 15. 대표 계정 생성

초기에는 대표 계정 한 개만 만든다.

다중 사용자 기능은 만들지 않는다.

회원가입 페이지가 템플릿에 포함되어 있더라도 실제 SAWOL OFFICE에서는 향후 외부 사용자가 임의 가입하지 못하도록 제한할 예정이다.

v0.1 개발 중에는 개발 편의를 위해 테스트 후 가입 기능을 제거하거나 비활성화한다.

---

# 16. STEP 9 SQL 적용 전 확인

파일:

```text
09_SUPABASE_SQL.sql
```

이 파일에는 다음 테이블이 들어 있다.

- departments
- employees
- projects
- tasks
- results
- reviews
- approvals
- memories

그리고:

- Foreign Key
- Index
- updated_at Trigger
- RLS 활성화
- 대표실 요약 View

가 포함되어 있다.

---

# 17. SQL 실행 시점

Supabase 프로젝트와 로그인 연결을 먼저 확인한 후 SQL Editor에서 실행한다.

중요:

STEP 9 SQL은 RLS를 활성화하지만 일반 사용자 접근 Policy를 아직 생성하지 않는다.

따라서 SQL 실행 직후 브라우저에서 Table 데이터를 읽으려고 하면 권한 문제로 조회되지 않을 수 있다.

이것은 오류가 아니라 의도된 상태다.

실제 대표 계정용 RLS Policy는 다음 개발 단계에서 추가한다.

---

# 18. SQL 실행 전 백업 원칙

신규 Supabase 프로젝트에서 실행한다.

이미 다른 서비스가 사용 중인 운영 DB에 실행하지 않는다.

SAWOL OFFICE 전용 프로젝트를 사용한다.

---

# 19. GitHub 저장소 생성

GitHub에서 새 Repository를 만든다.

추천 이름:

```text
sawol-office
```

추천 Visibility:

```text
Private
```

개인 AI 회사 프로젝트이므로 초기에는 비공개를 권장한다.

---

# 20. GitHub 저장소 생성 방식

로컬에서 Next.js 프로젝트를 먼저 만든 경우 GitHub Repository 생성 시 README, .gitignore, License를 미리 추가하지 않는 방식이 가장 단순하다.

이미 로컬 프로젝트에 Git 설정과 파일이 존재할 수 있기 때문이다.

---

# 21. Git 상태 확인

프로젝트 폴더에서:

```bash
git status
```

정상적으로 Git Repository가 잡혀 있는지 확인한다.

---

# 22. 첫 Commit

예:

```bash
git add .
git commit -m "chore: initialize SAWOL OFFICE"
```

---

# 23. GitHub 연결

GitHub에서 만든 Repository 주소를 사용한다.

예:

```bash
git remote add origin https://github.com/YOUR_USERNAME/sawol-office.git
git branch -M main
git push -u origin main
```

이미 origin이 존재하면 새로 추가하지 않고 기존 연결을 확인한다.

---

# 24. 브랜치 운영

초기 기준:

```text
main
```

운영 안정화 후:

```text
develop
feature/기능명
```

구조를 사용할 수 있다.

첫 화면 제작 초기에는 지나치게 복잡한 Git Flow를 강제하지 않는다.

---

# 25. Vercel 연결

Vercel에 로그인한다.

다음 순서:

1. Add New Project
2. GitHub Repository 선택
3. sawol-office Import
4. Next.js 자동 감지 확인
5. Environment Variables 입력
6. Deploy

---

# 26. Vercel 환경변수

Vercel 프로젝트에도 다음을 입력한다.

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

로컬 `.env.local` 값과 동일한 Supabase 프로젝트를 사용한다.

---

# 27. 첫 배포 확인

Vercel 배포가 완료되면 기본 URL이 생성된다.

예:

```text
sawol-office.vercel.app
```

실제 생성되는 주소는 프로젝트 상태에 따라 달라질 수 있다.

확인:

- 첫 페이지 열림
- 오류 없음
- 로그인 화면 접근 가능
- 모바일에서도 기본 페이지 열림

---

# 28. 커스텀 도메인

초기에는 구매하지 않는다.

Vercel 기본 주소로 충분하다.

SAWOL OFFICE가 실제로 안정화된 이후 원하는 도메인이 생기면 연결한다.

비용절감 원칙에 따라 초기 불필요한 도메인 구매를 하지 않는다.

---

# 29. 지금 Claude Code가 필요한가?

아직 필수 아님.

현재 단계는 ChatGPT와 함께 충분히 진행 가능하다.

ChatGPT를 이용해:

- 파일 구조 생성
- 코드 작성
- 오류 분석
- SQL 수정
- 화면 제작
- 컴포넌트 작성
- API 작성

을 진행할 수 있다.

Claude Code는 프로젝트 파일 수가 커지고 로컬 Repository 전체를 반복적으로 읽고 수정해야 할 때 추가하는 개발 도구로 본다.

---

# 30. ChatGPT와 개발하는 방식

초기에는 다음 방식으로 진행한다.

1. 현재 프로젝트 ZIP 또는 필요한 파일 제공
2. 수정 요청
3. ChatGPT에서 코드/파일 수정
4. 수정본 다운로드
5. 로컬 프로젝트에 반영
6. 실행 테스트
7. 오류가 있으면 화면 또는 오류 로그 제공
8. 수정 반복

프로젝트가 커지면 GitHub 기반 또는 코드 에이전트 방식으로 확장한다.

---

# 31. STEP 11에서 실제로 대표가 할 일

순서대로 진행한다.

## A
PC에서 Node.js / npm / Git 확인

## B
SAWOL OFFICE Next.js 프로젝트 생성

## C
`npm run dev`로 localhost 확인

## D
Supabase 프로젝트 생성

## E
`.env.local` 연결

## F
Supabase Auth 기본 동작 확인

## G
GitHub Private Repository 생성

## H
로컬 프로젝트 GitHub에 Push

## I
Vercel Import 및 환경변수 연결

## J
Vercel 기본 배포 확인

여기까지 완료되면 실제 화면 개발로 넘어간다.

---

# 32. 아직 하지 않는 것

다음은 지금 설정하지 않는다.

- Discord Bot
- Discord Webhook
- Notion Integration
- Google Drive API
- Gmail API
- Calendar API
- OpenAI API
- Anthropic API
- Gemini API
- n8n
- Make
- 결제서비스
- 커스텀 도메인

필요한 단계가 왔을 때 하나씩 추가한다.

---

# 33. 첫 실제 개발 화면

STEP 11 세팅이 끝나면 가장 먼저 다음 화면을 만든다.

```text
/login
```

그 다음:

```text
/dashboard
```

순서로 진행한다.

처음부터 프로젝트/직원/결과함을 모두 만들지 않는다.

---

# 34. 개발 작업 순서

STEP 11 완료 후 실제 개발 순서:

1. 로그인
2. 공통 Office Layout
3. Sidebar
4. Header
5. 대표실 Dashboard
6. DB 조회
7. 직원 목록
8. 프로젝트
9. 업무지시
10. 승인함
11. 결과함
12. 기억센터

---

# 35. 개발 중 기존 설계 보호

STEP 1~10의 기존 문서는 개발 편의를 이유로 임의 변경하지 않는다.

구현 과정에서 구조 변경이 필요하면 다음 순서로 한다.

1. 문제 기록
2. 변경안 작성
3. 기존 설계와 비교
4. 대표 확인
5. 새 버전 문서 작성
6. 코드 반영

기존 문서는 삭제하지 않는다.

---

# 36. 프로젝트 문서 보관

현재 설계문서는 Repository 안에 별도 폴더로 보관하는 것을 권장한다.

예:

```text
docs/
  01_COMPANY_MASTER.md
  02_ORGANIZATION.md
  03_EMPLOYEES.md
  04_WORKFLOW.md
  05_MEMORY_RULES.md
  06_DATA_STRUCTURE.md
  07_UI_UX_STRUCTURE.md
  08_DATABASE_SCHEMA.md
  09_SUPABASE_SQL.sql
  10_APP_ARCHITECTURE.md
  11_PROJECT_SETUP.md
```

이렇게 하면 향후 ChatGPT, Claude Code 또는 다른 개발 Agent가 동일한 기준문서를 읽을 수 있다.

---

# 37. AI 개발 Agent용 최상위 규칙

향후 코드 Agent를 연결하면 가장 먼저 다음 내용을 전달한다.

```text
/docs의 SAWOL OFFICE 설계문서를 우선 확인한다.

기존 설계를 임의로 삭제하거나 변경하지 않는다.

구조 변경이 필요하면 변경 이유와 영향을 먼저 보고한다.

API Key와 Secret은 코드에 직접 작성하지 않는다.

원본 파일을 임의 삭제하지 않는다.
```

---

# 38. 비용 기준

STEP 11까지 목표 비용:

```text
0원
```

초기에는:

- GitHub 무료
- Supabase 무료 플랜
- Vercel 무료 플랜
- 현재 사용 중인 ChatGPT

을 활용한다.

유료 서비스는 아직 추가하지 않는다.

---

# 39. STEP 11 완료 체크리스트

- [ ] Node.js 정상
- [ ] npm 정상
- [ ] Git 정상
- [ ] sawol-office 프로젝트 생성
- [ ] localhost 실행 성공
- [ ] Supabase 프로젝트 생성
- [ ] `.env.local` 설정
- [ ] Supabase 연결 확인
- [ ] 대표 로그인 테스트
- [ ] GitHub Private Repository 생성
- [ ] 첫 Push 성공
- [ ] Vercel 연결
- [ ] Vercel 환경변수 설정
- [ ] 첫 배포 성공
- [ ] STEP 1~11 문서 docs 폴더에 보관

---

# 40. STEP 11 완료 후 다음 단계

다음은 실제 개발 단계다.

우선순위:

```text
로그인
↓
Office Layout
↓
대표실 Dashboard
↓
Supabase 실제 데이터 표시
```

이 첫 사이클이 정상 동작하면 나머지 메뉴를 순차적으로 추가한다.

SAWOL OFFICE는 처음부터 완성된 회사를 만드는 것이 아니라 작동하는 작은 회사를 먼저 만든 뒤 계속 확장한다.
