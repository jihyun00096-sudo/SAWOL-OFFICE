SAWOL OFFICE STEP 15

적용 전:
1) 현재 STEP 14 커밋
2) npm run dev 종료

적용:
ZIP 내용을 sawol-office 프로젝트 루트에 합치기.

반드시 유지:
.env.local
lib/supabase/*
proxy.ts
docs 01~14

교체 허용:
next.config.ts
app/page.tsx
app/login/page.tsx
app/dashboard/page.tsx

추가:
app/command
app/projects
app/tasks
app/employees
app/approvals
app/results
app/memory
components/sawol/*
lib/sawol/*
docs/15_OPERATIONS_UI_GUIDE.md

실행:
npm run dev

문제 발생 시:
git restore .
로 STEP 14 커밋 상태 복원 가능.
