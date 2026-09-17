SAWOL OFFICE STEP29.0 — 윤서진 비서실 중앙 관제

이번 단계 목적
- 이미 작동 중인 AUTO / workflow / handoff / 승인 구조를 다시 만들지 않습니다.
- 윤서진 비서실장이 대표 지시를 어디까지 처리하고 있는지 한 화면에서 보이게 합니다.
- 대표가 90명 직원의 세부 진행을 일일이 관리하지 않고, 비서실 단위로 업무 흐름을 확인하도록 합니다.

신규 메뉴
- 비서실 (/secretary)

비서실 화면
- 비서실 관리 중 업무 수
- 협업 업무 수
- 대표 보고 대기 수
- 오류/보류/재작업 등 비서실 확인 필요 수
- 업무별 비서실 단계:
  접수 → 배정 → 협업 → 결과 취합 → 대표 보고
- 실제 workflow 진행 상태 요약
- 실제 참여 직원 표시
- 실제 task_handoffs 기반 최근 직원 인수인계
- 대표에게 올라가야 하는 업무 기준 안내
- 최근 완료 업무

안전성
- SQL 없음
- 환경변수 없음
- npm 변경 없음
- DB 스키마 변경 없음
- AUTO 실행 로직 변경 없음
- workflow 생성 로직 변경 없음
- 승인/반려 로직 변경 없음
- Discord 변경 없음
- AI Provider 변경 없음
- Live Office 변경 없음
- Artifact Worker 변경 없음

변경 파일
- app/secretary/page.tsx (신규)
- components/sawol/secretary-control-center.tsx (신규)
- components/sawol/office-shell.tsx
- components/sawol/mobile-nav.tsx

테스트
1. Vercel Ready 확인
2. 좌측 메뉴에 '비서실' 표시 확인
3. /secretary 진입
4. AUTO 업무가 있으면 업무대장에 표시되는지 확인
5. 협업 업무는 참여 직원과 단계 진행률이 표시되는지 확인
6. 대표 승인 대기 업무가 있으면 '대표 보고 대기'로 표시되는지 확인

이 단계에서는 비서실의 '운영/관제 뼈대'를 완성합니다.
세부 AI 판단 품질과 검색 품질은 전체 시스템 완성 후 최종 품질 단계에서 조정합니다.
