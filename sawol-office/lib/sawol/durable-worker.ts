import { randomUUID } from "node:crypto";
import { buildEmployeeWorkloads, rankEmployeesForTask } from "@/lib/sawol/assignment";
import { buildWorkflowPlan } from "@/lib/sawol/workflow";
import { runAutopilotStep } from "@/lib/sawol/autopilot-runner";

const CLOSED_TASKS = new Set([
  "COMPLETED",
  "PENDING_APPROVAL",
  "CANCELLED",
  "CANCELED",
]);

// Vercel worker maxDuration(300s)보다 충분히 길게 잡아
// 정상 실행 중인 AI 요청을 "멈춘 작업"으로 오인하지 않습니다.
const STALE_MS = 8 * 60 * 1000;
const MAX_CONSECUTIVE_FAILURES = 3;
const RETRY_DELAYS_MS = [
  60 * 1000,
  3 * 60 * 1000,
  10 * 60 * 1000,
];

type CandidateSource =
  | "QUEUED"
  | "STALE_RUNNING"
  | "FAILED_RECOVERY"
  | "MISSING_JOB";

type WorkerCandidate = {
  taskId: string;
  source: CandidateSource;
  job?: any | null;
};

function isStale(value?: string | null) {
  if (!value) return true;
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) return true;
  return Date.now() - parsed > STALE_MS;
}

function metadataOf(job: any) {
  return job?.metadata &&
    typeof job.metadata === "object" &&
    !Array.isArray(job.metadata)
    ? job.metadata
    : {};
}

function numeric(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function retryIsDue(job: any) {
  const retryAfter = metadataOf(job).retry_after;
  if (typeof retryAfter !== "string" || !retryAfter) {
    return true;
  }

  const retryAt = new Date(retryAfter).getTime();
  if (!Number.isFinite(retryAt)) return true;
  return retryAt <= Date.now();
}

function reliabilityMetadata(
  job: any,
  patch: Record<string, unknown>,
) {
  return {
    ...metadataOf(job),
    ...patch,
  };
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
        source: "STEP34_STABLE_WORKER",
        consecutive_failures: 0,
        retry_after: null,
        retry_exhausted: false,
      },
    })
    .select("*")
    .maybeSingle();

  if (!error && data) return data;

  // 동시에 두 worker가 같은 신규 업무를 발견해도 unique(task_id) 충돌을
  // 장애로 취급하지 않고 이미 만들어진 job을 다시 읽습니다.
  const recovered = await supabase
    .from("task_autopilot_jobs")
    .select("*")
    .eq("task_id", taskId)
    .maybeSingle();

  if (recovered.error) {
    throw new Error(recovered.error.message);
  }

  if (recovered.data) return recovered.data;

  throw new Error(error?.message || "AUTO_JOB_NOT_CREATED");
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
  let nextValues = { ...values };

  if (Object.prototype.hasOwnProperty.call(values, "metadata")) {
    const current = await supabase
      .from("task_autopilot_jobs")
      .select("metadata")
      .eq("task_id", taskId)
      .maybeSingle();

    if (current.error) {
      throw new Error(current.error.message);
    }

    nextValues = {
      ...values,
      metadata: {
        ...(current.data?.metadata &&
        typeof current.data.metadata === "object"
          ? current.data.metadata
          : {}),
        ...((values.metadata &&
        typeof values.metadata === "object"
          ? values.metadata
          : {}) as Record<string, unknown>),
      },
    };
  }

  const { error } = await supabase
    .from("task_autopilot_jobs")
    .update({
      ...nextValues,
      heartbeat_at: new Date().toISOString(),
    })
    .eq("task_id", taskId);

  if (error) throw new Error(error.message);
}

