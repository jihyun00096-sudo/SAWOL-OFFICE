# STEP 19 — 실행 세션과 결과 기록

## 목적

STEP 18은 상태 머신이었다.
STEP 19는 "실제로 일이 수행되었다"는 기록을 남기는 기반이다.

업무(Task)와 실행(Run)을 분리한다.

하나의 업무는 여러 번 실행될 수 있다.
예:
- 1차 조사
- 오류 후 재실행
- 수정본 재실행

그래서 결과를 tasks 컬럼에 직접 덮어쓰지 않고
task_runs 테이블에 실행별로 기록한다.

## 흐름

### 1. 실행 세션 시작
업무 상세 → 실행 세션 시작

생성:
task_runs.status = RUNNING

업무가 WAITING이면:
tasks.status = IN_PROGRESS

### 2. 결과 제출
실행 세션 상세에서:
- 결과 제목
- 요약
- 결과 본문

저장 후:
task_runs.status = SUBMITTED
tasks.status = REVIEW

### 3. 검수
STEP 18의 실행 상태 카드에서 이후 흐름 진행:
REVIEW → PENDING_APPROVAL → COMPLETED
또는
REVIEW → COMPLETED

## 왜 아직 실제 AI를 연결하지 않는가

외부 AI를 먼저 연결하면
결과를 어디에 저장하고,
재실행을 어떻게 구분하고,
실패를 어떻게 기록할지 정해지지 않은 상태에서
비용과 오류만 늘어난다.

STEP 19에서 실행 계약을 먼저 확정한다.

## STEP20

다음 STEP에서 task_runs.status=RUNNING인 실행 세션을
실제 AI Provider가 처리하도록 연결할 수 있다.

예상 구조:
SAWOL Worker
→ 업무/기억/프로젝트 Context 구성
→ AI Provider 실행
→ task_runs.result_body 저장
→ SUBMITTED
→ REVIEW
