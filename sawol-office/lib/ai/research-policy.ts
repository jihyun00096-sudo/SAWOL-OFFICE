import type { SawolAiContext } from "@/lib/ai/types";

export type ResearchRequirements = {
  requestedCount: number | null;
  sourceLabel: string | null;
  allowedDomains: string[];
  freshness: "TODAY" | "RECENT" | "ANY";
  mustRefresh: boolean;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function contextText(context: SawolAiContext) {
  const task = context.task ?? {};
  const root = context.rootTask ?? {};
  const feedback = (context.feedbacks ?? [])
    .map((row) => text(row.reason))
    .filter(Boolean)
    .join("\n");

  return [
    text(root.title),
    text(root.description),
    text(task.title),
    text(task.description),
    feedback,
  ]
    .filter(Boolean)
    .join("\n");
}

function koreanCount(source: string) {
  const numeric = source.match(/(\d{1,2})\s*(?:개|건|곳|개만|건만)/)?.[1];
  if (numeric) return Number(numeric);
  if (/세\s*(?:개|건)/.test(source)) return 3;
  if (/두\s*(?:개|건)/.test(source)) return 2;
  if (/한\s*(?:개|건)/.test(source)) return 1;
  return null;
}

export function parseResearchRequirements(source: string): ResearchRequirements {
  const normalized = source.replace(/\\n/g, " ");
  const requestedCount = koreanCount(normalized);

  if (/네이버\s*(?:뉴스|기사)|n\.news\.naver\.com|news\.naver\.com/i.test(normalized)) {
    return {
      requestedCount,
      sourceLabel: "네이버 뉴스",
      allowedDomains: ["n.news.naver.com", "news.naver.com"],
      freshness: /오늘|금일/.test(normalized) ? "TODAY" : /최근|최신|이번\s*주/.test(normalized) ? "RECENT" : "ANY",
      mustRefresh: true,
    };
  }

  if (/다음\s*(?:뉴스|기사)|v\.daum\.net/i.test(normalized)) {
    return {
      requestedCount,
      sourceLabel: "다음 뉴스",
      allowedDomains: ["v.daum.net"],
      freshness: /오늘|금일/.test(normalized) ? "TODAY" : /최근|최신|이번\s*주/.test(normalized) ? "RECENT" : "ANY",
      mustRefresh: true,
    };
  }

  const explicitDomain = normalized.match(/(?:https?:\/\/)?([a-z0-9.-]+\.[a-z]{2,})(?:\/|\s|$)/i)?.[1]?.toLowerCase();

  return {
    requestedCount,
    sourceLabel: explicitDomain || null,
    allowedDomains: explicitDomain ? [explicitDomain] : [],
    freshness: /오늘|금일/.test(normalized) ? "TODAY" : /최근|최신|이번\s*주/.test(normalized) ? "RECENT" : "ANY",
    mustRefresh: /검색|찾아|조사|뉴스|기사|최신|최근|오늘|링크|출처|근거|사실\s*확인|재조사|다시\s*조사/i.test(normalized),
  };
}

export function shouldUseWebResearch(context: SawolAiContext) {
  const combined = contextText(context);
  const taskType = text(context.task?.task_type).toUpperCase();
  const feedback = (context.feedbacks ?? [])
    .map((row) => text(row.reason))
    .join(" ");

  if (taskType === "RESEARCH") return true;
  if (parseResearchRequirements(combined).mustRefresh) return true;
  if (/다시\s*조사|재조사|새로\s*찾|출처.*다시|근거.*다시|사실.*다시|틀렸|부정확|최신.*확인/i.test(feedback)) return true;
  return false;
}

export function getContextResearchRequirements(context: SawolAiContext) {
  return parseResearchRequirements(contextText(context));
}
