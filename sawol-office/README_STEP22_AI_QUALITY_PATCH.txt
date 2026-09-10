SAWOL OFFICE STEP22 - AI QUALITY PARTIAL PATCH
기준: 사용자가 제공한 SAWOL-OFFICE-main(1)(1).zip

이번 패치는 기존 수동/자동/협업 구조를 갈아엎지 않습니다.
AI 품질, 모델 일관성, 최신자료 검색, 반려 재조사만 부분 보강합니다.

핵심 수정
1) Gemini 모델 단일화
- 기존 app/runs/[id]/page.tsx에 남아 있던 RESEARCH 전용 gemini-2.5-flash-lite fallback 제거
- GEMINI_MODEL 하나만 사용
- 사용자가 .env.local에 gemini-3.5-flash 또는 gemini-3.5-flash-lite를 적으면 전 업무가 그 모델 사용
- GEMINI_RESEARCH_MODEL은 더 이상 사용하지 않음

2) 실제 요청 조건을 HARD CONSTRAINT로 취급
- 수량, 출처, 사이트/도메인, 날짜, 형식, 금지조건 임의 변경 금지
- "네이버 뉴스 링크 3개"라면 다른 링크로 채우지 않음
- 정확한 링크를 확보하지 못하면 틀린 결과 대신 오류로 중단

3) 검색 품질 보강
- Google News RSS에서 후보 확보
- 실제 링크 redirect/canonical/og:url 확인
- 기사 og:title / og:description / 발행정보를 추가 확보
- AI에게 기사 제목만 주지 않고 확인 가능한 메타 근거도 전달
- 특정 도메인 요청 시 최종 URL 도메인까지 필터링

4) Gemini 2-pass 품질검수
- 최신자료 업무: 1차 작성 -> 2차 사실/요청준수 검수
- 협업 final 단계: 1차 작성 -> 완성도 검수
- 대표 반려 업무: 1차 재작업 -> 반려사유 해결 여부 재검수
- 속도보다 정확성 우선이라 이전보다 시간이 더 걸릴 수 있음

5) 반려는 "말만 고쳐쓰기" 금지
- 다시 조사/재조사/출처/근거/기사/뉴스/사실/부정확 등 피드백이면 새 검색 사용
- 협업이면 가능한 가장 이른 RESEARCH 단계부터 다시 열기
- "처음부터/전부 다시"면 첫 단계부터 재실행
- 이전 ACTIVE 피드백은 ARCHIVED 처리 후 최신 피드백만 ACTIVE 유지

6) 협업 결과 밀도 보강
- 내부 단계 구조 자체는 그대로 유지
- 각 단계 설명만 실무 산출물 수준으로 강화
- final 담당자는 선행 결과를 요약만 하지 않고 대표 원문 전체 요구사항을 다시 대조해 완성형으로 통합

적용 파일
- .env.example
- package.json
- lib/ai/gemini-config.ts (신규)
- lib/ai/research-policy.ts (신규)
- lib/ai/free-web-research.ts
- lib/ai/gemini.ts
- lib/ai/provider.ts (현재본 그대로 포함)
- lib/ai/sawol-context.ts
- lib/sawol/workflow.ts
- app/api/ai/runs/[id]/route.ts
- app/api/office/tasks/[id]/autopilot/route.ts
- app/runs/[id]/page.tsx
- components/sawol/ai-execute-button.tsx
- docs/22_AI_QUALITY_REJECTION_FIX.sql

적용 순서
1. ZIP 내용을 sawol-office 루트에 덮어쓰기
2. 터미널에서 SDK를 프로젝트 의존성/lock에 확정
   npm install
3. Supabase SQL Editor 새 쿼리에서
   docs/22_AI_QUALITY_REJECTION_FIX.sql 전체 실행
4. .env.local 확인
   SAWOL_AI_PROVIDER=gemini
   AI_PROVIDER=gemini
   GEMINI_API_KEY=기존키
   GEMINI_MODEL=gemini-3.5-flash-lite

   ※ 사용자가 gemini-3.5-flash를 쓰고 싶으면 그 값으로 두면 됨.
   ※ GEMINI_RESEARCH_MODEL 라인이 있으면 삭제 권장.
5. 서버 재시작
   Ctrl+C
   npm run dev

코드 확인
아래 명령 결과에 gemini-2.5가 나오면 안 됨:
  grep -RIn --exclude-dir=node_modules --exclude-dir=.next "gemini-2.5" app lib components

추천 테스트 A - 모델 일관성
- 일반 작성 업무 실행
- RESEARCH 업무 실행
- 둘 다 실행 상세 AI Provider에 .env.local의 GEMINI_MODEL과 같은 모델이 표시되는지 확인

추천 테스트 B - 정확한 출처
제목: 오늘 부동산 뉴스 3개 찾아줘
내용: 오늘 기준 부동산 주요 이슈 3개를 찾아줘. 반드시 네이버 뉴스로 열리는 링크만 줘. 기사 제목, 언론사, 핵심 내용, 중요한 이유, 네이버 뉴스 링크를 각각 적어줘.

정상:
- 실제 검증된 네이버 뉴스 URL 3개만 제출
- 확보 못 하면 다른 링크로 채우지 않고 중단

추천 테스트 C - 반려 재조사
승인함에서:
"기존 기사 그대로 쓰지 말고 처음부터 다시 조사해. 오늘 기준으로 새 기사 3개를 찾고 링크와 사실관계를 다시 확인해줘."

정상:
- 협업이면 첫 단계/RESEARCH부터 재실행
- 기존 결과 문구만 바꿔 제출하지 않음
- 새 task_run 생성 및 2-pass 검수

추천 테스트 D - 협업 최종 밀도
조사 -> 기획 -> 작성 -> 검수 협업 업무 실행
정상:
- final 결과가 앞 단계 요약 몇 줄이 아니라 대표 원문의 항목을 모두 포함한 완성 산출물

테스트 통과 후 GitHub 저장
  git status
  git add .
  git commit -m "fix: strengthen step 22 ai quality and rework"
  git push
  git status
