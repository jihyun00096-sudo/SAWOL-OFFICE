export async function registerDiscordTaskCommand() {
  const appId = process.env.DISCORD_APPLICATION_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!appId || !botToken || !guildId) {
    throw new Error(
      "DISCORD_APPLICATION_ID / DISCORD_BOT_TOKEN / DISCORD_GUILD_ID 환경변수가 필요합니다.",
    );
  }

  const endpoint =
    `https://discord.com/api/v10/applications/${appId}/guilds/${guildId}/commands`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "업무",
      description: "SAWOL OFFICE 비서실장에게 AUTO 업무를 지시합니다.",
      type: 1,
      options: [
        {
          type: 3,
          name: "지시",
          description: "처리할 업무 내용을 자연어로 입력하세요.",
          required: true,
        },
      ],
    }),
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error(
      `Discord command registration failed: ${response.status} ${body}`,
    );
  }

  return JSON.parse(body);
}
