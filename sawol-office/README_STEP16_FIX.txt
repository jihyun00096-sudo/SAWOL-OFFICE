SAWOL OFFICE STEP 16 PATCH

수정:
1. 업무지시 등록 후 Runtime TypeError 수정
   - event.currentTarget를 await 이후 직접 참조하지 않도록 변경
2. 프로젝트 실제 삭제 기능 추가
3. 프로젝트 삭제 안전장치
   - 프로젝트명 재입력
   - 관련 tasks/results/approvals 개수 확인
   - 연결 데이터 존재 시 삭제 차단
   - 마지막 확인창
4. 프로젝트 상세 모바일 레이아웃 보강

교체:
components/sawol/command-form.tsx
app/projects/[id]/page.tsx

추가:
components/sawol/project-delete-button.tsx

적용 후 사이트 새로고침.

프로젝트 삭제 테스트:
연결 데이터 없는 테스트 프로젝트에서만 먼저 확인 권장.
