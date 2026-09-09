# SAWOL OFFICE STEP 22 — AI 직원 협업 워크플로

## 목표
대표 업무 1건을 2~8개의 실제 하위 Task로 분해하고, 각 단계에 전문 AI 직원을 배정하며, 선행 업무 완료 → 결과 인수인계 → 다음 단계 실행 → 최종 대표 승인까지 추적 가능한 구조를 만든다.

## 이번 STEP에서 추가되는 DB 구조
- `task_workflows`: 협업 전체 흐름
- `task_dependencies`: 선행 업무 의존성
- `task_handoffs`: 이전 단계 결과의 인수인계 스냅샷
- `tasks.workflow_id`
- `tasks.workflow_step_no`
- `tasks.workflow_step_key`
- `tasks.is_workflow_root`

기존 `tasks`, `task_runs`, `task_assignments`, `results`, `memories`를 그대로 재사용한다.

## 핵심 안전장치
1. 협업 계획을 미리보기 한 뒤 확정해야 실제 하위 Task가 생성된다.
2. 단계는 2~8개만 허용한다.
3. dependency는 이전 step만 참조할 수 있으므로 순환 의존성이 DB에서 원천 차단된다.
4. 선행 업무가 미완료이면 `WAITING → IN_PROGRESS/REVIEW/COMPLETED` 진입을 DB trigger가 차단한다.
5. 실행 세션 시작도 `sawol_start_task_run` RPC에서 dependency를 재검증한다.
6. 한 Task에는 READY/RUNNING/SUBMITTED 실행 세션이 동시에 1개만 존재할 수 있다.
7. 협업 root/child Task는 일반 삭제 버튼에서 차단한다.
8. 협업 Task의 상태 select는 수정 화면에서 잠근다.
9. 하위 업무는 대표 승인함으로 올리지 않는다. 마지막 단계 완료 후 root 업무만 대표 승인 대기로 이동한다.
10. 최종 승인 시 기존 STEP20 결과함/기억센터 동기화를 그대로 사용한다.

## 인수인계
하위 Task가 COMPLETED가 되면 최신 `task_runs` 결과를 `task_handoffs`에 스냅샷으로 저장한다. 다음 직원의 AI 실행 Context에는 다음 정보가 함께 전달된다.
- 현재 하위 업무
- 원래 상위 대표 업무
- 담당 직원/부서
- 활성 기억
- 이전 단계 handoff 내용

따라서 이전 직원의 결과를 다음 직원이 이어서 사용할 수 있다.

## 최종 결과
모든 하위 Task가 COMPLETED가 되면 terminal step의 최신 결과를 root Task의 synthetic `task_run`으로 복사한다.
- 대표 승인 필요: root → `PENDING_APPROVAL`
- 대표 승인 불필요: root → `COMPLETED`, STEP20 artifact sync 시도

대표 승인 필요 업무는 기존 승인함의 `승인 후 완료`를 그대로 사용한다.

## 적용 순서
1. ZIP을 `sawol-office` 루트에 덮어쓴다.
2. Supabase SQL Editor 새 탭에서 `docs/22_COLLABORATION_WORKFLOW.sql` 전체 실행.
3. SQL 마지막 Verification 결과 확인.
4. Codespaces 서버 재시작.
5. 신규 테스트 업무를 만든 뒤 업무 상세에서 `협업 계획 생성` 테스트.

## SQL 정상 기대값
Verification에서 아래가 보여야 한다.
- tables: `task_dependencies`, `task_handoffs`, `task_workflows`
- tasks columns: `is_workflow_root`, `workflow_id`, `workflow_step_key`, `workflow_step_no`
- indexes: `uq_task_runs_one_active_per_task`, `uq_tasks_workflow_step_key`
- RLS: 위 3개 테이블 각각 SELECT/INSERT/UPDATE/DELETE 총 12개 policy

## 권장 테스트 업무
제목: `강의 신청자 관리 시스템 개선` 

설명:
- 신청자 이름/연락처/강의/결제상태 관리
- 연락처 중복 등록 방지
- 강의별 검색/필터
- 엑셀 다운로드
- 관리자 권한
- 개인정보 보호
- PC/모바일 대응
- 구현 전 데이터 구조와 보안 조건 설계

개발 업무 템플릿은 기본적으로 다음 DAG를 만든다.
1. 요구사항·데이터 구조 설계
2. 데이터·백엔드 구현 ← 1
3. 관리자 화면 구현 ← 1
4. 통합 QA·보안 점검 ← 2 + 3

2번과 3번은 병렬로 진행할 수 있고 4번은 두 단계가 모두 완료되어야 시작된다.

## 전체 테스트 시나리오
1. 새 업무 등록
2. 업무 상세 → 협업 계획 생성
3. 각 단계별 추천 직원 확인/필요 시 변경
4. 협업 계획 확정·시작
5. root 화면에서 진행률 0/N 및 단계 목록 확인
6. 2단계 또는 3단계를 먼저 열어 선행 업무 때문에 실행이 차단되는지 확인
7. 1단계 실행 세션 시작 → Mock AI 실행 → 검수 완료
8. 2·3단계가 `진행 가능`으로 풀리는지 확인
9. 2단계 완료 후 4단계는 아직 차단되는지 확인
10. 3단계 완료 후 4단계가 풀리는지 확인
11. 4단계 실행 결과에서 이전 단계 handoff가 AI Context에 반영되는지 결과 내용으로 확인
12. 4단계 검수 완료
13. root가 자동으로 대표 승인 대기로 이동하는지 확인
14. 승인함에는 root 1건만 뜨는지 확인
15. 제출 결과 보기 → root synthetic run 결과 확인
16. 승인 후 완료
17. root COMPLETED / workflow COMPLETED / 담당 직원 상태 복귀 확인
18. 결과함 및 기억센터 최종 결과 확인

## 현재 의도적으로 제외한 범위
- 무한 자동 재시도
- 복잡한 조건 분기(if/else) workflow editor
- 하위 Task 자동 재오픈 루프
- 여러 AI 직원의 실시간 채팅
- 유료 AI Provider 자동 선택/비용 최적화

이 기능들은 협업 파이프라인의 안정성을 먼저 검증한 뒤 다음 단계에서 확장한다.
