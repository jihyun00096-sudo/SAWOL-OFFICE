export type FreeResearchSource = {
  title: string;
  url: string;
  source: string;
  published_at: string;
};

function decodeHtml(value: string) {
  return value.replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}
function stripTags(value: string) { return decodeHtml(value.replace(/<[^>]*>/g, "")).trim(); }
function pickTag(block: string, tag: string) { const m=block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,"i")); return m?stripTags(m[1]):""; }
function pickSource(block: string) { const m=block.match(/<source(?:\s[^>]*)?>([\s\S]*?)<\/source>/i); return m?stripTags(m[1]):""; }
function extractField(prompt:string,key:string){return prompt.match(new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`,"i"))?.[1]?.trim()??"";}
const stop=new Set(["오늘","내일","어제","사용할","쓸","관련","주요","기사","뉴스","이슈","찾아줘","찾아서","가져와","정리","정리해줘","알려줘","3개","대한","기준","국내","내용","정보"]);
function tokens(v:string){return v.replace(/[^\p{L}\p{N}\s-]/gu," ").split(/\s+/).map(x=>x.trim()).filter(x=>x.length>=2&&!stop.has(x));}
function candidates(prompt:string){const title=extractField(prompt,"title");const desc=extractField(prompt,"description");const all=`${title} ${desc}`;const out:string[]=[];const domains:[RegExp,string[]][]=[[/부동산|아파트|주택|재개발|재건축|분양|전세|매매/,["부동산","주택","아파트"]],[/증시|주식|코스피|코스닥|금리|환율|경제/,["경제","증시","금리"]],[/인공지능|AI|챗GPT|제미나이|오픈AI/i,["AI","인공지능"]],[/정치|국회|대통령|정부/,["정치","정부"]],[/스포츠|야구|축구|농구|배구/,["스포츠"]]];for(const [r,k] of domains){if(r.test(all)){out.push(`${k.join(" ")} when:1d`,`${k[0]} when:3d`,k[0]);break;}}const t=tokens(title);if(t.length)out.push(`${t.slice(0,4).join(" ")} when:3d`,t.slice(0,3).join(" "));const a=tokens(all);if(a.length)out.push(`${a.slice(0,4).join(" ")} when:3d`,a.slice(0,2).join(" "));return [...new Set(out.filter(Boolean))];}
async function fetchRss(q:string){const url=`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=ko&gl=KR&ceid=KR:ko`;const r=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0 SAWOL-OFFICE/1.0","Accept":"application/rss+xml, application/xml, text/xml","Accept-Language":"ko-KR,ko;q=0.9"},cache:"no-store"});if(!r.ok)throw new Error(`HTTP ${r.status}`);const xml=await r.text();const items=xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi)??[];return items.map(item=>{const title=pickTag(item,"title"),url=pickTag(item,"link");if(!title||!url)return null;return {title,url,source:pickSource(item)||"Google News",published_at:pickTag(item,"pubDate")} as FreeResearchSource;}).filter(Boolean) as FreeResearchSource[];}
export async function fetchFreeResearchSources(prompt:string,limit=12){const unique=new Map<string,FreeResearchSource>();const errors:string[]=[];for(const q of candidates(prompt)){try{for(const row of await fetchRss(q)){const key=`${row.title}|${row.source}`.toLowerCase();if(!unique.has(key))unique.set(key,row);if(unique.size>=limit)break;}if(unique.size>=Math.min(limit,8))break;}catch(e){errors.push(`${q}: ${e instanceof Error?e.message:String(e)}`);}}const rows=[...unique.values()].slice(0,limit);if(!rows.length&&errors.length)throw new Error(`무료 뉴스 검색 연결 실패: ${errors.slice(0,2).join(" / ")}`);return rows;}
