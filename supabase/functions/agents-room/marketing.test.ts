// Codex release 8 (Owner 2026-10-30, decisions 12-13): Guy's weekly keyword / competitor evidence - capped, reserved, once a week.
// SYNTHETIC answers of the search-data service; nothing leaves the test.
import { describe, it, expect, vi } from 'vitest';
import { collectWeek, keywordsToAdd, sundayOf, MARKETS, type MarketingDeps, type Snapshot, type Competitive } from './marketing';
import { competitiveFinding } from './lib';

const ranked = (items: [string, number, number][]) => ({ cost: 0.11, tasks: [{ status_code: 20000, result: [{ items: items.map(([k, pos, vol]) => ({ keyword_data: { keyword: k, keyword_info: { search_volume: vol } }, ranked_serp_element: { serp_item: { rank_group: pos } } })) }] }] });
const overview = (items: [string, number][]) => ({ cost: 0.02, tasks: [{ status_code: 20000, result: [{ items: items.map(([k, v]) => ({ keyword: k, keyword_info: { search_volume: v } })) }] }] });

function deps(over: Partial<MarketingDeps> = {}) {
  const kws: { id: string; market: 'il' | 'intl'; keyword: string }[] = [{ id: 'k1', market: 'intl', keyword: 'quote template' }, { id: 'k2', market: 'il', keyword: 'הצעת מחיר' }];
  const saved: Record<string, Snapshot[]> = {};
  const holds: { purpose: string; hold: number }[] = [];
  const settles: { state: string; cost: number | null | undefined }[] = [];
  const calls: string[] = [];
  // Codex review 2026-10-31 F15: the week claim as the database keeps it (marketing_week_claim / marketing_week_finish)
  const weeks: Record<string, { run: string; finished: boolean; state?: string; result?: Competitive }> = {};
  const d: MarketingDeps & { saved: typeof saved; holds: typeof holds; settles: typeof settles; calls: typeof calls; weeks: typeof weeks } = {
    saved, holds, settles, calls, weeks,
    now: () => new Date('2026-11-04T09:00:00Z'),
    creds: () => ({ login: 'l', password: 'p' }),
    fetch: vi.fn(async (url: string, init: RequestInit) => {
      const t = JSON.parse(String(init.body))[0];
      calls.push(`${url.split('/v3/')[1]}:${t.target ?? t.keywords?.length}`);
      if (url.includes('keyword_overview')) return new Response(JSON.stringify(overview([['quote template', 2400], ['הצעת מחיר', 1300]])));
      if (t.target === 'tekango.com') return new Response(JSON.stringify(ranked(t.language_code === 'en' ? [['quote template', 12, 2400]] : [])));
      return new Response(JSON.stringify(ranked([['quote template', 3, 2400], ['invoice app', 4, 9000], ['far away', 40, 50000]])));
    }) as never,
    reserve: async (purpose, hold) => { holds.push({ purpose, hold }); return { ok: true, id: `h${holds.length}` }; },
    settle: async (_id, state, cost) => { settles.push({ state, cost }); },
    keywords: async () => kws,
    addKeywords: async (rows) => { rows.forEach((r, i) => kws.push({ id: `n${i}`, ...r })); },
    competitors: async () => [{ domain: 'rival.example', market: 'intl' }],
    weekSnapshots: async (w) => saved[w] ?? [],
    saveSnapshots: async (w, rows) => { const keep = (saved[w] ?? []).filter((r) => !rows.some((x) => x.keywordId === r.keywordId)); saved[w] = [...keep, ...rows]; },
    claimWeek: async (w, run) => {
      const cur = weeks[w];
      if (!cur) { weeks[w] = { run, finished: false }; return { status: 'claimed', previous: null }; }
      if (cur.finished && cur.state === 'ok') return { status: 'done', result: cur.result as Competitive };
      if (!cur.finished && cur.run !== run) return { status: 'running' };
      const previous = cur.result ?? null; weeks[w] = { run, finished: false, result: cur.result }; return { status: 'claimed', previous };
    },
    finishWeek: async (w, run, result) => { if (weeks[w]?.run === run && !weeks[w].finished) weeks[w] = { run, finished: true, state: result.state, result }; },
    ...over,
  };
  return d;
}

