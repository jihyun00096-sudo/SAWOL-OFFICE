# SAWOL OFFICE — DATABASE SCHEMA

## 1. 목적
SAWOL OFFICE v0.1에서 사용하는 실제 운영 데이터를 Supabase에 저장하기 위한 데이터베이스 구조를 정의한다.

초기 버전에서는 다음 8개 핵심 테이블을 우선 구현한다.
- departments
- employees
- projects
- tasks
- results
- reviews
- approvals
- memories

추가 테이블은 v0.2 이후 확장한다.

## 2. 공통 설계 원칙
모든 주요 테이블은 가능한 경우 다음 공통 컬럼을 가진다.
- id
- created_at
- updated_at
id는 UUID를 기본으로 사용한다.

## 3. departments
컬럼:
- id uuid PK
- code text unique
- name text
- department_type text
- parent_department_id uuid nullable
- description text
- is_active boolean default true
- sort_order integer
- created_at timestamptz
- updated_at timestamptz

department_type 허용값:
HEADQUARTERS / DEPARTMENT / TEAM / LAB

## 4. employees
컬럼:
- id uuid PK
- employee_code text unique
- name text
- department_id uuid FK
- position text
- specialty jsonb
- responsibilities jsonb
- allowed_actions jsonb
- prohibited_actions jsonb
- tools jsonb
- work_style text
- speaking_style text
- report_style text
- status text
- current_task_id uuid nullable
- is_active boolean
- created_at
- updated_at

status:
AVAILABLE / WORKING / WAITING / REVIEWING / APPROVAL_WAIT / BLOCKED / OFFLINE

## 5. projects
컬럼:
- id uuid PK
- project_code text unique
- name text
- original_request text
- objective text
- expected_result text
- status text
- priority text
- manager_employee_id uuid nullable
- progress integer 0~100
- current_stage text
- risk_level text
- estimated_cost numeric
- actual_cost numeric
- started_at timestamptz nullable
- due_at timestamptz nullable
- completed_at timestamptz nullable
- created_at
- updated_at

status:
IDEA / PLANNING / IN_PROGRESS / REVIEW / APPROVAL_WAIT / ON_HOLD / COMPLETED / CANCELLED

priority:
URGENT / HIGH / NORMAL / LOW

risk_level:
LOW / MEDIUM / HIGH / CRITICAL

## 6. tasks
컬럼:
- id uuid PK
- task_code text unique
- project_id uuid nullable
- parent_task_id uuid nullable
- title text
- description text
- task_type text
- status text
- priority text
- assigned_employee_id uuid nullable
- assigned_department_id uuid nullable
- review_level integer 0~3
- requires_ceo_approval boolean
- blocked_reason text nullable
- input_data jsonb
- output_requirements jsonb
- started_at
- due_at
- completed_at
- created_at
- updated_at

task_type:
RESEARCH / PLANNING / PRODUCTION / EDIT / ANALYSIS / OPERATION / STUDY / DEVELOPMENT / DESIGN / OTHER

status:
WAITING / WAITING_FOR_DATA / IN_PROGRESS / COLLABORATING / IN_REVIEW / APPROVAL_WAIT / REVISION_REQUESTED / COMPLETED / ON_HOLD / CANCELLED / ERROR

## 7. results
컬럼:
- id uuid PK
- result_code text unique
- project_id uuid nullable
- task_id uuid nullable
- employee_id uuid
- result_type text
- title text
- summary text
- content text nullable
- file_url text nullable
- external_url text nullable
- version integer
- status text
- is_final boolean
- created_at
- updated_at

result_type:
DOCUMENT / IMAGE / CODE / RESEARCH / SPREADSHEET / ANALYSIS / PROMPT / WEB / DATA / OTHER

status:
DRAFT / IN_REVIEW / APPROVAL_WAIT / APPROVED / REJECTED / ARCHIVED

## 8. reviews
컬럼:
- id uuid PK
- task_id uuid nullable
- result_id uuid nullable
- reviewer_employee_id uuid
- review_type text
- review_level integer 0~3
- verdict text
- findings text
- required_changes text nullable
- warnings text nullable
- created_at
- updated_at

review_type:
FACT / REQUIREMENT / CONTENT / DESIGN / CODE / SECURITY / LEGAL_RISK / FINAL

verdict:
PASS / PASS_WITH_WARNING / REVISE / REJECT

## 9. approvals
컬럼:
- id uuid PK
- project_id uuid nullable
- task_id uuid nullable
- result_id uuid nullable
- approval_type text
- title text
- summary text
- status text
- risk_summary text nullable
- cost numeric nullable
- requested_by_employee_id uuid nullable
- ceo_comment text nullable
- requested_at timestamptz
- decided_at timestamptz nullable
- created_at
- updated_at

approval_type:
RESULT / COST / DEPLOY / EXTERNAL_SEND / DATA_CHANGE / SECURITY / LEGAL / OTHER

