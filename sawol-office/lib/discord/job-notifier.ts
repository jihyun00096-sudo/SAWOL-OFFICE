import {
  approvalButtons,
  resultLinkButtons,
  resultUrl,
  runUrl,
  sendOrUpdateDiscordChannelMessage,
  taskLinkButtons,
  updateDiscordMessage,
} from "@/lib/discord/notify";

type JsonMap = Record<string, any>;

function safeMetadata(value: any): JsonMap {
  return value && typeof value === "object" ? value : {};
}

function truncate(text: string | null | undefined, max = 220) {
  const value = typeof text === "string" ? text.trim() : "";
  if (!value) return "-";
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    QUEUED: "대기",
    RUNNING: "진행 중",
    PAUSED: "대표 판단 필요",
    FAILED: "기술 오류",
    AWAITING_APPROVAL: "대표 승인 대기",
    COMPLETED: "완료",
  };

  return labels[status] ?? status;
}

function progressSignature(job: any) {
  return [
    job.status ?? "",
    Number(job.progress ?? 0),
    job.current_step_title ?? "",
    job.last_message ?? "",
    job.last_error ?? "",
  ].join("::");
}

function shouldUpdateProgress(job: any, previous?: string | null) {
  if (!previous) return true;

  const prev = previous.split("::");
  const prevStatus = prev[0] ?? "";
  const prevProgress = Number(prev[1] ?? -1);
  const prevStep = prev[2] ?? "";
  const prevMessage = prev[3] ?? "";

  const nowStatus = job.status ?? "";
  const nowProgress = Number(job.progress ?? 0);
  const nowStep = job.current_step_title ?? "";
  const nowMessage = job.last_message ?? "";

  if (prevStatus !== nowStatus) return true;
  if (prevStep !== nowStep) return true;
  if (prevMessage !== nowMessage) return true;

  return Math.floor(prevProgress / 25) !== Math.floor(nowProgress / 25);
}

async function markJobMetadata(supabase: any, jobId: string, metadata: JsonMap) {
  const { error } = await supabase
    .from("task_autopilot_jobs")
    .update({ metadata })
    .eq("id", jobId);

  if (error) throw new Error(error.message);
}

