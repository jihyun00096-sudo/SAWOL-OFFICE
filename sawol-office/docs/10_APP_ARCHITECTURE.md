# SAWOL OFFICE — APP ARCHITECTURE

## 1. STEP 10 목적

SAWOL OFFICE v0.1을 실제 웹사이트로 구현하기 위한 애플리케이션 구조를 정의한다.

이 단계에서는 지금까지 확정된 STEP 1~9의 내용을 변경하지 않는다.

STEP 10은 다음을 결정한다.

- 개발 기술 스택
- 프로젝트 폴더 구조
- 로그인 방식
- 대표 전용 접근 구조
- 주요 화면 구성
- Supabase 연결 방식
- 서버/클라이언트 역할
- 향후 AI Agent 연결 위치
- 외부 서비스 연동 확장 위치
- v0.1 구현 범위

---

# 2. 개발 기술 스택

## 기본 프레임워크

Next.js

목적:
- 페이지 라우팅
- 서버 기능
- API Route
- React 기반 UI
- Vercel 배포

권장:
Next.js App Router 구조

---

## 언어

TypeScript

이유:
- 직원, 프로젝트, Task, 결과물 등 데이터 구조가 복잡하므로 타입 안정성이 중요함
- 향후 기능 확장 시 오류를 줄이기 위함

---

## UI

React

CSS 방식:
Tailwind CSS 우선

이유:
- 빠른 화면 제작
- 반응형 대응
- 컴포넌트 재사용
- 유지보수 용이

---

## 데이터베이스

Supabase

사용 범위:
- PostgreSQL
- Auth
- Database
- 향후 Storage
- 향후 Realtime

---

## 배포

Vercel

초기 목적:
- 개인용
- 무료 플랜 우선
- GitHub 연동 배포

---

## 코드 저장

GitHub

기본 브랜치:

main

개발 브랜치:

develop

기능별:

feature/기능명

---

# 3. v0.1 개발 목표

초기 버전에서 다음 기능만 실제로 작동하게 만든다.

1. 로그인
2. 대표실
3. 업무지시
4. 프로젝트
5. 직원
6. 승인함
7. 결과함
8. 기억센터

중요:

초기 버전에서는 AI 직원 95명이 실제 API로 자동 실행되지 않아도 된다.

먼저 회사 운영 UI와 데이터 흐름이 정상 작동하도록 구현한다.

---

# 4. 초기 사용자

v0.1은 대표 1명만 사용하는 개인 시스템으로 만든다.

다중 사용자 기능은 만들지 않는다.

따라서 초기 권한은 다음과 같다.

대표
→ 모든 데이터 조회 가능
→ 모든 내부 데이터 생성 가능
→ 승인/수정/보류/폐기 가능

외부 사용자는 접근할 수 없다.

---

# 5. 로그인

Supabase Auth를 사용한다.

초기 방식:

이메일 + 비밀번호

로그인 성공:

/dashboard

로그인 실패:

오류 표시

로그아웃:

/login

---

# 6. 접근 제한

로그인하지 않은 사용자는 SAWOL OFFICE 내부 페이지에 접근하지 못한다.

보호 대상:

/dashboard
/tasks
/projects
/employees
/approvals
/results
/memory
/settings

로그인하지 않은 경우:

/login

으로 이동한다.

---

# 7. 향후 로그인 확장

향후 필요 시 추가 가능:

- Google 로그인
- Passkey
- 2단계 인증

초기에는 구현하지 않는다.

---

# 8. 전체 라우트

## 공개

/login

---

## 내부

/dashboard

대표실

---

/command

업무지시

---

/projects

프로젝트 목록

---

/projects/[id]

프로젝트 상세

---

/tasks

전체 업무

---

/employees

직원 목록

---

/employees/[id]

직원 상세

---

/approvals

대표 승인함

---

/results

결과함

---

/results/[id]

결과물 상세

---

/memory

기억센터

---

/system

시스템 상태

v0.2 이후 사용

---

/settings

설정

---

# 9. App Router 폴더 구조

권장 구조:

