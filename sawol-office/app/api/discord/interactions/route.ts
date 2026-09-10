import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyDiscordRequest } from "@/lib/discord/verify";
import { createDiscordAutoTask } from "@/lib/discord/create-task";

export const runtime = "nodejs";
export const maxDuration = 30;

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export async function POST(request: Request) {
  const publicKey = process.env.DISCORD_PUBLIC_KEY;

  if (!publicKey) {
    return json(
      {
        type: 4,
        data: {
          content:
            "SAWOL OFFICE 설정 오류: DISCORD_PUBLIC_KEY가 없습니다.",
          flags: 64,
        },
      },
      500,
    );
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

  const interaction = JSON.parse(rawBody);

  // Discord endpoint 검증용 PING
  if (interaction.type === 1) {
    return json({ type: 1 });
  }

  // Application Command
  if (interaction.type !== 2) {
    return json({
      type: 4,
      data: {
        content: "지원하지 않는 요청입니다.",
        flags: 64,
      },
    });
  }

  const commandName = interaction.data?.name;

  if (commandName !== "업무") {
    return json({
      type: 4,
      data: {
        content: "지원하지 않는 명령입니다.",
        flags: 64,
      },
    });
  }

  const instruction =
    interaction.data?.options?.find(
      (option: any) => option.name === "지시",
    )?.value?.trim();

  if (!instruction) {
    return json({
      type: 4,
      data: {
        content: "업무 지시 내용을 입력해주세요.",
        flags: 64,
      },
    });
  }

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

    return json({
      type: 4,
      data: {
        content:
          `업무 접수 완료\n\n` +
          `**${task.title}**\n` +
          `실행 방식: AUTO\n` +
          `업무 코드: ${task.task_code}\n\n` +
          `비서실장이 SAWOL OFFICE에 등록했고, AI 직원 조직이 자동으로 처리합니다.`,
        flags: 64,
      },
    });
  } catch (error) {
    return json({
      type: 4,
      data: {
        content:
          `업무 접수 중 오류가 발생했습니다.\n` +
          `${
            error instanceof Error
              ? error.message.slice(0, 500)
              : "Unknown error"
          }`,
        flags: 64,
      },
    });
  }
}
