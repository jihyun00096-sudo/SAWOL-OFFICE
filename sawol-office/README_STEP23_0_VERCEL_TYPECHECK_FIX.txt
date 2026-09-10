SAWOL OFFICE STEP23-0 - Vercel TypeScript build fix

Fixes exactly these build errors:

1)
app/api/office/tasks/[id]/autopilot/start/route.ts
TS2367: comparison with "COMPLETED" has no overlap

Cause:
The start route already handles COMPLETED, but AutopilotStepResult's TypeScript union
did not include "COMPLETED".

Fix:
Add "COMPLETED" to the state union. Runtime behavior is not changed.

2)
components/sawol/workflow-board.tsx
TS2305: no exported member 'WorkflowAssessment'

Cause:
workflow-board.tsx imports the type, but the current workflow.ts lost that exported
type during the STEP22 patch/merge sequence.

Fix:
Restore only the WorkflowAssessment type export.

3)
workflow-board.tsx reason implicitly has any type

Cause:
This is a cascading error from the missing WorkflowAssessment type.

Fix:
Once WorkflowAssessment is restored, reasons is string[] and this error resolves too.

HOW TO APPLY

From:
  /workspaces/SAWOL-OFFICE/sawol-office

Run:

  unzip -o SAWOL_OFFICE_STEP23_0_VERCEL_TYPECHECK_FIX.zip -d .
  node scripts/fix-step23-vercel-build.mjs
  npm run build

If build passes:

  git add .
  git commit -m "fix: resolve vercel typecheck errors"
  git push

Vercel should redeploy automatically after the push.

No SQL.
No .env.local changes.
No Supabase schema changes.
No AUTO/MANUAL behavior changes.
