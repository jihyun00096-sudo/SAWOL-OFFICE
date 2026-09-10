import { createHumanCode } from "@/lib/sawol/code";

function inferTaskType(text: string) {
  if (/조사|검색|리서치|뉴스|자료|찾아/i.test(text)) return "RESEARCH";
  if (/작성|글|콘텐츠|문구|블로그|초안|제작/i.test(text)) return "PRODUCTION";
  if (/검수|확인|점검|오류|검토/i.test(text)) return "ANALYSIS";
  if (/기획|구성|전략|계획/i.test(text)) return "PLANNING";
  if (/수정|편집|보완|고쳐/i.test(text)) return "EDIT";
  if (/운영|관리|공지|CS|고객/i.test(text)) return "OPERATION";
  if (/학습|공부|설명해줘/i.test(text)) return "STUDY";
  if (/개발|코드|API|사이트|웹/i.test(text)) return "DEVELOPMENT";
  if (/디자인|이미지|상세페이지|썸네일/i.test(text)) return "DESIGN";
  return "OTHER";
}

function inferPriority(text: string) {
  if (/긴급|급함|최우선|지금 당장|즉시/i.test(text)) return "URGENT";
  if (/중요|높은 우선순위|우선 처리/i.test(text)) return "HIGH";
  if (/낮은 우선순위|천천히|여유롭게/i.test(text)) return "LOW";
  return "NORMAL";
}

function inferTitle(text: string) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= 36) return compact;
  return `${compact.slice(0, 33).trim()}...`;
}

export async function createDiscordAutoTask(
  supabase: any,
  instruction: string,
  meta: {
    guildId?: string | null;
    channelId?: string | null;
    userId?: string | null;
    username?: string | null;
    interactionId?: string | null;
  },
) {
  const title = inferTitle(instruction);
  const taskType = inferTaskType(instruction);
  const priority = inferPriority(instruction);

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      task_code: createHumanCode("TASK"),
      title,
      description: instruction,
      task_type: taskType,
      priority,
      status: "WAITING",
      execution_mode: "AUTO",
      requires_ceo_approval: true,
      metadata: {
        source: "DISCORD",
        discord: meta,
      },
      input_data: {
        source: "DISCORD_COMMAND",
        discord: meta,
      },
      output_requirements: {
        requested_result: instruction,
      },
      review_level: 0,
    })
    .select("id,task_code,title,status,execution_mode,task_type,priority")
    .single();

  if (error) throw new Error(error.message);

  return data;
}
