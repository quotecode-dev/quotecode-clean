// agents-room - Codex release 8, topic 8a/8b (Owner console 2026-10-30, decisions 12-13; migration 20261031000000): Guy's weekly
// competitor and keyword evidence from the search-data service (DataForSEO, server-only login / password, HTTP Basic). Runtime-independent.
//  - Once a week (per Sunday-week; a second run of the same week reuses the stored snapshot and spends nothing).
//  - At most 100 tracked keywords, 65 international / 35 Israel; topped up from Search Console's own top queries, the Owner may add more.
//  - Per market: where tekango.com ranks (the service's ranked-keywords data, depth 100), where each of the Owner's competitor domains
//    ranks, and the monthly volume of every tracked keyword. A keyword we do not rank for = "not found within the checked depth", never 0.
//  - Every paid request is reserved first against the 10 USD monthly data cap (agents_data_reserve) and settled with the provider's own
//    reported cost; no answer = unknown (the hold stays). A refused reservation stops the collection - nothing is sent.
//  - Opportunities = keywords a competitor ranks in the top 10 for and we do not, by volume - evidence for Guy and Noa, never an action.
// Codex review 2026-10-31 group 3 (Owner-typed, L-22 named; migration 20261031400000):
//  - F13: an unreadable 2xx answer keeps its hold (unknown); a missing / null cost is booked at the hold (never 0); an explicit 0 is settled.
//  - F14: a market whose own ranking lookup failed is "unavailable" - its keywords are never counted as "not found"; a stored week returns
//    its stored state, opportunities and spend; a partial week resumes only the markets that did not complete.
//  - F15: the week is claimed (marketing_week_claim, a lease) BEFORE any paid request - two collectors never buy the same data.
//  - F17: an unknown volume stays unknown (null), never 0.

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

export type Snapshot = { keywordId: string; ourPosition: number | null; competitorPositions: Record<string, number>; searchVolume: number | null; depth: number; ourStatus?: 'checked' | 'unavailable' };
export type Opportunity = { market: MarketKey; keyword: string; volume: number | null; competitor: string; position: number };
export type Competitive = {
  state: 'ok' | 'partial' | 'not_configured' | 'budget_blocked' | 'unavailable' | 'running'; week: string; checked: number; found: number; notFound: number;
  competitors: number; opportunities: Opportunity[]; spentUsd: number; fresh: boolean;
  unavailable?: number; markets?: Partial<Record<MarketKey, 'ok' | 'partial' | 'unavailable'>>;
};
export type WeekClaim = { status: 'claimed'; previous: Competitive | null } | { status: 'done'; result: Competitive } | { status: 'running' };
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
  claimWeek(week: string, run: string): Promise<WeekClaim>;
  finishWeek(week: string, run: string, result: Competitive): Promise<void>;
};
/** A reported number, or null when the source gave none (null / missing / empty / not a number) - never a silent 0. */
export const known = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
};
/** A search volume: a known, whole, non-negative number (the column is an integer), or null. */
const volumeOf = (v: unknown): number | null => { const n = known(v); return n === null ? null : Math.max(0, Math.round(n)); };

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
  // F13: an accepted request whose answer cannot be read may still be charged - the hold stays (unknown); a refusal (4xx) costs nothing
  if (!res.ok || !j) { await m.settle(r.id, res.ok || res.status >= 500 ? 'unknown' : 'failed'); return null; }
  const cost = typeof j.cost === 'number' && Number.isFinite(j.cost) && j.cost >= 0 ? j.cost : null;
  const micros = cost === null ? null : Math.round(cost * 1_000_000);
  // no reported cost = booked at the hold (agents_data_settle's fallback), never 0; an explicit 0 is a real zero
  await m.settle(r.id, 'settled', micros);
  // the ledger books the hold when no cost was reported - the week's spend line says the same
  spent.usd += (micros ?? hold) / 1_000_000;
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
    if (kw && Number.isInteger(pos) && pos >= 1 && pos <= 100 && !out.has(kw)) out.set(kw, { pos, volume: volumeOf(item?.keyword_data?.keyword_info?.search_volume) });
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
    const v = volumeOf(item?.keyword_info?.search_volume);
    if (item?.keyword && v !== null) out.set(norm(String(item.keyword)), v);
  }
  return out;
}

export function summarize(week: string, tracked: { id: string; market: MarketKey; keyword: string }[], rows: Snapshot[], opportunities: Opportunity[],
  competitors: number, spentUsd: number, state: Competitive['state'], fresh: boolean): Competitive {
  const ids = new Set(tracked.map((t) => t.id));
  const mine = rows.filter((r) => ids.has(r.keywordId));
  const found = mine.filter((r) => r.ourPosition !== null).length;
  const unavailable = mine.filter((r) => r.ourPosition === null && r.ourStatus === 'unavailable').length;
  return { state, week, checked: mine.length - unavailable, found, notFound: mine.length - found - unavailable, unavailable, competitors, opportunities: opportunities.slice(0, 10),
    spentUsd: Math.round(spentUsd * 10000) / 10000, fresh };
}

