import {
  approvalsUrl,
  sendDiscordChannelMessage,
  taskUrl,
} from "@/lib/discord/notify";

function safeMetadata(value: any) {
  return value && typeof value === "object" ? value : {};
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    QUEUED: "대기",
    RUNNING: "작업 중",
    PAUSED: "대표 판단 필요",
    FAILED: "기술 오류",
    AWAITING_APPROVAL: "대표 승인 대기",
    COMPLETED: "완료",
  };

  return labels[status] ?? status;
}

function makeSignature(job: any) {
  const progress = Number(job.progress ?? 0);
  const step = job.current_step_title ?? "";

  if (job.status === "RUNNING" || job.status === "QUEUED") {
    return `${job.status}:${progress}:${step}`;
  }

  return `${job.status}:${step}:${job.last_error ?? ""}`;
}

function shouldSendProgress(job: any, previous?: string | null) {
  const current = makeSignature(job);

  if (!previous) return true;
  if (previous === current) return false;

  // 진행률이 너무 자주 바뀌는 경우 Discord가 도배되지 않도록
  // 25% 단위 또는 단계명 변경 시에만 전송합니다.
  const prevParts = previous.split(":");
  const prevProgress = Number(prevParts[1] ?? -1);
  const nowProgress = Number(job.progress ?? 0);
  const prevStep = prevParts.slice(2).join(":");
  const nowStep = job.current_step_title ?? "";

  const bucketChanged =
    Math.floor(Math.max(prevProgress, 0) / 25) !==
    Math.floor(Math.max(nowProgress, 0) / 25);

  return bucketChanged || prevStep !== nowStep;
}

async function markNotified(
  supabase: any,
  job: any,
  signature: string,
) {
  const metadata = {
    ...safeMetadata(job.metadata),
    discord_notify_signature: signature,
    discord_notify_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("task_autopilot_jobs")
    .update({
      metadata,
    })
    .eq("id", job.id);

  if (error) throw new Error(error.message);
}

async function loadTask(supabase: any, taskId: string) {
  const { data, error } = await supabase
    .from("tasks")
    .select("id,task_code,title,status,execution_mode")
    .eq("id", taskId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function notifyDiscordForJob(
  supabase: any,
  job: any,
) {
  if (!job?.task_id) return { sent: false };

  const previous =
    safeMetadata(job.metadata).discord_notify_signature ?? null;

  const signature = makeSignature(job);

  if (previous === signature) {
    return { sent: false, reason: "duplicate" };
  }

  const task = await loadTask(supabase, job.task_id);

  if (!task) {
    return { sent: false, reason: "task_missing" };
  }

  const title = task.title || task.task_code || "SAWOL OFFICE 업무";
  const progress = Number(job.progress ?? 0);
  const step = job.current_step_title || "다음 단계 준비";
  const detailUrl = taskUrl(task.id);

  if (
    (job.status === "RUNNING" || job.status === "QUEUED") &&
    shouldSendProgress(job, previous)
  ) {
    await sendDiscordChannelMessage(
      "업무-진행상황",
      [
        "🔄 **업무 진행 중**",
        "",
        `**${title}**`,
        `상태: ${statusLabel(job.status)}`,
        `진행률: ${progress}%`,
        `현재 단계: ${step}`,
        job.last_message ? `보고: ${job.last_message}` : "",
        "",
        `상세 보기: ${detailUrl}`,
      ]
        .filter(Boolean)
        .join("\n"),
    );

    await markNotified(supabase, job, signature);
    return { sent: true, channel: "업무-진행상황" };
  }

  if (job.status === "AWAITING_APPROVAL") {
    await sendDiscordChannelMessage(
      "대표-승인대기",
      [
        "🟡 **대표 승인 대기**",
        "",
        `**${title}**`,
        `업무 코드: ${task.task_code ?? "-"}`,
        "AI 직원 협업과 내부 검수가 완료되었습니다.",
        "",
        `승인함: ${approvalsUrl()}`,
        `업무 상세: ${detailUrl}`,
      ].join("\n"),
    );

    await sendDiscordChannelMessage(
      "업무-완료보고",
      [
        "✅ **AI 작업 완료 · 대표 확인 요청**",
        "",
        `**${title}**`,
        "최종 결과가 승인 단계로 이동했습니다.",
        `업무 상세: ${detailUrl}`,
      ].join("\n"),
    );

    await markNotified(supabase, job, signature);
    return {
      sent: true,
      channel: "대표-승인대기",
    };
  }

  if (job.status === "PAUSED") {
    const message = [
      "⚠️ **대표 판단 필요**",
      "",
      `**${title}**`,
      job.last_message || "자동 복구로 해결하기 어려운 조건이 남았습니다.",
      "",
      `업무 상세: ${detailUrl}`,
    ].join("\n");

    await sendDiscordChannelMessage(
      "대표-긴급보고",
      message,
    );

    await sendDiscordChannelMessage(
      "오류-복구보고",
      message,
    );

    await markNotified(supabase, job, signature);
    return {
      sent: true,
      channel: "대표-긴급보고",
    };
  }

  if (job.status === "FAILED") {
    await sendDiscordChannelMessage(
      "오류-복구보고",
      [
        "🔴 **자동 실행 기술 오류**",
        "",
        `**${title}**`,
        job.last_error
          ? `오류: ${job.last_error}`
          : "기술 오류로 자동 처리가 중단되었습니다.",
        "",
        "기존 작업 내용은 보존됩니다.",
        `업무 상세: ${detailUrl}`,
      ].join("\n"),
    );

    await markNotified(supabase, job, signature);
    return {
      sent: true,
      channel: "오류-복구보고",
    };
  }

  if (job.status === "COMPLETED") {
    await sendDiscordChannelMessage(
      "업무-완료보고",
      [
        "✅ **업무 완료**",
        "",
        `**${title}**`,
        `업무 코드: ${task.task_code ?? "-"}`,
        `업무 상세: ${detailUrl}`,
      ].join("\n"),
    );

    await markNotified(supabase, job, signature);
    return {
      sent: true,
      channel: "업무-완료보고",
    };
  }

  return { sent: false, reason: "no_notification_rule" };
}

export async function sweepDiscordJobNotifications(
  supabase: any,
) {
  const { data: jobs, error } = await supabase
    .from("task_autopilot_jobs")
    .select(
      "id,task_id,status,progress,current_step_title,last_message,last_error,metadata,updated_at,created_at",
    )
    .in("status", [
      "QUEUED",
      "RUNNING",
      "PAUSED",
      "FAILED",
      "AWAITING_APPROVAL",
      "COMPLETED",
    ])
    .order("updated_at", { ascending: false })
    .limit(25);

  if (error) throw new Error(error.message);

  let sent = 0;

  for (const job of jobs ?? []) {
    try {
      const result = await notifyDiscordForJob(
        supabase,
        job,
      );

      if (result.sent) sent += 1;
    } catch (error) {
      console.error(
        "Discord notification failed:",
        job.task_id,
        error,
      );
    }
  }

  return { sent };
}
