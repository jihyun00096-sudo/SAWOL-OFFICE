import {
  parseResearchRequirements,
  type ResearchRequirements,
} from "@/lib/ai/research-policy";

export type FreeResearchSource = {
  title: string;
  url: string;
  source: string;
  published_at: string;
  excerpt: string;
  domain: string;
};

export class ResearchInsufficientError extends Error {
  code = "RESEARCH_INSUFFICIENT";
  requestedCount: number | null;
  foundCount: number;
  sourceLabel: string | null;

  constructor({
    message,
    requestedCount,
    foundCount,
    sourceLabel,
  }: {
    message: string;
    requestedCount: number | null;
    foundCount: number;
    sourceLabel: string | null;
  }) {
    super(message);
    this.name = "ResearchInsufficientError";
    this.requestedCount = requestedCount;
    this.foundCount = foundCount;
    this.sourceLabel = sourceLabel;
  }
}

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
  return decodeHtml(
    value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " "),
  ).trim();
}

function pickTag(block: string, tag: string) {
  const match = block.match(
    new RegExp(
      `<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,
      "i",
    ),
  );
  return match ? stripTags(match[1]) : "";
}

function pickSource(block: string) {
  const match = block.match(
    /<source(?:\s[^>]*)?>([\s\S]*?)<\/source>/i,
  );
  return match ? stripTags(match[1]) : "";
}

function extractField(prompt: string, key: string) {
  return (
    prompt
      .match(
        new RegExp(
          `"${key}"\\s*:\\s*"([^"]+)"`,
          "i",
        ),
      )?.[1]
      ?.replace(/\\n/g, " ")
      .trim() ?? ""
  );
}

function requestText(prompt: string) {
  const title = extractField(prompt, "title");
  const description = extractField(prompt, "description");
  const rootTitle = extractField(prompt, "root_title");
  const rootDescription = extractField(prompt, "root_description");

  return `${rootTitle} ${rootDescription} ${title} ${description}`.trim() || prompt;
}

