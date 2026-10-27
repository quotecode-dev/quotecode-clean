// The social media agent, stage 1 (Owner console 2026-10-27: "מאשר את שלב 1 של סוכנת הרשתות"; the market rule "בארץ בעברית ובחו"ל רק
// באנגלית"; the supervisor permissions, L-22: "מאשר את שניהם"). Nothing is ever posted: posts wait for the Owner; approve = ready, the Owner
// posts and marks published. Every post is checked for its account's language and market before it is stored.
import { describe, it, expect, vi } from 'vitest';
import { handle, type StageDeps, type Action } from './manager.ts';
import { CHANNELS, POSTS_PER_WEEK, ART_KEYS, postErrors, type Post } from './social.ts';
import { ART_KEYS as SITE_ART_KEYS } from '../../../src/shared/articleArt.js';

const NOW = new Date('2026-11-01T05:30:00Z'); // Sunday 07:30 Israel
const PATHS = ['/he', '/en', '/he/tools/currency', '/en/tools/units', '/he/articles/quote-by-measurements', '/en/articles/how-to-write-a-quote-clients-approve'];
const paths = async () => PATHS;

const HE = 'כמה זמן לוקח לכם לכתוב הצעת מחיר מסודרת ללקוח? עם תבניות, קטלוג פריטים ותמחור לפי מטר רבוע, הצעה ברורה יוצאת בכמה דקות, והלקוח מאשר וחותם מהטלפון.';
const EN = 'How long does it take you to write a clear quote for a client? With templates, a saved item catalog and pricing per square meter, a clear quote goes out in minutes, and the client approves and signs it from a phone.';
const post = (channel: string, over: Partial<Post> = {}): Post => {
  const c = CHANNELS.find((x) => x.id === channel)!;
  const il = c.market === 'il';
  const tiktok = c.network === 'tiktok';
  return {
    channel, text: tiktok ? (il ? 'הצעת מחיר ברורה בכמה דקות, והלקוח חותם מהטלפון.' : 'A clear quote in minutes, signed by the client on a phone.') : (il ? HE : EN),
    hashtags: il ? ['#הצעת_מחיר', '#עסק_קטן', '#TEKANGO'] : ['#smallbusiness', '#quotes', '#TEKANGO'],
    link_path: il ? '/he/tools/currency' : '/en/tools/units', art: 'quote',
    video_script: tiktok ? (il ? 'בעלת עסק פותחת את הטלפון, בוחרת תבנית ומוסיפה פריטים מהקטלוג. ההצעה נשלחת בוואטסאפ, והלקוח מאשר וחותם עוד באותו יום.' : 'A business owner opens a phone, picks a template and adds items from the catalog. The quote goes out on WhatsApp and the client signs it the same day.') : '',
    video_scenes: tiktok ? ['A tradesperson at a kitchen table opens a phone app', 'Close-up: items added to a quote from a catalog', 'The client smiles and signs on a phone screen'] : [],
    ...over,
  };
};
const week = (n = 1) => CHANNELS.flatMap((c) => Array.from({ length: c.perWeek * n }, () => post(c.id)));

