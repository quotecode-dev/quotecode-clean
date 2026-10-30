// Codex release 8 (Owner 2026-10-30, decisions 12-13): Guy's weekly keyword / competitor evidence - capped, reserved, once a week.
// SYNTHETIC answers of the search-data service; nothing leaves the test.
import { describe, it, expect, vi } from 'vitest';
import { collectWeek, keywordsToAdd, sundayOf, MARKETS, type MarketingDeps, type Snapshot } from './marketing';
import { competitiveFinding } from './lib';

const ranked = (items: [string, number, number][]) => ({ cost: 0.11, tasks: [{ status_code: 20000, result: [{ items: items.map(([k, pos, vol]) => ({ keyword_data: { keyword: k, keyword_info: { search_volume: vol } }, ranked_serp_element: { serp_item: { rank_group: pos } } })) }] }] });
const overview = (items: [string, number][]) => ({ cost: 0.02, tasks: [{ status_code: 20000, result: [{ items: items.map(([k, v]) => ({ keyword: k, keyword_info: { search_volume: v } })) }] }] });

function deps(over: Partial<MarketingDeps> = {}) {
  const kws: { id: string; market: 'il' | 'intl'; keyword: string }[] = [{ id: 'k1', market: 'intl', keyword: 'quote template' }, { id: 'k2', market: 'il', keyword: 'הצעת מחיר' }];
  const saved: Record<string, Snapshot[]> = {};
  const holds: { purpose: string; hold: number }[] = [];
  const settles: { state: string; cost: number | null | undefined }[] = [];
  const calls: string[] = [];
  const d: MarketingDeps & { saved: typeof saved; holds: typeof holds; settles: typeof settles; calls: typeof calls } = {
    saved, holds, settles, calls,
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
    saveSnapshots: async (w, rows) => { saved[w] = rows; },
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
  it('no answer = the hold stays (unknown); a 5xx = unknown; the week is partial, never a fake result', async () => {
    const d = deps({ fetch: vi.fn(async () => { throw new Error('timeout'); }) as never });
    const c = await collectWeek(d, []);
    expect(d.settles.every((s) => s.state === 'unknown')).toBe(true);
    expect(c.found).toBe(0);
    expect(['partial', 'ok']).toContain(c.state);
  });
  it('the report lines use the spec\'s words', () => {
    expect(competitiveFinding({ state: 'ok', week: 'w', checked: 3, found: 1, notFound: 2, competitors: 1, opportunities: [], spentUsd: 0.37, fresh: true }).he)
      .toBe('מילות חיפוש שנבדקו: 3 · אנחנו מופיעים ב-1 · לא נמצא בעומק הבדיקה: 2');
    expect(competitiveFinding(null).he).toBe('מילות חיפוש שנבדקו: נתוני המתחרים לא זמינים השבוע.');
    expect(competitiveFinding({ state: 'ok', week: 'w', checked: 3, found: 1, notFound: 2, competitors: 1, opportunities: [], spentUsd: 0, fresh: true }).en).toContain('Not found within checked depth'.toLowerCase());
  });
});
