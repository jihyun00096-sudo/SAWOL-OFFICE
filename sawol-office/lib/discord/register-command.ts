type DiscordCommandOption = {
  type: number;
  name: string;
  description: string;
  required?: boolean;
};

type DiscordCommand = {
  name: string;
  description: string;
  type: number;
  options?: DiscordCommandOption[];
};

async function registerOne(command: DiscordCommand) {
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
    body: JSON.stringify(command),
    cache: "no-store",
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error(
      `Discord command registration failed: ${response.status} ${body}`,
    );
  }

  return JSON.parse(body);
}

export async function registerDiscordTaskCommand() {
  return registerOne({
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
  });
}

export async function registerDiscordApprovalCommands() {
  const approve = await registerOne({
    name: "승인",
    description: "대표 승인 대기 업무를 최종 승인합니다.",
    type: 1,
    options: [
      {
        type: 3,
        name: "업무코드",
        description: "예: TASK-20260915-ABCDE",
        required: true,
      },
    ],
  });

  const reject = await registerOne({
    name: "반려",
    description: "대표 승인 대기 업무를 반려하고 재작업을 지시합니다.",
    type: 1,
    options: [
      {
        type: 3,
        name: "업무코드",
        description: "예: TASK-20260915-ABCDE",
        required: true,
      },
      {
        type: 3,
        name: "사유",
        description: "무엇을 어떻게 다시 작업할지 입력하세요.",
        required: true,
      },
    ],
  });

  return [approve, reject];
}

export async function registerDiscordCommands() {
  const task = await registerDiscordTaskCommand();
  const approvalCommands = await registerDiscordApprovalCommands();

  return [task, ...approvalCommands];
}
