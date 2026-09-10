import fs from "node:fs";

const file = "components/sawol/autonomous-office.tsx";

if (!fs.existsSync(file)) {
  throw new Error(`파일을 찾을 수 없습니다: ${file}`);
}

let src = fs.readFileSync(file, "utf8");

const oldBlock = `  const progress =
    job?.progress ??
    (workflow?.total
      ? Math.round(
          (workflow.completed / workflow.total) * 100,
        )
      : 0);

  const failed =
    job?.status === "FAILED" ||
    Boolean(localError);

  const paused = job?.status === "PAUSED";
  const current = workflow?.current;

  const closed =
    CLOSED.has(task.status) ||
    ["AWAITING_APPROVAL", "COMPLETED"].includes(
      job?.status ?? "",
    );`;

const newBlock = `  const failed =
    job?.status === "FAILED" ||
    Boolean(localError);

  const paused = job?.status === "PAUSED";
  const current = workflow?.current;

  const closed =
    CLOSED.has(task.status) ||
    ["AWAITING_APPROVAL", "COMPLETED"].includes(
      job?.status ?? "",
    );

  // STEP23-1.1:
  // 실제 root task가 승인대기/완료 상태라면 autopilot job의
  // 마지막 progress 값이 늦게 반영되더라도 UI는 최종 상태를 우선합니다.
  const progress = closed
    ? 100
    : job?.progress ??
      (workflow?.total
        ? Math.round(
            (workflow.completed / workflow.total) * 100,
          )
        : 0);`;

if (!src.includes(oldBlock)) {
  throw new Error(
    "예상한 진행률 코드 블록을 찾지 못했습니다. 현재 파일이 다른 버전일 수 있으니 덮어쓰지 않았습니다.",
  );
}

src = src.replace(oldBlock, newBlock);

const oldTitle = `              {current?.title ??
                job?.current_step_title ??
                (closed
                  ? "대표 확인 단계"
                  : paused
                    ? "자료 조건 확인"
                    : "업무 준비 중")}`;

const newTitle = `              {closed
                ? "대표 확인 단계"
                : current?.title ??
                  job?.current_step_title ??
                  (paused
                    ? "자료 조건 확인"
                    : "업무 준비 중")}`;

if (!src.includes(oldTitle)) {
  throw new Error(
    "예상한 상태 제목 코드 블록을 찾지 못했습니다. 진행률 수정도 저장하지 않았습니다.",
  );
}

src = src.replace(oldTitle, newTitle);

const oldDesc = `              {current?.employee
                ? \`\${current.employee} · \`
                : ""}
              {current?.status
                ? stepStatusLabel[current.status] ??
                  current.status
                : job?.last_message ??
                  "실행 상태를 확인 중입니다."}`;

const newDesc = `              {closed
                ? task.status === "PENDING_APPROVAL"
                  ? "AI 작업 완료 · 대표 승인을 기다리고 있습니다."
                  : "AI 작업이 완료되었습니다."
                : <>
                    {current?.employee
                      ? \`\${current.employee} · \`
                      : ""}
                    {current?.status
                      ? stepStatusLabel[current.status] ??
                        current.status
                      : job?.last_message ??
                        "실행 상태를 확인 중입니다."}
                  </>}`;

if (!src.includes(oldDesc)) {
  throw new Error(
    "예상한 상태 설명 코드 블록을 찾지 못했습니다. 변경사항을 저장하지 않았습니다.",
  );
}

src = src.replace(oldDesc, newDesc);

fs.writeFileSync(file, src, "utf8");

console.log("STEP23-1.1 final state sync applied.");
console.log("- 승인대기/완료 상태는 UI 진행률 100% 우선");
console.log("- stale current step 대신 '대표 확인 단계' 표시");
console.log("- 승인대기 안내문을 실제 task.status 기준으로 표시");