async function findCandidate(
  supabase: any,
): Promise<WorkerCandidate | null> {
  // 1) 일반 QUEUED 작업.
  // transient retry_after가 남아 있으면 시간이 된 job만 선택합니다.
  const { data: queuedRows, error: queuedError } = await supabase
    .from("task_autopilot_jobs")
    .select("*")
    .eq("status", "QUEUED")
    .order("created_at", { ascending: true })
    .limit(50);

  if (queuedError) throw new Error(queuedError.message);

  const queued = (queuedRows ?? []).find((row: any) =>
    retryIsDue(row),
  );

  if (queued?.task_id) {
    return {
      taskId: queued.task_id,
      source: "QUEUED",
      job: queued,
    };
  }

  // 2) 오래 멈춘 RUNNING job 복구.
  // 정상 AI 요청의 최대 실행시간보다 STALE_MS가 길기 때문에
  // 여기 잡히는 job은 이전 worker가 종료된 것으로 봅니다.
  const { data: runningRows, error: runningError } = await supabase
    .from("task_autopilot_jobs")
    .select("*")
    .eq("status", "RUNNING")
    .order("heartbeat_at", { ascending: true })
    .limit(30);

  if (runningError) throw new Error(runningError.message);

  const stale = (runningRows ?? []).find((row: any) =>
    isStale(
      row.heartbeat_at || row.updated_at || row.started_at,
    ),
  );

  if (stale?.task_id) {
    return {
      taskId: stale.task_id,
      source: "STALE_RUNNING",
      job: stale,
    };
  }

  // 3) 이전 버전에서 FAILED로 남은 job도 자동 복구 대상에 포함.
  const { data: failedRows, error: failedError } = await supabase
    .from("task_autopilot_jobs")
    .select("*")
    .eq("status", "FAILED")
    .order("updated_at", { ascending: true })
    .limit(30);

  if (failedError) throw new Error(failedError.message);

  const failed = (failedRows ?? []).find((row: any) => {
    const metadata = metadataOf(row);
    const failures = numeric(
      metadata.consecutive_failures,
      0,
    );

    return (
      failures < MAX_CONSECUTIVE_FAILURES &&
      metadata.retry_exhausted !== true &&
      retryIsDue(row)
    );
  });

  if (failed?.task_id) {
    return {
      taskId: failed.task_id,
      source: "FAILED_RECOVERY",
      job: failed,
    };
  }

  // 4) AUTO root 업무인데 durable job 자체가 없는 경우 자동 생성.
  const { data: rootTasks, error: rootTaskError } = await supabase
    .from("tasks")
    .select(
      "id,status,execution_mode,parent_task_id,created_at",
    )
    .eq("execution_mode", "AUTO")
    .is("parent_task_id", null)
    .order("created_at", { ascending: true })
    .limit(50);

  if (rootTaskError) throw new Error(rootTaskError.message);

  for (const task of rootTasks ?? []) {
    if (CLOSED_TASKS.has(task.status)) continue;

    const { data: job, error: jobError } = await supabase
      .from("task_autopilot_jobs")
      .select("id")
      .eq("task_id", task.id)
      .maybeSingle();

    if (jobError) throw new Error(jobError.message);

    if (!job) {
      return {
        taskId: task.id,
        source: "MISSING_JOB",
        job: null,
      };
    }
  }

  return null;
}

async function claimJob(
  supabase: any,
  job: any,
  source: CandidateSource,
) {
  const now = new Date().toISOString();
  const leaseToken = randomUUID();
  const currentMetadata = metadataOf(job);

  let query = supabase
    .from("task_autopilot_jobs")
    .update({
      status: "RUNNING",
      started_at: job.started_at || now,
      heartbeat_at: now,
      attempt_count: numeric(job.attempt_count, 0) + 1,
      last_error: null,
      last_message:
        source === "STALE_RUNNING"
          ? "중단된 이전 실행을 안전하게 복구하여 이어서 처리합니다."
          : source === "FAILED_RECOVERY"
            ? "이전 기술 오류를 자동 복구하여 다시 처리합니다."
            : "상시 AI 작업자가 업무를 이어서 처리 중입니다.",
      metadata: {
        ...currentMetadata,
        source: "STEP34_STABLE_WORKER",
        lease_token: leaseToken,
        lease_started_at: now,
        last_claim_source: source,
        recovered_stale:
          source === "STALE_RUNNING"
            ? true
            : currentMetadata.recovered_stale ?? false,
      },
    })
    .eq("id", job.id)
    .eq("status", job.status);

  // stale RUNNING 복구는 같은 heartbeat를 본 worker 한 명만 claim.
  if (job.status === "RUNNING" && job.heartbeat_at) {
    query = query.eq("heartbeat_at", job.heartbeat_at);
  }

  const { data, error } = await query
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);

  return data ?? null;
}

