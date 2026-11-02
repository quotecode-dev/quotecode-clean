// agents-room - Shira's daily care of the accounts (Owner console 2026-11-02, typed: "מאשר את התוכנית לשירה: מדידה יומית של כל פרסום, מסך מה תופס, טיוטות תשובה לכל
// התגובות באישור שלי, ושורת תחזוקה יומית, שחרור עד הלייב - שהיא תוכל לפרסם חוץ מהמאמרים שלה גם את הפרסומים שאתה עשית הסטילס, נשים לה בתיקיה, והיא תאסוף משם ותתן לי לאשר").
// Runtime-independent (Graph and YouTube calls injected).
//  - Every post and video of the accounts, also those uploaded by hand: views, likes, comments, shares. A value the network did not return is unknown, never 0.
//  - YouTube's public numbers with an API key. TikTok has no measurement: it needs an approved app.
//  - The stills folder: one still per market at a time becomes a post for its Facebook and Instagram, waiting for the Owner. Nothing is published here.
// Owner 2026-11-02 (typed: "מאשר תיקון שירה, מע"מ של עוסק פטור כולל שינוי ב-L-22, רענון אוטומטי פעם אחת במסך הטעינה כולל שינוי ב-L-02 ו-L-15, ותיקון 30527 בפיי פלוס, שחרור עד הלייב"): ORIGIN is read while this file loads, so it comes from a file outside the social.ts <-> socialStats.ts cycle
import { ORIGIN } from '../search-console/lib.ts';
import { TARGETS, type Market } from './social.ts';
import type { Graph, PublishedPost } from './socialReplies.ts';

export type ContentKind = 'video' | 'image' | 'text';
export type ContentNetwork = 'facebook' | 'instagram' | 'youtube';
export type ContentRow = { network: ContentNetwork; channel: string; market: Market; postId: string; kind: ContentKind; title: string; url: string | null; postedAt: string | null;
  views: number | null; likes: number | null; comments: number | null; shares: number | null; reach: number | null };
export type Follower = { channel: string; followers: number };
export type YouTube = (path: string, params: Record<string, string>) => Promise<unknown | null>;
export type Still = { id: string; market: Market; path: string; url: string };

export const POSTS_PER_CHANNEL = 15;
export const COMMENTS_WINDOW_DAYS = 14;
export const YOUTUBE_CHANNELS: readonly { id: string; channel: string; market: Market }[] = Object.freeze([
  { id: 'UCDeLx0KL38kdqYJJcDq_gwg', channel: 'yt_il', market: 'il' },
  { id: 'UCl2-gCqy1Tl03Z5H39AH2eQ', channel: 'yt_intl', market: 'intl' },
]);

const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
};
const titleOf = (v: unknown) => String(v ?? '').split('\n').map((l) => l.trim()).find(Boolean)?.slice(0, 120) ?? '';
const when = (v: unknown) => { const t = Date.parse(String(v ?? '')); return Number.isFinite(t) ? new Date(t).toISOString() : null; };
/** only an address of the network itself is ever kept as a link */
export function networkUrl(v: unknown, host: string): string | null {
  const s = String(v ?? '');
  const full = s.startsWith('/') ? `https://www.${host}${s}` : s;
  return new RegExp(`^https://([a-z]+\\.)?${host.replace('.', '\\.')}/`).test(full) ? full.slice(0, 300) : null;
}
// deno-lint-ignore no-explicit-any
const insight = (json: any, ...names: string[]): number | null => {
  // deno-lint-ignore no-explicit-any
  const list: any[] = Array.isArray(json?.data) ? json.data : [];
  for (const name of names) {
    const m = list.find((x) => x?.name === name);
    const v = num(m?.total_value?.value ?? m?.values?.[0]?.value);
    if (v !== null) return v;
  }
  return null;
};