src/
  app/
    login/
      page.tsx

    (office)/
      layout.tsx

      dashboard/
        page.tsx

      command/
        page.tsx

      projects/
        page.tsx
        [id]/
          page.tsx

      tasks/
        page.tsx

      employees/
        page.tsx
        [id]/
          page.tsx

      approvals/
        page.tsx

      results/
        page.tsx
        [id]/
          page.tsx

      memory/
        page.tsx

      system/
        page.tsx

      settings/
        page.tsx

    api/
      command/
        route.ts

      projects/
        route.ts

      tasks/
        route.ts

      approvals/
        route.ts

---

# 10. 공통 컴포넌트 구조

src/components/

layout/
  Sidebar.tsx
  Header.tsx
  OfficeShell.tsx
  RightAssistantPanel.tsx

dashboard/
  SummaryCard.tsx
  SecretaryBriefing.tsx
  ApprovalPreview.tsx
  ProjectProgressCard.tsx
  RecentResults.tsx

projects/
  ProjectCard.tsx
  ProjectStatusBadge.tsx
  ProjectProgress.tsx
  ProjectTaskBoard.tsx

tasks/
  TaskCard.tsx
  TaskStatusBadge.tsx
  TaskDetailPanel.tsx

employees/
  EmployeeCard.tsx
  EmployeeStatusBadge.tsx
  EmployeeProfile.tsx

approvals/
  ApprovalCard.tsx
  ApprovalActionPanel.tsx

results/
  ResultCard.tsx
  ResultViewer.tsx
  ResultVersionList.tsx

memory/
  MemoryCard.tsx
  MemorySearch.tsx
  MemoryFilters.tsx

common/
  EmptyState.tsx
  LoadingState.tsx
  ErrorState.tsx
  ConfirmDialog.tsx
  Badge.tsx
  SearchInput.tsx

---

# 11. 서버 코드 구조

src/lib/

supabase/
  client.ts
  server.ts
  middleware.ts

queries/
  departments.ts
  employees.ts
  projects.ts
  tasks.ts
  results.ts
  reviews.ts
  approvals.ts
  memories.ts

services/
  projectService.ts
  taskService.ts
  approvalService.ts
  memoryService.ts
  commandService.ts

validators/
  project.ts
  task.ts
  approval.ts

types/
  database.ts
  employee.ts
  project.ts
  task.ts
  result.ts
  memory.ts

---

# 12. Supabase Client 분리

브라우저에서 필요한 작업:

client.ts

서버에서 필요한 작업:

server.ts

중요:

Service Role Key는 브라우저 코드에 절대 포함하지 않는다.

---

# 13. 환경변수

.env.local

예상 항목:

NEXT_PUBLIC_SUPABASE_URL

NEXT_PUBLIC_SUPABASE_ANON_KEY

향후:

SUPABASE_SERVICE_ROLE_KEY

NOTION_TOKEN

DISCORD_WEBHOOK_URL

GITHUB_TOKEN

OPENAI_API_KEY

ANTHROPIC_API_KEY

GEMINI_API_KEY

중요:

API Key 값은 GitHub에 업로드하지 않는다.

---

# 14. 대표실 데이터

/dashboard에서 다음 데이터를 불러온다.

- 진행 중 프로젝트 수
- 진행 중 Task 수
- 승인 대기 수
- 자료 대기 수
- 오류 Task 수
- 오늘 완료 Task 수

STEP 9에서 만든:

v_ceo_dashboard_summary

View 활용 가능.

---

# 15. 대표실 UI 순서

상단:

SAWOL OFFICE

오늘의 회사 상황

---

첫 번째 영역:

요약 카드

진행 프로젝트
진행 업무
승인 대기
오류

---

두 번째:

비서실 브리핑

---

세 번째:

대표 확인 필요사항

---

네 번째:

진행 프로젝트

---

다섯 번째:

최근 완료 결과물

---

# 16. 업무지시 페이지

/command

핵심 목적:

대표가 자연어로 업무를 입력한다.

입력 요소:

- 업무 내용
- 첨부파일
- 우선순위
- 업무 유형
- 원하는 결과물
- 담당 부서 선택
- 자동배정 여부

---

# 17. v0.1 업무지시 처리

초기에는 실제 AI Agent 자동실행보다 업무 등록 기능을 우선한다.

대표 입력:

“타로 서비스 경쟁사이트 조사해줘.”

↓

commandService

↓

