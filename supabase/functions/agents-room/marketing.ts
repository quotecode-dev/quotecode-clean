// agents-room - Codex release 8, topic 8a/8b (Owner console 2026-10-30, decisions 12-13; migration 20261031000000): Guy's weekly
// competitor and keyword evidence from the search-data service (DataForSEO, server-only login / password, HTTP Basic). Runtime-independent.
//  - Once a week (per Sunday-week; a second run of the same week reuses the stored snapshot and spends nothing).
//  - At most 100 tracked keywords, 65 international / 35 Israel; topped up from Search Console's own top queries, the Owner may add more.
//  - Per market: where tekango.com ranks (the service's ranked-keywords data, depth 100), where each of the Owner's competitor domains
//    ranks, and the monthly volume of every tracked keyword. A keyword we do not rank for = "not found within the checked depth", never 0.
//  - Every paid request is reserved first against the 10 USD monthly data cap (agents_data_reserve) and settled with the provider's own
//    reported cost; no answer = unknown (the hold stays). A refused reservation stops the collection - nothing is sent.
//  - Opportunities = keywords a competitor ranks in the top 10 for and we do not, by volume - evidence for Guy and Noa, never an action.

export type MarketKey = 'il' | 'intl';
export const MARKETS: Record<MarketKey, { location: number; language: string; share: number }> = {
  intl: { location: 2840, language: 'en', share: 65 }, // the international sample: United States, English
  il: { location: 2376, language: 'he', share: 35 }, // Israel, Hebrew
};
export const MAX_KEYWORDS = 100;
export const OUR_DOMAIN = 'tekango.com';
const API = 'https://api.dataforseo.com/v3';
// holds (micros of a dollar) - above the list price of each request, settled with the reported cost
export const HOLDS = { ours: 150_000, competitor: 60_000, overview: 30_000 };

export type Snapshot = { keywordId: string; ourPosition: number | null; competitorPositions: Record<string, number>; searchVolume: number | null; depth: number };
export type Opportunity = { market: MarketKey; keyword: string; volume: number | null; competitor: string; position: number };
export type Competitive = {
  state: 'ok' | 'partial' | 'not_configured' | 'budget_blocked' | 'unavailable'; week: string; checked: number; found: number; notFound: number;
  competitors: number; opportunities: Opportunity[]; spentUsd: number; fresh: boolean;
};
export type MarketingDeps = {
  now(): Date;
  creds(): { login: string; password: string } | null;
  fetch(url: string, init: RequestInit): Promise<Response>;
  reserve(purpose: string, holdMicros: number): Promise<{ ok: true; id: string } | { ok: false; code: string }>;
  settle(id: string, state: 'settled' | 'failed' | 'unknown', costMicros?: number | null): Promise<void>;
  keywords(): Promise<{ id: string; market: MarketKey; keyword: string }[]>;
  addKeywords(rows: { market: MarketKey; keyword: string }[]): Promise<void>;
  competitors(): Promise<{ domain: string; market: MarketKey }[]>;
  weekSnapshots(week: string): Promise<Snapshot[]>;
  saveSnapshots(week: string, rows: Snapshot[]): Promise<void>;
};

/** The Sunday that starts this week (Israel), YYYY-MM-DD. */
export function sundayOf(now: Date): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(now);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  const day = new Date(`${g('year')}-${g('month')}-${g('day')}T00:00:00Z`);
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(g('weekday'));
  return new Date(day.getTime() - Math.max(dow, 0) * 86_400_000).toISOString().slice(0, 10);
}

export const marketOfQuery = (q: string): MarketKey => (/[֐-׿]/.test(q) ? 'il' : 'intl');
const norm = (k: string) => k.toLowerCase().replace(/\s+/g, ' ').trim();

