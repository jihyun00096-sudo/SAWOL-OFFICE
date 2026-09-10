import { buildEmployeeWorkloads, rankEmployeesForTask } from "@/lib/sawol/assignment";
import { buildWorkflowPlan } from "@/lib/sawol/workflow";
import { runAutopilotStep } from "@/lib/sawol/autopilot-runner";

const CLOSED_TASKS = new Set([
  "COMPLETED",
  "PENDING_APPROVAL",
  "CANCELLED",
  "CANCELED",
]);

const STALE_MS = 4 * 60 * 1000;

function isStale(value?: string | null) {
  if (!value) return true;
  return Date.now() - new Date(value).getTime() > STALE_MS;
}

async function loadOfficeContext(supabase: any, rootTaskId: string) {
  const [employeesResult, departmentsResult, tasksResult] = await Promise.all([
    supabase
      .from("employees")
      .select(
        "id,name,employee_code,department_id,position,specialty,responsibilities,work_style,status,is_active",
      )
      .eq("is_active", true),

    supabase
      .from("departments")
      .select("id,name,code,parent_department_id"),

    supabase
      .from("tasks")
      .select("id,assigned_employee_id,status"),
  ]);

  if (employeesResult.error) {
    throw new Error(employeesResult.error.message);
  }

  if (departmentsResult.error) {
    throw new Error(departmentsResult.error.message);
  }

  if (tasksResult.error) {
    throw new Error(tasksResult.error.message);
  }

  return {
    employees: employeesResult.data ?? [],
    departments: departmentsResult.data ?? [],
    workloads: buildEmployeeWorkloads(
      tasksResult.data ?? [],
      rootTaskId,
    ),
  };
}

