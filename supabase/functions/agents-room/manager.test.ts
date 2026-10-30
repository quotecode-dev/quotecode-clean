// agents-room stage 2 (Owner console 2026-10-27: "מאשר את תוכנית שלב 2 עם מנהל הסוכנים" + the four decisions): the manager is the only
// agent that acts; automatic = sitemap + urgent email only; an article is drafted, read and published only after the Owner approves;
// a code task goes to Claude only after the Owner approves; nothing for the cron or the public.
import { describe, it, expect, vi } from 'vitest';
import { REQUIRED_HEADERS, type Finding } from './lib.ts';
import { readFileSync } from 'node:fs';
import { normTopic, type Inventory } from './articleTopics.ts';
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
  // Codex release 4: the topic claims (20261030300000) - one active flow per language, kind and normalized text
  const claims: { ref_id: string; kind: 'topic' | 'title'; lang: 'he' | 'en'; norm: string; display: string; focus: string | null }[] = [];
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
  const d: StageDeps & { runs: typeof runs; actions: typeof actions; articles: typeof articles; mails: typeof mails; google: typeof google; claims: typeof claims } = {
    runs, actions, articles, mails, google, claims,
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
    updateAction: vi.fn(async (id: string, patch: Record<string, unknown>, when?: string, whenAt?: string | null) => {
      const a = actions.get(id)!; if (when && a.status !== when) return; if (whenAt !== undefined && (a.decided_at ?? null) !== whenAt) return; Object.assign(a, patch);
    }),
    getAction: vi.fn(async (id: string) => { const a = actions.get(id); return a ? structuredClone(a) : null; }), // a read is a copy, like the database
    insertArticle: vi.fn(async (a) => { const id = `10000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`; articles.set(id, { id, status: 'draft', published_at: null, ...a } as never); return id; }),
    updateArticle: vi.fn(async (id: string, patch: Record<string, unknown>, when?: string, rev?: number) => {
      const a = articles.get(id); if (!a || (when && a.status !== when) || (rev !== undefined && Number(a.revision ?? 0) !== rev)) return false;
      Object.assign(a, patch); return true;
    }),
    pageHtml: vi.fn(async (url: string) => articleHtml(url, [...articles.values()])),
    getArticle: vi.fn(async (id: string) => articles.get(id) ?? null),
    articleInventory: vi.fn(async (): Promise<Inventory> => ({
      articles: [...articles.values()].filter((a) => a.status !== 'rejected').map((a) => ({ id: a.id, slug: a.slug, status: a.status as 'draft' | 'published', market: a.market,
        he: a.he?.h1 ?? null, en: a.en?.h1 ?? null, action_id: a.action_id ?? null })),
      proposals: [...actions.values()].filter((a) => a.action_type === 'article_draft' && a.status === 'proposed')
        .map((a) => ({ id: a.id, he: String(a.payload.topic_he ?? ''), en: String(a.payload.topic_en ?? ''), focus: (a.payload.focus as string) ?? null })),
      claims: claims.map((c) => ({ ...c })),
      slugs: [...articles.values()].map((a) => a.slug),
    })),
    claimTopic: vi.fn(async (ref: string, kind: 'topic' | 'title', he: string, en: string, focus: string | null) => {
      if (actions.get(ref)?.status === 'rejected') throw new Error('database'); // agents_article_claim_invalid

      const want = [{ lang: 'he' as const, norm: normTopic(he), display: he }, { lang: 'en' as const, norm: normTopic(en), display: en }];
      for (const w of want) {
        const other = claims.find((c) => c.lang === w.lang && c.kind === kind && c.norm === w.norm && c.ref_id !== ref);
        if (other) return { ok: false as const, lang: w.lang, refId: other.ref_id };
      }
      for (let i = claims.length - 1; i >= 0; i -= 1) if (claims[i].ref_id === ref && claims[i].kind === kind) claims.splice(i, 1);
      for (const w of want) claims.push({ ref_id: ref, kind, ...w, focus });
      return { ok: true as const };
    }),
    releaseTopic: vi.fn(async (ref: string) => { for (let i = claims.length - 1; i >= 0; i -= 1) if (claims[i].ref_id === ref) claims.splice(i, 1); }),
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

  // Owner 2026-10-29 (L-22): Noa's Hebrew article keeps the brand in Latin letters too
  it('an article draft with the brand in Hebrew letters is stored with TEKANGO', async () => {
    const he = { ...goodDraft.he, intro: `${heP}בטקנגו כותבים הצעה כזו בכמה דקות.`, sections: goodDraft.he.sections.map((s, i) => (i === 0 ? { ...s, p: [`${s.p[0]} של טקנגו`] } : s)) };
    const d = deps({ complete: vi.fn(async (a: { schema: { name: string } }) => (a.schema.name === 'guide_article'
      ? { content: JSON.stringify({ ...goodDraft, he }), promptTokens: 1, completionTokens: 1 }
      : { content: '{}', promptTokens: 1, completionTokens: 1 })) as never });
    const id = await d.insertAction({ run_key: 'k', source: 'manager', kind: 'system', action_type: 'article_draft', title_he: 'x', title_en: 'x', payload: { market: 'il', topic_he: 'x', topic_en: 'x' } });
    d.caller = admin();
    expect((await handle({ action: 'decide', id, decision: 'approve' }, d, paths)).status).toBe(200);
    const art = [...d.articles.values()][0];
    expect(art.he.intro).toMatch(/ב-TEKANGO כותבים הצעה כזו/);
    expect(art.he.sections[0].p[0]).toMatch(/של TEKANGO$/);
    expect(JSON.stringify(art)).not.toMatch(/טקא?נגו/);
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
    // Codex release 4 (decision 6): last week's topics are still waiting, so the same two are not stored again - new topics are
    const firstWeek = d.complete as ReturnType<typeof vi.fn>;
    const again = await handle({ action: 'run', agent: 'manager' }, d, paths); // the AI repeats last week's topics (another hour key)
    expect(again.status).toBe(200);
    expect(arts()).toHaveLength(2);
    d.complete = vi.fn(async (a: { schema: { name: string } }) => (a.schema.name === 'manager_weekly'
      ? { content: JSON.stringify({ summary_he: 'שבוע חדש.', summary_en: 'A new week.', recommendations: [],
        articles: [{ topic_he: 'הצעת מחיר לניקיון משרדים', topic_en: 'Office cleaning quotes', why_he: 'x', why_en: 'x' }, { topic_he: 'מקדמה בהצעת מחיר', topic_en: 'Deposits in a quote', why_he: 'x', why_en: 'x' }] }),
        promptTokens: 100, completionTokens: 100 }
      : firstWeek(a))) as never;
    t = new Date('2026-11-08T08:10:00Z');
    await handle({ action: 'run', agent: 'manager' }, d, paths);
    expect(arts()).toHaveLength(4);
    expect(arts().slice(2).map((a) => a.payload.market)).toEqual(articleMarkets(t));
    expect(weekStartDay(new Date('2026-11-07T20:00:00Z'))).toBe('2026-11-01');
    expect(weekStartDay(new Date('2026-11-07T22:30:00Z'))).toBe('2026-11-08'); // 00:30 Sunday in Israel
    // the manager is told the week's articles are done
    const last = firstWeek.mock.calls.filter((c) => c[0].schema.name === 'manager_weekly');
    expect(last[1][0].messages[0].content).toMatch(/articles: an empty array/);
  });

  it('the cap: the manager does not run once the month reached 20 dollars', async () => {
    const d = deps({ monthCostUsd: vi.fn(async () => 20) });
    const r = await handle({ action: 'run' }, d, paths);
    expect((r.body.results as { agent: string; status: string }[]).find((x) => x.agent === 'manager')!.status).toBe('skipped_cap');
    expect([...d.actions.values()].filter((a) => a.action_type === 'article_draft')).toHaveLength(0);
  });
});

