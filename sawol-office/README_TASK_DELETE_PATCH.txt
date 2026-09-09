SAWOL OFFICE STEP 16 - TASK DELETE PATCH

추가:
components/sawol/task-delete-button.tsx

교체:
app/tasks/[id]/page.tsx

적용 방법:
ZIP 내용을 sawol-office 루트에 합치기.

업무 삭제 정책:
- 업무 상세에서만 삭제 가능
- 업무 제목을 정확히 다시 입력해야 삭제 버튼 활성화
- 결과(results) 또는 승인(approvals)이 연결되어 있으면 삭제 차단
- 마지막 브라우저 확인창 표시
- 성공 시 /tasks로 이동
- DB 레코드는 실제 DELETE

모바일:
- 삭제/목록 버튼은 작은 화면에서 전체 너비
- 삭제 모달은 100dvh 기준 최대 높이와 내부 스크롤 적용

주의:
results 및 approvals 테이블에 task_id 컬럼이 있어야 연결 데이터 검사 가능.
현재 STEP 16 스키마 기준으로 구성됨.