업무 분석 결과 입력 또는 기본값

↓

Task 생성

또는

Project 생성

---

# 18. 향후 AI 비서 연결 위치

/command API에 향후 AI 비서실 Agent를 연결한다.

향후 구조:

대표 지시

↓

API

↓

윤서진 비서실 Agent

↓

업무 분석

↓

Task / Project JSON 생성

↓

대표 확인

↓

DB 저장

---

# 19. AI Agent 응답 표준 형식

향후 AI Agent는 자유로운 글 대신 구조화된 JSON으로 응답하도록 한다.

예:

{
  "type": "PROJECT",
  "title": "타로 기록 서비스",
  "priority": "NORMAL",
  "departments": [
    "RSCH",
    "PLAN",
    "TARO",
    "CRTV",
    "DEV"
  ],
  "tasks": [
    {
      "title": "경쟁 서비스 조사",
      "employee_code": "RSCH-002"
    }
  ]
}

이를 DB에 저장한다.

---

# 20. 프로젝트 목록

/projects

카드 및 리스트 방식 지원.

초기 필터:

- 전체
- 기획 중
- 진행 중
- 검수 중
- 승인 대기
- 완료
- 보류

---

# 21. 프로젝트 상세

/projects/[id]

탭:

1. 개요
2. Task
3. 결과물
4. 승인
5. 기억
6. 활동기록

v0.1에서는:

개요
Task
결과물
승인

우선 구현.

---

# 22. Task 화면

/tasks

전체 업무를 보여준다.

필터:

- 상태
- 우선순위
- 담당 직원
- 담당 부서
- 프로젝트

보기:

목록

초기에는 목록만 구현하고 칸반은 이후 추가 가능.

---

# 23. 직원 화면

/employees

직원 카드에 표시:

- 이름
- 직책
- 소속
- 직원 코드
- 상태
- 현재 Task
- 전문분야

---

# 24. 직원 상세

/employees/[id]

표시:

- 기본정보
- 전문성
- 업무범위
- 현재 업무
- 최근 결과
- 금지사항
- 사용 도구
- 최근 대표 피드백

---

# 25. 승인함

/approvals

대표가 확인해야 할 업무만 보여준다.

상단 필터:

- 전체
- 결과물
- 비용
- 배포
- 외부 발송
- 데이터 변경
- 보안
- 법률

---

# 26. 승인 액션

대표 선택:

승인

수정 요청

보류

폐기

DB 변경:

approvals.status

연동하여:

tasks.status

또는

results.status

변경.

---

# 27. 수정 요청

대표가 수정 요청 시 입력:

- 수정할 부분
- 유지할 부분
- 변경 금지 부분
- 추가 요청

이 내용은 향후 Task 수정이력으로 남긴다.

초기에는 ceo_comment에 저장하고,
v0.2에서 별도 revision 테이블 추가 가능.

---

# 28. 결과함

/results

필터:

- 문서
- 이미지
- 코드
- 리서치
- 엑셀
- 분석
- 프롬프트
- 웹
- 데이터

표시:

- 제목
- 유형
- 담당 직원
- 프로젝트
- 검수상태
- 버전
- 최종 여부

---

# 29. 결과물 상세

/results/[id]

표시:

- 결과물
- 요약
- 본문
- 파일
- 외부링크
- 버전
- 담당 직원
- 관련 Task
- 검수 결과
- 승인 상태

---

# 30. 기억센터

/memory

필터:

- 대표 기억
- 프로젝트
- 결정
- 전문지식
- 실패
- 프롬프트
- 규칙
- 결과물

---

# 31. 기억 검색

v0.1:

키워드 검색

v0.2 이후:

자연어 검색

Vector Search

---

# 32. 우측 비서 패널

초기 UI에는 패널 디자인만 먼저 만든다.

v0.1:

- 현재 프로젝트 요약
- 현재 페이지 도움
- 승인 대기 요약

AI 실제 대화는 이후 연결한다.

---

# 33. 상태 색상

일관된 상태 표시를 사용한다.

AVAILABLE
대기

WORKING
업무 중

WAITING
대기

REVIEWING
검수 중

APPROVAL_WAIT
대표 승인 대기

BLOCKED
문제 발생

OFFLINE
비활성