describe('Guy\'s keyword evidence', () => {
  it('keeps 65 international / 35 Israel and never repeats a keyword', () => {
    const tracked = Array.from({ length: 64 }, (_, i) => ({ market: 'intl' as const, keyword: `k${i}` }));
    const add = keywordsToAdd(tracked, ['quote app', 'Quote  App', 'invoice', 'הצעת מחיר', 'k3']);
    expect(add).toEqual([{ market: 'intl', keyword: 'quote app' }, { market: 'il', keyword: 'הצעת מחיר' }]);
    expect(MARKETS.intl.share + MARKETS.il.share).toBe(100);
    expect(sundayOf(new Date('2026-11-04T09:00:00Z'))).toBe('2026-11-01');
  });
  it('one collection a week: our positions, the competitors\', volumes, opportunities; "not found" is never a zero', async () => {
    const d = deps();
    const c = await collectWeek(d, ['quote software']);
    expect(c).toMatchObject({ state: 'ok', week: '2026-11-01', checked: 3, found: 1, notFound: 2, competitors: 1, fresh: true });
    const rows = d.saved['2026-11-01'];
    expect(rows.find((r) => r.keywordId === 'k1')).toMatchObject({ ourPosition: 12, competitorPositions: { 'rival.example': 3 }, searchVolume: 2400 });
    expect(rows.find((r) => r.keywordId === 'k2')).toMatchObject({ ourPosition: null, searchVolume: 1300 });
    expect(c.opportunities).toEqual([{ market: 'intl', keyword: 'invoice app', volume: 9000, competitor: 'rival.example', position: 4 }]);
    expect(d.settles.every((s) => s.state === 'settled')).toBe(true);
    expect(c.spentUsd).toBeCloseTo(0.11 * 3 + 0.02 * 2, 4);
    const again = await collectWeek(d, []);
    expect(again).toMatchObject({ state: 'ok', fresh: false, checked: 3 });
    expect((d.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(5); // the second run of the week spent nothing
  });
  it('no login = said so, nothing sent; a refused reservation stops before any request', async () => {
    const off = deps({ creds: () => null });
    expect((await collectWeek(off, [])).state).toBe('not_configured');
    expect(off.fetch).not.toHaveBeenCalled();
    const capped = deps({ reserve: async () => ({ ok: false, code: 'data_budget_blocked' }) });
    expect((await collectWeek(capped, [])).state).toBe('budget_blocked');
    expect(capped.fetch).not.toHaveBeenCalled();
  });
  // Codex review 2026-10-31 F14 (Owner-typed, L-22 named - this guard was "partial or ok"): no data is UNAVAILABLE, never "not found"
  it('no answer = the hold stays (unknown); the week is unavailable and nothing is counted as "not found"', async () => {
    const d = deps({ fetch: vi.fn(async () => { throw new Error('timeout'); }) as never });
    const c = await collectWeek(d, []);
    expect(d.settles.every((s) => s.state === 'unknown')).toBe(true);
    expect(c).toMatchObject({ state: 'unavailable', found: 0, notFound: 0, unavailable: 2 });
    expect(d.saved['2026-11-01'].every((r) => r.ourStatus === 'unavailable')).toBe(true);
  });
  it('F13: an unreadable 2xx keeps its hold; a missing / null cost is booked at the hold (never 0); an explicit 0 is a real zero', async () => {
    const bad = deps({ fetch: vi.fn(async () => new Response('not json', { status: 200 })) as never });
    await collectWeek(bad, []);
    expect(bad.settles.every((s) => s.state === 'unknown')).toBe(true);
    const nocost = deps({ fetch: vi.fn(async () => new Response(JSON.stringify({ cost: null, tasks: [{ status_code: 20000, result: [{ items: [] }] }] }))) as never });
    await collectWeek(nocost, []);
    expect(nocost.settles.every((s) => s.state === 'settled' && s.cost === null)).toBe(true);
    const zero = deps({ fetch: vi.fn(async () => new Response(JSON.stringify({ cost: 0, tasks: [{ status_code: 20000, result: [{ items: [] }] }] }))) as never });
    await collectWeek(zero, []);
    expect(zero.settles.every((s) => s.state === 'settled' && s.cost === 0)).toBe(true);
  });
  it('review: a missing cost counts at the hold in the weekly spend; a partial market is never bought again; a pre-release week is reused', async () => {
    const nocost = deps({ fetch: vi.fn(async () => new Response(JSON.stringify({ cost: null, tasks: [{ status_code: 20000, result: [{ items: [] }] }] }))) as never });
    const c = await collectWeek(nocost, []);
    expect(c.spentUsd).toBeCloseTo(nocost.holds.reduce((t, h) => t + h.hold, 0) / 1_000_000, 4);
    const base = deps();
    const fetch = base.fetch as ReturnType<typeof vi.fn>;
    const d = deps({ fetch: vi.fn(async (url: string, init: RequestInit) => (JSON.parse(String(init.body))[0].target === 'rival.example' ? new Response('{}', { status: 503 }) : fetch(url, init))) as never });
    const first = await collectWeek(d, [], 'run-1');
    expect(first.markets).toEqual({ intl: 'partial', il: 'ok' });
    const n = (d.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    await collectWeek(d, [], 'run-2');
    expect((d.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(n);
    const legacy = deps();
    legacy.saved['2026-11-01'] = [{ keywordId: 'k1', ourPosition: 12, competitorPositions: {}, searchVolume: 2400, depth: 100 }, { keywordId: 'k2', ourPosition: null, competitorPositions: {}, searchVolume: 1300, depth: 100 }];
    const reused = await collectWeek(legacy, []);
    expect(legacy.fetch).not.toHaveBeenCalled();
    expect(reused).toMatchObject({ checked: 2, found: 1 });
  });
  it('F15: a second collector of the same week buys nothing while the first runs', async () => {
    const d = deps();
    d.weeks['2026-11-01'] = { run: 'other-run', finished: false };
    expect((await collectWeek(d, [])).state).toBe('running');
    expect(d.fetch).not.toHaveBeenCalled();
    expect(competitiveFinding({ state: 'running', week: 'w', checked: 0, found: 0, notFound: 0, competitors: 0, opportunities: [], spentUsd: 0, fresh: false }).he).toContain('ממתין');
  });
  it('F14: a partial week resumes only the market that did not complete, keeping the done market and its spend', async () => {
    let failIntl = true;
    const base = deps();
    const fetch = base.fetch as ReturnType<typeof vi.fn>;
    const d = deps({ fetch: vi.fn(async (url: string, init: RequestInit) => {
      const t = JSON.parse(String(init.body))[0];
      if (failIntl && t.target === 'tekango.com' && t.language_code === 'en') return new Response('{}', { status: 503 });
      return fetch(url, init);
    }) as never });
    const first = await collectWeek(d, [], 'run-1');
    expect(first).toMatchObject({ state: 'partial', unavailable: 1, markets: { intl: 'unavailable', il: 'ok' } });
    failIntl = false;
    const calls = (d.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    const second = await collectWeek(d, [], 'run-2');
    expect(second).toMatchObject({ state: 'ok', found: 1, unavailable: 0, markets: { intl: 'ok', il: 'ok' } });
    const resumed = (d.fetch as ReturnType<typeof vi.fn>).mock.calls.slice(calls).map((c) => JSON.parse(String(c[1].body))[0].language_code);
    expect(resumed.every((l) => l === 'en')).toBe(true); // Israel was not bought again
    expect(second.spentUsd).toBeGreaterThan(first.spentUsd);
  });
  it('the report lines use the spec\'s words', () => {
    expect(competitiveFinding({ state: 'ok', week: 'w', checked: 3, found: 1, notFound: 2, competitors: 1, opportunities: [], spentUsd: 0.37, fresh: true }).he)
      .toBe('מילות חיפוש שנבדקו: 3 · אנחנו מופיעים ב-1 · לא נמצא בעומק הבדיקה: 2');
    expect(competitiveFinding(null).he).toBe('מילות חיפוש שנבדקו: נתוני המתחרים לא זמינים השבוע.');
    expect(competitiveFinding({ state: 'partial', week: 'w', checked: 3, found: 1, notFound: 0, unavailable: 2, competitors: 1, opportunities: [], spentUsd: 0, fresh: true }).he)
      .toBe('מילות חיפוש שנבדקו: 3 · אנחנו מופיעים ב-1 · לא נמצא בעומק הבדיקה: 0 · לא זמין: 2');
    expect(competitiveFinding({ state: 'ok', week: 'w', checked: 3, found: 1, notFound: 2, competitors: 1, opportunities: [], spentUsd: 0, fresh: true }).en).toContain('Not found within checked depth'.toLowerCase());
  });
});