/** The keywords to add from Search Console's top queries, keeping each market under its share of the 100. */
export function keywordsToAdd(tracked: { market: MarketKey; keyword: string }[], queries: string[]): { market: MarketKey; keyword: string }[] {
  const have = new Set(tracked.map((k) => `${k.market}|${norm(k.keyword)}`));
  const count = { il: tracked.filter((k) => k.market === 'il').length, intl: tracked.filter((k) => k.market === 'intl').length };
  const out: { market: MarketKey; keyword: string }[] = [];
  for (const q of queries) {
    const keyword = norm(String(q ?? '')).slice(0, 120);
    if (keyword.length < 2) continue;
    const market = marketOfQuery(keyword);
    if (have.has(`${market}|${keyword}`) || count[market] >= MARKETS[market].share) continue;
    have.add(`${market}|${keyword}`); count[market] += 1;
    out.push({ market, keyword });
  }
  return out;
}

class DataStop extends Error {}

/** One paid request: reserved, sent, settled with the reported cost. Returns the first task's result list, or null (failed / empty). */
async function paid(m: MarketingDeps, path: string, task: Record<string, unknown>, purpose: string, hold: number, spent: { usd: number }): Promise<unknown[] | null> {
  const c = m.creds();
  if (!c) throw new DataStop('not_configured');
  const r = await m.reserve(purpose, hold);
  if (!r.ok) throw new DataStop('budget_blocked');
  let res: Response;
  try {
    res = await m.fetch(`${API}/${path}`, { method: 'POST', headers: { Authorization: `Basic ${btoa(`${c.login}:${c.password}`)}`, 'Content-Type': 'application/json' }, body: JSON.stringify([task]) });
  } catch {
    await m.settle(r.id, 'unknown');
    return null;
  }
  // deno-lint-ignore no-explicit-any
  const j: any = await res.json().catch(() => null);
  if (!res.ok || !j) { await m.settle(r.id, res.status >= 500 ? 'unknown' : 'failed'); return null; }
  const cost = Number(j.cost);
  const micros = Number.isFinite(cost) && cost >= 0 ? Math.round(cost * 1_000_000) : null;
  await m.settle(r.id, micros === 0 ? 'failed' : 'settled', micros);
  if (micros) spent.usd += micros / 1_000_000;
  const t = Array.isArray(j.tasks) ? j.tasks[0] : null;
  if (!t || t.status_code !== 20000) return null;
  return Array.isArray(t.result) ? t.result : null;
}

/** keyword -> position (1..100) of one domain in one market (the service's ranked-keywords data). */
async function ranked(m: MarketingDeps, market: MarketKey, domain: string, limit: number, hold: number, spent: { usd: number }): Promise<Map<string, { pos: number; volume: number | null }> | null> {
  const res = await paid(m, 'dataforseo_labs/google/ranked_keywords/live', { target: domain, location_code: MARKETS[market].location, language_code: MARKETS[market].language, limit,
    filters: ['ranked_serp_element.serp_item.rank_group', '<=', 100] }, `ranked:${market}:${domain}`, hold, spent);
  if (!res) return null;
  const out = new Map<string, { pos: number; volume: number | null }>();
  // deno-lint-ignore no-explicit-any
  for (const item of ((res[0] as any)?.items ?? []) as any[]) {
    const kw = norm(String(item?.keyword_data?.keyword ?? ''));
    const pos = Number(item?.ranked_serp_element?.serp_item?.rank_group);
    const vol = Number(item?.keyword_data?.keyword_info?.search_volume);
    if (kw && Number.isInteger(pos) && pos >= 1 && pos <= 100 && !out.has(kw)) out.set(kw, { pos, volume: Number.isFinite(vol) ? vol : null });
  }
  return out;
}

async function volumes(m: MarketingDeps, market: MarketKey, keywords: string[], spent: { usd: number }): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!keywords.length) return out;
  const res = await paid(m, 'dataforseo_labs/google/keyword_overview/live', { keywords: keywords.slice(0, MAX_KEYWORDS), location_code: MARKETS[market].location,
    language_code: MARKETS[market].language }, `overview:${market}`, HOLDS.overview, spent);
  // deno-lint-ignore no-explicit-any
  for (const item of ((res?.[0] as any)?.items ?? []) as any[]) {
    const v = Number(item?.keyword_info?.search_volume);
    if (item?.keyword && Number.isFinite(v)) out.set(norm(String(item.keyword)), v);
  }
  return out;
}

