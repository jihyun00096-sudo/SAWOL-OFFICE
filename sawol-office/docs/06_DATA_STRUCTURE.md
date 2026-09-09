# SAWOL OFFICE — DATA STRUCTURE

## 1. 목적
SAWOL OFFICE의 프로젝트, 업무, 직원, 결과물, 결정, 기억, 검수 및 연동 상태를 한 곳에서 관리할 수 있도록 데이터 구조를 정의한다. 이 구조는 향후 Supabase를 기본 운영 DB로 사용하고 Notion, Discord, GitHub 등 외부 서비스와 연결할 수 있도록 설계한다.

## 2. 핵심 원칙
- Supabase를 실제 운영 데이터의 기준(Source of Truth)으로 사용한다.
- Notion은 문서·보기·공유용 기록 저장소로 사용한다.
- Discord는 알림·보고·명령 채널로 사용한다.
- GitHub는 코드와 개발 이력을 저장한다.
- 외부 서비스가 연결되지 않아도 SAWOL OFFICE 내부 업무는 계속 기록할 수 있어야 한다.
- 외부 연동 실패와 내부 업무 실패를 구분한다.

## 3. 핵심 테이블

### departments
본부와 팀 정보를 저장한다.
필드: id, code, name, parent_department_id, type, description, is_active, created_at, updated_at

### employees
AI 직원 프로필을 저장한다.
필드: id, employee_code, name, department_id, team_id, title, specialty, responsibilities, allowed_actions, forbidden_actions, tools, report_style, personality, is_active, created_at, updated_at

### projects
장기 또는 다부서 프로젝트를 저장한다.
필드: id, project_code, name, original_request, purpose, expected_output, status, priority, project_manager_id, started_at, due_at, completed_at, created_at, updated_at

### project_departments
프로젝트와 참여 부서를 연결한다.
필드: id, project_id, department_id, role, created_at

### tasks
실제 직원이 수행할 업무 단위를 저장한다.
필드: id, task_code, project_id, parent_task_id, title, description, task_type, status, priority, review_level, approval_required, assigned_employee_id, assigned_department_id, blocked_reason, started_at, due_at, completed_at, created_at, updated_at

### task_assignments
하나의 Task에 여러 직원이 참여할 때 사용한다.
필드: id, task_id, employee_id, assignment_role, is_lead, status, created_at, updated_at

### task_handoffs
직원 간 인수인계 기록을 저장한다.
필드: id, task_id, from_employee_id, to_employee_id, summary, completed_work, source_materials, decisions, unresolved_items, risks, next_action, created_at

### results
직원이 제출한 실제 업무 결과를 저장한다.
필드: id, result_code, project_id, task_id, employee_id, result_type, title, summary, content, version, status, file_reference, external_url, created_at, updated_at

### reviews
결과물의 검수 기록을 저장한다.
필드: id, project_id, task_id, result_id, reviewer_employee_id, review_type, review_level, verdict, findings, required_changes, warnings, created_at

### approvals
대표 승인 대기 및 승인 이력을 저장한다.
필드: id, project_id, task_id, result_id, approval_type, status, request_summary, decision_note, requested_at, decided_at
상태: PENDING / APPROVED / REVISION_REQUESTED / HOLD / REJECTED

### decisions
대표의 중요 의사결정을 저장한다.
필드: id, decision_code, project_id, title, decision, reason, alternatives, rejected_reason, future_impact, review_condition, status, decided_at, created_at

### memories
대표 선호와 프로젝트 경험 등 장기 기억을 저장한다.
필드: id, memory_code, memory_type, category, title, content, importance, confidence, status, project_id, source_type, source_reference, effective_from, last_verified_at, created_at, updated_at

### knowledge
전문지식과 조사자료를 저장한다.
필드: id, knowledge_code, category, title, summary, content, reliability, source_name, source_url, source_date, checked_at, project_id, created_at, updated_at

### prompts
재사용 가능한 AI 프롬프트를 관리한다.
필드: id, prompt_code, name, category, employee_id, purpose, prompt_text, version, model_name, evaluation, caution, status, created_at, updated_at

### failures
실패·버그·반려 사례를 저장한다.
필드: id, failure_code, project_id, task_id, category, issue, cause, resolution, prevention_rule, severity, status, created_at, resolved_at

