SAWOL OFFICE STEP 16 - SIMPLE DELETE PATCH

목표:
프로젝트 삭제 / 업무 삭제 확인 절차를 단순화.

기존:
삭제 대상 이름을 다시 입력해야 삭제 가능

변경:
체크박스 "확인했습니다"만 체크하면 삭제 가능

유지되는 안전장치:
- 프로젝트: 연결된 업무 / 결과 / 승인 데이터가 있으면 삭제 차단
- 업무: 연결된 결과 / 승인 데이터가 있으면 삭제 차단
- 삭제 성공 후 목록으로 자동 이동
- 실제 DELETE 수행
- 모바일 모달 대응 유지

교체 파일:
components/sawol/project-delete-button.tsx
components/sawol/task-delete-button.tsx

적용:
ZIP 내용을 sawol-office 프로젝트 루트에 합치고 두 파일을 바꾸기.