const stop = new Set([
  "오늘",
  "내일",
  "어제",
  "사용할",
  "쓸",
  "관련",
  "주요",
  "기사",
  "뉴스",
  "이슈",
  "찾아줘",
  "찾아서",
  "가져와",
  "가져와줘",
  "정리",
  "정리해줘",
  "알려줘",
  "대한",
  "기준",
  "국내",
  "내용",
  "정보",
  "링크",
  "출처",
  "네이버",
  "다음",
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
  return allowed.some(
    (domain) => host === domain || host.endsWith(`.${domain}`),
  );
}

function isNaverRequirement(requirements: ResearchRequirements) {
  return requirements.allowedDomains.some(
    (domain) =>
      domain === "news.naver.com" ||
      domain === "n.news.naver.com",
  );
}

function categoryFallbacks(text: string) {
  const rows: string[] = [];

  if (/부동산|아파트|주택|재개발|재건축|분양|전세|매매/.test(text)) {
    rows.push(
      "부동산",
      "아파트",
      "주택",
      "재개발 재건축",
      "전세 매매",
      "부동산 정책",
    );
  }

  if (/경제|증시|주식|코스피|코스닥|금리|환율/.test(text)) {
    rows.push(
      "경제",
      "증시",
      "금리",
      "환율",
      "주식",
    );
  }

  if (/AI|인공지능|챗GPT|제미나이|오픈AI/i.test(text)) {
    rows.push(
      "AI",
      "인공지능",
      "생성형 AI",
    );
  }

  if (/정치|국회|대통령|정부/.test(text)) {
    rows.push(
      "정치",
      "정부",
      "국회",
    );
  }

  return rows;
}

function searchQueryStages(
  prompt: string,
  requirements: ResearchRequirements,
) {
  const raw = requestText(prompt);
  const baseTokens = tokens(raw);
  const siteFilter = requirements.allowedDomains.length
    ? ` (${requirements.allowedDomains
        .map((domain) => `site:${domain}`)
        .join(" OR ")})`
    : "";

  const freshnessFilter =
    requirements.freshness === "TODAY"
      ? " when:1d"
      : requirements.freshness === "RECENT"
        ? " when:7d"
        : "";

  const exact = [
    `${baseTokens.slice(0, 6).join(" ")}${siteFilter}${freshnessFilter}`,
    `${baseTokens.slice(0, 4).join(" ")}${siteFilter}${freshnessFilter}`,
  ];

  const widened = [
    `${baseTokens.slice(0, 3).join(" ")}${siteFilter}${freshnessFilter}`,
    `${baseTokens.slice(0, 2).join(" ")}${siteFilter}`,
  ];

  const category = categoryFallbacks(raw).map(
    (query) => `${query}${siteFilter}${freshnessFilter}`,
  );

  return [
    [...new Set(exact.filter((q) => q.trim().length > 4))],
    [...new Set(widened.filter((q) => q.trim().length > 4))],
    [...new Set(category.filter(Boolean))],
  ];
}

async function fetchRss(query: string) {
  const url =
    `https://news.google.com/rss/search?q=${encodeURIComponent(query)}` +
    `&hl=ko&gl=KR&ceid=KR:ko`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 SAWOL-OFFICE/1.0",
      Accept:
        "application/rss+xml, application/xml, text/xml",
      "Accept-Language": "ko-KR,ko;q=0.9",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Google News RSS HTTP ${response.status}`);
  }

  const xml = await response.text();
  const items =
    xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) ?? [];

  return items
    .map((item) => ({
      title: pickTag(item, "title"),
      url: pickTag(item, "link"),
      source: pickSource(item) || "Google News",
      published_at: pickTag(item, "pubDate"),
    }))
    .filter((item) => item.title && item.url);
}

function metaContent(html: string, key: string) {
  const escaped = key.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );

  const a = html.match(
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`,
      "i",
    ),
  );

  const b = html.match(
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`,
      "i",
    ),
  );

  return decodeHtml((a?.[1] || b?.[1] || "").trim());
}

function normalizeNaverNewsUrl(url: string) {
  try {
    const parsed = new URL(decodeHtml(url));
    const host = parsed.hostname.toLowerCase();

    if (
      host !== "news.naver.com" &&
      host !== "n.news.naver.com"
    ) {
      return null;
    }

    // n.news.naver.com/mnews/article/001/0012345678
    const article = parsed.pathname.match(
      /\/(?:mnews\/)?article\/(\d{3})\/(\d+)/,
    );

    if (article) {
      return `https://n.news.naver.com/mnews/article/${article[1]}/${article[2]}`;
    }

    // 구형 news.naver.com URL도 그대로 허용
    const oid = parsed.searchParams.get("oid");
    const aid = parsed.searchParams.get("aid");

    if (oid && aid) {
      return `https://n.news.naver.com/mnews/article/${oid}/${aid}`;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

async function fetchNaverNewsSearch(query: string) {
  const params = new URLSearchParams({
    where: "news",
    query,
    sort: "1",
  });

  const url = `https://search.naver.com/search.naver?${params.toString()}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ko-KR,ko;q=0.9",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Naver News Search HTTP ${response.status}`);
  }

  const html = decodeHtml(await response.text());

  const found = new Set<string>();

  const absolutePatterns = [
    /https:\/\/n\.news\.naver\.com\/mnews\/article\/\d{3}\/\d+/gi,
    /https:\/\/news\.naver\.com\/[^"'<> ]+/gi,
  ];

  for (const pattern of absolutePatterns) {
    for (const match of html.match(pattern) ?? []) {
      const normalized = normalizeNaverNewsUrl(match);
      if (normalized) found.add(normalized);
    }
  }

  // href가 percent-encoding 된 경우도 복구
  for (const encoded of html.match(
    /https%3A%2F%2F(?:n\.news\.naver\.com|news\.naver\.com)[^"'<> ]+/gi,
  ) ?? []) {
    try {
      const normalized = normalizeNaverNewsUrl(
        decodeURIComponent(encoded),
      );
      if (normalized) found.add(normalized);
    } catch {
      // ignore malformed search fragment
    }
  }

  return [...found];
}

async function hydrateUrl(
  url: string,
  fallback?: {
    title?: string;
    source?: string;
    published_at?: string;
  },
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(url, {
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ko-KR,ko;q=0.9",
      },
    });

    const finalUrl = response.url || url;
    const html = (await response.text()).slice(0, 500_000);

    const canonical = html.match(
      /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
    )?.[1];

    const ogUrl = metaContent(html, "og:url");
    const candidateUrls = [
      canonical,
      ogUrl,
      finalUrl,
      url,
    ].filter(Boolean) as string[];

    const resolvedUrl =
      candidateUrls.find((candidate) =>
        /^https?:\/\//i.test(candidate),
      ) || url;

    const title =
      metaContent(html, "og:title") ||
      metaContent(html, "twitter:title") ||
      fallback?.title ||
      "";

    const description =
      metaContent(html, "og:description") ||
      metaContent(html, "description");

    const published =
      metaContent(html, "article:published_time") ||
      metaContent(html, "article:published") ||
      fallback?.published_at ||
      "";

    const source =
      metaContent(html, "og:site_name") ||
      fallback?.source ||
      "확인 필요";

    return {
      title: stripTags(title),
      url: resolvedUrl,
      source: stripTags(source),
      published_at: published,
      excerpt: stripTags(description).slice(0, 900),
      domain: domainOf(resolvedUrl),
    } satisfies FreeResearchSource;
  } catch {
    return {
      title: fallback?.title || url,
      url,
      source: fallback?.source || "확인 필요",
      published_at: fallback?.published_at || "",
      excerpt: "",
      domain: domainOf(url),
    } satisfies FreeResearchSource;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveGoogleNewsItem(item: {
  title: string;
  url: string;
  source: string;
  published_at: string;
}) {
  return hydrateUrl(item.url, item);
}

function directNaverQueries(
  prompt: string,
) {
  const raw = requestText(prompt);
  const base = tokens(raw);

  const phases = [
    base.slice(0, 6).join(" "),
    base.slice(0, 4).join(" "),
    base.slice(0, 2).join(" "),
    ...categoryFallbacks(raw),
  ];

  return [...new Set(phases.filter((q) => q.trim().length >= 2))];
}

async function collectDirectNaver(
  prompt: string,
  desired: number,
  unique: Map<string, FreeResearchSource>,
  activity: string[],
) {
  const queries = directNaverQueries(prompt);

  for (let i = 0; i < queries.length; i += 1) {
    const query = queries[i];

    try {
      activity.push(
        `네이버 직접 검색 ${i + 1}/${queries.length}: ${query}`,
      );

      const urls = await fetchNaverNewsSearch(query);

      for (const url of urls.slice(0, desired * 3)) {
        const normalized = normalizeNaverNewsUrl(url);
        if (!normalized) continue;

        const hydrated = await hydrateUrl(normalized);
        if (!domainAllowed(hydrated.url, [
          "news.naver.com",
          "n.news.naver.com",
        ])) {
          continue;
        }

        if (!unique.has(hydrated.url)) {
          unique.set(hydrated.url, hydrated);
        }

        if (unique.size >= desired) return;
      }
    } catch (error) {
      activity.push(
        `네이버 직접 검색 실패: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    if (unique.size < desired) {
      await new Promise((resolve) => setTimeout(resolve, 450));
    }
  }
}

export async function fetchFreeResearchSources(
  prompt: string,
  limit = 12,
) {
  const requirements = parseResearchRequirements(
    requestText(prompt),
  );

  const requested = requirements.requestedCount ?? 3;
  const desired = Math.max(limit, requested * 4);

  const unique = new Map<string, FreeResearchSource>();
  const errors: string[] = [];
  const activity: string[] = [];

  // 특정 출처가 네이버 뉴스면 Google News 우회보다
  // 실제 네이버 뉴스 검색 결과를 먼저 찾습니다.
  if (isNaverRequirement(requirements)) {
    await collectDirectNaver(
      prompt,
      desired,
      unique,
      activity,
    );
  }

  // 부족하면 3단계로 검색 전략을 넓혀 재검색합니다.
  const stages = searchQueryStages(prompt, requirements);

  for (let stageIndex = 0; stageIndex < stages.length; stageIndex += 1) {
    if (unique.size >= desired) break;

    activity.push(
      `보조 검색 전략 ${stageIndex + 1}/${stages.length} 시작`,
    );

    for (const query of stages[stageIndex]) {
      try {
        const raw = await fetchRss(query);

        for (const item of raw.slice(0, desired * 3)) {
          const hydrated = await resolveGoogleNewsItem(item);

          if (
            requirements.allowedDomains.length &&
            !domainAllowed(
              hydrated.url,
              requirements.allowedDomains,
            )
          ) {
            continue;
          }

          const key =
            hydrated.url ||
            `${hydrated.title}|${hydrated.source}`.toLowerCase();

          if (!unique.has(key)) {
            unique.set(key, hydrated);
          }

          if (unique.size >= desired) break;
        }
      } catch (error) {
        errors.push(
          `${query}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      if (unique.size >= desired) break;
    }

    if (unique.size < requested) {
      activity.push(
        `${stageIndex + 1}차 전략 결과 ${unique.size}건 · 자동 재조사 진행`,
      );
      await new Promise((resolve) => setTimeout(resolve, 650));
    }
  }

  const rows = [...unique.values()].slice(0, desired);

  if (!rows.length && errors.length) {
    throw new Error(
      `무료 뉴스 검색 연결 실패: ${errors
        .slice(0, 2)
        .join(" / ")}`,
    );
  }

  if (
    requirements.sourceLabel &&
    requirements.requestedCount &&
    rows.length < requirements.requestedCount
  ) {
    throw new ResearchInsufficientError({
      requestedCount: requirements.requestedCount,
      foundCount: rows.length,
      sourceLabel: requirements.sourceLabel,
      message:
        `${requirements.sourceLabel}에서 검증 가능한 링크 ` +
        `${requirements.requestedCount}개를 요청받아 검색 전략을 여러 번 바꿔 재조사했지만 ` +
        `${rows.length}개만 확보했습니다. 다른 출처로 임의 대체하지 않았습니다.`,
    });
  }

  return {
    rows,
    requirements,
    activity,
  };
}