/** The week's collection: claimed before any paid request (F15); a stored complete week is reused; a partial one resumes only the
 *  markets that did not complete (F14). `queries` = Search Console's top queries (visitor text = data). */
export async function collectWeek(m: MarketingDeps, queries: string[], run: string = crypto.randomUUID()): Promise<Competitive> {
  const week = sundayOf(m.now());
  const empty = (state: Competitive['state']): Competitive => ({ state, week, checked: 0, found: 0, notFound: 0, unavailable: 0, competitors: 0, opportunities: [], spentUsd: 0, fresh: false });
  if (!m.creds()) return empty('not_configured');
  const claim = await m.claimWeek(week, run);
  if (claim.status === 'done') return { ...claim.result, fresh: false };
  if (claim.status === 'running') return empty('running');
  const previous = claim.previous;
  const doneMarkets = new Map((Object.entries(previous?.markets ?? {}) as [MarketKey, 'ok' | 'partial' | 'unavailable'][]).filter(([, v]) => v !== 'unavailable'));
  let tracked = await m.keywords();
  const comps = await m.competitors();
  const add = keywordsToAdd(tracked, queries);
  if (add.length) { await m.addKeywords(add); tracked = await m.keywords(); }
  const marketOf = new Map(tracked.map((t) => [t.id, t.market] as const));
  const stored = await m.weekSnapshots(week);
  if (!previous) for (const r of stored) { const mk = marketOf.get(r.keywordId); if (mk && r.ourStatus !== 'unavailable') doneMarkets.set(mk, 'partial'); }
  const kept = doneMarkets.size ? stored.filter((r) => doneMarkets.has(marketOf.get(r.keywordId) as MarketKey)) : [];
  const spent = { usd: 0 };
  const rows: Snapshot[] = [];
  const opportunities: Opportunity[] = (previous?.opportunities ?? []).filter((o) => doneMarkets.has(o.market));
  const markets: Partial<Record<MarketKey, 'ok' | 'partial' | 'unavailable'>> = {};
  for (const [k, v] of doneMarkets) markets[k] = v;
  let stop: Competitive['state'] | null = null;
  try {
    for (const market of (['intl', 'il'] as MarketKey[]).filter((x) => !doneMarkets.has(x))) {
      const list = tracked.filter((t) => t.market === market).slice(0, MARKETS[market].share);
      const ours = await ranked(m, market, OUR_DOMAIN, 1000, HOLDS.ours, spent);
      let complete = !!ours;
      const theirs: [string, Map<string, { pos: number; volume: number | null }>][] = [];
      for (const c of comps.filter((x) => x.market === market).slice(0, 5)) {
        const map = await ranked(m, market, c.domain, 300, HOLDS.competitor, spent);
        if (map) theirs.push([c.domain, map]); else complete = false;
      }
      const vol = await volumes(m, market, list.map((t) => t.keyword), spent);
      for (const t of list) {
        const k = norm(t.keyword);
        const competitorPositions: Record<string, number> = {};
        for (const [d, map] of theirs) { const p = map.get(k); if (p) competitorPositions[d] = p.pos; }
        rows.push({ keywordId: t.id, ourPosition: ours?.get(k)?.pos ?? null, competitorPositions, searchVolume: vol.get(k) ?? ours?.get(k)?.volume ?? null, depth: 100,
          ourStatus: ours ? 'checked' : 'unavailable' });
      }
      markets[market] = !ours ? 'unavailable' : complete ? 'ok' : 'partial';
      if (!ours) continue; // without our own ranking there is no opportunity to tell
      const gaps = new Map<string, Opportunity>();
      for (const [d, map] of theirs) {
        for (const [kw, v] of map) {
          if (v.pos > 10 || ours.has(kw)) continue;
          const prev = gaps.get(kw);
          if (!prev || v.pos < prev.position) gaps.set(kw, { market, keyword: kw, volume: v.volume, competitor: d, position: v.pos });
        }
      }
      opportunities.push(...[...gaps.values()].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0)).slice(0, 5));
    }
  } catch (e) {
    if (!(e instanceof DataStop)) throw e;
    stop = e.message === 'budget_blocked' ? 'budget_blocked' : 'not_configured';
  }
  if (rows.length) await m.saveSnapshots(week, rows);
  const all = [...kept, ...rows];
  const states = Object.values(markets);
  const state: Competitive['state'] = stop && !all.length ? stop
    : states.length === 2 && states.every((v) => v === 'ok') ? 'ok'
    : all.some((r) => r.ourStatus !== 'unavailable') ? 'partial' : (stop ?? 'unavailable');
  const result: Competitive = { ...summarize(week, tracked, all, opportunities, comps.length, (previous?.spentUsd ?? 0) + spent.usd, state, true), markets };
  await m.finishWeek(week, run, result);
  return result;
}