async function facebookContent(graph: Graph, channel: string, pageId: string, market: Market): Promise<ContentRow[]> {
  const rows: ContentRow[] = [];
  const seenVideo = new Set<string>();
  const posts = await graph(channel, 'GET', `${pageId}/posts`, { fields: 'id,message,created_time,permalink_url,attachments{media_type,target{id}},reactions.summary(total_count),comments.summary(total_count),shares', limit: String(POSTS_PER_CHANNEL) });
  // deno-lint-ignore no-explicit-any
  for (const p of (posts.ok && Array.isArray((posts.json as any)?.data) ? (posts.json as any).data : []) as any[]) {
    if (!p?.id) continue;
    const media = String(p?.attachments?.data?.[0]?.media_type ?? '').toLowerCase();
    const kind: ContentKind = /video|reel/.test(media) ? 'video' : /photo|album|image/.test(media) ? 'image' : 'text';
    const videoId = kind === 'video' ? String(p?.attachments?.data?.[0]?.target?.id ?? String(p.id).split('_')[1] ?? '') : '';
    if (videoId) seenVideo.add(videoId);
    const ins = await graph(channel, 'GET', `${p.id}/insights`, { metric: 'post_impressions_unique' });
    const vid = videoId ? await graph(channel, 'GET', `${videoId}/video_insights`, {}) : null;
    rows.push({ network: 'facebook', channel, market, postId: String(p.id).slice(0, 120), kind, title: titleOf(p.message), url: networkUrl(p.permalink_url, 'facebook.com'), postedAt: when(p.created_time),
      views: vid?.ok ? insight(vid.json, 'blue_reels_play_count', 'fb_reels_total_plays', 'total_video_views') : null,
      likes: num(p?.reactions?.summary?.total_count), comments: num(p?.comments?.summary?.total_count), shares: num(p?.shares?.count ?? 0), reach: ins.ok ? insight(ins.json, 'post_impressions_unique') : null });
  }
  const reels = await graph(channel, 'GET', `${pageId}/video_reels`, { fields: 'id,description,created_time,permalink_url,likes.summary(total_count),comments.summary(total_count)', limit: String(POSTS_PER_CHANNEL) });
  // deno-lint-ignore no-explicit-any
  for (const r of (reels.ok && Array.isArray((reels.json as any)?.data) ? (reels.json as any).data : []) as any[]) {
    if (!r?.id || seenVideo.has(String(r.id))) continue;
    const vid = await graph(channel, 'GET', `${r.id}/video_insights`, {});
    rows.push({ network: 'facebook', channel, market, postId: String(r.id).slice(0, 120), kind: 'video', title: titleOf(r.description), url: networkUrl(r.permalink_url, 'facebook.com'), postedAt: when(r.created_time),
      views: vid.ok ? insight(vid.json, 'blue_reels_play_count', 'fb_reels_total_plays', 'total_video_views') : null,
      likes: num(r?.likes?.summary?.total_count), comments: num(r?.comments?.summary?.total_count), shares: null, reach: vid.ok ? insight(vid.json, 'post_impressions_unique') : null });
  }
  return rows;
}

async function instagramContent(graph: Graph, channel: string, igUserId: string, market: Market): Promise<ContentRow[]> {
  const rows: ContentRow[] = [];
  const list = await graph(channel, 'GET', `${igUserId}/media`, { fields: 'id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count', limit: String(POSTS_PER_CHANNEL) });
  // deno-lint-ignore no-explicit-any
  for (const m of (list.ok && Array.isArray((list.json as any)?.data) ? (list.json as any).data : []) as any[]) {
    if (!m?.id) continue;
    const ins = await graph(channel, 'GET', `${m.id}/insights`, { metric: 'views,reach,shares' });
    rows.push({ network: 'instagram', channel, market, postId: String(m.id).slice(0, 120), kind: String(m.media_type) === 'VIDEO' || String(m.media_product_type) === 'REELS' ? 'video' : 'image',
      title: titleOf(m.caption), url: networkUrl(m.permalink, 'instagram.com'), postedAt: when(m.timestamp), views: ins.ok ? insight(ins.json, 'views') : null,
      likes: num(m.like_count), comments: num(m.comments_count), shares: ins.ok ? insight(ins.json, 'shares') : null, reach: ins.ok ? insight(ins.json, 'reach') : null });
  }
  return rows;
}

async function youtubeContent(yt: YouTube): Promise<{ rows: ContentRow[]; followers: Follower[] }> {
  const rows: ContentRow[] = [];
  const followers: Follower[] = [];
  for (const c of YOUTUBE_CHANNELS) {
    // deno-lint-ignore no-explicit-any
    const info: any = await yt('channels', { part: 'statistics,contentDetails', id: c.id });
    const followerCount = num(info?.items?.[0]?.statistics?.subscriberCount);
    if (followerCount !== null) followers.push({ channel: c.channel, followers: followerCount });
    const uploads = String(info?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? '');
    if (!uploads) continue;
    // deno-lint-ignore no-explicit-any
    const items: any = await yt('playlistItems', { part: 'contentDetails', playlistId: uploads, maxResults: String(POSTS_PER_CHANNEL) });
    // deno-lint-ignore no-explicit-any
    const ids = ((items?.items ?? []) as any[]).map((i) => String(i?.contentDetails?.videoId ?? '')).filter(Boolean);
    if (!ids.length) continue;
    // deno-lint-ignore no-explicit-any
    const vids: any = await yt('videos', { part: 'snippet,statistics', id: ids.join(',') });
    // deno-lint-ignore no-explicit-any
    for (const v of (vids?.items ?? []) as any[]) {
      if (!v?.id) continue;
      rows.push({ network: 'youtube', channel: c.channel, market: c.market, postId: String(v.id).slice(0, 120), kind: 'video', title: titleOf(v?.snippet?.title),
        url: networkUrl(`https://www.youtube.com/watch?v=${encodeURIComponent(String(v.id))}`, 'youtube.com'), postedAt: when(v?.snippet?.publishedAt), views: num(v?.statistics?.viewCount),
        likes: num(v?.statistics?.likeCount), comments: num(v?.statistics?.commentCount), shares: null, reach: null });
    }
  }
  return { rows, followers };
}

