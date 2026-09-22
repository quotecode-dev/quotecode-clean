// IRON-DATE-001 - DATE CONTRACT GATE (canonical 5186, real Chromium). Unambiguous fixture: created 2026-09-13T09:00Z, valid until 2026-09-13.
// Required rendering: HE / Local -> 13/09/2026, EN / International -> 09/13/2026 - under OPPOSING browser environments
// (browser locale en-US / he-IL / en-GB, time zone America/Los_Angeles UTC-7 vs Pacific/Kiritimati UTC+14). The rendered product
// format must not change with the browser. Surfaces: Quote History (desktop table + mobile card), Clients (latest quote), Header
// clock (device day in market order), Public Quote (date + valid-until) incl. print emulation, and (HE super-admin) Admin timestamps.
import process from 'node:process';
import { chromium, personas, baseFromArgs, openAuthed, servedIdentity, identityProblems, evidenceDir, shot, writeEvidence, login } from './lib/canonical.mjs';

const base = baseFromArgs();
const { PERSONA_A, PERSONA_EN, PERSONA_SUPER_ADMIN, SUPABASE_URL, SUPABASE_ANON_KEY } = personas;
const ENVS = [
  { id: 'en-US@America/Los_Angeles', locale: 'en-US', timezoneId: 'America/Los_Angeles' },
  { id: 'he-IL@Pacific/Kiritimati', locale: 'he-IL', timezoneId: 'Pacific/Kiritimati' },
  { id: 'en-GB@Asia/Jerusalem', locale: 'en-GB', timezoneId: 'Asia/Jerusalem' },
];
const M = {
  he: { persona: PERSONA_A, client: 'לקוח תאריך IRONSTRESS', expect: '13/09/2026', order: (y, m, d) => `${d}/${m}/${y}` },
  en: { persona: PERSONA_EN, client: 'Date Fixture IRONSTRESS', expect: '09/13/2026', order: (y, m, d) => `${m}/${d}/${y}` },
};
const dir = evidenceDir('date-contract');
const deviceToday = (tz) => { const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).split('-'); return { y, m, d }; };

