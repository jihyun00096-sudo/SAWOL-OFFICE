import fs from "node:fs";

const files = {
  runner: "lib/sawol/autopilot-runner.ts",
  workflow: "lib/sawol/workflow.ts",
};

function read(path) {
  if (!fs.existsSync(path)) {
    throw new Error(`파일을 찾을 수 없습니다: ${path}`);
  }
  return fs.readFileSync(path, "utf8");
}

function write(path, content) {
  fs.writeFileSync(path, content, "utf8");
}

let runner = read(files.runner);

// Fix TS2367: start/route.ts checks COMPLETED, so keep the state contract aligned.
if (!runner.includes('| "COMPLETED";')) {
  const before = `    | "NEEDS_DECISION";`;
  const after = `    | "NEEDS_DECISION"\n    | "COMPLETED";`;

  if (runner.includes(before)) {
    runner = runner.replace(before, after);
  } else {
    // Fallback for slightly different formatting.
    runner = runner.replace(
      /(\|\s*"NEEDS_DECISION")(\s*;)/,
      `$1\n    | "COMPLETED"$2`,
    );
  }
}

write(files.runner, runner);

let workflow = read(files.workflow);

// Fix missing exported type used by workflow-board.tsx.
// Only add it when absent, preserving the rest of the existing workflow implementation.
if (!workflow.includes("export type WorkflowAssessment")) {
  const marker = `export type WorkflowMode = "SINGLE" | "COLLAB";`;
  const addition = `${marker}

export type WorkflowAssessment = {
  complexity: number;
  mode: WorkflowMode;
  threshold: number;
  reasons: string[];
};`;

  if (!workflow.includes(marker)) {
    throw new Error(
      `WorkflowMode 선언을 찾지 못했습니다. ${files.workflow} 구조를 확인해주세요.`,
    );
  }

  workflow = workflow.replace(marker, addition);
}

write(files.workflow, workflow);

console.log("STEP23-0 Vercel TypeScript build fix applied.");
console.log("- AutopilotStepResult: COMPLETED state aligned");
console.log("- WorkflowAssessment: exported type restored");
