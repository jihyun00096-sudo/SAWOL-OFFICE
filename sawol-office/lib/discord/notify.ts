type DiscordGuildChannel = {
  id: string;
  name: string;
  type: number;
};

type DiscordComponent = Record<string, unknown>;

const TEXT_CHANNEL = 0;
const SUPPRESS_EMBEDS = 1 << 2;

async function discordFetch(path: string, init?: RequestInit) {
  const token = process.env.DISCORD_BOT_TOKEN;

  if (!token) {
    throw new Error("DISCORD_BOT_TOKEN is missing");
  }

  const headers = {
    Authorization: `Bot ${token}`,
    "Content-Type": "application/json",
    ...(init?.headers ?? {}),
  };

  const response = await fetch(`https://discord.com/api/v10${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  const text = await response.text();
  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(
      `Discord API ${response.status}: ${
        typeof data === "string" ? data : JSON.stringify(data)
      }`,
    );
  }

  return data;
}

export async function findDiscordChannelId(name: string) {
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!guildId) {
    throw new Error("DISCORD_GUILD_ID is missing");
  }

  const channels = (await discordFetch(
    `/guilds/${guildId}/channels`,
  )) as DiscordGuildChannel[];

  const channel = channels.find(
    (item) => item.type === TEXT_CHANNEL && item.name === name,
  );

  return channel?.id ?? null;
}

function normalizeContent(content: string) {
  return content.slice(0, 1900);
}

function buildPayload(args: {
  content: string;
  components?: DiscordComponent[];
  suppressEmbeds?: boolean;
}) {
  return {
    content: normalizeContent(args.content),
    components: args.components?.length ? args.components : undefined,
    flags: args.suppressEmbeds === false ? undefined : SUPPRESS_EMBEDS,
    allowed_mentions: {
      parse: [],
    },
  };
}

export async function sendDiscordChannelMessage(
  channelName: string,
  content: string,
  options?: {
    components?: DiscordComponent[];
    suppressEmbeds?: boolean;
  },
) {
  const channelId = await findDiscordChannelId(channelName);

  if (!channelId) {
    throw new Error(`Discord channel not found: ${channelName}`);
  }

  return discordFetch(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify(
      buildPayload({
        content,
        components: options?.components,
        suppressEmbeds: options?.suppressEmbeds,
      }),
    ),
  });
}

export async function updateDiscordMessage(args: {
  channelId: string;
  messageId: string;
  content: string;
  components?: DiscordComponent[];
  suppressEmbeds?: boolean;
}) {
  return discordFetch(
    `/channels/${args.channelId}/messages/${args.messageId}`,
    {
      method: "PATCH",
      body: JSON.stringify(
        buildPayload({
          content: args.content,
          components: args.components,
          suppressEmbeds: args.suppressEmbeds,
        }),
      ),
    },
  );
}

export async function sendOrUpdateDiscordChannelMessage(args: {
  channelName: string;
  content: string;
  previousMessageId?: string | null;
  components?: DiscordComponent[];
  suppressEmbeds?: boolean;
}) {
  const channelId = await findDiscordChannelId(args.channelName);

  if (!channelId) {
    throw new Error(`Discord channel not found: ${args.channelName}`);
  }

  if (args.previousMessageId) {
    try {
      const updated = await updateDiscordMessage({
        channelId,
        messageId: args.previousMessageId,
        content: args.content,
        components: args.components,
        suppressEmbeds: args.suppressEmbeds,
      });

      return {
        mode: "updated" as const,
        channelId,
        messageId: updated.id as string,
      };
    } catch {
      // 메시지가 지워졌거나 접근이 안 되면 새로 보냅니다.
    }
  }

  const created = await discordFetch(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify(
      buildPayload({
        content: args.content,
        components: args.components,
        suppressEmbeds: args.suppressEmbeds,
      }),
    ),
  });

  return {
    mode: "created" as const,
    channelId,
    messageId: created.id as string,
  };
}

export function linkButton(label: string, url: string) {
  return {
    type: 2,
    style: 5,
    label,
    url,
  };
}

export function actionButton(
  label: string,
  customId: string,
  style: 1 | 2 | 3 | 4,
) {
  return {
    type: 2,
    style,
    label,
    custom_id: customId,
  };
}

export function taskLinkButtons(taskId: string) {
  return [
    {
      type: 1,
      components: [linkButton("업무 상세", taskUrl(taskId))],
    },
  ];
}

export function resultLinkButtons(args: {
  taskId: string;
  resultUrl?: string | null;
  runUrl?: string | null;
}) {
  const topRow: DiscordComponent[] = [];

  if (args.resultUrl) {
    topRow.push(linkButton("결과 확인", args.resultUrl));
  } else if (args.runUrl) {
    topRow.push(linkButton("실행 기록", args.runUrl));
  }

  topRow.push(linkButton("업무 상세", taskUrl(args.taskId)));

  return [
    {
      type: 1,
      components: topRow,
    },
  ];
}

export function approvalButtons(args: {
  taskId: string;
  resultUrl?: string | null;
  runUrl?: string | null;
}) {
  const row1: DiscordComponent[] = [];

  if (args.resultUrl) {
    row1.push(linkButton("결과 확인", args.resultUrl));
  } else if (args.runUrl) {
    row1.push(linkButton("실행 기록", args.runUrl));
  } else {
    row1.push(linkButton("승인함", approvalsUrl()));
  }

  row1.push(actionButton("승인", `sawol:approve:${args.taskId}`, 3));
  row1.push(actionButton("반려", `sawol:reject:${args.taskId}`, 4));

  return [
    {
      type: 1,
      components: row1,
    },
    {
      type: 1,
      components: [
        linkButton("업무 상세", taskUrl(args.taskId)),
        linkButton("승인함", approvalsUrl()),
      ],
    },
  ];
}

export function taskUrl(taskId: string) {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://sawol-office.vercel.app";

  return `${base.replace(/\/$/, "")}/tasks/${taskId}`;
}

export function runUrl(runId: string) {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://sawol-office.vercel.app";

  return `${base.replace(/\/$/, "")}/runs/${runId}`;
}

export function resultUrl(resultId: string) {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://sawol-office.vercel.app";

  return `${base.replace(/\/$/, "")}/results/${resultId}`;
}

export function approvalsUrl() {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://sawol-office.vercel.app";

  return `${base.replace(/\/$/, "")}/approvals`;
}