async function closeIneligibleJob(
  supabase: any,
  task: any,
) {
  if (task.status === "PENDING_APPROVAL") {
    await updateJob(supabase, task.id, {
      status: "AWAITING_APPROVAL",
      progress: 100,
      current_step_title: null,
      last_error: null,
      last_message:
        "업무가 이미 대표 승인 대기 상태라 자동 실행을 종료했습니다.",
      finished_at: new Date().toISOString(),
      metadata: {
        retry_after: null,
        consecutive_failures: 0,
        retry_exhausted: false,
      },
    });
    return "AWAITING_APPROVAL";
  }

  if (task.status === "COMPLETED") {
    await updateJob(supabase, task.id, {
      status: "COMPLETED",
      progress: 100,
      current_step_title: null,
      last_error: null,
      last_message:
        "업무가 이미 완료되어 자동 큐를 종료했습니다.",
      finished_at: new Date().toISOString(),
      metadata: {
        retry_after: null,
        consecutive_failures: 0,
        retry_exhausted: false,
      },
    });
    return "COMPLETED";
  }

  if (
    task.status === "CANCELLED" ||
    task.status === "CANCELED"
  ) {
    await updateJob(supabase, task.id, {
      status: "COMPLETED",
      current_step_title: null,
      last_error: null,
      last_message:
        "업무가 취소되어 자동 큐를 안전하게 종료했습니다.",
      finished_at: new Date().toISOString(),
      metadata: {
        terminal_reason: "TASK_CANCELLED",
        retry_after: null,
        retry_exhausted: false,
      },
    });
    return "COMPLETED";
  }

  await updateJob(supabase, task.id, {
    status: "PAUSED",
    current_step_title: null,
    last_message:
      "현재 자동 실행 대상이 아니어서 worker를 일시 정지했습니다.",
    finished_at: new Date().toISOString(),
    metadata: {
      pause_reason: "NOT_AUTO_ROOT_TASK",
      retry_after: null,
    },
  });

  return "PAUSED";
}


