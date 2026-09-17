SAWOL OFFICE STEP27.0 — 범용 결과물 시스템

목표
AI Provider와 파일 생성기를 분리해, 나중에 Gemini → Claude/멀티모델로 바꿔도
실제 파일 산출물 구조는 그대로 유지하도록 확장합니다.

이번 단계 실제 지원 파일
- XLSX : 기존 Excel Worker 유지
- PDF  : 기존 PDF Worker 유지
- CSV  : 신규
- DOCX : 신규, 실제 Word OpenXML 파일
- PPTX : 신규, 실제 PowerPoint OpenXML 파일
- JSON : 신규
- Markdown(.md) : 신규
- TXT : 신규
- ZIP : 신규
- CODE : 코드블록이 있으면 코드 파일들을 추출해 ZIP bundle로 제출

복수 산출물
예)
"시장 자료를 조사해서 엑셀, CSV, 대표 보고용 PDF, 워드 문서, PPT까지 만들어줘"
→ 요청한 형식을 각각 별도 파일로 생성한 뒤 기존 artifacts 배열에 함께 저장합니다.

안전성
- 새 SQL 없음
- 환경변수 추가 없음
- 새 npm dependency 없음
- package.json / package-lock.json 수정 없음
- 기존 Storage, 승인, 결과함, Discord, AUTO/MANUAL 로직을 그대로 사용
- 기존 XLSX/PDF 생성 코드는 유지하고 확장 Worker만 연결
- STEP25.1.3 Research Quality Gate는 포함하지 않음
- STEP26 Live Office 코드와 충돌하는 파일 없음

DOCX/PPTX 구현
외부 npm 패키지 추가 대신 서버에서 표준 OpenXML ZIP 구조를 직접 만듭니다.
따라서 Vercel에서 별도 패키지 설치 문제를 만들지 않습니다.

검증
- TypeScript 문법 transpile 검사 완료
- 생성 DOCX를 LibreOffice에서 실제 PDF 변환하여 파일 열림 확인
- 생성 PPTX를 LibreOffice Impress에서 실제 PDF 변환하여 파일 열림 확인

HWP
실제 HWP/HWPX 생성은 이번 단계에 일부러 포함하지 않았습니다.
가짜 .hwp 파일을 만드는 것보다 HWPX 구조/호환성 검증 후 별도 STEP으로 추가합니다.
현재 router의 HWP 감지는 기존대로 유지됩니다.

적용
1. 현재 최신 SAWOL OFFICE에 ZIP 내용 덮어쓰기
2. Commit / Push
3. Vercel Production Ready 확인
4. SQL 실행 없음

추천 테스트 1
서울 부동산 관련 내용을 정리해서 워드 문서와 PPT 파일로 만들어줘.

정상 기대
- 예상 산출물에 .docx + .pptx
- 최종 실행 화면에 실제 파일 2개
- 둘 다 다운로드/열기 가능

추천 테스트 2
간단한 고객 데이터를 CSV와 JSON 파일로 정리하고 ZIP으로도 묶어줘.

정상 기대
- .csv + .json + .zip 실제 파일

추천 테스트 3
이 결과를 Markdown 파일과 TXT 파일로 같이 만들어줘.

정상 기대
- .md + .txt 실제 파일

변경 파일
- lib/artifacts/office-files.ts (신규)
- lib/artifacts/generate.ts
- lib/artifacts/router.ts
- lib/artifacts/types.ts
- app/tasks/[id]/page.tsx
