// Owner console 2026-11-02 (the plan for Shira): the results of every post, unknown is never 0, the stills wait for the Owner, the daily line.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { collectContent, commentablePosts, contentSummary, careLine, stillActions, networkUrl } from './socialStats.ts';
import { publishToMeta } from './social.ts';

const ok = (json: unknown) => ({ ok: true, status: 200, json });
const refused = { ok: false, status: 403, json: null };

// Owner 2026-11-02 (typed: "מאשר תיקון שירה, מע"מ של עוסק פטור כולל שינוי ב-L-22, רענון אוטומטי פעם אחת במסך הטעינה כולל שינוי ב-L-02 ו-L-15, ותיקון 30527 בפיי פלוס, שחרור עד הלייב"): this test runner hides a crash at load (a real boot in Deno found it), so the cycle itself is guarded.
describe('the file of the results does not read the social file while it loads', () => {
  it('ORIGIN comes from outside the social.ts <-> socialStats.ts cycle', () => {
    const src = readFileSync('supabase/functions/agents-room/socialStats.ts', 'utf8');
    const fromSocial = src.split(/\r?\n/).filter((l) => /^import /.test(l) && /from '\.\/social\.ts'/.test(l)).join(' ');
    expect(fromSocial).toContain('TARGETS');
    expect(fromSocial).not.toContain('ORIGIN');
    expect(src).toMatch(/import \{ ORIGIN \} from '\.\.\/search-console\/lib\.ts'/);
  });
});

function graph(routes: Record<string, unknown>) {
  return vi.fn(async (_channel: string, _method: 'GET' | 'POST', path: string) => (path in routes ? ok(routes[path]) : refused));
}

describe('every post of the accounts', () => {
  it('Instagram: a video uploaded by hand is measured with its views', async () => {
    const g = graph({
      '17841431179031610/media': { data: [{ id: 'm1', caption: 'עוד ערב\nשורה שנייה', media_type: 'VIDEO', media_product_type: 'REELS', permalink: 'https://www.instagram.com/tekangoisrael/reel/x/', timestamp: '2026-11-01T21:23:00+0000', like_count: 4, comments_count: 1 }] },
      'm1/insights': { data: [{ name: 'views', values: [{ value: 120 }] }, { name: 'reach', total_value: { value: 80 } }, { name: 'shares', values: [{ value: 2 }] }] },
      '17841431179031610': { followers_count: 7 },
    });
    const r = await collectContent(g, ['ig_il'], undefined);
    expect(r.rows[0]).toMatchObject({ network: 'instagram', market: 'il', kind: 'video', title: 'עוד ערב', views: 120, likes: 4, comments: 1, shares: 2, reach: 80 });
    expect(r.followers).toEqual([{ channel: 'ig_il', followers: 7 }]);
  });
  it('a number the network did not return is unknown, never 0', async () => {
    const g = graph({ '17841431179031610/media': { data: [{ id: 'm1', caption: 'x', media_type: 'IMAGE', timestamp: '2026-11-01T00:00:00Z' }] } });
    const { rows } = await collectContent(g, ['ig_il'], undefined);
    expect(rows[0]).toMatchObject({ views: null, likes: null, comments: null, shares: null, reach: null });
  });
  it('Facebook: a post and a reel that is not in the feed, without counting one video twice', async () => {
    const g = graph({
      '1381375051729705/posts': { data: [{ id: '1381375051729705_55', message: 'סרטון', created_time: '2026-11-01T00:00:00Z', permalink_url: 'https://www.facebook.com/reel/55/', attachments: { data: [{ media_type: 'video', target: { id: '55' } }] }, reactions: { summary: { total_count: 3 } }, comments: { summary: { total_count: 0 } } }] },
      '55/video_insights': { data: [{ name: 'blue_reels_play_count', values: [{ value: 40 }] }] },
      '1381375051729705/video_reels': { data: [{ id: '55', description: 'סרטון' }, { id: '66', description: 'רק ברילס', created_time: '2026-11-01T00:00:00Z', permalink_url: '/reel/66/', likes: { summary: { total_count: 1 } } }] },
      '66/video_insights': { data: [{ name: 'fb_reels_total_plays', values: [{ value: 9 }] }] },
    });
    const { rows } = await collectContent(g, ['fb_il'], undefined);
    expect(rows.map((r) => [r.postId, r.kind, r.views, r.likes])).toEqual([['1381375051729705_55', 'video', 40, 3], ['66', 'video', 9, 1]]);
    expect(rows[1].url).toBe('https://www.facebook.com/reel/66/');
  });
  it('one account failing does not stop the others', async () => {
    const g = vi.fn(async (channel: string, _m: 'GET' | 'POST', path: string) => {
      if (channel === 'fb_il') throw new Error('down');
      return path === '17841431179031610/media' ? ok({ data: [{ id: 'm1', media_type: 'IMAGE' }] }) : refused;
    });
    expect((await collectContent(g, ['fb_il', 'ig_il'], undefined)).rows).toHaveLength(1);
  });
  it('YouTube: public numbers; without the key nothing is asked', async () => {
    const yt = vi.fn(async (path: string) => (path === 'channels' ? { items: [{ statistics: { subscriberCount: '3' }, contentDetails: { relatedPlaylists: { uploads: 'UU1' } } }] }
      : path === 'playlistItems' ? { items: [{ contentDetails: { videoId: 'abc' } }] } : { items: [{ id: 'abc', snippet: { title: 'סרטון', publishedAt: '2026-11-01T00:00:00Z' }, statistics: { viewCount: '100', likeCount: '5' } }] }));
    const { rows, followers } = await collectContent(undefined, [], yt);
    expect(rows[0]).toMatchObject({ network: 'youtube', views: 100, likes: 5, comments: null, shares: null, url: 'https://www.youtube.com/watch?v=abc' });
    expect(followers).toContainEqual({ channel: 'yt_il', followers: 3 });
    expect((await collectContent(undefined, [], undefined)).rows).toEqual([]);
  });
  it('only an address of the network is kept as a link', () => {
    expect(networkUrl('https://evil.example/x', 'facebook.com')).toBeNull();
    expect(networkUrl('https://www.facebook.com.evil.example/x', 'facebook.com')).toBeNull();
    expect(networkUrl('/reel/1', 'facebook.com')).toBe('https://www.facebook.com/reel/1');
  });
});

