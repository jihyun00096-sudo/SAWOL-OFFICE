import { parseResearchRequirements, type ResearchRequirements } from "@/lib/ai/research-policy";

export type FreeResearchSource = {
  title: string;
  url: string;
  source: string;
  published_at: string;
  excerpt: string;
  domain: string;
};

function decodeHtml(value: string) {
  return value
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(value: string) {
  return decodeHtml(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ")).trim();
}

function pickTag(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? stripTags(match[1]) : "";
}

function pickSource(block: string) {
  const match = block.match(/<source(?:\s[^>]*)?>([\s\S]*?)<\/source>/i);
  return match ? stripTags(match[1]) : "";
}

function extractField(prompt: string, key: string) {
  return prompt.match(new RegExp(`"${key}"\\s*:\\s*"([^\"]+)"`, "i"))?.[1]?.replace(/\\n/g, " ").trim() ?? "";
}

function requestText(prompt: string) {
  const title = extractField(prompt, "title");
  const description = extractField(prompt, "description");
  const rootTitle = extractField(prompt, "root_title");
  const rootDescription = extractField(prompt, "root_description");
  return `${rootTitle} ${rootDescription} ${title} ${description}`.trim() || prompt;
}

const stop = new Set([
  "오늘", "내일", "어제", "사용할", "쓸", "관련", "주요", "기사", "뉴스", "이슈",
  "찾아줘", "찾아서", "가져와", "가져와줘", "정리", "정리해줘", "알려줘", "대한",
  "기준", "국내", "내용", "정보", "링크", "출처", "네이버", "다음",
]);

function tokens(value: string) {
  return value
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && !stop.has(item))
    .filter((item) => !/^\d+(?:개|건)?$/.test(item));
}

function domainOf(url: string) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function domainAllowed(url: string, allowed: string[]) {
  if (!allowed.length) return true;
  const host = domainOf(url);
  return allowed.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

function searchQueries(prompt: string, requirements: ResearchRequirements) {
  const raw = requestText(prompt);
  const baseTokens = tokens(raw).slice(0, 6);
  const queryBase = baseTokens.join(" ") || "대한민국 주요 뉴스";
  const siteFilter = requirements.allowedDomains.length
    ? ` (${requirements.allowedDomains.map((domain) => `site:${domain}`).join(" OR ")})`
    : "";
  const timeFilter = requirements.freshness === "TODAY" ? " when:1d" : requirements.freshness === "RECENT" ? " when:7d" : "";

  return [...new Set([
    `${queryBase}${siteFilter}${timeFilter}`,
    `${baseTokens.slice(0, 4).join(" ")}${siteFilter}${timeFilter}`,
    `${baseTokens.slice(0, 3).join(" ")}${siteFilter}`,
  ].filter((q) => q.trim().length > 4))];
}

async function fetchRss(query: string) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 SAWOL-OFFICE/1.0",
      Accept: "application/rss+xml, application/xml, text/xml",
      "Accept-Language": "ko-KR,ko;q=0.9",
    },
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`Google News RSS HTTP ${response.status}`);
  const xml = await response.text();
  const items = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) ?? [];

  return items.map((item) => ({
    title: pickTag(item, "title"),
    url: pickTag(item, "link"),
    source: pickSource(item) || "Google News",
    published_at: pickTag(item, "pubDate"),
  })).filter((item) => item.title && item.url);
}

function metaContent(html: string, key: string) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const a = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"));
  const b = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, "i"));
  return decodeHtml((a?.[1] || b?.[1] || "").trim());
}

async function resolveAndHydrate(row: { title: string; url: string; source: string; published_at: string }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(row.url, {
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 SAWOL-OFFICE/1.0",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ko-KR,ko;q=0.9",
      },
    });

    const finalUrl = response.url || row.url;
    const html = (await response.text()).slice(0, 450_000);
    const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1];
    const ogUrl = metaContent(html, "og:url");
    const candidates = [canonical, ogUrl, finalUrl].filter(Boolean) as string[];
    const resolvedUrl = candidates.find((url) => /^https?:\/\//i.test(url)) || finalUrl;

    const ogTitle = metaContent(html, "og:title");
    const description = metaContent(html, "og:description") || metaContent(html, "description");
    const published = metaContent(html, "article:published_time") || row.published_at;

    return {
      title: ogTitle || row.title,
      url: resolvedUrl,
      source: row.source,
      published_at: published,
      excerpt: stripTags(description).slice(0, 900),
      domain: domainOf(resolvedUrl),
    } satisfies FreeResearchSource;
  } catch {
    return {
      title: row.title,
      url: row.url,
      source: row.source,
      published_at: row.published_at,
      excerpt: "",
      domain: domainOf(row.url),
    } satisfies FreeResearchSource;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchFreeResearchSources(prompt: string, limit = 12) {
  const requirements = parseResearchRequirements(requestText(prompt));
  const desired = Math.max(limit, (requirements.requestedCount ?? 3) * 4);
  const unique = new Map<string, FreeResearchSource>();
  const errors: string[] = [];

  for (const query of searchQueries(prompt, requirements)) {
    try {
      const raw = await fetchRss(query);
      for (const item of raw.slice(0, desired * 2)) {
        const hydrated = await resolveAndHydrate(item);
        if (requirements.allowedDomains.length && !domainAllowed(hydrated.url, requirements.allowedDomains)) continue;
        const key = hydrated.url || `${hydrated.title}|${hydrated.source}`.toLowerCase();
        if (!unique.has(key)) unique.set(key, hydrated);
        if (unique.size >= desired) break;
      }
      if (unique.size >= desired) break;
    } catch (error) {
      errors.push(`${query}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const rows = [...unique.values()].slice(0, desired);

  if (!rows.length && errors.length) {
    throw new Error(`무료 뉴스 검색 연결 실패: ${errors.slice(0, 2).join(" / ")}`);
  }

  if (requirements.sourceLabel && requirements.requestedCount && rows.length < requirements.requestedCount) {
    throw new Error(
      `${requirements.sourceLabel}에서 검증 가능한 링크를 ${requirements.requestedCount}개 요청받았지만 ${rows.length}개만 확보했습니다. 다른 출처로 임의 대체하지 않았습니다.`,
    );
  }

  return { rows, requirements };
}