status:
PENDING / APPROVED / REVISION_REQUESTED / HOLD / REJECTED

## 10. memories
컬럼:
- id uuid PK
- memory_code text unique
- memory_type text
- category text
- title text
- content text
- importance text
- confidence text
- status text
- project_id uuid nullable
- source text nullable
- effective_from timestamptz nullable
- last_verified_at timestamptz nullable
- metadata jsonb
- created_at
- updated_at

memory_type:
CEO / PROJECT / DECISION / KNOWLEDGE / FAILURE / PROMPT / RULE / RESULT

importance:
HIGH / MEDIUM / LOW

confidence:
VERIFIED / RELIABLE / INTERNAL / EXPERIMENTAL / UNVERIFIED

status:
ACTIVE / SUPERSEDED / ARCHIVED / INVALID

## 11. 주요 관계도
- departments 1:N employees
- projects 1:N tasks
- employees 1:N tasks
- tasks 1:N results
- results 1:N reviews
- projects/tasks/results 1:N approvals
- projects 1:N memories

## 12. 삭제 규칙
운영 데이터는 실제 삭제보다 상태 변경을 우선한다.
- employees: is_active=false
- projects: CANCELLED
- memories: ARCHIVED

## 13. Foreign Key 삭제 정책
Project 삭제 대신 CANCELLED 상태를 기본 사용한다.
Employee 비활성화 시 과거 결과와 기록은 유지한다.
Task에 결과물·검수·승인 기록이 있으면 직접 삭제하지 않는다.

## 14. Row Level Security
Supabase RLS를 사용한다.
v0.1은 대표 1명만 사용하는 구조로 시작하고 다중사용자는 향후 owner_id 방식으로 확장 가능하다.

## 15. timestamps 자동 업데이트
updated_at은 데이터 수정 시 Trigger로 자동 변경한다.

## 16. 코드 생성 방식
project_code, task_code, result_code는 사람이 직접 입력하지 않고 앱 또는 DB 함수에서 생성한다.

## 17. 프로젝트 진행률
초기에는 수동 입력을 허용하고 향후 Task 완료 비율 기반 자동 계산으로 확장한다.

## 18. 직원 상태 계산
예:
IN_PROGRESS → WORKING
IN_REVIEW → REVIEWING
APPROVAL_WAIT → APPROVAL_WAIT
Task 없음 → AVAILABLE

## 19. 대표 승인과 Task 상태 연결
approval 생성 → Task APPROVAL_WAIT
승인 → 다음 단계
수정요청 → REVISION_REQUESTED
보류 → ON_HOLD

## 20. 검수와 Task 상태 연결
Task 작업 완료 → IN_REVIEW
PASS → 다음 단계
REVISE → REVISION_REQUESTED
REJECT → Task/Project 재검토

## 21. 기억 자동 생성 후보
- 대표가 같은 피드백 반복
- 중요한 결정 발생
- 프로젝트 완료
- 대표 반려
- 큰 오류
- 좋은 Prompt 발견
- 반복 가능한 업무방식 발견
초기에는 자동 저장하지 않고 확인 후 저장한다.

## 22. 검색 인덱스
권장:
- projects.status
- projects.priority
- tasks.project_id
- tasks.status
- tasks.assigned_employee_id
- results.project_id
- results.task_id
- approvals.status
- memories.memory_type
- memories.category
- memories.status

## 23. 향후 Vector 검색
v0.2 이후 memories와 knowledge에 Embedding을 추가해 자연어 검색을 지원할 수 있다.

## 24. v0.2 확장 테이블
- task_assignments
- task_handoffs
- decisions
- knowledge
- prompts
- failures
- assets
- integration_accounts
- integration_events
- activity_logs

## 25. v0.3 확장
- agent_runs
- model_usage
- ai_costs
- tool_calls
- agent_messages

## 26. 데이터베이스에 직접 저장하지 않는 값
- OpenAI API Key
- Anthropic API Key
- Gemini API Key
- Discord Webhook URL
- GitHub Token
- Notion Secret
- Supabase Service Role Key
- Google OAuth Secret
- 비밀번호
환경변수 또는 보안 저장소를 사용한다.

## 27. v0.1 실제 구현 우선순위
1. departments
2. employees
3. projects
4. tasks
5. results
6. reviews
7. approvals
8. memories

## 28. 초기 Seed Data
확정 조직과 직원정보를 DB 생성 후 초기 데이터로 등록한다.

## 29. v0.1 데이터 흐름 예시
대표 지시 → PROJECT 생성 → Task 생성 → 직원 배정 → Result 등록 → Review → PASS → 다음 Task → 필요 시 Approval → 대표 승인 → 다음 단계.

## 30. STEP 8 완료 기준
부서 / 직원 / 프로젝트 / Task / 결과물 / 검수 / 대표 승인 / 기억 / 테이블 관계 / 상태값 / 보안 기본원칙 / 확장방향이 실제 DB로 구현 가능한 상태여야 한다.
