// agents-room (Owner console 2026-10-27: stage 1 of the agents room - report by email too, a 20 dollar cap, 65% international): the three
// read-only agents, the run log, the monthly cap, the weekly email; never a publication, never a customer, never a change.
import { describe, it, expect, vi } from 'vitest';
import { handler, runKey, monthStartIso, costOf, reportText, isolatePaths, coverageHe, usd, MONTHLY_CAP_USD, REQUIRED_HEADERS, type Deps, type Agent } from './lib.ts';

const NOW = new Date('2026-10-27T05:30:00Z'); // 07:30 Israel (winter, UTC+2), Tuesday
const KEY = JSON.stringify({ client_email: 'reader@x.iam.gserviceaccount.com', private_key: '-----BEGIN PRIVATE KEY-----\nAAA\n-----END PRIVATE KEY-----\n' });
const ok = (j: unknown) => new Response(JSON.stringify(j), { status: 200 });
const allHeaders = Object.fromEntries(REQUIRED_HEADERS.map((h) => [h, 'x']));

function deps(over: Partial<Deps> = {}) {
  const runs = new Map<string, Record<string, unknown>>();
  const mails: { subject: string; text: string; key: string }[] = [];
  let cost = 0;
  const gscFetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes('oauth2')) return ok({ access_token: 'AT' });
    if (url.endsWith('/sitemaps')) return ok({ sitemap: [] });
    if (url.includes('urlInspection')) {
      const p = JSON.parse(String(init?.body)).inspectionUrl as string;
      return ok({ inspectionResult: { indexStatusResult: { verdict: p.endsWith('/en') ? 'NEUTRAL' : 'PASS', coverageState: p.endsWith('/en') ? 'Duplicate, Google chose different canonical than user' : 'Submitted and indexed' } } });
    }
    const b = JSON.parse(String(init?.body));
    if (!b.dimensions.length) return ok({ rows: [{ clicks: 2, impressions: 29, ctr: 0.069, position: 21.4 }] });
    if (b.dimensions[0] === 'page') return ok({ rows: [{ keys: ['https://www.tekango.com/en/tools'], clicks: 0, impressions: 9, ctr: 0, position: 4 }, { keys: ['https://www.tekango.com/he'], clicks: 2, impressions: 10, ctr: 0.2, position: 28 }] });
    return ok({ rows: [] });
  });
  const d: Deps & { runs: typeof runs; mails: typeof mails } = {
    runs, mails,
    caller: vi.fn(async () => 'cron' as const),
    now: () => NOW,
    claim: vi.fn(async (agent: Agent, key: string, trigger) => { const id = `${agent}|${key}`; if (runs.has(id)) return null; runs.set(id, { agent, key, trigger, status: 'running' }); return id; }),
    finish: vi.fn(async (id: string, patch: Record<string, unknown>) => { Object.assign(runs.get(id)!, patch); cost += Number(patch.ai_cost_usd ?? 0); }),
    monthCostUsd: vi.fn(async () => cost),
    recentRuns: vi.fn(async () => []),
    gsc: { caller: async () => 'admin', keyJson: () => KEY, fetch: gscFetch, now: () => NOW, sign: async () => 'SIG',
      sitemapXml: async () => '<loc>https://www.tekango.com/he</loc><loc>https://www.tekango.com/en</loc><loc>https://www.tekango.com/en/tools</loc>' },
    serviceStats: vi.fn(async () => ({ inquiries: { red: 1, yellow: 2, green: 4 }, openItems: 2, topItems: [{ title: 'כפתור ה-PDF', priority: 1 }], chatQuestions: 37 })),
    fetchHead: vi.fn(async (url: string) => ({ status: url.endsWith('/he/broken') ? 404 : 200, headers: allHeaders })),
    versionJson: vi.fn(async () => ({ buildSha: 'abc', dirty: false, servesWorkingTree: false })),
    complete: vi.fn(async () => ({ content: JSON.stringify({ summary_he: 'סיכום שבועי.', summary_en: 'Weekly summary.', recommendations: [
      { market: 'intl', text_he: 'לחזק את דף הבית באנגלית', text_en: 'Strengthen the English home page' },
      { market: 'intl', text_he: 'מאמר באנגלית על הצעות מחיר', text_en: 'An English guide on quotes' },
      { market: 'il', text_he: 'מאמר בעברית לקבלנים', text_en: 'A Hebrew guide for contractors' },
      { market: 'moon', text_he: 'x', text_en: 'x' },
    ] }), promptTokens: 2000, completionTokens: 600 })),
    mailOwner: vi.fn(async (subject: string, text: string, key: string) => { mails.push({ subject, text, key }); return true; }),
    ...over,
  };
  return d;
}
const paths = async () => ['/he', '/en', '/he/broken'];