/** Every account that has a page token (and YouTube when the key exists): the content rows and the follower counts. One account failing does not stop the others. */
export async function collectContent(graph: Graph | undefined, connected: string[], yt: YouTube | undefined): Promise<{ rows: ContentRow[]; followers: Follower[] }> {
  const rows: ContentRow[] = [];
  const followers: Follower[] = [];
  if (graph) {
    for (const channel of connected) {
      const t = TARGETS[channel];
      if (!t) continue;
      const market: Market = channel.endsWith('_il') ? 'il' : 'intl';
      const id = t.kind === 'facebook' ? t.pageId : t.igUserId;
      try {
        rows.push(...(t.kind === 'facebook' ? await facebookContent(graph, channel, id, market) : await instagramContent(graph, channel, id, market)));
        const f = await graph(channel, 'GET', id, { fields: 'followers_count' });
        // deno-lint-ignore no-explicit-any
        const n = f.ok ? num((f.json as any)?.followers_count) : null;
        if (n !== null) followers.push({ channel, followers: n });
      } catch { /* the other accounts still run */ }
    }
  }
  if (yt) {
    try { const y = await youtubeContent(yt); rows.push(...y.rows); followers.push(...y.followers); } catch { /* the Meta rows are kept */ }
  }
  return { rows, followers };
}

/** The posts whose comments are read: Facebook and Instagram, the last 14 days, also those uploaded by hand. */
export function commentablePosts(rows: ContentRow[], now: Date, known: Set<string>): PublishedPost[] {
  return rows.filter((r) => (r.network === 'facebook' || r.network === 'instagram') && !known.has(r.postId) && r.postedAt
    && now.getTime() - Date.parse(r.postedAt) < COMMENTS_WINDOW_DAYS * 86_400_000).slice(0, 30)
    .map((r) => ({ actionId: '', channel: r.channel, network: r.network as 'facebook' | 'instagram', market: r.market, postId: r.postId }));
}

const engagement = (r: Pick<ContentRow, 'likes' | 'comments' | 'shares'>) => (r.likes ?? 0) + (r.comments ?? 0) + (r.shares ?? 0);
/** What catches on: per network, market and kind - averages over MEASURED values only (for Shira's weekly plan and the screen). */
export function contentSummary(rows: ContentRow[]): { network: string; market: string; kind: string; posts: number; avgViews: number | null; avgEngagement: number }[] {
  const groups = new Map<string, ContentRow[]>();
  for (const r of rows) { const k = `${r.network}|${r.market}|${r.kind}`; groups.set(k, [...(groups.get(k) ?? []), r]); }
  return [...groups.entries()].map(([k, list]) => {
    const [network, market, kind] = k.split('|');
    const viewed = list.filter((r) => r.views !== null);
    return { network, market, kind, posts: list.length, avgViews: viewed.length ? Math.round(viewed.reduce((a, r) => a + (r.views as number), 0) / viewed.length) : null,
      avgEngagement: Math.round((list.reduce((a, r) => a + engagement(r), 0) / list.length) * 10) / 10 };
  }).sort((a, b) => b.avgEngagement - a.avgEngagement);
}
export function topContent(rows: ContentRow[]): ContentRow | null {
  return [...rows].sort((a, b) => engagement(b) - engagement(a) || (b.views ?? 0) - (a.views ?? 0))[0] ?? null;
}

