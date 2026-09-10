import { after, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyDiscordRequest } from "@/lib/discord/verify";
import { createDiscordAutoTask } from "@/lib/discord/create-task";

export const runtime = "nodejs";
export const maxDuration = 60;

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
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

  // Discord endpoint validation PING
  if (interaction.type === 1) {
    return json({ type: 1 });
  }

  // Application Command
  if (
    interaction.type !== 2 ||
    interaction.data?.name !== "업무"
  ) {
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

  const applicationId =
    interaction.application_id ||
    process.env.DISCORD_APPLICATION_ID;
  const interactionToken = interaction.token;

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

  // Discord는 interaction 최초 응답을 약 3초 안에 받아야 합니다.
  // DB 저장/업무 생성보다 먼저 즉시 Deferred ACK를 반환하고,
  // 실제 업무 등록은 after()에서 수행한 뒤 원본 응답을 수정합니다.
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
          "✅ **업무 접수 완료**",
          "",
          `**${task.title}**`,
          `실행 방식: AUTO`,
          `업무 코드: ${task.task_code}`,
          "",
          "윤서진 비서실장이 SAWOL OFFICE에 등록했습니다.",
          "AI 직원 조직이 자동으로 처리하고 최종 결과는 승인 단계로 올립니다.",
        ].join("\n"),
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message.slice(0, 700)
          : "Unknown error";

      console.error("Discord task create failed:", error);

      await editOriginalInteraction(
        applicationId,
        interactionToken,
        [
          "⚠️ **업무 접수 실패**",
          "",
          message,
          "",
          "SAWOL OFFICE의 Vercel Runtime Logs에서 원인을 확인해주세요.",
        ].join("\n"),
      );
    }
  });

  return json({
    type: 5,
    data: {
      flags: 64,
    },
  });
}
