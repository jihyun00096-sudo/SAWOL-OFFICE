SAWOL OFFICE STEP33.0 — Provider-neutral Memory Center

목표
기억을 Gemini/Claude 등 특정 AI 모델 내부 기능에 의존하지 않고,
SAWOL OFFICE DB가 직접 보관·선별·전달하는 회사 자산으로 만듭니다.

핵심 변경
1. Provider-neutral Memory OS
- 기억은 기존 public.memories 테이블에 그대로 저장
- AI Provider와 독립
- 향후 Gemini → Claude / 멀티모델 전환 시 기억 이전 작업 불필요

2. 업무별 기억 선별
기존:
- ACTIVE 기억 중 앞 12건을 단순 전달

변경:
- ACTIVE 기억 최대 80건을 후보로 로드
- 대표 규칙 / 기억 유형 / 중요도 / 신뢰도 / 프로젝트 일치 / 현재 업무 키워드 관련성 계산
- 실제 AI에는 최대 16건만 전달
- 다른 프로젝트 전용 기억은 강한 감점
- 대표 RULE/CEO 기억은 회사 공통 기준으로 우선

3. AUTO / MANUAL 동일 적용
- Autopilot 실행
- 수동 AI 실행
모두 같은 기억 선별기를 사용합니다.

4. 기억센터 UI
- 활성 기억
- 대표 규칙
- 중요 기억
- 검증 완료
- 프로젝트 기억
요약 현황 추가

- 회사 전체 / 프로젝트 전용 범위 지원
- 프로젝트 전용 기억은 실제 project_id 연결
- 유형 / 범위 / 검색 필터
- 태그 저장
- Provider-neutral 안내 표시

5. AI Prompt
선별된 기억을 Provider-neutral 운영 컨텍스트로 명시
프로젝트 전용 기억 범위와 confidence 사용 규칙 추가

변경 파일
- lib/ai/memory-context.ts (신규)
- lib/sawol/autopilot-runner.ts
- app/api/ai/runs/[id]/route.ts
- lib/ai/sawol-context.ts
- app/memory/page.tsx
- components/sawol/memory-manager.tsx

SQL 없음
환경변수 없음
npm 변경 없음
DB 스키마 변경 없음
Discord 변경 없음
Artifact 변경 없음
Live Office 변경 없음

기존 memories.metadata JSONB를 사용하므로 별도 마이그레이션이 필요 없습니다.

간단 테스트
1. 기억센터 접속
2. 새 기억 → 회사 전체
   제목: 모든 고객 안내는 정중하고 실무적으로 작성
   유형: 규칙
   중요도: 높음
3. 새 기억 → 프로젝트 전용
   프로젝트 선택 후 해당 프로젝트만의 규칙 입력
4. AUTO 또는 MANUAL 업무 실행
5. 기존 업무 실행이 정상 완료되는지만 확인

주의
이번 단계는 기억을 '자동으로 무제한 학습'시키는 기능이 아닙니다.
잘못된 결과를 자동 기억하면 오염될 수 있으므로,
승인된 결과/대표 등록/기존 시스템이 만든 기억을 안전하게 선별하는 기반을 먼저 완성합니다.

향후
- 외부 앱 연동 허브(Google Calendar / Notion / Drive / Gmail)
- 외부 앱에서 들어온 컨텍스트도 기억과 별도 Connector Context로 관리
- Claude / 멀티모델 전환 시 본 Memory OS 그대로 재사용
