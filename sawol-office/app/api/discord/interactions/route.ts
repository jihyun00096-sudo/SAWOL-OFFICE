import { after, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyDiscordRequest } from "@/lib/discord/verify";
import { createDiscordAutoTask } from "@/lib/discord/create-task";
import {
  sendDiscordChannelMessage,
  taskLinkButtons,
} from "@/lib/discord/notify";
import {
  finalizeTaskFromControl,
  findRootTaskByReference,
  rejectTaskFromControl,
} from "@/lib/sawol/approval-control";

export const runtime = "nodejs";
export const maxDuration = 60;

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

async function safeChannelMessage(
  channelName: string,
  content: string,
  options?: {
    components?: Record<string, unknown>[];
  },
) {
  try {
    await sendDiscordChannelMessage(channelName, content, {
      components: options?.components,
      suppressEmbeds: true,
    });
  } catch (error) {
    console.error(`Discord routing failed: ${channelName}`, error);
  }
}

async function editOriginalInteraction(
  applicationId: string,
  interactionToken: string,
  content: string,
) {
  const response = await fetch(
    `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}/messages/@original`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content,
        flags: 64,
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(
      "Discord interaction edit failed",
      response.status,
      body,
    );
  }
}

function optionValue(interaction: any, name: string) {
  const value = interaction.data?.options?.find(
    (option: any) => option.name === name,
  )?.value;

  return typeof value === "string" ? value.trim() : "";
}

function modalReason(interaction: any) {
  const rows = Array.isArray(interaction.data?.components)
    ? interaction.data.components
    : [];

  for (const row of rows) {
    for (const component of row?.components ?? []) {
      if (
        component?.custom_id === "reason" &&
        typeof component?.value === "string"
      ) {
        return component.value.trim();
      }
    }
  }

  return "";
}

function applicationInfo(interaction: any) {
  return {
    applicationId:
      interaction.application_id ||
      process.env.DISCORD_APPLICATION_ID ||
      "",
    interactionToken: interaction.token || "",
  };
}

function deferredEphemeral() {
  return json({
    type: 5,
    data: {
      flags: 64,
    },
  });
}