/** The daily line of the agents room: numbers only what was measured. */
export function careLine(key: string, day: string, d: { rows: ContentRow[]; followers: Follower[]; yesterday: Follower[]; waiting: number; newComments: number; stillsQueued: number }) {
  const before = new Map(d.yesterday.map((f) => [f.channel, f.followers]));
  const compared = d.followers.filter((f) => before.has(f.channel));
  const added = compared.reduce((a, f) => a + (f.followers - (before.get(f.channel) as number)), 0);
  const top = topContent(d.rows);
  const he = [compared.length ? `עוקבים: ${added >= 0 ? '+' : ''}${added}` : 'עוקבים: אין עדיין נתון של אתמול', `תגובות חדשות: ${d.newComments}`, `תגובות שמחכות לתשובה: ${d.waiting}`, `פרסומות שנוספו לאישור: ${d.stillsQueued}`,
    top ? `בלט: ${top.title || top.postId}` : 'בלט: אין עדיין נתונים'].join(' · ');
  const en = [compared.length ? `Followers: ${added >= 0 ? '+' : ''}${added}` : 'Followers: no figure from yesterday yet', `New comments: ${d.newComments}`, `Comments waiting: ${d.waiting}`, `Stills added for approval: ${d.stillsQueued}`,
    top ? `Stood out: ${top.title || top.postId}` : 'Stood out: no data yet'].join(' · ');
  return { run_key: key, source: 'social' as const, kind: 'info' as const, action_type: 'none' as const, title_he: `שירה - תחזוקה יומית ${day}`, title_en: `Shira - daily care ${day}`, detail_he: he, detail_en: en, dedupe_key: `social-care:${day}` };
}

// Owner console 2026-11-02 (typed: "מאשר את התוכנית לתיקוני המעבר הרביעי וטקסט שירה, כולל שינוי ב-L-02, L-06, L-11, L-14, L-16, L-17 ו-L-22, שחרור עד הלייב") and "למה זה בכל מופיע כברירת מחדל, להוריד לגמרי": the fixed text says what the product does, nothing about free quotes or days
const STILL_COPY: Record<Market, { text: string; hashtags: string[]; link: string }> = {
  il: { text: 'הצעות מחיר מקצועיות מהטלפון: בונים, שולחים בוואטסאפ או במייל, והלקוח חותם דיגיטלית.', hashtags: ['#הצעתמחיר', '#עסקיםקטנים', '#עצמאים'], link: `${ORIGIN}/he` },
  intl: { text: 'Professional quotes from your phone: build it, send it by WhatsApp or email, and your client signs digitally.', hashtags: ['#quotes', '#smallbusiness', '#contractors'], link: `${ORIGIN}/en` },
};
export const STILL_CHANNELS: Record<Market, { id: string; network: 'facebook' | 'instagram'; he: string; en: string }[]> = {
  il: [{ id: 'fb_il', network: 'facebook', he: 'פייסבוק ישראל', en: 'Facebook Israel' }, { id: 'ig_il', network: 'instagram', he: 'אינסטגרם ישראל', en: 'Instagram Israel' }],
  intl: [{ id: 'fb_intl', network: 'facebook', he: 'פייסבוק חו״ל', en: 'Facebook international' }, { id: 'ig_intl', network: 'instagram', he: 'אינסטגרם חו״ל', en: 'Instagram international' }],
};
/** One still of the folder as the posts of its market, each waiting for the Owner (never published here). */
// Owner 2026-11-02 (typed: "מאשר בדיקת מידות בתיקיית הפרסומות של שירה: תמונה שלא מתאימה לפוסט נדחית בהעלאה עם הסבר, כולל שינוי ב-L-22, שחרור עד הלייב"):
// the same image goes to a Facebook post and an Instagram post, so it must fit an Instagram post: 4:5 up to 1.91:1, at least 320 wide.
export function stillFitsPost(width: number, height: number): boolean {
  if (!(width >= 320) || !(height > 0)) return false;
  const ratio = width / height;
  return ratio >= 0.8 && ratio <= 1.91;
}

// the size written in a JPEG's own header; null when it cannot be read
export function jpegSize(base64: string): { width: number; height: number } | null {
  let b: Uint8Array;
  try { b = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)); } catch { return null; }
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 8 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xff) { i += 1; continue; }
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return { height: (b[i + 5] << 8) + b[i + 6], width: (b[i + 7] << 8) + b[i + 8] };
    i += 2 + (b[i + 2] << 8) + b[i + 3];
  }
  return null;
}

export function stillActions(key: string, s: Still) {
  const copy = STILL_COPY[s.market];
  return STILL_CHANNELS[s.market].map((c) => ({
    run_key: key, source: 'social' as const, kind: 'system' as const, action_type: 'social_post' as const, title_he: `פרסומת ל${c.he}`, title_en: `Still for ${c.en}`, detail_he: null, detail_en: null,
    payload: { channel: c.id, network: c.network, market: s.market, accountOpen: true, text: copy.text, hashtags: copy.hashtags, link: copy.link, art: 'quote', still_url: s.url, still_id: s.id },
    dedupe_key: `still:${s.id}:${c.id}`,
  }));
}