async function ensureJob(supabase: any, taskId: string) {
  const { data: existing, error: existingError } = await supabase
    .from("task_autopilot_jobs")
    .select("*")
    .eq("task_id", taskId)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);

  if (existing) return existing;

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("task_autopilot_jobs")
    .insert({
      task_id: taskId,
      status: "QUEUED",
      progress: 0,
      last_message: "상시 작업 큐에 등록되었습니다.",
      heartbeat_at: now,
      metadata: {
        source: "STEP23_1_DURABLE_WORKER",
      },
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  return data;
}

async function prepareRootTask(supabase: any, task: any) {
  if (task.workflow_id || task.assigned_employee_id) {
    return;
  }

  const { employees, departments, workloads } =
    await loadOfficeContext(supabase, task.id);

  const plan = buildWorkflowPlan({
    task: {
      title: task.title,
      description: task.description,
      task_type: task.task_type,
      priority: task.priority,
    },
    employees,
    departments,
    workloads,
  });

  if (plan.mode === "SINGLE") {
    const ranked = rankEmployeesForTask({
      title: task.title,
      description: task.description ?? "",
      taskType: task.task_type,
      departmentId: task.assigned_department_id ?? null,
      employees,
      departments,
      workloads,
    });

    const top = ranked[0];

    if (!top) {
      throw new Error("자동 배정 가능한 AI 직원을 찾지 못했습니다.");
    }

    const { error } = await supabase.rpc("sawol_assign_task", {
      p_task_id: task.id,
      p_employee_id: top.employee.id,
      p_assignment_source: "DURABLE_WORKER",
      p_assignment_reason:
        top.reasons.join(" / ") ||
        "STEP23-1 상시 작업 큐 자동 배정",
      p_match_score: top.score ?? null,
      p_metadata: {
        source: "STEP23_1_DURABLE_WORKER",
      },
    });

    if (error) throw new Error(error.message);
    return;
  }

  if (plan.steps.some((step) => !step.employeeId)) {
    throw new Error(
      "협업 업무에 필요한 AI 직원을 충분히 배정하지 못했습니다.",
    );
  }

  const { error } = await supabase.rpc("sawol_create_workflow", {
    p_root_task_id: task.id,
    p_steps: plan.steps.map((step) => ({
      key: step.key,
      title: step.title,
      description: step.description,
      task_type: step.taskType,
      priority: step.priority,
      employee_id: step.employeeId,
      department_id: step.departmentId || null,
      match_score: step.matchScore,
      assignment_reason: step.assignmentReason,
      depends_on: step.dependsOn,
    })),
  });

  if (
    error &&
    !String(error.message).includes("WORKFLOW_ALREADY_EXISTS")
  ) {
    throw new Error(error.message);
  }
}

async function updateJob(
  supabase: any,
  taskId: string,
  values: Record<string, unknown>,
) {
  const { error } = await supabase
    .from("task_autopilot_jobs")
    .update({
      ...values,
      heartbeat_at: new Date().toISOString(),
    })
    .eq("task_id", taskId);

  if (error) throw new Error(error.message);
}

async function findCandidate(supabase: any) {
  // 1) 명시적으로 QUEUED 된 작업
  const { data: queued } = await supabase
    .from("task_autopilot_jobs")
    .select("task_id,status,heartbeat_at,updated_at,started_at")
    .eq("status", "QUEUED")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (queued?.task_id) return queued.task_id;

  // 2) 오래 멈춘 RUNNING 작업 복구
  const { data: runningRows } = await supabase
    .from("task_autopilot_jobs")
    .select("task_id,status,heartbeat_at,updated_at,started_at")
    .eq("status", "RUNNING")
    .order("heartbeat_at", { ascending: true })
    .limit(20);

  const stale = (runningRows ?? []).find((row: any) =>
    isStale(row.heartbeat_at || row.updated_at || row.started_at),
  );

  if (stale?.task_id) return stale.task_id;

  // 3) AUTO 업무인데 job 자체가 아직 없는 작업
  const { data: rootTasks } = await supabase
    .from("tasks")
    .select(
      "id,status,execution_mode,parent_task_id,created_at",
    )
    .eq("execution_mode", "AUTO")
    .is("parent_task_id", null)
    .order("created_at", { ascending: true })
    .limit(50);

  for (const task of rootTasks ?? []) {
    if (CLOSED_TASKS.has(task.status)) continue;

    const { data: job } = await supabase
      .from("task_autopilot_jobs")
      .select("task_id")
      .eq("task_id", task.id)
      .maybeSingle();

    if (!job) return task.id;
  }

  return null;
}

export async function runDurableWorkerOnce(supabase: any) {
  const rootTaskId = await findCandidate(supabase);

  if (!rootTaskId) {
    return {
      ok: true,
      state: "IDLE",
      message: "처리할 AUTO 업무가 없습니다.",
    };
  }

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", rootTaskId)
    .maybeSingle();

  if (taskError) throw new Error(taskError.message);
  if (!task) {
    return {
      ok: true,
      state: "SKIPPED",
      message: "업무를 찾지 못해 건너뛰었습니다.",
    };
  }

  if (
    task.execution_mode !== "AUTO" ||
    task.parent_task_id ||
    CLOSED_TASKS.has(task.status)
  ) {
    return {
      ok: true,
      state: "SKIPPED",
      taskId: rootTaskId,
      message: "자동 처리 대상이 아닌 업무입니다.",
    };
  }

  const job = await ensureJob(supabase, rootTaskId);

  if (
    ["PAUSED", "AWAITING_APPROVAL", "COMPLETED"].includes(
      job.status,
    )
  ) {
    return {
      ok: true,
      state: job.status,
      taskId: rootTaskId,
      message: "현재 상태에서는 자동 실행하지 않습니다.",
    };
  }

  const now = new Date().toISOString();

  await updateJob(supabase, rootTaskId, {
    status: "RUNNING",
    started_at: job.started_at || now,
    attempt_count: (job.attempt_count ?? 0) + 1,
    last_error: null,
    last_message: "상시 AI 작업자가 업무를 이어서 처리 중입니다.",
  });

  try {
    await prepareRootTask(supabase, task);

    const payload = await runAutopilotStep(
      supabase,
      rootTaskId,
    );

    if (payload.state === "NEEDS_DECISION") {
      await updateJob(supabase, rootTaskId, {
        status: "PAUSED",
        progress: payload.progress,
        current_step_title: payload.stepTitle ?? null,
        last_message:
          payload.decisionMessage ||
          "대표 판단이 필요한 조건이 남아 있습니다.",
        last_error: null,
        finished_at: new Date().toISOString(),
        metadata: {
          source: "STEP23_1_DURABLE_WORKER",
          pause_reason: "NEEDS_DECISION",
        },
      });

      return {
        ok: true,
        state: "PAUSED",
        taskId: rootTaskId,
        progress: payload.progress,
      };
    }

    if (payload.state === "AWAITING_APPROVAL") {
      await updateJob(supabase, rootTaskId, {
        status: "AWAITING_APPROVAL",
        progress: 100,
        current_step_title: null,
        last_message:
          "AI 협업과 내부 검수가 완료되어 대표 승인함으로 이동했습니다.",
        last_error: null,
        finished_at: new Date().toISOString(),
      });

      return {
        ok: true,
        state: "AWAITING_APPROVAL",
        taskId: rootTaskId,
        progress: 100,
      };
    }

    if (payload.state === "COMPLETED") {
      await updateJob(supabase, rootTaskId, {
        status: "COMPLETED",
        progress: 100,
        current_step_title: null,
        last_message: "자동 업무가 완료되었습니다.",
        last_error: null,
        finished_at: new Date().toISOString(),
      });

      return {
        ok: true,
        state: "COMPLETED",
        taskId: rootTaskId,
        progress: 100,
      };
    }

    await updateJob(supabase, rootTaskId, {
      status: "QUEUED",
      progress: payload.progress,
      current_step_title: payload.stepTitle ?? null,
      last_message: payload.stepTitle
        ? `${payload.stepTitle} 완료 · 다음 실행 주기에 다음 단계로 인계합니다.`
        : "다음 자동 실행 주기에 업무를 이어서 처리합니다.",
      last_error: null,
    });

    return {
      ok: true,
      state: "QUEUED",
      taskId: rootTaskId,
      progress: payload.progress,
      stepTitle: payload.stepTitle ?? null,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message.slice(0, 700)
        : "상시 작업자 실행 중 오류가 발생했습니다.";

    await updateJob(supabase, rootTaskId, {
      status: "FAILED",
      last_error: message,
      last_message:
        "기술 오류로 중단되었습니다. 다음 복구 실행에서 다시 확인할 수 있습니다.",
      finished_at: new Date().toISOString(),
    });

    throw error;
  }
}
