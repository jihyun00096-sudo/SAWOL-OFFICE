import { createHumanCode } from "@/lib/sawol/code";

function inferTaskType(text: string) {
  if (/조사|검색|리서치|뉴스|자료|찾아/i.test(text)) return "학습";
  if (/작성|글|콘텐츠|문구|블로그|초안|제작/i.test(text)) return "제작";
  if (/검수|확인|점검|오류|검토/i.test(text)) return "검수";
  return "일반";
}

function inferPriority(text: string) {
  if (/긴급|급함|최우선|지금 당장|즉시/i.test(text)) return "HIGH";
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
    })
    .select("id,task_code,title,status,execution_mode")
    .single();

  if (error) throw new Error(error.message);

  return data;
}