async function loadTask(supabase: any, taskId: string) {
  const { data, error } = await supabase
    .from("tasks")
    .select("id, task_code, title, description, status, execution_mode")
    .eq("id", taskId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

async function loadLatestArtifactInfo(supabase: any, taskId: string) {
  const [{ data: results }, { data: runs }] = await Promise.all([
    supabase
      .from("results")
      .select("id, title, summary, file_url, external_url, metadata, created_at")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("task_runs")
      .select("id, metadata, created_at")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  let latestResultUrl: string | null = null;
  let latestRunUrl: string | null = null;
  let summary: string | null = null;

  for (const row of results ?? []) {
    if (!latestResultUrl && row?.id) {
      latestResultUrl = resultUrl(row.id);
    }

    if (!summary) {
      const candidate =
        typeof row?.summary === "string" && row.summary.trim()
          ? row.summary.trim()
          : typeof row?.title === "string" && row.title.trim()
            ? row.title.trim()
            : null;

      if (candidate) summary = candidate;
    }
  }

  for (const row of runs ?? []) {
    if (!latestRunUrl && row?.id) {
      latestRunUrl = runUrl(row.id);
    }

    if (!summary) {
      const metadata = safeMetadata(row?.metadata);
      const final = safeMetadata(metadata.final_submission);
      const candidate =
        typeof final.summary === "string" && final.summary.trim()
          ? final.summary.trim()
          : null;

      if (candidate) summary = candidate;
    }
  }

  return {
    resultUrl: latestResultUrl,
    runUrl: latestRunUrl,
    summary,
  };
}

function buildCompactTaskBlock(args: {
  title: string;
  taskCode?: string | null;
  description?: string | null;
  status: string;
  progress?: number;
  currentStepTitle?: string | null;
  lastMessage?: string | null;
  lastError?: string | null;
  assigneeName?: string | null;
  header: string;
  footer?: string | null;
  showProgress?: boolean;
  showOriginal?: boolean;
}) {
  const top = [
    args.header,
    `**${truncate(args.title, 110)}**`,
    `\`${args.taskCode ?? "-"}\``,
  ];

  const state = [
    `**상태**  ${statusLabel(args.status)}`,
    args.assigneeName
      ? `**담당**  ${truncate(args.assigneeName, 50)}`
      : "",
    args.showProgress !== false &&
    typeof args.progress === "number"
      ? `**진행률**  ${args.progress}%`
      : "",
    args.currentStepTitle
      ? `**현재 단계**  ${truncate(args.currentStepTitle, 80)}`
      : "",
  ].filter(Boolean);

  const original =
    args.showOriginal !== false && args.description
      ? [
          "",
          "**업무 내용**",
          `> ${truncate(args.description, 320).replace(/\n/g, "\n> ")}`,
        ]
      : [];

  const report = args.lastError
    ? [
        "",
        "**오류 내용**",
        `> ${truncate(args.lastError, 260).replace(/\n/g, "\n> ")}`,
      ]
    : args.lastMessage
      ? [
          "",
          "**현재 보고**",
          `> ${truncate(args.lastMessage, 240).replace(/\n/g, "\n> ")}`,
        ]
      : [];

  const footer = args.footer
    ? ["", args.footer]
    : [];

  return [
    ...top,
    "",
    ...state,
    ...original,
    ...report,
    ...footer,
  ]
    .filter(Boolean)
    .join("\n");
}

async function upsertChannelMessage(args: {
  supabase: any;
  job: any;
  channelName: string;
  messageKey: string;
  content: string;
  components?: Record<string, unknown>[];
}) {
  const jobMeta = safeMetadata(args.job.metadata);
  const discordMessages = safeMetadata(jobMeta.discord_messages);
  const previous = safeMetadata(discordMessages[args.messageKey]);

  const result = await sendOrUpdateDiscordChannelMessage({
    channelName: args.channelName,
    content: args.content,
    previousMessageId:
      typeof previous.message_id === "string" ? previous.message_id : null,
    components: args.components,
    suppressEmbeds: true,
  });

  const nextMetadata = {
    ...jobMeta,
    discord_messages: {
      ...discordMessages,
      [args.messageKey]: {
        channel_name: args.channelName,
        channel_id: result.channelId,
        message_id: result.messageId,
        updated_at: new Date().toISOString(),
      },
    },
  };

  await markJobMetadata(args.supabase, args.job.id, nextMetadata);
  return result;
}


async function updateStoredDiscordMessage(args: {
  job: any;
  messageKey: string;
  content: string;
  components?: Record<string, unknown>[];
}) {
  const metadata = safeMetadata(args.job.metadata);
  const discordMessages = safeMetadata(metadata.discord_messages);
  const previous = safeMetadata(discordMessages[args.messageKey]);

  const channelId =
    typeof previous.channel_id === "string" ? previous.channel_id : null;
  const messageId =
    typeof previous.message_id === "string" ? previous.message_id : null;

  if (!channelId || !messageId) return false;

  try {
    await updateDiscordMessage({
      channelId,
      messageId,
      content: args.content,
      components: args.components,
      suppressEmbeds: true,
    });
    return true;
  } catch (error) {
    console.error(
      `Discord stored message update failed: ${args.messageKey}`,
      error,
    );
    return false;
  }
}

export async function notifyDiscordForJob(supabase: any, job: any) {
  if (!job?.task_id) return { sent: false };

  const task = await loadTask(supabase, job.task_id);

  if (!task) {
    return { sent: false, reason: "task_missing" };
  }

  const metadata = safeMetadata(job.metadata);
  const signature = progressSignature(job);
  const previousSignature =
    typeof metadata.discord_progress_signature === "string"
      ? metadata.discord_progress_signature
      : null;

  const baseInfo = {
    title: task.title || task.task_code || "SAWOL OFFICE 업무",
    taskCode: task.task_code,
    description: task.description,
    status: job.status,
    progress: Number(job.progress ?? 0),
    currentStepTitle: job.current_step_title ?? null,
    lastMessage: job.last_message ?? null,
    lastError: job.last_error ?? null,
  };

  // 1) 반려 접수/재작업 시작: 비서실 1개 채널만
  const rejection = safeMetadata(metadata.rejection);
  const rejectionNotifyAt = metadata.discord_rejection_notify_at ?? null;

  if (Object.keys(rejection).length > 0 && !rejectionNotifyAt) {
    const reason =
      typeof rejection.reason === "string" && rejection.reason.trim()
        ? rejection.reason.trim()
        : "대표 반려 사유가 저장되었습니다.";

    const content = buildCompactTaskBlock({
      ...baseInfo,
      header: "🔁 **반려 접수 · 재작업 시작**",
      footer: `**반려 사유**\n> ${truncate(reason, 240).replace(/\\n/g, "\\n> ")}`,
      showProgress: false,
    });

    await Promise.all([
      updateStoredDiscordMessage({
        job,
        messageKey: "approval",
        content: buildCompactTaskBlock({
          ...baseInfo,
          header: "🔁 **대표 반려 · 재작업 시작**",
          footer: `**반려 사유**\n> ${truncate(reason, 240).replace(/\n/g, "\n> ")}`,
          showProgress: false,
        }),
        components: taskLinkButtons(task.id),
      }),
      updateStoredDiscordMessage({
        job,
        messageKey: "progress",
        content: buildCompactTaskBlock({
          ...baseInfo,
          header: "🔁 **재작업 진행 예정**",
          footer: "대표 반려 사유를 반영해 AUTO 재작업을 시작합니다.",
          showProgress: false,
        }),
        components: taskLinkButtons(task.id),
      }),
    ]);

    await upsertChannelMessage({
      supabase,
      job,
      channelName: "윤서진-비서실",
      messageKey: "rejection",
      content,
      components: taskLinkButtons(task.id),
    });

    await markJobMetadata(supabase, job.id, {
      ...safeMetadata(job.metadata),
      discord_rejection_notify_at: new Date().toISOString(),
    });

    return {
      sent: true,
      channel: "윤서진-비서실",
      mode: "rejection",
    };
  }

  // 2) 진행 상황: 기존 메시지 계속 수정
  if (
    (job.status === "QUEUED" || job.status === "RUNNING") &&
    shouldUpdateProgress(job, previousSignature)
  ) {
    const header =
      job.status === "QUEUED"
        ? "🟦 **업무 접수 · 실행 대기**"
        : "🔄 **업무 진행 중**";

    const content = buildCompactTaskBlock({
      ...baseInfo,
      header,
    });

    await upsertChannelMessage({
      supabase,
      job,
      channelName: "업무-진행상황",
      messageKey: "progress",
      content,
      components: taskLinkButtons(task.id),
    });

    await markJobMetadata(supabase, job.id, {
      ...safeMetadata(job.metadata),
      discord_progress_signature: signature,
    });

    return {
      sent: true,
      channel: "업무-진행상황",
      mode: "progress",
    };
  }

  // 3) 대표 승인 대기: 여기서는 한 채널만 사용, 완료보고 중복 발송 제거
  if (job.status === "AWAITING_APPROVAL") {
    const artifact = await loadLatestArtifactInfo(supabase, task.id);

    const content = buildCompactTaskBlock({
      ...baseInfo,
      header: "🟡 **대표 승인 대기**",
      footer: artifact.summary
        ? `**결과 요약**\n> ${truncate(artifact.summary, 280).replace(/\\n/g, "\\n> ")}\n\n아래 버튼에서 결과 확인 후 **승인** 또는 **반려**해주세요.`
        : "최종 산출물이 준비되었습니다. 아래 **결과 확인** 버튼에서 확인 후 승인 또는 반려해주세요.",
      showProgress: false,
    });

    await updateStoredDiscordMessage({
      job,
      messageKey: "progress",
      content: buildCompactTaskBlock({
        ...baseInfo,
        header: "🟡 **실무 완료 · 대표 승인 대기**",
        footer: artifact.summary
          ? `**결과 요약**\n> ${truncate(artifact.summary, 220).replace(/\n/g, "\n> ")}`
          : "실무 처리가 끝나 대표 승인 단계로 이동했습니다.",
        showProgress: false,
      }),
      components: resultLinkButtons({
        taskId: task.id,
        resultUrl: artifact.resultUrl,
        runUrl: artifact.runUrl,
      }),
    });

    await upsertChannelMessage({
      supabase,
      job,
      channelName: "대표-승인대기",
      messageKey: "approval",
      content,
      components: approvalButtons({
        taskId: task.id,
        resultUrl: artifact.resultUrl,
        runUrl: artifact.runUrl,
      }),
    });

    return {
      sent: true,
      channel: "대표-승인대기",
      mode: "approval",
    };
  }

  // 4) 완료: 완료보고 한 채널만
  if (job.status === "COMPLETED") {
    const artifact = await loadLatestArtifactInfo(supabase, task.id);

    const content = buildCompactTaskBlock({
      ...baseInfo,
      header: "✅ **업무 완료**",
      footer: artifact.summary
        ? `**최종 결과**\n> ${truncate(artifact.summary, 280).replace(/\\n/g, "\\n> ")}`
        : "최종 결과가 정상적으로 제출되었습니다.",
      showProgress: false,
    });

    const settledContent = buildCompactTaskBlock({
      ...baseInfo,
      header: "✅ **대표 승인 · 업무 완료**",
      footer: artifact.summary
        ? `**최종 결과**\n> ${truncate(artifact.summary, 240).replace(/\n/g, "\n> ")}`
        : "대표 승인이 완료되어 최종 완료 처리되었습니다.",
      showProgress: false,
    });

    const settledComponents = resultLinkButtons({
      taskId: task.id,
      resultUrl: artifact.resultUrl,
      runUrl: artifact.runUrl,
    });

    await Promise.all([
      updateStoredDiscordMessage({
        job,
        messageKey: "progress",
        content: settledContent,
        components: settledComponents,
      }),
      updateStoredDiscordMessage({
        job,
        messageKey: "approval",
        content: settledContent,
        components: settledComponents,
      }),
    ]);

    await upsertChannelMessage({
      supabase,
      job,
      channelName: "업무-완료보고",
      messageKey: "completed",
      content,
      components: settledComponents,
    });

    return {
      sent: true,
      channel: "업무-완료보고",
      mode: "completed",
    };
  }

  // 5) 대표 판단 필요: 중복 채널 제거, 대표-긴급보고만 사용
  if (job.status === "PAUSED") {
    const content = buildCompactTaskBlock({
      ...baseInfo,
      header: "⚠️ **대표 확인 필요**",
      footer:
        "자동 처리만으로 판단하기 어려운 상태입니다. 아래 **업무 상세** 버튼에서 확인해주세요.",
      showProgress: false,
    });

    await updateStoredDiscordMessage({
      job,
      messageKey: "progress",
      content,
      components: taskLinkButtons(task.id),
    });

    await upsertChannelMessage({
      supabase,
      job,
      channelName: "대표-긴급보고",
      messageKey: "paused",
      content,
      components: taskLinkButtons(task.id),
    });

    return {
      sent: true,
      channel: "대표-긴급보고",
      mode: "paused",
    };
  }

  // 6) 기술 오류: 오류-복구보고만 사용
  if (job.status === "FAILED") {
    const content = buildCompactTaskBlock({
      ...baseInfo,
      header: "🔴 **자동 실행 오류**",
      footer:
        "기존 작업 내용은 보존되어 있습니다. 아래 **업무 상세**에서 확인해주세요.",
      showProgress: false,
    });

    await updateStoredDiscordMessage({
      job,
      messageKey: "progress",
      content,
      components: taskLinkButtons(task.id),
    });

    await upsertChannelMessage({
      supabase,
      job,
      channelName: "오류-복구보고",
      messageKey: "failed",
      content,
      components: taskLinkButtons(task.id),
    });

    return {
      sent: true,
      channel: "오류-복구보고",
      mode: "failed",
    };
  }

  return {
    sent: false,
    reason: "no_notification_rule",
  };
}

export async function sweepDiscordJobNotifications(supabase: any) {
  const { data: jobs, error } = await supabase
    .from("task_autopilot_jobs")
    .select(
      "id, task_id, status, progress, current_step_title, last_message, last_error, metadata, updated_at, created_at",
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
    .limit(30);

  if (error) throw new Error(error.message);

  let sent = 0;

  for (const job of jobs ?? []) {
    try {
      const result = await notifyDiscordForJob(supabase, job);
      if (result.sent) sent += 1;
    } catch (error) {
      console.error("Discord notification failed:", job.task_id, error);
    }
  }

  return { sent };
}