### assets
재사용 가능한 파일과 결과물 자산을 관리한다.
필드: id, asset_code, project_id, result_id, asset_type, name, description, version, storage_location, file_reference, reuse_scope, caution, status, created_at

### integration_accounts
외부 연동 서비스의 설정 상태를 저장한다. 비밀키 자체는 저장하지 않는다.
필드: id, provider, display_name, connection_status, config_reference, last_checked_at, created_at, updated_at

### integration_events
Notion, Discord, GitHub 등 외부 연동 실행 기록을 저장한다.
필드: id, provider, project_id, task_id, event_type, status, external_reference, error_message, attempted_at, completed_at

### activity_logs
회사 전체 중요 활동 로그를 저장한다.
필드: id, project_id, task_id, employee_id, action_type, summary, metadata, created_at

## 4. 주요 관계
Project 1:N Tasks
Project N:M Departments
Task N:M Employees
Task 1:N Results
Result 1:N Reviews
Project/Task/Result 1:N Approvals
Project 1:N Decisions
Project 1:N Memories / Knowledge / Failures / Assets

## 5. 코드 규칙
프로젝트: PROJECT-0001
업무: TASK-0001-01
결과물: RESULT-0001-01
결정: DECISION-0001
기억: MEMORY-CEO-0001 또는 MEMORY-PROJ-0001
프롬프트: PROMPT-IMG-0001
실패: FAIL-0001
자산: ASSET-0001

## 6. 상태값
Project: IDEA / PLANNING / IN_PROGRESS / REVIEW / APPROVAL_WAIT / ON_HOLD / COMPLETED / CANCELLED
Task: WAITING / MATERIAL_WAIT / IN_PROGRESS / COLLABORATING / REVIEWING / APPROVAL_WAIT / REVISION / COMPLETED / HOLD / CANCELLED / ERROR
Result: DRAFT / REVIEW / APPROVAL_WAIT / APPROVED / SUPERSEDED / ARCHIVED
Memory: ACTIVE / SUPERSEDED / ARCHIVED / INVALID
Integration: DISCONNECTED / CONNECTED / ERROR / PAUSED

## 7. 대표 대시보드에 필요한 데이터
- 진행 중 프로젝트
- 승인 대기 건수
- 진행 중 Task
- 자료 대기 Task
- 오류 발생 Task
- 오늘 완료된 업무
- 최근 대표 결정
- 외부 연동 오류
- 비용 발생 가능 업무

## 8. 기억 조회 구조
새 업무 시작 시 관련 기억을 다음 순서로 검색한다.
현재 프로젝트 결정 → 대표 HIGH 선호 → 유사 프로젝트 → 실패사례 → 전문지식 → 재사용 결과물 → 프롬프트

## 9. 외부 서비스와의 역할 분리
Supabase: 운영 DB와 실제 상태의 기준
Notion: 프로젝트/리서치/결과/결정 문서 보기 및 아카이브
Discord: 승인 요청, 완료 알림, 장애 알림, 간단 명령
GitHub: 코드, Branch, Commit, Pull Request, Release 이력
Google Drive: 대용량 문서·이미지·영상 등 파일 보관 후보

## 10. 보안 원칙
- API Key, 토큰, 비밀번호는 DB 일반 테이블에 저장하지 않는다.
- 환경변수 또는 비밀 저장소를 사용한다.
- 개인정보는 필요한 최소한만 저장한다.
- 로그에 비밀값과 중요 개인정보를 남기지 않는다.
- 운영 데이터 삭제 및 대량 수정은 대표 승인 대상으로 둔다.

## 11. 초기 버전에서 실제 구현할 최소 테이블
v0.1에서는 과도하게 많은 테이블을 한 번에 만들지 않는다. 우선 다음 8개만 구현한다.
1. departments
2. employees
3. projects
4. tasks
5. results
6. reviews
7. approvals
8. memories

나머지 decisions, knowledge, prompts, failures, assets, integrations, logs는 v0.2 이후 추가한다.

## 12. STEP 6 완료 기준
- 회사 데이터의 기준 저장소가 무엇인지 확정
- 프로젝트와 Task의 관계 정의
- 직원 배정 구조 정의
- 결과·검수·승인 데이터 구조 정의
- 장기 기억 구조 정의
- 외부 서비스와 내부 DB의 역할 분리
- v0.1 최소 구현 범위 확정
