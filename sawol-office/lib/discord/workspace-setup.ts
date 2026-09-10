type DiscordChannel = {
  id: string;
  name: string;
  type: number;
  parent_id?: string | null;
};

const CATEGORY = 4;
const TEXT = 0;

const structure = [
  {
    name: "📌 대표실",
    channels: [
      ["대표-업무지시", "대표가 윤서진 비서실장에게 업무를 지시하는 전용 채널"],
      ["대표-승인대기", "AI 조직의 최종 결과를 확인하고 승인·반려하는 채널"],
      ["대표-긴급보고", "대표 판단이 꼭 필요한 긴급 이슈만 보고하는 채널"],
      ["대표-메모", "대표가 빠르게 남기는 메모와 아이디어를 기록하는 채널"],
    ],
  },
  {
    name: "🤖 비서실",
    channels: [
      ["윤서진-비서실", "업무 접수·분석·배정·요약 보고를 담당하는 비서실 채널"],
      ["업무-접수기록", "Discord와 웹에서 접수된 업무 기록을 자동 보관"],
      ["오늘의-업무", "오늘 처리 중이거나 처리 예정인 업무 요약"],
      ["업무-진행상황", "현재 AI 직원·단계·진행률을 실시간에 가깝게 표시"],
      ["업무-완료보고", "완료된 업무와 최종 결과 요약을 보고"],
      ["오류-복구보고", "자동 복구 실패 또는 대표 판단 필요 상태를 보고"],
    ],
  },
  {
    name: "🏢 AI 조직",
    channels: [
      ["직원-배정현황", "업무별 AI 직원 배정 결과와 담당자를 표시"],
      ["협업-진행상황", "여러 AI 직원이 함께 수행하는 협업 단계와 인계 상황"],
      ["검수-리뷰", "내부 검수·품질 확인·재작업 판단 기록"],
      ["직원-활동로그", "AI 직원들의 작업 이력과 주요 활동 기록"],
    ],
  },
  {
    name: "📁 프로젝트",
    channels: [
      ["프로젝트-현황", "진행 프로젝트와 상태를 요약"],
      ["프로젝트-업무", "프로젝트별 주요 업무 진행 기록"],
      ["자료-수집", "업무 수행 중 수집한 참고자료를 모아두는 채널"],
      ["리서치-자료", "조사 출처·링크·사실검증 자료를 정리"],
      ["결과물-보관", "최종 산출물 링크와 결과 요약을 보관"],
    ],
  },
  {
    name: "🗓 일정·운영",
    channels: [
      ["오늘-일정", "오늘의 일정과 주요 시간 계획"],
      ["예정-업무", "앞으로 처리해야 할 예정 업무"],
      ["마감-알림", "마감 일정과 지연 위험을 알림"],
      ["반복-업무", "정기적으로 실행하는 자동 업무를 관리"],
    ],
  },
  {
    name: "🧠 지식·기억",
    channels: [
      ["회사-기억", "SAWOL OFFICE의 회사 운영 기준과 장기 기억"],
      ["대표-기억", "대표가 유지하고 싶은 업무 기준과 선호 기록"],
      ["업무-규칙", "업무 처리 규칙·승인 기준·자동화 원칙"],
      ["참고자료", "장기적으로 재사용할 자료와 참고 링크"],
    ],
  },
  {
    name: "🔗 외부연동",
    channels: [
      ["notion-연동", "Notion 동기화 및 처리 기록"],
      ["calendar-연동", "Google Calendar 동기화 및 일정 처리 기록"],
      ["drive-연동", "Google Drive 파일 연결 및 처리 기록"],
      ["외부-api", "외부 API 및 기타 서비스 연동 상태"],
    ],
  },
  {
    name: "⚙️ 시스템",
    channels: [
      ["시스템-상태", "SAWOL OFFICE 주요 시스템 상태"],
      ["자동화-로그", "자동화 worker·queue 실행 기록"],
      ["연동-상태", "Discord·Notion·Calendar 등 외부 연결 상태"],
      ["오류-로그", "기술적 오류와 장애 기록"],
      ["봇-설정", "Discord 봇 및 자동화 설정 변경 기록"],
    ],
  },
];

async function discordFetch(path: string, init?: RequestInit) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("DISCORD_BOT_TOKEN is missing");

  const response = await fetch(`https://discord.com/api/v10${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
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

async function ensureCategory(
  guildId: string,
  existing: DiscordChannel[],
  name: string,
) {
  const found = existing.find(
    (channel) => channel.type === CATEGORY && channel.name === name,
  );

  if (found) return found;

  const created = await discordFetch(`/guilds/${guildId}/channels`, {
    method: "POST",
    body: JSON.stringify({
      name,
      type: CATEGORY,
    }),
  });

  existing.push(created);
  return created;
}

async function ensureTextChannel(
  guildId: string,
  existing: DiscordChannel[],
  categoryId: string,
  name: string,
  topic: string,
) {
  const found = existing.find(
    (channel) =>
      channel.type === TEXT &&
      channel.name === name &&
      channel.parent_id === categoryId,
  );

  if (found) {
    await discordFetch(`/channels/${found.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        topic,
      }),
    });

    return found;
  }

  const created = await discordFetch(`/guilds/${guildId}/channels`, {
    method: "POST",
    body: JSON.stringify({
      name,
      type: TEXT,
      parent_id: categoryId,
      topic,
    }),
  });

  existing.push(created);
  return created;
}

async function setBotNickname(guildId: string) {
  await discordFetch(`/guilds/${guildId}/members/@me`, {
    method: "PATCH",
    body: JSON.stringify({
      nick: "윤서진 비서실장",
    }),
  });
}

export async function setupDiscordWorkspace() {
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!guildId) {
    throw new Error("DISCORD_GUILD_ID is missing");
  }

  const channels = (await discordFetch(
    `/guilds/${guildId}/channels`,
  )) as DiscordChannel[];

  await setBotNickname(guildId);

  const created: Array<{
    category: string;
    channel: string;
    channelId: string;
  }> = [];

  for (const group of structure) {
    const category = await ensureCategory(
      guildId,
      channels,
      group.name,
    );

    for (const [channelName, topic] of group.channels) {
      const channel = await ensureTextChannel(
        guildId,
        channels,
        category.id,
        channelName,
        topic,
      );

      created.push({
        category: group.name,
        channel: channelName,
        channelId: channel.id,
      });
    }
  }

  return {
    ok: true,
    nickname: "윤서진 비서실장",
    channels: created,
  };
}
