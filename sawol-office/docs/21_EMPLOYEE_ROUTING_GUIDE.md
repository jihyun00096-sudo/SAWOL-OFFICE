# STEP 21 — AI 직원 자동 배정 / 업무분배 엔진

## 1. 왜 이 단계가 필요한가

STEP 20까지는 실제 실행 결과를 만들고 승인 후 결과함·기억센터로 보내는 흐름은 완성되었습니다.

하지만 업무의 `assigned_employee_id`는 대부분 사람이 직접 지정하거나 미배정 상태였습니다.

STEP 21에서는 SAWOL OFFICE에 이미 등록된 약 95명의 AI 직원 프로필을 실제 업무분배에 사용합니다.

---

## 2. 추천 기준

직원 추천 점수는 다음을 함께 봅니다.

- 업무 유형 적합도
- 업무 제목/설명과 직원 전문분야의 키워드 일치
- 직원 직책
- 직원 책임범위
- 추천 부서와 직원 소속부서 관계
- 현재 직원 상태
- 현재 미완료 업무량

점수는 절대적인 능력 수치가 아니라 `현재 업무에 대한 배정 적합도`입니다.

---

## 3. 부서 관계

업무가 `크리에이티브본부`처럼 상위 부서에 배정되어 있어도
그 아래 `상세페이지팀` 직원은 같은 조직 계통으로 인정합니다.

따라서 상위 본부를 선택했다고 해서 하위 팀 직원이 제외되지 않습니다.

---

## 4. 배정 이력

신규 테이블:

`task_assignments`

주요 필드:

- task_id
- employee_id
- department_id
- assignment_source
- assignment_reason
- match_score
- status
- assigned_at
- released_at
- metadata

한 Task에는 동시에 ACTIVE 배정이 1건만 존재할 수 있습니다.

---

## 5. 직원 상태 자동 동기화

Task 상태에 따라 직원 상태를 자동 갱신합니다.

- WAITING → WAITING
- IN_PROGRESS / COLLABORATING → WORKING
- REVIEW → REVIEWING
- PENDING_APPROVAL → APPROVAL_WAIT
- ERROR → BLOCKED
- 담당 활성 업무 없음 → AVAILABLE

직원이 여러 업무를 가지고 있으면 가장 중요한 활성 업무를 current_task_id로 잡습니다.

---

## 6. 대표가 최종 결정권을 가짐

추천 직원은 자동 확정이 아닙니다.

업무지시 화면:
- 비서실 추천값 확인
- 직원 직접 변경 가능

업무 상세:
- 추천 직원 TOP 5
- 추천 직원 배정
- 다른 후보 배정
- 미배정으로 변경

대표가 원하지 않는 자동 배정은 발생하지 않습니다.

---

## 7. STEP 21 완료 테스트

### A. 업무지시
1. 업무지시 진입
2. `신통기획 강의 상세페이지 구성안 초안 작성`
3. 상세 설명 입력
4. 비서실장 분석
5. 추천 부서 + 추천 직원이 자동 표시
6. 대표가 수정 가능
7. 업무 등록

### B. 업무 상세
1. 생성 업무 진입
2. `AI 직원 배정` 카드 확인
3. 추천 TOP 5 확인
4. 추천 직원 배정
5. 페이지 새로고침 후 담당 직원 유지

### C. 직원 상태
1. 직원 상세 진입
2. 현재 담당 업무 표시
3. 업무 `작업 시작`
4. 직원 상태 `업무 중`
5. 검수 대기 → 직원 상태 `검수 중`
6. 대표 승인 대기 → `대표 승인 대기`
7. 업무 완료 → 다른 활성 업무가 없으면 `업무 대기`

### D. 배정 변경
1. 다른 직원 배정
2. 기존 task_assignments ACTIVE → RELEASED
3. 신규 직원 ACTIVE 배정 생성
4. 기존 직원 current_task 재계산

### E. 미배정
1. 업무 상세에서 미배정
2. tasks.assigned_employee_id = null
3. 기존 ACTIVE assignment → RELEASED
4. 직원 current_task/status 정상 재계산

---

## 8. STEP22 준비

STEP21이 끝나면 다음 단계에서 다음을 붙이기 쉬워집니다.

- 업무 자동 분해
- 여러 직원 협업
- 순차 인수인계
- 전문 검수자 자동 추천
- 직원별 실제 AI Prompt/Provider 정책