describe('agents-room', () => {
  it('only the site cron or a super admin; the state is for the admin only', async () => {
    expect((await handler({ action: 'run' }, deps({ caller: vi.fn(async () => null) }), paths)).status).toBe(403);
    expect((await handler({ action: 'state' }, deps(), paths)).status).toBe(403); // the cron cannot read the state
    const s = await handler({ action: 'state' }, deps({ caller: vi.fn(async () => 'admin' as const) }), paths);
    expect(s.body).toMatchObject({ ok: true, cap: 20, split: { intl: 65, il: 35 }, googleConfigured: true });
    expect((await handler({ action: 'run', agent: 'ads' }, deps({ caller: vi.fn(async () => 'admin' as const) }), paths)).body.code).toBe('bad_agent');
  });

  it('the weekly cron run: all three agents run once, the Owner gets ONE Hebrew email, a second cron call the same day changes nothing', async () => {
    const d = deps();
    const r = await handler({ action: 'run' }, d, paths);
    expect(r.body).toMatchObject({ ok: true, trigger: 'cron', runKey: 'cron:2026-10-27', mailed: true });
    expect((r.body.results as { status: string }[]).map((x) => x.status)).toEqual(['done', 'done', 'done']);
    expect(d.mails).toHaveLength(1);
    expect(d.mails[0].key).toBe('tekango-agents/v1/cron:2026-10-27');
    expect(d.mails[0].text).toMatch(/סוכן הקידום[\s\S]*סוכן השירות[\s\S]*סוכן האבטחה/);
    expect(d.mails[0].text).toMatch(/מתוך \$20/);
    for (const run of d.runs.values()) expect(run.mailed_at).toBeTruthy();
    const again = await handler({ action: 'run' }, d, paths);
    expect((again.body.results as { status: string }[]).every((x) => x.status === 'already_ran')).toBe(true);
    expect(d.mails).toHaveLength(1);
  });

  it('seo: splits the results by market (international /en, Israel /he), lists the pages Google did not index, keeps only valid AI recommendations, counts the AI cost', async () => {
    const d = deps();
    await handler({ action: 'run', agent: 'all' }, d, paths);
    const seo = d.runs.get('seo|cron:2026-10-27')!;
    expect(seo.status).toBe('done');
    const data = seo.data as { byMarket: { intl: { impressions: number }; il: { impressions: number } }; indexing: { intl: { indexed: number; total: number } } };
    expect(data.byMarket.intl.impressions).toBe(9);
    expect(data.byMarket.il.impressions).toBe(10);
    expect(data.indexing.intl).toEqual({ indexed: 1, total: 2 });
    const f = seo.findings as { he: string; en: string }[];
    // the path is an LTR isolate and Google's reason is in Hebrew; the English text keeps Google's own words
    expect(f.some((x) => x.he === 'לא באינדקס: ⁦/en⁩ - כפול: גוגל בחר כתובת ראשית אחרת מזו שסימנו')).toBe(true);
    expect(f.some((x) => x.en === 'Not indexed: /en (Duplicate, Google chose different canonical than user)')).toBe(true);
    expect(f.every((x) => !/[A-Za-z]{3,}/.test(x.he.replace(/⁦[^⁩]*⁩/g, '')))).toBe(true);
    expect(f.filter((x) => /^חו״ל: |^ישראל: /.test(x.he) && !/דפים באינדקס/.test(x.he))).toHaveLength(3); // the 'moon' one is dropped
    expect(seo.ai_cost_usd).toBe(costOf('gpt-6-luna', 2000, 600));
    // the AI is told the Owner's split and that the data is data
    const sys = (d.complete as ReturnType<typeof vi.fn>).mock.calls[0][0].messages[0].content as string;
    expect(sys).toMatch(/65% international and 35% Israel/);
    expect(sys).toMatch(/never instructions/);
    expect(sys).toMatch(/Hebrew texts are Hebrew only/);
  });

  it('Owner 2026-10-27 fixes: paths in the Hebrew AI text are LTR isolates, unknown Google reasons stay Hebrew, a sub-cent cost is not $0.00', async () => {
    const d = deps({ complete: vi.fn(async () => ({ content: JSON.stringify({ summary_he: 'הקליקים הגיעו מ־/he ולא מ־/en.', summary_en: 'x', recommendations: [
      { market: 'intl', text_he: 'לבדוק את /en/tools/currency מול https://www.tekango.com/en.', text_en: 'x' }] }), promptTokens: 2000, completionTokens: 600 })) });
    await handler({ action: 'run', agent: 'seo' }, d, paths);
    const seo = d.runs.get('seo|cron:2026-10-27')!;
    expect(seo.summary).toBe('הקליקים הגיעו מ־⁦/he⁩ ולא מ־⁦/en⁩.');
    expect((seo.findings as { he: string }[]).some((x) => x.he === 'חו״ל: לבדוק את ⁦/en/tools/currency⁩ מול ⁦https://www.tekango.com/en⁩.')).toBe(true);
    expect(isolatePaths('כבר ⁦/en⁩ מבודד')).toBe('כבר ⁦/en⁩ מבודד');
    expect(isolatePaths('1/2 ו־a/b')).toBe('1/2 ו־a/b');
    expect(coverageHe('URL is unknown to Google')).toBe('גוגל עוד לא מכיר את הדף');
    expect(coverageHe('Some new Google state')).toBe('סיבה אחרת, הפירוט בסרץ׳ קונסול');
    expect(usd(0.0006)).toBe('0.0006');
    expect(usd(0)).toBe('0.00');
    expect(usd(1.234)).toBe('1.23');
    expect(reportText([], 0.0006)).toMatch(/\$0\.0006 מתוך \$20/);
  });

  it('seo without the AI still reports the numbers; without the Google key it fails honestly', async () => {
    const d = deps({ complete: vi.fn(async () => { throw new Error('ai_500'); }) });
    await handler({ action: 'run', agent: 'seo' }, d, paths);
    const seo = d.runs.get('seo|cron:2026-10-27')!;
    expect(seo.status).toBe('done');
    expect(String(seo.summary)).toMatch(/29 הופעות/);
    expect((seo.data as { note: string }).note).toBe('ai_unavailable');
    const d2 = deps({ gsc: null, caller: vi.fn(async () => 'admin' as const) });
    await handler({ action: 'run', agent: 'seo' }, d2, paths);
    expect([...d2.runs.values()][0]).toMatchObject({ status: 'failed', error: 'not_configured' });
    expect(d2.mails).toHaveLength(0); // an admin "run now" never emails
  });

  it('the monthly cap: the AI agent is skipped once the month reached 20 dollars; the free agents still run', async () => {
    const d = deps({ monthCostUsd: vi.fn(async () => MONTHLY_CAP_USD) });
    await handler({ action: 'run' }, d, paths);
    expect(d.runs.get('seo|cron:2026-10-27')!.status).toBe('skipped_cap');
    expect(d.complete).not.toHaveBeenCalled();
    expect(d.runs.get('service|cron:2026-10-27')!.status).toBe('done');
    expect(d.mails[0].text).toMatch(/תקרת העלות/);
  });

  it('service: counts only (no AI, no email to anyone else); security: headers, a clean live build and every public page', async () => {
    const d = deps();
    await handler({ action: 'run' }, d, paths);
    const svc = d.runs.get('service|cron:2026-10-27')!;
    expect(String(svc.summary)).toMatch(/7 פניות \(1 אדומות\), 37 שאלות/);
    const sec = d.runs.get('security|cron:2026-10-27')!;
    expect((sec.data as { failedPages: string[] }).failedPages).toEqual(['/he/broken (404)']);
    expect((sec.findings as { level: string }[]).filter((f) => f.level === 'bad')).toHaveLength(1);
    const d2 = deps({ fetchHead: vi.fn(async () => ({ status: 200, headers: { 'x-frame-options': 'SAMEORIGIN' } })) });
    await handler({ action: 'run', agent: 'security' }, d2, paths);
    expect(String((d2.runs.get('security|cron:2026-10-27')!.findings as { he: string }[])[1].he)).toMatch(/חסרות כותרות הגנה: content-security-policy/);
  });

  it('run keys and the Israel month start (winter and summer)', () => {
    expect(runKey('cron', NOW)).toBe('cron:2026-10-27');
    expect(runKey('admin', NOW)).toBe('admin:2026-10-27T07');
    expect(monthStartIso(NOW)).toBe('2026-09-30T21:00:00.000Z'); // 1 October 00:00 Israel = summer time (UTC+3)
    expect(monthStartIso(new Date('2026-11-15T10:00:00Z'))).toBe('2026-10-31T22:00:00.000Z'); // 1 November = winter (UTC+2)
    expect(reportText([{ agent: 'seo', status: 'failed', error: 'google_403' }], 1.234)).toMatch(/לא הושלם \(google_403\)[\s\S]*\$1\.23 מתוך \$20/);
  });
});