function deps(over: Partial<StageDeps> = {}, aiPosts: Post[] | null = week()) {
  const runs = new Map<string, Record<string, unknown>>();
  const actions = new Map<string, Action & { dedupe_key?: string }>();
  const mails: string[] = [];
  let seq = 0; let cost = 0;
  const d: StageDeps & { runs: typeof runs; actions: typeof actions; mails: typeof mails } = {
    runs, actions, mails,
    caller: vi.fn(async () => 'admin' as const),
    can: vi.fn(async () => false),
    connectedChannels: () => [], // stage 2: no Meta account connected unless a test says so
    publishSocial: vi.fn(async () => { throw new Error('not_connected'); }),
    now: () => NOW,
    claim: vi.fn(async (agent, key, trigger) => { const id = `${agent}|${key}`; if (runs.has(id)) return null; runs.set(id, { id, agent, run_key: key, trigger, status: 'running' }); return id; }),
    finish: vi.fn(async (id: string, patch: Record<string, unknown>) => { Object.assign(runs.get(id)!, patch); cost += Number(patch.ai_cost_usd ?? 0); }),
    monthCostUsd: vi.fn(async () => cost),
    recentRuns: vi.fn(async () => [] as never),
    gsc: null,
    serviceStats: vi.fn(async () => ({ inquiries: {}, openItems: 0, topItems: [], chatQuestions: 0 })),
    fetchHead: vi.fn(async () => ({ status: 200, headers: {} })),
    versionJson: vi.fn(async () => null),
    complete: vi.fn(async () => ({ content: JSON.stringify(aiPosts === null ? { nope: 1 } : { posts: aiPosts }), promptTokens: 4000, completionTokens: 3000 })) as never,
    mailOwner: vi.fn(async (_s: string, text: string) => { mails.push(text); return true; }),
    profiles: vi.fn(async () => [{ agent: 'social', name_he: 'שירה', name_en: 'Shira' }] as never),
    setProfile: vi.fn(async () => undefined),
    recentActions: vi.fn(async () => [...actions.values()].reverse()),
    insertAction: vi.fn(async (a) => {
      if (a.dedupe_key && [...actions.values()].some((x) => x.dedupe_key === a.dedupe_key)) return null;
      const id = `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
      actions.set(id, { id, created_at: NOW.toISOString(), detail_he: null, detail_en: null, payload: {}, status: 'proposed', decided_at: null, done_at: null, result: {}, error: null, ...a } as never);
      return id;
    }),
    // honours whenStatus like the real one (a decision taken meanwhile wins)
    updateAction: vi.fn(async (id: string, patch: Record<string, unknown>, whenStatus?: string) => { const a = actions.get(id)!; if (whenStatus && a.status !== whenStatus) return; Object.assign(a, patch); }),
    getAction: vi.fn(async (id: string) => actions.get(id) ?? null),
    insertArticle: vi.fn(async () => 'x'), updateArticle: vi.fn(async () => undefined), getArticle: vi.fn(async () => null),
    articleSlugs: vi.fn(async () => []), lastPublishedAt: vi.fn(async () => null), deployHook: vi.fn(async () => 'not_configured' as const),
    ...over,
  };
  return d;
}
const posts = (d: ReturnType<typeof deps>) => [...d.actions.values()].filter((a) => a.action_type === 'social_post');

describe('the accounts and the week (the Owner: "מה שאתה ממליץ")', () => {
  it('six accounts, each ONE market; 10 posts a week - 6 international, 4 Israel; the international accounts are not open yet', () => {
    expect(CHANNELS.map((c) => `${c.id}:${c.perWeek}`)).toEqual(['fb_intl:3', 'fb_il:2', 'ig_intl:2', 'ig_il:1', 'tt_intl:1', 'tt_il:1']);
    expect(POSTS_PER_WEEK).toBe(10);
    expect(CHANNELS.filter((c) => c.market === 'intl').reduce((a, c) => a + c.perWeek, 0)).toBe(6);
    // the international Facebook page opened 2026-10-27 (stage 2); the international Instagram / TikTok not yet
    expect(CHANNELS.filter((c) => !c.accountOpen).map((c) => c.id)).toEqual(['ig_intl', 'tt_intl']);
  });
  it('the images are the eight guide illustrations of the site', () => {
    expect([...ART_KEYS]).toEqual([...SITE_ART_KEYS]);
  });
});

describe('a post is checked for its account before it is stored', () => {
  const c = (id: string) => CHANNELS.find((x) => x.id === id)!;
  it('valid posts pass for every account', () => {
    for (const ch of CHANNELS) expect(postErrors(post(ch.id), ch, PATHS)).toEqual([]);
  });
  it('Israel: Hebrew only - no English words (but the brand), no dollars; the link is a Hebrew page', () => {
    expect(postErrors(post('fb_il', { text: `${HE} Try it now` }), c('fb_il'), PATHS)).toContain('english_in_hebrew');
    expect(postErrors(post('fb_il', { text: `${HE} בעלות של $20` }), c('fb_il'), PATHS)).toEqual(expect.arrayContaining(['foreign_money']));
    expect(postErrors(post('fb_il', { link_path: '/en/tools/units' }), c('fb_il'), PATHS)).toContain('link');
    expect(postErrors(post('fb_il', { hashtags: ['#quotes', '#TEKANGO'] }), c('fb_il'), PATHS)).toContain('english_in_hebrew');
  });
  it('international: English only - no Hebrew, no shekels / Israel / VAT; the link is an English page', () => {
    expect(postErrors(post('fb_intl', { text: `${EN} שלום` }), c('fb_intl'), PATHS)).toContain('hebrew_in_english');
    expect(postErrors(post('fb_intl', { text: `${EN} Prices include VAT.` }), c('fb_intl'), PATHS)).toContain('israel_abroad');
    expect(postErrors(post('ig_intl', { link_path: '/he' }), c('ig_intl'), PATHS)).toContain('link');
  });
  it('never a price, a plan, a discount or a trial; the link must be a real public page; the image one of the eight', () => {
    expect(postErrors(post('fb_intl', { text: `${EN} Start a free trial today.` }), c('fb_intl'), PATHS)).toContain('commercial_claim');
    expect(postErrors(post('fb_il', { text: `${HE} מבצע לחודש הקרוב.` }), c('fb_il'), PATHS)).toContain('commercial_claim');
    expect(postErrors(post('fb_intl', { link_path: '/en/pricing' }), c('fb_intl'), PATHS)).toContain('link');
    expect(postErrors(post('fb_intl', { art: 'logo' }), c('fb_intl'), PATHS)).toContain('art');
  });
  it('TikTok needs a script in the account\'s language and 3-8 scene prompts; lengths fit each network', () => {
    expect(postErrors(post('tt_il', { video_script: 'קצר' }), c('tt_il'), PATHS)).toContain('video_script');
    expect(postErrors(post('tt_intl', { video_scenes: ['one scene only, nothing else'] }), c('tt_intl'), PATHS)).toContain('video_scenes');
    expect(postErrors(post('tt_il', { video_script: 'A business owner opens a phone, picks a template and adds items. The quote goes out and the client signs it.' }), c('tt_il'), PATHS)).toContain('english_in_hebrew');
    expect(postErrors(post('ig_intl', { text: 'Too short.' }), c('ig_intl'), PATHS)).toContain('length');
  });
});

describe('the weekly run', () => {
  it('"run now" (Owner): the week\'s 10 posts wait for approval at the manager - nothing is posted; each carries its account, market, text, image and link', async () => {
    const d = deps();
    const r = await handle({ action: 'run', agent: 'social' }, d, paths);
    expect(r.body).toMatchObject({ ok: true, results: [{ agent: 'social', status: 'done' }] });
    const p = posts(d);
    expect(p).toHaveLength(10);
    expect(p.every((a) => a.kind === 'system' && a.status === 'proposed' && a.source === 'social')).toBe(true);
    const fb = p.find((a) => a.payload.channel === 'fb_il')!;
    expect(fb.payload).toMatchObject({ network: 'facebook', market: 'il', accountOpen: true, link: 'https://www.tekango.com/he/tools/currency', art: 'quote' });
    expect(fb.title_he).toMatch(/^פוסט לפייסבוק ישראל: כמה זמן לוקח/);
    const tt = p.find((a) => a.payload.channel === 'tt_intl')!;
    expect(tt.payload.video_scenes).toHaveLength(3);
    expect(tt.title_he).toMatch(/^פוסט לטיקטוק חו״ל: /);
    expect(d.runs.get('social|admin:2026-11-01T07')).toMatchObject({ status: 'done', summary: 'הוכנו 10 פוסטים לשבוע הזה, והם מחכים לאישורכם אצל מנהלת הסוכנים.' });
    expect(d.mails).toHaveLength(0); // "run now" never emails
  });

  it('once per week per account: a second run in the same week adds nothing; a run in the next hour neither', async () => {
    const d = deps({}, week(2));
    await handle({ action: 'run', agent: 'social' }, d, paths);
    expect(posts(d)).toHaveLength(10);
    const later = { ...d, now: () => new Date(NOW.getTime() + 3 * 3_600_000) };
    await handle({ action: 'run', agent: 'social' }, later, paths);
    expect(posts(d)).toHaveLength(10);
    expect([...d.runs.values()].at(-1)).toMatchObject({ summary: 'הפוסטים של השבוע כבר הוכנו. ההכנה הבאה ביום ראשון.' });
  });

  it('a post that fails the checks is dropped and counted, never stored', async () => {
    const bad = week().map((p) => (p.channel === 'fb_il' ? { ...p, text: `${HE} Sign up now` } : p));
    const d = deps({}, bad);
    await handle({ action: 'run', agent: 'social' }, d, paths);
    expect(posts(d)).toHaveLength(8);
    expect((d.runs.get('social|admin:2026-11-01T07')!.findings as { he: string }[]).some((f) => f.he === '2 פוסטים לא עברו את בדיקות השפה והשוק ולא נשמרו')).toBe(true);
  });

  it('no AI answer = the run fails honestly; the monthly cap skips it', async () => {
    const d = deps({}, null);
    await handle({ action: 'run', agent: 'social' }, d, paths);
    expect(d.runs.get('social|admin:2026-11-01T07')).toMatchObject({ status: 'failed', error: 'ai_unavailable' });
    const capped = deps({ monthCostUsd: vi.fn(async () => 20) });
    await handle({ action: 'run', agent: 'social' }, capped, paths);
    expect(capped.complete).not.toHaveBeenCalled();
    expect(capped.runs.get('social|admin:2026-11-01T07')).toMatchObject({ status: 'skipped_cap' });
  });
});

describe('the Owner\'s decisions on a post', () => {
  it('approve = ready (nothing is posted); "published" closes it; not now removes it', async () => {
    const d = deps();
    await handle({ action: 'run', agent: 'social' }, d, paths);
    const [a, b] = posts(d);
    expect((await handle({ action: 'decide', id: a.id, decision: 'approve' }, d, paths)).body).toMatchObject({ ok: true, status: 'ready' });
    expect(d.actions.get(a.id)).toMatchObject({ status: 'approved' });
    expect(d.mailOwner).not.toHaveBeenCalled();
    expect((await handle({ action: 'mark_done', id: a.id }, d, paths)).body).toMatchObject({ ok: true, status: 'done' });
    expect(d.actions.get(a.id)).toMatchObject({ status: 'done', result: { published: true } });
    expect((await handle({ action: 'mark_done', id: b.id }, d, paths)).status).toBe(409); // not approved yet
    expect((await handle({ action: 'decide', id: b.id, decision: 'reject' }, d, paths)).body).toMatchObject({ status: 'rejected' });
  });

  it('ask for a change: the same account, rewritten, still waiting; a rewrite that fails the checks changes nothing', async () => {
    const d = deps();
    await handle({ action: 'run', agent: 'social' }, d, paths);
    const a = posts(d).find((x) => x.payload.channel === 'ig_il')!;
    const rewritten = post('ig_il', { text: `${HE} עכשיו גם עם מעקב צפייה.` });
    (d.complete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ content: JSON.stringify({ posts: [rewritten] }), promptTokens: 1000, completionTokens: 500 });
    const r = await handle({ action: 'revise', id: a.id, note: 'להזכיר את מעקב הצפייה' }, d, paths);
    expect(r.body).toMatchObject({ ok: true, status: 'revised' });
    expect(d.actions.get(a.id)).toMatchObject({ status: 'proposed' });
    expect(String(d.actions.get(a.id)!.payload.text)).toMatch(/מעקב צפייה/);
    (d.complete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ content: JSON.stringify({ posts: [post('ig_il', { text: 'English text only, which is wrong here for sure.' })] }), promptTokens: 1, completionTokens: 1 });
    expect((await handle({ action: 'revise', id: a.id, note: 'עוד שינוי' }, d, paths)).status).toBe(502);
    expect(String(d.actions.get(a.id)!.payload.text)).toMatch(/מעקב צפייה/);
  });
});

describe('the security review of 2026-10-27', () => {
  it('a rewrite that finishes after the post was approved meanwhile is dropped - the approved text stays', async () => {
    const d = deps();
    await handle({ action: 'run', agent: 'social' }, d, paths);
    const a = posts(d).find((x) => x.payload.channel === 'fb_il')!;
    const approvedText = a.payload.text;
    (d.complete as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => {
      d.actions.get(a.id)!.status = 'approved'; // the Owner approves while the AI writes
      return { content: JSON.stringify({ posts: [post('fb_il', { text: `${HE} גרסה אחרת לגמרי.` })] }), promptTokens: 1, completionTokens: 1 };
    });
    const r = await handle({ action: 'revise', id: a.id, note: 'לשנות' }, d, paths);
    expect(r).toMatchObject({ status: 409, body: { code: 'not_pending' } });
    expect(d.actions.get(a.id)!.payload.text).toBe(approvedText);
  });
  it('at most 3 rewrites per post', async () => {
    const d = deps();
    await handle({ action: 'run', agent: 'social' }, d, paths);
    const a = posts(d).find((x) => x.payload.channel === 'fb_il')!;
    (d.complete as ReturnType<typeof vi.fn>).mockImplementation(async () => ({ content: JSON.stringify({ posts: [post('fb_il')] }), promptTokens: 1, completionTokens: 1 }));
    for (let i = 0; i < 3; i += 1) expect((await handle({ action: 'revise', id: a.id, note: `שינוי ${i}` }, d, paths)).body).toMatchObject({ ok: true });
    expect(await handle({ action: 'revise', id: a.id, note: 'רביעי' }, d, paths)).toMatchObject({ status: 409, body: { code: 'revise_limit' } });
  });
  it('a supervisor needs both permissions to act, and nothing is read before the check', async () => {
    const owner = deps();
    await handle({ action: 'run', agent: 'social' }, owner, paths);
    const [a] = posts(owner);
    const getAction = vi.fn(owner.getAction);
    const onlyPublish = deps({ caller: vi.fn(async () => null), can: vi.fn(async (p: string) => p === 'social.publish'), getAction });
    expect((await handle({ action: 'decide', id: a.id, decision: 'approve' }, onlyPublish, paths)).status).toBe(403);
    expect(getAction).not.toHaveBeenCalled();
  });
});

describe('the supervisor (L-22, Owner 2026-10-27 "מאשר את שניהם")', () => {
  const sup = (perms: string[], over: Partial<StageDeps> = {}) => deps({ caller: vi.fn(async () => null), can: vi.fn(async (p: string) => perms.includes(p)), ...over });
  it('social.view reads the posts only; without it, nothing', async () => {
    const owner = deps();
    await handle({ action: 'run', agent: 'social' }, owner, paths);
    const d = sup(['social.view'], { recentActions: owner.recentActions, getAction: owner.getAction });
    const r = await handle({ action: 'social_state' }, d, paths);
    expect(r.status).toBe(200);
    expect((r.body.posts as Action[]).every((a) => a.action_type === 'social_post')).toBe(true);
    expect(r.body).toMatchObject({ canPublish: false, profile: { agent: 'social' } });
    expect((await handle({ action: 'state' }, d, paths)).status).toBe(403); // never the agents room itself
    expect((await handle({ action: 'social_state' }, sup([]), paths)).status).toBe(403);
  });
  it('social.publish acts on social posts only - never on an article, a code task or a run', async () => {
    const owner = deps();
    await handle({ action: 'run', agent: 'social' }, owner, paths);
    const [a] = posts(owner);
    const d = sup(['social.view', 'social.publish'], { recentActions: owner.recentActions, getAction: owner.getAction, updateAction: owner.updateAction });
    expect((await handle({ action: 'decide', id: a.id, decision: 'approve' }, d, paths)).body).toMatchObject({ ok: true, status: 'ready' });
    expect((await handle({ action: 'mark_done', id: a.id }, d, paths)).body).toMatchObject({ ok: true });
    const task = await owner.insertAction({ run_key: 'k', source: 'manager', kind: 'claude', action_type: 'claude_task', title_he: 'x', title_en: 'x', payload: { prompt_he: 'x'.repeat(50) } });
    expect((await handle({ action: 'decide', id: task!, decision: 'approve' }, d, paths)).status).toBe(403);
    expect((await handle({ action: 'run', agent: 'social' }, d, paths)).status).toBe(403);
    expect((await handle({ action: 'rename', agent: 'social', name_he: 'x', name_en: 'x' }, d, paths)).status).toBe(403);
    const viewer = sup(['social.view'], { getAction: owner.getAction });
    expect((await handle({ action: 'decide', id: a.id, decision: 'reject' }, viewer, paths)).status).toBe(403);
  });
});
