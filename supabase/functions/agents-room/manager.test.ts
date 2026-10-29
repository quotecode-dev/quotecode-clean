// agents-room stage 2 (Owner console 2026-10-27: "מאשר את תוכנית שלב 2 עם מנהל הסוכנים" + the four decisions): the manager is the only
// agent that acts; automatic = sitemap + urgent email only; an article is drafted, read and published only after the Owner approves;
// a code task goes to Claude only after the Owner approves; nothing for the cron or the public.
import { describe, it, expect, vi } from 'vitest';
import { REQUIRED_HEADERS, type Finding } from './lib.ts';
import { readFileSync } from 'node:fs';
import { handle, articlePageIsLive, articleMarkets, weekStartDay, draftErrors, slugify, WRITE_SCOPE, type StageDeps, type Action, type ArticleRow, type ArticleLang } from './manager.ts';

const NOW = new Date('2026-11-01T05:30:00Z'); // Sunday 07:30 Israel
const KEY = JSON.stringify({ client_email: 'reader@x.iam.gserviceaccount.com', private_key: '-----BEGIN PRIVATE KEY-----\nAAA\n-----END PRIVATE KEY-----\n' });
const ok = (j: unknown) => new Response(JSON.stringify(j), { status: 200 });
const allHeaders = Object.fromEntries(REQUIRED_HEADERS.map((h) => [h, 'x']));
const paths = async () => ['/he', '/en', '/en/articles/how-to-write-a-quote-clients-approve'];

const heP = 'בעלי עסקים קטנים כותבים הצעות מחיר כל יום, וכדאי שכל הצעה תהיה ברורה, מסודרת וקלה לאישור עבור הלקוח שלכם. ';
const enP = 'Small business owners write quotes every day, and every quote should be clear, organized and easy for the client to approve. ';
const lang = (h1: string, p: string): ArticleLang => ({ title: '', h1, description: p.repeat(2).slice(0, 200), intro: p,
  sections: Array.from({ length: 5 }, (_, i) => ({ h: `${h1} ${i + 1}`, p: [p.repeat(4)], list: [] })) });
const goodDraft = { slug: 'Pricing Hourly Work!', he: lang('איך מתמחרים עבודה לפי שעה', heP), en: lang('How to price hourly work', enP) };

