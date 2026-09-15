function safeMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, any>;
}

export async function findRootTaskByReference(
  supabase: any,
  reference: string,
) {
  const value = reference.trim();

  if (!value) {
    throw new Error("업무 코드가 필요합니다.");
  }

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );

  let query = supabase
    .from("tasks")
    .select(
      "id,parent_task_id,task_code,title,status,execution_mode,workflow_id",
    );

  query = isUuid
    ? query.eq("id", value)
    : query.eq("task_code", value);

  const { data: task, error } = await query.maybeSingle();

  if (error || !task) {
    throw new Error(`업무를 찾을 수 없습니다: ${value}`);
  }

  if (task.parent_task_id) {
    throw new Error(
      "협업 자식 업무가 아니라 메인 업무 코드로 승인/반려해주세요.",
    );
  }

  return task;
}

export async function finalizeTaskFromControl(
  supabase: any,
  taskId: string,
) {
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id,task_code,title,status,parent_task_id")
    .eq("id", taskId)
    .maybeSingle();

  if (taskError || !task) {
    throw new Error("승인할 업무를 찾을 수 없습니다.");
  }

  if (task.parent_task_id) {
    throw new Error("메인 업무만 대표 승인할 수 있습니다.");
  }

  if (task.status !== "PENDING_APPROVAL") {
    throw new Error(
      `현재 승인 가능한 상태가 아닙니다. 현재 상태: ${task.status}`,
    );
  }

  const { data, error } = await supabase.rpc(
    "sawol_finalize_task_approval",
    {
      p_task_id: taskId,
    },
  );

  if (error) {
    throw new Error(`승인 완료 처리에 실패했습니다. ${error.message}`);
  }

  const now = new Date().toISOString();

  await supabase
    .from("task_feedback")
    .update({
      status: "RESOLVED",
      resolved_at: now,
    })
    .eq("root_task_id", taskId)
    .eq("status", "ACTIVE");

  // Discord/Worker 완료 보고가 확실히 동작하도록 job도 완료 상태로 동기화합니다.
  const { data: job } = await supabase
    .from("task_autopilot_jobs")
    .select("id,metadata")
    .eq("task_id", taskId)
    .maybeSingle();

  if (job) {
    await supabase
      .from("task_autopilot_jobs")
      .update({
        status: "COMPLETED",
        progress: 100,
        current_step_title: "대표 승인 완료",
        last_message:
          "대표가 최종 결과를 승인하여 업무가 완료되었습니다.",
        last_error: null,
        finished_at: now,
        heartbeat_at: now,
        metadata: {
          ...safeMetadata(job.metadata),
          discord_notify_signature: null,
          approved_at: now,
          approved_source: "DISCORD_OR_WEB",
        },
      })
      .eq("id", job.id);
  }

  return {
    task,
    finalize: data,
  };
}

export async function rejectTaskFromControl(
  supabase: any,
  taskId: string,
  reason: string,
  source = "WEB_APPROVALS",
) {
  const trimmed = reason.trim();

  if (!trimmed) {
    throw new Error("반려 사유를 입력해주세요.");
  }

  if (trimmed.length > 2000) {
    throw new Error("반려 사유는 2,000자 이내로 입력해주세요.");
  }

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select(
      "id,parent_task_id,task_code,title,status,execution_mode,workflow_id",
    )
    .eq("id", taskId)
    .maybeSingle();

  if (taskError || !task) {
    throw new Error("반려할 업무를 찾을 수 없습니다.");
  }

  if (task.parent_task_id) {
    throw new Error("메인 업무만 대표 반려할 수 있습니다.");
  }

  if (task.status !== "PENDING_APPROVAL") {
    throw new Error(
      `현재 반려 가능한 상태가 아닙니다. 현재 상태: ${task.status}`,
    );
  }

  const { data: rejectResult, error: rejectError } =
    await supabase.rpc("sawol_reject_autonomous_task", {
      p_root_task_id: taskId,
      p_reason: trimmed,
    });

  if (rejectError) {
    throw new Error(
      `반려 처리에 실패했습니다. ${rejectError.message}`,
    );
  }

  if (task.execution_mode !== "AUTO") {
    return {
      task,
      mode: "MANUAL",
      state: "WAITING",
      rejection: rejectResult,
    };
  }

  const now = new Date().toISOString();

  const { data: existingJob, error: jobLoadError } =
    await supabase
      .from("task_autopilot_jobs")
      .select("id,metadata")
      .eq("task_id", taskId)
      .maybeSingle();

  if (jobLoadError) {
    throw new Error(
      `반려는 저장됐지만 AUTO 재작업 큐 상태를 읽지 못했습니다. ${jobLoadError.message}`,
    );
  }

  const rejectionMetadata = {
    ...safeMetadata(existingJob?.metadata),
    rejection: {
      reason: trimmed,
      rejected_at: now,
      source,
      task_code: task.task_code ?? null,
      title: task.title ?? null,
      reopen_from:
        (rejectResult as any)?.reopen_from ?? null,
      fresh_research:
        Boolean((rejectResult as any)?.fresh_research),
      full_restart:
        Boolean((rejectResult as any)?.full_restart),
    },
    discord_notify_signature: null,
    discord_rejection_notify_at: null,
  };

  if (!existingJob) {
    const { error: insertError } = await supabase
      .from("task_autopilot_jobs")
      .insert({
        task_id: taskId,
        status: "QUEUED",
        progress: 0,
        current_step_title: "대표 반려 재작업 준비",
        last_message:
          "대표 반려가 접수되어 상시 AI 작업 큐에 재등록되었습니다.",
        last_error: null,
        attempt_count: 0,
        started_at: null,
        heartbeat_at: now,
        finished_at: null,
        metadata: rejectionMetadata,
      });

    if (insertError) {
      throw new Error(
        `반려는 저장됐지만 AUTO 재작업 큐 등록에 실패했습니다. ${insertError.message}`,
      );
    }
  } else {
    const { error: resetError } = await supabase
      .from("task_autopilot_jobs")
      .update({
        status: "QUEUED",
        progress: 0,
        current_step_title: "대표 반려 재작업 준비",
        last_message:
          "대표 반려가 접수되어 상시 AI 작업 큐에 재등록되었습니다.",
        last_error: null,
        finished_at: null,
        heartbeat_at: now,
        metadata: rejectionMetadata,
      })
      .eq("task_id", taskId);

    if (resetError) {
      throw new Error(
        `반려는 저장됐지만 AUTO 재작업 큐 초기화에 실패했습니다. ${resetError.message}`,
      );
    }
  }

  return {
    task,
    mode: "AUTO",
    state: "QUEUED",
    rejection: rejectResult,
  };
}