색상은 실제 디자인 단계에서 결정한다.

---

# 34. 공통 버튼

주요 액션:

업무 지시

새 프로젝트

결과 보기

승인

수정 요청

보류

폐기

직원 상세

프로젝트 열기

검색

필터

---

# 35. 데이터 수정 원칙

중요 데이터를 수정할 때는 가능하면 확인창을 표시한다.

예:

프로젝트 폐기

“이 프로젝트를 폐기하시겠습니까?”

데이터 자체는 삭제하지 않고 CANCELLED로 변경.

---

# 36. 로딩 상태

모든 데이터 화면에는 로딩 상태를 만든다.

예:

“프로젝트 불러오는 중…”

단순 흰 화면을 보여주지 않는다.

---

# 37. 오류 상태

DB 요청 실패 시:

“데이터를 불러오지 못했습니다.”

[다시 시도]

오류 상세는 필요 시 별도 표시.

---

# 38. 빈 상태

예:

승인 대기 없음

“현재 대표님이 확인할 업무가 없습니다.”

---

# 39. 모바일

모바일에서는 사이드바를 접는다.

하단 또는 햄버거 메뉴 사용 가능.

모바일에서 반드시 가능한 기능:

- 대표실 확인
- 업무지시
- 프로젝트 확인
- 결과 확인
- 승인
- 수정 요청

---

# 40. 디자인 방향

SAWOL OFFICE는 일반 ERP와 게임 UI의 중간 지점을 목표로 한다.

초기:

기능 중심

깔끔한 개인 오피스

정보 가독성 우선

캐릭터성은 직원 이름과 프로필에서 우선 표현

---

# 41. 초기 디자인에서 제외

v0.1에서는 다음을 제외한다.

- 픽셀 직원 이동
- 직원끼리 실시간 대화
- 자동 회의
- 사무실 애니메이션
- 3D 오피스
- 과도한 차트
- 복잡한 시뮬레이션

---

# 42. 프로젝트 파일 관리

이미지나 문서 파일은 초기에는 Supabase Storage 또는 외부 URL 구조를 사용할 수 있다.

초기 추천:

작은 파일:
Supabase Storage

대용량/기존 자료:
Google Drive 연동은 v0.2에서 추가.

---

# 43. 코드 변경 원칙

프로젝트 코드는 GitHub로 관리한다.

큰 기능 수정:

feature branch

↓

검수

↓

대표 승인

↓

main merge

초기에는 수동으로 운영한다.

---

# 44. v0.1 개발 순서

1. Next.js 프로젝트 생성
2. Tailwind 설정
3. Supabase 연결
4. 로그인
5. Office Layout
6. Sidebar
7. 대표실
8. 프로젝트
9. 직원
10. 업무지시
11. 승인함
12. 결과함
13. 기억센터
14. 모바일 대응
15. 기본 QA

---

# 45. v0.1 완료 조건

다음이 가능하면 v0.1 기본 개발 완료로 본다.

- 대표 로그인
- 대표실 확인
- 프로젝트 생성 및 조회
- Task 생성 및 조회
- 직원 확인
- 업무 지시 등록
- 결과물 등록 및 조회
- 검수 기록
- 대표 승인
- 기억 등록 및 검색
- 모바일에서 주요 기능 사용

---

# 46. v0.2 예정

- Discord 연동
- Notion 연동
- GitHub 연동
- Google Drive
- AI 비서실 Agent
- 자동 업무분배
- 직원별 Agent
- 활동로그
- 결정관리
- 실패사례
- 프롬프트 라이브러리

---

# 47. v0.3 예정

- 실제 AI 직원 자동 실행
- 직원 간 자동 인수인계
- 비용 최적화 모델 라우팅
- 자연어 기억 검색
- AI 직원 평가
- 자동 프로젝트 회고
- 픽셀 오피스 UI

---

# 48. STEP 10 최종 원칙

STEP 1~9에서 확정된 회사 구조를 애플리케이션으로 옮기되 기존 규칙을 임의 변경하지 않는다.

STEP 10부터의 개발은 기존 설계를 구현하는 과정으로 취급한다.

새로운 기능이 필요할 경우 기존 문서를 덮어쓰지 않고 버전 또는 확장 문서로 관리한다.