async function fixtureQuoteId(persona, client) {
  const t = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: persona.email, password: persona.password }) }).then((r) => r.json());
  const q = await fetch(`${SUPABASE_URL}/rest/v1/quotes?select=id,created_at,valid_until,clients!inner(company_name)&clients.company_name=eq.${encodeURIComponent(client)}&created_at=eq.2026-09-13T09:00:00%2B00:00`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${t.access_token}` } }).then((r) => r.json());
  return q?.[0]?.id || null;
}

const identity = { before: await servedIdentity(base) };
const cells = []; const shots = [];
const cell = (id, ok, detail, extra = {}) => { cells.push({ id, status: ok ? 'PASS' : 'FAIL', detail, ...extra }); if (!ok) console.log('FAIL', id, JSON.stringify(detail).slice(0, 200)); };

for (const env of ENVS) {
  for (const [lang, m] of Object.entries(M)) {
    const qid = await fixtureQuoteId(m.persona, m.client);
    cell(`${env.id}/${lang}/fixture-exists`, !!qid, { qid });
    for (const [vp, w, mobile] of [['desktop', 1440, false], ['mobile', 390, true]]) {
      const browser = await chromium.launch();
      const tag = `${env.id}/${lang}/${vp}`;
      try {
        const { page, loaded } = await openAuthed(browser, { persona: m.persona, lang, base, viewport: { width: w, height: 900 }, mobile, locale: env.locale, timezoneId: env.timezoneId });
        const idp = identityProblems({ served: identity.before, loaded });
        cell(`${tag}/loaded-identity+font`, idp.length === 0, idp);
        // Header clock: the device's day (in this browser time zone) in MARKET order
        const td = deviceToday(env.timezoneId); const wantHeader = m.order(td.y, td.m, td.d);
        const header = await page.locator('.dash-header-date').first().innerText().catch(() => null);
        cell(`${tag}/header-clock`, header === null || header === wantHeader, { header, want: wantHeader, note: header === null ? 'clock slot not showing (greeting shown) - order checked on the other surfaces' : undefined });
        // Quote History
        await page.getByPlaceholder(/Search client or quote #|חיפוש שם לקוח או מס׳ הצעה/).first().fill(m.client); await page.waitForTimeout(1300);
        const qhDate = await page.locator('[data-qh="date"]').first().innerText();
        cell(`${tag}/quote-history`, qhDate === m.expect, { rendered: qhDate, want: m.expect });
        if (env.id.startsWith('en-US') || env.id.startsWith('he-IL')) shots.push({ cell: `${tag}/quote-history`, ...(await shot(page, dir, `${lang}-${vp}-${env.timezoneId.replace('/', '_')}-quote-history.png`)) });
        if (!mobile) {
          // Clients: latest quote date of the fixture client
          await page.getByRole('button', { name: /^(Clients|לקוחות)$/ }).first().click(); await page.waitForTimeout(1200);
          await page.getByPlaceholder(/^(Search clients\.\.\.|חיפוש לקוח לפי שם)/).first().fill(m.client); await page.waitForTimeout(1200);
          const row = await page.locator('.dash-main-content .pf-screen-body').first().innerText({ timeout: 10000 });
          cell(`${tag}/clients-latest-quote`, row.includes(m.expect) && !row.includes(lang === 'he' ? '09/13/2026' : '13/09/2026'), { row: row.replace(/\s+/g, ' ').slice(0, 160), want: m.expect });
        }
        // Public Quote + print
        if (qid) {
          const pub = await browser.newContext({ viewport: { width: w, height: 1000 }, isMobile: mobile, hasTouch: mobile, locale: env.locale, timezoneId: env.timezoneId });
          const pp = await pub.newPage();
          await pp.goto(`${base}/quote/${qid}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
          await pp.waitForFunction(() => /13\/09\/2026|09\/13\/2026|\d{1,2}[./]\d{1,2}[./]\d{4}/.test(document.body.innerText), null, { timeout: 45000 }).catch(() => {});
          await pp.evaluate(() => document.fonts.ready);
          const body = await pp.evaluate(() => document.body.innerText);
          const all = body.match(/\b\d{1,2}[./]\d{1,2}[./]\d{4}\b/g) || [];
          const occurrences = all.filter((d) => d === m.expect).length;
          cell(`${tag}/public-quote`, occurrences >= 2 && all.every((d) => d === m.expect), { dates: all, want: m.expect, note: 'date + valid-until' });
          if (vp === 'desktop' && env.id.startsWith('en-US')) shots.push({ cell: `${tag}/public-quote`, ...(await shot(pp, dir, `${lang}-public-quote.png`, { fullPage: false })) });
          await pp.emulateMedia({ media: 'print' });
          const printed = (await pp.evaluate(() => document.body.innerText)).match(/\b\d{1,2}[./]\d{1,2}[./]\d{4}\b/g) || [];
          cell(`${tag}/public-quote-print`, printed.length >= 1 && printed.every((d) => d === m.expect), { dates: printed, want: m.expect });
          await pub.close();
        }
      } catch (e) { cell(`${tag}/flow`, false, String(e.message).split('\n')[0].slice(0, 160)); }
      await browser.close();
    }
  }
  // Admin (HE super-admin, Local): timestamps are DD/MM/YYYY HH:mm in the product zone regardless of the browser environment
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: env.locale, timezoneId: env.timezoneId });
    const page = await ctx.newPage(); await login(page, PERSONA_SUPER_ADMIN, 'he', base);
    await page.getByRole('button', { name: /^(משתמשים|Users)$/ }).first().click(); await page.waitForTimeout(2500);
    const txt = await page.evaluate(() => document.querySelector('.dash-main-content')?.innerText || '');
    const stamps = txt.match(/\b\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}\b/g) || [];
    const legacy = txt.match(/\b\d{1,2}\.\d{1,2}\.\d{4}\b/g) || [];
    const wrongOrder = stamps.filter((s) => +s.slice(0, 2) <= 12 && +s.slice(3, 5) > 12); // month field > 12 => MM/DD rendered for a Local viewer
    cell(`${env.id}/admin-he/timestamps`, stamps.length > 0 && legacy.length === 0 && wrongOrder.length === 0, { sample: stamps.slice(0, 4), legacy: legacy.slice(0, 3), wrongOrder: wrongOrder.slice(0, 3) });
    await ctx.close();
  } catch (e) { cell(`${env.id}/admin-he/timestamps`, false, String(e.message).split('\n')[0].slice(0, 160)); }
  await browser.close();
}

identity.after = await servedIdentity(base);
identity.problems = [...identityProblems({ served: identity.before }), ...identityProblems({ served: identity.after })];
const failed = cells.filter((c) => c.status !== 'PASS');
const verdict = !failed.length && !identity.problems.length ? 'PASS' : 'FAIL';
const ev = writeEvidence(dir, 'date-contract.json', { gate: 'DATE CONTRACT GATE (IRON-DATE-001)', base, fixture: { createdAt: '2026-09-13T09:00:00Z', validUntil: '2026-09-13' }, expected: { he: M.he.expect, en: M.en.expect }, environments: ENVS, at: new Date().toISOString(), identity, verdict, cells, screenshots: shots });
console.log(`DATE CONTRACT GATE: ${verdict} (${cells.length - failed.length}/${cells.length}; identity problems ${identity.problems.length}) evidence sha256 ${ev.sha256}`);
process.exit(verdict === 'PASS' ? 0 : 1);
