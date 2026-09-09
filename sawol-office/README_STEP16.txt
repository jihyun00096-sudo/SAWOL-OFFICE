SAWOL OFFICE STEP 16

적용 전:
git add .
git commit -m "feat: complete step 15 operations"

ZIP 내용은 sawol-office 프로젝트 루트에 합친다.

교체:
app/projects/page.tsx
app/projects/[id]/page.tsx
app/tasks/page.tsx
app/results/page.tsx

추가:
app/tasks/[id]/page.tsx
app/results/[id]/page.tsx
components/sawol/project-browser.tsx
components/sawol/project-edit-form.tsx
components/sawol/task-browser.tsx
components/sawol/task-edit-form.tsx
components/sawol/result-browser.tsx
components/sawol/detail-section.tsx
docs/16_MANAGEMENT_GUIDE.md

실행:
npm run dev

테스트:
프로젝트 수정
업무 상세/수정
직원 배정
프로젝트 연결
결과 상세
모바일 확인

DB 스키마 변경 없음.