export async function runDurableWorkerOnce(supabase: any) {
  const candidate = await findCandidate(supabase);

  if (!candidate) {
    return {
      ok: true,
      state: "IDLE",
      message: "처리할 AUTO 업무가 없습니다.",
    };
  }

  const rootTaskId = candidate.taskId;

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", rootTaskId)
    .maybeSingle();

  if (taskError) throw new Error(taskError.message);

  // task가 이미 삭제된 orphan job은 반복해서 잡히지 않게 종료합니다.
  if (!task) {
    if (candidate.job?.id) {
      await supabase
        .from("task_autopilot_jobs")
        .update({
          status: "COMPLETED",
          last_message:
            "원본 업무가 없어 자동 큐를 종료했습니다.",
          finished_at: new Date().toISOString(),
          heartbeat_at: new Date().toISOString(),
          metadata: {
            ...metadataOf(candidate.job),
            terminal_reason: "TASK_NOT_FOUND",
            retry_after: null,
          },
        })
        .eq("id", candidate.job.id);
    }

    return {
      ok: true,
      state: "SKIPPED",
      taskId: rootTaskId,
      message: "업무를 찾지 못해 자동 큐를 종료했습니다.",
    };
  }

  let job = candidate.job ?? (await ensureJob(supabase, rootTaskId));

  // AUTO root가 아니거나 이미 종료된 업무는 큐 상태도 함께 정리합니다.
  if (
    task.execution_mode !== "AUTO" ||
    task.parent_task_id ||
    CLOSED_TASKS.has(task.status)
  ) {
    const state = await closeIneligibleJob(supabase, task);

    return {
      ok: true,
      state,
      taskId: rootTaskId,
      message:
        "현재 업무 상태에 맞게 자동 큐를 정리했습니다.",
    };
  }

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

  // 여러 cron/request가 동시에 같은 업무를 집어도 한 worker만 실행.
  const claimed = await claimJob(
    supabase,
    job,
    candidate.source,
  );

  if (!claimed) {
    return {
      ok: true,
      state: "BUSY",
      taskId: rootTaskId,
      message:
        "다른 worker가 이미 이 업무를 처리 중이라 중복 실행을 건너뛰었습니다.",
    };
  }

  job = claimed;

  try {
    await prepareRootTask(supabase, task);

    // 준비가 끝난 시점에도 heartbeat를 갱신해 stale 오인 가능성을 낮춥니다.
    await updateJob(supabase, rootTaskId, {
      last_message:
        "직원 배정과 업무 구조를 확인했습니다. 현재 단계를 실행합니다.",
      metadata: {
        last_prepare_at: new Date().toISOString(),
      },
    });

    const payload = await runAutopilotStep(
      supabase,
      rootTaskId,
    );

    const successMetadata = {
      source: "STEP34_STABLE_WORKER",
      consecutive_failures: 0,
      retry_after: null,
      retry_exhausted: false,
      last_success_at: new Date().toISOString(),
      last_success_state: payload.state,
    };

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
          ...successMetadata,
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
        metadata: successMetadata,
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
        metadata: successMetadata,
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
      metadata: successMetadata,
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

    const current = await supabase
      .from("task_autopilot_jobs")
      .select("*")
      .eq("task_id", rootTaskId)
      .maybeSingle();

    if (current.error) {
      throw new Error(current.error.message);
    }

    const currentJob = current.data ?? job;
    const currentMetadata = metadataOf(currentJob);
    const previousFailures = numeric(
      currentMetadata.consecutive_failures,
      0,
    );
    const consecutiveFailures = previousFailures + 1;

    // 같은 기술 오류가 반복되면 무한 루프 대신 대표 판단으로 전환.
    if (
      consecutiveFailures >= MAX_CONSECUTIVE_FAILURES
    ) {
      await updateJob(supabase, rootTaskId, {
        status: "PAUSED",
        last_error: message,
        last_message:
          `기술 오류가 연속 ${consecutiveFailures}회 발생해 자동 재시도를 중지했습니다. ` +
          "대표 확인 후 다시 실행해 주세요.",
        finished_at: new Date().toISOString(),
        metadata: {
          source: "STEP34_STABLE_WORKER",
          consecutive_failures: consecutiveFailures,
          retry_after: null,
          retry_exhausted: true,
          pause_reason: "RETRY_EXHAUSTED",
          last_failure_at: new Date().toISOString(),
        },
      });

      return {
        ok: false,
        state: "PAUSED",
        taskId: rootTaskId,
        message:
          "자동 복구 횟수를 초과해 대표 확인 상태로 전환했습니다.",
      };
    }

    const delay =
      RETRY_DELAYS_MS[
        Math.min(
          consecutiveFailures - 1,
          RETRY_DELAYS_MS.length - 1,
        )
      ];
    const retryAfter = new Date(
      Date.now() + delay,
    ).toISOString();

    // 일시적인 기술 오류는 FAILED 알림을 반복해서 보내지 않고
    // QUEUED + retry_after로 조용히 자동 복구합니다.
    await updateJob(supabase, rootTaskId, {
      status: "QUEUED",
      last_error: message,
      last_message:
        `기술 오류 ${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES} · ` +
        `${Math.ceil(delay / 60000)}분 후 자동 재시도합니다.`,
      finished_at: null,
      metadata: {
        source: "STEP34_STABLE_WORKER",
        consecutive_failures: consecutiveFailures,
        retry_after: retryAfter,
        retry_exhausted: false,
        last_failure_at: new Date().toISOString(),
      },
    });

    return {
      ok: false,
      state: "RETRY_SCHEDULED",
      taskId: rootTaskId,
      retryAfter,
      attempt: consecutiveFailures,
      message,
    };
  }
}