export function summarize(week: string, tracked: { id: string; market: MarketKey; keyword: string }[], rows: Snapshot[], opportunities: Opportunity[],
  competitors: number, spentUsd: number, state: Competitive['state'], fresh: boolean): Competitive {
  const ids = new Set(tracked.map((t) => t.id));
  const mine = rows.filter((r) => ids.has(r.keywordId));
  const found = mine.filter((r) => r.ourPosition !== null).length;
  return { state, week, checked: mine.length, found, notFound: mine.length - found, competitors, opportunities: opportunities.slice(0, 10), spentUsd: Math.round(spentUsd * 10000) / 10000, fresh };
}

/** The week's collection (idempotent per week). `queries` = Search Console's top queries (visitor text = data). */
export async function collectWeek(m: MarketingDeps, queries: string[]): Promise<Competitive> {
  const week = sundayOf(m.now());
  if (!m.creds()) return { state: 'not_configured', week, checked: 0, found: 0, notFound: 0, competitors: 0, opportunities: [], spentUsd: 0, fresh: false };
  const existing = await m.weekSnapshots(week);
  let tracked = await m.keywords();
  const comps = await m.competitors();
  if (existing.length) return summarize(week, tracked, existing, [], comps.length, 0, 'ok', false);
  const add = keywordsToAdd(tracked, queries);
  if (add.length) { await m.addKeywords(add); tracked = await m.keywords(); }
  const spent = { usd: 0 };
  const rows: Snapshot[] = [];
  const opportunities: Opportunity[] = [];
  let state: Competitive['state'] = 'ok';
  try {
    for (const market of ['intl', 'il'] as MarketKey[]) {
      const list = tracked.filter((t) => t.market === market).slice(0, MARKETS[market].share);
      const ours = await ranked(m, market, OUR_DOMAIN, 1000, HOLDS.ours, spent);
      if (!ours) state = 'partial';
      const theirs: [string, Map<string, { pos: number; volume: number | null }>][] = [];
      for (const c of comps.filter((x) => x.market === market).slice(0, 5)) {
        const map = await ranked(m, market, c.domain, 300, HOLDS.competitor, spent);
        if (map) theirs.push([c.domain, map]); else state = 'partial';
      }
      const vol = await volumes(m, market, list.map((t) => t.keyword), spent);
      for (const t of list) {
        const k = norm(t.keyword);
        const competitorPositions: Record<string, number> = {};
        for (const [d, map] of theirs) { const p = map.get(k); if (p) competitorPositions[d] = p.pos; }
        rows.push({ keywordId: t.id, ourPosition: ours?.get(k)?.pos ?? null, competitorPositions, searchVolume: vol.get(k) ?? ours?.get(k)?.volume ?? null, depth: 100 });
      }
      const gaps = new Map<string, Opportunity>();
      for (const [d, map] of theirs) {
        for (const [kw, v] of map) {
          if (v.pos > 10 || ours?.has(kw)) continue;
          const prev = gaps.get(kw);
          if (!prev || v.pos < prev.position) gaps.set(kw, { market, keyword: kw, volume: v.volume, competitor: d, position: v.pos });
        }
      }
      opportunities.push(...[...gaps.values()].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0)).slice(0, 5));
    }
  } catch (e) {
    if (!(e instanceof DataStop)) throw e;
    state = e.message === 'budget_blocked' ? 'budget_blocked' : 'not_configured';
  }
  if (rows.length) await m.saveSnapshots(week, rows);
  return summarize(week, tracked, rows, opportunities, comps.length, spent.usd, rows.length ? state : (state === 'ok' ? 'unavailable' : state), true);
}