// Codex release 4 (Owner 2026-10-29, typed: "מאשר שינוי ב-L-22 לשחרור 4 של קודקס: הגנה מכפילויות מאמרים ושמירת תקציב בינה עם שריון מראש,
// החלטות 6 ו-9 כמוצע, L-25 בלי שינוי, שחרור עד הלייב")
describe('Codex release 4 - duplicate article topics (decision 6) and the AI budget (topic 6a)', () => {
  type D = ReturnType<typeof deps>;
  const propose = (d: D, he: string, en: string, extra: Record<string, unknown> = {}) => d.insertAction({ run_key: 'admin:2026-11-01T08', source: 'manager', kind: 'system',
    action_type: 'article_draft', title_he: he, title_en: en, payload: { market: 'intl', topic_he: he, topic_en: en, ...extra } }) as Promise<string>;
  const calls = (d: D, name: string) => (d.complete as ReturnType<typeof vi.fn>).mock.calls.filter((c) => c[0].schema.name === name);
  const approve = (d: D, id: string, extra: Record<string, unknown> = {}) => handle({ action: 'decide', id, decision: 'approve', ...extra }, d, paths);
  const managerSays = (d: D, articles: { topic_he: string; topic_en: string }[]) => {
    const first = d.complete as ReturnType<typeof vi.fn>;
    d.complete = vi.fn(async (a: { schema: { name: string } }) => (a.schema.name === 'manager_weekly'
      ? { content: JSON.stringify({ summary_he: 'השבוע.', summary_en: 'This week.', recommendations: [], articles: articles.map((x) => ({ ...x, why_he: 'x', why_en: 'x' })) }), promptTokens: 100, completionTokens: 100 }
      : first(a))) as never;
  };

  it('boundary 1: the manager sees every existing topic; the same topic as a static guide (with niqqud) is not stored or refilled; a similar one waits with its match', async () => {
    const d = deps(); d.caller = admin();
    managerSays(d, [
      { topic_he: 'הַצָּעַת מְחִיר לפי מידות: מטר רבוע ומטר אורך', topic_en: 'Tile installation price lists' }, // = the static guide in Hebrew
      { topic_he: 'הצעות מחיר לשיפוצים', topic_en: 'Renovation quotes' }, // close to the renovation guide
    ]);
    const r = await handle({ action: 'run', agent: 'manager' }, d, paths);
    expect((r.body.results as { status: string }[])[0].status).toBe('done');
    const arts = [...d.actions.values()].filter((a) => a.action_type === 'article_draft');
    expect(arts).toHaveLength(1);
    expect(arts[0].payload.topic_en).toBe('Renovation quotes');
    expect(arts[0].payload.similar).toMatchObject({ kind: 'static', slug: 'renovation-contractor-quote' });
    expect(calls(d, 'manager_weekly')).toHaveLength(1); // no paid call refills the slot
    const run = [...d.runs.values()].find((x) => x.agent === 'manager')!;
    expect(run.findings).toEqual(expect.arrayContaining([expect.objectContaining({ level: 'warn', he: expect.stringMatching(/^נושא כפול לא נשמר/) })]));
    expect(run.data).toMatchObject({ duplicates: 1, topicCoverage: { sent: 4, total: 4 } });
    const user = JSON.parse(calls(d, 'manager_weekly')[0][0].messages[1].content);
    expect(user.existingTopics).toEqual(expect.arrayContaining([{ he: 'תמחור יבוא עם המרת מטבעות', en: 'Import Pricing with Currency Conversion' }]));
  });

  it('boundary 2: a topic already in a draft (Hebrew only) is refused before any paid call, naming the draft', async () => {
    const d = deps(); d.caller = admin();
    const other = await propose(d, 'נושא אחר לגמרי', 'A different topic');
    await d.insertArticle({ slug: 'hourly', market: 'il', he: lang('תמחור לפי שעה', heP), en: lang('Hourly rates explained', enP), action_id: other });
    const id = await propose(d, 'תמחור לפי שעה!', 'Pricing by the hour for freelancers');
    const r = await approve(d, id);
    expect(r).toMatchObject({ status: 409, body: { ok: false, code: 'duplicate_topic', match: { kind: 'draft', lang: 'he', slug: 'hourly' } } });
    expect(calls(d, 'guide_article')).toHaveLength(0);
    expect(d.claims).toHaveLength(0);
  });

  it('a similar topic needs a distinct focus: refused without one (no paid call), written with one, and the focus reaches the writer', async () => {
    const d = deps(); d.caller = admin();
    const id = await propose(d, 'הצעות מחיר לשיפוצים', 'Renovation quotes');
    expect(await approve(d, id)).toMatchObject({ status: 409, body: { code: 'possible_duplicate', match: { kind: 'static', slug: 'renovation-contractor-quote' } } });
    expect(await approve(d, id, { focus: 'קצר' })).toMatchObject({ status: 409, body: { code: 'possible_duplicate' } });
    expect(calls(d, 'guide_article')).toHaveLength(0);
    const focus = 'שיפוץ מטבח בלבד: ארונות, משטח וחיבורי מים';
    const r = await approve(d, id, { focus });
    expect(r).toMatchObject({ status: 200, body: { status: 'drafted' } });
    expect(calls(d, 'guide_article')).toHaveLength(1);
    expect(JSON.parse(calls(d, 'guide_article')[0][0].messages[1].content).distinctFocus).toBe(focus);
    expect(d.actions.get(id)!.payload.focus).toBe(focus);
    expect(d.claims.filter((c) => c.ref_id === id).map((c) => `${c.kind}:${c.lang}`).sort()).toEqual(['title:en', 'title:he', 'topic:en', 'topic:he']);
    expect(d.claims.find((c) => c.ref_id === id && c.kind === 'topic')!.focus).toBe(focus);
  });

  it('two approvals at once: a double press writes once; two flows of the same topic - one atomic claim, one paid writing', async () => {
    const d = deps(); d.caller = admin();
    const id = await propose(d, 'מקדמה בהצעת מחיר', 'Deposits in a quote');
    const twice = await Promise.all([approve(d, id), approve(d, id)]);
    expect(twice.map((x) => x.status).sort()).toEqual([200, 409]);
    expect(twice.find((x) => x.status === 409)!.body.code).toBe('drafting');
    expect(calls(d, 'guide_article')).toHaveLength(1);

    const e = deps(); e.caller = admin();
    const a1 = await propose(e, 'הצעת מחיר לגינון', 'Landscaping quotes');
    const a2 = await propose(e, 'הצעת מחיר לגינון', 'Landscaping quotes');
    // both read the inventory before either claims (a stale read): the claim itself decides
    e.articleInventory = vi.fn(async () => ({ articles: [], proposals: [], claims: [], slugs: [] }));
    const both = await Promise.all([approve(e, a1), approve(e, a2)]);
    expect(both.map((x) => x.body.code ?? x.body.status).sort()).toEqual(['drafted', 'duplicate_topic']);
    expect(calls(e, 'guide_article')).toHaveLength(1);
  });

  it('the written headings are checked again: never stored, published or rewritten into another article\'s heading', async () => {
    const d = deps(); d.caller = admin();
    const pubFlow = await propose(d, 'תמחור לפי שעה', 'Hourly pricing');
    const pubId = await d.insertArticle({ slug: 'how-to-price-hourly-work', market: 'intl', he: goodDraft.he, en: goodDraft.en, action_id: pubFlow });
    Object.assign(d.articles.get(pubId)!, { status: 'published', published_at: NOW.toISOString() });
    // 1. a distinct topic whose written draft carries the published article's headings: not stored
    const id = await propose(d, 'תוספת סוף שבוע בהצעת מחיר', 'Weekend surcharge in a quote');
    const before = d.articles.size;
    expect(await approve(d, id)).toMatchObject({ status: 409, body: { code: 'duplicate_topic', match: { kind: 'published', slug: 'how-to-price-hourly-work' } } });
    expect(d.articles.size).toBe(before);
    expect(d.actions.get(id)!.error).toBe('duplicate_topic');
    // 2. a draft with a static guide's heading is not published
    const flow = await propose(d, 'נושא', 'Topic');
    const artId = await d.insertArticle({ slug: 'import-basics', market: 'il', he: lang('תמחור יבוא עם המרת מטבעות', heP), en: lang('Import pricing basics', enP), action_id: flow });
    const pub = await d.insertAction({ run_key: 'x', source: 'manager', kind: 'system', action_type: 'article_publish', title_he: 'x', title_en: 'x', payload: { articleId: artId } }) as string;
    expect(await approve(d, pub, { revision: 0 })).toMatchObject({ status: 409, body: { code: 'duplicate_topic', match: { kind: 'static', lang: 'he' } } });
    expect(d.articles.get(artId)!.status).toBe('draft');
    expect(d.deployHook).not.toHaveBeenCalled();
    // 3. a rewrite into the published article's headings is refused and the text stays
    const flow2 = await propose(d, 'נושא שני', 'Second topic');
    const art2 = await d.insertArticle({ slug: 'second', market: 'intl', he: lang('מדריך שני', heP), en: lang('A second guide', enP), action_id: flow2 });
    const pub2 = await d.insertAction({ run_key: 'x', source: 'manager', kind: 'system', action_type: 'article_publish', title_he: 'x', title_en: 'x', payload: { articleId: art2 } }) as string;
    expect(await handle({ action: 'revise', id: pub2, note: 'שנו את הכותרת' }, d, paths)).toMatchObject({ status: 409, body: { code: 'duplicate_topic' } });
    expect(d.articles.get(art2)!.en.h1).toBe('A second guide');
    expect(Number(d.articles.get(art2)!.revision ?? 0)).toBe(0);
  });

  it('a failed writing keeps the topic claimed (no automatic second writing); only a rejection frees it', async () => {
    const d = deps(); d.caller = admin();
    const first = d.complete as ReturnType<typeof vi.fn>;
    d.complete = vi.fn(async (a: { schema: { name: string } }) => (a.schema.name === 'guide_article'
      ? { content: JSON.stringify({ ...goodDraft, en: lang('שלום', enP) }), promptTokens: 10, completionTokens: 10 } : first(a))) as never;
    const id = await propose(d, 'הצעת מחיר לצביעה', 'Painting quotes');
    expect((await approve(d, id)).body.code).toBe('draft_failed');
    expect(d.claims.filter((c) => c.ref_id === id)).toHaveLength(2);
    expect(d.actions.get(id)!.status).toBe('proposed');
    expect((await handle({ action: 'decide', id, decision: 'reject' }, d, paths)).body.status).toBe('rejected');
    expect(d.claims.filter((c) => c.ref_id === id)).toHaveLength(0);
  });

  it('a topic being written cannot be rejected under it; a flow rejected meanwhile stores nothing; an old writing claim can be pressed again', async () => {
    const d = deps(); d.caller = admin();
    const first = d.complete as ReturnType<typeof vi.fn>;
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => { release = r; });
    d.complete = vi.fn(async (a: { schema: { name: string } }) => { if (a.schema.name === 'guide_article') await gate; return first(a); }) as never;
    const id = await propose(d, 'הצעת מחיר לצביעה', 'Painting quotes');
    const writing = approve(d, id);
    await vi.waitFor(() => expect(calls(d, 'guide_article')).toHaveLength(1));
    expect(await handle({ action: 'decide', id, decision: 'reject' }, d, paths)).toMatchObject({ status: 409, body: { code: 'drafting' } });
    d.actions.get(id)!.status = 'rejected'; // a rejection that slipped in anyway (e.g. straight in the database)
    release();
    expect(await writing).toMatchObject({ status: 409, body: { code: 'not_pending' } });
    expect(d.articles.size).toBe(0);
    expect(d.claims.filter((c) => c.kind === 'title')).toHaveLength(0);
    // a writing claim older than the hold (a crashed request) does not block the Owner forever
    const e = deps(); e.caller = admin();
    const id2 = await propose(e, 'הצעת מחיר לריצוף', 'Flooring quotes');
    Object.assign(e.actions.get(id2)!, { error: 'drafting:old', decided_at: new Date(NOW.getTime() - 16 * 60_000).toISOString() });
    expect((await approve(e, id2)).body.status).toBe('drafted');
  });

  it('a skipped duplicate never makes a later proposal of the week vanish', async () => {
    const d = deps(); d.caller = admin();
    let t = new Date('2026-11-01T06:10:00Z'); d.now = () => t;
    managerSays(d, [{ topic_he: 'תמחור יבוא עם המרת מטבעות', topic_en: 'Import Pricing with Currency Conversion' }, { topic_he: 'הצעת מחיר לניקיון', topic_en: 'Cleaning quotes' }]);
    await handle({ action: 'run', agent: 'manager' }, d, paths);
    managerSays(d, [{ topic_he: 'מקדמה בהצעת מחיר', topic_en: 'Deposits in a quote' }]);
    t = new Date('2026-11-01T08:10:00Z');
    await handle({ action: 'run', agent: 'manager' }, d, paths);
    const arts = [...d.actions.values()].filter((a) => a.action_type === 'article_draft');
    expect(arts.map((a) => `${a.payload.topic_en}|${a.dedupe_key}`)).toEqual(['Cleaning quotes|article:2026-11-01:0', 'Deposits in a quote|article:2026-11-01:1']);
  });

  it('the same distinct focus as another flow is a duplicate; a rewrite keeps the approved focus; an empty topic makes no call', async () => {
    const d = deps(); d.caller = admin();
    const focus = 'שיפוץ מטבח בלבד: ארונות, משטח וחיבורי מים';
    const a1 = await propose(d, 'הצעות מחיר לשיפוצים', 'Renovation quotes');
    const a2 = await propose(d, 'שיפוצים: הצעת מחיר', 'Renovation pricing');
    expect((await approve(d, a1, { focus })).body.status).toBe('drafted');
    expect(await approve(d, a2, { focus: ` ${focus}! ` })).toMatchObject({ status: 409, body: { code: 'duplicate_topic', match: { kind: 'claim', id: a1 } } });
    const art = [...d.articles.values()][0];
    const pub = [...d.actions.values()].find((x) => x.action_type === 'article_publish')!;
    await handle({ action: 'revise', id: pub.id, note: 'יותר דוגמאות' }, d, paths);
    expect(JSON.parse(calls(d, 'guide_article').at(-1)![0].messages[1].content).distinctFocus).toBe(focus);
    expect(art.slug).toBeTruthy();
    const before = calls(d, 'guide_article').length;
    const empty = await propose(d, '?!', '...');
    expect(await approve(d, empty)).toMatchObject({ status: 409, body: { code: 'draft_failed' } });
    expect(calls(d, 'guide_article')).toHaveLength(before);
  });

  it('the inventory cannot be read: no manager run, no paid call, no draft', async () => {
    const d = deps(); d.caller = admin();
    d.articleInventory = vi.fn(async () => { throw new Error('database'); });
    const r = await handle({ action: 'run', agent: 'manager' }, d, paths);
    expect((r.body.results as { status: string; error: string }[])[0]).toMatchObject({ status: 'failed', error: 'article_inventory_unavailable' });
    expect(calls(d, 'manager_weekly')).toHaveLength(0);
    const id = await propose(d, 'הצעת מחיר לצביעה', 'Painting quotes');
    expect(await approve(d, id)).toMatchObject({ status: 503, body: { code: 'article_inventory_unavailable' } });
    expect(calls(d, 'guide_article')).toHaveLength(0);
  });

  it('the budget refuses a request: no fallback request, the runs are skipped with the reason, the approval says so, the numbers still go out', async () => {
    const d = deps(); d.caller = admin();
    d.complete = vi.fn(async () => { throw new Error('budget_insufficient'); }) as never;
    const m = await handle({ action: 'run', agent: 'manager' }, d, paths);
    expect((m.body.results as { status: string; error: string }[])[0]).toMatchObject({ status: 'skipped_cap', error: 'budget_insufficient' });
    expect(calls(d, 'manager_weekly')).toHaveLength(1); // the fallback model is never tried
    const s = await handle({ action: 'run', agent: 'social' }, d, paths);
    expect((s.body.results as { status: string; error: string }[])[0]).toMatchObject({ status: 'skipped_cap', error: 'budget_insufficient' });
    const seo = await handle({ action: 'run', agent: 'seo' }, d, paths);
    expect((seo.body.results as { status: string }[])[0].status).toBe('done');
    expect([...d.runs.values()].find((x) => x.agent === 'seo')!.data).toMatchObject({ note: 'budget_insufficient' });
    const id = await propose(d, 'הצעת מחיר לצביעה', 'Painting quotes');
    expect(await approve(d, id)).toMatchObject({ status: 409, body: { code: 'budget_insufficient' } });
    expect(calls(d, 'guide_article')).toHaveLength(1);
    expect(d.actions.get(id)!.status).toBe('proposed');
  });
});

export type { Finding };