// the initial HTML of a real article page: its canonical address, its heading and opening text in the page's language
function articleHtml(url: string, all: ArticleRow[]): string {
  const m = /\/(he|en)\/articles\/([a-z0-9-]+)$/.exec(url);
  const art = m && all.find((a) => a.slug === m[2]);
  if (!m || !art) return '<html><body>Not found</body></html>';
  const l = art[m[1] as 'he' | 'en'];
  return `<html><head><link rel="canonical" href="${url}"><meta name="robots" content="index,follow"></head><body><h1>${l.h1}</h1><p>${l.intro}</p></body></html>`;
}
function deps(over: Partial<StageDeps> = {}) {
  const runs = new Map<string, Record<string, unknown>>();
  const actions = new Map<string, Action & { dedupe_key?: string }>();
  const articles = new Map<string, ArticleRow>();
  const mails: { subject: string; text: string; key: string }[] = [];
  const google: { url: string; init?: RequestInit }[] = [];
  let seq = 0; let cost = 0;
  const gscFetch = vi.fn(async (url: string, init?: RequestInit) => {
    google.push({ url, init });
    if (url.includes('oauth2')) return ok({ access_token: 'AT' });
    if (init?.method === 'PUT') return new Response(null, { status: 204 });
    if (url.endsWith('/sitemaps')) return ok({ sitemap: [] });
    if (url.includes('urlInspection')) {
      const p = JSON.parse(String(init?.body)).inspectionUrl as string;
      return ok({ inspectionResult: { indexStatusResult: { verdict: p.endsWith('/en') ? 'NEUTRAL' : 'PASS', coverageState: p.endsWith('/en') ? 'URL is unknown to Google' : 'Submitted and indexed' } } });
    }
    return ok({ rows: [] });
  });
  const managerAi = { summary_he: 'השבוע: לכתוב מדריך באנגלית. אין תקלות.', summary_en: 'This week: write an English guide. No problems.',
    recommendations: [
      { kind: 'claude', title_he: 'לתקן את הכתובת הראשית של /en', title_en: 'Fix the canonical of /en', detail_he: 'גוגל בחר כתובת אחרת.', detail_en: 'Google chose another.', prompt_he: 'בדקו את קובץ publicSeoRoutes.js וודאו שהכתובת הראשית של /en היא /en, הריצו את הבדיקות ושחררו דרך השער.' },
      { kind: 'claude', title_he: 'משימה בלי הוראה', title_en: 'A task without an instruction', detail_he: '', detail_en: '', prompt_he: '' },
      { kind: 'info', title_he: 'המאמרים החדשים צריכים זמן', title_en: 'The new guides need time', detail_he: 'עד שבועיים.', detail_en: 'Up to two weeks.', prompt_he: '' },
      { kind: 'info', title_he: 'רביעי מיותר', title_en: 'A fourth one', detail_he: '', detail_en: '', prompt_he: '' },
    ],
    articles: [{ topic_he: 'תמחור לפי שעה', topic_en: 'Hourly pricing', why_he: 'מחפשים את זה.', why_en: 'People search for it.' },
      { topic_he: 'הצעת מחיר לגינון', topic_en: 'Landscaping quotes', why_he: 'x', why_en: 'x' }, { topic_he: 'שלישי', topic_en: 'Third', why_he: 'x', why_en: 'x' }] };
  const complete = vi.fn(async (a: { schema: { name: string } }) => {
    if (a.schema.name === 'seo_weekly') return { content: JSON.stringify({ summary_he: 'קידום.', summary_en: 'SEO.', recommendations: [] }), promptTokens: 1000, completionTokens: 300 };
    if (a.schema.name === 'manager_weekly') return { content: JSON.stringify(managerAi), promptTokens: 3000, completionTokens: 800 };
    if (a.schema.name === 'social_week') return { content: JSON.stringify({ posts: [] }), promptTokens: 500, completionTokens: 100 }; // social.test.ts covers the posts
    return { content: JSON.stringify(goodDraft), promptTokens: 2000, completionTokens: 4000 };
  });
  const d: StageDeps & { runs: typeof runs; actions: typeof actions; articles: typeof articles; mails: typeof mails; google: typeof google } = {
    runs, actions, articles, mails, google,
    caller: vi.fn(async () => 'cron' as const),
    can: vi.fn(async () => false),
    connectedChannels: () => [], // stage 2: no Meta account connected unless a test says so
    publishSocial: vi.fn(async () => { throw new Error('not_connected'); }), // a signed-in non-owner holds no supervisor permission unless a test says so
    now: () => NOW,
    claim: vi.fn(async (agent, key, trigger) => { const id = `${agent}|${key}`; if (runs.has(id)) return null; runs.set(id, { id, agent, run_key: key, trigger, status: 'running', started_at: NOW.toISOString(), findings: [], data: {} }); return id; }),
    finish: vi.fn(async (id: string, patch: Record<string, unknown>) => { Object.assign(runs.get(id)!, patch); cost += Number(patch.ai_cost_usd ?? 0); }),
    monthCostUsd: vi.fn(async () => cost),
    recentRuns: vi.fn(async () => [...runs.values()].reverse() as never),
    gsc: { caller: async () => 'admin', keyJson: () => KEY, fetch: gscFetch, now: () => NOW, sign: async () => 'SIG', sitemapXml: async () => '<loc>https://www.tekango.com/he</loc><loc>https://www.tekango.com/en</loc>' },
    serviceStats: vi.fn(async () => ({ inquiries: { red: 0 }, openItems: 0, topItems: [], chatQuestions: 3 })),
    fetchHead: vi.fn(async () => ({ status: 200, headers: allHeaders })),
    versionJson: vi.fn(async () => ({ buildSha: 'abc', dirty: false, servesWorkingTree: false })),
    complete: complete as never,
    mailOwner: vi.fn(async (subject: string, text: string, key: string) => { mails.push({ subject, text, key }); return true; }),
    profiles: vi.fn(async () => [{ agent: 'manager', name_he: 'נועה', name_en: 'Noa' }, { agent: 'seo', name_he: 'גיא', name_en: 'Guy' }, { agent: 'service', name_he: 'מיכל', name_en: 'Michal' }, { agent: 'security', name_he: 'אבי', name_en: 'Avi' }] as never),
    setProfile: vi.fn(async () => undefined),
    recentActions: vi.fn(async () => [...actions.values()].reverse()),
    insertAction: vi.fn(async (a) => {
      if (a.dedupe_key && [...actions.values()].some((x) => x.dedupe_key === a.dedupe_key)) return null;
      const id = `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
      actions.set(id, { id, created_at: d.now().toISOString(), detail_he: null, detail_en: null, payload: {}, status: 'proposed', decided_at: null, done_at: null, result: {}, error: null, ...a } as never);
      return id;
    }),
    updateAction: vi.fn(async (id: string, patch: Record<string, unknown>, when?: string) => { const a = actions.get(id)!; if (when && a.status !== when) return; Object.assign(a, patch); }),
    getAction: vi.fn(async (id: string) => actions.get(id) ?? null),
    insertArticle: vi.fn(async (a) => { const id = `10000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`; articles.set(id, { id, status: 'draft', published_at: null, ...a } as never); return id; }),
    updateArticle: vi.fn(async (id: string, patch: Record<string, unknown>, when?: string, rev?: number) => {
      const a = articles.get(id); if (!a || (when && a.status !== when) || (rev !== undefined && Number(a.revision ?? 0) !== rev)) return false;
      Object.assign(a, patch); return true;
    }),
    pageHtml: vi.fn(async (url: string) => articleHtml(url, [...articles.values()])),
    getArticle: vi.fn(async (id: string) => articles.get(id) ?? null),
    articleSlugs: vi.fn(async () => [...articles.values()].map((a) => a.slug)),
    lastPublishedAt: vi.fn(async () => [...articles.values()].filter((a) => a.published_at).map((a) => a.published_at!).sort().pop() ?? null),
    deployHook: vi.fn(async () => 'ok' as const),
    ...over,
  };
  return d;
}
const admin = () => vi.fn(async () => 'admin' as const);

describe('agents room stage 2 - the manager', () => {
  it('the weekly cron: the specialists run, then the manager; ONE email written by the manager with the names and what waits for approval', async () => {
    const d = deps();
    const r = await handle({ action: 'run' }, d, paths);
    expect(r.status).toBe(200);
    expect((r.body.results as { agent: string; status: string }[]).map((x) => `${x.agent}:${x.status}`)).toEqual(['seo:done', 'service:done', 'security:done', 'social:done', 'manager:done']); // + the social agent (Owner 2026-10-27), before the manager
    expect(r.body).not.toHaveProperty('full');
    expect(d.mails).toHaveLength(1);
    const m = d.mails[0];
    expect(m.key).toBe('tekango-agents/v1/cron:2026-11-01');
    expect(m.text).toMatch(/נועה, מנהלת הסוכנים:\nהשבוע: לכתוב מדריך באנגלית/);
    expect(m.text).toMatch(/מחכה לאישורכם[\s\S]*לתקן את הכתובת הראשית של \/en \(משימה ל-Claude\)[\s\S]*מאמר מוצע \(חו״ל\): תמחור לפי שעה/);
    expect(m.text).toMatch(/גיא \(סוכן הקידום\)[\s\S]*מיכל \(סוכנת השירות\)[\s\S]*אבי \(סוכן האבטחה\)/);
    expect(m.text).not.toMatch(/[⁦⁩]/);
    for (const run of d.runs.values()) expect(run.mailed_at).toBeTruthy();
    // the manager's actions: at most 3 recommendations, a Claude task without an instruction is only information, info needs no approval
    const acts = [...d.actions.values()];
    const recs = acts.filter((a) => a.action_type === 'claude_task' || a.action_type === 'none');
    expect(recs.map((a) => `${a.kind}:${a.status}`)).toEqual(['claude:proposed', 'info:done', 'info:done']);
    expect(recs[0].title_he).toBe('לתקן את הכתובת הראשית של ⁦/en⁩');
    expect(recs[0].payload.prompt_he).toMatch(/publicSeoRoutes/);
    // exactly two article proposals, the markets set by the 65% rule (not by the AI)
    const arts = acts.filter((a) => a.action_type === 'article_draft');
    expect(arts.map((a) => a.payload.market)).toEqual(articleMarkets(NOW));
    expect(arts.every((a) => a.kind === 'system' && a.status === 'proposed')).toBe(true);
    // a second cron call the same day changes nothing
    await handle({ action: 'run' }, d, paths);
    expect(d.mails).toHaveLength(1);
  });

  it('automatic, closed list: the sitemap is resubmitted with the write scope when Google does not know pages, once per run', async () => {
    const d = deps();
    await handle({ action: 'run' }, d, paths);
    const put = d.google.filter((g) => g.init?.method === 'PUT');
    expect(put).toHaveLength(1);
    expect(put[0].url).toBe('https://searchconsole.googleapis.com/webmasters/v3/sites/sc-domain%3Atekango.com/sitemaps/https%3A%2F%2Fwww.tekango.com%2Fsitemap.xml');
    const tokenCalls = d.google.filter((g) => g.url.includes('oauth2')).map((g) => JSON.parse(atob(new URLSearchParams(String(g.init?.body)).get('assertion')!.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).scope);
    expect(tokenCalls).toContain(WRITE_SCOPE);
    expect([...d.actions.values()].find((a) => a.action_type === 'sitemap_submit')).toMatchObject({ kind: 'auto', status: 'done' });
    // Google refuses (the permission was not raised yet) -> recorded honestly as failed
    const d2 = deps();
    (d2.gsc as { fetch: unknown }).fetch = vi.fn(async (url: string, init?: RequestInit) => (init?.method === 'PUT' ? new Response('', { status: 403 }) : url.includes('oauth2') ? ok({ access_token: 'AT' }) : ok({ rows: [], sitemap: [], inspectionResult: { indexStatusResult: { verdict: 'NEUTRAL', coverageState: 'URL is unknown to Google' } } })));
    await handle({ action: 'run' }, d2, paths);
    expect([...d2.actions.values()].find((a) => a.action_type === 'sitemap_submit')).toMatchObject({ status: 'failed', error: 'google_403' });
  });

  it('an article: approve the topic -> a draft (never published), read, approve -> published and the site rebuilds; reject -> rejected', async () => {
    const d = deps();
    await handle({ action: 'run' }, d, paths);
    d.caller = admin();
    const topic = [...d.actions.values()].find((a) => a.action_type === 'article_draft')!;
    const r = await handle({ action: 'decide', id: topic.id, decision: 'approve' }, d, paths);
    expect(r.body).toMatchObject({ ok: true, status: 'drafted' });
    const art = [...d.articles.values()][0];
    expect(art).toMatchObject({ slug: 'pricing-hourly-work', status: 'draft', published_at: null });
    expect(art.he.title).toBe('TEKANGO - איך מתמחרים עבודה לפי שעה');
    expect(d.deployHook).not.toHaveBeenCalled();
    expect([...d.runs.values()].some((x) => String(x.run_key).startsWith('draft:') && Number(x.ai_cost_usd) > 0)).toBe(true); // the cap counts the draft
    const pub = d.actions.get(String(r.body.publishActionId))!;
    expect(pub).toMatchObject({ kind: 'system', action_type: 'article_publish', status: 'proposed' });
    const st = await handle({ action: 'state' }, d, paths);
    expect(st.body).toMatchObject({ pending: expect.any(Number) });
    expect((st.body.drafts as ArticleRow[]).map((x) => x.slug)).toEqual(['pricing-hourly-work']);
    const p = await handle({ action: 'decide', id: pub.id, decision: 'approve' }, d, paths);
    expect(p.body).toMatchObject({ ok: true, status: 'published', deploy: 'ok' });
    expect(d.articles.get(art.id)).toMatchObject({ status: 'published', published_at: NOW.toISOString() });
    expect((await handle({ action: 'decide', id: pub.id, decision: 'approve' }, d, paths)).status).toBe(409); // never twice
    // the second topic is rejected
    const other = [...d.actions.values()].find((a) => a.action_type === 'article_draft' && a.status === 'proposed')!;
    expect((await handle({ action: 'decide', id: other.id, decision: 'reject' }, d, paths)).body).toMatchObject({ status: 'rejected' });
  });

  // 20261029000000 (Codex F12): the first weekly email failed - the second call mails the same report from the stored runs, no AI again
  it('a weekly report that was not mailed goes out on the second call, once, with no AI call', async () => {
    const d = deps();
    const mail = d.mailOwner as ReturnType<typeof vi.fn>;
    const impl = mail.getMockImplementation()!;
    mail.mockImplementationOnce(async () => false);
    const first = await handle({ action: 'run' }, d, paths);
    expect(first.body.mailed).toBe(false);
    const aiCalls = (d.complete as ReturnType<typeof vi.fn>).mock.calls.length;
    mail.mockImplementation(impl);
    const second = await handle({ action: 'run' }, d, paths);
    expect(second.body.mailed).toBe(true);
    expect(d.mails).toHaveLength(1);
    expect(d.mails[0].key).toBe('tekango-agents/v1/cron:2026-11-01');
    expect(d.mails[0].text).toMatch(/נועה, מנהלת הסוכנים:\nהשבוע: לכתוב מדריך באנגלית/);
    expect((d.complete as ReturnType<typeof vi.fn>).mock.calls.length).toBe(aiCalls);
    for (const run of d.runs.values()) expect(run.mailed_at).toBeTruthy();
    await handle({ action: 'run' }, d, paths);
    expect(d.mails).toHaveLength(1);
  });
  // 20261029000000 (Codex F07 / F09 / F22): the approved text is the published text; every paid attempt counts; a failed rebuild is retried
  const draftAndPublishAction = async (d: ReturnType<typeof deps>) => {
    await handle({ action: 'run' }, d, paths);
    d.caller = admin();
    const topic = [...d.actions.values()].find((a) => a.action_type === 'article_draft')!;
    const r = await handle({ action: 'decide', id: topic.id, decision: 'approve' }, d, paths);
    return { pub: d.actions.get(String(r.body.publishActionId))!, art: [...d.articles.values()][0] };
  };
  it('a rewrite that ends after the approval never replaces the approved text', async () => {
    const d = deps();
    const { pub, art } = await draftAndPublishAction(d);
    const approvedText = JSON.stringify(art.en);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => { release = r; });
    const real = d.complete as ReturnType<typeof vi.fn>;
    const impl = real.getMockImplementation()!;
    real.mockImplementation(async (...args: unknown[]) => { await gate; return impl(...args); });
    const rewrite = handle({ action: 'revise', id: pub.id, note: 'Shorter please' }, d, paths);
    await new Promise((r) => setTimeout(r, 0));
    expect((await handle({ action: 'decide', id: pub.id, decision: 'approve', revision: 0 }, d, paths)).body).toMatchObject({ ok: true, status: 'published' });
    release();
    expect((await rewrite).status).toBe(409);
    expect(JSON.stringify(d.articles.get(art.id)!.en)).toBe(approvedText);
  });
  it('an approval of an older revision is refused - the Owner reads the rewritten draft first', async () => {
    const d = deps();
    const { pub, art } = await draftAndPublishAction(d);
    expect((await handle({ action: 'revise', id: pub.id, note: 'Shorter please' }, d, paths)).body).toMatchObject({ ok: true, status: 'revised' });
    expect(d.actions.get(pub.id)!.payload.revision).toBe(1);
    expect((await handle({ action: 'decide', id: pub.id, decision: 'approve', revision: 0 }, d, paths)).body).toEqual({ ok: false, code: 'article_changed' });
    expect(d.articles.get(art.id)!.status).toBe('draft');
    expect((await handle({ action: 'decide', id: pub.id, decision: 'approve', revision: 1 }, d, paths)).body).toMatchObject({ ok: true, status: 'published' });
  });
  // Codex N01: the publication is ONE conditional write on the approved revision - a rewrite that lands between the check and the write wins
  it('a rewrite stored between the check and the publication: nothing is published, the Owner reads the new text', async () => {
    const d = deps();
    const { pub, art } = await draftAndPublishAction(d);
    const real = d.updateArticle as ReturnType<typeof vi.fn>;
    const impl = real.getMockImplementation()!;
    real.mockImplementationOnce(async (...args: unknown[]) => { d.articles.get(art.id)!.revision = 1; return impl(...args); }); // the rewrite lands first
    expect((await handle({ action: 'decide', id: pub.id, decision: 'approve', revision: 0 }, d, paths)).body).toEqual({ ok: false, code: 'article_changed' });
    expect(d.articles.get(art.id)).toMatchObject({ status: 'draft', published_at: null });
    expect(d.deployHook).not.toHaveBeenCalled();
    // a rewrite moves the text and the revision together
    expect((await handle({ action: 'revise', id: pub.id, note: 'Shorter please' }, d, paths)).body).toMatchObject({ ok: true, status: 'revised' });
    expect(d.articles.get(art.id)!.revision).toBe(2);
    expect(d.actions.get(pub.id)!.payload.revision).toBe(2);
  });
  // Codex N08: a paid answer that came back incomplete is counted in the month's cost
  it('an incomplete paid answer still counts its cost', async () => {
    const plain = deps();
    await handle({ action: 'run' }, plain, paths);
    const d = deps();
    const real = d.complete as ReturnType<typeof vi.fn>;
    const impl = real.getMockImplementation()!;
    let thrown = false;
    real.mockImplementation(async (a: { schema: { name: string } }) => {
      if (a.schema.name === 'manager_weekly' && !thrown) { thrown = true; throw Object.assign(new Error('ai_incomplete'), { usage: { promptTokens: 3000, completionTokens: 800 } }); }
      return impl(a);
    });
    await handle({ action: 'run' }, d, paths);
    const total = (x: ReturnType<typeof deps>) => [...x.runs.values()].reduce((s, r) => s + Number(r.ai_cost_usd ?? 0), 0);
    expect(thrown).toBe(true);
    expect(total(d)).toBeGreaterThan(total(plain));
  });
  // Codex N10: a retry of the weekly email that failed again is reported as tried
  it('a weekly email retried and failed again says it was tried', async () => {
    const d = deps({ mailOwner: vi.fn(async () => false) });
    expect((await handle({ action: 'run' }, d, paths)).body).toMatchObject({ mailed: false, mailAttempted: true });
    expect((await handle({ action: 'run' }, d, paths)).body).toMatchObject({ mailed: false, mailAttempted: true });
  });
  // Codex N11 (Owner 2026-10-28, decision 3): the article's own page must be on the site
  it('the daily run verifies a published article page; one still missing two hours later is "unverified" and can be rebuilt', async () => {
    const d = deps();
    const { pub } = await draftAndPublishAction(d);
    await handle({ action: 'decide', id: pub.id, decision: 'approve' }, d, paths);
    const slug = String(d.actions.get(pub.id)!.result.slug);
    const at = (ms: number) => { d.now = () => new Date(NOW.getTime() + ms); };
    const page = d.pageHtml as ReturnType<typeof vi.fn>;
    d.caller = vi.fn(async () => 'cron' as const); // the daily run is the cron's
    // too soon: not checked
    at(5 * 60000);
    expect((await handle({ action: 'daily' }, d, paths)).body).toMatchObject({ articles: { verified: 0, unverified: 0 } });
    expect(page).not.toHaveBeenCalled();
    // after 10 minutes the page is missing (still building): not yet unverified
    page.mockImplementation(async () => null);
    at(30 * 60000);
    d.runs.clear();
    expect((await handle({ action: 'daily' }, d, paths)).body).toMatchObject({ articles: { verified: 0, unverified: 0 } });
    // a noindex page is not on the site either; after two hours: unverified, with the rebuild button
    page.mockImplementation(async (u: string) => articleHtml(u, [...d.articles.values()]).replace('content="index,follow"', "content='noindex'"));
    at(3 * 3600000);
    d.runs.clear();
    expect((await handle({ action: 'daily' }, d, paths)).body).toMatchObject({ articles: { verified: 0, unverified: 1 } });
    expect(d.actions.get(pub.id)).toMatchObject({ error: 'deploy_unverified', result: { deploy: 'unverified', slug } });
    // "Rebuild the site" (the Owner); the next daily run finds both pages: verified, never checked again
    d.caller = admin();
    expect((await handle({ action: 'redeploy', id: pub.id }, d, paths)).body).toMatchObject({ ok: true, deploy: 'ok' });
    d.caller = vi.fn(async () => 'cron' as const);
    page.mockImplementation(async (u: string) => articleHtml(u, [...d.articles.values()]));
    at(4 * 3600000);
    d.runs.clear();
    expect((await handle({ action: 'daily' }, d, paths)).body).toMatchObject({ articles: { verified: 1, unverified: 0 } });
    expect(d.actions.get(pub.id)!.result).toMatchObject({ deploy: 'ok', verified: true });
    expect(page.mock.calls.map((c) => c[0])).toContain(`https://www.tekango.com/he/articles/${slug}`);
    const calls = page.mock.calls.length;
    at(5 * 3600000);
    d.runs.clear();
    await handle({ action: 'daily' }, d, paths);
    expect(page.mock.calls.length).toBe(calls);
  });
  // Codex R05 (Owner 2026-10-29): a page that only mentions the address is not the article
  it('the article page check: exact canonical, the heading and opening in that language, no noindex in any spelling', () => {
    const he = goodDraft.he; const url = 'https://www.tekango.com/he/articles/pricing-hourly-work';
    const good = `<html><head><link href='${url}' rel='canonical'></head><body><h1>${he.h1}</h1><p>${he.intro}</p></body></html>`;
    expect(articlePageIsLive(good, url, he)).toBe(true);
    expect(articlePageIsLive(`<html><link rel="canonical" href="${url}"></html>`, url, he)).toBe(false); // empty page
    expect(articlePageIsLive(good.replace(url, 'https://www.tekango.com/he/articles'), url, he)).toBe(false); // another canonical
    expect(articlePageIsLive(good.replace(url, `${url}-2`), url, he)).toBe(false); // a slug that only starts the same
    expect(articlePageIsLive(good.replace('</head>', `<meta content='noindex, follow' name='robots'></head>`), url, he)).toBe(false);
    expect(articlePageIsLive(good.replace('</head>', '<meta name="googlebot" content="NOINDEX"></head>'), url, he)).toBe(false);
    expect(articlePageIsLive(good.replace(he.intro, ''), url, he)).toBe(false); // no article text
    expect(articlePageIsLive(good, url, goodDraft.en)).toBe(false); // the other language's article
  });
  // Codex R01 (Owner 2026-10-29, L-22): the action's revision lagging behind the article never blocks approving the text on the screen
  it('an action whose revision lags behind the article: the screen revision is approved, the action is repaired, no AI call', async () => {
    const d = deps();
    const { pub, art } = await draftAndPublishAction(d);
    d.articles.get(art.id)!.revision = 1; // the rewrite was stored, its action update was lost
    const aiCalls = (d.complete as ReturnType<typeof vi.fn>).mock.calls.length;
    expect((await handle({ action: 'decide', id: pub.id, decision: 'approve', revision: 0 }, d, paths)).body).toEqual({ ok: false, code: 'article_changed' });
    expect((await handle({ action: 'decide', id: pub.id, decision: 'approve', revision: 1 }, d, paths)).body).toMatchObject({ ok: true, status: 'published' });
    expect((d.complete as ReturnType<typeof vi.fn>).mock.calls.length).toBe(aiCalls);
    const ui = readFileSync('src/components/AdminAgentsRoom.jsx', 'utf8');
    expect(ui).toContain('revision: Number(drafts[a.payload?.articleId]?.revision ?? a.payload?.revision ?? 0)');
  });
  it('a rejection after the approval does not unpublish the article', async () => {
    const d = deps();
    const { pub, art } = await draftAndPublishAction(d);
    const stale = { ...pub };
    expect((await handle({ action: 'decide', id: pub.id, decision: 'approve' }, d, paths)).body).toMatchObject({ status: 'published' });
    (d.getAction as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => stale);
    expect((await handle({ action: 'decide', id: pub.id, decision: 'reject' }, d, paths)).status).toBe(409);
    expect(d.articles.get(art.id)!.status).toBe('published');
    expect(d.actions.get(pub.id)!.status).toBe('done');
  });
  it('a rebuild that did not start is reported truthfully and can be pressed again, with no second approval', async () => {
    const d = deps({ deployHook: vi.fn(async () => 'failed' as const) });
    const { pub } = await draftAndPublishAction(d);
    expect((await handle({ action: 'decide', id: pub.id, decision: 'approve' }, d, paths)).body).toMatchObject({ status: 'published', deploy: 'failed' });
    expect(d.actions.get(pub.id)).toMatchObject({ status: 'done', error: 'deploy_failed' });
    (d.deployHook as ReturnType<typeof vi.fn>).mockResolvedValueOnce('ok');
    expect((await handle({ action: 'redeploy', id: pub.id }, d, paths)).body).toEqual({ ok: true, status: 'redeployed', deploy: 'ok' });
    expect(d.actions.get(pub.id)).toMatchObject({ error: null, result: { deploy: 'ok' } });
    expect((await handle({ action: 'redeploy', id: pub.id }, d, paths)).status).toBe(409);
  });
  it('a draft that breaks the market rules is never stored', async () => {
    const d = deps({ complete: vi.fn(async (a: { schema: { name: string } }) => (a.schema.name === 'guide_article'
      ? { content: JSON.stringify({ ...goodDraft, en: lang('Prices in shekels', `${enP} Prices in ₪ for Israel. `) }), promptTokens: 1, completionTokens: 1 }
      : { content: '{}', promptTokens: 1, completionTokens: 1 })) as never });
    const id = await d.insertAction({ run_key: 'k', source: 'manager', kind: 'system', action_type: 'article_draft', title_he: 'x', title_en: 'x', payload: { market: 'intl', topic_he: 'x', topic_en: 'x' } });
    d.caller = admin();
    const r = await handle({ action: 'decide', id, decision: 'approve' }, d, paths);
    expect(r.status).toBe(502);
    expect(r.body.errors).toContain('en.israel');
    expect(d.articles.size).toBe(0);
    expect(d.actions.get(id!)!.status).toBe('proposed'); // the Owner can try again
    // Codex F09: every paid attempt is counted (a retry is not lost under the first attempt's key)
    (d as unknown as { now: () => Date }).now = () => new Date(NOW.getTime() + 5000);
    await handle({ action: 'decide', id, decision: 'approve' }, d, paths);
    expect([...d.runs.values()].filter((x) => String(x.run_key).startsWith(`draft:${id}:`)).length).toBe(2);
  });

  it('a code task: approve -> the Owner gets the full instruction for Claude by email; then "done"', async () => {
    const d = deps();
    await handle({ action: 'run' }, d, paths);
    d.caller = admin();
    const task = [...d.actions.values()].find((a) => a.kind === 'claude')!;
    const r = await handle({ action: 'decide', id: task.id, decision: 'approve' }, d, paths);
    expect(r.body).toMatchObject({ ok: true, status: 'approved', mailed: true });
    expect(d.mails.at(-1)!.text).toMatch(/publicSeoRoutes\.js/);
    expect(d.mails.at(-1)!.key).toBe(`tekango-agents/v1/claude/${task.id}`);
    expect((await handle({ action: 'mark_done', id: task.id }, d, paths)).body).toMatchObject({ status: 'done' });
  });

  it('who may do what: the cron cannot approve or rename; the admin cannot trigger the daily run; information cannot be approved', async () => {
    const d = deps();
    await handle({ action: 'run' }, d, paths);
    const task = [...d.actions.values()].find((a) => a.kind === 'claude')!;
    expect((await handle({ action: 'decide', id: task.id, decision: 'approve' }, d, paths)).status).toBe(403);
    expect((await handle({ action: 'rename', agent: 'seo', name_he: 'x', name_en: 'x' }, d, paths)).status).toBe(403);
    d.caller = admin();
    expect((await handle({ action: 'daily' }, d, paths)).status).toBe(403);
    const info = [...d.actions.values()].find((a) => a.kind === 'info')!;
    expect((await handle({ action: 'decide', id: info.id, decision: 'approve' }, d, paths)).status).toBe(409);
    expect((await handle({ action: 'decide', id: 'nope', decision: 'approve' }, d, paths)).status).toBe(404);
    expect((await handle({ action: 'rename', agent: 'boss', name_he: 'x', name_en: 'x' }, d, paths)).status).toBe(400);
    expect((await handle({ action: 'rename', agent: 'seo', name_he: '  ', name_en: 'x' }, d, paths)).status).toBe(400);
    expect((await handle({ action: 'rename', agent: 'manager', name_he: 'שירה', name_en: 'Shira' }, d, paths)).status).toBe(200);
    expect(d.setProfile).toHaveBeenCalledWith('manager', 'שירה', 'Shira');
    expect((await handle({ action: 'nothing' }, d, paths)).status).toBe(400);
    d.caller = vi.fn(async () => null);
    expect((await handle({ action: 'state' }, d, paths)).status).toBe(403);
  });

  it('the daily run: the security agent every day; a problem emails the Owner once a day; a published article resubmits the sitemap after the rebuild', async () => {
    const d = deps({ fetchHead: vi.fn(async (url: string) => ({ status: url.endsWith('/en') ? 500 : 200, headers: allHeaders })) });
    const r = await handle({ action: 'daily' }, d, paths);
    expect(r.body).toMatchObject({ ok: true, runKey: 'daily:2026-11-01', security: 'done', urgent: true, sitemap: 'skipped' });
    expect(d.mails[0].subject).toBe('התראה דחופה מסוכן האבטחה - TEKANGO');
    expect(d.mails[0].text).toMatch(/\/en \(500\)/);
    expect((await handle({ action: 'daily' }, d, paths)).body).toMatchObject({ security: 'already_ran' });
    expect(d.mails).toHaveLength(1);
    // an article published 11 minutes ago -> the sitemap goes to Google
    const d2 = deps();
    d2.articles.set('a', { id: 'a', slug: 's', market: 'intl', status: 'published', he: goodDraft.he, en: goodDraft.en, published_at: new Date(NOW.getTime() - 11 * 60_000).toISOString() });
    expect((await handle({ action: 'daily' }, d2, paths)).body).toMatchObject({ security: 'done', urgent: null, sitemap: 'submitted' });
  });

  it('the rules: 65% international over three weeks, the draft checks, clean slugs', () => {
    const weeks = Array.from({ length: 3 }, (_, i) => articleMarkets(new Date(NOW.getTime() + i * 7 * 86_400_000))).flat();
    expect(weeks.filter((m) => m === 'intl')).toHaveLength(4);
    expect(draftErrors({ ...goodDraft, slug: 'ok-slug' })).toEqual([]);
    expect(draftErrors({ ...goodDraft, slug: 'ok-slug', he: lang('מחיר', `${heP} עולה 50 דולר. `) })).toContain('he.dollars');
    expect(draftErrors({ ...goodDraft, slug: 'ok-slug', en: lang('Guide', `${enP} שלום `) })).toContain('en.hebrew');
    expect(draftErrors({ ...goodDraft, slug: 'ok-slug', he: { ...goodDraft.he, sections: goodDraft.he.sections.slice(0, 2) } })).toContain('he.sections');
    expect(slugify('  Hello, World -- 2026! ')).toBe('hello-world-2026');
  });

  it('Owner 2026-10-27 ("מאשר לתקן את מכסת המאמרים לשתיים בשבוע"): two article proposals a week however many runs, no repeated recommendation, a new week gets two more', async () => {
    const d = deps();
    d.caller = admin();
    let t = new Date('2026-11-01T06:10:00Z'); // Sunday 08:10 Israel
    d.now = () => t;
    const arts = () => [...d.actions.values()].filter((a) => a.action_type === 'article_draft');
    const recs = () => [...d.actions.values()].filter((a) => a.action_type === 'claude_task' || a.action_type === 'none');
    await handle({ action: 'run', agent: 'manager' }, d, paths);
    expect(arts()).toHaveLength(2);
    const firstRecs = recs().length;
    for (const h of [1, 2, 30]) { // later the same day and two days later - the same week
      t = new Date(Date.parse('2026-11-01T06:10:00Z') + h * 3_600_000);
      expect((await handle({ action: 'run', agent: 'manager' }, d, paths)).status).toBe(200);
    }
    t = new Date('2026-11-07T20:00:00Z'); // Saturday 22:00 Israel - still the same week
    await handle({ action: 'run', agent: 'manager' }, d, paths);
    expect(arts()).toHaveLength(2);
    expect(recs()).toHaveLength(firstRecs); // the same recommendation is never proposed again
    t = new Date('2026-11-08T06:10:00Z'); // the next Sunday
    await handle({ action: 'run', agent: 'manager' }, d, paths);
    expect(arts()).toHaveLength(4);
    expect(arts().slice(2).map((a) => a.payload.market)).toEqual(articleMarkets(t));
    expect(weekStartDay(new Date('2026-11-07T20:00:00Z'))).toBe('2026-11-01');
    expect(weekStartDay(new Date('2026-11-07T22:30:00Z'))).toBe('2026-11-08'); // 00:30 Sunday in Israel
    // the manager is told the week's articles are done
    const last = (d.complete as ReturnType<typeof vi.fn>).mock.calls.filter((c) => c[0].schema.name === 'manager_weekly');
    expect(last[1][0].messages[0].content).toMatch(/articles: an empty array/);
  });

  it('the cap: the manager does not run once the month reached 20 dollars', async () => {
    const d = deps({ monthCostUsd: vi.fn(async () => 20) });
    const r = await handle({ action: 'run' }, d, paths);
    expect((r.body.results as { agent: string; status: string }[]).find((x) => x.agent === 'manager')!.status).toBe('skipped_cap');
    expect([...d.actions.values()].filter((a) => a.action_type === 'article_draft')).toHaveLength(0);
  });
});

export type { Finding };