const row = (o: Record<string, unknown>) => ({ network: 'facebook', channel: 'fb_il', market: 'il', postId: 'p', kind: 'video', title: 't', url: null, postedAt: '2026-11-01T00:00:00Z', views: null, likes: null, comments: null, shares: null, reach: null, ...o }) as never;

describe('comments and what catches on', () => {
  const now = new Date('2026-11-02T00:00:00Z');
  it('the comments of the last 14 days, also of a post uploaded by hand; YouTube and an old or known post are not read', () => {
    const r = commentablePosts([row({ postId: 'new' }), row({ postId: 'known' }), row({ postId: 'old', postedAt: '2026-10-01T00:00:00Z' }), row({ postId: 'yt', network: 'youtube' })], now, new Set(['known']));
    expect(r.map((p) => p.postId)).toEqual(['new']);
    expect(r[0]).toMatchObject({ actionId: '', channel: 'fb_il', network: 'facebook', market: 'il' });
  });
  it('the averages count measured values only', () => {
    const s = contentSummary([row({ postId: 'a', views: 100, likes: 2 }), row({ postId: 'b', views: null, likes: 4 }), row({ postId: 'c', kind: 'image', likes: 1 })]);
    expect(s[0]).toMatchObject({ kind: 'video', posts: 2, avgViews: 100, avgEngagement: 3 });
    expect(s[1]).toMatchObject({ kind: 'image', posts: 1, avgViews: null });
  });
  it('the daily line, in both languages; no figure from yesterday is said as such', () => {
    const a = careLine('k', '2026-11-02', { rows: [row({ title: 'הבולט', likes: 9 })], followers: [{ channel: 'fb_il', followers: 12 }], yesterday: [{ channel: 'fb_il', followers: 10 }], waiting: 2, newComments: 1, stillsQueued: 2 });
    expect(a.detail_he).toContain('עוקבים: +2');
    expect(a.detail_he).toContain('בלט: הבולט');
    expect(a.detail_en).toContain('Followers: +2');
    expect(a).toMatchObject({ kind: 'info', action_type: 'none', dedupe_key: 'social-care:2026-11-02' });
    expect(careLine('k', 'd', { rows: [], followers: [{ channel: 'fb_il', followers: 1 }], yesterday: [], waiting: 0, newComments: 0, stillsQueued: 0 }).detail_he).toContain('אין עדיין נתון של אתמול');
  });
});

describe('the stills folder', () => {
  const url = 'https://ixabnzhjeqevtbhdfswv.supabase.co/storage/v1/object/public/social-stills/il/5e6f0c2a-1b7d-4c8e-9f10-2a3b4c5d6e7f.jpg';
  it('one still becomes a post per account of its market, waiting for approval, in its own language', () => {
    const a = stillActions('k', { id: 's1', market: 'il', path: 'x', url });
    expect(a.map((x) => x.payload.channel)).toEqual(['fb_il', 'ig_il']);
    expect(a[0]).toMatchObject({ kind: 'system', action_type: 'social_post', dedupe_key: 'still:s1:fb_il' });
    expect(a[0].payload.still_url).toBe(url);
    expect(a[0].payload.text).toContain('10 הצעות או 7 ימים');
    expect(stillActions('k', { id: 's2', market: 'intl', path: 'x', url })[1].payload.text).toContain('whichever comes first');
  });
  it('publishing uses the still from our own folder; any other address falls back to the illustration', async () => {
    const seen: string[] = [];
    const f = vi.fn(async (_u: string, init?: RequestInit) => { seen.push(String(new URLSearchParams(String(init?.body)).get('url'))); return new Response(JSON.stringify({ post_id: '1_2' }), { status: 200 }); });
    await publishToMeta(f as never, () => 'token', 'fb_il', { text: 'x', art: 'quote', still_url: url });
    await publishToMeta(f as never, () => 'token', 'fb_il', { text: 'x', art: 'quote', still_url: 'https://evil.example/a.jpg' });
    expect(seen[0]).toBe(url);
    expect(seen[1]).toBe('https://www.tekango.com/social/art/quote.jpg');
  });
});
