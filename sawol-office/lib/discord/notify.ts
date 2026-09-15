type DiscordGuildChannel = {
  id: string;
  name: string;
  type: number;
};

type DiscordComponent = Record<string, unknown>;

const TEXT_CHANNEL = 0;

async function discordFetch(path: string, init?: RequestInit) {
  const token = process.env.DISCORD_BOT_TOKEN;

  if (!token) {
    throw new Error("DISCORD_BOT_TOKEN is missing");
  }

  const response = await fetch(`https://discord.com/api/v10${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
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

async function findChannelId(name: string) {
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

export async function sendDiscordChannelMessage(
  channelName: string,
  content: string,
  options?: {
    imageUrl?: string | null;
    components?: DiscordComponent[];
  },
) {
  const channelId = await findChannelId(channelName);

  if (!channelId) {
    throw new Error(`Discord channel not found: ${channelName}`);
  }

  return discordFetch(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      content: content.slice(0, 1900),
      embeds: options?.imageUrl
        ? [
            {
              image: {
                url: options.imageUrl,
              },
            },
          ]
        : undefined,
      components: options?.components?.length
        ? options.components
        : undefined,
      allowed_mentions: {
        parse: [],
      },
    }),
  });
}

export function approvalButtons(taskId: string) {
  return [
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 3,
          label: "승인",
          custom_id: `sawol:approve:${taskId}`,
        },
        {
          type: 2,
          style: 4,
          label: "반려",
          custom_id: `sawol:reject:${taskId}`,
        },
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

export function approvalsUrl() {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://sawol-office.vercel.app";

  return `${base.replace(/\/$/, "")}/approvals`;
}
