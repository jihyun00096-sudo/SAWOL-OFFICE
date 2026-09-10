import { executeAiTask } from "@/lib/ai/provider";
import { createHumanCode } from "@/lib/sawol/code";
import type { SawolAiContext } from "@/lib/ai/types";
import { shouldUseWebResearch } from "@/lib/ai/research-policy";
import { ResearchInsufficientError } from "@/lib/ai/free-web-research";

export type AutopilotStepResult = {
  ok: true;
  state:
    | "AWAITING_APPROVAL"
    | "FINISHING"
    | "WAITING"
    | "RUNNING"
    | "NEEDS_DECISION"
    | "COMPLETED";
  progress: number;
  title?: string;
  stepTitle?: string;
  resultTitle?: string;
  decisionMessage?: string;
};

function messageOf(error: unknown) {
  return error instanceof Error
    ? error.message.slice(0, 700)
    : "AI 자동 실행 오류";
}

function isResearchInsufficient(error: unknown) {
  return (
    error instanceof ResearchInsufficientError ||
    (error instanceof Error &&
      error.name === "ResearchInsufficientError")
  );
}

async function executeTask(supabase: any, task: any) {
  let { data: run } = await supabase
    .from("task_runs")
    .select("*")
    .eq("task_id", task.id)
    .in("status", ["READY", "RUNNING"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!run) {
    const { error } = await supabase.rpc(
      "sawol_start_task_run",
      {
        p_task_id: task.id,
        p_run_code: createHumanCode("RUN"),
      },
    );

    if (error) throw new Error(error.message);

    const created = await supabase
      .from("task_runs")
      .select("*")
      .eq("task_id", task.id)
      .in("status", ["READY", "RUNNING"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    run = created.data;
  }

  if (!run) throw new Error("RUN_NOT_CREATED");

  const [
    projectResult,
    departmentResult,
    employeeResult,
    memoryResult,
    handoffResult,
    rootTaskResult,
    feedbackResult,
  ] = await Promise.all([
    task.project_id
      ? supabase
          .from("projects")
          .select("*")
          .eq("id", task.project_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    task.assigned_department_id
      ? supabase
          .from("departments")
          .select("*")
          .eq("id", task.assigned_department_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    run.employee_id || task.assigned_employee_id
      ? supabase
          .from("employees")
          .select("*")
          .eq(
            "id",
            run.employee_id || task.assigned_employee_id,
          )
          .maybeSingle()
      : Promise.resolve({ data: null }),

    supabase
      .from("memories")
      .select("*")
      .eq("status", "ACTIVE")
      .limit(12),

    task.workflow_id && !task.is_workflow_root
      ? supabase
          .from("task_handoffs")
          .select(
            "title,summary,content,from_task_id,created_at",
          )
          .eq("to_task_id", task.id)
          .eq("status", "AVAILABLE")
          .order("created_at")
      : Promise.resolve({ data: [] }),

    task.parent_task_id
      ? supabase
          .from("tasks")
          .select(
            "task_code,title,description,task_type,priority",
          )
          .eq("id", task.parent_task_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    supabase
      .from("task_feedback")
      .select("reason,created_at")
      .eq("root_task_id", task.parent_task_id || task.id)
      .eq("status", "ACTIVE")
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const context: SawolAiContext = {
    task,
    project: projectResult.data ?? null,
    department: departmentResult.data ?? null,
    employee: employeeResult.data ?? null,
    memories: memoryResult.data ?? [],
    handoffs: handoffResult.data ?? [],
    rootTask: rootTaskResult.data ?? null,
    feedbacks: feedbackResult.data ?? [],
  };

  try {
    const ai = await executeAiTask({
      context,
      useWebSearch: shouldUseWebResearch(context),
    });

    const now = new Date().toISOString();

    const { error: saveError } = await supabase
      .from("task_runs")
      .update({
        status: "COMPLETED",
        provider: ai.provider,
        model: ai.model,
        provider_response_id: ai.responseId,
        usage_json: ai.usage,
        ai_finished_at: now,
        submitted_at: now,
        completed_at: now,
        result_title: ai.result.title,
        result_summary: ai.result.summary,
        result_body: ai.result.body,
        error_message: null,
        metadata: {
          ...(run.metadata ?? {}),
          autopilot: true,
          confidence: ai.result.confidence,
          sources: ai.result.sources,
        },
        updated_at: now,
      })
      .eq("id", run.id);

    if (saveError) {
      throw new Error(saveError.message);
    }

    return {
      runId: run.id,
      result: ai.result,
    };
  } catch (error) {
    const failedAt = new Date().toISOString();
    const message = messageOf(error);

    await supabase
      .from("task_runs")
      .update({
        status: "FAILED",
        error_message: message,
        ai_finished_at: failedAt,
        updated_at: failedAt,
      })
      .eq("id", run.id);

    // 자료 자체가 부족한 경우는 기술 오류가 아닙니다.
    // 대표 요청을 임의로 완화하지 않고 ON_HOLD로 돌립니다.
    if (isResearchInsufficient(error)) {
      await supabase
        .from("tasks")
        .update({
          status: "ON_HOLD",
          updated_at: failedAt,
        })
        .eq("id", task.id);

      throw error;
    }

    await supabase
      .from("tasks")
      .update({
        status: "ERROR",
        updated_at: failedAt,
      })
      .eq("id", task.id);

    throw error;
  }
}

export async function runAutopilotStep(
  supabase: any,
  rootTaskId: string,
): Promise<AutopilotStepResult> {
  const { data: root, error: rootError } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", rootTaskId)
    .maybeSingle();

  if (rootError) throw new Error(rootError.message);
  if (!root) throw new Error("업무를 찾을 수 없습니다.");

  if (root.execution_mode !== "AUTO") {
    throw new Error(
      "현재 수동 실행 모드입니다. 자동 실행으로 전환한 뒤 다시 시도해주세요.",
    );
  }

  await supabase
    .from("tasks")
    .update({
      requires_ceo_approval: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", root.id);

  // 단일 업무
  if (!root.workflow_id) {
    try {
      const { result } = await executeTask(supabase, {
        ...root,
        requires_ceo_approval: true,
      });

      await supabase
        .from("tasks")
        .update({
          status: "PENDING_APPROVAL",
          updated_at: new Date().toISOString(),
        })
        .eq("id", root.id);

      return {
        ok: true,
        state: "AWAITING_APPROVAL",
        progress: 100,
        title: result.title,
      };
    } catch (error) {
      if (isResearchInsufficient(error)) {
        return {
          ok: true,
          state: "NEEDS_DECISION",
          progress: 0,
          decisionMessage: messageOf(error),
        };
      }
      throw error;
    }
  }

  // 협업 업무
  const { data: children, error: childError } = await supabase
    .from("tasks")
    .select("*")
    .eq("workflow_id", root.workflow_id)
    .eq("is_workflow_root", false)
    .order("workflow_step_no");

  if (childError) throw new Error(childError.message);

  const rows = children ?? [];
  const completed = rows.filter(
    (row: any) => row.status === "COMPLETED",
  ).length;

  if (rows.length && completed === rows.length) {
    const refreshed = await supabase
      .from("tasks")
      .select("status")
      .eq("id", root.id)
      .maybeSingle();

    return {
      ok: true,
      state:
        refreshed.data?.status === "PENDING_APPROVAL"
          ? "AWAITING_APPROVAL"
          : "FINISHING",
      progress: 100,
    };
  }

  let next: any = null;

  for (const child of rows) {
    if (child.status === "COMPLETED") continue;

    // 대표 판단이 필요한 보류 단계가 있으면 자동 루프를 더 돌리지 않습니다.
    if (child.status === "ON_HOLD") {
      return {
        ok: true,
        state: "NEEDS_DECISION",
        progress: rows.length
          ? Math.round((completed / rows.length) * 100)
          : 0,
        stepTitle: child.title,
        decisionMessage:
          "자동 재조사를 모두 시도했지만 대표가 지정한 조건을 충족할 검증 자료가 부족합니다.",
      };
    }

    const { data: unmet, error: dependencyError } =
      await supabase.rpc("sawol_unmet_dependencies", {
        p_task_id: child.id,
      });

    if (dependencyError) {
      throw new Error(dependencyError.message);
    }

    if (!(unmet?.length)) {
      next = child;
      break;
    }
  }

  if (!next) {
    return {
      ok: true,
      state: "WAITING",
      progress: rows.length
        ? Math.round((completed / rows.length) * 100)
        : 0,
    };
  }

  // 기술 오류 복구 시에만 ERROR -> WAITING
  if (next.status === "ERROR") {
    const { error: recoverError } = await supabase
      .from("tasks")
      .update({
        status: "WAITING",
        updated_at: new Date().toISOString(),
      })
      .eq("id", next.id);

    if (recoverError) {
      throw new Error(recoverError.message);
    }

    next = { ...next, status: "WAITING" };
  }

  try {
    const { result } = await executeTask(supabase, next);

    const completedAt = new Date().toISOString();

    await supabase
      .from("tasks")
      .update({
        status: "COMPLETED",
        completed_at: completedAt,
        updated_at: completedAt,
      })
      .eq("id", next.id);

    const { data: afterRoot } = await supabase
      .from("tasks")
      .select("status")
      .eq("id", root.id)
      .maybeSingle();

    const done = completed + 1;
    const progress = rows.length
      ? Math.round((done / rows.length) * 100)
      : 100;

    return {
      ok: true,
      state:
        afterRoot?.status === "PENDING_APPROVAL"
          ? "AWAITING_APPROVAL"
          : "RUNNING",
      progress,
      stepTitle: next.title,
      resultTitle: result.title,
    };
  } catch (error) {
    if (isResearchInsufficient(error)) {
      return {
        ok: true,
        state: "NEEDS_DECISION",
        progress: rows.length
          ? Math.round((completed / rows.length) * 100)
          : 0,
        stepTitle: next.title,
        decisionMessage: messageOf(error),
      };
    }

    throw error;
  }
}
