SAWOL OFFICE STEP28.0 — PROJECT OPERATIONS HUB

목표
프로젝트가 단순한 메모/목록이 아니라 실제 업무 운영의 상위 컨테이너가 되도록 정리합니다.
AI Provider와 무관한 구조 단계이므로 이후 Claude/멀티모델로 교체해도 그대로 유지됩니다.

이번 단계
1. 프로젝트 목록 강화
- 프로젝트별 메인 업무 수
- 진행 중 / 완료 / 확인 필요 건수
- 실제 업무 상태를 기반으로 계산한 실시간 진행률
- 기존 수동 project.progress 값은 삭제하지 않음

2. 프로젝트 상세 = 운영 허브
- 메인 업무 목록
- AUTO / MANUAL 구분
- AI workflow 단계 흐름
- 직원/부서 담당
- 실제 task_handoffs 기반 인수인계
- task_feedback 기반 재작업/대표 피드백 이력
- 결과물
- 대표 승인 기록

3. 프로젝트 → 업무지시 연결
- 프로젝트 상세의 '업무 추가' 버튼
- /command?project_id=... 로 이동
- 업무지시 화면에서 해당 프로젝트가 기본 선택된 상태로 시작
- 비서실 분석 후에도 대표가 프로젝트 상세에서 들어온 경우 프로젝트 연결을 유지

4. 기존 구조 보호
- 신규 SQL 없음
- DB schema 변경 없음
- AUTO/MANUAL 로직 변경 없음
- Workflow 생성/Autopilot 변경 없음
- Discord 변경 없음
- Artifact Worker 변경 없음
- Live Office 변경 없음

변경 파일
- components/sawol/project-operations-board.tsx (신규)
- app/projects/page.tsx
- app/projects/[id]/page.tsx
- components/sawol/project-browser.tsx
- app/command/page.tsx
- components/sawol/command-form.tsx

적용
1. ZIP을 현재 최신 프로젝트에 덮어쓰기
2. Commit / Push
3. Vercel Ready 확인
4. SQL 실행 없음

테스트
A. 프로젝트 목록
- 기존 프로젝트 카드에 업무/진행/완료/확인 지표가 보이는지 확인

B. 프로젝트 상세
- 프로젝트 클릭
- PROJECT CONTROL 운영 현황 표시 확인
- 업무를 선택했을 때 workflow/인수인계/피드백 표시 확인

C. 새 업무 연결
- 프로젝트 상세 > 업무 추가
- 업무지시 화면에서 프로젝트가 이미 선택되어 있는지 확인
- 새 AUTO 또는 MANUAL 업무 생성
- 생성 후 프로젝트 상세에서 메인 업무로 표시되는지 확인

주의
이 단계는 프로젝트 운영 구조를 완성하는 단계입니다.
검색 품질/AI 결과 품질 같은 STEP36 영역은 건드리지 않습니다.