export async function POST(request: Request) {
  const publicKey = process.env.DISCORD_PUBLIC_KEY;

  if (!publicKey) {
    return new NextResponse("DISCORD_PUBLIC_KEY missing", {
      status: 500,
    });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");

  const valid = verifyDiscordRequest({
    rawBody,
    signature,
    timestamp,
    publicKey,
  });

  if (!valid) {
    return new NextResponse("invalid request signature", {
      status: 401,
    });
  }

  let interaction: any;

  try {
    interaction = JSON.parse(rawBody);
  } catch {
    return new NextResponse("invalid json", {
      status: 400,
    });
  }

  if (interaction.type === 1) {
    return json({ type: 1 });
  }

  // 승인 버튼
  if (
    interaction.type === 3 &&
    typeof interaction.data?.custom_id === "string" &&
    interaction.data.custom_id.startsWith("sawol:approve:")
  ) {
    const taskId = interaction.data.custom_id.replace(
      "sawol:approve:",
      "",
    );
    const { applicationId, interactionToken } =
      applicationInfo(interaction);

    after(async () => {
      try {
        const supabase = createAdminClient();
        const result = await finalizeTaskFromControl(
          supabase,
          taskId,
        );

        await editOriginalInteraction(
          applicationId,
          interactionToken,
          [
            "✅ **대표 승인 완료**",
            `업무 코드: ${result.task.task_code}`,
            `업무: ${result.task.title}`,
            "",
            "최종 결과를 승인하고 업무를 완료 처리했습니다.",
          ].join("\n"),
        );
      } catch (error) {
        await editOriginalInteraction(
          applicationId,
          interactionToken,
          `⚠️ 승인 실패\n${error instanceof Error ? error.message : "알 수 없는 오류"}`,
        );
      }
    });

    return deferredEphemeral();
  }

  // 반려 버튼 -> 사유 입력 Modal
  if (
    interaction.type === 3 &&
    typeof interaction.data?.custom_id === "string" &&
    interaction.data.custom_id.startsWith("sawol:reject:")
  ) {
    const taskId = interaction.data.custom_id.replace(
      "sawol:reject:",
      "",
    );

    return json({
      type: 9,
      data: {
        custom_id: `sawol:reject_modal:${taskId}`,
        title: "대표 반려 · 수정 요청",
        components: [
          {
            type: 1,
            components: [
              {
                type: 4,
                custom_id: "reason",
                label: "반려 사유",
                style: 2,
                min_length: 2,
                max_length: 1000,
                required: true,
                placeholder:
                  "예: 출처가 부정확해. 처음부터 다시 조사해서 정확하게 만들어줘.",
              },
            ],
          },
        ],
      },
    });
  }

  // 반려 Modal 제출
  if (
    interaction.type === 5 &&
    typeof interaction.data?.custom_id === "string" &&
    interaction.data.custom_id.startsWith(
      "sawol:reject_modal:",
    )
  ) {
    const taskId = interaction.data.custom_id.replace(
      "sawol:reject_modal:",
      "",
    );
    const reason = modalReason(interaction);
    const { applicationId, interactionToken } =
      applicationInfo(interaction);

    after(async () => {
      try {
        const supabase = createAdminClient();
        const result = await rejectTaskFromControl(
          supabase,
          taskId,
          reason,
          "DISCORD_BUTTON",
        );

        await editOriginalInteraction(
          applicationId,
          interactionToken,
          [
            "🔁 **대표 반려 접수 완료**",
            `업무 코드: ${result.task.task_code}`,
            `업무: ${result.task.title}`,
            `사유: ${reason}`,
            "",
            result.mode === "AUTO"
              ? "AUTO 재작업 큐에 등록했습니다. 재작업 완료 후 다시 대표 승인 대기로 올립니다."
              : "MANUAL 업무를 대기 상태로 돌렸습니다.",
          ].join("\n"),
        );
      } catch (error) {
        await editOriginalInteraction(
          applicationId,
          interactionToken,
          `⚠️ 반려 실패\n${error instanceof Error ? error.message : "알 수 없는 오류"}`,
        );
      }
    });

    return deferredEphemeral();
  }

  if (interaction.type !== 2) {
    return json({
      type: 4,
      data: {
        content: "지원하지 않는 Discord 동작입니다.",
        flags: 64,
      },
    });
  }

  const command = interaction.data?.name;
  const { applicationId, interactionToken } =
    applicationInfo(interaction);

  if (!applicationId || !interactionToken) {
    return json({
      type: 4,
      data: {
        content:
          "Discord 연결 정보가 부족합니다. 관리자 설정을 확인해주세요.",
        flags: 64,
      },
    });
  }

  // /업무
  if (command === "업무") {
    const instruction = optionValue(interaction, "지시");

    if (!instruction) {
      return json({
        type: 4,
        data: {
          content: "업무 지시 내용을 입력해주세요.",
          flags: 64,
        },
      });
    }

    after(async () => {
      try {
        const supabase = createAdminClient();

        const task = await createDiscordAutoTask(
          supabase,
          instruction,
          {
            guildId: interaction.guild_id ?? null,
            channelId: interaction.channel_id ?? null,
            userId:
              interaction.member?.user?.id ??
              interaction.user?.id ??
              null,
            username:
              interaction.member?.user?.username ??
              interaction.user?.username ??
              null,
            interactionId: interaction.id ?? null,
          },
        );


        await editOriginalInteraction(
          applicationId,
          interactionToken,
          [
            "✅ 윤서진 비서실장에게 전달했습니다.",
            `업무 코드: ${task.task_code}`,
            "접수·분류·배정 현황은 비서실 채널에서 관리합니다.",
          ].join("\n"),
        );

        await safeChannelMessage(
          "윤서진-비서실",
          [
            "📥 **대표 업무 지시 접수**",
            "",
            `**${task.title}**`,
            `업무 유형: ${task.task_type}`,
            `우선순위: ${task.priority}`,
            "실행 방식: AUTO",
            `업무 코드: ${task.task_code}`,
            "",
            "대표 지시를 접수했습니다. 업무 분석·분류·직원 배정을 시작합니다.",
          ].join("\n"),
          { components: taskLinkButtons(task.id) },
        );

        await safeChannelMessage(
          "업무-접수기록",
          [
            "🗂️ **업무 접수 기록**",
            "",
            `업무 코드: ${task.task_code}`,
            `제목: ${task.title}`,
            `업무 유형: ${task.task_type}`,
            `우선순위: ${task.priority}`,
            "실행 방식: AUTO",
            "",
            "**대표 원문**",
            instruction.slice(0, 1400),
          ].join("\n"),
          { components: taskLinkButtons(task.id) },
        );
      } catch (error) {
        await editOriginalInteraction(
          applicationId,
          interactionToken,
          [
            "⚠️ **업무 접수 실패**",
            "",
            error instanceof Error
              ? error.message.slice(0, 700)
              : "Unknown error",
          ].join("\n"),
        );
      }
    });

    return deferredEphemeral();
  }

  // /승인 업무코드
  if (command === "승인") {
    const reference = optionValue(interaction, "업무코드");

    after(async () => {
      try {
        const supabase = createAdminClient();
        const task = await findRootTaskByReference(
          supabase,
          reference,
        );
        const result = await finalizeTaskFromControl(
          supabase,
          task.id,
        );

        await editOriginalInteraction(
          applicationId,
          interactionToken,
          [
            "✅ **대표 승인 완료**",
            `업무 코드: ${result.task.task_code}`,
            `업무: ${result.task.title}`,
            "",
            "최종 결과를 승인하고 업무를 완료 처리했습니다.",
          ].join("\n"),
        );
      } catch (error) {
        await editOriginalInteraction(
          applicationId,
          interactionToken,
          `⚠️ 승인 실패\n${error instanceof Error ? error.message : "알 수 없는 오류"}`,
        );
      }
    });

    return deferredEphemeral();
  }

  // /반려 업무코드 사유
  if (command === "반려") {
    const reference = optionValue(interaction, "업무코드");
    const reason = optionValue(interaction, "사유");

    after(async () => {
      try {
        const supabase = createAdminClient();
        const task = await findRootTaskByReference(
          supabase,
          reference,
        );
        const result = await rejectTaskFromControl(
          supabase,
          task.id,
          reason,
          "DISCORD_COMMAND",
        );

        await editOriginalInteraction(
          applicationId,
          interactionToken,
          [
            "🔁 **대표 반려 접수 완료**",
            `업무 코드: ${result.task.task_code}`,
            `업무: ${result.task.title}`,
            `사유: ${reason}`,
            "",
            result.mode === "AUTO"
              ? "AUTO 재작업 큐에 등록했습니다. 재작업 완료 후 다시 대표 승인 대기로 올립니다."
              : "MANUAL 업무를 대기 상태로 돌렸습니다.",
          ].join("\n"),
        );
      } catch (error) {
        await editOriginalInteraction(
          applicationId,
          interactionToken,
          `⚠️ 반려 실패\n${error instanceof Error ? error.message : "알 수 없는 오류"}`,
        );
      }
    });

    return deferredEphemeral();
  }

  return json({
    type: 4,
    data: {
      content:
        "지원하지 않는 명령입니다. /업무, /승인, /반려를 사용할 수 있습니다.",
      flags: 64,
    },
  });
}
